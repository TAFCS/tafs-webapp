"use client";

import { useState } from "react";
import { Download, Loader2, Scale, X } from "lucide-react";
import { loadSavedPaper, PaperPicker, type PdfPaper, savePaper } from "../../_components/pdf-paper";

export type FeePositionFormat = "xlsx" | "csv" | "pdf";
export type FeePositionLayout = "detail" | "monthly" | "summary";
export type FeePositionGroupBy = "" | "class" | "section" | "family";

export interface FeePositionOptions {
  format: FeePositionFormat;
  paper?: PdfPaper;
  layout: FeePositionLayout;
  groupBy: FeePositionGroupBy;
  includeUnbilledAfterLeaving: boolean;
}

const OPTIONS_KEY = "consolidated-fee-position-options";

type SavedOptions = Pick<FeePositionOptions, "layout" | "groupBy" | "includeUnbilledAfterLeaving">;

const LAYOUTS: ReadonlyArray<readonly [FeePositionLayout, string, string]> = [
  ["detail", "Student detail", "A row per student: billed, discount, waived; cash and credit; on vouchers, not yet billed."],
  ["monthly", "Month by month", "A row per student, each group spread over the fee months, so you see which month is behind."],
  ["summary", "Summary by class", "No student rows: all campuses, then each campus by class, with % recovered."],
];

function loadSaved(): SavedOptions {
  try {
    const saved = JSON.parse(window.localStorage.getItem(OPTIONS_KEY) ?? "null") as Partial<SavedOptions> | null;
    const layout = LAYOUTS.some(([value]) => value === saved?.layout) ? (saved!.layout as FeePositionLayout) : "detail";
    const groupBy = ["", "class", "section", "family"].includes(String(saved?.groupBy))
      ? (saved!.groupBy as FeePositionGroupBy)
      : "class";
    return { layout, groupBy, includeUnbilledAfterLeaving: Boolean(saved?.includeUnbilledAfterLeaving) };
  } catch {
    return { layout: "detail", groupBy: "class", includeUnbilledAfterLeaving: false };
  }
}

function save(options: SavedOptions) {
  try {
    window.localStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
  } catch {
    // Not remembering is fine.
  }
}

/**
 * TAFSD-620: Consolidated Fee Position Statement — for the fee heads the page's
 * filters select, what was receivable, what has been recovered against it and
 * what is still owed, side by side, ending in the net balance.
 */
export function FeePositionDialog({
  exporting,
  onCancel,
  onExport,
}: {
  exporting: FeePositionFormat | null;
  onCancel: () => void;
  onExport: (options: FeePositionOptions) => void;
}) {
  const [{ layout, groupBy, includeUnbilledAfterLeaving }, setOptions] = useState(loadSaved);
  const [format, setFormat] = useState<FeePositionFormat>("xlsx");
  const [paper, setPaper] = useState<PdfPaper>(loadSavedPaper);

  const submit = () => {
    save({ layout, groupBy, includeUnbilledAfterLeaving });
    if (format === "pdf") savePaper(paper);
    onExport({ format, paper: format === "pdf" ? paper : undefined, layout, groupBy, includeUnbilledAfterLeaving });
  };

  const choice = (active: boolean) =>
    active
      ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
      : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-md border border-zinc-200 dark:border-zinc-800 max-h-[calc(100vh-2rem)] overflow-y-auto">
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-t-2xl">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Scale className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base font-black text-zinc-900 dark:text-zinc-50">Consolidated Fee Position</h2>
              <p className="text-xs font-medium text-zinc-400 mt-0.5">
                Receivables, recoveries and balance for these fee dates and filters, ending in the net balance.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-black uppercase tracking-wide text-zinc-500">Layout</span>
            <div className="grid gap-2">
              {LAYOUTS.map(([value, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setOptions((o) => ({ ...o, layout: value }))}
                  aria-pressed={layout === value}
                  className={`min-h-10 px-3 py-2 rounded-xl border text-left transition-colors ${choice(layout === value)}`}
                >
                  <span className="block text-sm font-bold">{label}</span>
                  <span className="block text-[11px] font-medium opacity-70">{hint}</span>
                </button>
              ))}
            </div>
          </div>

          {layout !== "summary" && (
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100">Group by</span>
              <select
                value={groupBy}
                onChange={(e) => setOptions((o) => ({ ...o, groupBy: e.target.value as FeePositionGroupBy }))}
                className="h-9 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 text-sm font-bold text-zinc-700 dark:text-zinc-200"
              >
                <option value="">None</option>
                <option value="class">Class</option>
                <option value="section">Section</option>
                <option value="family">Family</option>
              </select>
            </label>
          )}

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeUnbilledAfterLeaving}
              onChange={(e) => setOptions((o) => ({ ...o, includeUnbilledAfterLeaving: e.target.checked }))}
              className="mt-0.5 h-4 w-4 accent-indigo-600"
            />
            <span>
              <span className="block text-sm font-bold text-zinc-800 dark:text-zinc-100">
                Count fees never billed to students who have left
              </span>
              <span className="block text-xs font-medium text-zinc-400">
                Off: fee heads of left, graduated or expelled students that were never put on a voucher are left out,
                since they will never be billed. The sheet says how much was left out.
              </span>
            </span>
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-black uppercase tracking-wide text-zinc-500">Format</span>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["xlsx", "Excel"],
                  ["pdf", "PDF"],
                  ["csv", "CSV"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFormat(value)}
                  aria-pressed={format === value}
                  className={`h-10 rounded-xl border text-sm font-bold transition-colors ${choice(format === value)}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {format === "pdf" && <PaperPicker paper={paper} onChange={setPaper} />}
        </div>

        <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-4 rounded-xl text-[11px] font-bold text-zinc-600 bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={exporting !== null}
            className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
