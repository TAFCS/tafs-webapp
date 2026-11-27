"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, UserCircle, X } from "lucide-react";
import { studentsService, type SimpleStudentSearchResult } from "@/lib/students.service";
import { StudentMatchReason, STUDENT_SEARCH_PLACEHOLDER } from "@/components/students/StudentMatchReason";
import { useDebounced } from "./url-state";
import { ecInputClass } from "./ui";

export interface EcPickedStudent {
    cc: number;
    full_name: string | null;
    gr_number: string | null;
    class_name?: string | null;
    section_name?: string | null;
    campus_name?: string | null;
}

/**
 * TAFSD-605: pick a student for the Extracurricular Fees pages. Searches the
 * server (GET /v1/students/search-simple through studentsService, Rule 2),
 * debounced, within the caller's scope.
 */
export function EcStudentPicker({
    value,
    onChange,
    label = "Student",
}: {
    value: EcPickedStudent | null;
    onChange: (s: EcPickedStudent | null) => void;
    label?: string;
}) {
    const [text, setText] = useState("");
    const q = useDebounced(text, 300);
    const [hits, setHits] = useState<SimpleStudentSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const reqId = useRef(0);

    useEffect(() => {
        const query = q.trim();
        if (!query) return;
        const id = ++reqId.current;
        studentsService
            .searchSimple({ q: query })
            .then((r) => id === reqId.current && setHits(r))
            .catch(() => id === reqId.current && setHits([]))
            .finally(() => id === reqId.current && setLoading(false));
    }, [q]);

    if (value) {
        return (
            <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.18em] ml-1">{label}</span>
                <div className="flex items-center gap-3 rounded-xl border border-orange-200 dark:border-orange-900/60 bg-orange-50/60 dark:bg-orange-950/20 px-4 py-2.5">
                    <UserCircle className="h-8 w-8 text-orange-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{value.full_name ?? `Student ${value.cc}`}</div>
                        <div className="text-xs text-zinc-500 truncate">
                            C.C. {value.cc}
                            {value.gr_number ? ` · G.R. ${value.gr_number}` : ""}
                            {value.class_name ? ` · ${value.class_name}${value.section_name ? ` ${value.section_name}` : ""}` : ""}
                            {value.campus_name ? ` · ${value.campus_name}` : ""}
                        </div>
                    </div>
                    <button type="button" onClick={() => onChange(null)} className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-1">
                        <X className="h-3.5 w-3.5" /> Change
                    </button>
                </div>
            </div>
        );
    }

    const typing = text.trim() !== q.trim();
    return (
        <div className="flex flex-col gap-1.5 relative">
            <label htmlFor="ec-student-search" className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.18em] ml-1">
                {label}
            </label>
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input
                    id="ec-student-search"
                    value={text}
                    onChange={(e) => {
                        setText(e.target.value);
                        setOpen(true);
                        if (e.target.value.trim()) setLoading(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                    placeholder={STUDENT_SEARCH_PLACEHOLDER}
                    autoComplete="off"
                    className={`${ecInputClass} pl-11`}
                />
                {loading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-zinc-400" />}
            </div>
            {open && text.trim() && (
                <div className="absolute top-full mt-1 left-0 right-0 z-30 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl max-h-80 overflow-y-auto">
                    {typing || loading ? (
                        <div className="px-4 py-3 text-sm text-zinc-400">Searching…</div>
                    ) : hits.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-zinc-400">No student matches “{q.trim()}”.</div>
                    ) : (
                        hits.map((h) => (
                            <button
                                key={h.cc}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    onChange({
                                        cc: h.cc,
                                        full_name: h.full_name,
                                        gr_number: h.gr_number,
                                        class_name: h.classes?.description ?? null,
                                        section_name: h.sections?.description ?? null,
                                        campus_name: h.campuses?.campus_name ?? null,
                                    });
                                    setText("");
                                    setOpen(false);
                                }}
                                className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-900 last:border-0"
                            >
                                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{h.full_name}</div>
                                <div className="text-xs text-zinc-500">
                                    C.C. {h.cc}
                                    {h.gr_number ? ` · G.R. ${h.gr_number}` : ""}
                                    {h.classes?.description ? ` · ${h.classes.description}${h.sections?.description ? ` ${h.sections.description}` : ""}` : ""}
                                    {h.campuses?.campus_name ? ` · ${h.campuses.campus_name}` : ""}
                                </div>
                                <StudentMatchReason matchedOn={h.matched_on} />
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
