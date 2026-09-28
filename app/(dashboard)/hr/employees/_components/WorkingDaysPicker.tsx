"use client";

import { EmployeeWorkSchedule, WorkScheduleDay, hrService } from "@/lib/hr.service";

/** Working flag per day_of_week (0 = Sunday … 6 = Saturday). */
export type WeekSchedule = Record<number, boolean>;

export const WEEKDAY_ORDER = [
  { dow: 1, label: "Mon" },
  { dow: 2, label: "Tue" },
  { dow: 3, label: "Wed" },
  { dow: 4, label: "Thu" },
  { dow: 5, label: "Fri" },
  { dow: 6, label: "Sat" },
  { dow: 0, label: "Sun" },
];

/** The pattern the backend assumes from days_per_week alone when no custom rows exist. */
export function defaultWeekSchedule(daysPerWeek: number): WeekSchedule {
  const map: WeekSchedule = {
    0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: false,
  };
  if (daysPerWeek >= 6) map[6] = true;
  if (daysPerWeek >= 7) map[0] = true;
  return map;
}

export function countWorkingDays(ws: WeekSchedule): number {
  return WEEKDAY_ORDER.filter((d) => ws[d.dow]).length;
}

/** True when days_per_week alone reproduces this pattern, so no custom rows are needed. */
export function isDefaultPattern(ws: WeekSchedule): boolean {
  const n = countWorkingDays(ws);
  if (n < 5) return false;
  const def = defaultWeekSchedule(n);
  return WEEKDAY_ORDER.every((d) => !!ws[d.dow] === def[d.dow]);
}

export function formatWeekSchedule(ws: WeekSchedule): string {
  const days = WEEKDAY_ORDER.filter((d) => ws[d.dow]).map((d) => d.label);
  if (days.length === 0) return "No working days";
  if (days.length === 7) return "Every day (7 days/week)";
  if (isDefaultPattern(ws)) return `${days[0]}–${days[days.length - 1]} (${days.length} days/week)`;
  return `${days.join(", ")} (${days.length} day${days.length === 1 ? "" : "s"}/week)`;
}

export function scheduleFromApi(ws: EmployeeWorkSchedule | null, daysPerWeek: number | null | undefined): WeekSchedule {
  if (ws?.has_custom_schedule && ws.days.length > 0) {
    const map: WeekSchedule = {};
    for (const d of ws.days) map[d.day_of_week] = d.is_working;
    return map;
  }
  return defaultWeekSchedule(daysPerWeek ?? 5);
}

function buildScheduleDays(ws: WeekSchedule): WorkScheduleDay[] {
  return [0, 1, 2, 3, 4, 5, 6].map((dow) => ({ day_of_week: dow, is_working: ws[dow] ?? false }));
}

/**
 * Persists the weekday pattern. Standard patterns (Mon–Fri, Mon–Sat, every day)
 * are carried by days_per_week alone; anything else is stored as custom rows.
 * Only clears when custom rows actually exist, so the audit log isn't filled
 * with no-op "cleared" entries.
 */
export async function saveWeekSchedule(employeeId: number, ws: WeekSchedule, hadCustom: boolean): Promise<boolean> {
  if (isDefaultPattern(ws)) {
    if (hadCustom) await hrService.clearEmployeeWorkSchedule(employeeId);
    return false;
  }
  await hrService.updateEmployeeWorkSchedule(employeeId, buildScheduleDays(ws));
  return true;
}

const PRESETS: { label: string; days: number }[] = [
  { label: "Mon–Fri", days: 5 },
  { label: "Mon–Sat", days: 6 },
  { label: "Every day", days: 7 },
];

export function WorkingDaysPicker({
  value,
  onChange,
  hint,
}: {
  value: WeekSchedule;
  onChange: (next: WeekSchedule) => void;
  hint?: React.ReactNode;
}) {
  const count = countWorkingDays(value);
  const sameAs = (days: number) => {
    const def = defaultWeekSchedule(days);
    return WEEKDAY_ORDER.every((d) => !!value[d.dow] === def[d.dow]);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {WEEKDAY_ORDER.map(({ dow, label }) => (
          <button
            key={dow}
            type="button"
            aria-pressed={!!value[dow]}
            onClick={() => onChange({ ...value, [dow]: !value[dow] })}
            className={`h-10 rounded-xl text-xs font-bold border transition-all ${
              value[dow]
                ? "bg-primary text-white border-primary shadow-sm"
                : "bg-zinc-50 dark:bg-zinc-900 text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange(defaultWeekSchedule(p.days))}
            className={`h-7 px-3 rounded-lg text-[11px] font-semibold border transition-colors ${
              sameAs(p.days)
                ? "border-primary text-primary bg-primary/5"
                : "border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`}
          >
            {p.label}
          </button>
        ))}
        <span className={`ml-auto text-xs font-semibold ${count === 0 ? "text-rose-600 dark:text-rose-400" : "text-zinc-500"}`}>
          {count === 0 ? "Pick at least one day" : `${count} day${count === 1 ? "" : "s"} / week`}
        </span>
      </div>
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}
