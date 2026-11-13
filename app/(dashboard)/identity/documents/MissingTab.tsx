"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { Building2, CheckCircle2, ChevronLeft, ChevronRight, Download, FileText, Layers, Loader2, Search, User, UserCheck, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { toggleId } from "@/components/filters/filter-params";
import { campusesService, type Campus } from "@/lib/campuses.service";
import { directCdnUrl } from "@/lib/media-url";
import { errMsg, studentDocumentsService, type MissingReport, type MissingRow } from "@/lib/student-documents.service";
import { useDebounce } from "@/hooks/use-debounce";
import { useScopedCampusPicker } from "@/hooks/use-scoped-campus-picker";

const PAGE_SIZE = 50;
const DEFAULT_STATUSES = ["ENROLLED", "SOFT_ADMISSION", "QUICK_ADMISSION"];
const STATUS_OPTIONS = [
    { id: "ENROLLED", label: "Enrolled" },
    { id: "SOFT_ADMISSION", label: "Soft admission" },
    { id: "QUICK_ADMISSION", label: "Quick admission" },
    { id: "LEFT", label: "Left" },
    { id: "GRADUATED", label: "Graduated" },
    { id: "EXPELLED", label: "Expelled" },
];

const ids = (v: string | null) => (v ? v.split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0) : []);
const strs = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);
const join = (a: Array<string | number>) => (a.length ? a.join(",") : null);

