"use client";

import { useEffect, useMemo, useState } from "react";
import { attendanceService } from "@/lib/attendance.service";

interface Props {
  value: Set<string>;
  onChange: (next: Set<string>) => void;
  existingOverrideDates?: Set<string>;
  /** When set, tiles are tinted rose (off day) / emerald (working day) for this
   *  employee's actual resolved schedule (weekend, holiday override, etc.) for
   *  the visible month. Omit or pass null when multiple/no employees are targeted. */
  employeeId?: number | null;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Calendar months for the view-month dropdown: a year back through 6 months ahead. */
function buildViewMonthOptions(): { value: string; label: string }[] {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  for (let offset = -12; offset <= 6; offset++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    options.push({ value, label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` });
  }
  return options;
}

export function MultiSelectMonthCalendar({ value, onChange, existingOverrideDates, employeeId }: Props) {
  const [viewMonth, setViewMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const viewMonthOptions = useMemo(() => buildViewMonthOptions(), []);

  const [dayTypes, setDayTypes] = useState<Map<string, { isWorkingDay: boolean; description: string | null }>>(new Map());

  useEffect(() => {
    if (employeeId == null) {
      setDayTypes(new Map());
      return;
    }
    const [y, m] = viewMonth.split("-").map(Number);
    const dateFrom = `${viewMonth}-01`;
    const dateTo = `${viewMonth}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
    let cancelled = false;
    attendanceService
      .getStaffTimeline(employeeId, { date_from: dateFrom, date_to: dateTo })
      .then((timeline) => {
        if (cancelled) return;
        const map = new Map<string, { isWorkingDay: boolean; description: string | null }>();
        for (const day of timeline.days) {
          if (day.is_working_day == null) continue;
          map.set(day.date.slice(0, 10), {
            isWorkingDay: day.is_working_day,
            description: day.day_description ?? day.day_type ?? null,
          });
        }
        setDayTypes(map);
      })
      .catch(() => {
        if (!cancelled) setDayTypes(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, viewMonth]);

  const monthGrid = useMemo(() => {
    const [y, m] = viewMonth.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const last = new Date(Date.UTC(y, m, 0));
    const startPad = (first.getUTCDay() + 6) % 7;
    const daysInMonth = last.getUTCDate();
    const cells: { key: string; label: number }[] = [];
    for (let i = 0; i < startPad; i++) cells.push({ key: `pad-${i}`, label: 0 });
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ key, label: d });
    }
    return cells;
  }, [viewMonth]);

  const toggleDay = (key: string) => {
    const next = new Set(value);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold text-zinc-400 uppercase">Select day(s)</h4>
        <select
          value={viewMonth}
          onChange={(e) => setViewMonth(e.target.value)}
          className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm"
        >
          {viewMonthOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-bold text-zinc-400 uppercase">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {monthGrid.map((cell) => {
          if (cell.label === 0) return <div key={cell.key} className="h-10" />;

          const dayInfo = dayTypes.get(cell.key);
          const isSelected = value.has(cell.key);
          const isToday = cell.key === todayKey;

          let colorCls: string;
          if (isSelected) {
            colorCls = "bg-primary text-white border-primary";
          } else if (dayInfo && !dayInfo.isWorkingDay) {
            colorCls =
              "bg-rose-50 border-rose-200 text-rose-700 hover:border-rose-400 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-300";
          } else if (dayInfo && dayInfo.isWorkingDay) {
            colorCls =
              "bg-emerald-50 border-emerald-200 text-emerald-700 hover:border-emerald-400 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-300";
          } else if (isToday) {
            colorCls = "border-primary/50 text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-900";
          } else {
            colorCls =
              "bg-zinc-50 border-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:border-zinc-800 hover:border-primary/40";
          }

          return (
            <button
              type="button"
              key={cell.key}
              onClick={() => toggleDay(cell.key)}
              title={
                [
                  dayInfo ? (dayInfo.isWorkingDay ? "Working day" : dayInfo.description ?? "Off day") : null,
                  existingOverrideDates?.has(cell.key) ? "Already has an override" : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined
              }
              className={`relative h-10 rounded-lg flex items-center justify-center text-xs font-semibold border transition-colors ${colorCls}`}
            >
              {cell.label}
              {existingOverrideDates?.has(cell.key) && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" />
              )}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4 mt-3 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-primary" /> Selected
        </span>
        {employeeId != null && (
          <>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/40" /> Working day
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-rose-50 border border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/40" /> Off day
            </span>
          </>
        )}
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Existing override
        </span>
      </div>
    </div>
  );
}
