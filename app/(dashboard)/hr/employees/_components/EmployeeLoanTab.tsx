"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, HandCoins } from "lucide-react";
import {
  hrService,
  EmployeeLoanResponse,
  EmployeeLoan,
  EmployeeStatus,
  LoanStatus,
  LoanTransactionType,
} from "@/lib/hr.service";
import { PayrollRangeFields, RecoveryScheduleEditor, RemainingScheduleList } from "../../_components/RecoveryScheduleEditor";
import { clampPayrollRange, defaultPayrollRange, payrollRangeCreatePayload } from "../../_components/payroll-cycle";

interface Props {
  employeeId: number;
  employmentStatus?: EmployeeStatus | null;
}

const inputCls =
  "w-full h-10 px-3 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";
const textareaCls =
  "w-full px-3 py-2 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

function formatPkr(value: number): string {
  return `Rs. ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusBadgeClass(status: LoanStatus): string {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900";
    case "COMPLETED":
      return "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900";
    case "FORECLOSED":
      return "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";
    case "WRITTEN_OFF":
      return "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900";
    case "OUTSTANDING":
      return "bg-amber-50 text-amber-800 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900";
    default:
      return "bg-zinc-50 text-zinc-500 border-zinc-100 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700";
  }
}

function typeLabel(type: LoanTransactionType, dueAmount = 0, amount = 0): string {
  if (type === "DEDUCTION" && dueAmount === 0 && amount === 0) return "Skipped";
  switch (type) {
    case "OPENING_BALANCE":
      return "Opening balance";
    case "DEDUCTION":
      return "Payroll deduction";
    case "LUMP_SUM_REPAYMENT":
      return "Lump-sum repayment";
    case "WRITE_OFF":
      return "Write-off";
  }
}

function cycleLabel(txn: EmployeeLoan["transactions"][number]): string {
  if (txn.period_start && txn.period_end) return `${txn.period_start} - ${txn.period_end}`;
  return "-";
}

export function EmployeeLoanTab({ employeeId, employmentStatus }: Props) {
  const [data, setData] = useState<EmployeeLoanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [totalAmount, setTotalAmount] = useState("");
  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");
  const [openingRepaid, setOpeningRepaid] = useState("");
  const [disbursementDate, setDisbursementDate] = useState("");
  const [notes, setNotes] = useState("");

  const [action, setAction] = useState<"lump-sum" | "write-off" | null>(null);
  const [actionAmount, setActionAmount] = useState("");
  const [actionNote, setActionNote] = useState("");
  const [editingSchedule, setEditingSchedule] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await hrService.getEmployeeLoan(employeeId);
      setData(next);
      const range = defaultPayrollRange(next.default_start_period_start);
      setFromMonth((prev) => prev || range.fromMonth);
      setToMonth((prev) => prev || range.toMonth);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load loan.");
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  const previewInstallment = useMemo(() => {
    const total = Number(totalAmount);
    const opening = Number(openingRepaid || 0);
    const range = clampPayrollRange(fromMonth, toMonth);
    if (!Number.isFinite(total) || total <= 0 || !range || range.count < 1) return null;
    if (!Number.isFinite(opening) || opening < 0 || opening >= total) return null;
    return Math.floor(((total - opening) * 100) / range.count) / 100;
  }, [totalAmount, openingRepaid, fromMonth, toMonth]);

  const applyResponse = (next: EmployeeLoanResponse) => {
    setData(next);
    setAction(null);
    setActionAmount("");
    setActionNote("");
    setEditingSchedule(false);
    setTotalAmount("");
    const range = defaultPayrollRange(next.default_start_period_start);
    setFromMonth(range.fromMonth);
    setToMonth(range.toMonth);
    setOpeningRepaid("");
    setDisbursementDate("");
    setNotes("");
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const total = Number(totalAmount);
    const range = payrollRangeCreatePayload(fromMonth, toMonth);
    const opening = Number(openingRepaid || 0);
    if (!Number.isFinite(total) || total <= 0) {
      setError("Enter a total loan amount.");
      return;
    }
    if (!range) {
      setError("Pick a from and to payroll month.");
      return;
    }
    if (!Number.isFinite(opening) || opening < 0) {
      setError("Enter a valid opening repaid amount.");
      return;
    }
    if (opening >= total) {
      setError("Opening repaid amount must be less than the total loan amount.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = await hrService.createEmployeeLoan(employeeId, {
        total_amount: total,
        installment_count: range.installment_count,
        amount_repaid_opening: opening || undefined,
        disbursement_date: disbursementDate || undefined,
        start_period_start: range.start_period_start,
        notes: notes.trim() || undefined,
      });
      applyResponse(next);
      toast.success("Loan recorded.");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to record loan.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Cancel this loan record? Nothing has been repaid against it yet.")) return;
    setSaving(true);
    setError(null);
    try {
      applyResponse(await hrService.cancelEmployeeLoan(employeeId));
      toast.success("Loan cancelled.");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to cancel loan.");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkOutstanding = async () => {
    if (!confirm("Mark the remaining loan balance as outstanding for manual follow-up?")) return;
    setSaving(true);
    setError(null);
    try {
      applyResponse(await hrService.markLoanOutstanding(employeeId));
      toast.success("Loan marked outstanding.");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to mark loan outstanding.");
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
    if (action === "write-off" && !actionNote.trim()) {
      setError("A reason is required to write off a loan.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = action === "lump-sum"
        ? await hrService.repayLoanLumpSum(employeeId, {
            amount,
            notes: actionNote.trim() || undefined,
          })
        : await hrService.writeOffLoan(employeeId, {
            amount,
            reason: actionNote.trim(),
          });
      applyResponse(next);
      toast.success(action === "lump-sum" ? "Lump-sum repayment recorded." : "Write-off recorded.");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to record that action.");
    } finally {
      setSaving(false);
    }
  };

  const handleSchedule = async (amounts: number[]) => {
    setSaving(true);
    setError(null);
    try {
      applyResponse(await hrService.updateEmployeeLoanSchedule(employeeId, amounts));
      toast.success("Recovery plan updated.");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to update recovery plan.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-zinc-500 mt-3">Loading loan...</p>
      </div>
    );
  }

  const current = data?.current ?? null;

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
        <h3 className="text-[15px] font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-1">
          <HandCoins className="h-4 w-4" /> Loan
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
          A salary advance paid out to the employee, interest-free, recovered from salary over a set
          number of months. The mirror image of a security deposit.
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
            <PayrollRangeFields
              fromMonth={fromMonth}
              toMonth={toMonth}
              onChange={(from, to) => {
                setFromMonth(from);
                setToMonth(to);
              }}
            />
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Already repaid (opening)</label>
              <input className={inputCls} inputMode="decimal" value={openingRepaid} onChange={(e) => setOpeningRepaid(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Disbursement date</label>
              <input type="date" className={inputCls} value={disbursementDate} onChange={(e) => setDisbursementDate(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Notes / reason</label>
              <textarea rows={2} className={textareaCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {previewInstallment != null && (
              <p className="sm:col-span-2 text-xs text-zinc-500">
                About {formatPkr(previewInstallment)} per month going forward. The last installment is capped so rounding never overshoots the total.
              </p>
            )}
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="h-10 px-4 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-60"
              >
                {saving ? "Saving..." : "Record loan"}
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
              <Stat label="Repaid so far" value={formatPkr(current.total_amount - current.outstanding_balance)} />
              <Stat label="Outstanding" value={formatPkr(current.outstanding_balance)} />
              <Stat label="Via payroll" value={formatPkr(current.recovered_amount)} />
            </div>
            <RemainingScheduleList
              amounts={current.installment_schedule ?? []}
              startPeriodStart={current.start_period_start}
              caption={`${current.amount_repaid_opening > 0 ? `${formatPkr(current.amount_repaid_opening)} already repaid before this was tracked here.` : ""}${current.notes ? ` ${current.notes}` : ""}`.trim() || undefined}
            />

            <div className="flex flex-wrap gap-2 mb-4">
              {current.status === "ACTIVE" && current.outstanding_balance > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingSchedule(true);
                    setAction(null);
                  }}
                  className="h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold"
                >
                  Edit recovery plan
                </button>
              )}
              {current.outstanding_balance > 0 && (current.status === "ACTIVE" || current.status === "OUTSTANDING") && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setAction("lump-sum");
                      setActionAmount(String(current.outstanding_balance));
                      setActionNote("");
                      setEditingSchedule(false);
                    }}
                    className="h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold"
                  >
                    Lump-sum repayment
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAction("write-off");
                      setActionAmount(String(current.outstanding_balance));
                      setActionNote("");
                      setEditingSchedule(false);
                    }}
                    className="h-9 px-3 rounded-xl border border-rose-200 text-rose-700 text-xs font-bold"
                  >
                    Write off
                  </button>
                </>
              )}
              {current.status === "ACTIVE" &&
                current.amount_repaid_opening === 0 &&
                current.recovered_amount === 0 &&
                current.lump_sum_repaid_amount === 0 &&
                current.written_off_amount === 0 && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={saving}
                    className="h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-500"
                  >
                    Cancel loan
                  </button>
                )}
              {current.status === "ACTIVE" &&
                current.outstanding_balance > 0 &&
                (employmentStatus === "LEFT" || employmentStatus === "TERMINATED") && (
                <button
                  type="button"
                  onClick={handleMarkOutstanding}
                  disabled={saving}
                  className="h-9 px-3 rounded-xl border border-amber-200 text-amber-700 text-xs font-bold"
                >
                  Mark outstanding
                </button>
              )}
            </div>

            {editingSchedule && current.status === "ACTIVE" && current.outstanding_balance > 0 && (
              <div className="mb-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <h4 className="text-sm font-bold mb-3">Edit recovery plan</h4>
                <RecoveryScheduleEditor
                  key={`${current.id}-${current.updated_at}`}
                  remaining={current.outstanding_balance}
                  initialAmounts={current.installment_schedule ?? []}
                  startPeriodStart={current.start_period_start}
                  saving={saving}
                  onSubmit={handleSchedule}
                  onCancel={() => setEditingSchedule(false)}
                />
              </div>
            )}

            {action && (
              <form onSubmit={handleAction} className="mb-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    {action === "lump-sum" ? "Repayment amount" : "Write-off amount"}
                  </label>
                  <input className={inputCls} inputMode="decimal" value={actionAmount} onChange={(e) => setActionAmount(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    {action === "write-off" ? "Reason (required)" : "Notes"}
                  </label>
                  <textarea rows={2} className={textareaCls} value={actionNote} onChange={(e) => setActionNote(e.target.value)} />
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <button type="submit" disabled={saving} className="h-9 px-3 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-60">
                    {saving ? "Saving..." : action === "lump-sum" ? "Record repayment" : "Record write-off"}
                  </button>
                  <button type="button" onClick={() => setAction(null)} className="h-9 px-3 rounded-xl border text-xs font-bold">
                    Back
                  </button>
                </div>
              </form>
            )}

            <LedgerTable loan={current} />
          </>
        )}
      </div>

      {(data?.history.length ?? 0) > 0 && (
        <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
          <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-3">Previous loans</h4>
          {data!.history.map((loan) => (
            <div key={loan.id} className="mb-5 last:mb-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex text-[10px] font-bold uppercase tracking-wide border rounded-lg px-2 py-1 ${statusBadgeClass(loan.status)}`}>
                  {loan.status.replaceAll("_", " ")}
                </span>
                <span className="text-xs text-zinc-500">{formatPkr(loan.total_amount)} - disbursed {loan.disbursement_date}</span>
              </div>
              <LedgerTable loan={loan} />
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

function LedgerTable({ loan }: { loan: EmployeeLoan }) {
  if (loan.transactions.length === 0) {
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
            <th className="py-2 pr-3 font-bold text-right">Balance after</th>
            <th className="py-2 font-bold">Reason</th>
          </tr>
        </thead>
        <tbody>
          {loan.transactions.map((txn) => (
            <tr key={txn.id} className="border-t border-zinc-100 dark:border-zinc-800">
              <td className="py-2 pr-3 whitespace-nowrap">{cycleLabel(txn)}</td>
              <td className="py-2 pr-3">{typeLabel(txn.type, txn.due_amount, txn.amount)}</td>
              <td className="py-2 pr-3 text-right">{formatPkr(txn.due_amount)}</td>
              <td className="py-2 pr-3 text-right">{formatPkr(txn.amount)}</td>
              <td className="py-2 pr-3 text-right">{formatPkr(txn.balance_after)}</td>
              <td className="py-2 text-zinc-500">{txn.reason || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