export function MissingTab({
    params,
    setParams,
    onOpenStudent,
    canExport,
}: {
    params: ReadonlyURLSearchParams;
    setParams: (next: Record<string, string | null>) => void;
    onOpenStudent: (cc: number) => void;
    canExport: boolean;
}) {
    // Filters live in the URL. A missing `status` means "current students";
    // an empty one (cleared) means every status.
    const campusIds = ids(params.get("campus"));
    const classIds = ids(params.get("class"));
    const sectionIds = ids(params.get("section"));
    const typeIds = ids(params.get("type"));
    const statuses = params.has("status") ? strs(params.get("status")) : DEFAULT_STATUSES;
    const page = Math.max(1, Number(params.get("page")) || 1);
    const [q, setQ] = useState(params.get("mq") ?? "");
    const debouncedQ = useDebounce(q.trim(), 300);

    const [campuses, setCampuses] = useState<Campus[]>([]);
    const [report, setReport] = useState<MissingReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const { options: scopedCampuses } = useScopedCampusPicker(campuses);

    useEffect(() => {
        campusesService.list().then(setCampuses).catch(() => setCampuses([]));
    }, []);

    // Keep the search box in the URL too.
    useEffect(() => {
        if ((params.get("mq") ?? "") !== debouncedQ) setParams({ mq: debouncedQ || null, page: null });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedQ]);

    const key = [params.get("campus"), params.get("class"), params.get("section"), params.get("type"), params.has("status") ? params.get("status") : "default", page, params.get("mq")].join("|");
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        studentDocumentsService
            .missing({ q: params.get("mq") ?? undefined, campus_ids: campusIds, class_ids: classIds, section_ids: sectionIds, type_ids: typeIds, statuses, page, limit: PAGE_SIZE })
            .then((r) => !cancelled && setReport(r))
            .catch((err) => !cancelled && toast.error(errMsg(err, "Couldn't load the report")))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    // Classes offered at the chosen campuses (all campuses when none chosen), then their sections.
    const pool = campusIds.length ? scopedCampuses.filter((c) => campusIds.includes(c.id)) : scopedCampuses;
    const classOptions = useMemo(() => {
        const m = new Map<number, string>();
        pool.forEach((c) => c.offered_classes?.forEach((oc) => oc.is_active && m.set(oc.id, oc.description)));
        return [...m].map(([id, label]) => ({ id, label }));
    }, [pool]);
    const sectionOptions = useMemo(() => {
        const m = new Map<number, string>();
        pool.forEach((c) =>
            c.offered_classes?.forEach((oc) => {
                if (classIds.length && !classIds.includes(oc.id)) return;
                oc.sections?.forEach((s) => s.is_active && m.set(s.id, s.description));
            }),
        );
        return [...m].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
    }, [pool, classIds]);
    const typeOptions = (report?.by_type ?? []).map((t) => ({ id: t.type_id, label: t.owner === "GUARDIAN" ? `Parent's ${t.name}` : t.name }));

    const set = (k: string, v: string | null) => setParams({ [k]: v, page: null });
    const statusIsDefault = !params.has("status");
    const anyFilter = campusIds.length || classIds.length || sectionIds.length || typeIds.length || !statusIsDefault || params.get("mq");

    const exportCsv = async () => {
        setExporting(true);
        try {
            const all = await studentDocumentsService.missing({ q: params.get("mq") ?? undefined, campus_ids: campusIds, class_ids: classIds, section_ids: sectionIds, type_ids: typeIds, statuses, all: true });
            const head = ["CC", "GR", "Name", "Campus", "Class", "Section", "Status", "On file", "Required", "Missing"];
            const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
            const lines = [head.map(cell).join(",")].concat(
                all.items.map((r) => [r.cc, r.gr_number, r.full_name, r.campus_name, r.class_name, r.section_name, r.status, r.on_file, r.required, r.missing.map((m) => m.label).join("; ")].map(cell).join(",")),
            );
            const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `missing-documents-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
            toast.error(errMsg(err, "Couldn't export"));
        } finally {
            setExporting(false);
        }
    };

    const meta = report?.meta;
    const checked = meta?.students_checked ?? 0;
    const complete = meta?.students_complete ?? 0;
    const pct = checked ? Math.round((complete / checked) * 100) : 0;
    const pages = meta ? Math.max(1, Math.ceil(meta.total / PAGE_SIZE)) : 1;

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="grid items-end gap-2 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(5,1fr)]">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Name, GR or CC"
                            className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                            aria-label="Search the report"
                        />
                    </div>
                    <FilterDropdown label="Campus" icon={Building2} placeholder="All campuses" value={campusIds} options={scopedCampuses.map((c) => ({ id: c.id, label: c.campus_name }))}
                        onToggle={(id) => setParams({ campus: join(toggleId(campusIds, id)), class: null, section: null, page: null })}
                        onClear={() => setParams({ campus: null, class: null, section: null, page: null })} />
                    <FilterDropdown label="Class" icon={Layers} placeholder="All classes" value={classIds} options={classOptions}
                        onToggle={(id) => setParams({ class: join(toggleId(classIds, id)), section: null, page: null })}
                        onClear={() => setParams({ class: null, section: null, page: null })} onSetValue={(v) => set("class", join(v))} />
                    <FilterDropdown label="Section" icon={Users} placeholder="All sections" value={sectionIds} options={sectionOptions}
                        onToggle={(id) => set("section", join(toggleId(sectionIds, id)))} onClear={() => set("section", null)} onSetValue={(v) => set("section", join(v))} />
                    <FilterDropdown label="Document" icon={FileText} placeholder="Any required document" value={typeIds} options={typeOptions}
                        onToggle={(id) => set("type", join(toggleId(typeIds, id)))} onClear={() => set("type", null)} />
                    <FilterDropdown<string> label="Status" icon={UserCheck} placeholder="Every status" value={statuses} options={STATUS_OPTIONS}
                        onToggle={(id) => set("status", toggleId(statuses, id).join(","))} onClear={() => set("status", "")} onSetValue={(v) => set("status", v.join(","))} />
                </div>
                {anyFilter ? (
                    <button
                        onClick={() => {
                            setQ("");
                            setParams({ campus: null, class: null, section: null, type: null, status: null, mq: null, page: null });
                        }}
                        className="mt-2 flex items-center gap-1 px-1 text-[11px] font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    >
                        <X className="h-3 w-3" /> Clear filters{statusIsDefault ? "" : " (back to current students)"}
                    </button>
                ) : null}
            </div>

            {/* Summary */}
            <div className="grid gap-3 lg:grid-cols-[18rem_1fr]">
                <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Complete files</p>
                    <p className="mt-2 text-3xl font-black tabular-nums text-zinc-900 dark:text-zinc-100">
                        {loading && !report ? "—" : `${pct}%`}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                        {complete.toLocaleString()} of {checked.toLocaleString()} students have every required document
                    </p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {(report?.by_type ?? []).map((t) => {
                        const on = typeIds.includes(t.type_id);
                        return (
                            <button
                                key={t.type_id}
                                onClick={() => set("type", join(toggleId(typeIds, t.type_id)))}
                                className={`rounded-3xl border p-4 text-left transition-colors ${
                                    on
                                        ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-100 dark:bg-indigo-950/30 dark:ring-indigo-950"
                                        : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900"
                                }`}
                                title={on ? "Click to stop filtering by this document" : "Click to show only students missing this"}
                            >
                                <p className="truncate text-xs font-bold text-zinc-600 dark:text-zinc-300">{t.owner === "GUARDIAN" ? `Parent's ${t.name}` : t.name}</p>
                                <p className={`mt-1 text-2xl font-black tabular-nums ${t.students_missing ? "text-amber-600" : "text-emerald-600"}`}>{t.students_missing.toLocaleString()}</p>
                                <p className="text-[11px] text-zinc-400">{t.students_missing === 1 ? "student missing it" : "students missing it"}</p>
                            </button>
                        );
                    })}
                    {report && report.by_type.length === 0 && (
                        <div className="rounded-3xl border border-dashed border-zinc-300 p-4 text-xs text-zinc-500 dark:border-zinc-700 sm:col-span-2 xl:col-span-4">
                            No document type is marked as required at admission yet, so nothing can be missing. Mark the ones the school needs in Document types.
                        </div>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                    <p className="text-sm font-black text-zinc-800 dark:text-zinc-100">
                        {meta ? `${meta.total.toLocaleString()} student${meta.total === 1 ? "" : "s"} missing something` : "Loading…"}
                        {loading && report && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin text-zinc-400" />}
                    </p>
                    {canExport && (
                        <button onClick={exportCsv} disabled={exporting || !meta?.total} className="flex h-9 items-center gap-1.5 rounded-xl border border-zinc-200 px-3 text-xs font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
                            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Export CSV
                        </button>
                    )}
                </div>

                {loading && !report ? (
                    <div className="space-y-2 p-4">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800/60" />)}</div>
                ) : report && report.items.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 p-12 text-center">
                        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                        <p className="text-sm font-black text-zinc-800 dark:text-zinc-100">Nothing missing here</p>
                        <p className="text-xs text-zinc-500">{anyFilter ? "Every student matching these filters has their required documents." : "Every student has their required documents."}</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {report?.items.map((r) => <Row key={r.cc} row={r} onOpen={() => onOpenStudent(r.cc)} />)}
                    </ul>
                )}

                {meta && meta.total > PAGE_SIZE && (
                    <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-xs dark:border-zinc-800">
                        <span className="text-zinc-500">
                            {((page - 1) * PAGE_SIZE + 1).toLocaleString()}–{Math.min(page * PAGE_SIZE, meta.total).toLocaleString()} of {meta.total.toLocaleString()}
                        </span>
                        <div className="flex gap-1">
                            <button disabled={page <= 1} onClick={() => setParams({ page: page - 1 > 1 ? String(page - 1) : null })} className="flex h-8 items-center gap-1 rounded-lg border border-zinc-200 px-2.5 font-bold disabled:opacity-40 dark:border-zinc-700"><ChevronLeft className="h-3.5 w-3.5" /> Previous</button>
                            <button disabled={page >= pages} onClick={() => setParams({ page: String(page + 1) })} className="flex h-8 items-center gap-1 rounded-lg border border-zinc-200 px-2.5 font-bold disabled:opacity-40 dark:border-zinc-700">Next <ChevronRight className="h-3.5 w-3.5" /></button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function Row({ row, onOpen }: { row: MissingRow; onOpen: () => void }) {
    const pct = row.required ? Math.round((row.on_file / row.required) * 100) : 0;
    return (
        <li>
            <button onClick={onOpen} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 md:grid-cols-[auto_minmax(12rem,1.2fr)_8rem_2fr_7rem]">
                {directCdnUrl(row.photograph_url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={directCdnUrl(row.photograph_url)!} alt="" className="h-9 w-9 rounded-xl object-cover" />
                ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800"><User className="h-4 w-4" /></span>
                )}
                <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">{row.full_name}</span>
                    <span className="block truncate text-[11px] text-zinc-500">
                        {row.gr_number ? `GR ${row.gr_number}` : `CC ${row.cc}`}
                        <span className="md:hidden">{row.class_name ? ` · ${row.class_name} ${row.section_name ?? ""}` : ""}</span>
                    </span>
                </span>
                <span className="hidden text-xs font-semibold text-zinc-600 dark:text-zinc-300 md:block">
                    {row.class_name ?? "—"}{row.section_name ? ` ${row.section_name}` : ""}
                    {row.campus_name && <span className="block truncate text-[10px] font-normal text-zinc-400">{row.campus_name}</span>}
                </span>
                <span className="col-span-3 col-start-2 flex flex-wrap gap-1 md:col-span-1 md:col-start-auto">
                    {row.missing.map((m) => (
                        <span key={`${m.type_id}-${m.guardian_id}`} className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                            {m.label}
                        </span>
                    ))}
                </span>
                <span className="row-start-1 col-start-3 flex flex-col items-end gap-1 md:row-start-auto md:col-start-auto">
                    <span className="text-[11px] font-black tabular-nums text-zinc-600 dark:text-zinc-300">{row.on_file}/{row.required}</span>
                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <span className="block h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
                    </span>
                </span>
            </button>
        </li>
    );
}
