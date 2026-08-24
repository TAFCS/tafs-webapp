"use client";

import { useState } from "react";
import { AlertTriangle, Check, X, Loader2, Sandwich, TimerReset } from "lucide-react";
import { hrService, PayrollFlag, PayrollRun, PayrollRunLine } from "@/lib/hr.service";

interface Props {
  run: PayrollRun;
  lines: PayrollRunLine[];
  onDecided: (updated: PayrollRun) => void;
}

const FLAG_META: Record<PayrollFlag["flag_type"], { label: string; icon: typeof Sandwich; explanation: string }> = {
  SANDWICH: {
    label: "Sandwich rule",
    icon: Sandwich,
    explanation: "Off/absent the working day before AND after this off-block (holiday, weekend, or both) — every day in it would become unpaid.",
  },
  CONSECUTIVE_LATE: {
    label: "3 consecutive lates",
    icon: TimerReset,
    explanation: "3 late days in a row — 1 day's pay deducted per complete group of 3.",
  },
};

function formatPkr(value: number): string {
  return `₨ ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateShort(d: string) {
  const date = new Date(`${d}T00:00:00.000Z`);
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
}

export function FlagReviewPanel({ run, lines, onDecided }: Props) {
  const [decidingKey, setDecidingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Once an employee's line is finalized, their flag decisions are locked in
  // too — the backend now rejects decidePayrollFlag for a finalized line, so
  // don't even offer the buttons here.
  const rows = lines
    .filter((line) => line.line_status === "PENDING")
    .flatMap((line) => (line.payroll_flags ?? []).map((flag) => ({ line, flag })));
  if (rows.length === 0) return null;

  const pendingCount = rows.filter((r) => r.flag.status === "PENDING").length;

  const decide = async (employeeId: number, flagId: number, status: "APPLIED" | "EXEMPTED") => {
    const key = `${employeeId}-${flagId}`;
    setDecidingKey(key);
    setError(null);
    try {
      const updated = await hrService.decidePayrollFlag(run.id, employeeId, flagId, status);
      onDecided(updated);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to record this decision.");
    } finally {
      setDecidingKey(null);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900/30 border border-amber-200 dark:border-amber-900/40 rounded-3xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-5 py-4 bg-amber-50/60 dark:bg-amber-950/10 border-b border-amber-100 dark:border-amber-900/30">
        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-bold text-amber-900 dark:text-amber-300">Review Flags</p>
          <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
            Rule-based deductions detected from attendance — nothing is applied until you decide.
            {pendingCount > 0 && (
              <span className="font-semibold"> {pendingCount} pending.</span>
            )}
          </p>
        </div>
      </div>

      {error && (
        <div className="px-5 py-3 bg-rose-50 border-b border-rose-100 text-rose-700 text-xs dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400">
          {error}
        </div>
      )}

      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {rows.map(({ line, flag }) => {
          const meta = FLAG_META[flag.flag_type];
          const Icon = meta.icon;
          const key = `${line.employee_id}-${flag.id}`;
          const deciding = decidingKey === key;
          const name = line.employee_profiles?.full_name ?? `Employee #${line.employee_id}`;

          return (
            <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Icon className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span className="text-sm font-semibold text-zinc-900 dark:text-white">{name}</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                    {meta.label}
                  </span>
                  {flag.status !== "PENDING" && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        flag.status === "APPLIED"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {flag.status === "APPLIED" ? "Applied" : "Exempted"}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">{meta.explanation}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  {flag.dates.map(formatDateShort).join(", ")} · would deduct{" "}
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">{formatPkr(flag.deduction_amount)}</span>
                  {" "}({flag.deduction_days} day{flag.deduction_days === 1 ? "" : "s"})
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => decide(line.employee_id, flag.id, "APPLIED")}
                  disabled={deciding}
                  className={`inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${
                    flag.status === "APPLIED"
                      ? "bg-rose-600 text-white"
                      : "border border-rose-200 dark:border-rose-900/40 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                  }`}
                >
                  {deciding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Apply
                </button>
                <button
                  onClick={() => decide(line.employee_id, flag.id, "EXEMPTED")}
                  disabled={deciding}
                  className={`inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${
                    flag.status === "EXEMPTED"
                      ? "bg-zinc-700 text-white dark:bg-zinc-200 dark:text-zinc-900"
                      : "border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  }`}
                >
                  {deciding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Exempt
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
