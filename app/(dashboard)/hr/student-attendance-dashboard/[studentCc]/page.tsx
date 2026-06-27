"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    AlertCircle, AlertTriangle, ArrowLeft, CalendarCheck,
    CheckCircle2, Clock, Loader2, X,
} from "lucide-react";
import { attendanceService, StudentTimeline, StudentTimelineSegmentType } from "@/lib/attendance.service";

// ── Segment styles ────────────────────────────────────────────────────────────

const SEG: Record<StudentTimelineSegmentType, { bg: string; label: string }> = {
    WORK:  { bg: "bg-emerald-500", label: "Clocked in" },
    BREAK: { bg: "bg-blue-400",    label: "Break" },
};

const STATUS_PILL: Record<string, string> = {
    PRESENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    ABSENT:  "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    EXCUSED: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
    LATE:    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoDaysAgo(n: number) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
}

function todayIso() { return new Date().toISOString().slice(0, 10); }

function pct(value: string): number {
    if (value === "00:00") return 0;
    if (value === "24:00") return 100;
    const d = new Date(value);
    return ((d.getUTCHours() * 60 + d.getUTCMinutes()) / 1440) * 100;
}

function fmtT(value: string): string {
    if (value === "00:00" || value === "24:00") return value;
    return new Date(value).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

function fmtDate(s: string): string {
    return new Date(`${s}T00:00:00Z`).toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
    });
}

function dur(start: string, end: string): string {
    const m = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
    if (m <= 0) return "";
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60), rm = m % 60;
    return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Tooltip { lines: string[]; x: number; y: number }

// ── Component ─────────────────────────────────────────────────────────────────

