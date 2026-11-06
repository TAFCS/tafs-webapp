"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet, Plus, Loader2, AlertCircle, CheckCircle2, X, ChevronDown,
  Building2, Users, AlertTriangle, Calendar, FlaskConical, CalendarRange,
} from "lucide-react";
import { hrService, PayrollRun, GeneratePayrollRunPayload, EmployeeProfile, PayrollSkippedEmployee } from "@/lib/hr.service";
import { formatEmployeeCodeDisplay } from "@/lib/employee-code";
import { EmployeeDirectoryFilterBar, useEmployeeDirectoryFilters } from "../_shared/employee-directory-filters";
import { campusesService, Campus } from "@/lib/campuses.service";
import { usePayrollAccess } from "@/hooks/use-payroll-access";

/** TAFSD-458: what generating for picked employees did on one campus. */
type GenerateResult = {
  campusName: string;
  runId?: number;
  touched?: number;
  skipped: PayrollSkippedEmployee[];
  error?: string;
};

/** Known QA fixtures — surfaced first in the test-mode employee picker. */
const KNOWN_TEST_EMPLOYEE_CODES = ["EMP-MHM-001", "TEST-HASHIR-001"];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date, withYear: boolean) =>
    `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}${withYear ? ` ${d.getUTCFullYear()}` : ""}`;
  return `${fmt(s, s.getUTCFullYear() !== e.getUTCFullYear())} – ${fmt(e, true)}`;
}

function formatPkr(value: number | null | undefined): string {
  if (value == null) return "—";
  return `₨ ${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function apiMessage(err: unknown): string | null {
  const m = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return Array.isArray(m) ? m.join("; ") : typeof m === "string" ? m : null;
}

function CustomBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400">
      <CalendarRange className="h-3 w-3" /> Custom
    </span>
  );
}

function StatusBadge({ status }: { status: PayrollRun["status"] }) {
  const isFinal = status === "FINALIZED";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        isFinal
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
          : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
      }`}
    >
      {isFinal ? "Complete" : "Incomplete"}
    </span>
  );
}

function TestBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400">
      <FlaskConical className="h-3 w-3" /> Test
    </span>
  );
}

