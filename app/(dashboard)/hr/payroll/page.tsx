"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet, Plus, Loader2, AlertCircle, CheckCircle2, X, ChevronDown,
  Building2, Users, AlertTriangle, Calendar, FlaskConical, Search,
} from "lucide-react";
import { hrService, PayrollRun, GeneratePayrollRunPayload, EmployeeProfile } from "@/lib/hr.service";
import { campusesService, Campus } from "@/lib/campuses.service";

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
      {isFinal ? "Finalized" : "Draft"}
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
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [runList, campusList] = await Promise.all([hrService.listPayrollRuns(), campusesService.list()]);
      setRuns(runList);
      setCampuses(campusList);
      if (campusList.length > 0) setForm((f) => (f.campus_id ? f : { ...f, campus_id: campusList[0].id }));
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch payroll runs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isTest || employees.length > 0) return;
    setEmployeesLoading(true);
    hrService
      .listEmployees()
      .then((list) => setEmployees(list))
      .catch((err) => console.error(err))
      .finally(() => setEmployeesLoading(false));
  }, [isTest, employees.length]);

  const campusEmployees = useMemo(
    () => employees.filter((e) => e.campus_id === form.campus_id && e.monthly_pay != null),
    [employees, form.campus_id],
  );
  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    const list = !q
      ? campusEmployees
      : campusEmployees.filter(
          (e) =>
            (e.full_name ?? "").toLowerCase().includes(q) ||
            (e.employee_code ?? "").toLowerCase().includes(q),
        );
    // Known QA fixtures always float to the top so they're easy to find.
    return [...list].sort((a, b) => {
      const aKnown = KNOWN_TEST_EMPLOYEE_CODES.includes(a.employee_code ?? "") ? 0 : 1;
      const bKnown = KNOWN_TEST_EMPLOYEE_CODES.includes(b.employee_code ?? "") ? 0 : 1;
      if (aKnown !== bKnown) return aKnown - bKnown;
      return (a.full_name ?? "").localeCompare(b.full_name ?? "");
    });
  }, [campusEmployees, employeeSearch]);

  const toggleEmployee = (id: number) => {
    setSelectedEmployeeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

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
    setSelectedEmployeeIds([]);
    setEmployeeSearch("");
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.campus_id) {
      setError("Select a campus first.");
      return;
    }
    if (isTest && selectedEmployeeIds.length === 0) {
      setError("Select at least one employee for the test run.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const run = await hrService.generatePayrollRun({
        ...form,
        notes: form.notes || undefined,
        employee_ids: isTest ? selectedEmployeeIds : undefined,
      });
      closeModal();
      router.push(`/hr/payroll/${run.id}`);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to generate payroll run.");
    } finally {
      setGenerating(false);
    }
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

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center justify-center h-11 px-5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-white font-semibold rounded-xl shadow-sm transition-all active:scale-95 text-sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Generate Payroll
        </button>
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
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/95 transition-all"
          >
            Generate First Payroll Run
          </button>
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
          <div className={`bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${isTest ? "max-w-lg" : "max-w-md"}`}>
            <form onSubmit={handleGenerate}>
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Generate Payroll Run</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Covers the 26th of the previous month through the 25th of the selected month — that's the fixed school payroll cycle.
                </p>
              </div>

              <div className="p-6 space-y-4">
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
                  Re-generating an existing draft for the same campus + month replaces it with freshly recomputed numbers — it won't create a duplicate.
                </p>

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

                  {isTest && (
                    <div className="space-y-2 pt-1">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                        <input
                          type="text"
                          placeholder="Search employees by name or code…"
                          value={employeeSearch}
                          onChange={(e) => setEmployeeSearch(e.target.value)}
                          className="w-full h-9 pl-8 pr-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-xs focus:border-primary"
                        />
                      </div>
                      <div className="max-h-44 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800">
                        {employeesLoading ? (
                          <div className="p-4 flex items-center justify-center text-xs text-zinc-400">
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> Loading employees…
                          </div>
                        ) : filteredEmployees.length === 0 ? (
                          <p className="p-4 text-center text-xs text-zinc-400">
                            No payable employees found on this campus.
                          </p>
                        ) : (
                          filteredEmployees.map((emp) => {
                            const isKnown = KNOWN_TEST_EMPLOYEE_CODES.includes(emp.employee_code ?? "");
                            const checked = selectedEmployeeIds.includes(emp.id);
                            return (
                              <label
                                key={emp.id}
                                className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleEmployee(emp.id)}
                                  className="h-3.5 w-3.5 accent-violet-600 flex-shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                                    {emp.full_name ?? `Employee #${emp.id}`}
                                    {isKnown && (
                                      <span className="ml-1.5 text-[9px] font-bold text-violet-600 dark:text-violet-400 uppercase">
                                        QA fixture
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-[10px] text-zinc-400 font-mono">{emp.employee_code ?? "—"}</p>
                                </div>
                              </label>
                            );
                          })
                        )}
                      </div>
                      {selectedEmployeeIds.length > 0 && (
                        <p className="text-[11px] text-violet-700 dark:text-violet-400 font-semibold">
                          {selectedEmployeeIds.length} employee(s) selected
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

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
                  disabled={generating}
                  className={`px-6 h-11 text-white font-semibold rounded-xl text-sm flex items-center gap-2 disabled:opacity-50 ${
                    isTest
                      ? "bg-violet-600 hover:bg-violet-700"
                      : "bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900"
                  }`}
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {generating ? "Generating…" : isTest ? "Generate Test Run" : "Generate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
