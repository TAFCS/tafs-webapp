"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CalendarClock, CalendarOff, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { hrService, CalendarDay } from "@/lib/hr.service";
import { shiftOverridesService, ShiftOverride } from "@/lib/leaves.service";
import { MultiSelectMonthCalendar } from "../employees/_components/MultiSelectMonthCalendar";

export type OverrideMode = "TIME" | "HOLIDAY";

const inputCls =
  "w-full h-10 px-3 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

interface Props {
  /** Employees this panel currently targets. A single id shows that employee's existing overrides inline. */
  employeeIds: number[];
  /** Display name used when employeeIds has exactly one entry (falls back to "Employee #id"). */
  employeeName?: string;
  /** Gates the Holiday Override tab and its submission — only SUPER_ADMIN may create STAFF calendar overrides. */
  isSuperAdmin: boolean;
  /** Called after a successful apply, e.g. so the caller can clear its own employee selection. */
  onApplied?: () => void;
  className?: string;
}

/**
 * Shared "shift time override" + "holiday override" panel — used by both the
 * standalone bulk /hr/shift-overrides page (multi-employee selection lives in
 * the caller) and the Employee Directory's per-employee tab (employeeIds is
 * always a single id). Owns mode switching, date selection, the existing
 * overrides list for a single targeted employee, and the save/delete calls.
 */
