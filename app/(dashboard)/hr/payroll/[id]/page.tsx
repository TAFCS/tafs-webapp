"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Wallet, Loader2, AlertCircle, CheckCircle2, ArrowLeft, Lock,
  Trash2, AlertTriangle, Building2, Calendar, LayoutGrid, List,
} from "lucide-react";
import { hrService, PayrollRun, PayrollRunLine } from "@/lib/hr.service";
import { PayrollLineDetailModal } from "../_components/PayrollLineDetailModal";
import { PayrollMatrixView } from "../_components/PayrollMatrixView";

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
  return `₨ ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).map((n) => n[0]).slice(0, 2).join("").toUpperCase();
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

export default function PayrollRunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const [run, setRun] = useState<PayrollRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [selectedLine, setSelectedLine] = useState<PayrollRunLine | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState<"lines" | "matrix">("lines");
  const [deleting, setDeleting] = useState(false);
  const [disbursingAll, setDisbursingAll] = useState(false);
  const [disbursingLineId, setDisbursingLineId] = useState<number | null>(null);

  const fetchRun = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await hrService.getPayrollRun(id);
      setRun(data);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load this payroll run.");
    } finally {
      setLoading(false);
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

  const lines = [...(run?.payroll_run_lines ?? [])].sort((a, b) =>
    (a.employee_profiles?.full_name ?? "").localeCompare(b.employee_profiles?.full_name ?? ""),
  );
  const totalUnresolved = lines.reduce((sum, l) => sum + l.unresolved_days, 0);
  const totalGross = lines.reduce((sum, l) => sum + Number(l.monthly_pay), 0);
  const totalDeductions = lines.reduce((sum, l) => sum + Number(l.total_deductions), 0);
  const totalNet = lines.reduce((sum, l) => sum + Number(l.net_pay), 0);
  const undisbursedCount = lines.filter((l) => !l.disbursed_at).length;

  const handleFinalize = async () => {
    if (!run) return;
    if (!confirm(`Finalize payroll for ${formatPeriod(run.period_start, run.period_end)}? This locks the numbers — they won't be recomputable after this.`)) return;
    setFinalizing(true);
    setError(null);
    try {
      const updated = await hrService.finalizePayrollRun(run.id);
      setRun(updated);
      setSuccess("Payroll run finalized.");
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to finalize payroll run.");
    } finally {
      setFinalizing(false);
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

  const handleDisburseLine = async (line: PayrollRunLine) => {
    if (!run) return;
    setDisbursingLineId(line.employee_id);
    setError(null);
    try {
      await hrService.disbursePayrollLine(run.id, line.employee_id);
      await fetchRun();
      setSuccess("Employee line marked as disbursed.");
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to mark line as disbursed.");
    } finally {
      setDisbursingLineId(null);
    }
  };

  const handleDelete = async () => {
    if (!run) return;
    if (!confirm("Delete this draft payroll run? This cannot be undone.")) return;
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

  if (loading) {
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

  const isFinal = run.status === "FINALIZED";

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
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ml-2 ${
                    isFinal
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                  }`}
                >
                  {isFinal ? "Finalized" : "Draft"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isFinal && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-rose-200 dark:border-rose-900/30 text-rose-600 text-sm font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all disabled:opacity-50"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete
            </button>
          )}
          {!isFinal && (
            <button
              onClick={handleFinalize}
              disabled={finalizing || totalUnresolved > 0}
              title={totalUnresolved > 0 ? `Resolve ${totalUnresolved} unresolved attendance day(s) first` : undefined}
              className="inline-flex items-center gap-1.5 h-10 px-5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Finalize
            </button>
          )}
          {isFinal && undisbursedCount > 0 && (
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
            Resolve them in the Staff Attendance register, then regenerate this run before finalizing.
          </p>
        </div>
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
                  <th className="px-4 py-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest text-right">Deductions</th>
                  <th className="px-5 py-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest text-right">Net Pay</th>
                  {isFinal && (
                    <th className="px-5 py-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest text-right">Disbursed</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {lines.map((line) => (
                  <PayrollLineRow
                    key={line.id}
                    line={line}
                    isFinal={isFinal}
                    disbursing={disbursingLineId === line.employee_id}
                    onDisburse={() => handleDisburseLine(line)}
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
          isFinal={isFinal}
          line={selectedLine}
          initialDate={selectedDate}
          onClose={() => { setSelectedLine(null); setSelectedDate(undefined); }}
          regenerate={{
            periodEnd: run.period_end,
            onRegenerated: (updated) => {
              setRun(updated);
              const refreshedLine = updated.payroll_run_lines?.find(
                (l) => l.employee_id === selectedLine.employee_id,
              );
              if (refreshedLine) setSelectedLine(refreshedLine);
              setSuccess("Payroll run regenerated with the latest attendance data.");
            },
          }}
        />
      )}
    </div>
  );
}

function PayrollLineRow({
  line,
  onClick,
  isFinal,
  onDisburse,
  disbursing,
}: {
  line: PayrollRunLine;
  onClick: () => void;
  isFinal?: boolean;
  onDisburse?: () => void;
  disbursing?: boolean;
}) {
  const emp = line.employee_profiles;
  const name = emp?.full_name ?? `Employee #${line.employee_id}`;
  const hasIssue = line.unresolved_days > 0;

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
      <td className="px-4 py-3 text-right text-sm font-mono text-zinc-600 dark:text-zinc-300">{formatPkr(line.daily_rate)}</td>
      <td className="px-4 py-3 text-right text-sm font-mono text-zinc-600 dark:text-zinc-300">{formatPkr(line.monthly_pay)}</td>
      <td className="px-4 py-3 text-right text-sm font-mono text-rose-600">
        {Number(line.total_deductions) > 0 ? `-${formatPkr(line.total_deductions)}` : formatPkr(0)}
      </td>
      <td className="px-5 py-3 text-right text-sm font-bold text-zinc-900 dark:text-white">{formatPkr(line.net_pay)}</td>
      {isFinal && (
        <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          {line.disbursed_at ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
              {new Date(line.disbursed_at).toLocaleDateString()}
            </span>
          ) : (
            <button
              onClick={onDisburse}
              disabled={disbursing}
              className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
            >
              {disbursing ? "Saving…" : "Mark disbursed"}
            </button>
          )}
        </td>
      )}
    </tr>
  );
}
