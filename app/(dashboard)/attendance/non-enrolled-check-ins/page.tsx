"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Building2, Download, Layers, Loader2, RotateCcw, Search, UserX } from "lucide-react";
import toast from "react-hot-toast";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { toggleId } from "@/components/filters/filter-params";
import { campusesService, type Campus } from "@/lib/campuses.service";
import { hrService, type Segment } from "@/lib/hr.service";
import { segmentsForCampuses } from "@/lib/segments";
import {
    nonEnrolledCheckInsService,
    type NonEnrolledCheckInQuery,
    type NonEnrolledCheckInReport,
    type NonEnrolledStatus,
} from "@/lib/non-enrolled-check-ins.service";
import { getDeviceName } from "@/lib/zk-devices";
import { useTileAccess } from "@/hooks/use-tile-access";

const TILE = "attendance.non_enrolled_check_ins";

const STATUS_LABEL: Record<NonEnrolledStatus, string> = {
    LEFT: "Left",
    EXPELLED: "Expelled",
    GRADUATED: "Graduated",
    ENROLLED: "Enrolled",
    SOFT_ADMISSION: "Soft admission",
    QUICK_ADMISSION: "Quick admission",
};

const STATUS_STYLE: Partial<Record<NonEnrolledStatus, string>> = {
    LEFT: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    EXPELLED: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
    GRADUATED: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
};

/** Today in Pakistan, YYYY-MM-DD. */
const todayPkt = () => new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
const isDate = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const showDate = (ymd: string | null) =>
    ymd ? new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—";

const errMsg = (err: unknown, fallback: string) => {
    const m = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
    return Array.isArray(m) ? m.join(", ") : typeof m === "string" ? m : fallback;
};

const parseIds = (v: string | null) =>
    (v ?? "")
        .split(",")
        .map((x) => Number(x))
        .filter((x) => Number.isInteger(x) && x > 0);

function useDebounced<T>(value: T, ms = 300) {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return v;
}

/**
 * TAFSD-556: Attendance → Not Enrolled Check-ins. Students who had left, been
 * expelled or graduated but still scanned in on a biometric device. Their scan
 * is processed as normal (the day is marked, the parent is told); the backend
 * only flags it, and this lists the flags, one row per student per day.
 */
export default function NonEnrolledCheckInsPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center py-24 text-zinc-400">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </div>
            }
        >
            <NonEnrolledCheckInsInner />
        </Suspense>
    );
}

