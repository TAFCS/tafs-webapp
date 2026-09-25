"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Building2, Filter, HandCoins, Loader2, Plus, Search, X } from "lucide-react";
import { useAuthState } from "@/context/AuthContext";
import {
  hrService,
  SecurityDepositListItem,
  SecurityDepositStatus,
} from "@/lib/hr.service";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { toggleId } from "@/components/filters/filter-params";
import { useSecurityDepositsAccess } from "@/hooks/use-security-deposits-access";
import { PayrollRangeFields, RecoveryScheduleEditor } from "../_components/RecoveryScheduleEditor";
import { DepositActionForm, DepositActionSubmit } from "../_components/DepositActionForm";
import { clampPayrollRange, cycleKeyFromPeriodStart, defaultPayrollRange, formatCycle, payrollRangeCreatePayload } from "../_components/payroll-cycle";

const inputCls =
  "w-full h-10 px-3 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";
const textareaCls =
  "w-full px-3 py-2 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

// Nothing selected = every open plan (Active + Completed). Closed plans are one click away
// so a refunded or forfeited deposit never just disappears.
const STATUS_OPTIONS: { id: SecurityDepositStatus; label: string }[] = [
  { id: "ACTIVE", label: "Active (collecting)" },
  { id: "COMPLETED", label: "Completed (held)" },
  { id: "REFUNDED", label: "Refunded" },
  { id: "FORFEITED", label: "Forfeited" },
  { id: "PARTIALLY_FORFEITED", label: "Partially forfeited" },
];

const STATUS_HELP: Record<SecurityDepositStatus, string> = {
  ACTIVE: "Still being collected from salary",
  COMPLETED: "Fully collected; the money is held until refunded or forfeited",
  REFUNDED: "Closed — refunded to the employee",
  FORFEITED: "Closed — kept by the school",
  PARTIALLY_FORFEITED: "Closed — part refunded, part kept",
};

