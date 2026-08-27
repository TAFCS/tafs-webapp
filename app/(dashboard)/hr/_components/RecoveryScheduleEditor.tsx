"use client";

import { FormEvent, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";

const inputCls =
  "w-full h-10 px-3 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

function money2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatPkr(value: number): string {
  return `Rs. ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Truncated equal split; last month absorbs leftover cents. Matches backend create/edit helper. */
export function buildEqualSchedule(total: number, count: number): number[] {
  const remainingTarget = money2(total);
  if (count < 1 || remainingTarget <= 0) return [];
  const base = Math.floor((remainingTarget * 100) / count) / 100;
  if (base <= 0) return [];
  const amounts: number[] = [];
  let left = remainingTarget;
  for (let i = 0; i < count; i++) {
    if (i === count - 1) {
      amounts.push(money2(left));
    } else {
      const take = money2(Math.min(base, left));
      amounts.push(take);
      left = money2(left - take);
    }
  }
  return amounts.filter((n) => n > 0);
}

export function RemainingScheduleList({
  amounts,
  caption,
}: {
  amounts: number[];
  caption?: string;
}) {
  if (!amounts.length) return null;
  return (
    <div className="mb-4">
      {caption ? <p className="text-xs text-zinc-500 mb-2">{caption}</p> : null}
      <ol className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {amounts.map((amount, index) => (
          <li
            key={index}
            className="flex items-center justify-between text-xs rounded-lg border border-zinc-100 dark:border-zinc-800 px-2.5 py-1.5"
          >
            <span className="text-zinc-500">Month {index + 1}</span>
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{formatPkr(amount)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

interface RecoveryScheduleEditorProps {
  remaining: number;
  initialAmounts: number[];
  saving?: boolean;
  submitLabel?: string;
  onSubmit: (amounts: number[]) => void | Promise<void>;
  onCancel?: () => void;
}

export function RecoveryScheduleEditor({
  remaining,
  initialAmounts,
  saving,
  submitLabel = "Save recovery plan",
  onSubmit,
  onCancel,
}: RecoveryScheduleEditorProps) {
  const remainingRounded = money2(remaining);
  const seed = initialAmounts.length > 0 ? initialAmounts.map(money2) : buildEqualSchedule(remainingRounded, 1);
  const [monthCount, setMonthCount] = useState(String(Math.max(1, seed.length)));
  const [amounts, setAmounts] = useState(seed.map((value) => value.toFixed(2)));

  const applyCount = (count: number) => {
    const next = Math.min(120, Math.max(1, count));
    setMonthCount(String(next));
    setAmounts(buildEqualSchedule(remainingRounded, next).map((value) => value.toFixed(2)));
  };

  const parsed = useMemo(
    () => amounts.map((value) => money2(Number(value))),
    [amounts],
  );
  const sum = money2(parsed.reduce((acc, value) => acc + value, 0));
  const allPositive = parsed.every((value) => Number.isFinite(value) && value > 0);
  const matches = allPositive && parsed.length >= 1 && parsed.length <= 120 && sum === remainingRounded;
  const difference = money2(sum - remainingRounded);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!matches || saving) return;
    await onSubmit(parsed);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
            Remaining months
          </label>
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => applyCount(Number(monthCount || 1) - 1)}
              className="h-10 w-10 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-center"
              aria-label="Fewer months"
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              className={`${inputCls} w-16 text-center`}
              inputMode="numeric"
              value={monthCount}
              onChange={(e) => {
                const raw = e.target.value;
                setMonthCount(raw);
                const count = Number(raw);
                if (Number.isInteger(count) && count >= 1 && count <= 120) {
                  setAmounts(buildEqualSchedule(remainingRounded, count).map((value) => value.toFixed(2)));
                }
              }}
            />
            <button
              type="button"
              onClick={() => applyCount(Number(monthCount || 1) + 1)}
              className="h-10 w-10 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-center"
              aria-label="More months"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => applyCount(Number(monthCount) || seed.length || 1)}
          className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold"
        >
          Split equally
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
        {amounts.map((value, index) => (
          <div key={index}>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
              Month {index + 1}
            </label>
            <input
              className={inputCls}
              inputMode="decimal"
              value={value}
              onChange={(e) => {
                const next = [...amounts];
                next[index] = e.target.value;
                setAmounts(next);
              }}
            />
          </div>
        ))}
      </div>

      <p className={`text-xs ${matches ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600"}`}>
        Sum {formatPkr(sum)} of remaining {formatPkr(remainingRounded)}
        {!matches && Number.isFinite(difference) ? ` (${difference > 0 ? "+" : ""}${formatPkr(difference)})` : "."}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving || !matches}
          className="h-9 px-3 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-60"
        >
          {saving ? "Saving..." : submitLabel}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="h-9 px-3 rounded-xl border text-xs font-bold">
            Back
          </button>
        ) : null}
      </div>
    </form>
  );
}