export default function PayrollPage() {
  const router = useRouter();
  const access = usePayrollAccess();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const now = new Date();
  const [form, setForm] = useState<GeneratePayrollRunPayload>({
    campus_id: 0,
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    notes: "",
  });
  const [isTest, setIsTest] = useState(false);
  // TAFSD-458: a real run covers the whole campus, or only employees picked
  // with the same filters as the Employee Directory / Custom Payroll.
  const [onlySelected, setOnlySelected] = useState(false);
  const showPicker = isTest || onlySelected;
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Loaded independently: the campus list only feeds the Generate picker,
      // and a caller without campus read access must still see their runs.
      const [runResult, campusResult] = await Promise.allSettled([hrService.listPayrollRuns(), campusesService.list()]);
      if (campusResult.status === "fulfilled") {
        const campusList = campusResult.value;
        setCampuses(campusList);
        if (campusList.length > 0) setForm((f) => (f.campus_id ? f : { ...f, campus_id: campusList[0].id }));
      } else {
        console.error(campusResult.reason);
      }
      if (runResult.status === "rejected") throw runResult.reason;
      setRuns(runResult.value);
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch payroll runs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!showPicker || employees.length > 0) return;
    setEmployeesLoading(true);
    hrService
      .listEmployeesSummary()
      .then((list) => setEmployees(list))
      .catch((err) => console.error(err))
      .finally(() => setEmployeesLoading(false));
  }, [showPicker, employees.length]);

  // TAFSD-458: the picker lists every campus; each campus gets its own run.
  // Mirrors the backend roster (generateRun) so a pick it would refuse shows
  // here, disabled, with the reason, instead of failing the generate.
  const cycleStart = useMemo(() => Date.UTC(form.year, form.month - 2, 26), [form.year, form.month]);
  const unpayableReason = useCallback(
    (e: EmployeeProfile): string | null => {
      if ((e.campus_id ?? e.campuses?.id) == null) return "No campus";
      if (e.monthly_pay == null) return "No monthly pay";
      if (isTest) return null;
      if (e.payroll_enabled === false) return "Payroll off";
      const status = e.employment_status ?? "ACTIVE";
      if (status === "ACTIVE") return null;
      if (status === "LEFT" || status === "TERMINATED") {
        const left = e.date_of_leaving ? Date.parse(e.date_of_leaving.slice(0, 10)) : NaN;
        return !isNaN(left) && left >= cycleStart ? null : "Left before cycle";
      }
      return String(status).replace(/_/g, " ");
    },
    [isTest, cycleStart],
  );
  const filters = useEmployeeDirectoryFilters(employees);
  const shownEmployees = useMemo(() => {
    if (!isTest) return filters.filtered;
    // Known QA fixtures float to the top of the test picker so they're easy to find.
    const known = (e: EmployeeProfile) => (KNOWN_TEST_EMPLOYEE_CODES.includes(e.employee_code ?? "") ? 0 : 1);
    return [...filters.filtered].sort((a, b) => known(a) - known(b));
  }, [filters.filtered, isTest]);
  const shownIds = useMemo(
    () => shownEmployees.filter((e) => !unpayableReason(e)).map((e) => e.id),
    [shownEmployees, unpayableReason],
  );
  const selectedSet = useMemo(() => new Set(selectedEmployeeIds), [selectedEmployeeIds]);
  const allShownSelected = shownIds.length > 0 && shownIds.every((id) => selectedSet.has(id));
  // Only picks that are payable right now are sent (switching off Test run can make some unpayable).
  const pickedByCampus = useMemo(() => {
    const groups = new Map<number, { name: string; ids: number[] }>();
    for (const e of employees) {
      if (!selectedSet.has(e.id) || unpayableReason(e)) continue;
      const campusId = (e.campus_id ?? e.campuses?.id)!;
      const g = groups.get(campusId) ?? { name: e.campuses?.campus_name ?? `Campus #${campusId}`, ids: [] };
      g.ids.push(e.id);
      groups.set(campusId, g);
    }
    return groups;
  }, [employees, selectedSet, unpayableReason]);
  const pickedCount = useMemo(() => [...pickedByCampus.values()].reduce((n, g) => n + g.ids.length, 0), [pickedByCampus]);
  const [results, setResults] = useState<GenerateResult[] | null>(null);

  const toggleEmployee = (id: number) => {
    setSelectedEmployeeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleAllShown = () =>
    setSelectedEmployeeIds((prev) =>
      allShownSelected ? prev.filter((id) => !shownIds.includes(id)) : [...new Set([...prev, ...shownIds])],
    );

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 4000);
    return () => clearTimeout(t);
  }, [success]);

  const closeModal = () => {
    setShowModal(false);
    setIsTest(false);
    setOnlySelected(false);
    setSelectedEmployeeIds([]);
    setResults(null);
    filters.clear();
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (generating) return;
    if (showPicker) {
      await generateForPicked();
      return;
    }
    if (!form.campus_id) {
      setError("Select a campus first.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const run = await hrService.generatePayrollRun({ ...form, notes: form.notes || undefined });
      closeModal();
      router.push(`/hr/payroll/${run.id}`);
    } catch (err: any) {
      console.error(err);
      setError(apiMessage(err) || "Failed to generate payroll run.");
    } finally {
      setGenerating(false);
    }
  };

  // TAFSD-458: one run per campus of the picked employees. Each campus is
  // generated on its own, so one failing doesn't lose the others.
  const generateForPicked = async () => {
    if (pickedCount === 0) {
      setError(isTest ? "Select at least one employee for the test run." : "Select at least one employee, or generate for the whole campus.");
      return;
    }
    setGenerating(true);
    setError(null);
    const out: GenerateResult[] = [];
    for (const [campusId, group] of pickedByCampus) {
      try {
        const run = await hrService.generatePayrollRun({
          campus_id: campusId,
          year: form.year,
          month: form.month,
          notes: form.notes || undefined,
          ...(isTest ? { employee_ids: group.ids } : { only_employee_ids: group.ids }),
        });
        out.push({
          campusName: group.name,
          runId: run.id,
          touched: run.touched_count ?? group.ids.length,
          skipped: run.skipped_employees ?? [],
        });
      } catch (err: unknown) {
        console.error(err);
        out.push({ campusName: group.name, skipped: [], error: apiMessage(err) || "Failed to generate payroll run." });
      }
    }
    setGenerating(false);
    void fetchData();
    const only = out[0];
    if (out.length === 1 && only.runId && !only.error && only.skipped.length === 0) {
      closeModal();
      router.push(`/hr/payroll/${only.runId}`);
      return;
    }
    setResults(out);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-primary/10 rounded-2xl">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Payroll</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Generate and review monthly payroll runs from attendance data</p>
          </div>
        </div>

        {access.can("generate") && (
          <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => router.push("/hr/payroll/custom")}
            title="Pay chosen employees for any date range, e.g. 1st to 30th"
            className="inline-flex items-center justify-center h-11 px-5 bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:hover:bg-sky-950/50 dark:text-sky-300 font-semibold rounded-xl transition-all active:scale-95 text-sm"
          >
            <CalendarRange className="h-4 w-4 mr-2" />
            Custom Payroll
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center h-11 px-5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-white font-semibold rounded-xl shadow-sm transition-all active:scale-95 text-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Generate Payroll
          </button>
          </div>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl p-4 text-sm dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400">
          <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0" />
          <p className="flex-1">{error}</p>
          <button onClick={() => setError(null)}><X className="h-4 w-4 opacity-50 hover:opacity-100" /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl p-4 text-sm dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
          <p className="flex-1">{success}</p>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="bg-white dark:bg-zinc-900/30 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-12 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Loading payroll runs…</p>
        </div>
      ) : runs.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900/30 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-12 text-center max-w-xl mx-auto">
          <Wallet className="h-12 w-12 text-zinc-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">No Payroll Runs Yet</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-6">
            Generate a payroll run for a campus and month — it covers the 26th of the previous month through the 25th of that month.
          </p>
          {access.can("generate") && (
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/95 transition-all"
            >
              Generate First Payroll Run
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {runs.map((run) => (
            <button
              key={run.id}
              onClick={() => router.push(`/hr/payroll/${run.id}`)}
              className="w-full text-left bg-white dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5 hover:shadow-md hover:border-zinc-200 dark:hover:border-zinc-700 transition-all duration-200 active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 text-zinc-900 dark:text-white font-bold">
                  <Calendar className="h-4 w-4 text-primary" />
                  {formatPeriod(run.period_start, run.period_end)}
                </div>
                <div className="flex items-center gap-1.5">
                  {run.is_test && <TestBadge />}
                  {run.kind === "CUSTOM" && <CustomBadge />}
                  <StatusBadge status={run.status} />
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                <Building2 className="h-3 w-3" />
                {run.campuses?.campus_name ?? `Campus #${run.campus_id}`}
                <span className="mx-1">·</span>
                <Users className="h-3 w-3" />
                {run._count?.payroll_run_lines ?? 0} employees
              </div>

              <div className="flex items-end justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Net Pay</p>
                  <p className="text-lg font-black text-zinc-900 dark:text-white">{formatPkr(run.totals?.net_pay)}</p>
                </div>
                {!!run.totals?.unresolved_days && run.totals.unresolved_days > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded-full">
                    <AlertTriangle className="h-3 w-3" />
                    {run.totals.unresolved_days} unresolved
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Generate Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${showPicker ? "max-w-5xl" : "max-w-md"}`}>
            {results ? (
              <GenerateResults results={results} onOpen={(id) => { closeModal(); router.push(`/hr/payroll/${id}`); }} onClose={closeModal} />
            ) : (
            <form onSubmit={handleGenerate} className="max-h-[92vh] flex flex-col">
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Generate Payroll Run</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Covers the 26th of the previous month through the 25th of the selected month — that's the fixed school payroll cycle.
                </p>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto min-h-0">
                {showPicker ? (
                  <p className="text-[11px] text-zinc-500">
                    Pick employees from any campus below. Each campus gets its own run for this month.
                  </p>
                ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Campus</label>
                  <div className="relative">
                    <select
                      required
                      className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm focus:border-primary appearance-none"
                      value={form.campus_id || ""}
                      onChange={(e) => setForm({ ...form, campus_id: Number(e.target.value) })}
                    >
                      <option value="" disabled>-- Select Campus --</option>
                      {campuses.map((c) => (
                        <option key={c.id} value={c.id}>{c.campus_name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                  </div>
                </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Month</label>
                    <div className="relative">
                      <select
                        className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm focus:border-primary appearance-none"
                        value={form.month}
                        onChange={(e) => setForm({ ...form, month: Number(e.target.value) })}
                      >
                        {MONTHS.map((m, idx) => (
                          <option key={m} value={idx + 1}>{m}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Year</label>
                    <input
                      type="number"
                      required
                      className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm focus:border-primary"
                      value={form.year}
                      onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Notes (optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Internal notes about this run…"
                    className="w-full p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm resize-none focus:border-primary"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>

                <p className="text-[11px] text-zinc-400 dark:text-zinc-600 italic">
                  Re-generating for the same campus + month recomputes every still-pending employee in place — it won't create a duplicate, and finalized/settled employees are left untouched.
                </p>

                {!isTest && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Employees</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: false, label: "Whole campus", sub: "Every payable employee" },
                        { value: true, label: "Only selected", sub: "Pick with filters below" },
                      ].map((opt) => (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => setOnlySelected(opt.value)}
                          className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${
                            onlySelected === opt.value
                              ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-900"
                              : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                          }`}
                        >
                          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{opt.label}</p>
                          <p className="text-[11px] text-zinc-500">{opt.sub}</p>
                        </button>
                      ))}
                    </div>
                    {onlySelected && (
                      <p className="text-[11px] text-zinc-500">
                        Adds or recomputes only the selected employees on this campus&apos;s run. Everyone else on the run is left as it is; generate for the whole campus later to fill them in.
                      </p>
                    )}
                  </div>
                )}

                {/* Test mode */}
                <div className="rounded-xl border border-violet-200 dark:border-violet-900/40 bg-violet-50/50 dark:bg-violet-950/10 p-3.5 space-y-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="flex items-center gap-2 text-sm font-semibold text-violet-800 dark:text-violet-300">
                      <FlaskConical className="h-4 w-4" /> Test run
                    </span>
                    <input
                      type="checkbox"
                      checked={isTest}
                      onChange={(e) => {
                        setIsTest(e.target.checked);
                        if (!e.target.checked) setSelectedEmployeeIds([]);
                      }}
                      className="h-4 w-4 accent-violet-600"
                    />
                  </label>
                  <p className="text-[11px] text-violet-700/80 dark:text-violet-400/80">
                    Scoped to hand-picked employees instead of the whole campus. Behaves exactly like a real run — generate, finalize, settle — but never collides with the real campus run for this period, and can be freely deleted/regenerated even after finalizing.
                  </p>
                </div>

                {/* TAFSD-458: employees, filtered like the Employee Directory */}
                {showPicker && (
                  <div className="space-y-3">
                    <EmployeeDirectoryFilterBar filters={filters} />
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allShownSelected}
                          disabled={shownIds.length === 0}
                          onChange={toggleAllShown}
                          className={`h-4 w-4 ${isTest ? "accent-violet-600" : "accent-zinc-900"}`}
                        />
                        Select all {shownIds.length} shown
                      </label>
                      <span className="text-xs text-zinc-500">
                        {shownEmployees.length} shown · <span className="font-bold text-zinc-800 dark:text-zinc-200">{pickedCount} selected</span>
                        {pickedByCampus.size > 1 && ` across ${pickedByCampus.size} campuses`}
                        {selectedEmployeeIds.length > 0 && (
                          <button type="button" onClick={() => setSelectedEmployeeIds([])} className="ml-2 font-semibold hover:text-zinc-800 dark:hover:text-zinc-200">
                            Clear
                          </button>
                        )}
                      </span>
                    </div>
                    <div className="max-h-72 overflow-y-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
                      {employeesLoading ? (
                        <div className="p-6 flex items-center justify-center text-xs text-zinc-400">
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> Loading employees…
                        </div>
                      ) : shownEmployees.length === 0 ? (
                        <p className="p-6 text-center text-xs text-zinc-400">
                          {employees.length === 0 ? "No employees found." : "No employees match these filters."}
                        </p>
                      ) : (
                        shownEmployees.map((emp) => {
                          const isKnown = isTest && KNOWN_TEST_EMPLOYEE_CODES.includes(emp.employee_code ?? "");
                          const blocked = unpayableReason(emp);
                          return (
                            <label
                              key={emp.id}
                              className={`flex items-center gap-3 px-4 py-2.5 ${blocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50"}`}
                            >
                              <input
                                type="checkbox"
                                checked={!blocked && selectedSet.has(emp.id)}
                                disabled={!!blocked}
                                onChange={() => toggleEmployee(emp.id)}
                                className={`h-4 w-4 flex-shrink-0 ${isTest ? "accent-violet-600" : "accent-zinc-900"}`}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                                  {emp.full_name || emp.users?.full_name || `Employee #${emp.id}`}
                                  {isKnown && (
                                    <span className="ml-1.5 text-[9px] font-bold text-violet-600 dark:text-violet-400 uppercase">QA fixture</span>
                                  )}
                                </p>
                                <p className="text-xs text-zinc-400 truncate">
                                  <span className="font-mono">{formatEmployeeCodeDisplay(emp) || "—"}</span>
                                  {[emp.departments?.name, emp.staff_categories?.name, emp.segments?.name, emp.campuses?.campus_name].filter(Boolean).map((v) => ` · ${v}`)}
                                </p>
                              </div>
                              {blocked && (
                                <span className="text-[10px] font-bold uppercase text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded-full flex-shrink-0">
                                  {blocked}
                                </span>
                              )}
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* The page banner sits behind the modal, so errors show here too. */}
              {error && (
                <div className="mx-6 mb-0 mt-0 flex items-start gap-2 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl p-3 text-xs dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400">
                  <AlertCircle className="h-4 w-4 text-rose-500 flex-shrink-0" />
                  <p className="flex-1 break-words">{error}</p>
                  <button type="button" onClick={() => setError(null)}><X className="h-3.5 w-3.5 opacity-50 hover:opacity-100" /></button>
                </div>
              )}

              <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 h-11 rounded-xl text-zinc-600 dark:text-zinc-400 font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating || (showPicker && pickedCount === 0)}
                  className={`px-6 h-11 text-white font-semibold rounded-xl text-sm flex items-center gap-2 disabled:opacity-50 ${
                    isTest
                      ? "bg-violet-600 hover:bg-violet-700"
                      : "bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900"
                  }`}
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {generating
                    ? "Generating…"
                    : isTest
                      ? "Generate Test Run"
                      : onlySelected
                        ? `Generate for ${pickedCount} employee${pickedCount === 1 ? "" : "s"}`
                        : "Generate"}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** TAFSD-458: per-campus outcome of generating for picked employees, with anyone left out and why. */
function GenerateResults({
  results,
  onOpen,
  onClose,
}: {
  results: GenerateResult[];
  onOpen: (runId: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="max-h-[92vh] flex flex-col">
      <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Payroll generated</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">One run per campus. Anyone left out is listed with the reason.</p>
      </div>
      <div className="p-6 space-y-4 overflow-y-auto min-h-0">
        {results.map((r) => (
          <div key={r.campusName} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-white">
                {r.error ? <AlertCircle className="h-4 w-4 text-rose-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                {r.campusName}
              </div>
              {r.runId && (
                <button type="button" onClick={() => onOpen(r.runId!)} className="text-xs font-semibold text-primary hover:underline">
                  Open run #{r.runId}
                </button>
              )}
            </div>
            {r.error ? (
              <p className="text-xs text-rose-600 dark:text-rose-400 break-words">{r.error}</p>
            ) : (
              <p className="text-xs text-zinc-500">{r.touched} employee{r.touched === 1 ? "" : "s"} generated</p>
            )}
            {r.skipped.length > 0 && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 p-3 space-y-1">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400">{r.skipped.length} left out</p>
                {r.skipped.map((sk) => (
                  <p key={sk.employee_id} className="text-xs text-amber-800 dark:text-amber-300">
                    <span className="font-semibold">{sk.full_name ?? `Employee #${sk.employee_id}`}</span>
                    {sk.employee_code && <span className="font-mono"> ({sk.employee_code})</span>}: {sk.reason}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-6 h-11 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-white font-semibold rounded-xl text-sm"
        >
          Done
        </button>
      </div>
    </div>
  );
}
