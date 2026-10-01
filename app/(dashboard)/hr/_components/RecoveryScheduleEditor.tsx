"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  cycleDelta,
  cycleIsAfter,
  cycleToMonthValue,
  formatCycle,
  monthValueToCycle,
  nextCollectionCycle,
  periodStartIso,
  remainingCycleLabels,
  shiftCycle,
  type CycleKey,
} from "./payroll-cycle";

export { remainingCycleLabels } from "./payroll-cycle";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MAX_MONTHS = 120;

const amountInputCls =
  "w-32 h-9 px-2.5 text-right text-[13px] font-semibold text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

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

/** Picked payroll months ("YYYY-MM", named by the cycle's ending month) → amount as typed. */
export type MonthAmounts = Record<string, string>;

function sortedKeys(value: MonthAmounts): string[] {
  return Object.keys(value).sort();
}

/** Equal split of `total` across the given months (last one absorbs leftover cents). */
export function splitAcrossMonths(total: number, keys: string[]): MonthAmounts {
  const ordered = [...keys].sort();
  const parts = buildEqualSchedule(total, ordered.length);
  return Object.fromEntries(ordered.map((key, i) => [key, (parts[i] ?? 0).toFixed(2)]));
}

/** Seed a picker from a stored schedule whose first slot is `start` (0 = skipped cycle). */
export function scheduleToMonthAmounts(amounts: number[], start: CycleKey): MonthAmounts {
  const out: MonthAmounts = {};
  amounts.forEach((amount, i) => {
    if (money2(amount) > 0) out[cycleToMonthValue(shiftCycle(start, i))] = money2(amount).toFixed(2);
  });
  return out;
}

/**
 * Picked months → consecutive per-cycle amounts, unpicked months in between as 0.
 * With `from` the schedule starts there (leading skips); otherwise at the first picked month.
 */
export function monthAmountsToSchedule(
  value: MonthAmounts,
  from?: CycleKey,
): { start: CycleKey; amounts: number[] } | null {
  const keys = sortedKeys(value);
  if (keys.length === 0) return null;
  const first = monthValueToCycle(keys[0]);
  const last = monthValueToCycle(keys[keys.length - 1]);
  if (!first || !last) return null;
  const start = from ?? first;
  const length = cycleDelta(start, last) + 1;
  if (length < 1 || length > MAX_MONTHS) return null;
  const amounts = Array.from({ length }, (_, i) => {
    const raw = value[cycleToMonthValue(shiftCycle(start, i))];
    return raw === undefined ? 0 : money2(Number(raw));
  });
  return { start, amounts };
}

/** Create-plan request fields for the picked months, or null when nothing usable is picked. */
export function monthPlanCreatePayload(value: MonthAmounts): {
  start_period_start: string;
  installment_count: number;
  installment_amounts: number[];
} | null {
  const schedule = monthAmountsToSchedule(value);
  if (!schedule) return null;
  return {
    start_period_start: periodStartIso(schedule.start),
    installment_count: schedule.amounts.length,
    installment_amounts: schedule.amounts,
  };
}

export interface MonthScheduleCheck {
  sum: number;
  difference: number;
  ok: boolean;
  /** Why the schedule cannot be saved yet, when it can't. */
  problem: string | null;
}

export function checkMonthAmounts(value: MonthAmounts, total: number, from?: CycleKey): MonthScheduleCheck {
  const target = money2(total);
  const parsed = Object.values(value).map((raw) => money2(Number(raw)));
  const sum = money2(parsed.reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0));
  const difference = money2(sum - target);
  let problem: string | null = null;
  if (parsed.length === 0) problem = "Pick at least one month.";
  else if (parsed.some((n) => !Number.isFinite(n) || n <= 0)) problem = "Every picked month needs an amount above zero — unpick a month to skip it.";
  else if (!monthAmountsToSchedule(value, from)) problem = `A plan can span at most ${MAX_MONTHS} months.`;
  else if (difference !== 0) problem = `Monthly amounts must add up to ${formatPkr(target)}.`;
  return { sum, difference, ok: problem === null, problem };
}

