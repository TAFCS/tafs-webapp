"use client";

import { useEffect, useMemo, useState } from "react";
import { Briefcase, Building2, CalendarClock, Layers, Loader2, Search, X } from "lucide-react";
import { hrService, EmployeePickerRow } from "@/lib/hr.service";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { toggleId } from "@/components/filters/filter-params";
import { WEEKDAY_ORDER } from "./WorkingDaysPicker";

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** What this employee works to on a weekday today: its own row, or the normal times. */
function currentFor(emp: EmployeePickerRow, dow: number): { text: string; own: boolean } {
  const own = emp.day_timings?.find((d) => d.day_of_week === dow);
  const rin = own?.reporting_time ?? emp.reporting_time ?? "";
  const rout = own?.leaving_time ?? emp.leaving_time ?? "";
  return { text: rin || rout ? `${rin || "?"}–${rout || "?"}` : "no times", own: !!own };
}

/**
 * TAFSD-363: give one or more weekdays (usually Friday) their own timings for
 * many staff at once. Staff on timetable-derived check-in are listed but
 * can't be picked: their times come from the timetable.
 */
export function BulkDayTimingsModal({ onClose, onDone }: { onClose: () => void; onDone: (message: string) => void }) {
  const [employees, setEmployees] = useState<EmployeePickerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [campusIds, setCampusIds] = useState<number[]>([]);
  const [departmentIds, setDepartmentIds] = useState<number[]>([]);
  const [segmentIds, setSegmentIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [days, setDays] = useState<number[]>([5]);
  const [mode, setMode] = useState<"set" | "clear">("set");
  const [reporting, setReporting] = useState("");
  const [leaving, setLeaving] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hrService
      .listEmployeePicker()
      .then((rows) => setEmployees(rows.filter((r) => r.employment_status === "ACTIVE")))
      .catch(() => setError("Could not load staff."))
      .finally(() => setLoading(false));
  }, []);

  const options = useMemo(() => {
    const campuses = new Map<number, string>();
    const departments = new Map<number, string>();
    const segments = new Map<number, string>();
    for (const e of employees) {
      if (e.campuses) campuses.set(e.campuses.id, e.campuses.campus_name);
      if (e.departments) departments.set(e.departments.id, e.departments.name);
      if (e.segments) segments.set(e.segments.id, e.segments.name);
    }
    const toOpts = (m: Map<number, string>) =>
      [...m].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
    return { campuses: toOpts(campuses), departments: toOpts(departments), segments: toOpts(segments) };
  }, [employees]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter(
      (e) =>
        (!campusIds.length || (e.campus_id != null && campusIds.includes(e.campus_id))) &&
        (!departmentIds.length || (e.department_id != null && departmentIds.includes(e.department_id))) &&
        (!segmentIds.length || (e.segment_id != null && segmentIds.includes(e.segment_id))) &&
        (!q || `${e.full_name ?? ""} ${e.employee_code ?? ""}`.toLowerCase().includes(q)),
    );
  }, [employees, campusIds, departmentIds, segmentIds, search]);

  const pickable = (e: EmployeePickerRow) => e.check_in_source !== "TIMETABLE";
  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const timesError =
    mode === "set" && !reporting && !leaving
      ? "Enter a reporting time, a leaving time, or both."
      : mode === "set" && reporting && leaving && leaving <= reporting
        ? "Leaving time must be after reporting time."
        : null;

  const apply = async () => {
    if (!selected.size || !days.length || timesError) return;
    setSaving(true);
    setError(null);
    try {
      for (const day of days) {
        await hrService.bulkSetDayTiming({
          employee_ids: [...selected],
          day_of_week: day,
          reporting_time: mode === "set" ? reporting || null : null,
          leaving_time: mode === "set" ? leaving || null : null,
        });
      }
      const dayList = days.map((d) => DAY[d]).join(", ");
      onDone(
        mode === "set"
          ? `${dayList} timings set to ${reporting || "normal"}–${leaving || "normal"} for ${selected.size} staff.`
          : `${dayList} put back to normal timings for ${selected.size} staff.`,
      );
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || "Could not save the timings.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm tabular-nums";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col border border-zinc-200 dark:border-zinc-800">
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 p-2 rounded-xl bg-primary/10 text-primary">
              <CalendarClock className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-base font-black text-zinc-900 dark:text-zinc-50">Set day timings</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Give a weekday its own hours (a shorter Friday) for many staff at once. Other days keep each
                person&apos;s normal timings.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto">
          {/* Days and times */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-bold text-zinc-500 uppercase mb-2">Day</p>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAY_ORDER.map(({ dow, label }) => (
                  <button
                    key={dow}
                    type="button"
                    aria-pressed={days.includes(dow)}
                    onClick={() => setDays((prev) => toggleId(prev, dow))}
                    className={`h-9 rounded-xl text-xs font-bold border transition-all ${
                      days.includes(dow)
                        ? "bg-primary text-white border-primary"
                        : "bg-zinc-50 dark:bg-zinc-900 text-zinc-400 border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex gap-1 mb-2">
                {(["set", "clear"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`h-7 px-3 rounded-lg text-[11px] font-semibold border ${
                      mode === m ? "border-primary text-primary bg-primary/5" : "border-zinc-200 dark:border-zinc-700 text-zinc-500"
                    }`}
                  >
                    {m === "set" ? "Set own timings" : "Back to normal"}
                  </button>
                ))}
              </div>
              {mode === "set" ? (
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-zinc-500">
                    Reporting
                    <input type="time" className={inputCls} value={reporting} onChange={(e) => setReporting(e.target.value)} />
                  </label>
                  <label className="text-xs text-zinc-500">
                    Leaving
                    <input type="time" className={inputCls} value={leaving} onChange={(e) => setLeaving(e.target.value)} />
                  </label>
                  <p className="col-span-2 text-[11px] text-zinc-400">Leave one blank to keep each person&apos;s normal time for that side.</p>
                </div>
              ) : (
                <p className="text-xs text-zinc-500 pt-2">
                  The chosen day(s) go back to each person&apos;s normal reporting and leaving time.
                </p>
              )}
            </div>
          </div>

          {/* Staff */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <FilterDropdown
              label="Campus"
              icon={Building2}
              value={campusIds}
              options={options.campuses}
              placeholder="All campuses"
              onToggle={(id) => setCampusIds((p) => toggleId(p, id))}
              onClear={() => setCampusIds([])}
            />
            <FilterDropdown
              label="Department"
              icon={Briefcase}
              value={departmentIds}
              options={options.departments}
              placeholder="All departments"
              onToggle={(id) => setDepartmentIds((p) => toggleId(p, id))}
              onClear={() => setDepartmentIds([])}
            />
            <FilterDropdown
              label="Segment"
              icon={Layers}
              value={segmentIds}
              options={options.segments}
              placeholder="All segments"
              onToggle={(id) => setSegmentIds((p) => toggleId(p, id))}
              onClear={() => setSegmentIds([])}
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <input
                className="h-9 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 pl-8 pr-3 text-sm"
                placeholder="Search name or code"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => setSelected(new Set(visible.filter(pickable).map((e) => e.id)))}
              className="text-xs font-semibold text-primary hover:underline whitespace-nowrap"
            >
              Select all shown
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="text-xs font-semibold text-zinc-400 whitespace-nowrap">
              Clear
            </button>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 max-h-[38vh] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
              </div>
            ) : visible.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-10">No staff match these filters.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {visible.map((e) => {
                  const ok = pickable(e);
                  return (
                    <li key={e.id} className={`flex items-center gap-3 px-3 py-2 ${ok ? "" : "opacity-50"}`}>
                      <input
                        type="checkbox"
                        disabled={!ok}
                        checked={selected.has(e.id)}
                        onChange={() => toggle(e.id)}
                        className="rounded border-zinc-300"
                        aria-label={`Select ${e.full_name ?? e.employee_code}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{e.full_name ?? e.users?.full_name ?? `#${e.id}`}</p>
                        <p className="text-[11px] text-zinc-500 truncate">
                          {[e.employee_code, e.campuses?.campus_name, e.departments?.name].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <div className="text-right text-[11px] tabular-nums whitespace-nowrap">
                        {ok ? (
                          days.map((d) => {
                            const cur = currentFor(e, d);
                            return (
                              <p key={d} className={cur.own ? "text-teal-700 font-semibold" : "text-zinc-400"}>
                                {DAY[d]} {cur.text}
                              </p>
                            );
                          })
                        ) : (
                          <p className="text-zinc-400">Timetable times</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">
            {selected.size} staff selected{timesError && selected.size ? ` · ${timesError}` : ""}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-9 px-4 rounded-xl text-[11px] font-bold text-zinc-600 bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300">
              Cancel
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={saving || !selected.size || !days.length || !!timesError}
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-[11px] font-bold text-white bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Apply to {selected.size} staff
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
