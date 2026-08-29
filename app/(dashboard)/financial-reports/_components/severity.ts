/**
 * Severity bands for the Defaulters report.
 *
 * Mirrors tafs-backend/src/modules/financial-reports/defaulter-severity.ts.
 * Keep the two in sync — the backend decides the band, this decides how it looks.
 *
 * A "month behind" is one distinct (academic year, target month) among a
 * student's unpaid heads, which is also the number of Rs 1,000 late payment
 * surcharges their next voucher would carry. DEFAULTER (2 months) is the
 * school's escalation threshold.
 *
 * Colour is never the only channel: every band is rendered alongside its
 * numeric months-behind, and the row carries a left border accent as well as a
 * tint, because the WATCH/DEFAULTER tints are hard to tell apart in dark mode.
 */

export type SeverityBand = "WATCH" | "DEFAULTER" | "SEVERE" | "CRITICAL";

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

/**
 * Never-billed months are a categorically different problem from unpaid ones —
 * the office failed to invoice, not the family failed to pay — so they get a
 * colour family outside the severity ramp entirely.
 */
export const UNBILLED_CHIP =
  "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300";

/** Payment-strip cell colours, keyed by state. */
export const STRIP_STATE = {
  not_billed: "bg-zinc-100 dark:bg-zinc-800/60",
  paid: "bg-emerald-400 dark:bg-emerald-600",
  partial: "bg-amber-400 dark:bg-amber-500",
  unpaid: "bg-zinc-300 dark:bg-zinc-600",
} as const;

/** An unpaid month that actually counts toward months_behind. */
export const STRIP_ARREAR = "bg-red-500 dark:bg-red-500";

export type StripCellState = keyof typeof STRIP_STATE;
