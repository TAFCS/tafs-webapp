"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PaginationMeta } from "./report-utils";

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

export function ReportPager({
  page,
  pageSize,
  pagination,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  pagination: PaginationMeta | null;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const total = pagination?.total ?? 0;
  const pages = pagination?.pages ?? 1;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-zinc-400 font-medium">
        Showing {from}–{to} of {total.toLocaleString()}
      </p>
      <div className="flex items-center gap-3">
        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Per page</label>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="h-8 px-3 text-xs font-bold bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:border-primary"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4 text-zinc-500" />
          </button>
          <span className="text-xs font-bold text-zinc-500 px-2">
            {page} / {pages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(pages, page + 1))}
            disabled={page >= pages}
            className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4 text-zinc-500" />
          </button>
        </div>
      </div>
    </div>
  );
}
