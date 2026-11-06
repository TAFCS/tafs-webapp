"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, X } from "lucide-react";
import {
    studentReportsService,
    type SiblingRef,
    type StrengthCellStudent,
    type StrengthFilters,
    type StudentReport,
} from "@/lib/student-reports.service";

const titleCase = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const shortDate = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** TAFSD-452/455: "Sehm-e-Sadaat · until 31 Mar 2027", or "ended" once the date has passed (it no longer counts). */
function Benefit({ label, until, reason }: { label: string; until: string | null; reason: string | null }) {
    const today = new Date().toISOString().slice(0, 10);
    const ended = until != null && until < today;
    return (
        <div title={reason ?? undefined} className={`text-[11px] font-bold ${ended ? "text-zinc-400" : "text-violet-700 dark:text-violet-400"}`}>
            {label}
            {until && <span className="font-normal"> · {ended ? "ended" : "until"} {shortDate(until)}</span>}
        </div>
    );
}

function SiblingLink({ m, note }: { m: SiblingRef; note?: string }) {
    return (
        <div>
            <Link href={`/identity/students?cc=${m.cc}`} className="hover:text-primary">
                {m.full_name || `CC ${m.cc}`}
            </Link>
            <span className="text-zinc-400"> · {note ?? ([m.class_name, m.section].filter(Boolean).join(" ") || "—")}</span>
        </div>
    );
}

/** TAFSD-451: the students behind one number of the grid. TAFSD-452 adds siblings and categories. */
export function CellStudentsPanel({
    filters,
    cell,
    title,
    report,
    onClose,
}: {
    filters: StrengthFilters;
    cell: { row?: string; column?: string };
    title: string;
    report: StudentReport;
    onClose: () => void;
}) {
    const categories = report === "categories";
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
                                    {categories ? (
                                        <>
                                            <th className="text-left px-2 py-2">Siblings</th>
                                            <th className="text-left px-2 py-2">Category</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="text-left px-2 py-2">House</th>
                                            <th className="text-left px-2 py-2">Gender</th>
                                            <th className="text-left px-2 py-2">Status</th>
                                        </>
                                    )}
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
                                        {categories ? (
                                            <>
                                                <td className="px-2 py-2 text-zinc-600 dark:text-zinc-400 text-[11px]">
                                                    {s.siblings.length === 0 && s.other_siblings.length === 0 && <span className="text-zinc-400">None</span>}
                                                    {s.siblings.map((m) => (
                                                        <SiblingLink key={m.cc} m={m} />
                                                    ))}
                                                    {s.other_siblings.map((m) => (
                                                        <SiblingLink key={m.cc} m={m} note={titleCase(m.status)} />
                                                    ))}
                                                </td>
                                                <td className="px-2 py-2">
                                                    {s.benefits.map((b) => (
                                                        <Benefit key={b.key} label={b.label} until={b.until} reason={b.reason} />
                                                    ))}
                                                    {s.benefits.length === 0 && <span className="text-[11px] text-zinc-400">—</span>}
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-2 py-2 text-zinc-600 dark:text-zinc-400">{s.house || "—"}</td>
                                                <td className="px-2 py-2 text-zinc-600 dark:text-zinc-400">{s.gender}</td>
                                                <td className="px-2 py-2 text-zinc-600 dark:text-zinc-400">{s.status}</td>
                                            </>
                                        )}
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