/** "26 Aug – 25 Sep" for the cycle named September. */
function cycleWindow(cycle: CycleKey): string {
  const prev = shiftCycle(cycle, -1);
  return `26 ${SHORT_MONTHS[prev.month - 1]} – 25 ${SHORT_MONTHS[cycle.month - 1]}`;
}

/**
 * Month-by-month breakdown picker, same idea as the student installment modal:
 * click the payroll months to collect in, the total splits equally across them,
 * and each month's amount can then be adjusted. Months left unpicked between the
 * first and last are skipped cycles (nothing deducted).
 */
export function PayrollMonthPicker({
  total,
  value,
  onChange,
  minMonth,
  totalLabel = "total",
}: {
  /** What the picked months must add up to. */
  total: number;
  value: MonthAmounts;
  onChange: (next: MonthAmounts) => void;
  /** Earliest cycle that can be picked. */
  minMonth: CycleKey;
  totalLabel?: string;
}) {
  const keys = sortedKeys(value);
  const firstPicked = keys.length ? monthValueToCycle(keys[0]) : null;
  const [viewYear, setViewYear] = useState((firstPicked ?? minMonth).year);
  const maxMonth = shiftCycle(minMonth, MAX_MONTHS - 1);
  const target = money2(total);
  const check = checkMonthAmounts(value, total);

  // Earliest month moved (another employee picked) — bring it into view.
  useEffect(() => {
    if (keys.length === 0) setViewYear(minMonth.year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minMonth.year, minMonth.month]);

  // A new total re-splits the months already picked, like the installment modal.
  const lastTotal = useRef(target);
  useEffect(() => {
    if (lastTotal.current === target) return;
    lastTotal.current = target;
    if (keys.length > 0 && target > 0) onChange(splitAcrossMonths(target, keys));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const toggle = (cycle: CycleKey) => {
    const key = cycleToMonthValue(cycle);
    const nextKeys = value[key] !== undefined ? keys.filter((k) => k !== key) : [...keys, key];
    onChange(splitAcrossMonths(target > 0 ? target : 0, nextKeys));
  };

  const setAmount = (key: string, raw: string) => onChange({ ...value, [key]: raw });

  const pickNext = (count: number) => {
    const from = firstPicked && !cycleIsAfter(minMonth, firstPicked) ? firstPicked : minMonth;
    const nextKeys = Array.from({ length: count }, (_, i) => cycleToMonthValue(shiftCycle(from, i)));
    onChange(splitAcrossMonths(target > 0 ? target : 0, nextKeys));
    setViewYear(from.year);
  };

  const perMonth = keys.length > 0 && target > 0 ? Math.floor((target * 100) / keys.length) / 100 : null;
  const lastCycle = keys.length ? monthValueToCycle(keys[keys.length - 1]) : null;
  const span = firstPicked && lastCycle ? cycleDelta(firstPicked, lastCycle) + 1 : 0;
  const skippedBetween = span - keys.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Recovery months</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Click the payroll months to deduct in. The {totalLabel} splits equally; adjust any month below.
          </p>
        </div>
        <div className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-1.5 text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Per month</p>
          <p className="text-sm font-extrabold text-primary">{perMonth != null ? formatPkr(perMonth) : "—"}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[3, 6, 12].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => pickNext(n)}
            className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            {n} months
          </button>
        ))}
        {keys.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => onChange(splitAcrossMonths(target, keys))}
              className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Split equally
            </button>
            <button
              type="button"
              onClick={() => onChange({})}
              className="h-8 px-2.5 rounded-lg text-xs font-bold text-zinc-500 hover:text-rose-600"
            >
              Clear
            </button>
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="Earlier years"
            onClick={() => setViewYear((y) => y - 1)}
            disabled={viewYear <= minMonth.year}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Later years"
            onClick={() => setViewYear((y) => y + 1)}
            disabled={viewYear + 1 >= maxMonth.year}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[viewYear, viewYear + 1].map((year) => (
          <div key={year} className="rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
            <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-100 dark:border-zinc-800">
              <p className="text-xs font-extrabold text-zinc-700 dark:text-zinc-300">{year}</p>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-4 gap-1.5 p-2.5">
              {SHORT_MONTHS.map((name, i) => {
                const cycle = { year, month: i + 1 };
                const key = cycleToMonthValue(cycle);
                const selected = value[key] !== undefined;
                const disabled = !selected && (cycleIsAfter(minMonth, cycle) || cycleIsAfter(cycle, maxMonth));
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={disabled}
                    aria-pressed={selected}
                    title={`${formatCycle(cycle)} payroll (${cycleWindow(cycle)})`}
                    onClick={() => toggle(cycle)}
                    className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                      selected
                        ? "bg-primary text-white shadow-sm shadow-primary/20"
                        : disabled
                          ? "bg-transparent text-zinc-300 dark:text-zinc-700 cursor-not-allowed"
                          : "bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-100 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {keys.length > 0 && (
        <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800">
          <div className="px-3 py-2 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Breakdown · {keys.length} month{keys.length === 1 ? "" : "s"}
            </p>
            {skippedBetween > 0 && (
              <p className="text-[11px] text-zinc-400">
                {skippedBetween} month{skippedBetween === 1 ? "" : "s"} in between skipped
              </p>
            )}
          </div>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-72 overflow-y-auto">
            {keys.map((key) => {
              const cycle = monthValueToCycle(key)!;
              return (
                <li key={key} className="flex items-center gap-3 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{formatCycle(cycle)}</p>
                    <p className="text-[11px] text-zinc-400">{cycleWindow(cycle)}</p>
                  </div>
                  <input
                    aria-label={`Amount for ${formatCycle(cycle)}`}
                    className={amountInputCls}
                    inputMode="decimal"
                    value={value[key]}
                    onChange={(e) => setAmount(key, e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${formatCycle(cycle)}`}
                    onClick={() => toggle(cycle)}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          <p
            className={`px-3 py-2 border-t border-zinc-100 dark:border-zinc-800 text-xs font-semibold ${
              check.ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600"
            }`}
          >
            Sum {formatPkr(check.sum)} of {formatPkr(target)}
            {check.ok
              ? " ✓"
              : check.difference !== 0 && Number.isFinite(check.difference)
                ? ` (${check.difference > 0 ? "+" : ""}${formatPkr(check.difference)})`
                : ""}
          </p>
        </div>
      )}
    </div>
  );
}

export function RemainingScheduleList({
  amounts,
  caption,
  startPeriodStart,
  startIsExact,
}: {
  amounts: number[];
  caption?: string;
  startPeriodStart?: string;
  /** `startPeriodStart` is already the exact first cycle to collect (not just the plan start). */
  startIsExact?: boolean;
}) {
  if (!amounts.length) return null;
  const labels = remainingCycleLabels(startPeriodStart, amounts.length, startIsExact);
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

interface RecoveryScheduleEditorProps {
  remaining: number;
  initialAmounts: number[];
  startPeriodStart?: string;
  /** `startPeriodStart` is already the exact first cycle to collect (not just the plan start). */
  startIsExact?: boolean;
  saving?: boolean;
  submitLabel?: string;
  onSubmit: (amounts: number[]) => void | Promise<void>;
  onCancel?: () => void;
}

export function RecoveryScheduleEditor({
  remaining,
  initialAmounts,
  startPeriodStart,
  startIsExact,
  saving,
  submitLabel = "Save recovery plan",
  onSubmit,
  onCancel,
}: RecoveryScheduleEditorProps) {
  const remainingRounded = money2(remaining);
  const minFrom = nextCollectionCycle(startPeriodStart, startIsExact);
  const [months, setMonths] = useState<MonthAmounts>(() => {
    const seeded = scheduleToMonthAmounts(initialAmounts, minFrom);
    return Object.keys(seeded).length > 0 ? seeded : splitAcrossMonths(remainingRounded, [cycleToMonthValue(minFrom)]);
  });
  const check = checkMonthAmounts(months, remainingRounded, minFrom);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!check.ok || saving) return;
    // The server's schedule always starts at the next collection cycle, so
    // months skipped before the first pick go in as leading zeros.
    const schedule = monthAmountsToSchedule(months, minFrom);
    if (schedule) await onSubmit(schedule.amounts);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <PayrollMonthPicker
        total={remainingRounded}
        value={months}
        onChange={setMonths}
        minMonth={minFrom}
        totalLabel="remaining balance"
      />
      {!check.ok && check.problem && <p className="text-xs font-semibold text-rose-600">{check.problem}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving || !check.ok}
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
