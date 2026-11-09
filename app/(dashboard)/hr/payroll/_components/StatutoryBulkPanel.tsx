"use client";

import { Check, Loader2 } from "lucide-react";
import type { PayrollRunLine } from "@/lib/hr.service";
import { STATUTORY_LABELS, stateOf, type StatutoryKey } from "./StatutoryWaiverToggles";

const KEYS: StatutoryKey[] = ["eobi", "sessi", "income_tax"];

interface ItemSummary {
  key: StatutoryKey;
  charged: number;
  waived: number;
  exempt: number;
  /** Lines the switch can affect: everything but profile exemptions. */
  eligible: number;
}

/** Counts per item over the lines the bulk buttons act on. Display only. */
export function summarizeStatutory(lines: PayrollRunLine[]): ItemSummary[] {
  return KEYS.map((key) => {
    let charged = 0;
    let waived = 0;
    let exempt = 0;
    for (const line of lines) {
      const state = stateOf(line, key);
      if (state === "exempt") exempt += 1;
      else if (state === "waived") waived += 1;
      else charged += 1;
    }
    return { key, charged, waived, exempt, eligible: charged + waived };
  });
}

function pct(n: number, total: number) {
  return total > 0 ? `${(n / total) * 100}%` : "0%";
}

/**
 * TAFSD-470: the bulk EOBI / SESSI / income tax controls on the payroll run
 * page, redesigned. Each item shows how many target lines are charged, waived
 * or exempt, and two buttons that call the same bulk action as before. The
 * button matching the current state is shown as done instead of offered.
 * Nothing here decides what gets charged; the server does, as before.
 */
export function StatutoryBulkPanel({
  targets,
  selectedCount,
  canAct,
  busy,
  onBulk,
  onClearSelection,
}: {
  /** The lines the buttons act on: the ticked unfinalized lines, or every unfinalized line. */
  targets: PayrollRunLine[];
  /** How many lines are ticked; 0 means the buttons act on every unfinalized line. */
  selectedCount: number;
  /** Permission, a real run, and at least one unfinalized line. */
  canAct: boolean;
  /** `${key}:${waive}` of the bulk call in flight, as the page tracks it. */
  busy: string | null;
  onBulk: (key: StatutoryKey, waive: boolean) => void;
  onClearSelection: () => void;
}) {
  const total = targets.length;
  const items = summarizeStatutory(targets);
  const selected = selectedCount > 0;

  return (
    <div className="border-b border-zinc-100 dark:border-zinc-800">
      {canAct && (
        <section aria-labelledby="statutory-bulk-heading" className="px-5 pt-4 pb-3 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <h2 id="statutory-bulk-heading" className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Statutory deductions · this cycle
              </h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {selected
                  ? `Buttons change only the ${total} ticked line${total === 1 ? "" : "s"}, for this cycle only. Clear the selection to act on every unfinalized line.`
                  : `Buttons change all ${total} unfinalized line${total === 1 ? "" : "s"}, for this cycle only. Finalized lines and employee profiles are not touched.`}
              </p>
            </div>
            {selected ? (
              <span className="inline-flex items-center gap-2 shrink-0">
                <span className="inline-flex items-center h-7 px-3 rounded-full bg-primary text-white text-xs font-semibold">
                  {total} line{total === 1 ? "" : "s"} selected
                </span>
                <button
                  type="button"
                  onClick={onClearSelection}
                  className="h-7 px-2 text-xs text-zinc-600 dark:text-zinc-400 underline hover:text-zinc-900 dark:hover:text-zinc-200"
                >
                  Clear selection
                </button>
              </span>
            ) : (
              <span className="inline-flex items-center h-7 px-3 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                All {total} unfinalized line{total === 1 ? "" : "s"}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {items.map((item) => {
              const label = STATUTORY_LABELS[item.key];
              const allCharged = item.eligible > 0 && item.waived === 0;
              const allWaived = item.eligible > 0 && item.charged === 0;
              const headline =
                item.eligible === 0
                  ? `All ${item.exempt} exempt`
                  : allCharged
                    ? `All ${item.eligible} charged`
                    : allWaived
                      ? `All ${item.eligible} waived`
                      : `${item.charged} of ${item.eligible} charged`;
              return (
                <div
                  key={item.key}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col gap-3"
                >
                  <span className="text-[13px] font-bold text-zinc-900 dark:text-zinc-100">{label}</span>
                  <span className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{headline}</span>
                  <div className="flex h-2 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800" aria-hidden="true">
                    <div className="bg-emerald-600" style={{ width: pct(item.charged, total) }} />
                    <div className="bg-amber-400" style={{ width: pct(item.waived, total) }} />
                    <div className="bg-zinc-300 dark:bg-zinc-600" style={{ width: pct(item.exempt, total) }} />
                  </div>
                  <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-600" /> {item.charged} charged
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-400" /> {item.waived} waived
                    </span>
                    {item.exempt > 0 && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-600" /> {item.exempt} exempt on profile
                      </span>
                    )}
                  </div>
                  {item.eligible > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <BulkButton
                        done={allCharged}
                        doneLabel="All charged"
                        label={`Charge all ${item.eligible}`}
                        tone="charged"
                        busy={busy === `${item.key}:false`}
                        disabled={busy !== null}
                        ariaLabel={`Charge ${label} on all ${item.eligible} lines this cycle`}
                        onClick={() => onBulk(item.key, false)}
                      />
                      <BulkButton
                        done={allWaived}
                        doneLabel="All waived"
                        label={`Waive all ${item.eligible}`}
                        tone="waived"
                        busy={busy === `${item.key}:true`}
                        disabled={busy !== null}
                        ariaLabel={`Waive ${label} on all ${item.eligible} lines this cycle`}
                        onClick={() => onBulk(item.key, true)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div
        className={`flex flex-wrap items-center gap-x-3.5 gap-y-1.5 px-5 text-xs text-zinc-600 dark:text-zinc-400 ${
          canAct ? "pb-4" : "py-2.5"
        }`}
      >
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">On each line:</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 h-[22px] px-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 text-[10px] font-bold uppercase text-zinc-700 dark:text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            EOBI
          </span>
          charged
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 h-[22px] px-1.5 rounded-md border border-amber-300 bg-amber-50 text-[10px] font-bold uppercase text-amber-700 line-through decoration-2 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            EOBI
          </span>
          waived this cycle
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex items-center h-[22px] px-1.5 rounded-md bg-zinc-100 text-[10px] font-bold uppercase text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            EOBI · Exempt
          </span>
          exempt on the employee&apos;s profile
        </span>
        <span className="text-zinc-500 dark:text-zinc-400">Click a chip on an unfinalized line to switch it.</span>
      </div>
    </div>
  );
}

function BulkButton({
  done,
  doneLabel,
  label,
  tone,
  busy,
  disabled,
  ariaLabel,
  onClick,
}: {
  done: boolean;
  doneLabel: string;
  label: string;
  tone: "charged" | "waived";
  busy: boolean;
  disabled: boolean;
  ariaLabel: string;
  onClick: () => void;
}) {
  if (done) {
    // Already the state of every line: show it as done, not as an action.
    return (
      <span
        className={`h-10 rounded-xl border inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold ${
          tone === "charged"
            ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
            : "border-amber-600 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
        }`}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
        {doneLabel}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="h-10 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 inline-flex items-center justify-center gap-1.5 transition-colors"
    >
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
      {label}
    </button>
  );
}
