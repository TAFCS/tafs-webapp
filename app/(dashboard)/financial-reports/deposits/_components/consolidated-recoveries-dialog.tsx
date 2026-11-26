"use client";

import { useState } from "react";
import { Download, Loader2, Receipt, X } from "lucide-react";
import { loadSavedPaper, PaperPicker, type PdfPaper, savePaper } from "../../_components/pdf-paper";

export type RecoveriesFormat = "xlsx" | "csv" | "pdf";
export type RecoveriesGroupBy = "" | "class" | "section" | "family";
/** fee: the month the fee head was billed for; deposit: the month the money came in. */
export type RecoveriesMonthBy = "fee" | "deposit";

export interface RecoveriesOptions {
  format: RecoveriesFormat;
  paper?: PdfPaper;
  breakdownByHead: boolean;
  groupBy: RecoveriesGroupBy;
  monthBy: RecoveriesMonthBy;
}

const OPTIONS_KEY = "consolidated-recoveries-options";

type SavedOptions = Pick<RecoveriesOptions, "breakdownByHead" | "groupBy" | "monthBy">;

function loadSaved(): SavedOptions {
  try {
    const saved = JSON.parse(window.localStorage.getItem(OPTIONS_KEY) ?? "null") as Partial<RecoveriesOptions> | null;
    const groupBy = ["", "class", "section", "family"].includes(String(saved?.groupBy)) ? (saved!.groupBy as RecoveriesGroupBy) : "class";
    const monthBy: RecoveriesMonthBy = saved?.monthBy === "deposit" ? "deposit" : "fee";
    return { breakdownByHead: Boolean(saved?.breakdownByHead), groupBy, monthBy };
  } catch {
    return { breakdownByHead: false, groupBy: "class", monthBy: "fee" };
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
 * TAFSD-604: Consolidated Recoveries — the deposits in the defaulters /
 * receivables sheet: a row per student who paid, a column per fee month (and
 * per fee head with the breakdown), the money columns, and every deposit's
 * date in REMARKS. Uses the page's filters.
 */
export function ConsolidatedRecoveriesDialog({
  exporting,
  onCancel,
  onExport,
}: {
  exporting: RecoveriesFormat | null;
  onCancel: () => void;
  onExport: (options: RecoveriesOptions) => void;
}) {
  const [{ breakdownByHead, groupBy, monthBy }, setOptions] = useState(loadSaved);
  const [format, setFormat] = useState<RecoveriesFormat>("xlsx");
  const [paper, setPaper] = useState<PdfPaper>(loadSavedPaper);

  const submit = () => {
    save({ breakdownByHead, groupBy, monthBy });
    if (format === "pdf") savePaper(paper);
    onExport({ format, paper: format === "pdf" ? paper : undefined, breakdownByHead, groupBy, monthBy });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-md border border-zinc-200 dark:border-zinc-800">
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-t-2xl">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 p-2 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Receipt className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base font-black text-zinc-900 dark:text-zinc-50">Consolidated Recoveries</h2>
              <p className="text-xs font-medium text-zinc-400 mt-0.5">
                What each student paid in this date range, by fee head, in the defaulters sheet format.
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
            <span className="text-[11px] font-black uppercase tracking-wide text-zinc-500">Month columns</span>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["fee", "Fee month paid for", "The month each fee head was billed for, like the receivables sheet."],
                  ["deposit", "Month received", "The month the money came in."],
                ] as const
              ).map(([value, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setOptions((o) => ({ ...o, monthBy: value }))}
                  aria-pressed={monthBy === value}
                  title={hint}
                  className={`min-h-10 px-3 py-2 rounded-xl border text-left transition-colors ${
                    monthBy === value
                      ? "border-violet-600 bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                      : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  }`}
                >
                  <span className="block text-sm font-bold">{label}</span>
                  <span className="block text-[11px] font-medium opacity-70">{hint}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={breakdownByHead}
              onChange={(e) => setOptions((o) => ({ ...o, breakdownByHead: e.target.checked }))}
              className="mt-0.5 h-4 w-4 accent-violet-600"
            />
            <span>
              <span className="block text-sm font-bold text-zinc-800 dark:text-zinc-100">Break down by fee head</span>
              <span className="block text-xs font-medium text-zinc-400">A column per fee head under each month, then the month total.</span>
            </span>
          </label>

          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100">Group by</span>
            <select
              value={groupBy}
              onChange={(e) => setOptions((o) => ({ ...o, groupBy: e.target.value as RecoveriesGroupBy }))}
              className="h-9 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 text-sm font-bold text-zinc-700 dark:text-zinc-200"
            >
              <option value="">None</option>
              <option value="class">Class</option>
              <option value="section">Section</option>
              <option value="family">Family</option>
            </select>
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
                  className={`h-10 rounded-xl border text-sm font-bold transition-colors ${
                    format === value
                      ? "border-violet-600 bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                      : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  }`}
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
            className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-[11px] font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
