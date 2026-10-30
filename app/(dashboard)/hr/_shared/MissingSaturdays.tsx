"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { saturdaySchedulesService, SaturdayGap } from "@/lib/leaves.service";

/**
 * TAFSD-445: working Saturdays are marked per person at the start of each
 * cycle, so someone added later is left without them. These two pieces show
 * the Saturdays their campus + segment peers work and add them in one click.
 */

const fmtSat = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function errorMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

/** One employee: "Their segment works 17 Oct and 24 Oct. Add these?" — hidden when there's nothing to add or no access. */
export function SaturdaySuggestionBanner({ employeeId, canWrite }: { employeeId: number; canWrite: boolean }) {
  const [dates, setDates] = useState<string[]>([]);
  const [who, setWho] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDates([]);
    setDone(null);
    setError(null);
    saturdaySchedulesService
      .suggestions(employeeId)
      .then((r) => {
        if (cancelled) return;
        setDates(r.dates);
        setWho([r.group?.segment, r.group?.campus].filter(Boolean).join(", ") || null);
      })
      // No Saturday access, or nothing to compare against: show nothing.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  if (done) {
    return <p className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">{done}</p>;
  }
  if (dates.length === 0) return null;

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await saturdaySchedulesService.create([employeeId], dates);
      setDone(
        `Added ${r.created.length} working Saturday${r.created.length === 1 ? "" : "s"}: ${dates.map(fmtSat).join(", ")}.` +
          (r.skipped_cap.length ? " Some were skipped: already at the 5-per-cycle limit." : ""),
      );
      setDates([]);
    } catch (err) {
      setError(errorMessage(err, "Could not add the Saturdays."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
      <CalendarPlus className="h-4 w-4 shrink-0" />
      <p className="flex-1 min-w-[12rem]">
        {who ? `${who} works` : "Their segment works"} <strong>{dates.map(fmtSat).join(", ")}</strong>, but these
        Saturdays aren&apos;t marked for this employee.
        {error && <span className="block text-rose-600 mt-1">{error}</span>}
      </p>
      {canWrite && (
        <button
          type="button"
          onClick={add}
          disabled={busy}
          className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-3 w-3 animate-spin" />} Add {dates.length === 1 ? "it" : `these ${dates.length}`}
        </button>
      )}
    </div>
  );
}

/** A whole cycle: everyone left without working Saturdays their segment works. */
export function SaturdayGapsPanel({
  month,
  campusId,
  canWrite,
  onAdded,
  title = "Staff missing working Saturdays",
}: {
  month: string;
  campusId?: string;
  canWrite: boolean;
  onAdded?: () => void;
  title?: string;
}) {
  const [gaps, setGaps] = useState<SaturdayGap[]>([]);
  const [busyId, setBusyId] = useState<number | "all" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    saturdaySchedulesService
      .gaps(month, campusId)
      .then(setGaps)
      .catch(() => setGaps([]));
  }, [month, campusId]);

  useEffect(() => {
    load();
  }, [load]);

  if (gaps.length === 0) return null;

  const add = async (rows: SaturdayGap[], key: number | "all") => {
    setBusyId(key);
    setError(null);
    try {
      for (const g of rows) await saturdaySchedulesService.create([g.employee_id], g.dates);
      load();
      onAdded?.();
    } catch (err) {
      setError(errorMessage(err, "Could not add the Saturdays."));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarPlus className="h-4 w-4 text-amber-600" />
        <h2 className="font-semibold text-sm text-amber-900 dark:text-amber-200 flex-1">
          {title} ({gaps.length})
        </h2>
        {canWrite && gaps.length > 1 && (
          <button
            type="button"
            onClick={() => add(gaps, "all")}
            disabled={busyId !== null}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-50"
          >
            {busyId === "all" && <Loader2 className="h-3 w-3 animate-spin" />} Add all
          </button>
        )}
      </div>
      <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
        No working Saturday is marked for them this cycle, though most of their campus and segment works the dates shown
        (from their joining date). Usually someone who joined, rejoined or moved after the Saturdays were marked.
      </p>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <ul className="divide-y divide-amber-200/60 dark:divide-amber-900/40">
        {gaps.map((g) => (
          <li key={g.employee_id} className="flex flex-wrap items-center gap-2 py-2 text-xs">
            <span className="flex-1 min-w-[12rem]">
              <span className="font-semibold text-zinc-800 dark:text-zinc-100">{g.full_name ?? `#${g.employee_id}`}</span>
              <span className="text-zinc-500"> · {[g.employee_code, g.segment, g.campus].filter(Boolean).join(" · ")}</span>
              {g.join_date && <span className="text-zinc-500"> · joined {fmtSat(g.join_date)}</span>}
            </span>
            <span className="text-amber-800 dark:text-amber-300">{g.dates.map(fmtSat).join(", ")}</span>
            {canWrite && (
              <button
                type="button"
                onClick={() => add([g], g.employee_id)}
                disabled={busyId !== null}
                className="inline-flex items-center gap-1 h-6 px-2.5 rounded-md border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/30 disabled:opacity-50"
              >
                {busyId === g.employee_id && <Loader2 className="h-3 w-3 animate-spin" />} Add
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