function formatPkr(value: number): string {
  return `Rs. ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseApiError(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(". ");
  if (typeof msg === "string" && msg.trim()) return msg;
  return fallback;
}

function statusBadgeClass(status: SecurityDepositStatus): string {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900";
    case "COMPLETED":
      return "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900";
    case "FORFEITED":
      return "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900";
    case "PARTIALLY_FORFEITED":
      return "bg-amber-50 text-amber-800 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900";
    default:
      return "bg-zinc-50 text-zinc-500 border-zinc-100 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700";
  }
}

type PickedEmployee = { id: number; full_name: string | null; employee_code: string | null };

export default function SecurityDepositsPage() {
  const { user } = useAuthState();
  const access = useSecurityDepositsAccess();
  // Nav shows the page on hr.employees.view, but the API checks the tile — accept either
  // so a tile holder is not locked out and nobody lands on an empty error page.
  const canView =
    user?.permissions?.includes("hr.employees.view") || access.hasTile || access.isSuperAdmin || user?.role === "SUPER_ADMIN";

  const [statusFilter, setStatusFilter] = useState<SecurityDepositStatus[]>([]);
  const [search, setSearch] = useState("");
  const [campusFilter, setCampusFilter] = useState("");
  const [items, setItems] = useState<SecurityDepositListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showStart, setShowStart] = useState(false);
  const [picked, setPicked] = useState<PickedEmployee | null>(null);
  const [hasOpenPlan, setHasOpenPlan] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PickedEmployee[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  const [totalAmount, setTotalAmount] = useState("");
  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");
  const [notes, setNotes] = useState("");

  const [actionRow, setActionRow] = useState<SecurityDepositListItem | null>(null);
  const [action, setAction] = useState<"refund" | "forfeit" | "close" | "schedule" | null>(null);
  // Errors from the drawer's own request are shown inside the drawer — the page banner sits under its backdrop.
  const [actionError, setActionError] = useState<string | null>(null);

  const statusKey = statusFilter.join(",");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const selected = statusKey ? (statusKey.split(",") as SecurityDepositStatus[]) : [];
      const lists = selected.length
        ? await Promise.all(selected.map((s) => hrService.listEmployeeSecurityDeposits(s)))
        : [await hrService.listEmployeeSecurityDeposits()];
      setItems(lists.flat());
    } catch (err: unknown) {
      console.error(err);
      setError(parseApiError(err, "Failed to load security deposits."));
    } finally {
      setLoading(false);
    }
  }, [statusKey]);

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

  const previewInstallment = useMemo(() => {
    const total = Number(totalAmount);
    const range = clampPayrollRange(fromMonth, toMonth);
    if (!Number.isFinite(total) || total <= 0 || !range || range.count < 1) return null;
    return Math.floor((total * 100) / range.count) / 100;
  }, [totalAmount, fromMonth, toMonth]);

  const resetStartForm = () => {
    setShowStart(false);
    setPicked(null);
    setHasOpenPlan(false);
    setSearchQuery("");
    setSearchResults([]);
    setTotalAmount("");
    setFromMonth("");
    setToMonth("");
    setNotes("");
  };

  const selectEmployee = async (emp: PickedEmployee) => {
    setPicked(emp);
    setHasOpenPlan(false);
    setSearchQuery("");
    setSearchOpen(false);
    setError(null);
    try {
      const deposit = await hrService.getEmployeeSecurityDeposit(emp.id);
      const range = defaultPayrollRange(deposit.default_start_period_start);
      setFromMonth(range.fromMonth);
      setToMonth(range.toMonth);
      if (deposit.current) {
        setHasOpenPlan(true);
        setError("This employee already has an open security deposit plan.");
      }
    } catch (err: unknown) {
      setError(parseApiError(err, "Failed to load employee deposit details."));
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!access.can("create")) {
      setError("You do not have permission to start a security deposit plan.");
      return;
    }
    if (!picked) {
      setError("Pick an employee first.");
      return;
    }
    if (hasOpenPlan) {
      setError("This employee already has an open security deposit plan.");
      return;
    }
    const total = Number(totalAmount);
    const range = payrollRangeCreatePayload(fromMonth, toMonth);
    if (!Number.isFinite(total) || total <= 0) {
      setError("Enter a total deposit amount.");
      return;
    }
    if (!range) {
      setError("Pick a from and to payroll month.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await hrService.createEmployeeSecurityDeposit(picked.id, {
        total_amount: total,
        installment_count: range.installment_count,
        start_period_start: range.start_period_start,
        notes: notes.trim() || undefined,
      });
      toast.success("Security deposit plan started.");
      // Not blockers, but worth seeing — e.g. installment larger than monthly pay.
      created.warnings?.forEach((w) => toast(w, { icon: "⚠️", duration: 9000 }));
      resetStartForm();
      await load();
    } catch (err: unknown) {
      setError(parseApiError(err, "Failed to start security deposit plan."));
    } finally {
      setSaving(false);
    }
  };

  const closeDrawer = () => {
    setActionRow(null);
    setAction(null);
    setActionError(null);
  };

  const openAction = (row: SecurityDepositListItem, next: "refund" | "forfeit" | "close" | "schedule") => {
    setActionRow(row);
    setAction(next);
    setActionError(null);
    setError(null);
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
      await hrService.updateEmployeeSecurityDepositSchedule(actionRow.employee_id, amounts);
      toast.success("Recovery plan updated.");
      closeDrawer();
      await load();
    } catch (err: unknown) {
      setActionError(parseApiError(err, "Failed to update recovery plan."));
    } finally {
      setSaving(false);
    }
  };

  const handleDepositAction = async ({ amount, note, stopCollection }: DepositActionSubmit) => {
    if (!actionRow || !action || action === "schedule") return;
    if (!access.can(action === "forfeit" ? "forfeit" : action === "refund" ? "refund" : "cancel")) {
      setActionError("You do not have permission to perform this action.");
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      if (action === "refund") {
        await hrService.refundEmployeeSecurityDeposit(actionRow.employee_id, {
          amount,
          notes: note || undefined,
          stop_collection: stopCollection,
        });
        toast.success(stopCollection ? "Refund recorded and collection stopped." : "Refund recorded.");
      } else if (action === "forfeit") {
        await hrService.forfeitEmployeeSecurityDeposit(actionRow.employee_id, {
          amount,
          reason: note,
          stop_collection: stopCollection,
        });
        toast.success(stopCollection ? "Forfeiture recorded and collection stopped." : "Forfeiture recorded.");
      } else {
        await hrService.closeEmployeeSecurityDeposit(actionRow.employee_id, note || undefined);
        toast.success("Collection stopped.");
      }
      closeDrawer();
      await load();
    } catch (err: unknown) {
      setActionError(parseApiError(err, "Failed to record that action."));
    } finally {
      setSaving(false);
    }
  };

  const campuses = useMemo(
    () => Array.from(new Set(items.map((r) => r.campus_name).filter((c): c is string => !!c))).sort(),
    [items],
  );

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((row) => {
      if (campusFilter && row.campus_name !== campusFilter) return false;
      if (!q) return true;
      return (
        (row.full_name ?? "").toLowerCase().includes(q) ||
        (row.employee_code ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, search, campusFilter]);

  const totals = useMemo(
    () =>
      visibleItems.reduce(
        (acc, row) => ({
          target: acc.target + row.total_amount,
          recovered: acc.recovered + row.recovered_amount,
          held: acc.held + row.held_amount,
          remaining: acc.remaining + row.remaining_to_collect,
        }),
        { target: 0, recovered: 0, held: 0, remaining: 0 },
      ),
    [visibleItems],
  );

  if (!canView) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center text-zinc-500">
        You do not have permission to view security deposits.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <HandCoins className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Security Deposits</h1>
            <p className="text-sm text-zinc-500">Open caution-money plans across employees</p>
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
            <Plus className="h-4 w-4" /> Start plan
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or code..."
            aria-label="Search plans by employee name or code"
            className={`${inputCls} pl-9`}
          />
        </div>
        <div className="w-[200px]">
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
        {campuses.length > 1 && (
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
            <select
              value={campusFilter}
              onChange={(e) => setCampusFilter(e.target.value)}
              aria-label="Filter by campus"
              className={`${inputCls} pl-9 pr-8 w-52`}
            >
              <option value="">All campuses</option>
              {campuses.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}
        <p className="text-xs text-zinc-400">
          {statusFilter.length === 0 ? "Showing open plans (collecting or held)." : `Showing ${statusFilter.map((s) => s.replaceAll("_", " ").toLowerCase()).join(", ")}.`}
        </p>
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
            <h2 className="text-sm font-bold">Start a plan</h2>
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
              <button type="button" onClick={() => { setPicked(null); setHasOpenPlan(false); setFromMonth(""); setToMonth(""); }} className="text-zinc-400 hover:text-rose-500">
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
            <PayrollRangeFields
              fromMonth={fromMonth}
              toMonth={toMonth}
              onChange={(from, to) => {
                setFromMonth(from);
                setToMonth(to);
              }}
            />
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Notes</label>
              <textarea rows={2} className={textareaCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          {previewInstallment != null && (
            <p className="text-xs text-zinc-500">
              About {formatPkr(previewInstallment)} per month. The last installment is capped so rounding never overshoots the total.
            </p>
          )}
          <button
            type="submit"
            disabled={saving || !picked || hasOpenPlan}
            className="h-10 px-4 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-60"
          >
            {saving ? "Starting..." : "Start plan"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          {items.length > 0
            ? "No plans match your search or campus filter."
            : statusFilter.length > 0
              ? "No plans with that status."
              : "No open security deposit plans."}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                <th className="px-4 py-3 font-bold">Employee</th>
                <th className="px-4 py-3 font-bold text-right">Target</th>
                <th className="px-4 py-3 font-bold text-right">Recovered</th>
                <th className="px-4 py-3 font-bold text-right">Held</th>
                <th className="px-4 py-3 font-bold text-right">Left to collect</th>
                <th className="px-4 py-3 font-bold">Next payroll</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((row) => (
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
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {formatPkr(row.recovered_amount)}
                    {row.total_amount > 0 && (
                      <div
                        className="mt-1 h-1 w-24 ml-auto rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden"
                        role="progressbar"
                        aria-label="Recovered share of target"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.min(100, Math.round((row.recovered_amount / row.total_amount) * 100))}
                      >
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${Math.min(100, (row.recovered_amount / row.total_amount) * 100)}%` }}
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap font-semibold">{formatPkr(row.held_amount)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {formatPkr(row.remaining_to_collect)}
                    {row.carried_forward_amount > 0 && (
                      <p className="text-[10px] text-amber-700 dark:text-amber-400">incl. {formatPkr(row.carried_forward_amount)} carried</p>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs">
                    {row.status === "ACTIVE" && row.remaining_to_collect > 0 ? (
                      <>
                        <span className={`font-semibold ${row.next_due_amount === 0 ? "text-zinc-400 italic" : ""}`}>
                          {row.next_due_amount === 0 ? "Skip" : formatPkr(row.next_due_amount)}
                        </span>
                        <p className="text-zinc-400">{formatCycle(cycleKeyFromPeriodStart(row.next_collection_period_start))}</p>
                      </>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span title={STATUS_HELP[row.status]} className={`inline-flex text-[10px] font-bold uppercase tracking-wide border rounded-lg px-2 py-1 ${statusBadgeClass(row.status)}`}>
                      {row.status.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex gap-2">
                      {row.status === "ACTIVE" && row.remaining_to_collect > 0 && access.can("schedule.edit") && (
                        <button
                          type="button"
                          onClick={() => openAction(row, "schedule")}
                          className="h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-bold"
                        >
                          Edit plan
                        </button>
                      )}
                      {row.status === "ACTIVE" && row.remaining_to_collect > 0 && row.recovered_amount > 0 && access.can("cancel") && (
                        <button
                          type="button"
                          onClick={() => openAction(row, "close")}
                          title="Stop payroll collecting the rest of this plan (e.g. the employee left)"
                          className="h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-600 dark:text-zinc-300"
                        >
                          Stop collecting
                        </button>
                      )}
                      {row.held_amount > 0 && (
                        <>
                          {access.can("refund") && (
                            <button
                              type="button"
                              onClick={() => openAction(row, "refund")}
                              className="h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-bold"
                            >
                              Refund
                            </button>
                          )}
                          {access.can("forfeit") && (
                            <button
                              type="button"
                              onClick={() => openAction(row, "forfeit")}
                              className="h-8 px-2 rounded-lg border border-rose-200 text-rose-700 text-xs font-bold"
                            >
                              Forfeit
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-zinc-200 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-900/60 text-sm font-bold">
                <td className="px-4 py-3">Total ({visibleItems.length} plan{visibleItems.length === 1 ? "" : "s"})</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">{formatPkr(totals.target)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">{formatPkr(totals.recovered)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap" title="Money currently held for employees — a liability until refunded or forfeited">{formatPkr(totals.held)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">{formatPkr(totals.remaining)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {actionRow && action && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label={action === "schedule" ? "Edit recovery plan" : action === "close" ? "Stop collecting" : action === "refund" ? "Refund deposit" : "Forfeit deposit"}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={closeDrawer}
            aria-label="Close"
          />
          <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 h-full shadow-xl overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {action === "schedule" ? "Edit recovery plan" : action === "close" ? "Stop collecting" : action === "refund" ? "Refund" : "Forfeit"}
              </h2>
              <button type="button" onClick={closeDrawer} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-zinc-500">
              {actionRow.full_name ?? "Employee"}
              {actionRow.employee_code ? ` (${actionRow.employee_code})` : ""}. Held {formatPkr(actionRow.held_amount)}
              {actionRow.remaining_to_collect > 0 ? `; still to collect ${formatPkr(actionRow.remaining_to_collect)}` : ""}.
            </p>
            {action === "schedule" ? (
              <>
                <RecoveryScheduleEditor
                  key={actionRow.id}
                  remaining={actionRow.remaining_to_collect}
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
              </>
            ) : (
              <DepositActionForm
                key={`${actionRow.id}-${action}`}
                action={action}
                held={actionRow.held_amount}
                remaining={actionRow.remaining_to_collect}
                saving={saving}
                error={actionError}
                onSubmit={handleDepositAction}
                onCancel={closeDrawer}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
