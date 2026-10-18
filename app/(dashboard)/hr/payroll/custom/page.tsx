"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle, ArrowLeft, Building2, CalendarRange, CheckCircle2, Info, Loader2, Users, X,
} from "lucide-react";
import { hrService, EmployeeProfile, GenerateCustomPayrollRunResult } from "@/lib/hr.service";
import { formatEmployeeCodeDisplay } from "@/lib/employee-code";
import { usePayrollAccess } from "@/hooks/use-payroll-access";
import { EmployeeDirectoryFilterBar, useEmployeeDirectoryFilters } from "../../_shared/employee-directory-filters";

/** Same cap as the backend (MAX_MATRIX_DAYS): two pay cycles. */
const MAX_DAYS = 62;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function daysInclusive(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(`${start}T00:00:00Z`).getTime();
  const e = new Date(`${end}T00:00:00Z`).getTime();
  return Math.floor((e - s) / 86_400_000) + 1;
}

export default function CustomPayrollPage() {
  const router = useRouter();
  const access = usePayrollAccess();
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateCustomPayrollRunResult | null>(null);
  const [generating, setGenerating] = useState(false);

  // Default: the current calendar month, the most common custom window (1st -> end of month).
  const [periodStart, setPeriodStart] = useState(() => {
    const now = new Date();
    return isoDay(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [periodEnd, setPeriodEnd] = useState(() => {
    const now = new Date();
    return isoDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  });
  const [notes, setNotes] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    hrService
      .listEmployeesSummary()
      .then(setEmployees)
      .catch((err) => {
        console.error(err);
        setError("Failed to load employees.");
      })
      .finally(() => setLoading(false));
  }, []);

  const filters = useEmployeeDirectoryFilters(employees);
  const shown = filters.filtered;
  const payable = (e: EmployeeProfile) => e.monthly_pay != null && (e.campus_id ?? e.campuses?.id) != null;
  const shownPayableIds = useMemo(() => shown.filter(payable).map((e) => e.id), [shown]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allShownSelected = shownPayableIds.length > 0 && shownPayableIds.every((id) => selectedSet.has(id));

  const selectedEmployees = useMemo(() => employees.filter((e) => selectedSet.has(e.id)), [employees, selectedSet]);
  const selectedCampuses = useMemo(() => {
    const map = new Map<number, string>();
    selectedEmployees.forEach((e) => {
      const id = e.campus_id ?? e.campuses?.id;
      if (id != null) map.set(id, e.campuses?.campus_name ?? `Campus #${id}`);
    });
    return [...map.values()];
  }, [selectedEmployees]);

  const dayCount = daysInclusive(periodStart, periodEnd);
  const rangeError =
    !periodStart || !periodEnd
      ? "Pick a start and end date."
      : dayCount < 1
        ? "The end date must be on or after the start date."
        : dayCount > MAX_DAYS
          ? `A custom run can cover at most ${MAX_DAYS} days.`
          : null;

  const toggle = (id: number) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleAllShown = () =>
    setSelectedIds((prev) =>
      allShownSelected
        ? prev.filter((id) => !shownPayableIds.includes(id))
        : [...new Set([...prev, ...shownPayableIds])],
    );

  const handleGenerate = async () => {
    if (rangeError || selectedIds.length === 0) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await hrService.generateCustomPayrollRun({
        employee_ids: selectedIds,
        period_start: periodStart,
        period_end: periodEnd,
        notes: notes.trim() || undefined,
      });
      if (res.runs.length === 1) {
        router.push(`/hr/payroll/${res.runs[0].run_id}`);
        return;
      }
      setResult(res);
    } catch (err: unknown) {
      console.error(err);
      const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
      setError(Array.isArray(message) ? message.join(" ") : message || "Failed to generate the custom payroll run.");
    } finally {
      setGenerating(false);
    }
  };

  if (access.hasTile && !access.can("generate")) {
    return (
      <div className="p-12 text-center bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-xl mx-auto">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Permission Denied</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Generating payroll has been restricted by your administrator.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-28">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/hr/payroll" className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500" aria-label="Back to payroll">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="p-2.5 bg-sky-50 dark:bg-sky-950/30 rounded-2xl">
          <CalendarRange className="h-6 w-6 text-sky-600 dark:text-sky-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Custom Payroll</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Pay chosen employees for a date range of your choice, e.g. 1st to 30th for O/A part-time teachers.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl p-4 text-sm dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400">
          <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5" />
          <p className="flex-1 whitespace-pre-line">{error}</p>
          <button onClick={() => setError(null)} aria-label="Dismiss"><X className="h-4 w-4 opacity-50 hover:opacity-100" /></button>
        </div>
      )}

      {result && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl p-4 text-sm dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-300 space-y-2">
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Generated {result.runs.length} custom runs for {formatDay(result.period_start)} – {formatDay(result.period_end)}, one per campus:
          </p>
          <ul className="pl-7 space-y-1">
            {result.runs.map((r) => {
              const name = employees.find((e) => (e.campus_id ?? e.campuses?.id) === r.campus_id)?.campuses?.campus_name ?? `Campus #${r.campus_id}`;
              return (
                <li key={r.run_id}>
                  <Link href={`/hr/payroll/${r.run_id}`} className="underline font-semibold">{name}</Link>
                  {` · ${r.touched} calculated`}
                  {r.finalized > 0 && ` · ${r.finalized} already finalized, left as is`}
                  {r.excluded > 0 && ` · ${r.excluded} excluded from this run, skipped`}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Step 1: dates */}
      <section className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-4">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white">1. Pay period</h2>
        <div className="flex flex-wrap items-end gap-4">
          <label className="space-y-1.5">
            <span className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">From</span>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <label className="space-y-1.5">
            <span className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">To (inclusive)</span>
            <input
              type="date"
              value={periodEnd}
              min={periodStart || undefined}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <div className="h-11 flex items-center text-sm">
            {rangeError ? (
              <span className="text-rose-600 dark:text-rose-400 font-semibold">{rangeError}</span>
            ) : (
              <span className="text-zinc-600 dark:text-zinc-300">
                <strong>{dayCount} days</strong> · {formatDay(periodStart)} – {formatDay(periodEnd)}
              </span>
            )}
          </div>
          <label className="space-y-1.5 flex-1 min-w-[220px]">
            <span className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">Notes (optional)</span>
            <input
              type="text"
              value={notes}
              placeholder="e.g. O/A part-time, October"
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
        </div>
        <div className="flex items-start gap-2 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl p-3">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5 text-sky-500" />
          <p>
            The range counts as <strong>one salary month</strong>: each employee earns their monthly pay, and a missed day is
            deducted at monthly pay ÷ {dayCount > 0 && !rangeError ? dayCount : "days in the range"}. EOBI, SESSI, income tax,
            loan and security deposit installments apply as in a normal month.
            <br />
            An employee can&apos;t be on two payroll runs whose dates overlap. Anyone already on one (for example the
            campus&apos;s 26th–25th run) is refused by name: exclude them from that run first. Later, the regular campus run
            leaves out anyone already paid by a custom run.
          </p>
        </div>
      </section>

      {/* Step 2: employees */}
      <section className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white">2. Employees</h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {shown.length} shown · <strong className="text-zinc-800 dark:text-zinc-200">{selectedIds.length} selected</strong>
          </span>
        </div>

        <EmployeeDirectoryFilterBar filters={filters} />

        <div className="flex items-center justify-between gap-3 pt-1">
          <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={allShownSelected}
              disabled={shownPayableIds.length === 0}
              onChange={toggleAllShown}
              className="h-4 w-4 accent-sky-600"
            />
            Select all {shownPayableIds.length} shown
          </label>
          {selectedIds.length > 0 && (
            <button onClick={() => setSelectedIds([])} className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
              Clear selection
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-12 flex items-center justify-center text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading employees…
          </div>
        ) : shown.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-400">No employees match these filters.</p>
        ) : (
          <div className="max-h-[480px] overflow-y-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
            {shown.map((emp) => {
              const canPay = payable(emp);
              const checked = selectedSet.has(emp.id);
              return (
                <label
                  key={emp.id}
                  className={`flex items-center gap-3 px-4 py-2.5 ${canPay ? "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50" : "opacity-50 cursor-not-allowed"} ${checked ? "bg-sky-50/60 dark:bg-sky-950/20" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!canPay}
                    onChange={() => toggle(emp.id)}
                    className="h-4 w-4 accent-sky-600 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                      {emp.full_name || emp.users?.full_name || `Employee #${emp.id}`}
                    </p>
                    <p className="text-xs text-zinc-400 truncate">
                      <span className="font-mono">{formatEmployeeCodeDisplay(emp) || "—"}</span>
                      {[emp.departments?.name, emp.segments?.name, emp.campuses?.campus_name].filter(Boolean).map((v) => ` · ${v}`)}
                    </p>
                  </div>
                  {!canPay && (
                    <span className="text-[10px] font-bold uppercase text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded-full">
                      {emp.monthly_pay == null ? "No monthly pay" : "No campus"}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </section>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-zinc-600 dark:text-zinc-300 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /><strong>{selectedIds.length}</strong> employees</span>
            {selectedCampuses.length > 0 && (
              <span className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4" />
                {selectedCampuses.length === 1 ? selectedCampuses[0] : `${selectedCampuses.length} campuses: one run each`}
              </span>
            )}
            {!rangeError && <span className="flex items-center gap-1.5"><CalendarRange className="h-4 w-4" />{formatDay(periodStart)} – {formatDay(periodEnd)}</span>}
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating || !!rangeError || selectedIds.length === 0}
            className="h-11 px-6 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating && <Loader2 className="h-4 w-4 animate-spin" />}
            {generating ? "Calculating…" : "Generate custom payroll"}
          </button>
        </div>
      </div>
    </div>
  );
}
