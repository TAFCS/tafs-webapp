"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Wallet, Loader2, AlertCircle, CheckCircle2, ArrowLeft, Lock,
  Trash2, AlertTriangle, Building2, Calendar, LayoutGrid, List, Download,
  FlaskConical, FileText, HandCoins, RefreshCw, UserMinus, UserPlus, CalendarRange, LockOpen,
} from "lucide-react";
import { hrService, PayrollRun, PayrollRunLine } from "@/lib/hr.service";
import { StatutoryKey, StatutoryWaiverToggles, STATUTORY_LABELS } from "../_components/StatutoryWaiverToggles";
import { ExcludeEmployeeModal } from "../_components/ExcludeEmployeeModal";
import { usePayrollAccess } from "@/hooks/use-payroll-access";
import { PayrollLineDetailModal } from "../_components/PayrollLineDetailModal";
import { PayrollMatrixView } from "../_components/PayrollMatrixView";
import { AttendanceTagBadges } from "../_components/AttendanceTagBadges";
import { SettlePaymentModal } from "../_components/SettlePaymentModal";
import { FlagReviewPanel } from "../_components/FlagReviewPanel";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function lineName(run: PayrollRun, employeeId: number): string {
  return run.payroll_run_lines?.find((l) => l.employee_id === employeeId)?.employee_profiles?.full_name ?? `Employee #${employeeId}`;
}

function formatPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date, withYear: boolean) =>
    `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}${withYear ? ` ${d.getUTCFullYear()}` : ""}`;
  return `${fmt(s, s.getUTCFullYear() !== e.getUTCFullYear())} – ${fmt(e, true)}`;
}

