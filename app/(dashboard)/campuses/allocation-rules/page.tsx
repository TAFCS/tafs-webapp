"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    AlertCircle,
    AlertTriangle,
    ArrowLeft,
    CheckCircle,
    Loader2,
    RefreshCw,
    Save,
    Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAppSelector } from "@/store/hooks";
import {
    Campus,
    OfferedSection,
    SectionGenderMode,
    campusesService,
} from "@/lib/campuses.service";

type DraftRule = {
    student_capacity: string;
    unlimited: boolean;
    gender_mode: SectionGenderMode;
};

const GENDER_OPTIONS: Array<{ value: SectionGenderMode; label: string }> = [
    { value: "COED", label: "Coed (boys & girls)" },
    { value: "BOYS_ONLY", label: "Boys only" },
    { value: "GIRLS_ONLY", label: "Girls only" },
];

function toDraft(section: OfferedSection): DraftRule {
    return {
        student_capacity:
            section.student_capacity == null ? "" : String(section.student_capacity),
        unlimited: section.student_capacity == null,
        gender_mode: section.gender_mode ?? "COED",
    };
}

export default function SectionAllocationRulesPage() {
    const user = useAppSelector((s) => s.auth.user);
    const canView = !!user?.permissions?.includes("academic.campuses.view");
    const canEdit = !!user?.permissions?.includes("academic.campuses.edit")
        || !!user?.permissions?.includes("academic.campuses.update")
        || user?.role === "SUPER_ADMIN"
        || user?.role === "CAMPUS_ADMIN";

    const [campuses, setCampuses] = useState<Campus[]>([]);
    const [selectedCampusId, setSelectedCampusId] = useState<number | "">("");
    const [selectedClassId, setSelectedClassId] = useState<number | "">("");
    const [drafts, setDrafts] = useState<Record<number, DraftRule>>({});
    const [savingId, setSavingId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await campusesService.list();
            setCampuses(data);
        } catch (err) {
            console.error(err);
            setError("Failed to load campus offerings.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (canView) loadData();
        else setIsLoading(false);
    }, [canView]);

    const selectedCampus = useMemo(
        () => campuses.find((c) => c.id === Number(selectedCampusId)),
        [campuses, selectedCampusId],
    );

    const offeredClasses = selectedCampus?.offered_classes ?? [];

    const selectedClass = useMemo(
        () => offeredClasses.find((c) => c.id === Number(selectedClassId)),
        [offeredClasses, selectedClassId],
    );

    const sections = selectedClass?.sections ?? [];

    useEffect(() => {
        const next: Record<number, DraftRule> = {};
        sections.forEach((sec) => {
            next[sec.id] = toDraft(sec);
        });
        setDrafts(next);
    }, [selectedCampusId, selectedClassId, campuses]);

    if (!canView) {
        return (
            <div className="p-8">
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                    You do not have permission to view section allocation rules.
                </div>
            </div>
        );
    }

    const updateDraft = (sectionId: number, patch: Partial<DraftRule>) => {
        setDrafts((prev) => ({
            ...prev,
            [sectionId]: { ...prev[sectionId], ...patch },
        }));
    };

    const handleSave = async (section: OfferedSection) => {
        if (!selectedCampusId || !selectedClassId) return;
        if (!canEdit) {
            toast.error("You do not have permission to update allocation rules.");
            return;
        }

        const draft = drafts[section.id];
        if (!draft) return;

        let capacity: number | null = null;
        if (!draft.unlimited) {
            const parsed = Number(draft.student_capacity);
            if (!Number.isInteger(parsed) || parsed < 1) {
                toast.error("Capacity must be a positive whole number, or Unlimited.");
                return;
            }
            capacity = parsed;
        }

        setSavingId(section.id);
        try {
            const updated = await campusesService.upsertCampusSection(
                Number(selectedCampusId),
                Number(selectedClassId),
                section.id,
                {
                    is_active: true,
                    student_capacity: capacity,
                    gender_mode: draft.gender_mode,
                },
            );
            setCampuses((prev) =>
                prev.map((c) => (c.id === updated.id ? updated : c)),
            );
            toast.success(`Saved rules for section ${section.description}`);
        } catch (err: any) {
            const message =
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                "Failed to save allocation rules";
            toast.error(typeof message === "string" ? message : "Failed to save allocation rules");
        } finally {
            setSavingId(null);
        }
    };

    return (
        <div className="p-6 md:p-8 space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <Link
                        href="/campuses"
                        className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to Campuses
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Section Allocation Rules
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Configure student capacity and gender mode for each campus + class + section offering.
                    </p>
                </div>
                <button
                    onClick={loadData}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    Refresh
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-200">Campus</span>
                    <select
                        value={selectedCampusId}
                        onChange={(e) => {
                            setSelectedCampusId(e.target.value ? Number(e.target.value) : "");
                            setSelectedClassId("");
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                    >
                        <option value="">Select campus</option>
                        {campuses.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.campus_name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-200">Class</span>
                    <select
                        value={selectedClassId}
                        onChange={(e) =>
                            setSelectedClassId(e.target.value ? Number(e.target.value) : "")
                        }
                        disabled={!selectedCampusId}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"
                    >
                        <option value="">Select class</option>
                        {offeredClasses.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.description}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            {isLoading ? (
                <div className="flex items-center gap-2 text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading offerings…
                </div>
            ) : !selectedCampusId || !selectedClassId ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
                    Select a campus and class to configure section rules.
                </div>
            ) : sections.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
                    No sections are offered for this campus/class. Configure them under Section Setup first.
                </div>
            ) : (
                <div className="space-y-4">
                    {sections.map((section) => {
                        const draft = drafts[section.id] ?? toDraft(section);
                        const occupancy =
                            section.student_capacity == null
                                ? `${section.enrolled_count ?? 0} enrolled (unlimited)`
                                : `${section.enrolled_count ?? 0} / ${section.student_capacity}`;

                        return (
                            <div
                                key={section.id}
                                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                            Section {section.description}
                                        </h2>
                                        <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                                            <Users className="h-4 w-4" />
                                            {occupancy}
                                            {section.is_full ? (
                                                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                                                    Full
                                                </span>
                                            ) : null}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            Boys: {section.male_count ?? 0} · Girls: {section.female_count ?? 0} · Unknown: {section.unknown_count ?? 0}
                                        </p>
                                    </div>
                                    {(section.capacity_conflict_count ?? 0) > 0 ||
                                    (section.gender_conflict_count ?? 0) > 0 ? (
                                        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                            <div>
                                                {(section.capacity_conflict_count ?? 0) > 0 && (
                                                    <div>
                                                        Over capacity by {section.capacity_conflict_count} student(s)
                                                    </div>
                                                )}
                                                {(section.gender_conflict_count ?? 0) > 0 && (
                                                    <div>
                                                        {section.gender_conflict_count} gender conflict(s) already enrolled
                                                    </div>
                                                )}
                                                <div className="text-xs opacity-80">
                                                    Existing students are not moved automatically.
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
                                            <CheckCircle className="h-4 w-4" /> No current conflicts
                                        </div>
                                    )}
                                </div>

                                <div className="mt-4 grid gap-4 md:grid-cols-3">
                                    <label className="space-y-1 text-sm md:col-span-1">
                                        <span className="font-medium text-slate-700 dark:text-slate-200">
                                            Capacity
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min={1}
                                                disabled={draft.unlimited || !canEdit}
                                                value={draft.unlimited ? "" : draft.student_capacity}
                                                onChange={(e) =>
                                                    updateDraft(section.id, {
                                                        student_capacity: e.target.value,
                                                        unlimited: false,
                                                    })
                                                }
                                                placeholder="e.g. 30"
                                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950"
                                            />
                                        </div>
                                        <label className="mt-2 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                            <input
                                                type="checkbox"
                                                checked={draft.unlimited}
                                                disabled={!canEdit}
                                                onChange={(e) =>
                                                    updateDraft(section.id, {
                                                        unlimited: e.target.checked,
                                                        student_capacity: e.target.checked
                                                            ? ""
                                                            : draft.student_capacity || "30",
                                                    })
                                                }
                                            />
                                            Unlimited
                                        </label>
                                    </label>

                                    <label className="space-y-1 text-sm md:col-span-1">
                                        <span className="font-medium text-slate-700 dark:text-slate-200">
                                            Gender mode
                                        </span>
                                        <select
                                            value={draft.gender_mode}
                                            disabled={!canEdit}
                                            onChange={(e) =>
                                                updateDraft(section.id, {
                                                    gender_mode: e.target.value as SectionGenderMode,
                                                })
                                            }
                                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950"
                                        >
                                            {GENDER_OPTIONS.map((opt) => (
                                                <option key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <div className="flex items-end">
                                        <button
                                            onClick={() => handleSave(section)}
                                            disabled={!canEdit || savingId === section.id}
                                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                                        >
                                            {savingId === section.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Save className="h-4 w-4" />
                                            )}
                                            Save rules
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
