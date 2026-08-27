"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  clampPayrollRange,
  cycleDelta,
  cycleToMonthValue,
  cyclesInRange,
  formatCycle,
  monthValueToCycle,
  nextCollectionCycle,
  remainingCycleLabels,
  shiftCycle,
  type CycleKey,
} from "./payroll-cycle";

export { remainingCycleLabels } from "./payroll-cycle";

const inputCls =
  "w-full h-10 px-3 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

function money2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatPkr(value: number): string {
  return `Rs. ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Truncated equal split into exactly `count` slots; last month absorbs leftover cents. */
export function buildEqualSchedule(total: number, count: number): number[] {
  const remainingTarget = money2(total);
  if (count < 1) return [];
  if (remainingTarget <= 0) return Array.from({ length: count }, () => 0);
  const base = Math.floor((remainingTarget * 100) / count) / 100;
  const amounts: number[] = [];
  let left = remainingTarget;
  for (let i = 0; i < count; i++) {
    if (i === count - 1) {
      amounts.push(money2(left));
    } else {
      const take = money2(Math.min(Math.max(base, 0), left));
      amounts.push(take);
      left = money2(left - take);
    }
  }
  return amounts;
}

function splitKeepingSkips(total: number, skipped: boolean[]): number[] {
  const activeCount = skipped.filter((isSkipped) => !isSkipped).length;
  if (activeCount === 0) return skipped.map(() => 0);
  const parts = buildEqualSchedule(total, activeCount);
  let index = 0;
  return skipped.map((isSkipped) => (isSkipped ? 0 : parts[index++]));
}

function cycleKey(cycle: CycleKey): string {
  return cycleToMonthValue(cycle);
}

export function RemainingScheduleList({
  amounts,
  caption,
  startPeriodStart,
}: {
  amounts: number[];
  caption?: string;
  startPeriodStart?: string;
}) {
  if (!amounts.length) return null;
  const labels = remainingCycleLabels(startPeriodStart, amounts.length);
  return (
    <div className="mb-4">
      {caption ? <p className="text-xs text-zinc-500 mb-2">{caption}</p> : null}
      <ol className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {amounts.map((amount, index) => (
          <li
            key={index}
            className="flex items-center justify-between text-xs rounded-lg border border-zinc-100 dark:border-zinc-800 px-2.5 py-1.5"
          >
            <span className="text-zinc-500">{labels[index] ?? `Month ${index + 1}`}</span>
            <span className={`font-semibold ${amount === 0 ? "text-zinc-400 italic" : "text-zinc-800 dark:text-zinc-200"}`}>
              {amount === 0 ? "Skip" : formatPkr(amount)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function PayrollRangeFields({
  fromMonth,
  toMonth,
  minMonth,
  onChange,
}: {
  fromMonth: string;
  toMonth: string;
  minMonth?: string;
  onChange: (fromMonth: string, toMonth: string) => void;
}) {
  const range = clampPayrollRange(fromMonth, toMonth, minMonth);
  return (
    <>
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">From</label>
        <input
          type="month"
          className={inputCls}
          min={minMonth}
          value={fromMonth}
          onChange={(e) => {
            const next = clampPayrollRange(e.target.value, toMonth, minMonth);
            if (next) onChange(next.fromValue, next.toValue);
          }}
        />
      </div>
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">To</label>
        <input
          type="month"
          className={inputCls}
          min={fromMonth || minMonth}
          value={toMonth}
          onChange={(e) => {
            const next = clampPayrollRange(fromMonth, e.target.value, minMonth);
            if (next) onChange(next.fromValue, next.toValue);
          }}
        />
      </div>
      {range ? (
        <p className="sm:col-span-2 text-xs text-zinc-500">
          {range.count} payroll cycle{range.count === 1 ? "" : "s"}: {formatCycle(range.from)} - {formatCycle(range.to)} (26th-25th).
          Pick any start and end month; skip individual months below if needed.
        </p>
      ) : null}
    </>
  );
}

interface RecoveryScheduleEditorProps {
  remaining: number;
  initialAmounts: number[];
  startPeriodStart?: string;
  saving?: boolean;
  submitLabel?: string;
  onSubmit: (amounts: number[]) => void | Promise<void>;
  onCancel?: () => void;
}

export function RecoveryScheduleEditor({
  remaining,
  initialAmounts,
  startPeriodStart,
  saving,
  submitLabel = "Save recovery plan",
  onSubmit,
  onCancel,
}: RecoveryScheduleEditorProps) {
  const remainingRounded = money2(remaining);
  const minFrom = nextCollectionCycle(startPeriodStart);
  const seed = initialAmounts.length > 0 ? initialAmounts.map(money2) : buildEqualSchedule(remainingRounded, 1);
  const initialTo = shiftCycle(minFrom, Math.max(0, seed.length - 1));
  const [fromMonth, setFromMonth] = useState(cycleToMonthValue(minFrom));
  const [toMonth, setToMonth] = useState(cycleToMonthValue(initialTo));
  const [skipped, setSkipped] = useState(seed.map((value) => value === 0));
  const [amounts, setAmounts] = useState(seed.map((value) => value.toFixed(2)));

  const applyRange = (nextFromValue: string, nextToValue: string) => {
    const range = clampPayrollRange(nextFromValue, nextToValue, cycleToMonthValue(minFrom));
    if (!range) return;
    const previous = new Map<string, boolean>();
    const previousFrom = monthValueToCycle(fromMonth);
    const previousTo = monthValueToCycle(toMonth);
    const previousCycles = previousFrom && previousTo ? cyclesInRange(previousFrom, previousTo) : [];
    previousCycles.forEach((cycle, index) => {
      previous.set(cycleKey(cycle), skipped[index] ?? false);
    });
    const nextCycles = cyclesInRange(range.from, range.to);
    const nextSkipped = nextCycles.map((cycle) => previous.get(cycleKey(cycle)) ?? false);
    setFromMonth(range.fromValue);
    setToMonth(range.toValue);
    setSkipped(nextSkipped);
    setAmounts(splitKeepingSkips(remainingRounded, nextSkipped).map((value) => value.toFixed(2)));
  };

  const applySplit = () => {
    const flags = amounts.map((value, index) => skipped[index] || money2(Number(value)) === 0);
    const collecting = flags.filter((isSkipped) => !isSkipped).length;
    const nextFlags = collecting === 0 ? flags.map(() => false) : flags;
    setSkipped(nextFlags);
    setAmounts(splitKeepingSkips(remainingRounded, nextFlags).map((value) => value.toFixed(2)));
  };

  const toggleSkip = (index: number) => {
    const collecting = skipped.filter((isSkipped) => !isSkipped).length;
    if (!skipped[index] && collecting <= 1) return;
    const nextFlags = skipped.map((isSkipped, i) => (i === index ? !isSkipped : isSkipped));
    setSkipped(nextFlags);
    setAmounts(splitKeepingSkips(remainingRounded, nextFlags).map((value) => value.toFixed(2)));
  };

  const parsed = useMemo(
    () => amounts.map((value) => money2(Number(value))),
    [amounts],
  );
  const sum = money2(parsed.reduce((acc, value) => acc + value, 0));
  const allValid = parsed.every((value) => Number.isFinite(value) && value >= 0);
  const hasCollecting = parsed.some((value) => value > 0);
  const matches = allValid && hasCollecting && parsed.length >= 1 && parsed.length <= 120 && sum === remainingRounded;
  const difference = money2(sum - remainingRounded);
  const collectingCount = skipped.filter((isSkipped) => !isSkipped).length;
  const range = clampPayrollRange(fromMonth, toMonth, cycleToMonthValue(minFrom));
  const cycleLabels = range ? cyclesInRange(range.from, range.to).map(formatCycle) : [];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!matches || saving || !range) return;
    const selected = parsed.map((value, index) => (skipped[index] ? 0 : value));
    const leadingSkips = Math.max(0, cycleDelta(minFrom, range.from));
    await onSubmit([...Array.from({ length: leadingSkips }, () => 0), ...selected]);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PayrollRangeFields
          fromMonth={fromMonth}
          toMonth={toMonth}
          minMonth={cycleToMonthValue(minFrom)}
          onChange={applyRange}
        />
      </div>
      <button
        type="button"
        onClick={applySplit}
        className="h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold"
      >
        Split equally
      </button>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
        {amounts.map((value, index) => {
          const isSkipped = skipped[index];
          const label = cycleLabels[index] ?? `Month ${index + 1}`;
          return (
            <div key={label}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  {label}
                </label>
                <button
                  type="button"
                  onClick={() => toggleSkip(index)}
                  disabled={!isSkipped && collectingCount <= 1}
                  className="text-[11px] font-bold text-primary disabled:text-zinc-300 disabled:cursor-not-allowed"
                >
                  {isSkipped ? "Collect" : `Skip ${label.split(" ")[0]}`}
                </button>
              </div>
              <input
                className={`${inputCls} ${isSkipped ? "text-zinc-400 italic" : ""}`}
                inputMode="decimal"
                value={isSkipped ? "Skip" : value}
                disabled={isSkipped}
                onChange={(e) => {
                  const next = [...amounts];
                  next[index] = e.target.value;
                  setAmounts(next);
                }}
              />
            </div>
          );
        })}
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
