/** Helpers for changing only the current payroll cycle on a remaining recovery plan. */

function money2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Do not collect this cycle; the original first-slot amount is appended as a new last month. */
export function postponeFirstSlot(schedule: number[]): number[] {
  const amounts = schedule.map(money2);
  if (amounts.length === 0) return amounts;
  const first = amounts[0];
  if (first === 0) return amounts;
  return [0, ...amounts.slice(1), first];
}

/**
 * Set this cycle's amount. Later months keep their values; the last month absorbs
 * the difference so the schedule still sums to `remaining`.
 */
export function setFirstSlotAmount(schedule: number[], remaining: number, nextAmount: number): number[] {
  const remainingRounded = money2(remaining);
  const amount = money2(nextAmount);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Enter a valid amount for this cycle.");
  }
  if (amount > remainingRounded) {
    throw new Error("This cycle cannot be more than the remaining balance.");
  }
  const leftover = money2(remainingRounded - amount);
  if (leftover === 0) return [amount];
  const rest = schedule.slice(1).map(money2);
  if (rest.length === 0) return [amount, leftover];
  const middle = rest.slice(0, -1);
  const middleSum = money2(middle.reduce((sum, value) => sum + value, 0));
  const last = money2(leftover - middleSum);
  if (last < 0) {
    throw new Error("This cycle is too high to leave later months at their current amounts.");
  }
  return [amount, ...middle, last];
}
