"use client";

import { useState } from "react";
import { Columns3, Download, X } from "lucide-react";

/**
 * The defaulters sheet's columns, in sheet order. Keys match the backend's
 * DEFAULTER_COLUMN_KEYS (financial-report-query.dto.ts) — keep the two in sync.
 */
export const DEFAULTER_EXPORT_COLUMNS = [
  { key: "sno", label: "S#" },
  { key: "cc", label: "C.C." },
  { key: "gr", label: "G.R. #" },
  { key: "link_to_gr", label: "Link to GR (siblings)" },
  { key: "level", label: "Level" },
  { key: "name", label: "Student name" },
  { key: "status", label: "Status" },
  { key: "contact", label: "Contact (guardian phones)" },
  { key: "months", label: "Month columns" },
  { key: "amount", label: "Defaulting amount" },
  { key: "remarks", label: "Remarks" },
] as const;
export type DefaulterExportColumn = (typeof DEFAULTER_EXPORT_COLUMNS)[number]["key"];

const ALL_KEYS: DefaulterExportColumn[] = DEFAULTER_EXPORT_COLUMNS.map((c) => c.key);
const STORAGE_KEY = "defaulters-export-columns";
const MONTHS_BACK_KEY = "defaulters-export-months-back";

/** TAFSD-355: the last "months back" picked on this browser, else the page's window. */
function loadSavedMonthsBack(fallback: number): number {
  try {
    const saved = Number(window.localStorage.getItem(MONTHS_BACK_KEY));
    if (Number.isInteger(saved) && saved >= 1 && saved <= 24) return saved;
  } catch {
    // Storage blocked — use the page's window.
  }
  return fallback;
}

/** The last choice made on this browser, or every column. */
export function loadSavedExportColumns(): DefaulterExportColumn[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as unknown) : null;
    if (Array.isArray(saved)) {
      const valid = ALL_KEYS.filter((k) => saved.includes(k));
      if (valid.length) return valid;
    }
  } catch {
    // Storage blocked or corrupt — fall back to everything.
  }
  return ALL_KEYS;
}

function saveExportColumns(columns: DefaulterExportColumn[], monthsBack: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
    window.localStorage.setItem(MONTHS_BACK_KEY, String(monthsBack));
  } catch {
    // Not remembering is fine.
  }
}

interface Props {
  format: "xlsx" | "csv";
  /** The page's month window, used until the user picks their own. */
  defaultMonthsBack: number;
  /** The as-of date, so the dialog can name the months the file will cover. */
  asOfDate: string;
  onCancel: () => void;
  /** Columns in sheet order; `undefined` when every column is ticked (the full sheet). */
  onExport: (columns: DefaulterExportColumn[] | undefined, monthsBack: number) => void;
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Jun 2026 – Oct 2026" for n months ending at the as-of month. */
function monthRangeLabel(asOfDate: string, n: number): string {
  const [y, m] = asOfDate.split("-").map(Number);
  if (!y || !m) return "";
  const end = y * 12 + (m - 1);
  const start = end - (n - 1);
  const label = (idx: number) => `${MONTH_SHORT[idx % 12]} ${Math.floor(idx / 12)}`;
  return n === 1 ? label(end) : `${label(start)} – ${label(end)}`;
}

/** TAFSD-301: pick which columns the defaulters export carries. */
export function ExportColumnsDialog({ format, defaultMonthsBack, asOfDate, onCancel, onExport }: Props) {
  const [picked, setPicked] = useState<DefaulterExportColumn[]>(loadSavedExportColumns);
  const [monthsBack, setMonthsBack] = useState(() => loadSavedMonthsBack(defaultMonthsBack));
  const toggle = (key: DefaulterExportColumn) =>
    setPicked((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : ALL_KEYS.filter((k) => k === key || cur.includes(k))));

  const submit = () => {
    if (!picked.length) return;
    saveExportColumns(picked, monthsBack);
    onExport(picked.length === ALL_KEYS.length ? undefined : picked, monthsBack);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-zinc-200 dark:border-zinc-800">
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Columns3 className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base font-black text-zinc-900 dark:text-zinc-50">
                Columns for the {format === "xlsx" ? "Excel" : "CSV"} file
              </h2>
              <p className="text-xs font-medium text-zinc-400 mt-0.5">
                Untick what you don&apos;t need. Your choice is remembered on this browser.
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

        <div className="px-6 py-4 flex flex-col gap-1">
          <div className="flex items-center gap-3 mb-2 text-[11px] font-bold">
            <button type="button" onClick={() => setPicked(ALL_KEYS)} className="text-primary hover:underline">
              Select all
            </button>
            <button type="button" onClick={() => setPicked([])} className="text-zinc-500 hover:underline">
              Clear
            </button>
            <span className="ml-auto text-zinc-400">
              {picked.length} of {ALL_KEYS.length}
            </span>
          </div>
          {DEFAULTER_EXPORT_COLUMNS.map((c) => (
            <div key={c.key}>
              <label className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                <input
                  type="checkbox"
                  checked={picked.includes(c.key)}
                  onChange={() => toggle(c.key)}
                  className="h-4 w-4 accent-emerald-600"
                />
                {c.label}
              </label>
              {/* TAFSD-355: how many month columns, counting back from the as-of month. */}
              {c.key === "months" && picked.includes("months") && (
                <div className="ml-10 mr-3 mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  <label htmlFor="months-back">Months back</label>
                  <input
                    id="months-back"
                    type="number"
                    min={1}
                    max={24}
                    value={monthsBack}
                    onChange={(e) => {
                      const n = Math.round(Number(e.target.value));
                      if (Number.isFinite(n)) setMonthsBack(Math.min(24, Math.max(1, n)));
                    }}
                    className="h-8 w-16 px-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm tabular-nums"
                  />
                  <span className="text-zinc-400">
                    {monthRangeLabel(asOfDate, monthsBack)}; anything older goes in one EARLIER column
                  </span>
                </div>
              )}
            </div>
          ))}
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
            disabled={!picked.length}
            className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