export default function StudentAttendanceTimelinePage() {
    const params = useParams<{ studentCc: string }>();
    const router = useRouter();
    const studentCc = Number(params.studentCc);
    const today = todayIso();

    const [dateFrom, setDateFrom] = useState(isoDaysAgo(6));
    const [dateTo, setDateTo]     = useState(today);
    const [timeline, setTimeline] = useState<StudentTimeline | null>(null);
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState<string | null>(null);
    const [tooltip, setTooltip]   = useState<Tooltip | null>(null);

    // Resolve state
    const [resolvingDate, setResolvingDate] = useState<string | null>(null);
    const [resolveForm, setResolveForm]     = useState({ checkIn: "", checkOut: "" });
    const [saving, setSaving]               = useState<string | null>(null);
    const [resolveError, setResolveError]   = useState<string | null>(null);
    const [resolved, setResolved]           = useState<Set<string>>(new Set());

    // We need campus_id for the resolve call — pull it from timeline once loaded
    const [campusId, setCampusId] = useState<number | null>(null);

    const load = useCallback(async () => {
        if (!studentCc || !dateFrom || !dateTo) return;
        setLoading(true);
        setError(null);
        try {
            const data = await attendanceService.getStudentTimeline(studentCc, { date_from: dateFrom, date_to: dateTo });
            setTimeline(data);
        } catch {
            setError("Failed to load attendance timeline.");
        } finally {
            setLoading(false);
        }
    }, [studentCc, dateFrom, dateTo]);

    useEffect(() => { load(); }, [load]);

    // Fetch campus_id from student profile when timeline loads
    useEffect(() => {
        if (!campusId && studentCc) {
            fetch(`/api/students/${studentCc}`)
                .then(r => r.json())
                .then(d => { if (d?.data?.campus_id) setCampusId(d.data.campus_id); })
                .catch(() => {});
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [studentCc]);

    const showTip = useCallback((e: React.MouseEvent<HTMLDivElement>, lines: string[]) => {
        const r = e.currentTarget.getBoundingClientRect();
        setTooltip({ lines, x: r.left + r.width / 2, y: r.top });
    }, []);

    const hideTip = useCallback(() => setTooltip(null), []);

    const openResolve = (date: string, checkInISO: string | null) => {
        setResolveForm({
            checkIn:  checkInISO ? new Date(checkInISO).toISOString().slice(11, 16) : "",
            checkOut: "",
        });
        setResolvingDate(date);
        setResolveError(null);
    };

    const doResolve = async (date: string) => {
        if (!resolveForm.checkOut) { setResolveError("Clock-out time is required."); return; }
        if (!campusId) { setResolveError("Campus information not loaded. Please refresh."); return; }
        setSaving(date);
        setResolveError(null);
        try {
            await attendanceService.resolveStudentAttendance(studentCc, {
                date,
                campus_id: campusId,
                check_in_time:  resolveForm.checkIn  || undefined,
                check_out_time: resolveForm.checkOut,
            });
            setResolved(prev => new Set([...prev, date]));
            setResolvingDate(null);
            await load();
        } catch (err: any) {
            setResolveError(err.response?.data?.message ?? "Failed to save.");
        } finally {
            setSaving(null);
        }
    };

    const sel = "h-10 px-3 border rounded-xl text-sm bg-white dark:bg-zinc-950 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary/30";

    return (
        <div className="space-y-6 pb-10">
            {/* Tooltip */}
            {tooltip && (
                <div
                    className="fixed z-[200] pointer-events-none"
                    style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, calc(-100% - 10px))" }}
                >
                    <div className="bg-zinc-950 text-white text-[11px] px-3 py-2 rounded-xl shadow-2xl border border-zinc-800 max-w-[220px]">
                        {tooltip.lines.map((l, i) => (
                            <div key={i} className={i === 0 ? "font-semibold" : "text-zinc-400 mt-0.5"}>{l}</div>
                        ))}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-zinc-950" />
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <button
                        onClick={() => router.push("/hr/student-attendance-dashboard")}
                        className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mb-2"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                    </button>
                    <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <CalendarCheck className="h-6 w-6 text-primary" />
                        {timeline?.student.full_name ?? "Attendance Timeline"}
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={sel} />
                    <span className="text-zinc-400 text-sm">to</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={sel} />
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-3 shadow-sm">
                {(Object.entries(SEG) as [StudentTimelineSegmentType, typeof SEG[StudentTimelineSegmentType]][]).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-1.5">
                        <span className={`w-3 h-3 rounded-sm ${v.bg}`} />
                        <span className="text-[11px] text-zinc-500">{v.label}</span>
                    </div>
                ))}
                <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-zinc-200 dark:bg-zinc-800" />
                    <span className="text-[11px] text-zinc-500">Unaccounted</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-amber-400 animate-pulse" />
                    <span className="text-[11px] text-zinc-500">Missing clock-out</span>
                </div>
            </div>

            {loading && !timeline ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
                </div>
            ) : !timeline || timeline.days.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-14">No attendance data for this range.</p>
            ) : (
                <div className="space-y-3">
                    {timeline.days.map(day => {
                        const segs = day.segments as Array<{ type: string; start: string; end: string; isMissingOut?: boolean }>;
                        const hasMissingOut = segs.some(s => s.isMissingOut);
                        const isPast = day.date < today;
                        const wasResolved = resolved.has(day.date);
                        const isResolving = resolvingDate === day.date;
                        const showResolve = hasMissingOut && isPast && !wasResolved && day.is_working_day !== false;

                        // Find the last scanned-in time for the banner
                        const lastIn = segs.find(s => s.isMissingOut)?.start ?? null;

                        return (
                            <div
                                key={day.date}
                                className={`border rounded-2xl p-5 shadow-sm transition-colors ${
                                    showResolve && !isResolving
                                        ? "border-amber-300 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10"
                                        : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
                                }`}
                            >
                                {/* Row header */}
                                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{fmtDate(day.date)}</span>
                                        {day.status && (
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_PILL[day.status] ?? "bg-zinc-100 text-zinc-500"}`}>
                                                {wasResolved && <CheckCircle2 className="h-2.5 w-2.5" />}
                                                {day.status}
                                            </span>
                                        )}
                                        {day.day_description && (
                                            <span className="text-[11px] text-zinc-400 italic">{day.day_description}</span>
                                        )}
                                    </div>
                                    {showResolve && !isResolving && (
                                        <button
                                            onClick={() => openResolve(day.date, lastIn)}
                                            className="h-7 px-3 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-1 transition-colors"
                                        >
                                            <Clock className="h-3 w-3" /> Resolve
                                        </button>
                                    )}
                                    {isResolving && (
                                        <button
                                            onClick={() => setResolvingDate(null)}
                                            className="text-xs text-zinc-400 hover:text-zinc-600"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </div>

                                {/* Timeline bar */}
                                <div className="relative h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                                    {segs.length === 0 ? (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-[11px] text-zinc-400">
                                                {day.is_working_day === false ? "Non-working day" : "No scans"}
                                            </span>
                                        </div>
                                    ) : (
                                        segs.map((seg, idx) => {
                                            const left = pct(seg.start);
                                            const w = Math.max(pct(seg.end) - left, seg.isMissingOut ? 1.5 : 0.5);
                                            const style = SEG[seg.type as StudentTimelineSegmentType] ?? { bg: "bg-zinc-400", label: seg.type };
                                            const d = dur(seg.start, seg.end);
                                            const tipLines = seg.isMissingOut
                                                ? [`Clocked in at ${fmtT(seg.start)}`, "No clock-out — resolve below"]
                                                : [
                                                    `${style.label}: ${fmtT(seg.start)} – ${fmtT(seg.end)}`,
                                                    ...(d ? [`Duration: ${d}`] : []),
                                                  ];

                                            return (
                                                <div
                                                    key={idx}
                                                    className={`absolute top-0 bottom-0 cursor-default ${
                                                        seg.isMissingOut
                                                            ? "bg-amber-400 dark:bg-amber-500 animate-pulse rounded-r-sm"
                                                            : `${style.bg} rounded-sm`
                                                    }`}
                                                    style={{ left: `${left}%`, width: `${w}%` }}
                                                    onMouseEnter={e => showTip(e, tipLines)}
                                                    onMouseLeave={hideTip}
                                                />
                                            );
                                        })
                                    )}
                                </div>
                                <div className="flex justify-between mt-1.5 text-[10px] text-zinc-400 select-none">
                                    <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
                                </div>

                                {/* Missing clock-out resolve banner */}
                                {showResolve && (
                                    <div className={`mt-3 rounded-xl border p-3 ${
                                        isResolving
                                            ? "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                                            : "border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20"
                                    }`}>
                                        {isResolving ? (
                                            <div className="space-y-3">
                                                <p className="text-xs font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5">
                                                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                                                    Enter the correct punch times
                                                </p>
                                                {resolveError && (
                                                    <div className="flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400">
                                                        <X className="h-3 w-3 shrink-0" /> {resolveError}
                                                    </div>
                                                )}
                                                <div className="flex flex-wrap items-end gap-3">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wide mb-1">Clock In</label>
                                                        <input
                                                            type="time"
                                                            value={resolveForm.checkIn}
                                                            onChange={e => setResolveForm(f => ({ ...f, checkIn: e.target.value }))}
                                                            className="h-8 px-2 w-[6.5rem] border rounded-lg text-xs bg-white dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wide mb-1">
                                                            Clock Out <span className="text-rose-500 ml-0.5">*</span>
                                                        </label>
                                                        <input
                                                            type="time"
                                                            required
                                                            value={resolveForm.checkOut}
                                                            onChange={e => setResolveForm(f => ({ ...f, checkOut: e.target.value }))}
                                                            className="h-8 px-2 w-[6.5rem] border rounded-lg text-xs bg-white dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => doResolve(day.date)}
                                                            disabled={saving === day.date || !resolveForm.checkOut}
                                                            className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                                                        >
                                                            {saving === day.date
                                                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                                                : <CheckCircle2 className="h-3 w-3" />}
                                                            Save & Resolve
                                                        </button>
                                                        <button
                                                            onClick={() => setResolvingDate(null)}
                                                            className="h-8 px-2.5 text-xs text-zinc-400 hover:text-zinc-600"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                                                        Clocked in at {lastIn ? fmtT(lastIn) : "—"} — no clock-out recorded
                                                    </p>
                                                    <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                                                        Past day — enter the actual clock-out time to resolve
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
