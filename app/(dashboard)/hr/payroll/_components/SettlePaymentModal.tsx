"use client";

import { useMemo, useState } from "react";
import { X, Loader2, AlertCircle, CheckCircle2, Clock, Banknote, FileText, ExternalLink } from "lucide-react";
import { hrService, OvertimeRateType, PayrollRunLine } from "@/lib/hr.service";

interface Props {
  runId: number;
  line: PayrollRunLine;
  onClose: () => void;
  onSettled: (line: PayrollRunLine) => void;
}

const RATE_OPTIONS: { value: OvertimeRateType; label: string }[] = [
  { value: "PER_MINUTE", label: "Per minute" },
  { value: "PER_HOUR", label: "Per hour" },
  { value: "PER_DAY", label: "Per day" },
];

function formatMinutes(minutes: number): string {
  const m = Math.round(minutes);
  if (m <= 0) return "0m";
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h === 0) return `${rm}m`;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

function formatPkr(value: number): string {
  return `₨ ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function SettlePaymentModal({ runId, line, onClose, onSettled }: Props) {
  const emp = line.employee_profiles;
  const name = emp?.full_name ?? `Employee #${line.employee_id}`;
  const alreadySettled = !!line.payroll_settlements;

  const [addOvertime, setAddOvertime] = useState(!!line.payroll_settlements?.overtime_rate_type);
  const [rateType, setRateType] = useState<OvertimeRateType>(line.payroll_settlements?.overtime_rate_type ?? "PER_HOUR");
  const [rateAmount, setRateAmount] = useState<string>(
    line.payroll_settlements?.overtime_rate_amount != null ? String(line.payroll_settlements.overtime_rate_amount) : "",
  );
  const [addBonus, setAddBonus] = useState(!!line.payroll_settlements && line.payroll_settlements.cash_bonus_amount > 0);
  const [cashBonus, setCashBonus] = useState<string>(
    line.payroll_settlements && line.payroll_settlements.cash_bonus_amount > 0 ? String(line.payroll_settlements.cash_bonus_amount) : "",
  );
  const [notes, setNotes] = useState(line.disbursement_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PayrollRunLine | null>(null);

  const overtimeMinutes = line.total_overtime_minutes ?? 0;
  const scheduledMinutesPerDay = line.scheduled_minutes_per_day || 480;

  const previewReward = useMemo(() => {
    if (!addOvertime) return 0;
    const rate = Number(rateAmount);
    if (!rate || rate < 0) return 0;
    if (rateType === "PER_MINUTE") return rate * overtimeMinutes;
    if (rateType === "PER_HOUR") return (rate * overtimeMinutes) / 60;
    return (rate * overtimeMinutes) / scheduledMinutesPerDay;
  }, [addOvertime, rateType, rateAmount, overtimeMinutes, scheduledMinutesPerDay]);

  const previewNetPaid = Number(line.net_pay) + previewReward;

  const handleConfirm = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await hrService.settlePayrollLine(runId, line.employee_id, {
        notes: notes || undefined,
        overtime:
          addOvertime && rateAmount
            ? { rate_type: rateType, rate_amount: Number(rateAmount) }
            : undefined,
        cash_bonus_amount: addBonus && cashBonus ? Number(cashBonus) : undefined,
      });
      setResult(updated);
      onSettled(updated);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to settle payment.");
    } finally {
      setSaving(false);
    }
  };

  const settlement = result?.payroll_settlements ?? line.payroll_settlements;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
          <div>
            <p className="text-[15px] font-black text-zinc-900 dark:text-zinc-100">{name}</p>
            <p className="text-[11px] text-zinc-400 font-mono">{emp?.employee_code ?? "—"}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {result ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl p-4 text-sm dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                <p className="flex-1">Payment settled and payslip generated.</p>
              </div>
              <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">Net pay</span>
                  <span className="font-semibold text-zinc-900 dark:text-white">{formatPkr(Number(line.net_pay))}</span>
                </div>
                {settlement && settlement.overtime_reward_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500 dark:text-zinc-400">Overtime reward</span>
                    <span className="font-semibold text-amber-600">+{formatPkr(settlement.overtime_reward_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="font-bold text-zinc-700 dark:text-zinc-300">Total paid</span>
                  <span className="font-black text-zinc-900 dark:text-white">{formatPkr(settlement?.net_paid ?? previewNetPaid)}</span>
                </div>
                {settlement && settlement.cash_bonus_amount > 0 && (
                  <p className="text-[11px] text-violet-600 dark:text-violet-400 pt-1">
                    Cash bonus of {formatPkr(settlement.cash_bonus_amount)} recorded internally — not shown on the payslip.
                  </p>
                )}
              </div>
              {settlement?.payslip_pdf_url ? (
                <a
                  href={settlement.payslip_pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200"
                >
                  <FileText className="h-4 w-4" /> View Payslip <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <p className="text-xs text-amber-600 text-center">
                  Settled, but the payslip PDF failed to generate — try settling again to retry.
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Breakdown */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/50 p-3">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Net Pay</p>
                  <p className="text-lg font-black text-zinc-900 dark:text-white">{formatPkr(Number(line.net_pay))}</p>
                </div>
                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/50 p-3">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Overtime Worked
                  </p>
                  <p className="text-lg font-black text-zinc-900 dark:text-white">{formatMinutes(overtimeMinutes)}</p>
                </div>
              </div>

              {alreadySettled && (
                <div className="flex items-center gap-2 px-3 py-2 bg-sky-50 border border-sky-100 text-sky-700 rounded-xl text-xs dark:bg-sky-950/20 dark:border-sky-900/30 dark:text-sky-400">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Already settled — confirming again will re-settle and regenerate the payslip with these numbers.
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{error}</span>
                </div>
              )}

              {/* Overtime reward */}
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/10 p-3.5 space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
                    <Clock className="h-4 w-4" /> Add overtime reward
                  </span>
                  <input
                    type="checkbox"
                    checked={addOvertime}
                    onChange={(e) => setAddOvertime(e.target.checked)}
                    disabled={overtimeMinutes === 0}
                    className="h-4 w-4 accent-amber-600"
                  />
                </label>
                {overtimeMinutes === 0 && (
                  <p className="text-[11px] text-amber-700/70 dark:text-amber-400/70">No overtime recorded for this period.</p>
                )}
                {addOvertime && overtimeMinutes > 0 && (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/80 dark:text-amber-400/80 uppercase tracking-wide">
                          Rate Type
                        </label>
                        <select
                          value={rateType}
                          onChange={(e) => setRateType(e.target.value as OvertimeRateType)}
                          className="w-full h-9 px-2 bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-800 rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-300"
                        >
                          {RATE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-amber-700/80 dark:text-amber-400/80 uppercase tracking-wide">
                          Rate Amount (₨)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={rateAmount}
                          onChange={(e) => setRateAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full h-9 px-2 bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-800 rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-300"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">
                      {formatMinutes(overtimeMinutes)} of overtime → reward ≈ <strong>{formatPkr(previewReward)}</strong>
                    </p>
                  </div>
                )}
              </div>

              {/* Cash bonus */}
              <div className="rounded-xl border border-violet-200 dark:border-violet-900/40 bg-violet-50/50 dark:bg-violet-950/10 p-3.5 space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="flex items-center gap-2 text-sm font-semibold text-violet-800 dark:text-violet-300">
                    <Banknote className="h-4 w-4" /> Add cash bonus
                  </span>
                  <input
                    type="checkbox"
                    checked={addBonus}
                    onChange={(e) => setAddBonus(e.target.checked)}
                    className="h-4 w-4 accent-violet-600"
                  />
                </label>
                <p className="text-[11px] text-violet-700/80 dark:text-violet-400/80">
                  Paid by hand, off the books — recorded only for internal bookkeeping. Never appears on the payslip or to the employee.
                </p>
                {addBonus && (
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={cashBonus}
                    onChange={(e) => setCashBonus(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-9 px-2 bg-white dark:bg-zinc-900 border border-violet-200 dark:border-violet-800 rounded-lg text-xs outline-none focus:ring-2 focus:ring-violet-300"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Notes (optional)</label>
                <textarea
                  rows={2}
                  placeholder="Internal notes about this settlement…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm resize-none focus:border-primary"
                />
              </div>

              <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/50 p-3.5 flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Total to pay</span>
                <span className="text-lg font-black text-zinc-900 dark:text-white">{formatPkr(previewNetPaid)}</span>
              </div>
            </>
          )}
        </div>

        {!result && (
          <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 h-11 rounded-xl text-zinc-600 dark:text-zinc-400 font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving}
              className="px-6 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {saving ? "Settling…" : "Confirm & Settle"}
            </button>
          </div>
        )}
        {result && (
          <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-6 h-11 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold rounded-xl text-sm"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
