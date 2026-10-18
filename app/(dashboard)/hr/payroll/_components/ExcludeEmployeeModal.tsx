"use client";

import { useState } from "react";
import { Loader2, UserMinus } from "lucide-react";

const QUICK_REASONS = [
  "Attendance not tracked this cycle",
  "Paid on a custom payroll run",
  "On unpaid leave for the whole cycle",
  "Salary handled outside payroll",
];

/**
 * Confirms excluding one employee from a payroll run, with an optional
 * reason that stays on the Excluded Employees list.
 */
export function ExcludeEmployeeModal({
  name,
  code,
  periodLabel,
  submitting,
  onCancel,
  onConfirm,
}: {
  name: string;
  code?: string | null;
  periodLabel: string;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (reason: string | undefined) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => !submitting && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exclude-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
      >
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30">
            <UserMinus className="h-5 w-5 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <h3 id="exclude-title" className="text-lg font-bold text-zinc-900 dark:text-white">
              Exclude {name} from this cycle?
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {code ? `${code} · ` : ""}{periodLabel}
            </p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <ul className="text-sm text-zinc-600 dark:text-zinc-300 space-y-1.5 list-disc pl-5">
            <li>Their line is removed from this run, so they are <strong>not paid</strong> by it.</li>
            <li>&quot;Regen All&quot; will not add them back.</li>
            <li>These dates become free, so you can pay them on a custom payroll run instead.</li>
            <li>You can bring them back any time with <strong>Include</strong>.</li>
          </ul>

          <div className="space-y-1.5">
            <label htmlFor="exclude-reason" className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Reason (optional)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`px-2.5 h-7 rounded-lg text-[11px] font-semibold border transition-colors ${
                    reason === r
                      ? "bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-300"
                      : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              id="exclude-reason"
              rows={2}
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Shown next to their name on the Excluded Employees list"
              className="w-full p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm resize-none focus:border-primary"
            />
          </div>
        </div>

        <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-5 h-11 rounded-xl text-zinc-600 dark:text-zinc-400 font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason.trim() || undefined)}
            disabled={submitting}
            className="px-6 h-11 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
            Exclude from this cycle
          </button>
        </div>
      </div>
    </div>
  );
}
