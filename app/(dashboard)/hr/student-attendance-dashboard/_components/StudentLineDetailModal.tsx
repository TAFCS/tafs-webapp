"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle, AlertTriangle, CheckCircle2, Clock, Coffee, Loader2, X,
} from "lucide-react";
import {
  attendanceService,
  RollRecordStatus,
  StudentAttendanceLine,
  StudentDayBreakdownEntry,
  StudentDayClassification,
} from "@/lib/attendance.service";
import { StudentLineTags } from "./StudentLineTags";

// ── Segment types & styles ────────────────────────────────────────────────────

type SegType = "WORK" | "BREAK" | "DAY_OFF";

const SEG: Record<SegType, { bg: string; label: string }> = {
  WORK:    { bg: "bg-emerald-500",               label: "On campus" },
  BREAK:   { bg: "bg-blue-400",                  label: "Break" },
  DAY_OFF: { bg: "bg-zinc-300 dark:bg-zinc-700", label: "Day Off" },
};

const PILL: Record<StudentDayClassification, { cls: string; label: string }> = {
  PRESENT:    { cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400", label: "Present" },
  LATE:       { cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",         label: "Late" },
  ABSENT:     { cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",             label: "Absent" },
  EXCUSED:    { cls: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",                 label: "Excused" },
  UNRESOLVED: { cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",         label: "Unresolved" },
  DAY_OFF:    { cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",                label: "Day Off" },
};

/** Every status a student day can be overridden to — the full RollRecordStatus set. */
const OVERRIDE_STATUSES: { value: RollRecordStatus; label: string }[] = [
  { value: "PRESENT", label: "Present" },
  { value: "LATE",    label: "Late" },
  { value: "ABSENT",  label: "Absent" },
  { value: "EXCUSED", label: "Excused" },
];

/** Offered on an UNRESOLVED day when the student never actually attended. */
const ALT_STATUSES: { value: RollRecordStatus; label: string }[] = [
  { value: "ABSENT",  label: "Absent" },
  { value: "EXCUSED", label: "Excused" },
];

/** ABSENT/EXCUSED mean "wasn't here" — the backend drops the day's punches to match. */
function clearsPunches(status: RollRecordStatus): boolean {
  return status === "ABSENT" || status === "EXCUSED";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function fmtISO(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

function fmtDate(s: string): string {
  return new Date(`${s}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
  });
}

function dur(start: string, end: string): string {
  if (start === "00:00" || end === "24:00") return "";
  const m = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  if (m <= 0) return "";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

function timeToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00.000Z`).toISOString();
}

/** Pull the readable message out of an axios error, whose `message` may be a string or a list of validation failures. */
function errMessage(err: unknown, fallback: string): string {
  const res = (err as { response?: { data?: { message?: string | string[] } } })?.response;
  const msg = res?.data?.message;
  if (Array.isArray(msg)) return msg.join(". ");
  if (msg) return msg;
  if (!res && err instanceof Error && err.message) return err.message;
  return fallback;
}

function buildPreviewSegments(status: RollRecordStatus, checkInAt: string | null, checkOutAt: string | null): Seg[] {
  if (status === "EXCUSED") return [{ type: "DAY_OFF", start: "00:00", end: "24:00" }];
  if (status === "ABSENT") return [];
  if (checkInAt) return [{ type: "WORK", start: checkInAt, end: checkOutAt ?? checkInAt }];
  return [];
}

/**
 * Repaint the saved day locally instead of refetching the whole matrix — the
 * parent still reloads in the background, but the row updates immediately.
 * Mirrors what the backend writes in StudentAttendanceService#bulkManualMark.
 */
function applyManualOverridePreview(
  day: StudentDayBreakdownEntry,
  status: RollRecordStatus,
  checkInTime?: string,
  checkOutTime?: string,
): StudentDayBreakdownEntry {
  const cleared = clearsPunches(status);
  const checkInAt = cleared ? null : checkInTime ? timeToIso(day.date, checkInTime) : day.check_in_at;
  const checkOutAt = cleared ? null : checkOutTime ? timeToIso(day.date, checkOutTime) : day.check_out_at;
  const manualWithTimes = !cleared && !!(checkInTime || checkOutTime);

  return {
    ...day,
    classification: status as StudentDayClassification,
    check_in_at: checkInAt,
    check_out_at: checkOutAt,
    source: "MANUAL",
    segments: buildPreviewSegments(status, checkInAt, checkOutAt),
    break_minutes: cleared || manualWithTimes ? 0 : day.break_minutes,
    late_minutes: 0,
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Seg { type: string; start: string; end: string; isMissingOut?: boolean }
interface Tooltip { lines: string[]; x: number; y: number }

interface Props {
  campusId: number;
  line: StudentAttendanceLine;
  onClose: () => void;
  /** Cell the matrix was clicked on — the day list scrolls to it on open. */
  initialDate?: string;
  /** Called after a save, so the parent can refetch its lines. */
  onResolved?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StudentLineDetailModal({ campusId, line, onClose, initialDate, onResolved }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [localBreakdown, setLocalBreakdown] = useState(line.daily_breakdown);
  const [resolvingDate, setResolvingDate] = useState<string | null>(null);
  const [form, setForm] = useState({ checkIn: "", checkOut: "" });
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  useEffect(() => { setLocalBreakdown(line.daily_breakdown); }, [line]);

  useEffect(() => {
    if (!initialDate) return;
    const el = scrollContainerRef.current?.querySelector(`[data-date="${initialDate}"]`);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  }, [initialDate]);

  // Escape closes, matching every other modal in the dashboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stu = line.student;
  const name = stu.full_name ?? `Student #${line.student_cc}`;

  const showTip = useCallback((e: React.MouseEvent<HTMLDivElement>, lines: string[]) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTooltip({ lines, x: r.left + r.width / 2, y: r.top });
  }, []);

  const hideTip = useCallback(() => setTooltip(null), []);

  const openResolve = (day: StudentDayBreakdownEntry) => {
    setForm({
      checkIn:  day.check_in_at  ? new Date(day.check_in_at).toISOString().slice(11, 16)  : "",
      checkOut: day.check_out_at ? new Date(day.check_out_at).toISOString().slice(11, 16) : "",
    });
    setResolvingDate(day.date);
    setError(null);
  };

  const doResolve = async (date: string, status: RollRecordStatus) => {
    if (!localBreakdown.some(d => d.date === date)) return;

    setSaving(date);
    setError(null);
    try {
      const cleared = clearsPunches(status);
      const checkInTime  = cleared ? undefined : (form.checkIn  || undefined);
      const checkOutTime = cleared ? undefined : (form.checkOut || undefined);

      await attendanceService.bulkMarkStudentsDaily({
        date,
        campus_id: campusId,
        records: [{
          student_cc: line.student_cc,
          status,
          check_in_time: checkInTime,
          check_out_time: checkOutTime,
        }],
      });

      setLocalBreakdown(prev =>
        prev.map(d => (d.date === date ? applyManualOverridePreview(d, status, checkInTime, checkOutTime) : d)),
      );
      setResolvingDate(null);
      onResolved?.();
    } catch (err) {
      setError(errMessage(err, "Failed to save attendance."));
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      {/* Tooltip — fixed above everything, z-200 */}
      {tooltip && (
        <div
          className="fixed z-[200] pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, calc(-100% - 10px))" }}
        >
          <div className="bg-zinc-950 text-white text-[11px] px-3 py-2 rounded-xl shadow-2xl border border-zinc-800 max-w-[240px]">
            {tooltip.lines.map((l, i) => (
              <div key={i} className={i === 0 ? "font-semibold" : "text-zinc-400 mt-0.5"}>{l}</div>
            ))}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-zinc-950" />
          </div>
        </div>
      )}

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="w-full max-w-3xl h-[88vh] bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {stu.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={stu.photo_url} alt={name} className="h-10 w-10 rounded-xl object-cover flex-shrink-0 bg-zinc-100" />
              ) : (
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {name.split(" ").filter(Boolean).slice(0, 2).map(n => n[0]).join("").toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[15px] font-black text-zinc-900 dark:text-zinc-100 truncate">{name}</p>
                <p className="text-[11px] text-zinc-400 font-mono">
                  {stu.gr_number ?? "—"}
                  {(stu.class || stu.section) && ` · ${[stu.class, stu.section].filter(Boolean).join(" ")}`}
                  {line.campus_name ? ` · ${line.campus_name}` : ""}
                </p>
                <StudentLineTags line={line} className="mt-1" />
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-400 flex-shrink-0"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Period summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Present</p>
              <p className="text-sm font-bold text-emerald-600">{line.present_days}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Late</p>
              <p className="text-sm font-bold text-amber-600">{line.late_days}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Absent</p>
              <p className="text-sm font-bold text-rose-600">{line.absent_days}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Excused</p>
              <p className="text-sm font-bold text-sky-600">{line.excused_days}</p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-6 py-3 bg-rose-50 border-b border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30 text-rose-700 dark:text-rose-400 text-xs shrink-0">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} aria-label="Dismiss error">
                <X className="h-3.5 w-3.5 opacity-60 hover:opacity-100" />
              </button>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 px-6 py-2.5 bg-white dark:bg-zinc-900/80 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
            {(Object.entries(SEG) as [SegType, typeof SEG[SegType]][]).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded-sm flex-shrink-0 ${v.bg}`} />
                <span className="text-[11px] text-zinc-500">{v.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-zinc-200 dark:bg-zinc-700 flex-shrink-0" />
              <span className="text-[11px] text-zinc-500">Unaccounted</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-400 flex-shrink-0 animate-pulse" />
              <span className="text-[11px] text-zinc-500">Missing check-out</span>
            </div>
          </div>

          {/* Day list */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-2">
            {localBreakdown.map(day => {
              const cls = day.classification;
              const pill = PILL[cls];
              const isPast = day.date < today;
              const isUnresolved = cls === "UNRESOLVED";
              const isResolving = resolvingDate === day.date;
              const wasOverridden = day.source === "MANUAL";
              const segs = (day.segments ?? []) as Seg[];
              // A holiday can still carry real scans — surface them and let the
              // day be overridden even though the calendar says it's off.
              const hasPunches = segs.some(s => s.type === "WORK") || !!day.check_in_at;
              const cameOnOff = !day.is_working_day && hasPunches;
              const canAct = (day.is_working_day || hasPunches) && isPast;
              const needsCheckOut = isUnresolved && canAct;

              return (
                <div
                  key={day.date}
                  data-date={day.date}
                  className={`rounded-xl border p-3 transition-colors ${
                    needsCheckOut && !isResolving
                      ? "border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/10"
                      : "border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/30"
                  }`}
                >
                  {/* Row header */}
                  <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 w-[5.5rem] shrink-0">
                        {fmtDate(day.date)}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${pill.cls}`}>
                        {isUnresolved && !wasOverridden && <AlertTriangle className="h-2.5 w-2.5" />}
                        {wasOverridden && <CheckCircle2 className="h-2.5 w-2.5" />}
                        {pill.label}
                      </span>
                      {(cls === "PRESENT" || cls === "LATE") && (
                        <span className="text-[11px] text-zinc-400 truncate flex items-center gap-1">
                          {fmtISO(day.check_in_at)} – {fmtISO(day.check_out_at)}
                          {day.break_minutes > 0 && (
                            <span className="inline-flex items-center gap-0.5 ml-1">
                              <Coffee className="h-2.5 w-2.5" />{day.break_minutes}m
                            </span>
                          )}
                        </span>
                      )}
                      {day.day_description && (
                        <span className="text-[11px] text-zinc-400 italic truncate">{day.day_description}</span>
                      )}
                      {cameOnOff && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Scanned on day off
                        </span>
                      )}
                    </div>

                    {/* Override toggle — everything except an UNRESOLVED day, which gets its own panel */}
                    {canAct && !isUnresolved && (
                      isResolving ? (
                        <button
                          onClick={() => setResolvingDate(null)}
                          className="text-[11px] text-zinc-400 hover:text-zinc-600 shrink-0"
                        >
                          Cancel
                        </button>
                      ) : (
                        <button
                          onClick={() => openResolve(day)}
                          className="h-6 px-2.5 text-[11px] font-semibold border border-zinc-200 dark:border-zinc-700 text-zinc-400 rounded-lg hover:border-primary hover:text-primary transition-colors shrink-0"
                        >
                          Override
                        </button>
                      )
                    )}
                  </div>

                  {/* Timeline bar */}
                  <div className="relative h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                    {segs.length === 0 ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[11px] text-zinc-400">
                          {day.check_in_at
                            ? "No timeline for this status"
                            : day.is_working_day
                            ? "No scans recorded"
                            : "Non-working day"}
                        </span>
                      </div>
                    ) : (
                      segs.map((seg, i) => {
                        const left = pct(seg.start);
                        const w = Math.max(pct(seg.end) - left, seg.isMissingOut ? 1.5 : 0.5);
                        const style = SEG[seg.type as SegType] ?? { bg: "bg-zinc-400", label: seg.type };
                        const d = dur(seg.start, seg.end);
                        const tipLines = seg.isMissingOut
                          ? [`Checked in at ${fmtT(seg.start)}`, "No check-out — resolve below"]
                          : [
                              `${style.label}: ${fmtT(seg.start)} – ${fmtT(seg.end)}`,
                              ...(d ? [`Duration: ${d}`] : []),
                            ];

                        return (
                          <div
                            key={i}
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
                  {/* Time axis */}
                  <div className="flex justify-between mt-1 text-[10px] text-zinc-400 select-none">
                    <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
                  </div>

                  {/* ── UNRESOLVED: missing check-out ── */}
                  {needsCheckOut && (
                    <div className={`mt-2.5 rounded-xl border p-3 ${
                      isResolving
                        ? "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                        : "border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20"
                    }`}>
                      {isResolving ? (
                        <div className="space-y-3">
                          <p className="text-xs font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-amber-500" />
                            Enter the correct scan times
                          </p>

                          <div className="flex flex-wrap items-end gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wide mb-1">
                                Check In
                              </label>
                              <input
                                type="time"
                                value={form.checkIn}
                                onChange={e => setForm(f => ({ ...f, checkIn: e.target.value }))}
                                className="h-8 px-2 w-[6.5rem] border rounded-lg text-xs bg-white dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wide mb-1">
                                Check Out <span className="text-rose-500 ml-0.5">*</span>
                              </label>
                              <input
                                type="time"
                                autoFocus
                                value={form.checkOut}
                                onChange={e => setForm(f => ({ ...f, checkOut: e.target.value }))}
                                className={`h-8 px-2 w-[6.5rem] border rounded-lg text-xs bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                                  !form.checkOut ? "border-amber-400 dark:border-amber-600" : "dark:border-zinc-700"
                                }`}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  if (!form.checkOut) { setError("Enter a check-out time first."); return; }
                                  doResolve(day.date, "PRESENT");
                                }}
                                disabled={saving === day.date}
                                className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                              >
                                {saving === day.date
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <CheckCircle2 className="h-3 w-3" />}
                                Save &amp; Mark Present
                              </button>
                              <button
                                onClick={() => setResolvingDate(null)}
                                className="h-8 px-2.5 text-xs text-zinc-400 hover:text-zinc-600"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>

                          {/* Alt status row */}
                          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-bold text-zinc-400 mr-1">Or mark as:</span>
                            {ALT_STATUSES.map(opt => (
                              <button
                                key={opt.value}
                                onClick={() => doResolve(day.date, opt.value)}
                                disabled={saving === day.date}
                                className="h-6 px-2.5 rounded-lg text-[10px] font-bold border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-rose-300 hover:text-rose-600 transition-colors disabled:opacity-50"
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                              Checked in at {fmtISO(day.check_in_at)} — no check-out recorded
                            </p>
                            <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                              Enter the actual check-out time, or override the day&apos;s status
                            </p>
                          </div>
                          <button
                            onClick={() => openResolve(day)}
                            className="h-7 px-3 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors shrink-0 flex items-center gap-1"
                          >
                            <Clock className="h-3 w-3" /> Resolve
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Override panel */}
                  {isResolving && !isUnresolved && (
                    <div className="mt-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 p-3 space-y-3">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">
                        Attendance Override
                      </p>
                      <div className="flex flex-wrap items-end gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-1">Check In</label>
                          <input
                            type="time"
                            value={form.checkIn}
                            onChange={e => setForm(f => ({ ...f, checkIn: e.target.value }))}
                            className="h-7 px-2 w-[6.5rem] border rounded-lg text-xs bg-white dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-1">Check Out</label>
                          <input
                            type="time"
                            value={form.checkOut}
                            onChange={e => setForm(f => ({ ...f, checkOut: e.target.value }))}
                            className="h-7 px-2 w-[6.5rem] border rounded-lg text-xs bg-white dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-1">Status</label>
                          <div className="flex gap-1 flex-wrap">
                            {OVERRIDE_STATUSES.map(opt => (
                              <button
                                key={opt.value}
                                onClick={() => doResolve(day.date, opt.value)}
                                disabled={saving === day.date}
                                className="h-7 px-2.5 text-[11px] font-bold border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-primary hover:text-white hover:border-transparent transition-colors disabled:opacity-50"
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <p className="text-[10px] text-zinc-400">
                        Absent and Excused clear the day&apos;s scan times; Present and Late keep them.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
