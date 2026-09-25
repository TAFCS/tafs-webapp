"use client";

import { FormEvent, useId, useState } from "react";

export type DepositAction = "refund" | "forfeit" | "close";

export interface DepositActionSubmit {
  amount: number;
  note: string;
  stopCollection: boolean;
}

const inputCls =
  "w-full h-10 px-3 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";
const textareaCls =
  "w-full px-3 py-2 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

function pkr(value: number): string {
  return `Rs. ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Refund / forfeit / stop-collecting form shared by the Security Deposits page
 * (drawer) and the employee tab (inline). Errors render inside the form — the
 * drawer covers the page banner — and every money-moving action goes through a
 * confirm step because none of them can be undone.
 */
export function DepositActionForm({
  action,
  held,
  remaining,
  saving,
  error,
  onSubmit,
  onCancel,
}: {
  action: DepositAction;
  /** Money currently held for the employee. */
  held: number;
  /** Target not yet collected. */
  remaining: number;
  saving: boolean;
  /** Error from the server for the last attempt. */
  error?: string | null;
  onSubmit: (values: DepositActionSubmit) => void | Promise<void>;
  onCancel: () => void;
}) {
  const ids = { amount: useId(), note: useId(), stop: useId() };
  const isClose = action === "close";
  // Forfeit starts empty on purpose: pre-filling the whole balance makes
  // forfeiting everything one reason-and-click away.
  const [amount, setAmount] = useState(action === "refund" ? String(held) : "");
  const [note, setNote] = useState("");
  const [stopTouched, setStopTouched] = useState<boolean | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const parsed = round2(Number(amount));
  // An unfinished plan keeps deducting after a refund unless told to stop, so
  // the box is on by default once the whole held balance is being paid out.
  const stopDefault = remaining > 0 && parsed >= held;
  const stopCollection = isClose ? true : stopTouched ?? stopDefault;

  const validate = (): string | null => {
    if (!isClose) {
      if (!Number.isFinite(parsed) || parsed <= 0) return "Enter an amount greater than zero.";
      if (parsed > held) return `That is more than the ${pkr(held)} currently held.`;
    }
    if (action === "forfeit" && !note.trim()) return "A reason is required to forfeit a deposit.";
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const problem = validate();
    setLocalError(problem);
    if (problem) {
      setConfirming(false);
      return;
    }
    if (!confirming) {
      setConfirming(true);
      return;
    }
    await onSubmit({ amount: parsed, note: note.trim(), stopCollection });
  };

  const verb = action === "refund" ? "Refund" : action === "forfeit" ? "Forfeit" : "Stop collecting";
  const heldAfter = isClose ? held : round2(Math.max(0, held - (Number.isFinite(parsed) ? parsed : 0)));
  const shownError = localError ?? error ?? null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {isClose ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Payroll will stop deducting for this plan. The target drops to what has been recovered, so the{" "}
          <strong>{pkr(remaining)}</strong> still to collect is written off. Anything held stays held until you refund or forfeit it.
        </p>
      ) : (
        <div>
          <label htmlFor={ids.amount} className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
            {verb} amount <span className="normal-case font-medium">(held {pkr(held)})</span>
          </label>
          <div className="flex gap-2">
            <input
              id={ids.amount}
              className={inputCls}
              inputMode="decimal"
              value={amount}
              placeholder={action === "forfeit" ? "0.00" : undefined}
              onChange={(e) => {
                setAmount(e.target.value);
                setConfirming(false);
              }}
            />
            <button
              type="button"
              onClick={() => {
                setAmount(String(held));
                setConfirming(false);
              }}
              className="h-10 px-3 shrink-0 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold"
            >
              Full balance
            </button>
          </div>
        </div>
      )}

      <div>
        <label htmlFor={ids.note} className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
          {action === "forfeit" ? "Reason (required)" : "Notes"}
        </label>
        <textarea
          id={ids.note}
          rows={3}
          className={textareaCls}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setConfirming(false);
          }}
        />
      </div>

      {!isClose && remaining > 0 && (
        <label htmlFor={ids.stop} className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-300 cursor-pointer">
          <input
            id={ids.stop}
            type="checkbox"
            className="mt-0.5"
            checked={stopCollection}
            onChange={(e) => {
              setStopTouched(e.target.checked);
              setConfirming(false);
            }}
          />
          <span>
            <strong>Stop collecting the remaining {pkr(remaining)}.</strong>{" "}
            {stopCollection
              ? "Payroll will no longer deduct for this plan (use this when the employee has left)."
              : "Payroll keeps deducting the rest of the plan (only for a partial refund while still employed)."}
          </span>
        </label>
      )}

      {confirming && (
        <div
          role="alert"
          className={`rounded-xl border px-3 py-2.5 text-xs ${
            action === "forfeit"
              ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
              : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
          }`}
        >
          {isClose ? (
            <>Confirm: stop collecting and write off {pkr(remaining)}. This cannot be undone.</>
          ) : (
            <>
              Confirm: {action === "refund" ? "refund" : "forfeit"} <strong>{pkr(parsed)}</strong>. {pkr(heldAfter)} will remain held.{" "}
              {stopCollection && remaining > 0 ? `Collection of the remaining ${pkr(remaining)} stops. ` : ""}
              This cannot be undone.
            </>
          )}
        </div>
      )}

      {shownError && (
        <p role="alert" className="text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900 rounded-xl px-3 py-2">
          {shownError}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className={`h-10 px-4 rounded-xl text-white text-sm font-bold disabled:opacity-60 ${
            confirming && action === "forfeit" ? "bg-rose-600" : "bg-primary"
          }`}
        >
          {saving ? "Saving..." : confirming ? `Confirm ${verb.toLowerCase()}` : `Review ${verb.toLowerCase()}`}
        </button>
        <button type="button" onClick={onCancel} className="h-10 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-bold">
          Back
        </button>
      </div>
    </form>
  );
}
