"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Wallet } from "lucide-react";
import {
  hrService,
  EmployeeSecurityDepositResponse,
  SecurityDepositPlan,
  SecurityDepositStatus,
  SecurityDepositTransactionType,
} from "@/lib/hr.service";

interface Props {
  employeeId: number;
}

const inputCls =
  "w-full h-10 px-3 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";
const textareaCls =
  "w-full px-3 py-2 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

function formatPkr(value: number): string {
  return `Rs. ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusBadgeClass(status: SecurityDepositStatus): string {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900";
    case "COMPLETED":
      return "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900";
    case "REFUNDED":
      return "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";
    case "FORFEITED":
      return "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900";
    case "PARTIALLY_FORFEITED":
      return "bg-amber-50 text-amber-800 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900";
    default:
      return "bg-zinc-50 text-zinc-500 border-zinc-100 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700";
  }
}

function typeLabel(type: SecurityDepositTransactionType): string {
  switch (type) {
    case "DEDUCTION":
      return "Payroll deduction";
    case "REFUND":
      return "Refund";
    case "FORFEIT":
      return "Forfeit";
  }
}

function cycleLabel(txn: SecurityDepositPlan["transactions"][number]): string {
  if (txn.period_start && txn.period_end) return `${txn.period_start} - ${txn.period_end}`;
  return "-";
}

export function EmployeeSecurityDepositTab({ employeeId }: Props) {
  const [data, setData] = useState<EmployeeSecurityDepositResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [totalAmount, setTotalAmount] = useState("");
  const [months, setMonths] = useState("5");
  const [startPeriod, setStartPeriod] = useState("");
  const [notes, setNotes] = useState("");

  const [action, setAction] = useState<"refund" | "forfeit" | null>(null);
  const [actionAmount, setActionAmount] = useState("");
  const [actionNote, setActionNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await hrService.getEmployeeSecurityDeposit(employeeId);
      setData(next);
      setStartPeriod((prev) => prev || next.default_start_period_start);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load security deposit.");
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  const previewInstallment = useMemo(() => {
    const total = Number(totalAmount);
    const count = Number(months);
    if (!Number.isFinite(total) || total <= 0 || !Number.isInteger(count) || count < 1) return null;
    const installment = Math.floor((total * 100) / count) / 100;
    return installment;
  }, [totalAmount, months]);

  const applyResponse = (next: EmployeeSecurityDepositResponse) => {
    setData(next);
    setAction(null);
    setActionAmount("");
    setActionNote("");
    setTotalAmount("");
    setMonths("5");
    setNotes("");
    setStartPeriod(next.default_start_period_start);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const total = Number(totalAmount);
    const count = Number(months);
    if (!Number.isFinite(total) || total <= 0) {
      setError("Enter a total deposit amount.");
      return;
    }
    if (!Number.isInteger(count) || count < 1) {
      setError("Enter the number of months as a whole number.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = await hrService.createEmployeeSecurityDeposit(employeeId, {
        total_amount: total,
        installment_count: count,
        start_period_start: startPeriod || undefined,
        notes: notes.trim() || undefined,
      });
      applyResponse(next);
      toast.success("Security deposit plan started.");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to start security deposit plan.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Cancel this unused security deposit plan? Nothing has been deducted yet.")) return;
    setSaving(true);
    setError(null);
    try {
      applyResponse(await hrService.cancelEmployeeSecurityDeposit(employeeId));
      toast.success("Plan cancelled.");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to cancel plan.");
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (e: FormEvent) => {
    e.preventDefault();
    if (!action) return;
    const amount = Number(actionAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (action === "forfeit" && !actionNote.trim()) {
      setError("A reason is required to forfeit a deposit.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = action === "refund"
        ? await hrService.refundEmployeeSecurityDeposit(employeeId, {
            amount,
            notes: actionNote.trim() || undefined,
          })
        : await hrService.forfeitEmployeeSecurityDeposit(employeeId, {
            amount,
            reason: actionNote.trim(),
          });
      applyResponse(next);
      toast.success(action === "refund" ? "Refund recorded." : "Forfeiture recorded.");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to record that action.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-zinc-500 mt-3">Loading security deposit...</p>
      </div>
    );
  }

  const current = data?.current ?? null;

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
        <h3 className="text-[15px] font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-1">
          <Wallet className="h-4 w-4" /> Security deposit
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
          Caution money held against employment. Recovered from salary over a set number of months,
          then refunded or forfeited. This is not a loan.
        </p>

        {error && (
          <p className="mb-4 text-sm text-rose-600 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        {!current && (
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Total amount</label>
              <input className={inputCls} inputMode="decimal" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="50000" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Months</label>
              <input className={inputCls} inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Starts from cycle</label>
              <input type="date" className={inputCls} value={startPeriod} onChange={(e) => setStartPeriod(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Notes</label>
              <textarea rows={2} className={textareaCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {previewInstallment != null && (
              <p className="sm:col-span-2 text-xs text-zinc-500">
                About {formatPkr(previewInstallment)} per month. The last installment is capped so rounding never overshoots the total.
              </p>
            )}
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="h-10 px-4 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-60"
              >
                {saving ? "Starting..." : "Start plan"}
              </button>
            </div>
          </form>
        )}

        {current && (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className={`inline-flex text-[10px] font-bold uppercase tracking-wide border rounded-lg px-2 py-1 ${statusBadgeClass(current.status)}`}>
                {current.status.replaceAll("_", " ")}
              </span>
              {current.carried_forward_amount > 0 && (
                <span className="inline-flex text-[10px] font-bold uppercase tracking-wide border rounded-lg px-2 py-1 bg-amber-50 text-amber-800 border-amber-100">
                  {formatPkr(current.carried_forward_amount)} carried forward
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <Stat label="Target" value={formatPkr(current.total_amount)} />
              <Stat label="Recovered" value={formatPkr(current.recovered_amount)} />
              <Stat label="Held" value={formatPkr(current.held_amount)} />
              <Stat label="Still to collect" value={formatPkr(current.remaining_to_collect)} />
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              {formatPkr(current.installment_amount)} x {current.installment_count} months, starting {current.start_period_start}.
              {current.notes ? ` ${current.notes}` : ""}
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
              {current.held_amount > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setAction("refund");
                      setActionAmount(String(current.held_amount));
                      setActionNote("");
                    }}
                    className="h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold"
                  >
                    Refund
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAction("forfeit");
                      setActionAmount(String(current.held_amount));
                      setActionNote("");
                    }}
                    className="h-9 px-3 rounded-xl border border-rose-200 text-rose-700 text-xs font-bold"
                  >
                    Forfeit
                  </button>
                </>
              )}
              {current.recovered_amount === 0 && (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className="h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-500"
                >
                  Cancel plan
                </button>
              )}
            </div>

            {action && (
              <form onSubmit={handleAction} className="mb-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    {action === "refund" ? "Refund amount" : "Forfeit amount"}
                  </label>
                  <input className={inputCls} inputMode="decimal" value={actionAmount} onChange={(e) => setActionAmount(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    {action === "forfeit" ? "Reason (required)" : "Notes"}
                  </label>
                  <textarea rows={2} className={textareaCls} value={actionNote} onChange={(e) => setActionNote(e.target.value)} />
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <button type="submit" disabled={saving} className="h-9 px-3 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-60">
                    {saving ? "Saving..." : action === "refund" ? "Record refund" : "Record forfeiture"}
                  </button>
                  <button type="button" onClick={() => setAction(null)} className="h-9 px-3 rounded-xl border text-xs font-bold">
                    Back
                  </button>
                </div>
              </form>
            )}

            <LedgerTable plan={current} />
          </>
        )}
      </div>

      {(data?.history.length ?? 0) > 0 && (
        <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
          <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-3">Previous plans</h4>
          {data!.history.map((plan) => (
            <div key={plan.id} className="mb-5 last:mb-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex text-[10px] font-bold uppercase tracking-wide border rounded-lg px-2 py-1 ${statusBadgeClass(plan.status)}`}>
                  {plan.status.replaceAll("_", " ")}
                </span>
                <span className="text-xs text-zinc-500">{formatPkr(plan.total_amount)} - started {plan.start_period_start}</span>
              </div>
              <LedgerTable plan={plan} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{label}</p>
      <p className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100 mt-1">{value}</p>
    </div>
  );
}

