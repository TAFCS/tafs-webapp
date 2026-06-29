"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    AlertCircle, ArrowLeft, CalendarCheck, CheckCircle2,
    Clock, Loader2, TrendingUp, UserX,
} from "lucide-react";
import { attendanceService, StaffAttendanceStatus, StaffTimeline, TimelineSegmentType } from "@/lib/attendance.service";
import { hrService, EmployeeProfile } from "@/lib/hr.service";

function isoDaysAgo(days: number) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
}

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

const SEGMENT_STYLES: Record<TimelineSegmentType, { bg: string; label: string }> = {
    WORK:     { bg: "bg-emerald-500",               label: "Working" },
    BREAK:    { bg: "bg-blue-400",                  label: "Break" },
    OVERTIME: { bg: "bg-amber-500",                 label: "Overtime" },
    DAY_OFF:  { bg: "bg-zinc-300 dark:bg-zinc-700", label: "Day Off" },
};

const STATUS_LABEL: Record<StaffAttendanceStatus, string> = {
    PRESENT:      "Present",
    LATE:         "Late",
    ABSENT:       "Absent",
    HALF_DAY:     "Half Day",
    EXCUSED:      "Excused",
    SICK_LEAVE:   "Sick Leave",
    CASUAL_LEAVE: "Casual Leave",
    ANNUAL_LEAVE: "Annual Leave",
    UNPAID_LEAVE: "Unpaid Leave",
};

const STATUS_PILL: Record<StaffAttendanceStatus, string> = {
    PRESENT:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    LATE:     "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    ABSENT:   "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    HALF_DAY: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    EXCUSED:      "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
    SICK_LEAVE:   "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    CASUAL_LEAVE: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
    ANNUAL_LEAVE: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    UNPAID_LEAVE: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

function timeToPercent(value: string): number {
    if (value === "00:00") return 0;
    if (value === "24:00") return 100;
    const d = new Date(value);
    return ((d.getUTCHours() * 60 + d.getUTCMinutes()) / 1440) * 100;
}

function fmtSeg(value: string): string {
    if (value === "00:00" || value === "24:00") return value;
    return new Date(value).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

function fmtDateLabel(dateStr: string): string {
    return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
    });
}

// ── Stats helpers ─────────────────────────────────────────────────────────────

function computeStats(days: StaffTimeline["days"]) {
    const working = days.filter((d) => d.is_working_day);
    const present = working.filter((d) => d.status === "PRESENT" || d.status === "LATE");
    const absent  = working.filter((d) => d.status === "ABSENT");
    const late    = working.filter((d) => d.status === "LATE");

    // avg check-in from first WORK segment start
    const checkIns = days
        .flatMap((d) => d.segments)
        .filter((s) => s.type === "WORK")
        .map((s) => {
            const d = new Date(s.start);
            return d.getUTCHours() * 60 + d.getUTCMinutes();
        });
    const avgCheckInMin = checkIns.length > 0 ? Math.round(checkIns.reduce((a, b) => a + b, 0) / checkIns.length) : null;
    const avgCheckIn = avgCheckInMin != null
        ? `${String(Math.floor(avgCheckInMin / 60)).padStart(2, "0")}:${String(avgCheckInMin % 60).padStart(2, "0")}`
        : null;

    // total break minutes from BREAK segments
    const totalBreak = days.flatMap((d) => d.segments).filter((s) => s.type === "BREAK").reduce((sum, s) => {
        const ms = new Date(s.end).getTime() - new Date(s.start).getTime();
        return sum + Math.round(ms / 60000);
    }, 0);

    return {
        workingDays: working.length,
        presentDays: present.length,
        absentDays: absent.length,
        lateDays: late.length,
        presentRate: working.length > 0 ? Math.round((present.length / working.length) * 100) : 0,
        avgCheckIn,
        totalBreakMin: totalBreak,
    };
}

