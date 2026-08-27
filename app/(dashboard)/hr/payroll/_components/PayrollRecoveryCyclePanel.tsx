"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, HandCoins, Wallet } from "lucide-react";
import {
  hrService,
  EmployeeLoan,
  PayrollRun,
  SecurityDepositPlan,
} from "@/lib/hr.service";
import { postponeFirstSlot, setFirstSlotAmount } from "../../_components/recovery-schedule-adjust";

function money2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatPkr(value: number | string): string {
  return `Rs. ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Kind = "loan" | "deposit";

interface PlanView {
  kind: Kind;
  remaining: number;
  schedule: number[];
  thisCycle: number;
}

function loanView(plan: EmployeeLoan | null): PlanView | null {
  if (!plan || plan.status !== "ACTIVE" || plan.outstanding_balance <= 0) return null;
  const schedule = (plan.installment_schedule ?? []).map(money2);
  const fallback = Number(plan.installment_amount) || 0;
  return {
    kind: "loan",
    remaining: money2(plan.outstanding_balance),
    schedule,
    thisCycle: money2(schedule[0] ?? fallback),
  };
}

function depositView(plan: SecurityDepositPlan | null): PlanView | null {
  if (!plan || plan.status !== "ACTIVE" || plan.remaining_to_collect <= 0) return null;
  const schedule = (plan.installment_schedule ?? []).map(money2);
  const fallback = Number(plan.installment_amount) || 0;
  return {
    kind: "deposit",
    remaining: money2(plan.remaining_to_collect),
    schedule,
    thisCycle: money2(schedule[0] ?? fallback),
  };
}

interface Props {
  employeeId: number;
  locked: boolean;
  loanDeduction?: number;
  depositDeduction?: number;
  regenerate?: {
    runId: number;
    onRegenerated: (run: PayrollRun) => void;
  };
  onError: (message: string | null) => void;
}

export function PayrollRecoveryCyclePanel({
  employeeId,
  locked,
  loanDeduction,
  depositDeduction,
  regenerate,
  onError,
}: Props) {
  const [loan, setLoan] = useState<PlanView | null>(null);
  const [deposit, setDeposit] = useState<PlanView | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKind, setSavingKind] = useState<Kind | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [loanRes, depositRes] = await Promise.all([
        hrService.getEmployeeLoan(employeeId),
        hrService.getEmployeeSecurityDeposit(employeeId),
      ]);
      setLoan(loanView(loanRes.current));
      setDeposit(depositView(depositRes.current));
    } catch {
      setLoan(null);
      setDeposit(null);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  const apply = async (kind: Kind, buildAmounts: () => number[]) => {
    if (!regenerate || locked) return;
    setSavingKind(kind);
    onError(null);
    try {
      const amounts = buildAmounts();
      if (kind === "loan") {
        await hrService.updateEmployeeLoanSchedule(employeeId, amounts);
      } else {
        await hrService.updateEmployeeSecurityDepositSchedule(employeeId, amounts);
      }
      const updated = await hrService.regeneratePayrollLine(regenerate.runId, employeeId);
      regenerate.onRegenerated(updated);
      await load();
    } catch (err: unknown) {
      const responseMessage = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      const thrown = err instanceof Error ? err.message : null;
      const message = Array.isArray(responseMessage)
        ? responseMessage.join(". ")
        : (responseMessage ?? thrown ?? "Failed to update this cycle's recovery.");
      onError(message);
    } finally {
      setSavingKind(null);
    }
  };

  const showLockedLoan = locked && Number(loanDeduction) > 0;
  const showLockedDeposit = locked && Number(depositDeduction) > 0;
  if (loading) {
    return (
      <div className="px-6 py-3 bg-white dark:bg-zinc-900/80 border-b border-zinc-100 dark:border-zinc-800 shrink-0 text-xs text-zinc-400 flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading loan and security deposit for this cycle...
      </div>
    );
  }

  if (!loan && !deposit && !showLockedLoan && !showLockedDeposit) return null;

  return (
    <div className="px-6 py-3 bg-white dark:bg-zinc-900/80 border-b border-zinc-100 dark:border-zinc-800 shrink-0 space-y-2.5">
      <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
        Loan / security deposit this cycle
      </p>
      {locked ? (
        <>
          {(loan || showLockedLoan) && (
            <LockedCopy
              kind="loan"
              employeeId={employeeId}
              amountThisSlip={Number(loanDeduction) || 0}
            />
          )}
          {(deposit || showLockedDeposit) && (
            <LockedCopy
              kind="deposit"
              employeeId={employeeId}
              amountThisSlip={Number(depositDeduction) || 0}
            />
          )}
        </>
      ) : (
        <>
          {loan && (
            <RecoveryCycleCard
              kind="loan"
              plan={loan}
              saving={savingKind === "loan"}
              disabled={savingKind !== null || !regenerate}
              onSkip={() => apply("loan", () => postponeFirstSlot(loan.schedule.length ? loan.schedule : [loan.thisCycle]))}
              onApply={(amount) => apply("loan", () => setFirstSlotAmount(
                loan.schedule.length ? loan.schedule : [loan.thisCycle],
                loan.remaining,
                amount,
              ))}
            />
          )}
          {deposit && (
            <RecoveryCycleCard
              kind="deposit"
              plan={deposit}
              saving={savingKind === "deposit"}
              disabled={savingKind !== null || !regenerate}
              onSkip={() => apply("deposit", () => postponeFirstSlot(deposit.schedule.length ? deposit.schedule : [deposit.thisCycle]))}
              onApply={(amount) => apply("deposit", () => setFirstSlotAmount(
                deposit.schedule.length ? deposit.schedule : [deposit.thisCycle],
                deposit.remaining,
                amount,
              ))}
            />
          )}
        </>
      )}
    </div>
  );
}

function RecoveryCycleCard({
  kind,
  plan,
  saving,
  disabled,
  onSkip,
  onApply,
}: {
  kind: Kind;
  plan: PlanView;
  saving: boolean;
  disabled: boolean;
  onSkip: () => void;
  onApply: (amount: number) => void;
}) {
  const [amount, setAmount] = useState(plan.thisCycle.toFixed(2));
  useEffect(() => {
    setAmount(plan.thisCycle.toFixed(2));
  }, [plan.thisCycle]);

  const parsed = money2(Number(amount));
  const skipDisabled = disabled || plan.thisCycle === 0 || saving;
  const applyDisabled =
    disabled ||
    saving ||
    !Number.isFinite(parsed) ||
    parsed < 0 ||
    parsed > plan.remaining ||
    parsed === plan.thisCycle;

  const label = kind === "loan" ? "Loan" : "Security deposit";

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 py-2.5">
      <div className="flex items-start gap-2">
        {kind === "loan" ? (
          <HandCoins className="h-4 w-4 text-zinc-400 mt-0.5 shrink-0" />
        ) : (
          <Wallet className="h-4 w-4 text-zinc-400 mt-0.5 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
            {label}: {plan.thisCycle === 0 ? "skip this cycle" : formatPkr(plan.thisCycle)}
            <span className="font-normal text-zinc-400">
              {" "}of {formatPkr(plan.remaining)} remaining
            </span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              className="h-8 w-28 px-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 outline-none focus:border-primary"
              inputMode="decimal"
              value={amount}
              disabled={disabled || saving}
              onChange={(e) => setAmount(e.target.value)}
            />
            <button
              type="button"
              disabled={applyDisabled}
              onClick={() => {
                if (parsed === 0) onSkip();
                else onApply(parsed);
              }}
              className="h-8 px-2.5 rounded-lg bg-primary text-white text-[11px] font-bold disabled:opacity-50 inline-flex items-center"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Apply"}
            </button>
            <button
              type="button"
              disabled={skipDisabled}
              onClick={onSkip}
              className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-[11px] font-bold disabled:opacity-50"
            >
              Skip this cycle
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-400">
            Skip postpones this installment to a new last month. Reducing puts the leftover on the last remaining month.
          </p>
        </div>
      </div>
    </div>
  );
}

function LockedCopy({
  kind,
  employeeId,
  amountThisSlip,
}: {
  kind: Kind;
  employeeId: number;
  amountThisSlip: number;
}) {
  const label = kind === "loan" ? "Loan" : "Security deposit";
  const tab = kind === "loan" ? "loan" : "security_deposit";
  const collected = amountThisSlip > 0;
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 py-2.5 text-[11px] text-zinc-500 space-y-1">
      <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
        {label}: {collected ? `${formatPkr(amountThisSlip)} this cycle (released)` : "this cycle is already released"}
      </p>
      <p>
        This payslip is locked. The amount already taken this month cannot be skipped or reduced here.
      </p>
      {kind === "deposit" ? (
        <p>
          If too much caution money was taken, refund the extra on the Security Deposit tab. Later months can still be skipped or reduced.
        </p>
      ) : (
        <p>
          That deduction already lowered the loan balance. Payroll cannot put this month&apos;s cash back on the slip. Collect less (or skip) in later months, or settle outside payroll.
        </p>
      )}
      <Link href={`/hr/employees?id=${employeeId}&tab=${tab}`} className="inline-block font-bold text-primary">
        Edit remaining plan
      </Link>
    </div>
  );
}