function NonEnrolledCheckInsInner() {
    const access = useTileAccess(TILE);
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();

    // Filters live in the URL, so an alert's link opens the right day.
    const initialFrom = isDate(params.get("from")) ? params.get("from")! : todayPkt();
    const [from, setFrom] = useState(initialFrom);
    const [to, setTo] = useState(isDate(params.get("to")) ? params.get("to")! : initialFrom);
    const [campusIds, setCampusIds] = useState<number[]>(parseIds(params.get("campus")));
    const [segmentIds, setSegmentIds] = useState<number[]>(parseIds(params.get("segment")));
    const [search, setSearch] = useState(params.get("q") ?? "");
    const q = useDebounced(search);

    const [campuses, setCampuses] = useState<Campus[]>([]);
    const [segments, setSegments] = useState<Segment[]>([]);
    const [report, setReport] = useState<NonEnrolledCheckInReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const reqId = useRef(0);

    useEffect(() => {
        campusesService.list().then(setCampuses).catch(() => setCampuses([]));
        // Already trimmed to the user's segment scope by the server.
        hrService.listSegments().then(setSegments).catch(() => setSegments([]));
    }, []);

    useEffect(() => {
        const next = new URLSearchParams();
        next.set("from", from);
        next.set("to", to);
        if (campusIds.length) next.set("campus", campusIds.join(","));
        if (segmentIds.length) next.set("segment", segmentIds.join(","));
        if (q.trim()) next.set("q", q.trim());
        router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }, [from, to, campusIds, segmentIds, q, pathname, router]);

    const query: NonEnrolledCheckInQuery = useMemo(
        () => ({ from, to, campus_ids: campusIds, segment_ids: segmentIds, q }),
        [from, to, campusIds, segmentIds, q],
    );
    const rangeOk = isDate(from) && isDate(to) && to >= from;

    const load = useCallback(async () => {
        if (!rangeOk) return;
        const id = ++reqId.current;
        setLoading(true);
        try {
            const data = await nonEnrolledCheckInsService.report(query);
            if (id === reqId.current) setReport(data);
        } catch (err) {
            if (id === reqId.current) toast.error(errMsg(err, "Couldn't load the report"));
        } finally {
            if (id === reqId.current) setLoading(false);
        }
    }, [query, rangeOk]);

    useEffect(() => {
        void load();
    }, [load]);

    const today = todayPkt();
    const filtersActive = from !== today || to !== today || campusIds.length > 0 || segmentIds.length > 0 || !!search.trim();
    const clearFilters = () => {
        setFrom(today);
        setTo(today);
        setCampusIds([]);
        setSegmentIds([]);
        setSearch("");
    };

    const doExport = async () => {
        setExporting(true);
        try {
            const blob = await nonEnrolledCheckInsService.exportExcel(query);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `not-enrolled-check-ins-${from}${to !== from ? `-to-${to}` : ""}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(errMsg(err, "Export failed"));
        } finally {
            setExporting(false);
        }
    };

    const rows = report?.rows ?? [];
    const students = new Set(rows.map((r) => r.student_cc)).size;
    const campusOptions = campuses.map((c) => ({ id: c.id, label: c.campus_name }));
    const segmentOptions = segmentsForCampuses(segments, campusIds)
        .slice()
        .sort((a, b) => a.display_order - b.display_order)
        .map((s) => ({ id: s.id, label: s.name }));
    const bySegment = report?.by_segment ?? [];
    const typing = search.trim() !== q.trim();
    const canExport = access.can("export") || (access.hasTile && !access.can("view"));

    return (
        <div className="space-y-6 pb-12">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <UserX className="h-6 w-6 text-rose-500" /> Not Enrolled Check-ins
                    </h1>
                    <p className="text-sm text-zinc-500 mt-1 max-w-2xl">
                        Students who had left, been expelled or graduated but still scanned in on a biometric device.
                        Their day is still marked and their parent is still told; this only shows who it was.
                    </p>
                </div>
                {canExport && (
                    <button
                        type="button"
                        onClick={doExport}
                        disabled={exporting || !rangeOk}
                        className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export
                    </button>
                )}
            </div>

            {report?.pending_migration && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    This report is not switched on yet: check-ins will start being recorded once the server update is applied.
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Stat label="Students" value={report ? students.toLocaleString() : "—"} />
                <Stat label="Check-in days" value={report ? rows.length.toLocaleString() : "—"} hint={filtersActive ? "with these filters" : "today"} />
            </div>

            {bySegment.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {bySegment.map((s) => {
                        const active = s.segment_id != null && segmentIds.includes(s.segment_id);
                        return (
                            <button
                                key={s.segment_id ?? "none"}
                                type="button"
                                disabled={s.segment_id == null}
                                onClick={() => s.segment_id != null && setSegmentIds((prev) => toggleId(prev, s.segment_id!))}
                                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors disabled:cursor-default ${
                                    active
                                        ? "border-primary bg-primary/10 text-primary"
                                        : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300"
                                }`}
                                title={s.segment_id == null ? "Class has no segment set" : "Filter to this segment"}
                            >
                                <Layers className="h-4 w-4 text-zinc-400" />
                                <span className="font-semibold">{s.segment_name ?? "No segment"}</span>
                                <span className="text-zinc-500 tabular-nums">
                                    {s.students} student{s.students === 1 ? "" : "s"} · {s.days} day{s.days === 1 ? "" : "s"}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
                <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] ml-1">Search</label>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Student name, C.C. or G.R."
                            className="w-full h-11 pl-11 pr-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                </div>
                <DateField label="From" value={from} onChange={(v) => { setFrom(v); if (v > to) setTo(v); }} />
                <DateField label="To" value={to} min={from} onChange={setTo} />
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
                <div className="w-full lg:w-56">
                    <FilterDropdown
                        label="Segment"
                        icon={Layers}
                        value={segmentIds}
                        options={segmentOptions}
                        placeholder="All segments"
                        onToggle={(id) => setSegmentIds((prev) => toggleId(prev, id))}
                        onClear={() => setSegmentIds([])}
                        onSetValue={setSegmentIds}
                    />
                </div>
                {filtersActive && (
                    <button type="button" onClick={clearFilters} className="h-11 px-3 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-1">
                        <RotateCcw className="h-4 w-4" /> Clear filters
                    </button>
                )}
            </div>

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                                <th className="py-3 px-4 font-medium">Date</th>
                                <th className="py-3 px-4 font-medium">Student</th>
                                <th className="py-3 px-4 font-medium">Status</th>
                                <th className="py-3 px-4 font-medium">Left on</th>
                                <th className="py-3 px-4 font-medium">Campus</th>
                                <th className="py-3 px-4 font-medium">Segment</th>
                                <th className="py-3 px-4 font-medium">Device</th>
                                <th className="py-3 px-4 font-medium">First scan</th>
                                <th className="py-3 px-4 font-medium">Last scan</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && !report ? (
                                <tr>
                                    <td colSpan={9} className="py-16 text-center text-zinc-400">
                                        <Loader2 className="h-5 w-5 animate-spin inline" />
                                    </td>
                                </tr>
                            ) : !rangeOk ? (
                                <tr>
                                    <td colSpan={9} className="py-16 text-center text-zinc-400 text-sm">Pick a From date on or before the To date.</td>
                                </tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="py-16 text-center text-zinc-400 text-sm">
                                        {typing || loading
                                            ? "Searching…"
                                            : search.trim()
                                              ? "No student matches this search in these dates."
                                              : "No student who isn't enrolled checked in on these dates."}
                                    </td>
                                </tr>
                            ) : (
                                rows.map((r) => (
                                    <tr
                                        key={`${r.date}-${r.student_cc}`}
                                        className={`border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 align-top ${loading ? "opacity-60" : ""}`}
                                    >
                                        <td className="py-3 px-4 whitespace-nowrap text-zinc-700 dark:text-zinc-300">{showDate(r.date)}</td>
                                        <td className="py-3 px-4">
                                            <div className="font-semibold text-zinc-900 dark:text-zinc-100">{r.full_name ?? "—"}</div>
                                            <div className="text-xs text-zinc-500">
                                                C.C. {r.student_cc}
                                                {r.gr_number ? ` · G.R. ${r.gr_number}` : ""}
                                                {r.class_name ? ` · ${r.class_name}` : ""}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`text-xs font-semibold rounded-md px-1.5 py-0.5 ${STATUS_STYLE[r.status] ?? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"}`}>
                                                {STATUS_LABEL[r.status] ?? r.status}
                                            </span>
                                            {r.current_status && r.current_status !== r.status && (
                                                <div className="text-xs text-zinc-500 mt-1">Now {STATUS_LABEL[r.current_status]?.toLowerCase() ?? r.current_status}</div>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 whitespace-nowrap text-zinc-600 dark:text-zinc-400">{showDate(r.left_on)}</td>
                                        <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">{r.campus_name ?? "—"}</td>
                                        <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">{r.segment_name ?? "—"}</td>
                                        <td className="py-3 px-4 text-xs text-zinc-600 dark:text-zinc-400">
                                            {r.devices.map((d) => (
                                                <div key={`${d.sn}-${d.pin}`}>
                                                    {getDeviceName(d.sn)} <span className="text-zinc-400">· PIN {d.pin}</span>
                                                </div>
                                            ))}
                                        </td>
                                        <td className="py-3 px-4 tabular-nums">{r.first_scan}</td>
                                        <td className="py-3 px-4 tabular-nums">
                                            {r.last_scan}
                                            {r.scans > 1 && <div className="text-xs text-zinc-400">{r.scans} scans</div>}
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

function DateField({ label, value, min, onChange }: { label: string; value: string; min?: string; onChange: (v: string) => void }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] ml-1">{label}</label>
            <input
                type="date"
                value={value}
                min={min}
                onChange={(e) => e.target.value && onChange(e.target.value)}
                className="h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
        </div>
    );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
            <p className="text-xs font-medium text-zinc-500">{label}</p>
            <p className="text-2xl font-black mt-1 tabular-nums text-zinc-900 dark:text-zinc-100">{value}</p>
            {hint && <p className="text-xs text-zinc-400 mt-0.5">{hint}</p>}
        </div>
    );
}
