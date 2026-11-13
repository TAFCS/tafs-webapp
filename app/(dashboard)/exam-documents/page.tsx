"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, Loader2, Plus, RotateCcw, ScrollText, Search } from "lucide-react";
import toast from "react-hot-toast";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { toggleId } from "@/components/filters/filter-params";
import { campusesService, type Campus } from "@/lib/campuses.service";
import { examDocumentsService, type ExamScheduleSummary } from "@/lib/exam-documents.service";
import { useExamDocumentsAccess } from "@/hooks/use-exam-documents-access";
import { StatusBadge } from "./_components/StatusBadge";

const parseIds = (v: string | null) =>
    (v ?? "")
        .split(",")
        .map(Number)
        .filter((x) => Number.isInteger(x) && x > 0);

const fmtDate = (iso: string | null) =>
    iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function useDebounced<T>(value: T, ms = 300) {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return v;
}

/**
 * TAFSD-510: Student → Exam Documents. Each schedule is one assessment on one
 * campus; open it to see who is cleared and to issue admit cards (VI–X) and
 * statements of entry (every other class).
 */
export default function ExamDocumentsPage() {
    return (
        <Suspense fallback={<div className="flex justify-center py-24 text-zinc-400"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
            <ExamDocumentsList />
        </Suspense>
    );
}

function ExamDocumentsList() {
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();
    const access = useExamDocumentsAccess();

    const [campuses, setCampuses] = useState<Campus[]>([]);
    const [campusIds, setCampusIds] = useState<number[]>(() => parseIds(params.get("campus_ids")));
    const [search, setSearch] = useState(params.get("q") ?? "");
    const q = useDebounced(search);
    const [rows, setRows] = useState<ExamScheduleSummary[] | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        campusesService.list().then(setCampuses).catch(() => undefined);
    }, []);

    useEffect(() => {
        const sp = new URLSearchParams();
        if (campusIds.length) sp.set("campus_ids", campusIds.join(","));
        if (q.trim()) sp.set("q", q.trim());
        router.replace(`${pathname}${sp.toString() ? `?${sp}` : ""}`, { scroll: false });
    }, [campusIds, q, pathname, router]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setRows(await examDocumentsService.listSchedules({ campus_ids: campusIds, q }));
        } catch {
            toast.error("Could not load schedules");
        } finally {
            setLoading(false);
        }
    }, [campusIds, q]);

    useEffect(() => {
        void load();
    }, [load]);

    const campusOptions = useMemo(() => campuses.map((c) => ({ id: c.id, label: c.campus_name })), [campuses]);
    const filtersActive = campusIds.length > 0 || q.trim() !== "";
    const typing = search.trim() !== q.trim();

    return (
        <div className="space-y-6 pb-12">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <ScrollText className="h-6 w-6 text-blue-500" /> Exam Documents
                    </h1>
                    <p className="text-sm text-zinc-500 mt-1 max-w-2xl">
                        Each schedule is one assessment on one campus. Admit cards (VI–X) and statements of entry (every other class) are issued from
                        it, only to students whose dues are cleared through the schedule&apos;s fee date.
                    </p>
                </div>
                {access.can("manage_schedules") && (
                    <Link href="/exam-documents/new" className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold bg-primary text-white">
                        <Plus className="h-4 w-4" /> New schedule
                    </Link>
                )}
            </div>

            <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
                <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] ml-1">Search</label>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Assessment, line under the title, or reference #"
                            className="w-full h-11 pl-11 pr-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                </div>
                <div className="w-full lg:w-64">
                    <FilterDropdown
                        label="Campus"
                        icon={Building2}
                        value={campusIds}
                        options={campusOptions}
                        placeholder="All campuses"
                        onToggle={(id) => setCampusIds((prev) => toggleId(prev, id))}
                        onClear={() => setCampusIds([])}
                        onSetValue={setCampusIds}
                    />
                </div>
                {filtersActive && (
                    <button
                        type="button"
                        onClick={() => {
                            setCampusIds([]);
                            setSearch("");
                        }}
                        className="h-11 px-3 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-1"
                    >
                        <RotateCcw className="h-4 w-4" /> Clear filters
                    </button>
                )}
            </div>

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                                <th className="py-3 px-4 font-medium">Assessment</th>
                                <th className="py-3 px-4 font-medium">Campus</th>
                                <th className="py-3 px-4 font-medium">Classes</th>
                                <th className="py-3 px-4 font-medium">Fee date</th>
                                <th className="py-3 px-4 font-medium">Issue from</th>
                                <th className="py-3 px-4 font-medium text-right">Issued</th>
                                <th className="py-3 px-4 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && !rows ? (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center text-zinc-400">
                                        <Loader2 className="h-5 w-5 animate-spin inline" />
                                    </td>
                                </tr>
                            ) : !rows || rows.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center text-zinc-400 text-sm">
                                        {typing || loading ? "Searching…" : filtersActive ? "No schedule matches these filters." : "No exam schedules yet."}
                                    </td>
                                </tr>
                            ) : (
                                rows.map((r) => (
                                    <tr
                                        key={r.id}
                                        onClick={() => router.push(`/exam-documents/${r.id}`)}
                                        className={`border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/60 ${loading ? "opacity-60" : ""}`}
                                    >
                                        <td className="py-3 px-4">
                                            <div className="font-semibold text-zinc-900 dark:text-zinc-100">{r.title}</div>
                                            <div className="text-xs text-zinc-500">
                                                {[r.segment_line, r.academic_year].filter(Boolean).join(" · ")}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400 text-xs">{r.campus_name}</td>
                                        <td className="py-3 px-4 text-xs text-zinc-600 dark:text-zinc-400">{r.classes.map((c) => c.description).join(", ")}</td>
                                        <td className="py-3 px-4 text-xs whitespace-nowrap">{r.fee_date_label}</td>
                                        <td className="py-3 px-4 text-xs whitespace-nowrap">{fmtDate(r.issue_from)}</td>
                                        <td className="py-3 px-4 text-right tabular-nums font-semibold">{r.documents_issued}</td>
                                        <td className="py-3 px-4">
                                            <StatusBadge status={r.status} />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
