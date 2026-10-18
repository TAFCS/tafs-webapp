"use client";

import { Loader2 } from "lucide-react";
import type { PayrollRunLine } from "@/lib/hr.service";

export type StatutoryKey = "eobi" | "sessi" | "income_tax";

const ITEMS: { key: StatutoryKey; label: string; full: string }[] = [
  { key: "eobi", label: "EOBI", full: "EOBI" },
  { key: "sessi", label: "SESSI", full: "SESSI" },
  { key: "income_tax", label: "Tax", full: "Income tax" },
];

function stateOf(line: PayrollRunLine, key: StatutoryKey): "applied" | "waived" | "exempt" {
  if (key === "eobi" && line.eobi_exempt) return "exempt";
  if (key === "sessi" && line.sessi_exempt) return "exempt";
  const waived = key === "eobi" ? line.eobi_waived : key === "sessi" ? line.sessi_waived : line.income_tax_waived;
  return waived ? "waived" : "applied";
}

/**
 * TAFSD-383: one switch each for EOBI, SESSI and income tax on a payroll
 * line, for this cycle only. "On" = charged. Switching one off waives it for
 * this employee in this cycle; the employee profile is not changed. A profile
 * exemption shows as a locked "Exempt" chip.
 */
export function StatutoryWaiverToggles({
  line,
  editable,
  lockedReason,
  busyKey,
  onToggle,
}: {
  line: PayrollRunLine;
  editable: boolean;
  /** Shown as the tooltip when not editable. */
  lockedReason?: string;
  busyKey: StatutoryKey | null;
  onToggle: (key: StatutoryKey, waive: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
      {ITEMS.map(({ key, label, full }) => {
        const state = stateOf(line, key);
        const busy = busyKey === key;
        if (state === "exempt") {
          return (
            <span
              key={key}
              title={`${full}: exempt on the employee's profile. Change it on the profile, not here.`}
              className="inline-flex items-center h-6 px-2 rounded-md text-[10px] font-bold uppercase tracking-tight bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 cursor-default"
            >
              {label} · Exempt
            </span>
          );
        }
        const applied = state === "applied";
        return (
          <button
            key={key}
            type="button"
            role="switch"
            aria-checked={applied}
            aria-label={`${full} for this cycle`}
            disabled={!editable || busyKey !== null}
            onClick={() => onToggle(key, applied)}
            title={
              !editable
                ? lockedReason ?? `${full} is ${applied ? "charged" : "waived"} this cycle.`
                : applied
                  ? `${full} is charged this cycle. Click to waive it for this employee in this cycle only.`
                  : `${full} is WAIVED this cycle. Click to charge it again.`
            }
            className={`inline-flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-bold uppercase tracking-tight border transition-colors disabled:cursor-not-allowed ${
              applied
                ? "bg-white text-zinc-700 border-zinc-200 hover:border-amber-300 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700"
                : "bg-amber-50 text-amber-700 border-amber-300 line-through decoration-2 hover:border-amber-400 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
            } ${!editable ? "opacity-60" : ""}`}
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <span className={`h-1.5 w-1.5 rounded-full ${applied ? "bg-emerald-500" : "bg-amber-500"}`} />
            )}
            {label}
          </button>
        );
      })}
    </div>
  );
}

export const STATUTORY_LABELS: Record<StatutoryKey, string> = { eobi: "EOBI", sessi: "SESSI", income_tax: "Income tax" };
