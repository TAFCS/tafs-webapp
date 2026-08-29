"use client";

import { STRIP_ARREAR, STRIP_STATE, type StripCellState } from "../../_components/severity";

export type StripCell = {
  year: number;
  month: number;
  state: StripCellState;
  is_arrear: boolean;
  amount: number;
  outstanding: number;
  head_count: number;
  group_keys: string[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function tooltip(cell: StripCell): string {
  const label = `${MONTHS[cell.month - 1]} ${cell.year}`;
  if (cell.head_count === 0) return `${label} — not billed`;
  const state = cell.is_arrear ? "arrear" : cell.state.replace("_", " ");
  return `${label} — ${state}, ${cell.head_count} head${cell.head_count === 1 ? "" : "s"}, Rs. ${Math.round(
    cell.outstanding,
  ).toLocaleString()} outstanding of Rs. ${Math.round(cell.amount).toLocaleString()}`;
}

/**
 * A student's payment history as one row of month cells.
 *
 * Red means `is_arrear` — an unpaid month counted toward months_behind — not
 * merely "unpaid". A head billed for a month that has not yet passed the as-of
 * date is grey, because tinting it would make every student look a month worse
 * than they are.
 */
export function MonthStrip({ cells }: { cells: StripCell[] }) {
  return (
    <div className="flex gap-[2px]">
      {cells.map((cell) => (
        <div
          key={`${cell.year}-${cell.month}`}
          title={tooltip(cell)}
          className={`h-3.5 w-3.5 rounded-[3px] ${
            cell.is_arrear ? STRIP_ARREAR : STRIP_STATE[cell.state]
          }`}
        />
      ))}
    </div>
  );
}

export function StripLegend({ columns }: { columns: { label: string }[] }) {
  const first = columns[0]?.label;
  const last = columns[columns.length - 1]?.label;
  const swatches: [string, string][] = [
    [STRIP_ARREAR, "Arrear (counts toward months behind)"],
    [STRIP_STATE.unpaid, "Unpaid, not yet due"],
    [STRIP_STATE.partial, "Partly paid"],
    [STRIP_STATE.paid, "Paid"],
    [STRIP_STATE.not_billed, "Not billed"],
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
      {first && last && (
        <span className="font-bold text-zinc-600 dark:text-zinc-300">
          {first} → {last}
        </span>
      )}
      {swatches.map(([cls, label]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded-[3px] ${cls}`} />
          {label}
        </span>
      ))}
    </div>
  );
}
