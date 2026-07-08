"use client";
import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import { ChevronDown } from "lucide-react";
import type { CampusClass } from "@/store/slices/campusesSlice";

export interface ScopeValue {
    campusId: string;
    classId: string;
    sectionId: string;
}

interface Props {
    value: ScopeValue;
    onChange: (v: ScopeValue) => void;
    /** When set, only matching classes appear in the class dropdown */
    filterClass?: (cls: CampusClass) => boolean;
    /** Restrict class list to these class IDs (principal band scope) */
    allowedClassIds?: number[];
    /** Lock campus dropdown to this campus ID */
    lockCampusId?: number;
    /** Require class + section selection (no "All" options) */
    requireClassAndSection?: boolean;
    /** Hide campus select dropdown */
    hideCampusSelect?: boolean;
}

export function ScopeBlock({
    value,
    onChange,
    filterClass,
    allowedClassIds,
    lockCampusId,
    requireClassAndSection = false,
    hideCampusSelect = false,
}: Props) {
    const allCampuses = useAppSelector((s: any) => s.campuses.items);
    const campuses = useMemo(() => {
        if (lockCampusId != null) {
            return allCampuses.filter((c: { id: number }) => c.id === lockCampusId);
        }
        return allCampuses;
    }, [allCampuses, lockCampusId]);

    const selectedCampus = campuses.find((c: any) => String(c.id) === value.campusId);
    const availableClasses: CampusClass[] = useMemo(() => {
        const offered = selectedCampus?.offered_classes ?? [];
        let list = offered;
        if (allowedClassIds?.length) {
            const set = new Set(allowedClassIds);
            list = list.filter((c: CampusClass) => set.has(c.id));
        }
        return filterClass ? list.filter(filterClass) : list;
    }, [selectedCampus, filterClass, allowedClassIds]);
    const selectedClass = availableClasses.find((c) => String(c.id) === value.classId);
    const availableSections: CampusClass["sections"] = selectedClass?.sections ?? [];

    const sel =
        "w-full h-10 px-3 appearance-none bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-primary transition-all cursor-pointer";

    return (
        <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Scope</p>
            <div className={`grid gap-3 ${hideCampusSelect ? "grid-cols-2" : "grid-cols-3"}`}>
                {/* Campus */}
                {!hideCampusSelect && (
                    <div className="relative">
                        <label className="block text-[10px] font-bold text-zinc-500 mb-1.5">Campus <span className="text-rose-500">*</span></label>
                        <div className="relative">
                            <select
                                value={value.campusId}
                                onChange={(e) => onChange({ campusId: e.target.value, classId: "", sectionId: "" })}
                                disabled={lockCampusId != null}
                                className={`${sel} disabled:opacity-60 disabled:cursor-not-allowed`}
                            >
                                <option value="">Select campus...</option>
                                {campuses.map((c: { id: number; campus_name: string }) => (
                                    <option key={c.id} value={c.id}>{c.campus_name}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                        </div>
                    </div>
                )}

                {/* Class */}
                <div className="relative">
                    <label className="block text-[10px] font-bold text-zinc-500 mb-1.5">
                        Class{" "}
                        {requireClassAndSection ? (
                            <span className="text-rose-500">*</span>
                        ) : (
                            <span className="text-zinc-300">(optional)</span>
                        )}
                    </label>
                    <div className="relative">
                        <select
                            value={value.classId}
                            onChange={(e) => onChange({ ...value, classId: e.target.value, sectionId: "" })}
                            disabled={!value.campusId}
                            className={`${sel} disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                            <option value="">
                                {requireClassAndSection ? "Select class..." : "All classes"}
                            </option>
                            {availableClasses.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.class_code ? `${c.class_code} — ${c.description}` : c.description}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                    </div>
                </div>

                {/* Section */}
                <div className="relative">
                    <label className="block text-[10px] font-bold text-zinc-500 mb-1.5">
                        Section{" "}
                        {requireClassAndSection ? (
                            <span className="text-rose-500">*</span>
                        ) : (
                            <span className="text-zinc-300">(optional)</span>
                        )}
                    </label>
                    <div className="relative">
                        <select
                            value={value.sectionId}
                            onChange={(e) => onChange({ ...value, sectionId: e.target.value })}
                            disabled={!value.classId}
                            className={`${sel} disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                            <option value="">
                                {requireClassAndSection ? "Select section..." : "All sections"}
                            </option>
                            {availableSections.map((s) => (
                                <option key={s.id} value={s.id}>{s.description}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                    </div>
                </div>
            </div>
        </div>
    );
}
