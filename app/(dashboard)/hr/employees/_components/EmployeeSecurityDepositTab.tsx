"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Wallet } from "lucide-react";
import {
  hrService,
  EmployeeSecurityDepositResponse,
  SecurityDepositPlan,
  SecurityDepositStatus,
} from "@/lib/hr.service";
import {
  MonthAmounts,
  PayrollMonthPicker,
  RecoveryScheduleEditor,
  checkMonthAmounts,
  monthPlanCreatePayload,
} from "../../_components/RecoveryScheduleEditor";
import { DepositActionForm, DepositActionSubmit } from "../../_components/DepositActionForm";
import { cycleKeyFromPeriodStart, currentCycleKey, formatCycle } from "../../_components/payroll-cycle";

interface Props {
  employeeId: number;
  /** Mirrors hr.employee_directory#security_deposit.edit. */
  canEdit?: boolean;
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

export function EmployeeSecurityDepositTab({ employeeId, canEdit = true }: Props) {
  const [data, setData] = useState<EmployeeSecurityDepositResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [totalAmount, setTotalAmount] = useState("");
  const [months, setMonths] = useState<MonthAmounts>({});
  const [notes, setNotes] = useState("");

  const [action, setAction] = useState<"refund" | "forfeit" | "close" | null>(null);
  const [editingSchedule, setEditingSchedule] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await hrService.getEmployeeSecurityDeposit(employeeId);
      setData(next);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load security deposit.");
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  const totalNumber = Number(totalAmount);
  const minMonth = data?.default_start_period_start
    ? cycleKeyFromPeriodStart(data.default_start_period_start)
    : currentCycleKey();

  const applyResponse = (next: EmployeeSecurityDepositResponse) => {
    setData(next);
    setAction(null);
    setEditingSchedule(false);
    setTotalAmount("");
    setMonths({});
    setNotes("");
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const total = totalNumber;
    if (!Number.isFinite(total) || total <= 0) {
      setError("Enter a total deposit amount.");
      return;
    }
    const check = checkMonthAmounts(months, total);
    const plan = monthPlanCreatePayload(months);
    if (!check.ok || !plan) {
      setError(check.problem ?? "Pick the months to collect in.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = await hrService.createEmployeeSecurityDeposit(employeeId, {
        total_amount: total,
        ...plan,
        notes: notes.trim() || undefined,
      });
      applyResponse(next);
      toast.success("Security deposit plan started.");
      next.warnings?.forEach((w) => toast(w, { icon: "⚠️", duration: 9000 }));
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

  const handleAction = async ({ amount, note, stopCollection }: DepositActionSubmit) => {
    if (!action) return;
    setSaving(true);
    setActionError(null);
    try {
      let next: EmployeeSecurityDepositResponse;
      if (action === "refund") {
        next = await hrService.refundEmployeeSecurityDeposit(employeeId, {
          amount,
          notes: note || undefined,
          stop_collection: stopCollection,
        });
      } else if (action === "forfeit") {
        next = await hrService.forfeitEmployeeSecurityDeposit(employeeId, {
          amount,
          reason: note,
          stop_collection: stopCollection,
        });
      } else {
        next = await hrService.closeEmployeeSecurityDeposit(employeeId, note || undefined);
      }
      applyResponse(next);
      toast.success(
        action === "close" ? "Collection stopped." : action === "refund" ? "Refund recorded." : "Forfeiture recorded.",
      );
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setActionError(Array.isArray(msg) ? msg.join(". ") : msg || "Failed to record that action.");
    } finally {
      setSaving(false);
    }
  };

  const handleSchedule = async (amounts: number[]) => {
    setSaving(true);
    setError(null);
    try {
      applyResponse(await hrService.updateEmployeeSecurityDepositSchedule(employeeId, amounts));
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

        {!current && canEdit && (
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Total amount</label>
              <input className={inputCls} inputMode="decimal" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="50000" />
            </div>
            <div className="sm:col-span-2">
              <PayrollMonthPicker
                total={Number.isFinite(totalNumber) && totalNumber > 0 ? totalNumber : 0}
                value={months}
                onChange={setMonths}
                minMonth={minMonth}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Notes</label>
              <textarea rows={2} className={textareaCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
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

            <DepositSummary plan={current} />
            <MonthByMonth plan={current} />
            {current.notes && <p className="text-xs text-zinc-500 mb-4">Notes: {current.notes}</p>}

            {canEdit && (
            <div className="flex flex-wrap gap-2 mb-4">
              {current.status === "ACTIVE" && current.remaining_to_collect > 0 && (
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
              {current.held_amount > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setAction("refund");
                      setActionError(null);
                      setEditingSchedule(false);
                    }}
                    className="h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold"
                  >
                    Refund
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAction("forfeit");
                      setActionError(null);
                      setEditingSchedule(false);
                    }}
                    className="h-9 px-3 rounded-xl border border-rose-200 text-rose-700 text-xs font-bold"
                  >
                    Forfeit
                  </button>
                </>
              )}
              {current.status === "ACTIVE" && current.remaining_to_collect > 0 && current.recovered_amount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setAction("close");
                    setActionError(null);
                    setEditingSchedule(false);
                  }}
                  title="Stop payroll collecting the rest of this plan (e.g. the employee left)"
                  className="h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-600 dark:text-zinc-300"
                >
                  Stop collecting
                </button>
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
            )}

            {editingSchedule && current.status === "ACTIVE" && current.remaining_to_collect > 0 && (
              <div className="mb-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <h4 className="text-sm font-bold mb-3">Edit recovery plan</h4>
                <RecoveryScheduleEditor
                  key={`${current.id}-${current.updated_at}`}
                  remaining={current.remaining_to_collect}
                  initialAmounts={current.installment_schedule ?? []}
                  startPeriodStart={current.next_collection_period_start}
                  startIsExact
                  saving={saving}
                  onSubmit={handleSchedule}
                  onCancel={() => setEditingSchedule(false)}
                />
              </div>
            )}

            {action && (
              <div className="mb-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <DepositActionForm
                  key={`${current.id}-${action}`}
                  action={action}
                  held={current.held_amount}
                  remaining={current.remaining_to_collect}
                  saving={saving}
                  error={actionError}
                  onSubmit={handleAction}
                  onCancel={() => setAction(null)}
                />
              </div>
            )}

            <MoneyOut plan={current} />
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
              <MonthByMonth plan={plan} past />
              <MoneyOut plan={plan} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** "26 Jul – 25 Aug 2026", from the cycle's 26th. */
function cycleDates(periodStart: string): string {
  const start = new Date(`${periodStart.slice(0, 10)}T00:00:00Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 25));
  const fmt = (d: Date, year: boolean) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" });
  return `${fmt(start, false)} – ${fmt(end, true)}`;
}

/** The cycle starting on `periodStart`, n cycles on. */
function cycleAfter(periodStart: string, n: number): string {
  const start = new Date(`${periodStart.slice(0, 10)}T00:00:00Z`);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + n, 26)).toISOString().slice(0, 10);
}

/** TAFSD-459: how much is collected, at a glance. */
function DepositSummary({ plan }: { plan: SecurityDepositPlan }) {
  const pct = plan.total_amount > 0 ? Math.min(100, Math.round((plan.recovered_amount / plan.total_amount) * 100)) : 0;
  const taken = plan.transactions.filter((t) => t.type === "DEDUCTION" && t.amount > 0).length;
  const left = (plan.installment_schedule ?? []).filter((a) => a > 0).length;
  const out = plan.refunded_amount + plan.forfeited_amount;
  return (
    <div className="mb-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[15px] font-extrabold text-zinc-900 dark:text-zinc-100">
          {formatPkr(plan.recovered_amount)} <span className="font-semibold text-zinc-500">of {formatPkr(plan.total_amount)} collected</span>
        </p>
        <p className="text-xs font-bold text-zinc-500">
          {taken} month{taken === 1 ? "" : "s"} taken{plan.remaining_to_collect > 0 ? ` · ${left} to go` : ""}
        </p>
      </div>
      <div className="mt-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
        <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
        {plan.status === "ACTIVE" && plan.remaining_to_collect > 0 && (
          <span className="text-zinc-700 dark:text-zinc-300">
            <span className="font-bold">Next:</span>{" "}
            {plan.next_due_amount > 0 ? formatPkr(plan.next_due_amount) : "nothing (skipped)"} in{" "}
            {formatCycle(cycleKeyFromPeriodStart(plan.next_collection_period_start))} payroll ({cycleDates(plan.next_collection_period_start)})
          </span>
        )}
        <span className="text-zinc-500">
          <span className="font-bold">Still to collect:</span> {formatPkr(plan.remaining_to_collect)}
        </span>
        <span className="text-zinc-500">
          <span className="font-bold">Held now:</span> {formatPkr(plan.held_amount)}
          {out > 0 ? ` (after ${formatPkr(out)} refunded or kept)` : ""}
        </span>
      </div>
    </div>
  );
}

type MonthRow = {
  key: string;
  periodStart: string | null;
  amount: number;
  state: "taken" | "manual" | "skipped" | "next" | "upcoming";
  note?: string | null;
};

const STATE_CHIP: Record<MonthRow["state"], { label: string; cls: string }> = {
  taken: { label: "Taken in payroll", cls: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900" },
  manual: { label: "Taken · recorded by hand", cls: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900" },
  skipped: { label: "Skipped", cls: "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700" },
  next: { label: "Next", cls: "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900" },
  upcoming: { label: "Upcoming", cls: "bg-white text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700" },
};

/**
 * TAFSD-459: every month of the plan in one list, oldest first: what was taken
 * (in payroll or recorded by hand), skipped, and what is still to come.
 */
function MonthByMonth({ plan, past = false }: { plan: SecurityDepositPlan; past?: boolean }) {
  const rows: MonthRow[] = plan.transactions
    .filter((t) => t.type === "DEDUCTION")
    .map((t) => ({
      key: `t${t.id}`,
      periodStart: t.period_start,
      amount: t.amount,
      state: t.due_amount === 0 && t.amount === 0 ? "skipped" : t.recorded_manually || !t.payroll_run_line_id ? "manual" : "taken",
      note: t.reason,
    }));
  if (!past && plan.status === "ACTIVE")
    (plan.installment_schedule ?? []).forEach((amount, i) =>
      rows.push({
        key: `s${i}`,
        periodStart: cycleAfter(plan.next_collection_period_start, i),
        amount,
        state: amount === 0 ? "skipped" : i === 0 ? "next" : "upcoming",
      }),
    );
  if (!rows.length)
    return <p className="mb-4 text-xs text-zinc-400">Nothing collected yet. Each month appears here once payroll takes it.</p>;
  return (
    <div className="mb-4 overflow-x-auto rounded-2xl border border-zinc-100 dark:border-zinc-800">
      <table className="w-full text-left text-[13px]">
        <thead className="bg-zinc-50 dark:bg-zinc-900">
          <tr className="text-[10px] uppercase tracking-wider text-zinc-400">
            <th className="py-2 px-3 font-bold">Payroll month</th>
            <th className="py-2 px-3 font-bold">Dates</th>
            <th className="py-2 px-3 font-bold text-right">Amount</th>
            <th className="py-2 px-3 font-bold">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const chip = STATE_CHIP[r.state];
            const done = r.state === "taken" || r.state === "manual";
            return (
              <tr key={r.key} className={`border-t border-zinc-100 dark:border-zinc-800 ${r.state === "next" ? "bg-blue-50/40 dark:bg-blue-950/20" : ""}`}>
                <td className={`py-2 px-3 font-bold ${done ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-400"}`}>
                  {r.periodStart ? formatCycle(cycleKeyFromPeriodStart(r.periodStart)) : "—"}
                </td>
                <td className="py-2 px-3 text-zinc-500 whitespace-nowrap">{r.periodStart ? cycleDates(r.periodStart) : "—"}</td>
                <td className={`py-2 px-3 text-right tabular-nums font-semibold ${r.state === "skipped" ? "text-zinc-400" : "text-zinc-800 dark:text-zinc-200"}`}>
                  {r.state === "skipped" ? "—" : formatPkr(r.amount)}
                </td>
                <td className="py-2 px-3">
                  <span title={r.note ?? undefined} className={`inline-flex text-[10px] font-bold uppercase tracking-wide border rounded-lg px-2 py-0.5 ${chip.cls}`}>
                    {done ? "✓ " : ""}
                    {chip.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Refunds and forfeits: money paid back or kept by the school. */
function MoneyOut({ plan }: { plan: SecurityDepositPlan }) {
  const rows = plan.transactions.filter((t) => t.type === "REFUND" || t.type === "FORFEIT");
  if (!rows.length) return null;
  return (
    <div className="overflow-x-auto">
      <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Refunded or kept</p>
      <table className="w-full text-left text-xs">
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-t border-zinc-100 dark:border-zinc-800">
              <td className="py-2 pr-3 whitespace-nowrap text-zinc-500">
                {new Date(t.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </td>
              <td className="py-2 pr-3 font-bold">{t.type === "REFUND" ? "Refunded to employee" : "Kept by the school (forfeit)"}</td>
              <td className="py-2 pr-3 text-right tabular-nums font-semibold">{formatPkr(t.amount)}</td>
              <td className="py-2 text-zinc-500">{t.reason || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
