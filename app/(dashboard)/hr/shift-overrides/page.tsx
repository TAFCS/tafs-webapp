"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarClock, CheckCircle2, Loader2, Search } from "lucide-react";
import { useAuthState } from "@/context/AuthContext";
import { campusesService, Campus } from "@/lib/campuses.service";
import { hrService, EmployeeProfile, TEACHER_CATEGORY_CODES } from "@/lib/hr.service";
import { shiftOverridesService } from "@/lib/leaves.service";
import { MultiSelectMonthCalendar } from "../employees/_components/MultiSelectMonthCalendar";

const ALL_CAMPUSES = "ALL";

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

  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusId, setCampusId] = useState<string>("");
  const [segmentFilter, setSegmentFilter] = useState<string>("");
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    campusesService.list().then((list) => {
      setCampuses(list);
      if (isCampusAdmin && user?.campusId) {
        setCampusId(String(user.campusId));
      } else if (list.length > 0) {
        setCampusId(String(list[0].id));
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

  // Every active employee on the selected campus (or every campus, when "All
  // Campuses" is picked) — not just teachers, since off-time overrides can
  // apply to any staff category.
  const campusStaff = useMemo(() => {
    const cid = campusId === ALL_CAMPUSES ? null : Number(campusId);
    return employees.filter((emp) => cid == null || emp.campus_id === cid);
  }, [employees, campusId]);

  const availableSegments = useMemo(() => {
    const byId = new Map<number, SegmentInfo>();
    for (const emp of campusStaff) {
      for (const s of employeeSegments(emp)) byId.set(s.id, s);
    }
    return [...byId.values()].sort((a, b) => a.display_order - b.display_order);
  }, [campusStaff]);

  const filteredStaff = useMemo(() => {
    const segmentId = segmentFilter ? Number(segmentFilter) : null;
    const q = search.trim().toLowerCase();

    return campusStaff.filter((emp) => {
      if (segmentId != null) {
        const inSegment = employeeSegments(emp).some((s) => s.id === segmentId);
        if (!inSegment) return false;
      }
      if (q) {
        const name = (emp.full_name ?? emp.users?.full_name ?? "").toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [campusStaff, segmentFilter, search]);

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
    (startTime.trim() !== "" || endTime.trim() !== "") &&
    !saving;

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
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
            Override the expected check-in/check-out time for a group of staff on specific day(s) —
            e.g. an early off-time for a campus or segment on a given day.
          </p>
        </div>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Campus</label>
              <select
                value={campusId}
                disabled={isCampusAdmin}
                onChange={(e) => {
                  setCampusId(e.target.value);
                  setSegmentFilter("");
                  setSelectedIds(new Set());
                }}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm disabled:opacity-60"
              >
                {!isCampusAdmin && <option value={ALL_CAMPUSES}>All Campuses</option>}
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>{c.campus_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Segment</label>
              <select
                value={segmentFilter}
                onChange={(e) => {
                  setSegmentFilter(e.target.value);
                  setSelectedIds(new Set());
                }}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
              >
                <option value="">All segments</option>
                {availableSegments.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
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
            ) : campusId === ALL_CAMPUSES ? (
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

        {/* Right panel — day(s) + time */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4 space-y-4">
          <h2 className="font-semibold text-sm text-zinc-700 dark:text-zinc-300">Override time</h2>

          <form onSubmit={handleApply} className="space-y-4">
            <MultiSelectMonthCalendar value={selectedDates} onChange={setSelectedDates} />

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

            <div>
              <label className="text-[11px] font-bold text-zinc-400 uppercase">Reason (optional)</label>
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. Early off-time for exam day"
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
