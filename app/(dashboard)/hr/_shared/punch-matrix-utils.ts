/**
 * Pure helpers shared by the two punch-card matrices (PayrollMatrixView for
 * employees, StudentPunchMatrixView for students). They render one cell per
 * person per day, so anything called per punch here runs thousands of times
 * per render — keep it allocation-free.
 */

/**
 * One shared formatter instead of a fresh options object per call.
 * Constructing an Intl.DateTimeFormat is the expensive part of
 * `toLocaleTimeString`, and the matrix calls this 2–8 times per cell.
 */
const TIME_FMT = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export function fmtISO(iso: string | null | undefined): string {
  if (!iso) return "—";
  return TIME_FMT.format(new Date(iso));
}

export function fmtSegT(t: string): string {
  if (t === "00:00" || t === "24:00") return t;
  return TIME_FMT.format(new Date(t));
}

export function generateDates(start: string, end: string): string[] {
  const dates: string[] = [];
  const d = new Date(`${start.slice(0, 10)}T00:00:00Z`);
  const e = new Date(`${end.slice(0, 10)}T00:00:00Z`);
  while (d <= e) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

/** Minimal structural shape both DayBreakdownEntry types satisfy. */
export interface PunchDay {
  check_in_at: string | null;
  check_out_at: string | null;
  segments?: { type: string; start: string; end: string; isMissingOut?: boolean }[];
}

export interface Punch {
  time: string;
  missing?: boolean;
}

export function extractPunches(day: PunchDay): Punch[] {
  const segs = day.segments ?? [];
  if (segs.length === 0) {
    const result: Punch[] = [];
    if (day.check_in_at) result.push({ time: fmtISO(day.check_in_at) });
    if (day.check_out_at) result.push({ time: fmtISO(day.check_out_at) });
    else if (day.check_in_at) result.push({ time: "?", missing: true });
    return result;
  }

  const result: Punch[] = [];
  const workSegs = segs.filter((s) => s.type === "WORK");

  workSegs.forEach((w) => {
    result.push({ time: fmtSegT(w.start) });
    if (w.isMissingOut) {
      result.push({ time: "?", missing: true });
    } else {
      result.push({ time: fmtSegT(w.end) });
    }
  });

  return result;
}

/** Day-of-week header labels, indexed by `Date#getUTCDay()`. */
export const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export const MATRIX_PAGE_SIZES = [25, 50, 100];
export const DEFAULT_MATRIX_PAGE_SIZE = 25;
