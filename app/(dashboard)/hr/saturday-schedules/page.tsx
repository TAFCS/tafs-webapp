"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarDays, Info, Loader2, Search, Trash2 } from "lucide-react";
import { useAuthState } from "@/context/AuthContext";
import { campusesService, Campus } from "@/lib/campuses.service";
import { hrService, EmployeeProfile, TEACHER_CATEGORY_CODES } from "@/lib/hr.service";
import { saturdaySchedulesService, SaturdaySchedule } from "@/lib/leaves.service";

const TEACHER_CATEGORIES = TEACHER_CATEGORY_CODES;
const ALL_CAMPUSES = "ALL";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Fixed school payroll cycle: 26th of the previous month through 25th of `ym` — mirrors payroll-period.util.ts on the backend. */
function payrollCycleLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 2, 26));
  const end = new Date(Date.UTC(y, m - 1, 25));
  const fmt = (d: Date, withYear: boolean) =>
    `${d.getUTCDate()} ${SHORT_MONTHS[d.getUTCMonth()]}${withYear ? ` ${d.getUTCFullYear()}` : ""}`;
  return `${fmt(start, start.getUTCFullYear() !== end.getUTCFullYear())} – ${fmt(end, true)} (${monthLabel(ym)})`;
}

/** Payroll-cycle options for the month dropdown: a year back through 2 cycles ahead. */
function buildMonthOptions(): { value: string; label: string }[] {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  for (let offset = -12; offset <= 2; offset++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    options.push({ value, label: payrollCycleLabel(value) });
  }
  return options.reverse();
}

