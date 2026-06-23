"use client";

import { useState } from "react";
import { X, Loader2, AlertTriangle, RefreshCw, Coffee, CheckCircle2 } from "lucide-react";
import { hrService, PayrollRun, PayrollRunLine, DayClassification } from "@/lib/hr.service";
import { attendanceService, StaffAttendanceStatus } from "@/lib/attendance.service";

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

  const emp = line.employee_profiles;
  const name = emp?.full_name ?? `Employee #${line.employee_id}`;
  const isFinal = run.status === "FINALIZED";
  const dirty = Object.keys(overrides).length > 0;

  const handleResolve = async (date: string, status: StaffAttendanceStatus) => {
    setSavingDate(date);
    setError(null);
    try {
      await attendanceService.bulkMarkStaff({
        date,
        campus_id: run.campus_id,
        records: [{ employee_id: line.employee_id, status }],
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

        {/* Day list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {line.daily_breakdown.map((day) => {
            const effectiveClassification = (overrides[day.date] ?? day.classification) as DayClassification;
            const style = CLASSIFICATION_STYLES[effectiveClassification];
            const needsAttention = effectiveClassification === "UNRESOLVED" || effectiveClassification === "ABSENT";
            const wasOverridden = !!overrides[day.date];

            return (
              <div
                key={day.date}
                className={`rounded-xl border p-3 bg-white dark:bg-zinc-900/30 transition-colors ${
                  needsAttention && !wasOverridden ? "border-amber-200 dark:border-amber-900/40" : "border-zinc-100 dark:border-zinc-800"
                }`}
              >
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
                      <div className="flex items-center gap-1.5">
                        {RESOLVE_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => handleResolve(day.date, opt.value)}
                            disabled={savingDate === day.date}
                            className="h-7 px-2 rounded-lg text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-primary hover:text-white transition-colors disabled:opacity-50"
                          >
                            {opt.label}
                          </button>
                        ))}
                        <button onClick={() => setResolvingDate(null)} className="p-1 text-zinc-400 hover:text-zinc-600">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setResolvingDate(day.date)}
                        disabled={savingDate === day.date}
                        className="h-7 px-3 rounded-lg text-[11px] font-bold border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-primary hover:text-primary transition-colors flex items-center gap-1 shrink-0 disabled:opacity-50"
                      >
                        {savingDate === day.date ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                        Resolve
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
