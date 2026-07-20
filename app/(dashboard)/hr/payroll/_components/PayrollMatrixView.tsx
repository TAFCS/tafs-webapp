"use client";

import { AlertTriangle } from "lucide-react";
import { AttendanceLineBase, DayBreakdownEntry, DayClassification } from "@/lib/hr.service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtISO(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  });
}

function fmtSegT(t: string): string {
  if (t === "00:00" || t === "24:00") return t;
  return new Date(t).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  });
}

function generateDates(start: string, end: string): string[] {
  const dates: string[] = [];
  const d = new Date(`${start.slice(0, 10)}T00:00:00Z`);
  const e = new Date(`${end.slice(0, 10)}T00:00:00Z`);
  while (d <= e) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

function extractPunches(day: DayBreakdownEntry): Array<{ time: string; missing?: boolean }> {
  const segs = day.segments ?? [];
  if (segs.length === 0) {
    const result: Array<{ time: string; missing?: boolean }> = [];
    if (day.check_in_at) result.push({ time: fmtISO(day.check_in_at) });
    if (day.check_out_at) result.push({ time: fmtISO(day.check_out_at) });
    else if (day.check_in_at) result.push({ time: "?", missing: true });
    return result;
  }

  const result: Array<{ time: string; missing?: boolean }> = [];
  const workSegs = segs.filter((s) => s.type === "WORK");

  workSegs.forEach((w) => {
    result.push({ time: fmtSegT(w.start) });
    if (w.isMissingOut) {
      result.push({ time: "?", missing: true });
    } else {
      result.push({ time: fmtSegT(w.end) });
    }
  });

  return result;
}

// ── Cell styles by classification ─────────────────────────────────────────────

const CELL_BG: Record<DayClassification, string> = {
  PRESENT:      "bg-white dark:bg-zinc-950",
  LATE:         "bg-amber-50 dark:bg-amber-950/20",
  HALF_DAY:     "bg-orange-50 dark:bg-orange-950/20",
  ABSENT:       "bg-rose-50 dark:bg-rose-950/20",
  EXCUSED:      "bg-sky-50 dark:bg-sky-950/20",
  SICK_LEAVE:   "bg-violet-50 dark:bg-violet-950/20",
  CASUAL_LEAVE: "bg-teal-50 dark:bg-teal-950/20",
  ANNUAL_LEAVE: "bg-indigo-50 dark:bg-indigo-950/20",
  UNPAID_LEAVE: "bg-rose-100 dark:bg-rose-950/30",
  UNRESOLVED:   "bg-amber-100 dark:bg-amber-900/30",
  DAY_OFF:      "bg-zinc-50 dark:bg-zinc-900/30",
};

const CELL_DOT: Record<DayClassification, string> = {
  PRESENT:      "bg-emerald-500",
  LATE:         "bg-amber-500",
  HALF_DAY:     "bg-orange-500",
  ABSENT:       "bg-rose-500",
  EXCUSED:      "bg-sky-400",
  SICK_LEAVE:   "bg-violet-500",
  CASUAL_LEAVE: "bg-teal-500",
  ANNUAL_LEAVE: "bg-indigo-500",
  UNPAID_LEAVE: "bg-rose-600",
  UNRESOLVED:   "bg-amber-500 animate-pulse",
  DAY_OFF:      "bg-zinc-300 dark:bg-zinc-600",
};

const CELL_TEXT: Record<DayClassification, string> = {
  PRESENT:      "text-zinc-700 dark:text-zinc-200",
  LATE:         "text-amber-700 dark:text-amber-400",
  HALF_DAY:     "text-orange-700 dark:text-orange-400",
  ABSENT:       "text-rose-600 dark:text-rose-400",
  EXCUSED:      "text-sky-700 dark:text-sky-400",
  SICK_LEAVE:   "text-violet-700 dark:text-violet-400",
  CASUAL_LEAVE: "text-teal-700 dark:text-teal-400",
  ANNUAL_LEAVE: "text-indigo-700 dark:text-indigo-400",
  UNPAID_LEAVE: "text-rose-700 dark:text-rose-300",
  UNRESOLVED:   "text-amber-800 dark:text-amber-300",
  DAY_OFF:      "text-zinc-400 dark:text-zinc-600",
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  periodStart: string;
  periodEnd: string;
  lines: AttendanceLineBase[];
  onOpenLine: (line: AttendanceLineBase, date: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PayrollMatrixView({ periodStart, periodEnd, lines, onOpenLine }: Props) {
  const dates = generateDates(periodStart, periodEnd);
  const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const totalUnresolved = lines.reduce((s, l) => s + l.unresolved_days, 0);

  return (
    <div className="space-y-4">
      {totalUnresolved > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 text-amber-800 dark:text-amber-400 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>{totalUnresolved}</strong> unresolved day(s) — click a cell to open the employee timeline and resolve.
          </span>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950 shadow-sm">
        <div className="overflow-auto max-h-[calc(100vh-220px)]">
          <table className="border-collapse text-xs" style={{ minWidth: `${200 + dates.length * 88}px` }}>
            <thead className="sticky top-0 z-30">
              <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                {/* Sticky employee column header — double-sticky: top via thead, left via own position */}
                <th className="sticky left-0 z-20 bg-zinc-50 dark:bg-zinc-900 px-4 py-2.5 text-left font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-r border-zinc-200 dark:border-zinc-800 min-w-[200px]">
                  Employee
                </th>
                {dates.map((d) => {
                  const dt = new Date(`${d}T00:00:00Z`);
                  const isWeekend = dt.getUTCDay() === 0 || dt.getUTCDay() === 5 || dt.getUTCDay() === 6;
                  return (
                    <th
                      key={d}
                      className={`px-1 py-2 text-center font-semibold tracking-wide w-[88px] min-w-[88px] border-r border-zinc-100 dark:border-zinc-800/50 ${
                        isWeekend ? "text-rose-400 dark:text-rose-500" : "text-zinc-500 dark:text-zinc-400"
                      }`}
                    >
                      <div className="text-[10px] leading-none">{DAYS[dt.getUTCDay()]}</div>
                      <div className="text-sm font-black mt-0.5 text-zinc-700 dark:text-zinc-200">{dt.getUTCDate()}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {lines.map((line) => {
                const emp = line.employee_profiles;
                const name = emp?.full_name ?? `Employee #${line.employee_id}`;
                const code = emp?.employee_code ?? "—";
                const dayMap = new Map<string, DayBreakdownEntry>(
                  line.daily_breakdown.map((d) => [d.date, d]),
                );

                return (
                  <tr key={line.employee_id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 transition-colors">
                    {/* Sticky employee name */}
                    <td className="sticky left-0 z-10 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 px-4 py-2">
                      <div>
                        <p className="font-semibold text-zinc-800 dark:text-zinc-100 leading-tight truncate max-w-[170px]">{name}</p>
                        <p className="text-zinc-400 font-mono text-[10px]">{code}</p>
                      </div>
                    </td>

                    {dates.map((d) => {
                      const day = dayMap.get(d);
                      if (!day) {
                        return (
                          <td key={d} className="border-r border-zinc-100 dark:border-zinc-800/50 text-center p-0.5">
                            <div className="h-12 rounded flex items-center justify-center text-zinc-300 dark:text-zinc-700 text-[10px]">
                              —
                            </div>
                          </td>
                        );
                      }

                      const cls = day.classification;
                      const punches = cls === "DAY_OFF" || !day.is_working_day ? [] : extractPunches(day);

                      return (
                        <td
                          key={d}
                          className={`border-r border-zinc-100 dark:border-zinc-800/50 p-0.5 cursor-pointer`}
                          onClick={() => onOpenLine(line, d)}
                        >
                          <div
                            className={`rounded min-h-12 flex flex-col items-center justify-center gap-0.5 py-1 px-1 transition-opacity hover:opacity-80 ${CELL_BG[cls]}`}
                          >
                            {/* Status dot */}
                            <div className={`w-1.5 h-1.5 rounded-full mb-0.5 ${CELL_DOT[cls]}`} />

                            {cls === "DAY_OFF" || !day.is_working_day ? (
                              <span className={`text-[9px] font-medium uppercase tracking-wide ${CELL_TEXT[cls]}`}>
                                {day.day_description ?? "Off"}
                              </span>
                            ) : cls === "ABSENT" ? (
                              <span className={`text-[10px] font-semibold ${CELL_TEXT[cls]}`}>Absent</span>
                            ) : cls === "EXCUSED" || cls === "SICK_LEAVE" || cls === "CASUAL_LEAVE" || cls === "ANNUAL_LEAVE" || cls === "UNPAID_LEAVE" ? (
                              <span className={`text-[9px] font-semibold text-center leading-tight ${CELL_TEXT[cls]}`}>
                                {cls === "SICK_LEAVE" ? "Sick" : cls === "CASUAL_LEAVE" ? "Casual" : cls === "ANNUAL_LEAVE" ? "Annual" : cls === "UNPAID_LEAVE" ? "Unpaid" : "Excused"}
                              </span>
                            ) : punches.length === 0 ? (
                              <span className="text-[9px] text-zinc-300 dark:text-zinc-700">No data</span>
                            ) : (
                              <div className="flex flex-col items-center gap-px w-full px-1">
                                {punches.map((p, i) => (
                                  <div
                                    key={i}
                                    className={`flex items-center gap-0.5 text-[10px] font-mono leading-none ${
                                      p.missing
                                        ? "text-amber-600 dark:text-amber-400 font-bold"
                                        : i % 2 === 0
                                        ? "text-emerald-700 dark:text-emerald-400"
                                        : "text-zinc-500 dark:text-zinc-400"
                                    }`}
                                  >
                                    <span className="text-[8px] opacity-60">{i % 2 === 0 ? "▲" : "▼"}</span>
                                    {p.time}
                                  </div>
                                ))}
                                {cls === "LATE" && (day.late_minutes ?? 0) > 0 && (
                                  <div className="mt-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400 leading-none">
                                    +{day.late_minutes}m
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 px-1">
        {(
          [
            ["PRESENT", "Present"],
            ["LATE", "Late"],
            ["HALF_DAY", "Half Day"],
            ["ABSENT", "Absent"],
            ["EXCUSED", "Excused"],
            ["SICK_LEAVE", "Sick Leave"],
            ["CASUAL_LEAVE", "Casual Leave"],
            ["ANNUAL_LEAVE", "Annual Leave"],
            ["UNPAID_LEAVE", "Unpaid Leave"],
            ["UNRESOLVED", "Unresolved"],
            ["DAY_OFF", "Day Off"],
          ] as [DayClassification, string][]
        ).map(([cls, label]) => (
          <div key={cls} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${CELL_DOT[cls]}`} />
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
