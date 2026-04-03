"use client";
import { useAppSelector } from "@/store/hooks";
import { ChevronDown } from "lucide-react";

export interface ScopeValue {
    campusId: string;
    classId: string;
    sectionId: string;
}

interface Props {
    value: ScopeValue;
    onChange: (v: ScopeValue) => void;
}

export function ScopeBlock({ value, onChange }: Props) {
    const campuses = useAppSelector((s: any) => s.campuses.items);

    const selectedCampus = campuses.find((c: any) => String(c.id) === value.campusId);
    const availableClasses: any[] = selectedCampus?.offered_classes ?? [];
    const selectedClass = availableClasses.find((c: any) => String(c.id) === value.classId);
    const availableSections: any[] = selectedClass?.sections ?? [];

    const sel =
        "w-full h-10 px-3 appearance-none bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-primary transition-all cursor-pointer";

    return (
        <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Scope</p>
            <div className="grid grid-cols-3 gap-3">
                {/* Campus */}
                <div className="relative">
                    <label className="block text-[10px] font-bold text-zinc-500 mb-1.5">Campus <span className="text-rose-500">*</span></label>
                    <div className="relative">
                        <select
                            value={value.campusId}
                            onChange={(e) => onChange({ campusId: e.target.value, classId: "", sectionId: "" })}
                            className={sel}
                        >
                            <option value="">Select campus...</option>
                            {campuses.map((c: any) => (
                                <option key={c.id} value={c.id}>{c.campus_name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                    </div>
                </div>

                {/* Class */}
                <div className="relative">
                    <label className="block text-[10px] font-bold text-zinc-500 mb-1.5">Class <span className="text-zinc-300">(optional)</span></label>
                    <div className="relative">
                        <select
                            value={value.classId}
                            onChange={(e) => onChange({ ...value, classId: e.target.value, sectionId: "" })}
                            disabled={!value.campusId}
                            className={`${sel} disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                            <option value="">All classes</option>
                            {availableClasses.map((c: any) => (
                                <option key={c.id} value={c.id}>{c.description}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                    </div>
                </div>

                {/* Section */}
                <div className="relative">
                    <label className="block text-[10px] font-bold text-zinc-500 mb-1.5">Section <span className="text-zinc-300">(optional)</span></label>
                    <div className="relative">
                        <select
                            value={value.sectionId}
                            onChange={(e) => onChange({ ...value, sectionId: e.target.value })}
                            disabled={!value.classId}
                            className={`${sel} disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                            <option value="">All sections</option>
                            {availableSections.map((s: any) => (
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