function formatPkr(value: number | null | undefined): string {
  if (value == null) return "—";
  return `₨ ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

// A line stops being regenerate-able the moment it's finalized — SETTLED
// implies FINALIZED (settle can only happen on an already-finalized line).
function isLineFinal(line: PayrollRunLine): boolean {
  return line.line_status !== "PENDING";
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: "amber" | "rose" }) {
  const color = accent === "amber" ? "text-amber-600" : accent === "rose" ? "text-rose-600" : "text-zinc-900 dark:text-white";
  return (
    <div className="bg-white dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-4">
      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-black mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function ExcludedEmployeesPanel({
  exclusions,
  includingId,
  onInclude,
  canInclude,
}: {
  exclusions: NonNullable<PayrollRun["payroll_run_exclusions"]>;
  includingId: number | null;
  onInclude: (employeeId: number) => void;
  canInclude: boolean;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-5 py-4 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800">
        <UserMinus className="h-5 w-5 text-zinc-400 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Excluded Employees</p>
          <p className="text-xs text-zinc-400">Left out of this cycle for now — not computed, not paid, until re-included.</p>
        </div>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {exclusions.map((ex) => {
          const name = ex.employee_profiles?.full_name ?? `Employee #${ex.employee_id}`;
          const including = includingId === ex.employee_id;
          return (
            <div key={ex.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{name}</p>
                <p className="text-[11px] text-zinc-400">
                  {ex.employee_profiles?.employee_code ?? "—"}
                  {` · excluded ${new Date(ex.excluded_at).toLocaleDateString()}`}
                  {ex.reason ? ` · ${ex.reason}` : " · no reason given"}
                </p>
              </div>
              {canInclude && (
                <button
                  onClick={() => onInclude(ex.employee_id)}
                  disabled={including}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all disabled:opacity-50 shrink-0"
                >
                  {including ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />} Include
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PayrollRunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const access = usePayrollAccess();

  const [run, setRun] = useState<PayrollRun | null>(null);
  // Only the very first fetch shows the full-page spinner. Every mutation
  // below (settle, finalize, disburse, flag decisions) applies the server's
  // response directly onto `run` in place instead of refetching, so nothing
  // after mount ever unmounts the page or flashes stale content.
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [finalizingAll, setFinalizingAll] = useState(false);
  const [regeneratingAll, setRegeneratingAll] = useState(false);
  const [regeneratingLineId, setRegeneratingLineId] = useState<number | null>(null);
  const [finalizingLineId, setFinalizingLineId] = useState<number | null>(null);
  const [unfinalizingAll, setUnfinalizingAll] = useState(false);
  const [unfinalizingLineId, setUnfinalizingLineId] = useState<number | null>(null);
  const [excludingLineId, setExcludingLineId] = useState<number | null>(null);
  const [fullPayLineId, setFullPayLineId] = useState<number | null>(null);
  const [excludeTarget, setExcludeTarget] = useState<{ employeeId: number; name: string; code: string | null } | null>(null);
  const [waiverBusy, setWaiverBusy] = useState<{ employeeId: number; key: StatutoryKey } | null>(null);
  const [includingLineId, setIncludingLineId] = useState<number | null>(null);
  const [selectedLine, setSelectedLine] = useState<PayrollRunLine | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState<"lines" | "matrix">("lines");
  const [deleting, setDeleting] = useState(false);
  const [disbursingAll, setDisbursingAll] = useState(false);
  const [settlingLine, setSettlingLine] = useState<PayrollRunLine | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchRun = async () => {
    setInitialLoading(true);
    setError(null);
    try {
      const data = await hrService.getPayrollRun(id);
      setRun(data);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load this payroll run.");
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 4000);
    return () => clearTimeout(t);
  }, [success]);

  // Memoized so the punch matrix (which pages and memoizes rows off this
  // array) isn't handed a fresh identity on every render of this page.
  const lines = useMemo(
    () =>
      [...(run?.payroll_run_lines ?? [])].sort((a, b) =>
        (a.employee_profiles?.full_name ?? "").localeCompare(b.employee_profiles?.full_name ?? ""),
      ),
    [run?.payroll_run_lines],
  );
  const totalUnresolved = lines.reduce((sum, l) => sum + l.unresolved_days, 0);
  const totalGross = lines.reduce((sum, l) => sum + Number(l.monthly_pay), 0);
  const totalDeductions = lines.reduce((sum, l) => sum + Number(l.total_deductions), 0);
  const totalNet = lines.reduce((sum, l) => sum + Number(l.net_pay), 0);
  const undisbursedCount = lines.filter((l) => l.finalized_at && !l.disbursed_at).length;
  const pendingFlags = lines.reduce(
    (sum, l) => sum + (l.payroll_flags?.filter((f) => f.status === "PENDING").length ?? 0),
    0,
  );
  const pendingCount = lines.filter((l) => l.line_status === "PENDING").length;
  const lockedCount = lines.filter((l) => l.finalized_at).length;

  const handleRegenerateAll = async () => {
    if (!run) return;
    setRegeneratingAll(true);
    setError(null);
    try {
      let updated: PayrollRun;
      if (run.kind === "CUSTOM") {
        // A custom run's roster is the employees on it; its dates are its own.
        await hrService.generateCustomPayrollRun({
          employee_ids: lines.map((l) => l.employee_id),
          period_start: run.period_start.slice(0, 10),
          period_end: run.period_end.slice(0, 10),
        });
        updated = await hrService.getPayrollRun(run.id);
      } else {
        const end = new Date(run.period_end);
        updated = await hrService.generatePayrollRun({
          campus_id: run.campus_id,
          year: end.getUTCFullYear(),
          month: end.getUTCMonth() + 1,
          // Test runs stay scoped to exactly the employees they were built
          // with — a real run's roster is re-derived live from the campus on
          // the backend (that's what auto-picks up a new hire).
          employee_ids: run.is_test ? lines.map((l) => l.employee_id) : undefined,
        });
      }
      setRun(updated);
      setSuccess("Regenerated every pending employee's line with the latest attendance data.");
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to regenerate payroll run.");
    } finally {
      setRegeneratingAll(false);
    }
  };

  const handleFinalizeAll = async () => {
    if (!run) return;
    if (!confirm(`Finalize every eligible pending employee for ${formatPeriod(run.period_start, run.period_end)}? Locked lines won't be recomputable after this.`)) return;
    setFinalizingAll(true);
    setError(null);
    try {
      const updated = await hrService.finalizePayrollRun(run.id);
      setRun(updated);
      const summary = updated.finalize_summary;
      setSuccess(
        summary
          ? summary.skipped.length > 0
            ? `${summary.finalized} employee(s) finalized — ${summary.skipped.length} skipped (still have unresolved attendance or a pending flag).`
            : `${summary.finalized} employee(s) finalized.`
          : "Payroll finalized.",
      );
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to finalize payroll run.");
    } finally {
      setFinalizingAll(false);
    }
  };

  const handleRegenerateLine = async (employeeId: number) => {
    if (!run) return;
    setRegeneratingLineId(employeeId);
    setError(null);
    try {
      const updated = await hrService.regeneratePayrollLine(run.id, employeeId);
      setRun(updated);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to regenerate this employee's payroll line.");
    } finally {
      setRegeneratingLineId(null);
    }
  };

  const handleFinalizeLine = async (employeeId: number) => {
    if (!run) return;
    setFinalizingLineId(employeeId);
    setError(null);
    try {
      const updated = await hrService.finalizePayrollLine(run.id, employeeId);
      setRun(updated);
      setSuccess("Employee payroll line finalized.");
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to finalize this employee's payroll line.");
    } finally {
      setFinalizingLineId(null);
    }
  };

  // TAFSD-394: back to pending, reversing the loan / security deposit postings
  // made at finalize. Paid (settled) lines stay locked.
  const handleUnfinalizeAll = async () => {
    if (!run) return;
    if (!confirm(
      `Un-finalize ${formatPeriod(run.period_start, run.period_end)}?\n\n` +
      `Every finalized employee who hasn't been paid yet goes back to pending. Their loan and security deposit installments for this cycle are taken back. ` +
      `You can then regenerate, exclude, or delete the run, and finalize again.`,
    )) return;
    setUnfinalizingAll(true);
    setError(null);
    try {
      const updated = await hrService.unfinalizePayrollRun(run.id);
      setRun(updated);
      const summary = updated.unfinalize_summary;
      if (summary && summary.skipped.length > 0) {
        setSuccess(`${summary.unfinalized} employee(s) un-finalized; ${summary.skipped.length} kept finalized.`);
        setError(summary.skipped.map((s) => `${lineName(updated, s.employee_id)}: ${s.reason}`).join("; "));
      } else {
        setSuccess(`${summary?.unfinalized ?? 0} employee(s) un-finalized. The run is back to draft.`);
      }
    } catch (err) {
      console.error(err);
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message || "Failed to un-finalize payroll run.");
    } finally {
      setUnfinalizingAll(false);
    }
  };

  const handleUnfinalizeLine = async (employeeId: number, name: string) => {
    if (!run) return;
    if (!confirm(`Un-finalize ${name}? Their line goes back to pending and this cycle's loan / security deposit installment is taken back.`)) return;
    setUnfinalizingLineId(employeeId);
    setError(null);
    try {
      const updated = await hrService.unfinalizePayrollLine(run.id, employeeId);
      setRun(updated);
      setSuccess(`${name} un-finalized.`);
    } catch (err) {
      console.error(err);
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message || "Failed to un-finalize this employee's payroll line.");
    } finally {
      setUnfinalizingLineId(null);
    }
  };

  const handleExcludeLine = async (reason: string | undefined) => {
    if (!run || !excludeTarget) return;
    const { employeeId, name } = excludeTarget;
    setExcludingLineId(employeeId);
    setError(null);
    try {
      const updated = await hrService.excludePayrollLine(run.id, employeeId, reason);
      setRun(updated);
      setExcludeTarget(null);
      setSuccess(`${name} excluded from this payroll run. They're listed under Excluded Employees.`);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to exclude this employee.");
    } finally {
      setExcludingLineId(null);
    }
  };

  // TAFSD-383: waive (or re-apply) EOBI / SESSI / income tax for one line, this cycle only.
  const handleToggleWaiver = async (employeeId: number, name: string, key: StatutoryKey, waive: boolean) => {
    if (!run) return;
    setWaiverBusy({ employeeId, key });
    setError(null);
    try {
      const updated = await hrService.setPayrollLineStatutoryWaivers(run.id, employeeId, { [key]: waive });
      setRun(updated);
      setSuccess(
        waive
          ? `${STATUTORY_LABELS[key]} waived for ${name} in this cycle only.`
          : `${STATUTORY_LABELS[key]} is charged for ${name} again in this cycle.`,
      );
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || `Failed to update ${STATUTORY_LABELS[key]} for this employee.`);
    } finally {
      setWaiverBusy(null);
    }
  };

  const handleToggleFullPay = async (employeeId: number, name: string, enable: boolean) => {
    if (!run) return;
    if (
      enable &&
      !confirm(
        `Pay ${name} their full salary for this cycle?\n\nAbsence, half-day, late, break and sandwich deductions will not be counted. EOBI/income tax and any loan or deposit installments still apply.`,
      )
    ) {
      return;
    }
    setFullPayLineId(employeeId);
    setError(null);
    try {
      const updated = await hrService.setPayrollLineFullPay(run.id, employeeId, enable);
      setRun(updated);
      setSuccess(enable ? `${name} will be paid their full salary.` : `${name} is back on normal attendance-based pay.`);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to update full-salary setting.");
    } finally {
      setFullPayLineId(null);
    }
  };

  const handleIncludeLine = async (employeeId: number) => {
    if (!run) return;
    setIncludingLineId(employeeId);
    setError(null);
    try {
      const updated = await hrService.includePayrollLine(run.id, employeeId);
      setRun(updated);
      setSuccess("Employee re-included on this payroll run.");
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to re-include this employee.");
    } finally {
      setIncludingLineId(null);
    }
  };

  const handleDisburseAll = async () => {
    if (!run) return;
    if (!confirm(`Mark all ${undisbursedCount} undisbursed employee line(s) as paid?`)) return;
    setDisbursingAll(true);
    setError(null);
    try {
      const updated = await hrService.disbursePayrollRunAll(run.id);
      setRun(updated);
      setSuccess("All undisbursed lines marked as disbursed.");
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to disburse payroll run.");
    } finally {
      setDisbursingAll(false);
    }
  };

  const handleSettled = (updatedLine: PayrollRunLine) => {
    setSuccess(`${updatedLine.employee_profiles?.full_name ?? "Employee"} settled — payslip generated.`);
    // Merge the single updated line in place rather than refetching the
    // whole run — a full refetch would flip initialLoading and unmount the
    // still-open settle modal underneath the user.
    setRun((prev) =>
      prev
        ? {
            ...prev,
            payroll_run_lines: prev.payroll_run_lines?.map((l) => (l.id === updatedLine.id ? updatedLine : l)),
          }
        : prev,
    );
  };

  const handleFlagsDecided = (updated: PayrollRun) => {
    setRun(updated);
  };

  const handleDelete = async () => {
    if (!run) return;
    const confirmMsg = run.is_test
      ? "Delete this test payroll run? This cannot be undone — you can generate a fresh one afterwards."
      : "Delete this draft payroll run? This cannot be undone.";
    if (!confirm(confirmMsg)) return;
    setDeleting(true);
    setError(null);
    try {
      await hrService.deletePayrollRun(run.id);
      router.push("/hr/payroll");
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to delete payroll run.");
      setDeleting(false);
    }
  };

  const handleExport = async () => {
    if (!run) return;
    setExporting(true);
    setError(null);
    try {
      await hrService.exportPayrollRun(run.id);
    } catch (err: any) {
      console.error(err);
      setError("Failed to export payroll run.");
    } finally {
      setExporting(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="max-w-6xl mx-auto flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">Loading payroll run…</p>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="max-w-6xl mx-auto text-center py-32">
        <p className="text-zinc-500">{error || "Payroll run not found."}</p>
        <button onClick={() => router.push("/hr/payroll")} className="mt-4 text-primary font-semibold text-sm">← Back to Payroll</button>
      </div>
    );
  }

  // run.status is a derived rollup: FINALIZED only once every employee line
  // is finalized/settled (no one left pending). It's no longer a manually-set
  // switch — see recomputeRunStatus on the backend.
  const cycleComplete = run.status === "FINALIZED";

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <button
            onClick={() => router.push("/hr/payroll")}
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 mb-3"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Payroll
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-2xl">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-zinc-400" />
                {formatPeriod(run.period_start, run.period_end)}
              </h1>
              <div className="flex items-center gap-2 mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                <Building2 className="h-3.5 w-3.5" />
                {run.campuses?.campus_name ?? `Campus #${run.campus_id}`}
                {run.is_test && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ml-2 bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400">
                    <FlaskConical className="h-3 w-3" /> Test
                  </span>
                )}
                {run.kind === "CUSTOM" && (
                  <span
                    title="Custom run: picked employees over their own dates, paid as one salary month"
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ml-2 bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400"
                  >
                    <CalendarRange className="h-3 w-3" /> Custom dates
                  </span>
                )}
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ml-2 ${
                    cycleComplete
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                  }`}
                >
                  {cycleComplete ? "Complete" : "Incomplete"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {access.can("export") && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all disabled:opacity-50"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Excel
            </button>
          )}
          {access.can("delete") && (lockedCount === 0 || run.is_test) && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              title={lockedCount > 0 && run.is_test ? "Test runs can be deleted even after finalizing" : undefined}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-rose-200 dark:border-rose-900/30 text-rose-600 text-sm font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all disabled:opacity-50"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete
            </button>
          )}
          {access.can("line_manage") && (
            <button
              onClick={handleRegenerateAll}
              disabled={regeneratingAll || pendingCount === 0}
              title={pendingCount === 0 ? "Every employee is already finalized — nothing pending to regenerate" : undefined}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {regeneratingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Regen All
            </button>
          )}
          {access.can("finalize") && pendingCount > 0 && (
            <button
              onClick={handleFinalizeAll}
              disabled={finalizingAll}
              className="inline-flex items-center gap-1.5 h-10 px-5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {finalizingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Finalize All
            </button>
          )}
          {access.can("unfinalize") && undisbursedCount > 0 && (
            <button
              onClick={handleUnfinalizeAll}
              disabled={unfinalizingAll}
              title="Put finalized, unpaid employees back to pending so the run can be edited or deleted"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-amber-300 dark:border-amber-900/50 text-amber-700 dark:text-amber-400 text-sm font-semibold hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-all disabled:opacity-50"
            >
              {unfinalizingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockOpen className="h-4 w-4" />} Un-finalize All
            </button>
          )}
          {access.can("disburse") && undisbursedCount > 0 && (
            <button
              onClick={handleDisburseAll}
              disabled={disbursingAll}
              className="inline-flex items-center gap-1.5 h-10 px-5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-all disabled:opacity-50"
            >
              {disbursingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Disburse All ({undisbursedCount})
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl p-4 text-sm dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400">
          <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0" />
          <p className="flex-1">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl p-4 text-sm dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
          <p className="flex-1">{success}</p>
        </div>
      )}
      {totalUnresolved > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 text-amber-800 rounded-2xl p-4 text-sm dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <p className="flex-1">
            <strong>{totalUnresolved}</strong> working day(s) across employees have no attendance record at all — neither present nor explicitly absent.
            Resolve them in the Staff Attendance register, then regenerate that employee's line (or use Regen All) before finalizing them.
          </p>
        </div>
      )}

      <FlagReviewPanel run={run} lines={lines} onDecided={handleFlagsDecided} />

      {run.payroll_run_exclusions && run.payroll_run_exclusions.length > 0 && (
        <ExcludedEmployeesPanel
          exclusions={run.payroll_run_exclusions}
          includingId={includingLineId}
          onInclude={handleIncludeLine}
          canInclude={access.can("line_manage")}
        />
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Employees" value={String(lines.length)} />
        <SummaryCard label="Total Gross" value={formatPkr(totalGross)} />
        <SummaryCard label="Total Deductions" value={formatPkr(totalDeductions)} accent={totalDeductions > 0 ? "rose" : undefined} />
        <SummaryCard label="Total Net Pay" value={formatPkr(totalNet)} />
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl w-fit">
        <button
          onClick={() => setTab("lines")}
          className={`flex items-center gap-1.5 h-8 px-4 rounded-xl text-sm font-semibold transition-all ${
            tab === "lines"
              ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700"
          }`}
        >
          <List className="h-3.5 w-3.5" /> Employee Lines
        </button>
        <button
          onClick={() => setTab("matrix")}
          className={`flex items-center gap-1.5 h-8 px-4 rounded-xl text-sm font-semibold transition-all ${
            tab === "matrix"
              ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700"
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" /> Punch Card Matrix
        </button>
      </div>

      {tab === "matrix" && run && (
        <PayrollMatrixView
          periodStart={run.period_start}
          periodEnd={run.period_end}
          lines={lines}
          onOpenLine={(line, date) => {
            setSelectedLine(line as PayrollRunLine);
            setSelectedDate(date);
          }}
        />
      )}

      {/* Employee lines table */}
      {tab === "lines" && (
        <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 border-b border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span className="font-bold text-zinc-600 dark:text-zinc-300">Statutory · this cycle:</span>
            <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> charged</span>
            <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /><span className="line-through">waived</span> for this employee in this cycle only</span>
            <span>Exempt = set on the employee&apos;s profile</span>
            <span>Click a chip on an unfinalized line to switch it.</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                  <th className="px-5 py-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Employee</th>
                  <th className="px-4 py-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest text-center">Present</th>
                  <th className="px-4 py-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest text-center">Absent / Unpaid</th>
                  <th className="px-4 py-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest text-center">Unresolved</th>
                  <th className="px-4 py-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest text-center">Late (min)</th>
                  <th className="px-4 py-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest text-center">Break (min)</th>
                  <th className="px-4 py-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest text-right">Daily Rate</th>
                  <th className="px-4 py-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest text-right">Total Pay</th>
                  <th
                    className="px-4 py-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest text-center whitespace-nowrap"
                    title="EOBI, SESSI and income tax for this cycle. Click one to waive it for that employee in this cycle only."
                  >
                    Statutory · this cycle
                  </th>
                  <th className="px-4 py-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest text-right">Deductions</th>
                  <th className="px-5 py-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest text-right">Net Pay</th>
                  <th className="px-5 py-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {lines.map((line) => (
                  <PayrollLineRow
                    key={line.id}
                    line={line}
                    access={access}
                    regenerating={regeneratingLineId === line.employee_id}
                    finalizing={finalizingLineId === line.employee_id}
                    excluding={excludingLineId === line.employee_id}
                    togglingFullPay={fullPayLineId === line.employee_id}
                    onToggleFullPay={() => handleToggleFullPay(line.employee_id, line.employee_profiles?.full_name ?? `Employee #${line.employee_id}`, !line.full_pay_override)}
                    onSettle={() => setSettlingLine(line)}
                    onRegenerate={() => handleRegenerateLine(line.employee_id)}
                    onFinalize={() => handleFinalizeLine(line.employee_id)}
                    onUnfinalize={() => handleUnfinalizeLine(line.employee_id, line.employee_profiles?.full_name ?? `Employee #${line.employee_id}`)}
                    unfinalizing={unfinalizingLineId === line.employee_id}
                    onExclude={() =>
                      setExcludeTarget({
                        employeeId: line.employee_id,
                        name: line.employee_profiles?.full_name ?? `Employee #${line.employee_id}`,
                        code: line.employee_profiles?.employee_code ?? null,
                      })
                    }
                    waivers={
                      <StatutoryWaiverToggles
                        line={line}
                        editable={access.can("line_manage") && line.line_status === "PENDING" && !run?.is_test}
                        lockedReason={
                          run?.is_test
                            ? "Test runs don't support per-employee changes."
                            : line.line_status !== "PENDING"
                              ? "This line is finalized, so its statutory deductions are locked."
                              : "You don't have permission to change payroll lines."
                        }
                        busyKey={waiverBusy?.employeeId === line.employee_id ? waiverBusy.key : null}
                        onToggle={(key, waive) =>
                          handleToggleWaiver(line.employee_id, line.employee_profiles?.full_name ?? `Employee #${line.employee_id}`, key, waive)
                        }
                      />
                    }
                    onClick={() => { setSelectedLine(line); setSelectedDate(undefined); }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedLine && run && (
        <PayrollLineDetailModal
          campusId={run.campus_id}
          isFinal={isLineFinal(selectedLine)}
          line={selectedLine}
          initialDate={selectedDate}
          onClose={() => { setSelectedLine(null); setSelectedDate(undefined); }}
          regenerate={
            access.can("line_manage")
              ? {
                  runId: run.id,
                  onRegenerated: (updated) => {
                    setRun(updated);
                    const refreshedLine = updated.payroll_run_lines?.find(
                      (l) => l.employee_id === selectedLine.employee_id,
                    );
                    if (refreshedLine) setSelectedLine(refreshedLine);
                    setSuccess("Regenerated this employee's line with the latest attendance data.");
                  },
                }
              : undefined
          }
        />
      )}

      {excludeTarget && run && (
        <ExcludeEmployeeModal
          name={excludeTarget.name}
          code={excludeTarget.code}
          periodLabel={formatPeriod(run.period_start, run.period_end)}
          submitting={excludingLineId === excludeTarget.employeeId}
          onCancel={() => setExcludeTarget(null)}
          onConfirm={handleExcludeLine}
        />
      )}

      {settlingLine && run && (
        <SettlePaymentModal
          runId={run.id}
          line={settlingLine}
          onClose={() => setSettlingLine(null)}
          onSettled={handleSettled}
        />
      )}
    </div>
  );
}

function PayrollLineRow({
  line,
  onClick,
  onSettle,
  onRegenerate,
  onFinalize,
  onUnfinalize,
  onExclude,
  onToggleFullPay,
  regenerating,
  finalizing,
  unfinalizing,
  excluding,
  togglingFullPay,
  access,
  waivers,
}: {
  line: PayrollRunLine;
  onClick: () => void;
  onSettle: () => void;
  onRegenerate: () => void;
  onFinalize: () => void;
  onUnfinalize: () => void;
  unfinalizing: boolean;
  onExclude: () => void;
  onToggleFullPay: () => void;
  regenerating: boolean;
  finalizing: boolean;
  excluding: boolean;
  togglingFullPay: boolean;
  access: ReturnType<typeof usePayrollAccess>;
  waivers: React.ReactNode;
}) {
  const emp = line.employee_profiles;
  const name = emp?.full_name ?? `Employee #${line.employee_id}`;
  const hasIssue = line.unresolved_days > 0;
  const pendingFlagCount = line.payroll_flags?.filter((f) => f.status === "PENDING").length ?? 0;

  return (
    <tr
      onClick={onClick}
      className={`cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 transition-colors ${hasIssue ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}
    >
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          {emp?.photo_url ? (
            <img src={emp.photo_url.replace(/([^:])\/\//g, "$1/")} alt={name} className="h-8 w-8 rounded-lg object-cover bg-zinc-100" />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
              {initials(name)}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white leading-tight">{name}</p>
            <p className="text-[11px] text-zinc-400 font-mono">{emp?.employee_code ?? "—"}</p>
            <AttendanceTagBadges line={line} className="mt-1" />
            {line.full_pay_override && (
              <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-tight">
                Full salary
              </span>
            )}
            {Number(line.after_leaving_deduction ?? 0) > 0 && (
              <span className="inline-block mt-1 ml-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 text-[10px] font-bold uppercase tracking-tight">
                Left mid-cycle
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-center text-sm text-zinc-600 dark:text-zinc-300">{line.present_days}/{line.scheduled_working_days}</td>
      <td className="px-4 py-3 text-center text-sm">
        {(line.absent_days + (line.unpaid_leave_days ?? 0)) > 0 ? (
          <span className="font-semibold text-rose-600">
            {line.absent_days + (line.unpaid_leave_days ?? 0)}
            {(line.unpaid_leave_days ?? 0) > 0 && (
              <span className="text-[10px] font-normal text-zinc-400 ml-1">
                ({line.unpaid_leave_days} unpaid)
              </span>
            )}
          </span>
        ) : (
          <span className="text-zinc-300 dark:text-zinc-600">0</span>
        )}
      </td>
      <td className="px-4 py-3 text-center text-sm">
        {hasIssue ? (
          <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
            <AlertTriangle className="h-3 w-3" /> {line.unresolved_days}
          </span>
        ) : (
          <span className="text-zinc-300 dark:text-zinc-600">0</span>
        )}
      </td>
      <td className="px-4 py-3 text-center text-sm">
        {line.total_late_minutes > 0 ? <span className="font-semibold text-amber-600">{line.total_late_minutes}</span> : <span className="text-zinc-300 dark:text-zinc-600">0</span>}
      </td>
      <td className="px-4 py-3 text-center text-sm text-zinc-600 dark:text-zinc-300">{line.total_break_minutes}</td>
      <td
        className="px-4 py-3 text-right text-sm font-mono text-zinc-600 dark:text-zinc-300"
        title={`Monthly pay ÷ ${line.total_calendar_days} calendar days in the period (weekends/holidays included). A custom range shorter than a pay month uses the days in its starting month instead.`}
      >
        {formatPkr(line.daily_rate)}
      </td>
      <td className="px-4 py-3 text-right text-sm font-mono text-zinc-600 dark:text-zinc-300">{formatPkr(line.monthly_pay)}</td>
      <td className="px-4 py-3">{waivers}</td>
      <td className="px-4 py-3 text-right text-sm font-mono text-rose-600">
        {Number(line.total_deductions) > 0 ? `-${formatPkr(line.total_deductions)}` : formatPkr(0)}
      </td>
      <td className="px-5 py-3 text-right text-sm font-bold text-zinc-900 dark:text-white">{formatPkr(line.net_pay)}</td>
      <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        {line.line_status === "SETTLED" ? (
          <div className="flex items-center justify-end gap-2">
            {line.payroll_settlements?.payslip_pdf_url && (
              <a
                href={line.payroll_settlements.payslip_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                title="View payslip"
                className="text-zinc-400 hover:text-primary"
              >
                <FileText className="h-3.5 w-3.5" />
              </a>
            )}
            <button onClick={onSettle} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 hover:opacity-80">
              {new Date(line.disbursed_at!).toLocaleDateString()}
            </button>
          </div>
        ) : line.line_status === "FINALIZED" ? (
          <div className="flex items-center justify-end gap-3">
            {access.can("unfinalize") && (
              <button
                onClick={onUnfinalize}
                disabled={unfinalizing}
                title="Back to pending: reverses this cycle's loan / security deposit installment"
                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline disabled:opacity-50"
              >
                {unfinalizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LockOpen className="h-3.5 w-3.5" />} Un-finalize
              </button>
            )}
            {access.can("line_manage") && (
              <button
                onClick={onSettle}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <HandCoins className="h-3.5 w-3.5" /> Settle Payment
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            {access.can("line_manage") && (
              <button
                onClick={onRegenerate}
                disabled={regenerating}
                title="Regenerate this employee's line from current attendance"
                className="inline-flex items-center text-zinc-400 hover:text-primary disabled:opacity-50"
              >
                {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </button>
            )}
            {access.can("finalize") && (
              <button
                onClick={onFinalize}
                disabled={finalizing || hasIssue || pendingFlagCount > 0}
                title={
                  hasIssue
                    ? `Resolve ${line.unresolved_days} unresolved attendance day(s) first`
                    : pendingFlagCount > 0
                      ? `Decide ${pendingFlagCount} pending flag(s) first`
                      : undefined
                }
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline disabled:text-zinc-400"
              >
                {finalizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />} Finalize
              </button>
            )}
            {access.can("line_manage") && (
              <button
                onClick={onToggleFullPay}
                disabled={togglingFullPay}
                title={
                  line.full_pay_override
                    ? "Paying full salary — click to go back to attendance-based deductions"
                    : "Pay this employee their full salary (skip attendance deductions)"
                }
                className={`inline-flex items-center disabled:opacity-50 ${line.full_pay_override ? "text-emerald-600" : "text-zinc-400 hover:text-emerald-600"}`}
              >
                {togglingFullPay ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HandCoins className="h-3.5 w-3.5" />}
              </button>
            )}
            {access.can("line_manage") && (
              <button
                onClick={onExclude}
                disabled={excluding}
                title="Leave this employee out of this payroll cycle (e.g. attendance wasn't tracked, or they're paid on a custom run)"
                className="inline-flex items-center gap-1 h-7 px-2 rounded-lg border border-rose-200 dark:border-rose-900/50 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-50"
              >
                {excluding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserMinus className="h-3.5 w-3.5" />} Exclude
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
