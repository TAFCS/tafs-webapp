"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Building2, CalendarClock, CalendarOff, CheckCircle2, Layers, Loader2, Search, Trash2 } from "lucide-react";
import { useAuthState } from "@/context/AuthContext";
import { campusesService, Campus } from "@/lib/campuses.service";
import { hrService, EmployeeProfile, CalendarDay } from "@/lib/hr.service";
import { shiftOverridesService, ShiftOverride } from "@/lib/leaves.service";
import { MultiSelectMonthCalendar } from "../employees/_components/MultiSelectMonthCalendar";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { toggleId } from "@/components/filters/filter-params";

type OverrideMode = "TIME" | "HOLIDAY";

function employeeSectionLabel(emp: EmployeeProfile): string {
  const a = emp.employee_class_section_assignments?.[0];
  if (!a) return "";
  const cls = a.classes?.description ?? a.classes?.class_code ?? `Class ${a.class_id}`;
  const sec = a.sections?.description ?? `Section ${a.section_id}`;
  return `${cls}-${sec}`;
}

interface SegmentInfo {
  id: number;
  code: string;
  name: string;
  display_order: number;
}

const UNASSIGNED_SEGMENT: SegmentInfo = { id: 0, code: "UNASSIGNED", name: "No segment assigned", display_order: 999 };

function employeeSegments(emp: EmployeeProfile): SegmentInfo[] {
  const byId = new Map<number, SegmentInfo>();
  for (const a of emp.employee_class_section_assignments ?? []) {
    const s = a.classes?.segments;
    if (s) byId.set(s.id, s);
  }
  return byId.size > 0 ? [...byId.values()] : [UNASSIGNED_SEGMENT];
}

const inputCls =
  "w-full h-10 px-3 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