export function ShiftHolidayOverridesPanel({ employeeIds, employeeName, isSuperAdmin, onApplied, className }: Props) {
  const [mode, setMode] = useState<OverrideMode>("TIME");

  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [dayType, setDayType] = useState<"HOLIDAY" | "WORKDAY">("HOLIDAY");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  // Ref guard: React state updates are async, so a fast double-click can fire
  // two Applies before `saving` flips and disables the button.
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const [existingCalendarDays, setExistingCalendarDays] = useState<CalendarDay[]>([]);
  const [existingShiftOverrides, setExistingShiftOverrides] = useState<ShiftOverride[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());

  const singleEmployeeId = employeeIds.length === 1 ? employeeIds[0] : null;
  const singleEmployeeLabel = employeeName ?? (singleEmployeeId != null ? `Employee #${singleEmployeeId}` : "");

  const loadExisting = async (employeeId: number) => {
    setLoadingExisting(true);
    try {
      if (mode === "TIME") {
        const rows = await shiftOverridesService.list({ employee_id: employeeId });
        setExistingShiftOverrides(rows);
      } else {
        const rows = await hrService.listCalendarDays(undefined, "STAFF", employeeId);
        setExistingCalendarDays(rows);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingExisting(false);
    }
  };

  // Once exactly one employee is targeted, surface what's already been overridden
  // for them so the admin isn't flying blind on top of prior overrides.
  useEffect(() => {
    if (singleEmployeeId == null) {
      setExistingCalendarDays([]);
      setExistingShiftOverrides([]);
      return;
    }
    loadExisting(singleEmployeeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singleEmployeeId, mode]);

  // If a caller only supports TIME mode (isSuperAdmin false), never leave mode stuck on HOLIDAY.
  useEffect(() => {
    if (!isSuperAdmin && mode === "HOLIDAY") setMode("TIME");
  }, [isSuperAdmin, mode]);

  const existingOverrideDates = useMemo(() => {
    if (mode === "TIME") return new Set(existingShiftOverrides.map((o) => o.date.slice(0, 10)));
    return new Set(existingCalendarDays.map((d) => d.date.slice(0, 10)));
  }, [mode, existingShiftOverrides, existingCalendarDays]);

  const handleDeleteShiftOverride = async (id: number) => {
    if (deletingIds.has(id)) return;
    setDeletingIds((prev) => new Set(prev).add(id));
    // Optimistically drop it from the list immediately so a second click on the
    // same row can't fire a second DELETE for an id that's already gone.
    setExistingShiftOverrides((prev) => prev.filter((o) => o.id !== id));
    try {
      await shiftOverridesService.remove(id);
    } catch (err: any) {
      if (err?.response?.status !== 404) {
        setError("Failed to delete override — please refresh and try again.");
      }
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (singleEmployeeId != null) loadExisting(singleEmployeeId);
    }
  };

  const handleDeleteCalendarDay = async (id: number) => {
    if (deletingIds.has(id)) return;
    setDeletingIds((prev) => new Set(prev).add(id));
    setExistingCalendarDays((prev) => prev.filter((d) => d.id !== id));
    try {
      await hrService.deleteCalendarDay(id);
    } catch (err: any) {
      if (err?.response?.status !== 404) {
        setError("Failed to delete override — please refresh and try again.");
      }
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (singleEmployeeId != null) loadExisting(singleEmployeeId);
    }
  };

  const canSubmit =
    employeeIds.length > 0 &&
    selectedDates.size > 0 &&
    !saving &&
    (mode === "TIME" ? startTime.trim() !== "" || endTime.trim() !== "" : true);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    setSuccess(null);
    setWarning(null);
    try {
      if (mode === "TIME") {
        const rows = await shiftOverridesService.bulkCreate({
          employee_ids: employeeIds,
          dates: [...selectedDates],
          override_start_time: startTime.trim() || undefined,
          override_end_time: endTime.trim() || undefined,
          reason: reason.trim() || undefined,
        });
        setSuccess(
          `Applied to ${employeeIds.length} employee(s) across ${selectedDates.size} day(s) — ${rows.length} override(s) saved.`,
        );
      } else {
        const result = await hrService.createEmployeeCalendarDays({
          employee_ids: employeeIds,
          dates: [...selectedDates],
          day_type: dayType,
          description: reason.trim() || undefined,
        });
        setSuccess(
          `${result.created} override(s) created` +
            (result.skipped > 0 ? `, ${result.skipped} already existed` : "") +
            (result.failed > 0 ? `, ${result.failed} failed` : "") +
            ". Attendance will update in the background.",
        );
        const warnings: string[] = [];
        if (result.conflicts.length > 0) {
          warnings.push(
            `${result.conflicts.length} of these have no effect because a mandatory Saturday schedule already takes priority for that employee/date.`,
          );
        }
        if (result.sync_failed.length > 0) {
          warnings.push(
            `Attendance re-sync failed for ${result.sync_failed.length} date(s) — retry from the Academic Calendar page.`,
          );
        }
        if (warnings.length > 0) setWarning(warnings.join(" "));
      }
      setSelectedDates(new Set());
      setStartTime("");
      setEndTime("");
      setReason("");
      if (singleEmployeeId != null) loadExisting(singleEmployeeId);
      onApplied?.();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to save overrides.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className={className ?? "space-y-4"}>
      <div className="inline-flex rounded-xl border border-zinc-200 dark:border-zinc-800 p-1 bg-zinc-50 dark:bg-zinc-900/50">
        <button
          type="button"
          onClick={() => setMode("TIME")}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            mode === "TIME" ? "bg-white dark:bg-zinc-800 text-primary shadow-sm" : "text-zinc-500"
          }`}
        >
          <CalendarClock className="h-4 w-4" /> Shift Time Override
        </button>
        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => setMode("HOLIDAY")}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mode === "HOLIDAY" ? "bg-white dark:bg-zinc-800 text-primary shadow-sm" : "text-zinc-500"
            }`}
          >
            <CalendarOff className="h-4 w-4" /> Holiday Override
          </button>
        )}
      </div>

      <p className="text-sm text-zinc-500">
        {mode === "TIME"
          ? "Override check-in/check-out on working day(s) only — not allowed on holidays, weekends, or scheduled day-offs. Leave a side blank to keep it unchanged."
          : "Mark specific day(s) as a holiday (or reinstate a working day) for the selected employee(s) only."}
      </p>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}
      {warning && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900/50 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{warning}</span>
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4 space-y-4">
        <h2 className="font-semibold text-sm text-zinc-700 dark:text-zinc-300">
          {mode === "TIME" ? "Override time" : "Override day type"}
        </h2>

        {singleEmployeeId != null && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase">
                Existing {mode === "TIME" ? "shift" : "holiday"} overrides for {singleEmployeeLabel}
              </p>
              {loadingExisting && <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />}
            </div>
            {!loadingExisting && mode === "TIME" && existingShiftOverrides.length === 0 && (
              <p className="text-xs text-zinc-500">No existing shift overrides for this employee.</p>
            )}
            {!loadingExisting && mode === "HOLIDAY" && existingCalendarDays.length === 0 && (
              <p className="text-xs text-zinc-500">No existing holiday overrides for this employee.</p>
            )}
            <ul className="space-y-1 max-h-40 overflow-y-auto">
              {mode === "TIME"
                ? existingShiftOverrides
                    .slice()
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((o) => (
                      <li
                        key={o.id}
                        className="flex items-center justify-between gap-2 text-xs bg-white dark:bg-zinc-900 rounded-md px-2 py-1.5 border border-amber-100 dark:border-amber-900/30"
                      >
                        <span className="font-semibold text-zinc-700 dark:text-zinc-200">{o.date.slice(0, 10)}</span>
                        <span className="text-zinc-500 flex-1 truncate">
                          {o.override_start_time ?? "—"} – {o.override_end_time ?? "—"}
                          {o.reason ? ` · ${o.reason}` : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteShiftOverride(o.id)}
                          disabled={deletingIds.has(o.id)}
                          className="text-zinc-400 hover:text-rose-600 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label="Delete override"
                        >
                          {deletingIds.has(o.id) ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </li>
                    ))
                : existingCalendarDays
                    .slice()
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((d) => (
                      <li
                        key={d.id}
                        className="flex items-center justify-between gap-2 text-xs bg-white dark:bg-zinc-900 rounded-md px-2 py-1.5 border border-amber-100 dark:border-amber-900/30"
                      >
                        <span className="font-semibold text-zinc-700 dark:text-zinc-200">{d.date.slice(0, 10)}</span>
                        <span className="text-zinc-500 flex-1 truncate">
                          {d.day_type === "HOLIDAY" ? "Holiday (day off)" : "Working day"}
                          {d.description ? ` · ${d.description}` : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteCalendarDay(d.id)}
                          disabled={deletingIds.has(d.id)}
                          className="text-zinc-400 hover:text-rose-600 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label="Delete override"
                        >
                          {deletingIds.has(d.id) ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </li>
                    ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleApply} className="space-y-4">
          <MultiSelectMonthCalendar
            value={selectedDates}
            onChange={setSelectedDates}
            existingOverrideDates={existingOverrideDates}
            employeeId={singleEmployeeId}
          />

          {mode === "TIME" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase">Start time</label>
                <input type="time" className={inputCls} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase">End time</label>
                <input type="time" className={inputCls} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
          ) : (
            <div>
              <label className="text-[11px] font-bold text-zinc-400 uppercase">Day type</label>
              <select className={inputCls} value={dayType} onChange={(e) => setDayType(e.target.value as "HOLIDAY" | "WORKDAY")}>
                <option value="HOLIDAY">Holiday (day off)</option>
                <option value="WORKDAY">Working day (reinstate)</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-[11px] font-bold text-zinc-400 uppercase">
              {mode === "TIME" ? "Reason (optional)" : "Description (optional)"}
            </label>
            <input
              type="text"
              className={inputCls}
              placeholder={mode === "TIME" ? "e.g. Early off-time for exam day" : "e.g. Compensatory day off"}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full inline-flex items-center justify-center gap-1.5 h-10 px-4 text-sm font-semibold text-white bg-primary rounded-xl disabled:opacity-40"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Apply to {employeeIds.length} employee(s) × {selectedDates.size} day(s)
          </button>
        </form>
      </div>
    </div>
  );
}
