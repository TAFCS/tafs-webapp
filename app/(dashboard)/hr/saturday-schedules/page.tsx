"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarDays, Info, Loader2, Search, Trash2 } from "lucide-react";
import { useAuthState } from "@/context/AuthContext";
import { campusesService, Campus, OfferedClass } from "@/lib/campuses.service";
import { hrService, EmployeeProfile } from "@/lib/hr.service";
import { saturdaySchedulesService, SaturdaySchedule } from "@/lib/leaves.service";

const TEACHER_CATEGORIES = new Set(["TEACHER", "ASSISTANT_TEACHER"]);

function isSaturday(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.getUTCDay() === 6;
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
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

interface SectionOption {
  classId: number;
  sectionId: number;
  label: string;
}

function flattenSections(offered?: OfferedClass[]): SectionOption[] {
  if (!offered) return [];
  const options: SectionOption[] = [];
  for (const cls of offered) {
    for (const sec of cls.sections ?? []) {
      if (!sec.is_active) continue;
      options.push({
        classId: cls.id,
        sectionId: sec.id,
        label: `${cls.description}-${sec.description}`,
      });
    }
  }
  return options.sort((a, b) => a.label.localeCompare(b.label));
}

function parseSectionFilter(value: string): { classId: number; sectionId: number } | null {
  if (!value) return null;
  const [classId, sectionId] = value.split(":").map((v) => parseInt(v, 10));
  if (!classId || !sectionId) return null;
  return { classId, sectionId };
}

export default function SaturdaySchedulesPage() {
  const { user } = useAuthState();
  const canManage = user?.role === "SUPER_ADMIN" || user?.role === "CAMPUS_ADMIN";
  const isCampusAdmin = user?.role === "CAMPUS_ADMIN";

  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusId, setCampusId] = useState<string>("");
  const [sectionFilter, setSectionFilter] = useState<string>("");
  const [campusDetail, setCampusDetail] = useState<Campus | null>(null);
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
  const [dateError, setDateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const advisory = useMemo(() => getAdvisoryBanner(), []);

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
    if (!campusId) return;
    campusesService.getById(Number(campusId)).then(setCampusDetail).catch(console.error);
  }, [campusId]);

  useEffect(() => {
    if (!canManage) return;
    setLoadingEmployees(true);
    hrService.listEmployees()
      .then(setEmployees)
      .catch(console.error)
      .finally(() => setLoadingEmployees(false));
  }, [canManage]);

  const sectionOptions = useMemo(
    () => flattenSections(campusDetail?.offered_classes),
    [campusDetail],
  );

  const filteredTeachers = useMemo(() => {
    const cid = Number(campusId);
    const section = parseSectionFilter(sectionFilter);
    const q = search.trim().toLowerCase();

    return employees.filter((emp) => {
      if (emp.campus_id !== cid) return false;
      if (!emp.staff_category || !TEACHER_CATEGORIES.has(emp.staff_category)) return false;
      if (section != null) {
        const hasSection = emp.employee_class_section_assignments?.some(
          (a) => a.class_id === section.classId && a.section_id === section.sectionId,
        );
        if (!hasSection) return false;
      }
      if (q) {
        const name = (emp.full_name ?? emp.users?.full_name ?? "").toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [employees, campusId, sectionFilter, search]);

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
    const section = parseSectionFilter(sectionFilter);
    try {
      const data = await saturdaySchedulesService.list({
        month,
        campusId: Number(campusId),
        ...(section ? { sectionId: section.sectionId } : {}),
      });
      const filtered = section
        ? data.filter((item) =>
            item.employee_profiles.employee_class_section_assignments?.some(
              (a) => a.class_id === section.classId && a.section_id === section.sectionId,
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
  }, [campusId, month, sectionFilter]);

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

  const handleDateChange = (value: string) => {
    setNewDate(value);
    if (value && !isSaturday(value)) {
      setDateError("The selected date must be a Saturday.");
    } else {
      setDateError(null);
    }
  };

  const canAssign =
    selectedIds.size > 0 && newDate !== "" && isSaturday(newDate) && !submitting;

  const handleAssign = async () => {
    if (!canAssign) return;
    setSubmitting(true);
    setError(null);
    try {
      await saturdaySchedulesService.create([...selectedIds], newDate);
      setNewDate("");
      setDateError(null);
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
              <label className="text-xs text-zinc-500 block mb-1">Month</label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Campus</label>
              <select
                value={campusId}
                disabled={isCampusAdmin}
                onChange={(e) => {
                  setCampusId(e.target.value);
                  setSectionFilter("");
                  setSelectedIds(new Set());
                }}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm disabled:opacity-60"
              >
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>{c.campus_name}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-zinc-500 block mb-1">Section</label>
              <select
                value={sectionFilter}
                onChange={(e) => {
                  setSectionFilter(e.target.value);
                  setSelectedIds(new Set());
                }}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
              >
                <option value="">All sections</option>
                {sectionOptions.map((s) => (
                  <option
                    key={`${s.classId}-${s.sectionId}`}
                    value={`${s.classId}:${s.sectionId}`}
                  >
                    {s.label}
                  </option>
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
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredTeachers.map((emp) => {
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
            )}
          </div>

          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Saturday date</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
              />
              {dateError && <p className="text-xs text-rose-600 mt-1">{dateError}</p>}
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
