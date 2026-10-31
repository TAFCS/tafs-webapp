"use client";

import { useState } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { saturdaySchedulesService, SaturdaySuggestions } from "@/lib/leaves.service";

/**
 * TAFSD-445 (30): the last step of registering an employee. Their campus +
 * segment peers' working Saturdays for this cycle and next, ticked by default,
 * so a teacher who joins mid-cycle isn't left without them.
 */

const fmtSat = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function RegistrationSaturdaysStep({
  employeeId,
  employeeName,
  suggestions,
  onDone,
}: {
  employeeId: number;
  employeeName: string;
  suggestions: SaturdaySuggestions;
  /** Carries on with registration (password popup or back to the directory). */
  onDone: () => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(suggestions.dates));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const who = [suggestions.group?.segment, suggestions.group?.campus].filter(Boolean).join(", ");

  const toggle = (d: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });

  const add = async () => {
    const dates = suggestions.dates.filter((d) => picked.has(d));
    if (dates.length === 0) return onDone();
    setBusy(true);
    setError(null);
    try {
      await saturdaySchedulesService.create([employeeId], dates);
      onDone();
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Could not add the Saturdays. You can add them later from the employee's profile.",
      );
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-xl">
            <CalendarPlus className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-[15px] font-extrabold text-zinc-900 dark:text-zinc-100">Working Saturdays</h3>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
          {employeeName || "This employee"} was registered. {who ? `${who} works` : "Their segment works"} these
          Saturdays. Untick any they won&apos;t work.
        </p>
        <div className="space-y-2">
          {suggestions.dates.map((d) => (
            <label
              key={d}
              className="flex items-center gap-3 cursor-pointer rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200"
            >
              <input
                type="checkbox"
                checked={picked.has(d)}
                onChange={() => toggle(d)}
                className="rounded border-zinc-300 text-primary focus:ring-primary/30"
              />
              {fmtSat(d)}
            </label>
          ))}
        </div>
        {error && <p className="mt-3 text-xs font-semibold text-rose-600">{error}</p>}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onDone}
            disabled={busy}
            className="h-11 flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={add}
            disabled={busy}
            className="h-11 flex-1 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {picked.size === 0 ? "Continue" : `Add ${picked.size} Saturday${picked.size === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