/** Every Saturday (YYYY-MM-DD) in calendar month `ym` — this is what the mandatory-Saturday cap/list are scoped to on the backend. */
function saturdaysInMonth(ym: string): string[] {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return [];
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dates: string[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(Date.UTC(y, m - 1, day));
    if (d.getUTCDay() === 6) dates.push(`${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  return dates;
}

function formatSaturdayOption(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

function formatScheduleDate(dateStr: string) {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

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

function getAdvisoryBanner(): { variant: "amber" | "yellow" | "blue"; message: string } | null {
  const today = new Date();
  const day = today.getDate();
  const monthIdx = today.getMonth();
  const year = today.getFullYear();

  const priorMonth = today.toLocaleDateString("en-US", { month: "long" });
  const nextMonth = new Date(year, monthIdx + 1, 1).toLocaleDateString("en-US", { month: "long" });

  if (day === 25) {
    return {
      variant: "amber",
      message: `Tomorrow is the ${priorMonth} 26 deadline. You can still add Saturdays after this date.`,
    };
  }
  if (day === 24) {
    return {
      variant: "yellow",
      message: `${priorMonth} 26 is approaching — add the Saturdays for ${nextMonth} before then.`,
    };
  }
  if (day >= 26) {
    return {
      variant: "blue",
      message: `The ${priorMonth} 26 reminder deadline has passed. You can still add Saturdays at any time.`,
    };
  }
  return null;
}

export default function SaturdaySchedulesPage() {
  const { user } = useAuthState();
  const canManage = user?.role === "SUPER_ADMIN" || user?.role === "CAMPUS_ADMIN";
  const isCampusAdmin = user?.role === "CAMPUS_ADMIN";

  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusId, setCampusId] = useState<string>("");
  const [segmentFilter, setSegmentFilter] = useState<string>("");
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  const [items, setItems] = useState<SaturdaySchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newDate, setNewDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const advisory = useMemo(() => getAdvisoryBanner(), []);
  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const monthSaturdays = useMemo(() => saturdaysInMonth(month), [month]);

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

  // Only teachers on the selected campus (or every campus, when "All
  // Campuses" is picked) — the segment dropdown is built from this set so it
  // never offers a segment with nobody in it.
  const campusTeachers = useMemo(() => {
    const cid = campusId === ALL_CAMPUSES ? null : Number(campusId);
    return employees.filter(
      (emp) =>
        (cid == null || emp.campus_id === cid) &&
        emp.staff_categories?.code &&
        TEACHER_CATEGORIES.has(emp.staff_categories.code),
    );
  }, [employees, campusId]);

  const availableSegments = useMemo(() => {
    const byId = new Map<number, SegmentInfo>();
    for (const emp of campusTeachers) {
      for (const s of employeeSegments(emp)) byId.set(s.id, s);
    }
    return [...byId.values()].sort((a, b) => a.display_order - b.display_order);
  }, [campusTeachers]);

  const filteredTeachers = useMemo(() => {
    const segmentId = segmentFilter ? Number(segmentFilter) : null;
    const q = search.trim().toLowerCase();

    return campusTeachers.filter((emp) => {
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
  }, [campusTeachers, segmentFilter, search]);

  // Group for display: segment header -> teachers, ordered by display_order.
  // A teacher assigned across multiple segments appears under each of them —
  // the checkbox state is keyed by employee id so that's harmless.
  const groupBySegment = (teachers: EmployeeProfile[]) => {
    const groups = new Map<number, { segment: SegmentInfo; teachers: EmployeeProfile[] }>();
    for (const emp of teachers) {
      for (const s of employeeSegments(emp)) {
        const bucket = groups.get(s.id) ?? { segment: s, teachers: [] };
        bucket.teachers.push(emp);
        groups.set(s.id, bucket);
      }
    }
    return [...groups.values()].sort((a, b) => a.segment.display_order - b.segment.display_order);
  };

  const teachersBySegment = useMemo(() => groupBySegment(filteredTeachers), [filteredTeachers]);

  // Only built/rendered when "All Campuses" is selected — campus header ->
  // segment header -> teachers.
  const teachersByCampusThenSegment = useMemo(() => {
    const byCampus = new Map<number, { campusName: string; teachers: EmployeeProfile[] }>();
    for (const emp of filteredTeachers) {
      const cid = emp.campus_id ?? 0;
      const bucket = byCampus.get(cid) ?? { campusName: emp.campuses?.campus_name ?? `Campus #${cid}`, teachers: [] };
      bucket.teachers.push(emp);
      byCampus.set(cid, bucket);
    }
    return [...byCampus.entries()]
      .map(([campusId, { campusName, teachers }]) => ({
        campusId,
        campusName,
        segments: groupBySegment(teachers),
      }))
      .sort((a, b) => a.campusName.localeCompare(b.campusName));
  }, [filteredTeachers]);

  const assignedCountByEmployee = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of items) {
      map.set(item.employee_id, (map.get(item.employee_id) ?? 0) + 1);
    }
    return map;
  }, [items]);

  const load = useCallback(async () => {
    if (!campusId) return;
    setLoading(true);
    setError(null);
    const segmentId = segmentFilter ? Number(segmentFilter) : null;
    try {
      const data = await saturdaySchedulesService.list({
        month,
        ...(campusId !== ALL_CAMPUSES ? { campusId: Number(campusId) } : {}),
      });
      const filtered = segmentId != null
        ? data.filter((item) =>
            item.employee_profiles.employee_class_section_assignments?.some(
              (a) => a.classes?.segment_id === segmentId,
            ),
          )
        : data;
      setItems(filtered);
    } catch (err: unknown) {
      console.error(err);
      setError("Failed to load Saturday schedules.");
    } finally {
      setLoading(false);
    }
  }, [campusId, month, segmentFilter]);

  useEffect(() => {
    if (canManage) load();
  }, [load, canManage]);

  const toggleEmployee = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderSegmentGroups = (groups: { segment: SegmentInfo; teachers: EmployeeProfile[] }[]) =>
    groups.map(({ segment, teachers }) => (
      <div key={segment.id}>
        <div className="sticky top-0 px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-500 bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-400">
          {segment.name} ({teachers.length})
        </div>
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {teachers.map((emp) => {
            const assigned = assignedCountByEmployee.get(emp.id) ?? 0;
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
                  <p className="text-xs text-zinc-500">
                    {section || "No class assignment"} · {assigned}/2 Saturdays
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    ));

  const canAssign = selectedIds.size > 0 && newDate !== "" && !submitting;

  const handleAssign = async () => {
    if (!canAssign) return;
    setSubmitting(true);
    setError(null);
    try {
      await saturdaySchedulesService.create([...selectedIds], newDate);
      setNewDate("");
      setSelectedIds(new Set());
      await load();
    } catch (err: unknown) {
      console.error(err);
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(", ") : msg ?? "Failed to assign Saturday.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remove this mandatory Saturday?")) return;
    setSubmitting(true);
    setError(null);
    try {
      await saturdaySchedulesService.remove(id);
      await load();
    } catch (err: unknown) {
      console.error(err);
      setError("Failed to delete schedule.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!canManage) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center text-zinc-500">
        Only super admins and campus admins can manage mandatory Saturday schedules.
      </div>
    );
  }

  const bannerStyles = {
    amber: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200",
    yellow: "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900/50 dark:bg-yellow-950/30 dark:text-yellow-200",
    blue: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200",
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/10 rounded-xl">
          <CalendarDays className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Saturday Schedules</h1>
          <p className="text-sm text-zinc-500">
            Assign up to two mandatory Saturdays per teacher per month
          </p>
        </div>
      </div>

      {advisory && (
        <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${bannerStyles[advisory.variant]}`}>
          {advisory.variant === "blue" ? (
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          <span>{advisory.message}</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left panel — assign */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4 space-y-4">
          <h2 className="font-semibold text-sm text-zinc-700 dark:text-zinc-300">Assign Saturdays</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Payroll cycle</label>
              <select
                value={month}
                onChange={(e) => {
                  setMonth(e.target.value);
                  setNewDate("");
                }}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
              >
                {monthOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
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
            <div className="sm:col-span-2">
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

          <div className="border border-zinc-100 dark:border-zinc-800 rounded-lg max-h-64 overflow-y-auto">
            {loadingEmployees ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : filteredTeachers.length === 0 ? (
              <p className="text-sm text-zinc-500 p-4">No teachers match the current filters.</p>
            ) : campusId === ALL_CAMPUSES ? (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {teachersByCampusThenSegment.map(({ campusId: cid, campusName, segments }) => (
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
                {renderSegmentGroups(teachersBySegment)}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Saturday date</label>
              <select
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
              >
                <option value="">-- Select a Saturday --</option>
                {monthSaturdays.map((d) => (
                  <option key={d} value={d}>{formatSaturdayOption(d)}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={!canAssign}
              onClick={handleAssign}
              className="w-full rounded-lg bg-primary text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {submitting ? "Assigning…" : `Assign to Selected (${selectedIds.size})`}
            </button>
          </div>
        </div>

        {/* Right panel — assigned list */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4 space-y-4">
          <h2 className="font-semibold text-sm text-zinc-700 dark:text-zinc-300">
            Assigned Saturdays — {monthLabel(month)}
          </h2>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-zinc-500 py-8 text-center">No Saturdays scheduled for this month.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-left text-xs text-zinc-500">
                    <th className="pb-2 font-medium">Employee</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {items.map((item) => {
                    const name =
                      item.employee_profiles.full_name ?? `Employee #${item.employee_id}`;
                    return (
                      <tr key={item.id}>
                        <td className="py-2.5 pr-2">{name}</td>
                        <td className="py-2.5 pr-2">{formatScheduleDate(item.date)}</td>
                        <td className="py-2.5">
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg"
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
