"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { MATRIX_PAGE_SIZES } from "./punch-matrix-utils";

interface Props {
  page: number;
  pageSize: number;
  total: number;
  /** Plural noun for the "Showing 1–25 of 300 employees" line. */
  noun: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

/**
 * Row pager for the punch-card matrices. Rows are already all in memory (the
 * search and the Excel export both work over the full set) — this only limits
 * how many get committed to the DOM at once, which is what keeps the sticky
 * header/column scroll smooth.
 */
export function MatrixPager({ page, pageSize, total, noun, onPageChange, onPageSizeChange }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
      <div className="flex items-center gap-3">
        <p className="text-[12px] text-zinc-400">
          Showing <strong className="text-zinc-600 dark:text-zinc-300">{from}–{to}</strong> of{" "}
          <strong className="text-zinc-600 dark:text-zinc-300">{total}</strong> {noun}
        </p>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="h-8 px-2 border rounded-lg text-xs bg-white dark:bg-zinc-950 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary/30"
          aria-label="Rows per page"
        >
          {MATRIX_PAGE_SIZES.map((s) => (
            <option key={s} value={s}>{s} / page</option>
          ))}
        </select>
      </div>

      {pages > 1 && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="h-8 w-8 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: Math.min(5, pages) }, (_, i) => {
            const p = page <= 3 ? i + 1 : Math.min(page - 2, pages - 4) + i;
            if (p < 1 || p > pages) return null;
            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`h-8 w-8 text-[12px] font-bold rounded-xl transition-all ${
                  p === page
                    ? "bg-primary text-white shadow-sm"
                    : "border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                }`}
              >
                {p}
              </button>
            );
          })}
          <button
            onClick={() => onPageChange(Math.min(pages, page + 1))}
            disabled={page >= pages}
            className="h-8 w-8 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
