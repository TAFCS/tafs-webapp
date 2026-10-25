"use client";

import { useState } from "react";
import { Printer, X } from "lucide-react";

/**
 * TAFSD-417/425: the paper choice for a school-format PDF, the landscape print
 * of a report's Excel sheet. Shared by every financial report that prints one.
 * The server has the last word: a sheet too wide for A4 comes out on A3, and
 * one too wide even for A3 is refused with a message saying what to cut.
 */

export type PdfPaper = "A4" | "A3";

const PAPER_KEY = "financial-reports-pdf-paper";

/** The last paper picked on this browser, else A4. */
export function loadSavedPaper(): PdfPaper {
  try {
    return window.localStorage.getItem(PAPER_KEY) === "A3" ? "A3" : "A4";
  } catch {
    return "A4";
  }
}

export function savePaper(paper: PdfPaper) {
  try {
    window.localStorage.setItem(PAPER_KEY, paper);
  } catch {
    // Not remembering is fine.
  }
}

/** A4 / A3 buttons, with A4 greyed out when the caller knows it won't fit. */
export function PaperPicker({
  paper,
  onChange,
  tooWideForA4 = false,
  note,
}: {
  paper: PdfPaper;
  onChange: (paper: PdfPaper) => void;
  tooWideForA4?: boolean;
  /** Shown under the buttons when A4 isn't ruled out. */
  note?: React.ReactNode;
}) {
  const chosen: PdfPaper = tooWideForA4 ? "A3" : paper;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-black uppercase tracking-wide text-zinc-500">Paper (landscape)</span>
      <div className="grid grid-cols-2 gap-2">
        {(["A4", "A3"] as const).map((p) => {
          const disabled = p === "A4" && tooWideForA4;
          return (
            <button
              key={p}
              type="button"
              disabled={disabled}
              onClick={() => onChange(p)}
              aria-pressed={chosen === p}
              className={`h-10 rounded-xl border text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                chosen === p
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
              }`}
            >
              {p}
            </button>
          );
        })}
      </div>
      {tooWideForA4 ? (
        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
          Too many columns to fit A4, so this prints on A3. Fewer months back or fewer columns brings A4 back.
        </p>
      ) : (
        <p className="text-xs font-medium text-zinc-400">
          {note ?? "If the columns don't fit A4, the file comes out on A3. If they don't fit A3 either, narrow the filters or export Excel."}
        </p>
      )}
    </div>
  );
}

/** The paper question on its own, for reports whose PDF has no other options. */
export function PdfPaperDialog({
  reportName,
  onCancel,
  onExport,
}: {
  /** "Fee Heads by fee date", shown in the title. */
  reportName: string;
  onCancel: () => void;
  onExport: (paper: PdfPaper) => void;
}) {
  const [paper, setPaper] = useState<PdfPaper>(loadSavedPaper);
  const submit = () => {
    savePaper(paper);
    onExport(paper);
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-sm border border-zinc-200 dark:border-zinc-800">
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-t-2xl">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Printer className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base font-black text-zinc-900 dark:text-zinc-50">Print {reportName}</h2>
              <p className="text-xs font-medium text-zinc-400 mt-0.5">The Excel sheet as a landscape PDF.</p>
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
        <div className="px-6 py-4">
          <PaperPicker paper={paper} onChange={setPaper} />
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
            className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700"
          >
            <Printer className="h-3.5 w-3.5" />
            Export PDF
          </button>
        </div>
      </div>
    </div>
  );
}
