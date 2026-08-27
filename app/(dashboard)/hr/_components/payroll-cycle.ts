export interface CycleKey {
  year: number;
  month: number;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Payroll cycle containing today - same 26th-25th rule as the backend. */
export function currentCycleKey(date = new Date()): CycleKey {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  if (day >= 26) return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return { year, month };
}

export function cycleKeyFromPeriodStart(iso: string): CycleKey {
  const stamp = iso.slice(0, 10);
  const year = Number(stamp.slice(0, 4));
  const month = Number(stamp.slice(5, 7));
  const day = Number(stamp.slice(8, 10));
  if (day >= 26) return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return { year, month };
}

export function cycleIsAfter(a: CycleKey, b: CycleKey): boolean {
  return a.year > b.year || (a.year === b.year && a.month > b.month);
}

export function cycleEquals(a: CycleKey, b: CycleKey): boolean {
  return a.year === b.year && a.month === b.month;
}

export function shiftCycle({ year, month }: CycleKey, delta: number): CycleKey {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

export function cycleDelta(from: CycleKey, to: CycleKey): number {
  return to.year * 12 + to.month - (from.year * 12 + from.month);
}

export function cycleCount(from: CycleKey, to: CycleKey): number {
  return cycleDelta(from, to) + 1;
}

export function formatCycle(cycle: CycleKey): string {
  return `${MONTHS[cycle.month - 1]} ${cycle.year}`;
}

export function cycleToMonthValue({ year, month }: CycleKey): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function monthValueToCycle(value: string): CycleKey | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

/** Period start date (the 26th) for a cycle named by its ending month. */
export function periodStartIso(cycle: CycleKey): string {
  return new Date(Date.UTC(cycle.year, cycle.month - 2, 26)).toISOString().slice(0, 10);
}

export function nextCollectionCycle(startPeriodStart?: string): CycleKey {
  const current = currentCycleKey();
  const plan = startPeriodStart ? cycleKeyFromPeriodStart(startPeriodStart) : current;
  return cycleIsAfter(plan, current) ? plan : current;
}

export function cyclesInRange(from: CycleKey, to: CycleKey): CycleKey[] {
  const count = cycleCount(from, to);
  if (count < 1) return [];
  return Array.from({ length: Math.min(count, 120) }, (_, index) => shiftCycle(from, index));
}

export function remainingCycleLabels(startPeriodStart: string | undefined, count: number): string[] {
  if (count < 1) return [];
  const start = nextCollectionCycle(startPeriodStart);
  return Array.from({ length: count }, (_, index) => formatCycle(shiftCycle(start, index)));
}

export interface ClampedPayrollRange {
  from: CycleKey;
  to: CycleKey;
  fromValue: string;
  toValue: string;
  count: number;
}

export function clampPayrollRange(
  fromValue: string,
  toValue: string,
  minValue?: string,
): ClampedPayrollRange | null {
  const parsedFrom = monthValueToCycle(fromValue);
  const parsedTo = monthValueToCycle(toValue);
  if (!parsedFrom || !parsedTo) return null;
  const min = minValue ? monthValueToCycle(minValue) : null;
  let from = parsedFrom;
  if (min && cycleIsAfter(min, from)) from = min;
  let to = parsedTo;
  if (cycleIsAfter(from, to)) to = from;
  let count = cycleCount(from, to);
  if (count > 120) {
    to = shiftCycle(from, 119);
    count = 120;
  }
  return {
    from,
    to,
    fromValue: cycleToMonthValue(from),
    toValue: cycleToMonthValue(to),
    count,
  };
}

export function defaultPayrollRange(periodStartIsoValue?: string, length = 5): { fromMonth: string; toMonth: string } {
  const from = periodStartIsoValue ? cycleKeyFromPeriodStart(periodStartIsoValue) : currentCycleKey();
  const to = shiftCycle(from, Math.max(0, length - 1));
  return { fromMonth: cycleToMonthValue(from), toMonth: cycleToMonthValue(to) };
}

export function payrollRangeCreatePayload(fromMonth: string, toMonth: string): {
  start_period_start: string;
  installment_count: number;
} | null {
  const range = clampPayrollRange(fromMonth, toMonth);
  if (!range || range.count < 1) return null;
  return {
    start_period_start: periodStartIso(range.from),
    installment_count: range.count,
  };
}
