"use client";

import { useState } from "react";
import { X, Loader2, AlertTriangle, RefreshCw, Coffee, CheckCircle2 } from "lucide-react";
import { hrService, PayrollRun, PayrollRunLine, DayClassification } from "@/lib/hr.service";
import { attendanceService, StaffAttendanceStatus } from "@/lib/attendance.service";

type TimelineSegmentType = 'WORK' | 'BREAK' | 'OVERTIME' | 'DAY_OFF';

const SEGMENT_STYLES: Record<TimelineSegmentType, { bg: string; label: string }> = {
  WORK: { bg: "bg-emerald-500 dark:bg-emerald-600", label: "Clocked in" },
  BREAK: { bg: "bg-blue-500 dark:bg-blue-600", label: "Break" },
  OVERTIME: { bg: "bg-amber-500 dark:bg-amber-600", label: "Overtime" },
  DAY_OFF: { bg: "bg-zinc-300 dark:bg-zinc-700", label: "Off Day" }
};

const CLASSIFICATION_STYLES: Record<DayClassification, { bg: string; text: string; label: string }> = {
  PRESENT: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400", label: "Present" },
  LATE: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", label: "Late" },
  HALF_DAY: { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-400", label: "Half Day" },
  ABSENT: { bg: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-700 dark:text-rose-400", label: "Absent" },
  EXCUSED: { bg: "bg-sky-50 dark:bg-sky-950/30", text: "text-sky-700 dark:text-sky-400", label: "Excused" },
  UNRESOLVED: { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-800 dark:text-amber-300", label: "Unresolved" },
  DAY_OFF: { bg: "bg-zinc-100 dark:bg-zinc-800", text: "text-zinc-400", label: "Day Off" },
};

const RESOLVE_OPTIONS: { value: StaffAttendanceStatus; label: string }[] = [
  { value: "PRESENT", label: "Present" },
  { value: "LATE", label: "Late" },
  { value: "HALF_DAY", label: "Half Day" },
  { value: "ABSENT", label: "Absent" },
  { value: "EXCUSED", label: "Excused" },
];

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

function fmtDateLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

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

interface Props {
  run: PayrollRun;
  line: PayrollRunLine;
  onClose: () => void;
  onRunUpdated: (run: PayrollRun) => void;
}

export function PayrollLineDetailModal({ run, line, onClose, onRunUpdated }: Props) {
  const [resolvingDate, setResolvingDate] = useState<string | null>(null);
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, StaffAttendanceStatus>>({});
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [manualCheckIn, setManualCheckIn] = useState<string>("");
  const [manualCheckOut, setManualCheckOut] = useState<string>("");

  const emp = line.employee_profiles;
  const name = emp?.full_name ?? `Employee #${line.employee_id}`;
  const isFinal = run.status === "FINALIZED";
  const dirty = Object.keys(overrides).length > 0;

  const handleResolve = async (date: string, status: StaffAttendanceStatus, checkIn?: string, checkOut?: string) => {
    setSavingDate(date);
    setError(null);
    try {
      await attendanceService.bulkMarkStaff({
        date,
        campus_id: run.campus_id,
        records: [{
          employee_id: line.employee_id,
          status,
          check_in_time: checkIn || undefined,
          check_out_time: checkOut || undefined,
        }],
      });
      setOverrides((prev) => ({ ...prev, [date]: status }));
      setResolvingDate(null);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update attendance for this day.");
    } finally {
      setSavingDate(null);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setError(null);
    try {
      const periodEnd = new Date(run.period_end);
      const updated = await hrService.generatePayrollRun({
        campus_id: run.campus_id,
        year: periodEnd.getUTCFullYear(),
        month: periodEnd.getUTCMonth() + 1,
      });
      onRunUpdated(updated);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to regenerate payroll run.");
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl h-[85vh] bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {emp?.photo_url ? (
              <img src={emp.photo_url.replace(/([^:])\/\//g, "$1/")} alt={name} className="h-10 w-10 rounded-xl object-cover bg-zinc-100" />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                {name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-[16px] font-black text-zinc-900 dark:text-zinc-100 truncate">{name}</h2>
              <p className="text-[11px] text-zinc-400 font-mono mt-0.5">{emp?.employee_code ?? "—"} · {emp?.job_title ?? "No title"}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-600 shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        {dirty && !isFinal && (
          <div className="flex items-center gap-3 px-6 py-3 bg-amber-50 border-b border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30 text-amber-800 dark:text-amber-400 text-sm shrink-0">
            <RefreshCw className="h-4 w-4 flex-shrink-0" />
            <p className="flex-1">Attendance changed since this payroll was generated — regenerate to update the numbers.</p>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="h-8 px-3 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
            >
              {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Regenerate Now
            </button>
          </div>
        )}
        {error && (
          <div className="px-6 py-3 bg-rose-50 border-b border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30 text-rose-700 dark:text-rose-400 text-sm shrink-0">
            {error}
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-5 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 px-6 py-3 shadow-sm shrink-0">
          {(Object.keys(SEGMENT_STYLES) as TimelineSegmentType[]).map((key) => (
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

        {/* Day list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {line.daily_breakdown.map((day) => {
            const effectiveClassification = (overrides[day.date] ?? day.classification) as DayClassification;
            const style = CLASSIFICATION_STYLES[effectiveClassification];
            const needsAttention = effectiveClassification === "UNRESOLVED" || effectiveClassification === "ABSENT";
            const wasOverridden = !!overrides[day.date];
            const segments = day.segments || [];

            return (
              <div
                key={day.date}
                className={`rounded-xl border p-3 bg-white dark:bg-zinc-900/30 transition-colors ${
                  needsAttention && !wasOverridden ? "border-amber-200 dark:border-amber-900/40" : "border-zinc-100 dark:border-zinc-800"
                }`}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 w-24 shrink-0">{fmtDateLabel(day.date)}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${style.bg} ${style.text}`}>
                        {effectiveClassification === "UNRESOLVED" && <AlertTriangle className="h-3 w-3" />}
                        {wasOverridden && <CheckCircle2 className="h-3 w-3" />}
                        {style.label}
                      </span>
                      {day.classification !== "DAY_OFF" && (
                        <span className="text-xs text-zinc-400 truncate">
                          {fmtTime(day.check_in_at)} – {fmtTime(day.check_out_at)}
                          {day.break_minutes > 0 && (
                            <span className="ml-2 inline-flex items-center gap-1">
                              <Coffee className="h-3 w-3" />
                              {day.break_minutes}m
                            </span>
                          )}
                        </span>
                      )}
                      {day.day_description && <span className="text-xs text-zinc-400 italic">{day.day_description}</span>}
                    </div>

                    {day.is_working_day && !isFinal && (
                      resolvingDate === day.date ? (
                        <div className="flex flex-col gap-2 p-2 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full sm:w-auto">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs text-zinc-500 font-bold mr-1">Status:</span>
                            {RESOLVE_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => handleResolve(day.date, opt.value, manualCheckIn || undefined, manualCheckOut || undefined)}
                                disabled={savingDate === day.date}
                                className="h-7 px-2 rounded-lg text-[11px] font-bold bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-primary hover:text-white border border-zinc-200 dark:border-zinc-700 transition-colors disabled:opacity-50"
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                          {day.classification === "UNRESOLVED" && (
                            <div className="flex items-center gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                              <div className="flex items-center gap-1.5">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase">Clock In</label>
                                <input
                                  type="time"
                                  value={manualCheckIn}
                                  onChange={(e) => setManualCheckIn(e.target.value)}
                                  className="h-7 px-2 border rounded-lg text-xs bg-white dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none"
                                />
                              </div>
                              <div className="flex items-center gap-1.5">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase">Clock Out</label>
                                <input
                                  type="time"
                                  required
                                  value={manualCheckOut}
                                  onChange={(e) => setManualCheckOut(e.target.value)}
                                  className="h-7 px-2 border rounded-lg text-xs bg-white dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!manualCheckOut) {
                                    alert("Clock out time is required.");
                                    return;
                                  }
                                  handleResolve(day.date, "PRESENT", manualCheckIn || undefined, manualCheckOut);
                                }}
                                disabled={savingDate === day.date}
                                className="h-7 px-3 bg-primary text-white text-[11px] font-bold rounded-lg hover:opacity-90 disabled:opacity-50"
                              >
                                Save Times & Resolve
                              </button>
                            </div>
                          )}
                          <div className="flex justify-end pt-1">
                            <button onClick={() => setResolvingDate(null)} className="text-[10px] font-bold text-zinc-400 hover:text-zinc-600">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setResolvingDate(day.date);
                            const inStr = day.check_in_at ? new Date(day.check_in_at).toISOString().slice(11, 16) : "";
                            const outStr = day.check_out_at ? new Date(day.check_out_at).toISOString().slice(11, 16) : "";
                            setManualCheckIn(inStr);
                            setManualCheckOut(outStr);
                          }}
                          disabled={savingDate === day.date}
                          className="h-7 px-3 rounded-lg text-[11px] font-bold border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-primary hover:text-primary transition-colors flex items-center gap-1 shrink-0 disabled:opacity-50"
                        >
                          {savingDate === day.date ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                          Resolve
                        </button>
                      )
                    )}
                  </div>

                  {/* Day Timeline Graph */}
                  <div className="mt-1">
                    {segments.length === 0 ? (
                      <div className="h-8 rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">
                        No scans / Off
                      </div>
                    ) : (
                      <div className="relative h-8 rounded-lg bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                        {segments.map((seg: any, idx: number) => {
                          const left = timeToPercent(seg.start);
                          const width = Math.max(timeToPercent(seg.end) - left, 0.5);
                          const segmentType = seg.type as TimelineSegmentType;
                          const segmentStyle = SEGMENT_STYLES[segmentType] || { bg: "bg-zinc-400", label: "Unknown" };

                          return (
                            <div
                              key={idx}
                              className={`absolute top-0 bottom-0 ${segmentStyle.bg} group cursor-pointer transition-all hover:brightness-95`}
                              style={{ left: `${left}%`, width: `${width}%` }}
                            >
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 bg-zinc-950 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap border border-zinc-800 transition-all pointer-events-none">
                                <span className="block text-[9px] uppercase tracking-wider opacity-60 text-left">
                                  {seg.isMissingOut ? "Clocked In (Unresolved)" : segmentStyle.label}
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
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
