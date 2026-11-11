"use client";

// TAFSD-475: special categories (Fee Endowment, Complementary, Sehm-e-Sadaat, …)
// come from School Setup → Special Categories, not from code. A category's
// `key` is its fixed code (FEE_ENDOWMENT). Full names only: never FE / COMP.

import { useEffect, useState } from "react";
import api from "@/lib/api";

export type CategoryTone = "amber" | "orange" | "emerald" | "sky" | "violet" | "rose" | "teal" | "slate";
export const CATEGORY_TONES: CategoryTone[] = ["amber", "orange", "emerald", "sky", "violet", "rose", "teal", "slate"];

export interface StudentCategory {
    id: number;
    key: string;
    label: string;
    /** One line under the name, e.g. "Everything waived". */
    description: string | null;
    tone: CategoryTone;
    order: number;
    is_active: boolean;
    /** Students holding it now (School Setup list only). */
    student_count?: number;
}

/** @deprecated TAFSD-475: kept for imports; it is the category type now. */
export type StudentBenefit = StudentCategory;
export type StudentBenefitKey = string;

// ── Loading ────────────────────────────────────────────────────────────────

let cache: StudentCategory[] | null = null;
let inflight: Promise<StudentCategory[]> | null = null;
const listeners = new Set<(c: StudentCategory[]) => void>();

/** Every category, retired ones included, in School Setup order. */
export async function fetchStudentCategories(force = false): Promise<StudentCategory[]> {
    if (cache && !force) return cache;
    if (inflight && !force) return inflight;
    inflight = api
        .get("/v1/student-categories")
        .then((res) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API row, normalised here
            const rows: StudentCategory[] = (res.data?.data ?? res.data ?? []).map((r: any) => ({
                id: r.id,
                key: r.key ?? r.code,
                label: r.label,
                description: r.description ?? null,
                tone: (CATEGORY_TONES.includes(r.tone) ? r.tone : "slate") as CategoryTone,
                order: r.order ?? r.display_order ?? 0,
                is_active: r.is_active !== false,
                student_count: r.student_count,
            }));
            cache = rows;
            listeners.forEach((l) => l(rows));
            return rows;
        })
        .finally(() => {
            inflight = null;
        });
    return inflight;
}

/** Drop the cached list (after School Setup changes it). */
export const refreshStudentCategories = () => fetchStudentCategories(true);

/** The category list, loaded once per page load and shared. */
export function useStudentCategories(): { categories: StudentCategory[]; loading: boolean } {
    const [categories, setCategories] = useState<StudentCategory[]>(cache ?? []);
    const [loading, setLoading] = useState(!cache);
    useEffect(() => {
        let alive = true;
        const on = (c: StudentCategory[]) => alive && setCategories(c);
        listeners.add(on);
        fetchStudentCategories()
            .then(on)
            .catch(() => undefined)
            .finally(() => alive && setLoading(false));
        return () => {
            alive = false;
            listeners.delete(on);
        };
    }, []);
    return { categories, loading };
}

export const benefitLabel = (key: string) =>
    cache?.find((b) => b.key === key)?.label ?? key.replace(/_/g, " ").toLowerCase().replace(/^\w|\s\w/g, (m) => m.toUpperCase());

// ── A student's categories in a form ───────────────────────────────────────

export interface BenefitState {
    on: boolean;
    reason: string;
    /** YYYY-MM-DD or "". */
    until: string;
    /** YYYY-MM-DD or "": when the home reminder starts. */
    remind_from: string;
}
/** Keyed by category code. Categories the student never held may be missing. */
export type BenefitsState = Record<string, BenefitState>;

const OFF: BenefitState = { on: false, reason: "", until: "", remind_from: "" };
const day = (v: unknown) => (v ? String(v).slice(0, 10) : "");

/** A category's form state, off when absent. */
export const benefitOf = (state: BenefitsState, key: string): BenefitState => state[key] ?? OFF;

/**
 * The categories a student record holds. Reads `categories` (TAFSD-475), and
 * falls back to the flat is_<code> keys of an older response.
 */
export function benefitsFromStudent(s: Record<string, unknown> | null | undefined): BenefitsState {
    const out: BenefitsState = {};
    const list = s?.categories as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(list)) {
        for (const c of list)
            out[String(c.key)] = {
                on: true,
                reason: String(c.reason ?? ""),
                until: day(c.until),
                remind_from: day(c.remind_from),
            };
        return out;
    }
    for (const [k, v] of Object.entries(s ?? {})) {
        if (!k.startsWith("is_") || v !== true) continue;
        const p = k.slice(3);
        out[p.toUpperCase()] = {
            on: true,
            reason: String(s?.[`${p}_reason`] ?? ""),
            until: day(s?.[`${p}_until`]),
            remind_from: day(s?.[`${p}_remind_from`]),
        };
    }
    return out;
}

export const emptyBenefits = (): BenefitsState => ({});

/** The categories switched on, in School Setup order (unknown codes last). */
export function heldCategories(state: BenefitsState, categories: StudentCategory[]): StudentCategory[] {
    const known = categories.filter((c) => state[c.key]?.on);
    const unknown = Object.keys(state)
        .filter((k) => state[k].on && !categories.some((c) => c.key === k))
        .map<StudentCategory>((k, i) => ({ id: -1 - i, key: k, label: benefitLabel(k), description: null, tone: "slate", order: 1e6 + i, is_active: false }));
    return [...known, ...unknown];
}

/** The first category switched on without a reason or end date, if any. */
export function benefitMissing(state: BenefitsState, categories: StudentCategory[] = []): StudentCategory | undefined {
    return heldCategories(state, categories).find((b) => {
        const v = state[b.key];
        return !v.reason.trim() || !v.until;
    });
}

/**
 * PATCH body for /staff-editing/students/:cc: every category the form touched.
 * Off categories are taken off (their details go with them).
 */
export function benefitsPayload(state: BenefitsState): { categories: Array<{ code: string; on: boolean; reason: string | null; until: string | null; remind_from: string | null }> } {
    return {
        categories: Object.entries(state).map(([code, v]) => ({
            code,
            on: v.on,
            reason: v.on ? v.reason.trim() : null,
            until: v.on && v.until ? v.until : null,
            remind_from: v.on && v.remind_from ? v.remind_from : null,
        })),
    };
}

const normalized = (s: BenefitsState) =>
    JSON.stringify(
        Object.entries(s)
            .filter(([, v]) => v.on)
            .sort(([a], [b]) => a.localeCompare(b)),
    );

export const benefitsChanged = (a: BenefitsState, b: BenefitsState) => normalized(a) !== normalized(b);
