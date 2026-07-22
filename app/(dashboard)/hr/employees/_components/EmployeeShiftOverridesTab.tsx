"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2, Trash2 } from "lucide-react";
import { shiftOverridesService, ShiftOverride } from "@/lib/leaves.service";
import { MultiSelectMonthCalendar } from "./MultiSelectMonthCalendar";

interface Props {
  employeeId: number;
  employeeName: string;
}

const inputCls =
  "w-full h-10 px-3 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

function parseTime(val: string | null): string {
  if (!val) return "";
  // Could be "1970-01-01T07:00:00.000Z" or just "07:00:00"
  const match = val.match(/T?(\d{2}:\d{2})/);
  return match ? match[1] : "";
}

export function EmployeeShiftOverridesTab({ employeeId, employeeName }: Props) {
  const [overrides, setOverrides] = useState<ShiftOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await shiftOverridesService.list({ employee_id: employeeId });
      setOverrides(rows.sort((a, b) => a.date.localeCompare(b.date)));
    } catch (err: any) {
      setOverrides([]);
      const status = err?.response?.status;
      setError(
        status === 403
          ? "You do not have permission to view shift overrides."
          : err?.response?.data?.message || "Failed to load shift overrides.",
      );
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  const existingOverrideDates = useMemo(
    () => new Set(overrides.map((o) => o.date.slice(0, 10))),
    [overrides],
  );

  const canSubmit = selectedDates.size > 0 && (startTime.trim() !== "" || endTime.trim() !== "");

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setSaveError(null);
    try {
      await shiftOverridesService.bulkCreate({
        employee_id: employeeId,
        dates: [...selectedDates],
        override_start_time: startTime.trim() || undefined,
        override_end_time: endTime.trim() || undefined,
        reason: reason.trim() || undefined,
      });
      setSelectedDates(new Set());
      setStartTime("");
      setEndTime("");
      setReason("");
      load();
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || "Failed to save override(s).");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: number) => {
    if (!confirm("Remove this shift override?")) return;
    try {
      await shiftOverridesService.remove(id);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to remove override.");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
        <h3 className="text-[15px] font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-1">
          <CalendarClock className="h-4 w-4" /> Shift time overrides
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
          Override {employeeName}'s expected check-in/check-out time for specific day(s), overriding the
          normal schedule. Leave start or end time blank to keep that side of the day unchanged.
        </p>

        <form onSubmit={handleApply} className="space-y-4">
          <MultiSelectMonthCalendar
            value={selectedDates}
            onChange={setSelectedDates}
            existingOverrideDates={existingOverrideDates}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-zinc-400 uppercase">Start time</label>
              <input
                type="time"
                className={inputCls}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-zinc-400 uppercase">End time</label>
              <input
                type="time"
                className={inputCls}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-zinc-400 uppercase">Reason (optional)</label>
            <input
              type="text"
              className={inputCls}
              placeholder="e.g. Covering morning assembly, doctor's appointment"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {saveError && <p className="text-xs text-rose-600 font-medium">{saveError}</p>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!canSubmit || saving}
              className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-semibold text-white bg-primary rounded-xl disabled:opacity-40"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Apply to {selectedDates.size || 0} selected day{selectedDates.size === 1 ? "" : "s"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
        <h3 className="text-[15px] font-extrabold text-zinc-900 dark:text-zinc-100 mb-4">Existing overrides</h3>
        {error ? (
          <p className="text-sm text-rose-600 dark:text-rose-400 text-center py-10 font-medium">{error}</p>
        ) : overrides.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-10">No shift overrides set for this employee.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Start</th>
                  <th className="py-2 pr-4">End</th>
                  <th className="py-2 pr-4">Reason</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {overrides.map((o) => (
                  <tr key={o.id}>
                    <td className="py-3 pr-4 font-mono text-xs">{o.date.slice(0, 10)}</td>
                    <td className="py-3 pr-4">{parseTime(o.override_start_time) || "—"}</td>
                    <td className="py-3 pr-4">{parseTime(o.override_end_time) || "—"}</td>
                    <td className="py-3 pr-4 text-zinc-500">{o.reason || "—"}</td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemove(o.id)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 inline-flex align-middle"
                        title="Remove override"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