function LedgerTable({ plan }: { plan: SecurityDepositPlan }) {
  if (plan.transactions.length === 0) {
    return <p className="text-xs text-zinc-400">No payroll deductions yet. They appear here after a cycle is finalized.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-zinc-400">
            <th className="py-2 pr-3 font-bold">Cycle</th>
            <th className="py-2 pr-3 font-bold">Type</th>
            <th className="py-2 pr-3 font-bold text-right">Due</th>
            <th className="py-2 pr-3 font-bold text-right">Amount</th>
            <th className="py-2 pr-3 font-bold text-right">Held after</th>
            <th className="py-2 font-bold">Reason</th>
          </tr>
        </thead>
        <tbody>
          {plan.transactions.map((txn) => (
            <tr key={txn.id} className="border-t border-zinc-100 dark:border-zinc-800">
              <td className="py-2 pr-3 whitespace-nowrap">{cycleLabel(txn)}</td>
              <td className="py-2 pr-3">{typeLabel(txn.type)}</td>
              <td className="py-2 pr-3 text-right">{formatPkr(txn.due_amount)}</td>
              <td className="py-2 pr-3 text-right">{formatPkr(txn.amount)}</td>
              <td className="py-2 pr-3 text-right">{formatPkr(txn.running_balance)}</td>
              <td className="py-2 text-zinc-500">{txn.reason || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
