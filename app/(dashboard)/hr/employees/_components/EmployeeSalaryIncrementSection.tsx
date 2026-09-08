"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { BadgePercent, CalendarClock, Loader2, X } from "lucide-react";
import {
  hrService,
  SalaryIncrementEmployeeStatus,
  SalaryIncrementHistory,
  SalaryIncrementMode,
} from "@/lib/hr.service";

const inputCls =
  "h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const money = (n: number | null | undefined) =>
  `Rs. ${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

function errMessage(err: unknown, fallback: string): string {
  const res = (err as { response?: { data?: { message?: string } } })?.response;
  return res?.data?.message || fallback;
}

/** Mirror of the backend pay math so the modal can preview without a round-trip. */
function computeNewPay(pay: number, mode: SalaryIncrementMode, value: number) {
  const raw = mode === "PERCENTAGE" ? pay * (1 + value / 100) : pay + value;
  return Math.round((raw + Number.EPSILON) * 100) / 100;
}

const STATUS_STYLES: Record<string, string> = {
  DUE: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
  UPCOMING:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  OK: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  MISSING_ANCHOR:
    "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400",
};

function statusHeadline(s: SalaryIncrementEmployeeStatus): string {
  const m = s.months_remaining;
  if (s.status === "MISSING_ANCHOR")
    return "Add a joining date or first increment to start the cycle";
  if (m == null) return "Not eligible for a due date yet";
  if (m <= 0) {
    const overdue = Math.abs(m);
    return overdue === 0 ? "Due this month" : `Overdue by ${overdue} month${overdue === 1 ? "" : "s"}`;
  }
  return `Next increment in ${m} month${m === 1 ? "" : "s"}`;
}

export function EmployeeSalaryIncrementSection({
  employeeId,
  monthlyPay,
  cycleOverride,
  canManage,
  onApplied,
}: {
  employeeId: number;
  monthlyPay: number | null;
  /** employee_profiles.increment_cycle_months — null when the org default applies. */
  cycleOverride: number | null | undefined;
  canManage: boolean;
  onApplied?: () => void;
}) {
  const [status, setStatus] = useState<SalaryIncrementEmployeeStatus | null>(null);
  const [history, setHistory] = useState<SalaryIncrementHistory[]>([]);
  const [orgDefault, setOrgDefault] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [cycleInput, setCycleInput] = useState<string>(
    cycleOverride != null ? String(cycleOverride) : "",
  );
  const [savingCycle, setSavingCycle] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<SalaryIncrementMode>("PERCENTAGE");
  const [value, setValue] = useState("");
  const [effective, setEffective] = useState(today());
  const [notes, setNotes] = useState("");
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setUnavailable(false);
    const [st, hist, settings] = await Promise.allSettled([
      hrService.getSalaryIncrementStatus(employeeId),
      hrService.listSalaryIncrements(employeeId),
      hrService.getSalaryIncrementSettings(),
    ]);
    if (st.status === "fulfilled") setStatus(st.value);
    if (hist.status === "fulfilled") setHistory(hist.value);
    if (settings.status === "fulfilled") setOrgDefault(settings.value.default_cycle_months);
    if (st.status === "rejected" && hist.status === "rejected") setUnavailable(true);
    setLoading(false);
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const previewPay = useMemo(() => {
    const v = Number(value);
    if (!monthlyPay || !v || v <= 0) return null;
    return computeNewPay(monthlyPay, mode, v);
  }, [monthlyPay, mode, value]);

  const saveCycle = async (next: number | null) => {
    setSavingCycle(true);
    try {
      await hrService.updateEmployeeIncrementCycle(employeeId, next);
      toast.success(next == null ? "Reverted to the organisation cycle." : "Increment cycle updated.");
      await load();
    } catch (err) {
      toast.error(errMessage(err, "Could not update the increment cycle."));
    } finally {
      setSavingCycle(false);
    }
  };

  const submitCycle = () => {
    const trimmed = cycleInput.trim();
    if (trimmed === "") return saveCycle(null);
    const n = Number(trimmed);
    if (!Number.isInteger(n) || n < 1 || n > 120) {
      toast.error("Cycle must be a whole number from 1 to 120 months.");
      return;
    }
    void saveCycle(n);
  };

  const applyIncrement = async () => {
    const v = Number(value);
    if (!v || v <= 0) return toast.error("Enter a positive amount.");
    if (!effective) return toast.error("Choose an effective date.");
    setApplying(true);
    try {
      const res = await hrService.applySalaryIncrement({
        employee_ids: [employeeId],
        mode,
        ...(mode === "PERCENTAGE" ? { percentage: v } : { fixed_amount: v }),
        effective_from: effective,
        notes: notes.trim() || undefined,
      });
      if (res.failures.length) {
        toast.error(res.failures[0].error || "The increment could not be applied.");
      } else {
        toast.success("Salary increment applied.");
        setShowModal(false);
        setValue("");
        setNotes("");
        setEffective(today());
        await load();
        onApplied?.();
      }
    } catch (err) {
      toast.error(errMessage(err, "The increment could not be applied."));
    } finally {
      setApplying(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center gap-2 rounded-xl border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-700">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading salary increment status…
      </div>
    );

  if (unavailable)
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        Salary increment tracking is not available yet. Deploy the matching backend release and run its
        database migration.
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BadgePercent className="h-4 w-4 text-amber-600" />
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-zinc-500">Salary increment</h3>
      </div>

      {status && (
        <div className={`rounded-xl border p-4 ${STATUS_STYLES[status.status] ?? STATUS_STYLES.OK}`}>
          <p className="text-sm font-bold">{statusHeadline(status)}</p>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
            <span>
              Cycle: <strong>{status.cycle_months} months</strong>
            </span>
            <span>
              Anchor: <strong>{status.anchor_date ?? "—"}</strong>
            </span>
            <span>
              Next due: <strong>{status.next_due_date ?? "—"}</strong>
            </span>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <label className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-200">
          Cycle override (months)
        </label>
        <p className="mt-0.5 text-xs text-zinc-500">
          Leave blank to use the organisation default{orgDefault != null ? ` (${orgDefault} months)` : ""}.
          Any whole number from 1 to 120.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            max={120}
            disabled={!canManage || savingCycle}
            className={`${inputCls} w-40`}
            placeholder={orgDefault != null ? `Default: ${orgDefault}` : "Org default"}
            value={cycleInput}
            onChange={(e) => setCycleInput(e.target.value)}
          />
          {canManage && (
            <button
              type="button"
              onClick={submitCycle}
              disabled={savingCycle}
              className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {savingCycle ? "Saving…" : "Save"}
            </button>
          )}
          {canManage && cycleInput.trim() !== "" && (
            <button
              type="button"
              onClick={() => {
                setCycleInput("");
                void saveCycle(null);
              }}
              disabled={savingCycle}
              className="h-10 rounded-xl border border-zinc-200 px-4 text-sm font-semibold text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
            >
              Use org default
            </button>
          )}
        </div>
      </div>

      {canManage && (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          disabled={monthlyPay == null}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50"
        >
          <CalendarClock className="h-4 w-4" />
          Give increment
        </button>
      )}
      {canManage && monthlyPay == null && (
        <p className="text-xs text-rose-600">Set a monthly pay before applying an increment.</p>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
        <div className="border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-700">
          <h4 className="text-[13px] font-bold text-zinc-700 dark:text-zinc-200">Increment history</h4>
        </div>
        {history.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-zinc-500">No increments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="p-3">Effective</th>
                  <th>Method</th>
                  <th>Pay change</th>
                  <th>Applied by</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="p-3 tabular-nums">{row.effective_from}</td>
                    <td>
                      {row.mode === "PERCENTAGE"
                        ? `${Number(row.percentage ?? 0)}%`
                        : money(Number(row.fixed_amount ?? 0))}
                      {row.notes && (
                        <span className="block text-xs text-zinc-400">{row.notes}</span>
                      )}
                    </td>
                    <td>
                      {money(Number(row.previous_pay))} →{" "}
                      <strong className="text-emerald-600">{money(Number(row.new_pay))}</strong>
                    </td>
                    <td>{row.applied_by ?? "System"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 dark:bg-zinc-900">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold">Give salary increment</h3>
                <p className="text-sm text-zinc-500">
                  Current pay: {money(monthlyPay)}
                </p>
              </div>
              <button type="button" onClick={() => setShowModal(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold">Method</label>
                <select
                  className={inputCls}
                  value={mode}
                  onChange={(e) => setMode(e.target.value as SalaryIncrementMode)}
                >
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED_AMOUNT">Fixed PKR amount</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold">
                  {mode === "PERCENTAGE" ? "Percentage" : "Amount (PKR)"}
                </label>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  className={inputCls}
                  placeholder={mode === "PERCENTAGE" ? "e.g. 10" : "e.g. 5000"}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Effective from</label>
                <input
                  type="date"
                  className={inputCls}
                  value={effective}
                  onChange={(e) => setEffective(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Notes (optional)</label>
                <input
                  className={inputCls}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              {previewPay != null && (
                <div className="rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-800">
                  New monthly pay:{" "}
                  <strong className="text-emerald-600">{money(previewPay)}</strong>{" "}
                  <span className="text-zinc-500">
                    (+{money(previewPay - (monthlyPay ?? 0))}/mo · +
                    {money((previewPay - (monthlyPay ?? 0)) * 12)}/yr)
                  </span>
                </div>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold dark:border-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyIncrement}
                disabled={applying || previewPay == null}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {applying ? "Applying…" : "Confirm and apply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
