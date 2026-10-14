import type { CycleTenure } from "@/lib/hr.service";

/**
 * Mirrors offRollReason in tafs-backend tenure-window.util.ts: a day outside
 * every tenure window is "not on roll" — payroll prorates it away, so the
 * matrix must not read it as an absence.
 */
export type OffRollReason = "BEFORE_JOIN" | "AFTER_LEAVE" | "BETWEEN_TENURES";

export function offRollReason(date: string, tenure: CycleTenure | undefined): OffRollReason | null {
  if (!tenure) return null;
  const { windows } = tenure;
  if (windows.length === 0) return "BEFORE_JOIN";
  if (windows.some((w) => date >= w.start && date <= w.end)) return null;
  if (date < windows[0].start) return "BEFORE_JOIN";
  if (date > windows[windows.length - 1].end) return "AFTER_LEAVE";
  return "BETWEEN_TENURES";
}

export const OFF_ROLL_LABEL: Record<OffRollReason, string> = {
  BEFORE_JOIN: "Not joined",
  AFTER_LEAVE: "Left",
  BETWEEN_TENURES: "Off roll",
};

/** "12 Oct" — the cycle is at most ~31 days, so the year adds nothing. */
export function shortDate(ymd: string): string {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** One sentence for tooltips: how much of the cycle counts, and why. */
export function tenureSummary(tenure: CycleTenure): string {
  return `On roll ${tenure.in_tenure_days} of ${tenure.period_days} days this cycle. Days before joining or after leaving aren't counted here or in payroll.`;
}
