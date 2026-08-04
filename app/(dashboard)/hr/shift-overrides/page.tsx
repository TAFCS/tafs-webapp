"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, CalendarClock, Layers, Loader2, Search } from "lucide-react";
import { useAuthState } from "@/context/AuthContext";
import { campusesService, Campus } from "@/lib/campuses.service";
import { hrService, EmployeeProfile } from "@/lib/hr.service";
import { ShiftHolidayOverridesPanel } from "../_components/ShiftHolidayOverridesPanel";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { toggleId } from "@/components/filters/filter-params";

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

export default function ShiftOverridesPage() {
  const { user } = useAuthState();
  const canManage = user?.role === "SUPER_ADMIN" || user?.role === "CAMPUS_ADMIN";
  const isCampusAdmin = user?.role === "CAMPUS_ADMIN";
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusIds, setCampusIds] = useState<number[]>([]);
  const [segmentIds, setSegmentIds] = useState<number[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loadingEmployees, setLoadingEmployees] = useState(false);

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
            Override check-in/check-out time, or mark day(s) as a holiday/working-day override, for a group of staff.
          </p>
        </div>
      </div>

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

        {/* Right panel — shared shift/holiday override form */}
        <ShiftHolidayOverridesPanel
          employeeIds={[...selectedIds]}
          employeeName={singleEmployee?.full_name ?? singleEmployee?.users?.full_name ?? undefined}
          isSuperAdmin={isSuperAdmin}
          onApplied={() => setSelectedIds(new Set())}
        />
      </div>
    </div>
  );
}