function fmtBreak(min: number) {
    if (min <= 0) return "0m";
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function computeLateMinutes(day: { status: StaffAttendanceStatus | null; segments: { type: string; start: string }[] }, reportingTime: string | null, graceMinutes: number | null): number {
    if (day.status !== "LATE" || !reportingTime) return 0;
    const workSeg = day.segments.find((s) => s.type === "WORK");
    if (!workSeg) return 0;
    const rep = new Date(reportingTime);
    const repMins = rep.getUTCHours() * 60 + rep.getUTCMinutes();
    const checkIn = new Date(workSeg.start);
    const checkInMins = checkIn.getUTCHours() * 60 + checkIn.getUTCMinutes();
    const rawLate = checkInMins - repMins;
    const relaxation = graceMinutes ?? 0;
    return rawLate > relaxation ? rawLate : 0;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StaffAttendanceTimelinePage() {
    const params = useParams<{ employeeId: string }>();
    const router = useRouter();
    const employeeId = Number(params.employeeId);

    const [dateFrom, setDateFrom] = useState(isoDaysAgo(29));
    const [dateTo, setDateTo] = useState(todayIso());
    const [timeline, setTimeline] = useState<StaffTimeline | null>(null);
    const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Per-day resolve form
    const [resolvingDate, setResolvingDate] = useState<string | null>(null);
    const [resolveForm, setResolveForm] = useState({ checkOut: "" });
    const [saving, setSaving] = useState<string | null>(null);
    const [resolveError, setResolveError] = useState<string | null>(null);
    const [resolved, setResolved] = useState<Set<string>>(new Set());

    // State-based tooltip
    const [tooltip, setTooltip] = useState<{ lines: string[]; x: number; y: number } | null>(null);
    const tipRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showTip = useCallback((e: React.MouseEvent<HTMLDivElement>, lines: string[]) => {
        if (tipRef.current) clearTimeout(tipRef.current);
        const r = e.currentTarget.getBoundingClientRect();
        setTooltip({ lines, x: r.left + r.width / 2, y: r.top });
    }, []);

    const hideTip = useCallback(() => {
        tipRef.current = setTimeout(() => setTooltip(null), 100);
    }, []);

    const load = useCallback(async () => {
        if (!employeeId || !dateFrom || !dateTo) return;
        setLoading(true);
        setError(null);
        try {
            const [timelineData, empData] = await Promise.all([
                attendanceService.getStaffTimeline(employeeId, { date_from: dateFrom, date_to: dateTo }),
                hrService.getEmployee(employeeId),
            ]);
            setTimeline(timelineData);
            setEmployee(empData);
        } catch {
            setError("Failed to load attendance timeline.");
        } finally {
            setLoading(false);
        }
    }, [employeeId, dateFrom, dateTo]);

    useEffect(() => { load(); }, [load]);

    const today = todayIso();
    const stats = timeline ? computeStats(timeline.days) : null;

    const doResolve = async (date: string, checkInStart: string) => {
        if (!resolveForm.checkOut || !employee?.campus_id) return;
        setSaving(date);
        setResolveError(null);
        try {
            const checkInTime = new Date(checkInStart).toISOString().slice(11, 16);
            await attendanceService.bulkMarkStaff({
                date,
                campus_id: employee.campus_id,
                records: [{
                    employee_id: employeeId,
                    status: "PRESENT",
                    check_in_time: checkInTime,
                    check_out_time: resolveForm.checkOut,
                }],
            });
            setResolved((prev) => new Set([...prev, date]));
            setResolvingDate(null);
            await load();
        } catch {
            setResolveError("Failed to save. Try again.");
        } finally {
            setSaving(null);
        }
    };

    const sel = "h-10 px-3 border rounded-xl text-sm bg-white dark:bg-zinc-950 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary/30";

    return (
        <>
            <div className="space-y-8 pb-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <button
                            onClick={() => router.push("/hr/attendance-dashboard")}
                            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mb-2"
                        >
                            <ArrowLeft className="h-4 w-4" /> Back to Attendance Dashboard
                        </button>
                        <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 font-outfit flex items-center gap-2">
                            <CalendarCheck className="h-7 w-7 text-primary" />
                            {timeline?.employee.full_name ?? "Attendance Timeline"}
                        </h1>
                        {employee?.job_title && (
                            <p className="text-sm text-zinc-500 mt-0.5">{employee.job_title}{employee.departments ? ` · ${employee.departments.name}` : ""}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={sel} />
                        <span className="text-zinc-400 text-sm">to</span>
                        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={sel} />
                    </div>
                </div>

                {error && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-sm">
                        <AlertCircle className="w-4 h-4 shrink-0" />{error}
                    </div>
                )}

                {/* Summary stat cards */}
                {stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                                <TrendingUp className="h-4 w-4 text-emerald-500" />
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Attendance Rate</p>
                            </div>
                            <p className="text-2xl font-black text-emerald-600">{stats.presentRate}%</p>
                            <p className="text-xs text-zinc-400 mt-0.5">{stats.presentDays} of {stats.workingDays} working days</p>
                        </div>
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                                <Clock className="h-4 w-4 text-blue-500" />
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Avg Clock-In</p>
                            </div>
                            <p className="text-2xl font-black text-zinc-800 dark:text-zinc-100">{stats.avgCheckIn ?? "—"}</p>
                            <p className="text-xs text-zinc-400 mt-0.5">Average first scan time</p>
                        </div>
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                                <UserX className="h-4 w-4 text-rose-500" />
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Absent Days</p>
                            </div>
                            <p className="text-2xl font-black text-rose-600">{stats.absentDays}</p>
                            <p className="text-xs text-zinc-400 mt-0.5">{stats.lateDays} late arrival{stats.lateDays !== 1 ? "s" : ""}</p>
                        </div>
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                                <CheckCircle2 className="h-4 w-4 text-amber-500" />
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Break</p>
                            </div>
                            <p className="text-2xl font-black text-zinc-800 dark:text-zinc-100">{fmtBreak(stats.totalBreakMin)}</p>
                            <p className="text-xs text-zinc-400 mt-0.5">Across all recorded days</p>
                        </div>
                    </div>
                )}

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-3 shadow-sm">
                    {(Object.keys(SEGMENT_STYLES) as TimelineSegmentType[]).map((key) => (
                        <div key={key} className="flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full ${SEGMENT_STYLES[key].bg}`} />
                            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{SEGMENT_STYLES[key].label}</span>
                        </div>
                    ))}
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Missing clock-out</span>
                    </div>
                </div>

                {/* Day list */}
                {loading && !timeline ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
                    </div>
                ) : !timeline || timeline.days.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-14">No attendance data for this range.</p>
                ) : (
                    <div className="space-y-3">
                        {timeline.days.map((day) => {
                            const isPast = day.date < today;
                            const lastSeg = day.segments[day.segments.length - 1];
                            const isUnresolved = !!(
                                day.is_working_day &&
                                isPast &&
                                lastSeg?.isMissingOut &&
                                !resolved.has(day.date)
                            );
                            const isResolving = resolvingDate === day.date;
                            const checkInStart = day.segments.find((s) => s.type === "WORK")?.start ?? null;

                            return (
                                <div
                                    key={day.date}
                                    className={`bg-white dark:bg-zinc-950 border rounded-2xl p-4 shadow-sm transition-colors ${
                                        isUnresolved && !isResolving
                                            ? "border-amber-300 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10"
                                            : "border-zinc-200 dark:border-zinc-800"
                                    }`}
                                >
                                    {/* Day header */}
                                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
                                                {fmtDateLabel(day.date)}
                                            </span>
                                            {!day.is_working_day && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                                                    {day.day_description ?? day.day_type ?? "Off"}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {day.status && (
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_PILL[day.status]}`}>
                                                    {STATUS_LABEL[day.status]}
                                                </span>
                                            )}
                                            {(() => {
                                                const lm = computeLateMinutes(day, employee?.reporting_time ?? null, employee?.late_relaxation_minutes ?? null);
                                                return lm > 0 ? (
                                                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                                        +{lm}m late
                                                    </span>
                                                ) : null;
                                            })()}
                                            {isUnresolved && !isResolving && (
                                                <button
                                                    onClick={() => { setResolvingDate(day.date); setResolveForm({ checkOut: "" }); setResolveError(null); }}
                                                    className="text-[11px] font-semibold px-3 py-1 rounded-lg bg-amber-500 text-white hover:bg-amber-400 transition-colors"
                                                >
                                                    Resolve
                                                </button>
                                            )}
                                            {isResolving && (
                                                <button onClick={() => setResolvingDate(null)} className="text-[11px] text-zinc-400 hover:text-zinc-600 px-2 py-1">
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Timeline bar */}
                                    {day.segments.length === 0 ? (
                                        <div className="h-8 rounded-lg bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-xs text-zinc-400">
                                            {day.is_working_day ? "No scans recorded" : "Non-working day"}
                                        </div>
                                    ) : (
                                        <div className="relative h-8 rounded-lg bg-zinc-50 dark:bg-zinc-900 overflow-visible">
                                            {day.segments.map((seg, idx) => {
                                                const left = timeToPercent(seg.start);
                                                const rawWidth = timeToPercent(seg.end) - left;
                                                const width = seg.isMissingOut ? Math.max(rawWidth, 1.5) : Math.max(rawWidth, 0.5);
                                                const segStyle = SEGMENT_STYLES[seg.type] ?? SEGMENT_STYLES.WORK;
                                                return (
                                                    <div
                                                        key={idx}
                                                        onMouseEnter={(e) => showTip(e, [
                                                            `${segStyle.label}`,
                                                            `${fmtSeg(seg.start)} – ${seg.isMissingOut ? "clock-out missing" : fmtSeg(seg.end)}`,
                                                        ])}
                                                        onMouseLeave={hideTip}
                                                        className={`absolute top-0 bottom-0 rounded-sm cursor-default ${
                                                            seg.isMissingOut
                                                                ? "bg-amber-400 animate-pulse"
                                                                : segStyle.bg
                                                        }`}
                                                        style={{ left: `${left}%`, width: `${width}%` }}
                                                    />
                                                );
                                            })}
                                        </div>
                                    )}

                                    <div className="flex justify-between mt-1.5 text-[10px] text-zinc-400">
                                        <span>00:00</span>
                                        <span>06:00</span>
                                        <span>12:00</span>
                                        <span>18:00</span>
                                        <span>24:00</span>
                                    </div>

                                    {/* Unresolved banner */}
                                    {isUnresolved && !isResolving && checkInStart && (
                                        <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded-lg px-3 py-2">
                                            <Clock className="h-3.5 w-3.5 shrink-0" />
                                            Clocked in at {fmtSeg(checkInStart)} — no clock-out recorded
                                        </div>
                                    )}

                                    {/* Resolve form */}
                                    {isResolving && (
                                        <div className="mt-3 border-t border-zinc-100 dark:border-zinc-800 pt-3 space-y-3">
                                            {resolveError && (
                                                <p className="text-xs text-rose-500">{resolveError}</p>
                                            )}
                                            <div className="flex flex-wrap items-end gap-3">
                                                {checkInStart && (
                                                    <div>
                                                        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-1">Clock In (from scan)</p>
                                                        <div className="h-9 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm text-zinc-500 flex items-center font-mono">
                                                            {fmtSeg(checkInStart)}
                                                        </div>
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-1">Clock Out *</p>
                                                    <input
                                                        type="time"
                                                        value={resolveForm.checkOut}
                                                        onChange={(e) => setResolveForm({ checkOut: e.target.value })}
                                                        className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-primary/30"
                                                    />
                                                </div>
                                                <button
                                                    disabled={!resolveForm.checkOut || saving === day.date}
                                                    onClick={() => checkInStart && doResolve(day.date, checkInStart)}
                                                    className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                                >
                                                    {saving === day.date ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                                    Save
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Tooltip */}
            {tooltip && (
                <div
                    className="fixed z-[200] pointer-events-none"
                    style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, calc(-100% - 8px))" }}
                >
                    <div className="bg-zinc-900 dark:bg-zinc-800 text-white text-xs rounded-xl px-3 py-2 shadow-2xl whitespace-nowrap space-y-0.5">
                        {tooltip.lines.map((l, i) => <p key={i}>{l}</p>)}
                        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-zinc-900 dark:border-t-zinc-800" />
                    </div>
                </div>
            )}
        </>
    );
}
