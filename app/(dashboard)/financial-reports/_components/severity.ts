/**
 * Severity bands for the Defaulters report.
 *
 * Mirrors tafs-backend/src/modules/financial-reports/defaulter-severity.ts.
 * Keep the two in sync — the backend decides the band, this decides how it looks.
 *
 * A student appears on this report only if their voucher situation says so:
 *  ARREARS  — an active voucher already carries real, previously-charged
 *             arrears (voucher_arrear_surcharges rows). months_behind counts
 *             distinct arrear months, which is also the number of Rs 1,000
 *             surcharges already charged on it. DEFAULTER (2 months) is the
 *             school's escalation threshold.
 *  EXPIRING — a single-fee_date voucher (no bundled arrears) whose own
 *             status is EXPIRED — not an arrear yet, but about to become one
 *             the moment the next voucher rolls it forward. months_behind is
 *             always 0 for this category, and it is deliberately kept
 *             outside the WATCH..CRITICAL ramp — it is a warning, not a
 *             severity level.
 *
 * Colour is never the only channel: every band is rendered alongside its
 * numeric months-behind (or "Expiring"), and the row carries a left border
 * accent as well as a tint, because the WATCH/DEFAULTER tints are hard to
 * tell apart in dark mode.
 */

export type SeverityBand = "EXPIRING" | "WATCH" | "DEFAULTER" | "SEVERE" | "CRITICAL";

export type SeverityBandSpec = {
  id: SeverityBand;
  label: string;
  monthsLabel: string;
  /** Stat-tile and chip surface. */
  chip: string;
  /** Row tint + left accent. */
  row: string;
  /** Solid fill for the stacked distribution bar. */
  bar: string;
  /** Text-only accent for counts. */
  text: string;
};

export const SEVERITY_BANDS: SeverityBandSpec[] = [
  {
    id: "EXPIRING",
    label: "Expiring",
    monthsLabel: "not an arrear yet",
    // Blue/slate, deliberately outside the red WATCH..CRITICAL ramp — this is
    // an early warning, not a severity level.
    chip: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
    row: "border-l-4 border-l-sky-300 dark:border-l-sky-700/70 bg-sky-50/40 dark:bg-sky-950/10",
    bar: "bg-sky-300 dark:bg-sky-600",
    text: "text-sky-600 dark:text-sky-400",
  },
  {
    id: "WATCH",
    label: "Watch",
    monthsLabel: "1 month",
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    row: "border-l-4 border-l-amber-300 dark:border-l-amber-700/70 bg-amber-50/40 dark:bg-amber-950/10",
    bar: "bg-amber-300 dark:bg-amber-600",
    text: "text-amber-600 dark:text-amber-400",
  },
  {
    id: "DEFAULTER",
    label: "Defaulter",
    monthsLabel: "2 months",
    chip: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
    row: "border-l-4 border-l-red-400 dark:border-l-red-600 bg-red-50/50 dark:bg-red-950/15",
    bar: "bg-red-400 dark:bg-red-600",
    text: "text-red-600 dark:text-red-400",
  },
  {
    id: "SEVERE",
    label: "Severe",
    monthsLabel: "3 months",
    chip: "bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-200",
    row: "border-l-4 border-l-red-600 dark:border-l-red-500 bg-red-100/60 dark:bg-red-950/30",
    bar: "bg-red-600 dark:bg-red-500",
    text: "text-red-700 dark:text-red-300",
  },
  {
    id: "CRITICAL",
    label: "Critical",
    monthsLabel: "4+ months",
    chip: "bg-red-700 text-red-50 dark:bg-red-800 dark:text-red-50",
    row: "border-l-4 border-l-red-800 dark:border-l-red-400 bg-red-200/50 dark:bg-red-950/50",
    bar: "bg-red-800 dark:bg-red-400",
    text: "text-red-800 dark:text-red-300",
  },
];

export const SEVERITY_BY_ID: Record<SeverityBand, SeverityBandSpec> =
  Object.fromEntries(SEVERITY_BANDS.map((b) => [b.id, b])) as Record<
    SeverityBand,
    SeverityBandSpec
  >;

/** Payment-strip cell colours, keyed by state. */
export const STRIP_STATE = {
  not_billed: "bg-zinc-100 dark:bg-zinc-800/60",
  paid: "bg-emerald-400 dark:bg-emerald-600",
  partial: "bg-amber-400 dark:bg-amber-500",
  unpaid: "bg-zinc-300 dark:bg-zinc-600",
} as const;

/**
 * A month actually recorded as an arrear on the voucher ledger — NOT merely
 * "unpaid and dated before as_of". A head can be unpaid and in the past yet
 * never have been rolled into a voucher as an arrear (one month of a
 * whole-year advance bill that hasn't been superseded yet); that renders
 * STRIP_STATE.unpaid (grey), not red.
 */
export const STRIP_ARREAR = "bg-red-500 dark:bg-red-500";

export type StripCellState = keyof typeof STRIP_STATE;
