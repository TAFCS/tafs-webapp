"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Banknote, Filter, Loader2, Plus, Search, X } from "lucide-react";
import { useAuthState } from "@/context/AuthContext";
import {
  hrService,
  LoanListItem,
  LoanStatus,
} from "@/lib/hr.service";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { toggleId } from "@/components/filters/filter-params";
import { useEmployeeLoansAccess } from "@/hooks/use-employee-loans-access";
import {
  MonthAmounts,
  PayrollMonthPicker,
  RecoveryScheduleEditor,
  checkMonthAmounts,
  monthPlanCreatePayload,
} from "../_components/RecoveryScheduleEditor";
import { currentCycleKey, cycleKeyFromPeriodStart } from "../_components/payroll-cycle";

const inputCls =
  "w-full h-10 px-3 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";
const textareaCls =
  "w-full px-3 py-2 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

const STATUS_OPTIONS: { id: "ACTIVE" | "OUTSTANDING"; label: string }[] = [
  { id: "ACTIVE", label: "Active" },
  { id: "OUTSTANDING", label: "Outstanding" },
];

function formatPkr(value: number): string {
  return `Rs. ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseApiError(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(". ");
  if (typeof msg === "string" && msg.trim()) return msg;
  return fallback;
}

function statusBadgeClass(status: LoanStatus): string {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900";
    case "OUTSTANDING":
      return "bg-amber-50 text-amber-800 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900";
    default:
      return "bg-zinc-50 text-zinc-500 border-zinc-100 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700";
  }
}

type PickedEmployee = { id: number; full_name: string | null; employee_code: string | null };

export default function EmployeeLoansPage() {
  const { user } = useAuthState();
  const canView =
    user?.permissions?.includes("hr.employees.view") || user?.role === "SUPER_ADMIN";
  const access = useEmployeeLoansAccess();

  const [statusFilter, setStatusFilter] = useState<("ACTIVE" | "OUTSTANDING")[]>([]);
  const [items, setItems] = useState<LoanListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showStart, setShowStart] = useState(false);
  const [picked, setPicked] = useState<PickedEmployee | null>(null);
  const [hasOpenLoan, setHasOpenLoan] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PickedEmployee[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  const [totalAmount, setTotalAmount] = useState("");
  const [months, setMonths] = useState<MonthAmounts>({});
  const [defaultStart, setDefaultStart] = useState<string | null>(null);
  const [openingRepaid, setOpeningRepaid] = useState("");
  const [disbursementDate, setDisbursementDate] = useState("");
  const [notes, setNotes] = useState("");

  const [actionRow, setActionRow] = useState<LoanListItem | null>(null);
  const [action, setAction] = useState<"lump-sum" | "write-off" | "schedule" | null>(null);
  const [actionAmount, setActionAmount] = useState("");
  const [actionNote, setActionNote] = useState("");
  // Errors from the drawer's own request are shown inside the drawer — the page banner sits under its backdrop.
  const [actionError, setActionError] = useState<string | null>(null);

  const statusParam = statusFilter.length === 1 ? statusFilter[0] : undefined;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await hrService.listEmployeeLoans(statusParam));
    } catch (err: unknown) {
      console.error(err);
      setError(parseApiError(err, "Failed to load loans."));
    } finally {
      setLoading(false);
    }
  }, [statusParam]);

  useEffect(() => {
    if (canView) load();
  }, [load, canView]);

  useEffect(() => {
    if (!action) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [action]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!showStart || picked || q.length < 1) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await hrService.searchSimple(q);
        if (!cancelled) {
          setSearchResults(data);
          setSearchOpen(true);
        }
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, showStart, picked]);

  // Payroll recovers what is left after the opening repayment.
  const toRecover = (() => {
    const total = Number(totalAmount);
    const opening = Number(openingRepaid || 0);
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(opening) || opening < 0 || opening >= total) return 0;
    return Math.round((total - opening) * 100) / 100;
  })();
  const minMonth = defaultStart ? cycleKeyFromPeriodStart(defaultStart) : currentCycleKey();

  const resetStartForm = () => {
    setShowStart(false);
    setPicked(null);
    setHasOpenLoan(false);
    setSearchQuery("");
    setSearchResults([]);
    setTotalAmount("");
    setMonths({});
    setDefaultStart(null);
    setOpeningRepaid("");
    setDisbursementDate("");
    setNotes("");
  };

  const selectEmployee = async (emp: PickedEmployee) => {
    setPicked(emp);
    setHasOpenLoan(false);
    setSearchQuery("");
    setSearchOpen(false);
    setError(null);
    try {
      const loan = await hrService.getEmployeeLoan(emp.id);
      setDefaultStart(loan.default_start_period_start);
      if (loan.current) {
        setHasOpenLoan(true);
        setError("This employee already has an open loan.");
      }
    } catch (err: unknown) {
      setError(parseApiError(err, "Failed to load employee loan details."));
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!access.can("create")) {
      setError("You do not have permission to issue a loan.");
      return;
    }
    if (!picked) {
      setError("Pick an employee first.");
      return;
    }
    if (hasOpenLoan) {
      setError("This employee already has an open loan.");
      return;
    }
    const total = Number(totalAmount);
    const opening = Number(openingRepaid || 0);
    if (!Number.isFinite(total) || total <= 0) {
      setError("Enter a total loan amount.");
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
    const check = checkMonthAmounts(months, toRecover);
    const plan = monthPlanCreatePayload(months);
    if (!check.ok || !plan) {
      setError(check.problem ?? "Pick the months to recover in.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await hrService.createEmployeeLoan(picked.id, {
        total_amount: total,
        ...plan,
        amount_repaid_opening: opening || undefined,
        disbursement_date: disbursementDate || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success("Loan recorded.");
      resetStartForm();
      await load();
    } catch (err: unknown) {
      setError(parseApiError(err, "Failed to record loan."));
    } finally {
      setSaving(false);
    }
  };

  const openAction = (row: LoanListItem, next: "lump-sum" | "write-off" | "schedule") => {
    setActionRow(row);
    setAction(next);
    setActionAmount(next === "schedule" ? "" : String(row.outstanding_balance));
    setActionNote("");
    setActionError(null);
    setError(null);
  };

  const closeDrawer = () => {
    setActionRow(null);
    setAction(null);
    setActionError(null);
  };

  const handleSchedule = async (amounts: number[]) => {
    if (!actionRow) return;
    if (!access.can("schedule.edit")) {
      setActionError("You do not have permission to edit the recovery plan.");
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      await hrService.updateEmployeeLoanSchedule(actionRow.employee_id, amounts);
      toast.success("Recovery plan updated.");
      closeDrawer();
      await load();
    } catch (err: unknown) {
      setActionError(parseApiError(err, "Failed to update recovery plan."));
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (e: FormEvent) => {
    e.preventDefault();
    if (!actionRow || !action) return;
    if (!access.can(action === "lump-sum" ? "repay" : "write_off")) {
      setActionError("You do not have permission to perform this action.");
      return;
    }
    const amount = Number(actionAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setActionError("Enter an amount greater than zero.");
      return;
    }
    if (amount > actionRow.outstanding_balance) {
      setActionError(`That is more than the ${formatPkr(actionRow.outstanding_balance)} outstanding.`);
      return;
    }
    if (action === "write-off" && !actionNote.trim()) {
      setActionError("A reason is required to write off a loan.");
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      if (action === "lump-sum") {
        await hrService.repayLoanLumpSum(actionRow.employee_id, {
          amount,
          notes: actionNote.trim() || undefined,
        });
        toast.success("Lump-sum repayment recorded.");
      } else {
        await hrService.writeOffLoan(actionRow.employee_id, {
          amount,
          reason: actionNote.trim(),
        });
        toast.success("Write-off recorded.");
      }
      closeDrawer();
      await load();
    } catch (err: unknown) {
      setActionError(parseApiError(err, "Failed to record that action."));
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center text-zinc-500">
        You do not have permission to view employee loans.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Banknote className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Employee Loans</h1>
            <p className="text-sm text-zinc-500">Open salary-advance loans across employees</p>
          </div>
        </div>
        {access.can("create") && (
          <button
            type="button"
            onClick={() => {
              setShowStart(true);
              setError(null);
            }}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-white text-sm font-bold"
          >
            <Plus className="h-4 w-4" /> Record loan
          </button>
        )}
      </div>

      <div className="w-[180px]">
        <FilterDropdown
          label="Status"
          icon={Filter}
          value={statusFilter}
          options={STATUS_OPTIONS}
          placeholder="All open"
          onToggle={(id) => setStatusFilter((prev) => toggleId(prev, id))}
          onClear={() => setStatusFilter([])}
        />
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {showStart && access.can("create") && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Record a loan</h2>
            <button type="button" onClick={resetStartForm} aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          {picked ? (
            <div className="flex items-center gap-2 h-10 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
              <span className="flex-1 text-sm truncate">
                {picked.full_name ?? "Employee"}
                {picked.employee_code ? ` (${picked.employee_code})` : ""}
              </span>
              <button type="button" onClick={() => { setPicked(null); setHasOpenLoan(false); setDefaultStart(null); setMonths({}); setError(null); }} className="text-zinc-400 hover:text-rose-500">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="relative" ref={searchWrapRef}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or employee code..."
                className={`${inputCls} pl-9`}
              />
              {searchOpen && (
                <div className="absolute z-20 mt-1 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg max-h-56 overflow-y-auto">
                  {searching && (
                    <p className="px-3 py-2 text-xs text-zinc-400">Searching...</p>
                  )}
                  {!searching && searchResults.length === 0 && (
                    <p className="px-3 py-2 text-xs text-zinc-400">No employees found.</p>
                  )}
                  {searchResults.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => selectEmployee(emp)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      {emp.full_name ?? "Employee"}
                      {emp.employee_code ? (
                        <span className="text-zinc-500 ml-2">({emp.employee_code})</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Total amount</label>
              <input className={inputCls} inputMode="decimal" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="50000" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Already repaid (opening)</label>
              <input className={inputCls} inputMode="decimal" value={openingRepaid} onChange={(e) => setOpeningRepaid(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Disbursement date</label>
              <input type="date" className={inputCls} value={disbursementDate} onChange={(e) => setDisbursementDate(e.target.value)} />
            </div>
            <div className="sm:col-span-3">
              <PayrollMonthPicker
                total={toRecover}
                value={months}
                onChange={setMonths}
                minMonth={minMonth}
                totalLabel={Number(openingRepaid || 0) > 0 ? "amount left after the opening repayment" : "total"}
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Notes / reason</label>
              <textarea rows={2} className={textareaCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving || !picked || hasOpenLoan}
            className="h-10 px-4 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-60"
          >
            {saving ? "Saving..." : "Record loan"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">No open loans.</div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                <th className="px-4 py-3 font-bold">Employee</th>
                <th className="px-4 py-3 font-bold text-right">Target</th>
                <th className="px-4 py-3 font-bold text-right">Recovered</th>
                <th className="px-4 py-3 font-bold text-right">Outstanding</th>
                <th className="px-4 py-3 font-bold text-right">Carry</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-3">
                    <Link href={`/hr/employees?id=${row.employee_id}`} className="font-semibold hover:text-primary">
                      {row.full_name ?? "Employee"}
                    </Link>
                    {row.employee_code && (
                      <span className="text-zinc-500 font-normal ml-2">({row.employee_code})</span>
                    )}
                    {row.campus_name && (
                      <p className="text-xs text-zinc-400 mt-0.5">{row.campus_name}</p>
                    )}
                    <p className="text-xs text-zinc-400">
                      {(row.installment_schedule?.length
                        ? `${row.installment_schedule.length} remaining month${row.installment_schedule.length === 1 ? "" : "s"}`
                        : `${formatPkr(row.installment_amount)} x ${row.installment_count}`)} from {row.start_period_start}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{formatPkr(row.total_amount)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{formatPkr(row.recovered_amount)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{formatPkr(row.outstanding_balance)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{formatPkr(row.carried_forward_amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex text-[10px] font-bold uppercase tracking-wide border rounded-lg px-2 py-1 ${statusBadgeClass(row.status)}`}>
                      {row.status.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {row.outstanding_balance > 0 && (
                      <div className="inline-flex gap-2">
                        {row.status === "ACTIVE" && access.can("schedule.edit") && (
                          <button
                            type="button"
                            onClick={() => openAction(row, "schedule")}
                            className="h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-bold"
                          >
                            Edit plan
                          </button>
                        )}
                        {access.can("repay") && (
                          <button
                            type="button"
                            onClick={() => openAction(row, "lump-sum")}
                            className="h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-bold"
                          >
                            Lump sum
                          </button>
                        )}
                        {access.can("write_off") && (
                          <button
                            type="button"
                            onClick={() => openAction(row, "write-off")}
                            className="h-8 px-2 rounded-lg border border-rose-200 text-rose-700 text-xs font-bold"
                          >
                            Write off
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {actionRow && action && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label={action === "schedule" ? "Edit recovery plan" : action === "lump-sum" ? "Lump-sum repayment" : "Write off"}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={closeDrawer}
            aria-label="Close"
          />
          {action === "schedule" ? (
            <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 h-full shadow-xl overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Edit recovery plan</h2>
                <button type="button" onClick={closeDrawer} aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-zinc-500">
                {actionRow.full_name ?? "Employee"}
                {actionRow.employee_code ? ` (${actionRow.employee_code})` : ""}. Outstanding {formatPkr(actionRow.outstanding_balance)}.
              </p>
              <RecoveryScheduleEditor
                key={actionRow.id}
                remaining={actionRow.outstanding_balance}
                initialAmounts={actionRow.installment_schedule ?? []}
                startPeriodStart={actionRow.next_collection_period_start}
                startIsExact
                saving={saving}
                onSubmit={handleSchedule}
                onCancel={closeDrawer}
              />
              {actionError && (
                <p role="alert" className="text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900 rounded-xl px-3 py-2">
                  {actionError}
                </p>
              )}
            </div>
          ) : (
            <form
              onSubmit={handleAction}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 h-full shadow-xl overflow-y-auto p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{action === "lump-sum" ? "Lump-sum repayment" : "Write off"}</h2>
                <button type="button" onClick={closeDrawer} aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-zinc-500">
                {actionRow.full_name ?? "Employee"}
                {actionRow.employee_code ? ` (${actionRow.employee_code})` : ""}. Outstanding {formatPkr(actionRow.outstanding_balance)}.
              </p>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  {action === "lump-sum" ? "Repayment amount" : "Write-off amount"}
                </label>
                <input className={inputCls} inputMode="decimal" value={actionAmount} onChange={(e) => setActionAmount(e.target.value)} />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  {action === "write-off" ? "Reason (required)" : "Notes"}
                </label>
                <textarea rows={3} className={textareaCls} value={actionNote} onChange={(e) => setActionNote(e.target.value)} />
              </div>
              {actionError && (
                <p role="alert" className="text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900 rounded-xl px-3 py-2">
                  {actionError}
                </p>
              )}
              <button
                type="submit"
                disabled={saving}
                className="w-full h-10 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-60"
              >
                {saving ? "Saving..." : action === "lump-sum" ? "Record repayment" : "Record write-off"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
