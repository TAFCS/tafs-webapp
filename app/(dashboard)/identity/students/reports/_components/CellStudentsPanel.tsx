"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, X } from "lucide-react";
import { studentReportsService, type StrengthCellStudent, type StrengthFilters } from "@/lib/student-reports.service";

/** TAFSD-451: the students behind one number of the Strength grid. */
export function CellStudentsPanel({
    filters,
    cell,
    title,
    onClose,
}: {
    filters: StrengthFilters;
    cell: { row?: string; column?: string };
    title: string;
    onClose: () => void;
}) {
    const [data, setData] = useState<{ total: number; truncated: boolean; items: StrengthCellStudent[] } | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Mounted fresh for each cell (keyed by the page), so nothing to reset here.
        let cancelled = false;
        studentReportsService
            .cellStudents(filters, cell)
            .then((d) => !cancelled && setData(d))
            .catch((e) => !cancelled && setError(e?.response?.data?.message || "Could not load the students."));
        return () => {
            cancelled = true;
        };
    }, [filters, cell]);

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
            <div
                className="h-full w-full max-w-xl bg-white dark:bg-zinc-950 shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3 p-5 border-b border-zinc-100 dark:border-zinc-800">
                    <div>
                        <h3 className="text-[15px] font-black text-zinc-900 dark:text-zinc-50">{title}</h3>
                        <p className="text-xs text-zinc-500 mt-0.5">
                            {data ? `${data.total.toLocaleString()} student${data.total === 1 ? "" : "s"}` : "Loading…"}
                            {data?.truncated && ` · showing the first ${data.items.length.toLocaleString()}`}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="flex-1 overflow-auto">
                    {error && <p className="p-5 text-sm text-rose-600">{error}</p>}
                    {!data && !error && (
                        <div className="p-10 flex justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                        </div>
                    )}
                    {data && (
                        <table className="w-full text-[12px]">
                            <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                <tr>
                                    <th className="text-left px-4 py-2">Student</th>
                                    <th className="text-left px-2 py-2">Class</th>
                                    <th className="text-left px-2 py-2">House</th>
                                    <th className="text-left px-2 py-2">Gender</th>
                                    <th className="text-left px-2 py-2">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.items.map((s) => (
                                    <tr key={s.cc} className="border-t border-zinc-100 dark:border-zinc-800">
                                        <td className="px-4 py-2">
                                            <Link href={`/identity/students?cc=${s.cc}`} className="font-bold text-zinc-800 dark:text-zinc-200 hover:text-primary">
                                                {s.full_name || `CC ${s.cc}`}
                                            </Link>
                                            <div className="text-[11px] text-zinc-400">
                                                CC {s.cc}
                                                {s.gr_number ? ` · GR ${s.gr_number}` : ""} · {s.age}
                                            </div>
                                        </td>
                                        <td className="px-2 py-2 text-zinc-600 dark:text-zinc-400">
                                            {[s.class_name, s.section].filter(Boolean).join(" ") || "—"}
                                            <div className="text-[11px] text-zinc-400">{s.campus}</div>
                                        </td>
                                        <td className="px-2 py-2 text-zinc-600 dark:text-zinc-400">{s.house || "—"}</td>
                                        <td className="px-2 py-2 text-zinc-600 dark:text-zinc-400">{s.gender}</td>
                                        <td className="px-2 py-2 text-zinc-600 dark:text-zinc-400">{s.status}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
