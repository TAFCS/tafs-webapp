"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, GraduationCap, Layers } from "lucide-react";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { toggleId } from "@/components/filters/filter-params";
import { campusesService, type Campus, type CampusClassInfo, type SectionInfo } from "@/lib/campuses.service";
import type { EcBulkTarget } from "@/lib/ec-fees.types";
import { useUserScope } from "@/hooks/use-tile-access";
import { EcField, ecInputClass } from "./ui";

export type EcTargetMode = "placement" | "ccs";

export interface EcTargetState {
    mode: EcTargetMode;
    campusIds: number[];
    classIds: number[];
    sectionIds: number[];
    ccText: string;
}

export const emptyTarget: EcTargetState = { mode: "placement", campusIds: [], classIds: [], sectionIds: [], ccText: "" };

/** C.C.s typed or pasted: any mix of commas, spaces and new lines. */
export function parseCcs(text: string): number[] {
    return [...new Set(text.split(/[\s,;]+/).map((x) => Number(x.trim())).filter((x) => Number.isInteger(x) && x > 0))];
}

/** What the API takes, or null when nothing narrows the students yet. */
export function targetToApi(t: EcTargetState): EcBulkTarget | null {
    if (t.mode === "ccs") {
        const ccs = parseCcs(t.ccText);
        return ccs.length ? { student_ids: ccs } : null;
    }
    if (!t.campusIds.length && !t.classIds.length && !t.sectionIds.length) return null;
    return { campus_ids: t.campusIds, class_ids: t.classIds, section_ids: t.sectionIds };
}

/**
 * TAFSD-605: choose the students for a bulk extracurricular operation, by
 * campus / class / section (multi-select, empty = all) or by a list of C.C.s.
 * The server applies the caller's scope either way.
 */
export function EcBulkTargetPicker({ value, onChange }: { value: EcTargetState; onChange: (t: EcTargetState) => void }) {
    const userScope = useUserScope();
    const [campuses, setCampuses] = useState<Campus[]>([]);
    const [classes, setClasses] = useState<CampusClassInfo[]>([]);
    const [sections, setSections] = useState<SectionInfo[]>([]);

    useEffect(() => {
        campusesService.list().then(setCampuses).catch(() => setCampuses([]));
        campusesService.listAllClasses().then(setClasses).catch(() => setClasses([]));
        campusesService.listAllSections().then(setSections).catch(() => setSections([]));
    }, []);

    const campusOptions = useMemo(
        () => userScope.filterOptions("campuses", campuses, (c) => c.id).map((c) => ({ id: c.id, label: c.campus_name })),
        [userScope, campuses],
    );
    const ccs = parseCcs(value.ccText);
    const set = (patch: Partial<EcTargetState>) => onChange({ ...value, ...patch });

    return (
        <div className="space-y-3">
            <div className="flex gap-1.5" role="tablist" aria-label="Choose students by">
                {(
                    [
                        ["placement", "By campus, class or section"],
                        ["ccs", "By C.C. list"],
                    ] as const
                ).map(([mode, label]) => (
                    <button
                        key={mode}
                        type="button"
                        role="tab"
                        aria-selected={value.mode === mode}
                        onClick={() => set({ mode })}
                        className={`h-8 px-3 rounded-lg text-xs font-semibold border ${
                            value.mode === mode ? "bg-orange-600 border-orange-600 text-white" : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300"
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
            {value.mode === "placement" ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <FilterDropdown
                        label="Campuses"
                        icon={Building2}
                        value={value.campusIds}
                        options={campusOptions}
                        placeholder="All campuses"
                        onToggle={(id) => set({ campusIds: toggleId(value.campusIds, id) })}
                        onClear={() => set({ campusIds: [] })}
                        onSetValue={(ids) => set({ campusIds: ids })}
                    />
                    <FilterDropdown
                        label="Classes"
                        icon={GraduationCap}
                        value={value.classIds}
                        options={classes.map((c) => ({ id: c.id, label: c.description }))}
                        placeholder="All classes"
                        onToggle={(id) => set({ classIds: toggleId(value.classIds, id) })}
                        onClear={() => set({ classIds: [] })}
                        onSetValue={(ids) => set({ classIds: ids })}
                    />
                    <FilterDropdown
                        label="Sections"
                        icon={Layers}
                        value={value.sectionIds}
                        options={sections.map((s) => ({ id: s.id, label: s.description }))}
                        placeholder="All sections"
                        onToggle={(id) => set({ sectionIds: toggleId(value.sectionIds, id) })}
                        onClear={() => set({ sectionIds: [] })}
                        onSetValue={(ids) => set({ sectionIds: ids })}
                    />
                    <p className="sm:col-span-3 text-xs text-zinc-400">Only enrolled students you can see are included. Pick at least one campus, class or section.</p>
                </div>
            ) : (
                <EcField label="C.C. numbers" htmlFor="ec-bulk-ccs" hint={`${ccs.length} C.C.${ccs.length === 1 ? "" : "s"} read. Separate them with commas, spaces or new lines.`}>
                    <textarea
                        id="ec-bulk-ccs"
                        value={value.ccText}
                        onChange={(e) => set({ ccText: e.target.value })}
                        rows={4}
                        placeholder="e.g. 9001, 9002, 9003"
                        className={`${ecInputClass} h-auto py-3 font-mono`}
                    />
                </EcField>
            )}
        </div>
    );
}
