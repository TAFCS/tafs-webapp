"use client";

import { EmployeeDayTiming } from "@/lib/hr.service";
import { WEEKDAY_ORDER, WeekSchedule } from "./WorkingDaysPicker";

/** TAFSD-363: per-weekday timings, keyed by day_of_week. Empty strings mean "normal timings". */
export type DayTimingsForm = Record<number, { reporting_time: string; leaving_time: string }>;

export function dayTimingsFromApi(days: EmployeeDayTiming[]): DayTimingsForm {
  const form: DayTimingsForm = {};
  for (const d of days) {
    form[d.day_of_week] = { reporting_time: d.reporting_time ?? "", leaving_time: d.leaving_time ?? "" };
  }
  return form;
}

/** Only days that actually differ, for saving. Days that aren't worked are dropped. */
export function dayTimingsToApi(form: DayTimingsForm, week: WeekSchedule): EmployeeDayTiming[] {
  return Object.entries(form)
    .map(([dow, t]) => ({
      day_of_week: Number(dow),
      reporting_time: t.reporting_time || null,
      leaving_time: t.leaving_time || null,
    }))
    .filter((d) => week[d.day_of_week] && (d.reporting_time || d.leaving_time))
    .sort((a, b) => a.day_of_week - b.day_of_week);
}

export function sameDayTimings(a: EmployeeDayTiming[], b: EmployeeDayTiming[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const label = (dow: number) => WEEKDAY_ORDER.find((d) => d.dow === dow)?.label ?? String(dow);

/** "Fri 07:30–12:00, Sat 08:00–13:00", or null when every day uses the normal timings. */
export function formatDayTimings(days: EmployeeDayTiming[], normal?: { reporting_time: string; leaving_time: string }) {
  if (!days.length) return null;
  return days
    .map((d) => `${label(d.day_of_week)} ${d.reporting_time ?? normal?.reporting_time ?? ""}–${d.leaving_time ?? normal?.leaving_time ?? ""}`)
    .join(", ");
}

/** A day whose own times end before they start. */
export function dayTimingsError(form: DayTimingsForm, week: WeekSchedule, normal: { reporting_time: string; leaving_time: string }) {
  for (const d of WEEKDAY_ORDER) {
    const t = form[d.dow];
    if (!week[d.dow] || !t || (!t.reporting_time && !t.leaving_time)) continue;
    const from = t.reporting_time || normal.reporting_time;
    const to = t.leaving_time || normal.leaving_time;
    if (from && to && to <= from) return `${d.label}: leaving time must be after reporting time.`;
  }
  return null;
}

/**
 * One row per working day. A day left on "Normal" uses the reporting and
 * leaving time above; "Own timings" sets that day apart (Friday, usually).
 * Either time can be left blank to keep the normal one for that side.
 */
export function DayTimingsEditor({
  value,
  onChange,
  week,
  normal,
  disabled,
}: {
  value: DayTimingsForm;
  onChange: (next: DayTimingsForm) => void;
  week: WeekSchedule;
  normal: { reporting_time: string; leaving_time: string };
  disabled?: boolean;
}) {
  const days = WEEKDAY_ORDER.filter((d) => week[d.dow]);
  const set = (dow: number, patch: Partial<{ reporting_time: string; leaving_time: string }>) => {
    const cur = value[dow] ?? { reporting_time: "", leaving_time: "" };
    onChange({ ...value, [dow]: { ...cur, ...patch } });
  };
  const clear = (dow: number) => {
    const next = { ...value };
    delete next[dow];
    onChange(next);
  };
  const timeCls =
    "h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-sm tabular-nums disabled:opacity-50";

  return (
    <div className="space-y-1.5">
      {days.map(({ dow, label: dayLabel }) => {
        const own = value[dow] !== undefined;
        return (
          <div key={dow} className="grid grid-cols-[3rem_1fr] sm:grid-cols-[3rem_8rem_1fr_1fr_auto] items-center gap-2">
            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">{dayLabel}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => (own ? clear(dow) : set(dow, {}))}
              aria-pressed={own}
              className={`h-8 rounded-lg text-[11px] font-semibold border transition-colors ${
                own
                  ? "border-primary text-primary bg-primary/5"
                  : "border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              {own ? "Own timings" : "Normal"}
            </button>
            {own ? (
              <>
                <input
                  type="time"
                  aria-label={`${dayLabel} reporting time`}
                  className={timeCls}
                  disabled={disabled}
                  placeholder={normal.reporting_time}
                  value={value[dow].reporting_time}
                  onChange={(e) => set(dow, { reporting_time: e.target.value })}
                />
                <input
                  type="time"
                  aria-label={`${dayLabel} leaving time`}
                  className={timeCls}
                  disabled={disabled}
                  placeholder={normal.leaving_time}
                  value={value[dow].leaving_time}
                  onChange={(e) => set(dow, { leaving_time: e.target.value })}
                />
                <span className="hidden sm:block text-[11px] text-zinc-400 whitespace-nowrap">blank = normal</span>
              </>
            ) : (
              <span className="sm:col-span-3 text-xs text-zinc-400 tabular-nums">
                {normal.reporting_time && normal.leaving_time ? `${normal.reporting_time}–${normal.leaving_time}` : "—"}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
