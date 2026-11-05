"use client";

import { useState } from "react";
import { Check, Loader2, Undo2 } from "lucide-react";
import { DayBreakdownEntry, DeductionKind, DeductionWaivers } from "@/lib/hr.service";

export const DEDUCTION_KIND_LABEL: Record<DeductionKind, string> = {
  ABSENCE: "Absence",
  HALF_DAY: "Half day",
  LATE: "Late arrival",
  EARLY_LEAVE: "Early leaving",
  BREAK: "Break",
};
const KINDS: DeductionKind[] = ["ABSENCE", "HALF_DAY", "LATE", "EARLY_LEAVE", "BREAK"];

export function emptyWaivers(w?: DeductionWaivers): DeductionWaivers {
  return { types: w?.types ?? [], days: w?.days ?? {}, reasons: w?.reasons ?? {} };
}

/** What this day would be deducted for, so it can be let off. */
export function deductibleKinds(day: DayBreakdownEntry): DeductionKind[] {
  const kinds: DeductionKind[] = [];
  if (day.classification === "ABSENT" || day.classification === "UNPAID_LEAVE") kinds.push("ABSENCE");
  if (day.classification === "HALF_DAY") kinds.push("HALF_DAY");
  if (day.late_minutes > 0) kinds.push("LATE");
  if ((day.early_leave_minutes ?? 0) > 0) kinds.push("EARLY_LEAVE");
  if (day.break_minutes > 0) kinds.push("BREAK");
  return kinds;
}

/**
 * TAFSD-471: switch a whole deduction type on or off for this employee, this
 * cycle only. Lit = deducted.
 */
export function CycleDeductionSwitches({
  waivers,
  disabled,
  onChange,
}: {
  waivers: DeductionWaivers;
  disabled: boolean;
  onChange: (types: DeductionKind[]) => Promise<void>;
}) {
  const [busy, setBusy] = useState<DeductionKind | null>(null);
  const toggle = async (kind: DeductionKind) => {
    const off = waivers.types.includes(kind);
    setBusy(kind);
    try {
      await onChange(off ? waivers.types.filter((k) => k !== kind) : [...waivers.types, kind]);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="mt-2.5 pt-2.5 border-t border-dashed border-zinc-200 dark:border-zinc-800">
      <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-1.5">
        Deduct this cycle <span className="normal-case tracking-normal font-normal">· click to switch off for this payroll only</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((kind) => {
          const off = waivers.types.includes(kind);
          return (
            <button
              key={kind}
              type="button"
              disabled={disabled || busy !== null}
              onClick={() => toggle(kind)}
              title={off ? `Not deducting ${DEDUCTION_KIND_LABEL[kind].toLowerCase()} this cycle. Click to deduct again.` : `Click to stop deducting ${DEDUCTION_KIND_LABEL[kind].toLowerCase()} this cycle`}
              className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-semibold border transition disabled:opacity-50 ${
                off
                  ? "border-zinc-200 dark:border-zinc-700 text-zinc-400 line-through"
                  : "border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400"
              }`}
            >
              {busy === kind ? <Loader2 className="h-3 w-3 animate-spin" /> : !off && <Check className="h-3 w-3" />}
              {DEDUCTION_KIND_LABEL[kind]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** TAFSD-472: let one day's deductions off for this payroll only. */
export function DayDeductionLetOff({
  day,
  waivers,
  disabled,
  onSave,
}: {
  day: DayBreakdownEntry;
  waivers: DeductionWaivers;
  disabled: boolean;
  onSave: (kinds: DeductionKind[], reason: string) => Promise<void>;
}) {
  const current = waivers.days[day.date] ?? [];
  const kinds = deductibleKinds(day).filter((k) => !waivers.types.includes(k));
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<DeductionKind>>(new Set(current.length ? current : kinds));
  const [reason, setReason] = useState(waivers.reasons[day.date] ?? "");
  const [saving, setSaving] = useState(false);

  const save = async (next: DeductionKind[], why: string) => {
    setSaving(true);
    try {
      await onSave(next, why);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (current.length > 0) {
    return (
      <div className="mb-2.5 flex flex-wrap items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1.5 text-[11px] text-emerald-800 dark:text-emerald-300">
        <Check className="h-3 w-3 shrink-0" />
        <span className="font-semibold">Let off this payroll: {current.map((k) => DEDUCTION_KIND_LABEL[k]).join(", ")}</span>
        {waivers.reasons[day.date] && <span className="text-emerald-700/80 dark:text-emerald-400/80">· {waivers.reasons[day.date]}</span>}
        {!disabled && (
          <button
            type="button"
            onClick={() => save([], "")}
            disabled={saving}
            className="ml-auto inline-flex items-center gap-1 font-semibold hover:underline disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />} Deduct again
          </button>
        )}
      </div>
    );
  }
  if (disabled || kinds.length === 0) return null;
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-2.5 text-[11px] font-semibold text-primary hover:underline"
      >
        Let off this day&apos;s deduction
      </button>
    );
  }
  return (
    <div className="mb-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 p-2.5 space-y-2">
      <p className="text-[11px] text-zinc-500">Don&apos;t deduct for this day, on this payroll only. The attendance stays as it is.</p>
      <div className="flex flex-wrap gap-3">
        {kinds.map((k) => (
          <label key={k} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={picked.has(k)}
              onChange={(e) =>
                setPicked((prev) => {
                  const next = new Set(prev);
                  if (e.target.checked) next.add(k);
                  else next.delete(k);
                  return next;
                })
              }
            />
            {DEDUCTION_KIND_LABEL[k]}
          </label>
        ))}
      </div>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={300}
        placeholder="Reason (optional), e.g. doctor's appointment"
        className="w-full h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={saving || picked.size === 0}
          onClick={() => save([...picked], reason)}
          className="h-7 px-3 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[11px] font-bold disabled:opacity-40 inline-flex items-center gap-1.5"
        >
          {saving && <Loader2 className="h-3 w-3 animate-spin" />} Let off
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-zinc-400 hover:text-zinc-600">
          Cancel
        </button>
      </div>
    </div>
  );
}
