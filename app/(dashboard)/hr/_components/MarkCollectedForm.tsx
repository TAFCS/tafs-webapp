"use client";

import { FormEvent, useState } from "react";
import { hrService, type EmployeeLoanResponse, type EmployeeSecurityDepositResponse } from "@/lib/hr.service";
import { cycleIsAfter, cycleKeyFromPeriodStart, currentCycleKey, formatCycle } from "./payroll-cycle";

const inputCls =
  "w-full h-10 px-3 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

function formatPkr(value: number): string {
  return `Rs. ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "26 Sep – 25 Oct 2026", from the cycle's 26th. */
export function cycleDateRange(periodStart: string): string {
  const start = new Date(`${periodStart.slice(0, 10)}T00:00:00Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 25));
  const fmt = (d: Date, year: boolean) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" });
  return `${fmt(start, false)} – ${fmt(end, true)}`;
}

/** A cycle can be marked collected once it has started (the backend refuses a future one). */
export function cycleHasStarted(periodStart: string): boolean {
  return !cycleIsAfter(cycleKeyFromPeriodStart(periodStart), currentCycleKey());
}

export function apiErrorMessage(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  return Array.isArray(msg) ? msg.join(". ") : msg || fallback;
}

interface Props {
  kind: "loan" | "security-deposit";
  employeeId: number;
  /** The plan's next due cycle (its 26th). Sent back so a stale screen is refused, not misapplied. */
  periodStart: string;
  /** What is due for that cycle, carry included. 0 = a skipped slot. */
  due: number;
  onDone: (next: EmployeeLoanResponse & EmployeeSecurityDepositResponse) => void;
  onCancel: () => void;
}

/**
 * TAFSD-589: record the next due installment as collected outside payroll.
 * It uses up that cycle's slot the way a finalized payroll would, so the next
 * payroll takes the cycle after. Less than due carries the shortfall forward.
 */
export function MarkCollectedForm({ kind, employeeId, periodStart, due, onDone, onCancel }: Props) {
  const [amount, setAmount] = useState(String(due));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipped = due <= 0;
  const value = Number(amount);
  const shortfall = !skipped && Number.isFinite(value) && value > 0 && value < due ? due - value : 0;
  const month = formatCycle(cycleKeyFromPeriodStart(periodStart));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      setError("Add a note: how and when it was collected.");
      return;
    }
    if (!skipped && (!Number.isFinite(value) || value <= 0 || value > due)) {
      setError(`Enter an amount between 1 and ${formatPkr(due)}.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = await hrService.markInstallmentCollected(kind, employeeId, {
        amount: skipped ? 0 : value,
        period_start: periodStart.slice(0, 10),
        notes: notes.trim(),
      });
      onDone(next);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to mark the installment collected."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <h4 className="text-sm font-bold">
          {skipped ? `Record ${month} as skipped` : `Mark ${month} installment collected`}
        </h4>
        <p className="text-xs text-zinc-500 mt-0.5">
          {cycleDateRange(periodStart)}.{" "}
          {skipped
            ? "Nothing is scheduled for this month. Recording it moves the plan on, so the next payroll takes the following month."
            : "Use this when it was taken outside payroll (cash, or a payroll done on paper). Payroll for this month will not deduct it again."}
        </p>
      </div>
      {error && (
        <p className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900 rounded-xl px-3 py-2">{error}</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {!skipped && (
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Amount collected</label>
            <input className={inputCls} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <p className="text-[11px] text-zinc-500 mt-1">
              {shortfall > 0
                ? `${formatPkr(shortfall)} short: it carries to the next month, as a payroll shortfall would.`
                : `Due: ${formatPkr(due)}`}
            </p>
          </div>
        )}
        <div className={skipped ? "sm:col-span-2" : ""}>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Note (required)</label>
          <input className={inputCls} value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Deducted on the paper payroll" />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="h-9 px-4 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-60">
          {saving ? "Saving..." : skipped ? "Record as skipped" : "Mark collected"}
        </button>
        <button type="button" onClick={onCancel} className="h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold">
          Cancel
        </button>
      </div>
    </form>
  );
}
