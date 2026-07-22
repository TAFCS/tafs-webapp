"use client";

import { useMemo, useState } from "react";

interface Props {
  value: Set<string>;
  onChange: (next: Set<string>) => void;
  existingOverrideDates?: Set<string>;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MultiSelectMonthCalendar({ value, onChange, existingOverrideDates }: Props) {
  const [viewMonth, setViewMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

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
        <input
          type="month"
          value={viewMonth}
          onChange={(e) => setViewMonth(e.target.value)}
          className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm"
        />
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-bold text-zinc-400 uppercase">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {monthGrid.map((cell) =>
          cell.label === 0 ? (
            <div key={cell.key} className="h-10" />
          ) : (
            <button
              type="button"
              key={cell.key}
              onClick={() => toggleDay(cell.key)}
              title={existingOverrideDates?.has(cell.key) ? "Already has an override" : undefined}
              className={`relative h-10 rounded-lg flex items-center justify-center text-xs font-semibold border transition-colors ${
                value.has(cell.key)
                  ? "bg-primary text-white border-primary"
                  : cell.key === todayKey
                    ? "border-primary/50 text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-900"
                    : "bg-zinc-50 border-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:border-zinc-800 hover:border-primary/40"
              }`}
            >
              {cell.label}
              {existingOverrideDates?.has(cell.key) && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" />
              )}
            </button>
          ),
        )}
      </div>
      <div className="flex gap-4 mt-3 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-primary" /> Selected
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Existing override
        </span>
      </div>
    </div>
  );
}