export default function ShiftOverridesPage() {
  const { user } = useAuthState();
  const canManage = user?.role === "SUPER_ADMIN" || user?.role === "CAMPUS_ADMIN";
  const isCampusAdmin = user?.role === "CAMPUS_ADMIN";
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [mode, setMode] = useState<OverrideMode>("TIME");

  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusIds, setCampusIds] = useState<number[]>([]);
  const [segmentIds, setSegmentIds] = useState<number[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [dayType, setDayType] = useState<"HOLIDAY" | "WORKDAY">("HOLIDAY");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [existingCalendarDays, setExistingCalendarDays] = useState<CalendarDay[]>([]);
  const [existingShiftOverrides, setExistingShiftOverrides] = useState<ShiftOverride[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());

  const singleEmployeeId = selectedIds.size === 1 ? [...selectedIds][0] : null;
  const singleEmployee = singleEmployeeId != null ? employees.find((e) => e.id === singleEmployeeId) : null;

  useEffect(() => {
    campusesService.list().then((list) => {
      setCampuses(list);
      if (isCampusAdmin && user?.campusId) {
        setCampusIds([user.campusId]);
      }
    }).catch(console.error);
  }, [isCampusAdmin, user?.campusId]);

  useEffect(() => {
    if (!canManage) return;
    setLoadingEmployees(true);
    hrService.listEmployees()
      .then(setEmployees)
      .catch(console.error)
      .finally(() => setLoadingEmployees(false));
  }, [canManage]);

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

  // Once exactly one employee is selected, surface what's already been overridden
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
      setDeletingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
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
      setDeletingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      if (singleEmployeeId != null) loadExisting(singleEmployeeId);
    }
  };

  // Every active employee on the selected campus(es) (empty = all campuses) —
  // not just teachers, since off-time overrides can apply to any staff category.
  const campusStaff = useMemo(() => {
    return employees.filter(
      (emp) => campusIds.length === 0 || (emp.campus_id != null && campusIds.includes(emp.campus_id)),
    );
  }, [employees, campusIds]);

  const availableSegments = useMemo(() => {
    const byId = new Map<number, SegmentInfo>();
    for (const emp of campusStaff) {
      for (const s of employeeSegments(emp)) byId.set(s.id, s);
    }
    return [...byId.values()].sort((a, b) => a.display_order - b.display_order);
  }, [campusStaff]);

  const campusOptions = useMemo(
    () => campuses.map((c) => ({ id: c.id, label: c.campus_name })),
    [campuses],
  );

  const segmentOptions = useMemo(
    () => availableSegments.map((s) => ({ id: s.id, label: s.name })),
    [availableSegments],
  );

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();

    return campusStaff.filter((emp) => {
      if (segmentIds.length > 0) {
        const inSegment = employeeSegments(emp).some((s) => segmentIds.includes(s.id));
        if (!inSegment) return false;
      }
      if (q) {
        const name = (emp.full_name ?? emp.users?.full_name ?? "").toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [campusStaff, segmentIds, search]);

  const groupBySegment = (staff: EmployeeProfile[]) => {
    const groups = new Map<number, { segment: SegmentInfo; staff: EmployeeProfile[] }>();
    for (const emp of staff) {
      for (const s of employeeSegments(emp)) {
        const bucket = groups.get(s.id) ?? { segment: s, staff: [] };
        bucket.staff.push(emp);
        groups.set(s.id, bucket);
      }
    }
    return [...groups.values()].sort((a, b) => a.segment.display_order - b.segment.display_order);
  };

  const staffBySegment = useMemo(() => groupBySegment(filteredStaff), [filteredStaff]);

  const showCampusGrouping = campusIds.length !== 1;
  const staffByCampusThenSegment = useMemo(() => {
    const byCampus = new Map<number, { campusName: string; staff: EmployeeProfile[] }>();
    for (const emp of filteredStaff) {
      const cid = emp.campus_id ?? 0;
      const bucket = byCampus.get(cid) ?? { campusName: emp.campuses?.campus_name ?? `Campus #${cid}`, staff: [] };
      bucket.staff.push(emp);
      byCampus.set(cid, bucket);
    }
    return [...byCampus.entries()]
      .map(([campusId, { campusName, staff }]) => ({ campusId, campusName, segments: groupBySegment(staff) }))
      .sort((a, b) => a.campusName.localeCompare(b.campusName));
  }, [filteredStaff]);

  const toggleEmployee = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds(new Set(filteredStaff.map((e) => e.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const canSubmit =
    selectedIds.size > 0 &&
    selectedDates.size > 0 &&
    !saving &&
    (mode === "TIME" ? startTime.trim() !== "" || endTime.trim() !== "" : true);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (mode === "TIME") {
        const rows = await shiftOverridesService.bulkCreate({
          employee_ids: [...selectedIds],
          dates: [...selectedDates],
          override_start_time: startTime.trim() || undefined,
          override_end_time: endTime.trim() || undefined,
          reason: reason.trim() || undefined,
        });
        setSuccess(
          `Applied to ${selectedIds.size} employee(s) across ${selectedDates.size} day(s) — ${rows.length} override(s) saved.`,
        );
      } else {
        const result = await hrService.createEmployeeCalendarDays({
          employee_ids: [...selectedIds],
          dates: [...selectedDates],
          day_type: dayType,
          description: reason.trim() || undefined,
        });
        setSuccess(
          `${result.created} override(s) created` +
            (result.skipped > 0 ? `, ${result.skipped} already existed` : "") +
            (result.failed > 0 ? `, ${result.failed} failed` : "") +
            ".",
        );
      }
      setSelectedDates(new Set());
      setStartTime("");
      setEndTime("");
      setReason("");
      setSelectedIds(new Set());
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to save overrides.");
    } finally {
      setSaving(false);
    }
  };

  const renderSegmentGroups = (groups: { segment: SegmentInfo; staff: EmployeeProfile[] }[]) =>
    groups.map(({ segment, staff }) => (
      <div key={segment.id}>
        <div className="sticky top-0 px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-500 bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-400">
          {segment.name} ({staff.length})
        </div>
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {staff.map((emp) => {
            const section = employeeSectionLabel(emp);
            const name = emp.full_name ?? emp.users?.full_name ?? `Employee #${emp.id}`;
            return (
              <li key={emp.id} className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <input
                  type="checkbox"
                  checked={selectedIds.has(emp.id)}
                  onChange={() => toggleEmployee(emp.id)}
                  className="rounded border-zinc-300"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{name}</p>
                  <p className="text-xs text-zinc-500">{section || "No class assignment"}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    ));

  if (!canManage) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center text-zinc-500">
        Only super admins and campus admins can manage shift overrides.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/10 rounded-xl">
          <CalendarClock className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shift Overrides</h1>
          <p className="text-sm text-zinc-500">
            {mode === "TIME"
              ? "Override the expected check-in/check-out time for a group of staff on specific day(s) — e.g. an early off-time for a campus or segment on a given day."
              : "Mark specific day(s) as a holiday (or reinstate a working day) for selected staff only — e.g. an extra day off for one segment while everyone else works."}
          </p>
        </div>
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left panel — select staff */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm text-zinc-700 dark:text-zinc-300">Select staff</h2>
            <div className="flex gap-2">
              <button type="button" onClick={selectAllVisible} className="text-xs font-semibold text-primary hover:underline">
                Select all visible
              </button>
              <button type="button" onClick={clearSelection} className="text-xs font-semibold text-zinc-400 hover:text-zinc-600">
                Clear
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            {isCampusAdmin ? (
              <div>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] flex items-center gap-1.5 ml-1 mb-1.5">
                  <Building2 className="h-3 w-3" /> Campus
                </label>
                <div className="h-11 flex items-center px-4 rounded-xl text-sm border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 font-semibold">
                  {campuses.find((c) => c.id === user?.campusId)?.campus_name ?? "Your campus"}
                </div>
              </div>
            ) : (
              <FilterDropdown
                label="Campus"
                icon={Building2}
                value={campusIds}
                options={campusOptions}
                placeholder="All Campuses"
                onToggle={(id) => {
                  setCampusIds((prev) => toggleId(prev, id));
                  setSegmentIds([]);
                  setSelectedIds(new Set());
                }}
                onClear={() => {
                  setCampusIds([]);
                  setSegmentIds([]);
                  setSelectedIds(new Set());
                }}
              />
            )}
            <FilterDropdown
              label="Segment"
              icon={Layers}
              value={segmentIds}
              options={segmentOptions}
              placeholder="All segments"
              onToggle={(id) => {
                setSegmentIds((prev) => toggleId(prev, id));
                setSelectedIds(new Set());
              }}
              onClear={() => {
                setSegmentIds([]);
                setSelectedIds(new Set());
              }}
            />
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent pl-9 pr-3 py-2 text-sm"
            />
          </div>

          <div className="border border-zinc-100 dark:border-zinc-800 rounded-lg max-h-96 overflow-y-auto">
            {loadingEmployees ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : filteredStaff.length === 0 ? (
              <p className="text-sm text-zinc-500 p-4">No staff match the current filters.</p>
            ) : showCampusGrouping ? (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {staffByCampusThenSegment.map(({ campusId: cid, campusName, segments }) => (
                  <div key={cid}>
                    <div className="sticky top-0 px-3 py-1.5 text-xs font-extrabold text-primary bg-primary/5">
                      {campusName}
                    </div>
                    {renderSegmentGroups(segments)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {renderSegmentGroups(staffBySegment)}
              </div>
            )}
          </div>

          <p className="text-xs text-zinc-500">{selectedIds.size} employee(s) selected</p>
        </div>

        {/* Right panel — day(s) + override details */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4 space-y-4">
          <h2 className="font-semibold text-sm text-zinc-700 dark:text-zinc-300">
            {mode === "TIME" ? "Override time" : "Override day type"}
          </h2>

          {singleEmployeeId != null && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase">
                  Existing {mode === "TIME" ? "shift" : "holiday"} overrides for {singleEmployee?.full_name ?? singleEmployee?.users?.full_name ?? `Employee #${singleEmployeeId}`}
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
                        <li key={o.id} className="flex items-center justify-between gap-2 text-xs bg-white dark:bg-zinc-900 rounded-md px-2 py-1.5 border border-amber-100 dark:border-amber-900/30">
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
                            {deletingIds.has(o.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                        </li>
                      ))
                  : existingCalendarDays
                      .slice()
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((d) => (
                        <li key={d.id} className="flex items-center justify-between gap-2 text-xs bg-white dark:bg-zinc-900 rounded-md px-2 py-1.5 border border-amber-100 dark:border-amber-900/30">
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
                            {deletingIds.has(d.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                        </li>
                      ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleApply} className="space-y-4">
            <MultiSelectMonthCalendar value={selectedDates} onChange={setSelectedDates} existingOverrideDates={existingOverrideDates} />

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
                <select
                  className={inputCls}
                  value={dayType}
                  onChange={(e) => setDayType(e.target.value as "HOLIDAY" | "WORKDAY")}
                >
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
              Apply to {selectedIds.size} employee(s) × {selectedDates.size} day(s)
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
