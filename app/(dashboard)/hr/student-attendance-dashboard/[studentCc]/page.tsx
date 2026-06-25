"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, CalendarCheck, Loader2 } from "lucide-react";
import { attendanceService, StudentTimeline, StudentTimelineSegmentType } from "@/lib/attendance.service";

function isoDaysAgo(days: number) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
}

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

const SEGMENT_STYLES: Record<StudentTimelineSegmentType, { bg: string; label: string }> = {
    WORK: { bg: "bg-emerald-500 dark:bg-emerald-600", label: "Clocked in" },
    BREAK: { bg: "bg-blue-500 dark:bg-blue-600", label: "Break" },
};

function timeToPercent(value: string): number {
    if (value === "00:00") return 0;
    if (value === "24:00") return 100;
    const d = new Date(value);
    return ((d.getUTCHours() * 60 + d.getUTCMinutes()) / 1440) * 100;
}

function formatSegmentTime(value: string): string {
    if (value === "00:00" || value === "24:00") return value;
    return new Date(value).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

function formatDateLabel(dateStr: string): string {
    return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
    });
}

const STATUS_BADGE: Record<string, string> = {
    PRESENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    ABSENT: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    EXCUSED: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
    LATE: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

export default function StudentAttendanceTimelinePage() {
    const params = useParams<{ studentCc: string }>();
    const router = useRouter();
    const studentCc = Number(params.studentCc);

    const [dateFrom, setDateFrom] = useState(isoDaysAgo(6));
    const [dateTo, setDateTo] = useState(todayIso());
    const [timeline, setTimeline] = useState<StudentTimeline | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

    useEffect(() => {
        load();
    }, [load]);

    const sel =
        "h-10 px-3 border rounded-xl text-sm bg-white dark:bg-zinc-950 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary/30";

    return (
        <div className="space-y-8 pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <button
                        onClick={() => router.push("/hr/student-attendance-dashboard")}
                        className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 mb-2"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to Student Attendance Dashboard
                    </button>
                    <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 font-outfit flex items-center gap-2">
                        <CalendarCheck className="h-7 w-7 text-primary" />
                        {timeline?.student.full_name ?? "Attendance Timeline"}
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={sel} />
                    <span className="text-zinc-400 text-sm">to</span>
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={sel} />
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            <div className="flex flex-wrap items-center gap-5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-3 shadow-sm">
                {(Object.keys(SEGMENT_STYLES) as StudentTimelineSegmentType[]).map((key) => (
                    <div key={key} className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${SEGMENT_STYLES[key].bg}`} />
                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{SEGMENT_STYLES[key].label}</span>
                    </div>
                ))}
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Off time</span>
                </div>
            </div>

            {loading && !timeline ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
                </div>
            ) : !timeline || timeline.days.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-14">No attendance data for this range.</p>
            ) : (
                <div className="space-y-4">
                    {timeline.days.map((day) => (
                        <div
                            key={day.date}
                            className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{formatDateLabel(day.date)}</span>
                                {day.status && (
                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[day.status] ?? "bg-zinc-100 text-zinc-500"}`}>
                                        {day.status}
                                    </span>
                                )}
                            </div>
                             {day.segments.length === 0 ? (
                                <div className="h-8 rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">
                                    No scans / Off
                                </div>
                            ) : (
                                <div className="relative h-8 rounded-lg bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                                    {day.segments.map((seg, idx) => {
                                        const left = timeToPercent(seg.start);
                                        const width = Math.max(timeToPercent(seg.end) - left, 0.5);
                                        return (
                                            <div
                                                key={idx}
                                                className={`absolute top-0 bottom-0 ${SEGMENT_STYLES[seg.type].bg} group cursor-pointer transition-all hover:brightness-95`}
                                                style={{ left: `${left}%`, width: `${width}%` }}
                                            >
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 bg-zinc-950 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap border border-zinc-800 transition-all pointer-events-none">
                                                    <span className="block text-[9px] uppercase tracking-wider opacity-60 text-left">
                                                        {seg.isMissingOut ? "Clocked In (Unresolved)" : SEGMENT_STYLES[seg.type].label}
                                                    </span>
                                                    {seg.isMissingOut ? (
                                                        `Clocked in at ${formatSegmentTime(seg.start)} (No clock out)`
                                                    ) : (
                                                        `${formatSegmentTime(seg.start)} – ${formatSegmentTime(seg.end)}`
                                                    )}
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-950" />
                                                </div>
                                            </div>
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
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
