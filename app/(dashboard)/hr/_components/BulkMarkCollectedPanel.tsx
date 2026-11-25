"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { hrService, type BulkMarkCollectedResult } from "@/lib/hr.service";
import { cycleKeyFromPeriodStart, formatCycle } from "./payroll-cycle";
import { apiErrorMessage, cycleDateRange, cycleHasStarted } from "./MarkCollectedForm";

type Row = {
  employee_id: number;
  full_name: string | null;
  employee_code: string | null;
  campus_name: string | null;
  next_collection_period_start: string;
  next_due_amount: number;
};

interface Props {
  kind: "security-deposits" | "employee-loans";
  onClose: () => void;
  /** Called after a run that marked anything, so the page reloads its list. */
  onDone: () => void;
}

function formatPkr(value: number): string {
  return `Rs. ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const inputCls =
  "w-full h-9 px-3 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

/**
 * TAFSD-589: mark one payroll month's installment collected outside payroll for
 * everyone whose next installment is that month. Each employee is marked on
 * their own; anyone the server refuses (already marked, a different month now
 * due, out of scope) is listed with the reason and nobody is charged twice.
 */
export function BulkMarkCollectedPanel({ kind, onClose, onDone }: Props) {
  const label = kind === "security-deposits" ? "security deposit" : "loan";
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cycle, setCycle] = useState<string>("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(BulkMarkCollectedResult & { names: Record<number, string>; month: string }) | null>(null);

  const fetchRows = useCallback(async () => {
    try {
      const list =
        kind === "security-deposits"
          ? await hrService.listEmployeeSecurityDeposits("ACTIVE")
          : await hrService.listEmployeeLoans("ACTIVE");
      const due: Row[] = list
        .filter((r) => r.status === "ACTIVE" && cycleHasStarted(r.next_collection_period_start))
        .map((r) => ({
          employee_id: r.employee_id,
          full_name: r.full_name,
          employee_code: r.employee_code,
          campus_name: r.campus_name,
          next_collection_period_start: r.next_collection_period_start.slice(0, 10),
          next_due_amount: r.next_due_amount ?? 0,
        }));
      setRows(due);
      // Keep the month picked while anyone is still due in it; otherwise the earliest left.
      const left = [...new Set(due.map((r) => r.next_collection_period_start))].sort();
      setCycle((prev) => (left.includes(prev) ? prev : left[0] ?? ""));
    } catch (err) {
      setLoadError(apiErrorMessage(err, `Failed to load ${label} plans.`));
    }
  }, [kind, label]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const cycles = useMemo(() => [...new Set((rows ?? []).map((r) => r.next_collection_period_start))].sort(), [rows]);
  const inCycle = useMemo(
    () =>
      (rows ?? [])
        .filter((r) => r.next_collection_period_start === cycle)
        .sort((a, b) => (a.campus_name ?? "").localeCompare(b.campus_name ?? "") || (a.employee_code ?? "").localeCompare(b.employee_code ?? "")),
    [rows, cycle],
  );

  // Picking a month selects everyone due in it, at the scheduled amount.
  useEffect(() => {
    setSelected(new Set(inCycle.map((r) => r.employee_id)));
    setAmounts(Object.fromEntries(inCycle.map((r) => [r.employee_id, String(r.next_due_amount)])));
  }, [inCycle]);

  const chosen = inCycle.filter((r) => selected.has(r.employee_id));
  const total = chosen.reduce((s, r) => s + (Number(amounts[r.employee_id]) || 0), 0);
  const nameOf = (id: number) => {
    const r = inCycle.find((x) => x.employee_id === id);
    return r ? `${r.full_name ?? "Employee"}${r.employee_code ? ` (${r.employee_code})` : ""}` : `Employee ${id}`;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      setError("Add a note: how this month was collected.");
      return;
    }
    if (!chosen.length) {
      setError("Tick at least one employee.");
      return;
    }
    const bad = chosen.find((r) => {
      const v = Number(amounts[r.employee_id]);
      return r.next_due_amount > 0 ? !Number.isFinite(v) || v <= 0 || v > r.next_due_amount : v !== 0;
    });
    if (bad) {
      setError(`Check the amount for ${nameOf(bad.employee_id)}: between 1 and ${formatPkr(bad.next_due_amount)}.`);
      return;
    }
    if (!confirm(`Mark ${formatCycle(cycleKeyFromPeriodStart(cycle))} collected for ${chosen.length} employee(s), ${formatPkr(total)} in total?`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await hrService.markInstallmentsCollectedBulk(kind, {
        period_start: cycle,
        notes: notes.trim(),
        items: chosen.map((r) => ({ employee_id: r.employee_id, amount: Number(amounts[r.employee_id]) })),
      });
      const names = Object.fromEntries(inCycle.map((r) => [r.employee_id, `${r.full_name ?? "Employee"}${r.employee_code ? ` (${r.employee_code})` : ""}`]));
      setResult({ ...res, names, month: formatCycle(cycleKeyFromPeriodStart(cycle)) });
      // Marked plans have moved on to their next month; reload what is due.
      if (res.marked > 0) {
        setNotes("");
        await fetchRows();
        onDone();
      }
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to mark installments collected."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">Mark a month&apos;s {label} installments collected</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            For a month taken outside payroll (for example a payroll done on paper). Each plan&apos;s slot is used up the
            way a finalized payroll would use it, so payroll for that month deducts nothing and the next payroll takes
            the following month.
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <X className="h-4 w-4" />
        </button>
      </div>

      {loadError && <p className="text-sm text-rose-600">{loadError}</p>}
      {result && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 text-sm space-y-1">
          <p className="font-bold">
            {result.month}: marked {result.marked}, {formatPkr(result.total_amount)}.{result.failed > 0 ? ` ${result.failed} refused:` : ""}
          </p>
          {result.results
            .filter((r) => !r.ok)
            .map((r) => (
              <p key={r.employee_id} className="text-xs text-rose-600">
                {result.names[r.employee_id] ?? `Employee ${r.employee_id}`}: {r.error}
              </p>
            ))}
        </div>
      )}

      {!rows && !loadError && (
        <p className="text-sm text-zinc-500 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading plans...
        </p>
      )}
      {rows && cycles.length === 0 && <p className="text-sm text-zinc-500">No {label} installment is due for a month that has started.</p>}

      {rows && cycles.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2">
            {cycles.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setCycle(c);
                  setResult(null);
                }}
                className={`h-8 px-3 rounded-lg border text-xs font-bold ${c === cycle ? "border-primary bg-primary/10 text-primary" : "border-zinc-200 dark:border-zinc-700"}`}
              >
                {formatCycle(cycleKeyFromPeriodStart(c))} · {(rows ?? []).filter((r) => r.next_collection_period_start === c).length}
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-500">
            {cycleDateRange(cycle)}: {inCycle.length} employee(s) have this month as their next installment. A 0 is a month
            HR skipped; marking it records the skip.
          </p>

          <div className="overflow-x-auto rounded-xl border border-zinc-100 dark:border-zinc-800 max-h-[420px] overflow-y-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-zinc-50 dark:bg-zinc-900 sticky top-0">
                <tr className="text-[10px] uppercase tracking-wider text-zinc-400">
                  <th className="py-2 px-3">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={chosen.length === inCycle.length && inCycle.length > 0}
                      onChange={(e) => setSelected(new Set(e.target.checked ? inCycle.map((r) => r.employee_id) : []))}
                    />
                  </th>
                  <th className="py-2 px-3 font-bold">Employee</th>
                  <th className="py-2 px-3 font-bold">Campus</th>
                  <th className="py-2 px-3 font-bold text-right">Due</th>
                  <th className="py-2 px-3 font-bold w-40">Collected</th>
                </tr>
              </thead>
              <tbody>
                {inCycle.map((r) => (
                  <tr key={r.employee_id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="py-2 px-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${r.full_name ?? r.employee_id}`}
                        checked={selected.has(r.employee_id)}
                        onChange={(e) =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(r.employee_id);
                            else next.delete(r.employee_id);
                            return next;
                          })
                        }
                      />
                    </td>
                    <td className="py-2 px-3">
                      <span className="font-semibold">{r.full_name ?? "—"}</span>
                      <span className="text-xs text-zinc-500 ml-2">{r.employee_code}</span>
                    </td>
                    <td className="py-2 px-3 text-zinc-500">{r.campus_name ?? "—"}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{r.next_due_amount > 0 ? formatPkr(r.next_due_amount) : "skipped"}</td>
                    <td className="py-2 px-3">
                      {r.next_due_amount > 0 ? (
                        <input
                          className={inputCls}
                          inputMode="decimal"
                          value={amounts[r.employee_id] ?? ""}
                          onChange={(e) => setAmounts((prev) => ({ ...prev, [r.employee_id]: e.target.value }))}
                        />
                      ) : (
                        <span className="text-xs text-zinc-400">records the skip</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Note (required)</label>
            <input className={inputCls} value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. October payroll was done on paper" />
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving || chosen.length === 0} className="h-9 px-4 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-60">
              {saving ? "Marking..." : `Mark ${chosen.length} collected`}
            </button>
            <span className="text-xs text-zinc-500">{formatPkr(total)} in total</span>
          </div>
        </>
      )}
    </form>
  );
}
