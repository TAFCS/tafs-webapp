"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Plus,
  Trash2,
  Loader2,
  Building,
  AlertCircle,
  CheckCircle2,
  Coffee,
  GraduationCap,
  Info,
  ShieldAlert,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { hrService, CalendarDay, Department, StaffCategory, STAFF_CATEGORY_OPTIONS, formatStaffCategory } from "@/lib/hr.service";
import { campusesService, Campus } from "@/lib/campuses.service";
import { useAuthState } from "@/context/AuthContext";
import { useAppSelector } from "@/store/hooks";
import type { CampusClass } from "@/store/slices/campusesSlice";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type FormState = {
  date: string;
  day_type: "HOLIDAY" | "WORKDAY";
  description: string;
  class_id: string;
  section_id: string;
  department_id: string;
  staff_category: string;
  employee_id: string;
};

const emptyForm = (): FormState => ({
  date: new Date().toISOString().split("T")[0],
  day_type: "HOLIDAY",
  description: "",
  class_id: "",
  section_id: "",
  department_id: "",
  staff_category: "",
  employee_id: "",
});

function parseStaffCategory(value: string): StaffCategory | undefined {
  if (!value) return undefined;
  return STAFF_CATEGORY_OPTIONS.some((o) => o.value === value) ? (value as StaffCategory) : undefined;
}

type ModalMode = "holiday" | "weekend-open";

function isWeekendDate(dateStr: string): boolean {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  return day === 0 || day === 6;
}

function getDayTypeLabel(type: string): string {
  switch (type) {
    case "WORKDAY":
      return "Weekend Open";
    case "HOLIDAY":
      return "Holiday";
    case "WEEKEND":
      return "Day Off";
    default:
      return type;
  }
}

function getDayTypeBadge(type: string): string {
  switch (type) {
    case "WORKDAY":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "HOLIDAY":
      return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400";
    default:
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  }
}

export default function CalendarPage() {
  const { user } = useAuthState();
  const allCampuses = useAppSelector((s: any) => s.campuses.items) as Campus[];
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedCampusId, setSelectedCampusId] = useState<number | null>(null);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"STUDENT" | "STAFF">("STUDENT");
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("holiday");
  const [editingDay, setEditingDay] = useState<CalendarDay | null>(null);
  const [formData, setFormData] = useState<FormState>(emptyForm());
  const [syncDate, setSyncDate] = useState(new Date().toISOString().split("T")[0]);
  const [syncing, setSyncing] = useState(false);
  const [applyToAllCampuses, setApplyToAllCampuses] = useState(false);
  const [syncAllCampuses, setSyncAllCampuses] = useState(false);

  useEffect(() => {
    const fetchCampuses = async () => {
      try {
        const list = allCampuses.length ? allCampuses : await campusesService.list();
        setCampuses(list);
        if (list.length > 0) setSelectedCampusId(list[0].id);
      } catch {
        setError("Failed to fetch campuses.");
      }
    };
    fetchCampuses();
  }, [allCampuses]);

  useEffect(() => {
    hrService.listDepartments().then(setDepartments).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedCampusId !== null) fetchCalendar(selectedCampusId, activeTab);
  }, [selectedCampusId, activeTab]);

  const selectedCampus = campuses.find((c) => c.id === selectedCampusId);
  const offeredClasses: CampusClass[] = (selectedCampus as any)?.offered_classes ?? [];
  const selectedClass = offeredClasses.find((c) => String(c.id) === formData.class_id);
  const offeredSections = selectedClass?.sections ?? [];
  const isStudentTab = activeTab === "STUDENT";

  const fetchCalendar = async (campusId: number, tab: "STUDENT" | "STAFF") => {
    setLoading(true);
    setError(null);
    try {
      const data = await hrService.listCalendarDays(campusId, tab);
      setCalendarDays(data);
    } catch {
      setError("Failed to fetch calendar days.");
    } finally {
      setLoading(false);
    }
  };

  const scopeLabel = (day: CalendarDay) => {
    if (day.section_id && day.sections) {
      return `${day.classes?.description ?? "Class"} / ${day.sections.description}`;
    }
    if (day.class_id && day.classes) return day.classes.description;
    if (day.employee_id && day.employee) {
      return day.employee.full_name ?? day.employee.employee_code ?? "Employee";
    }
    if (day.department_id && day.departments) {
      const category = formatStaffCategory(day.staff_category);
      return category ? `${day.departments.name} / ${category}` : day.departments.name;
    }
    if (day.staff_category) return formatStaffCategory(day.staff_category) ?? day.staff_category;
    return "Whole campus";
  };

  const openModal = (mode: ModalMode) => {
    setEditingDay(null);
    setModalMode(mode);
    setApplyToAllCampuses(false);
    setFormData({
      ...emptyForm(),
      day_type: mode === "weekend-open" ? "WORKDAY" : "HOLIDAY",
      description: mode === "weekend-open" ? "School Open" : "",
    });
    setShowModal(true);
  };

  const openCreate = () => openModal("holiday");

  const openEdit = (day: CalendarDay) => {
    setEditingDay(day);
    setApplyToAllCampuses(false);
    setModalMode(day.day_type === "WORKDAY" ? "weekend-open" : "holiday");
    setFormData({
      date: day.date.slice(0, 10),
      day_type: day.day_type === "WORKDAY" ? "WORKDAY" : "HOLIDAY",
      description: day.description ?? "",
      class_id: day.class_id ? String(day.class_id) : "",
      section_id: day.section_id ? String(day.section_id) : "",
      department_id: day.department_id ? String(day.department_id) : "",
      staff_category: day.staff_category ?? "",
      employee_id: day.employee_id ? String(day.employee_id) : "",
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyToAllCampuses && selectedCampusId === null) return;

    const isWeekendOpen =
      formData.day_type === "WORKDAY" && (modalMode === "weekend-open" || isStudentTab);
    if (isWeekendOpen && !isWeekendDate(formData.date)) {
      setError("Working-day overrides for students can only be added for Saturdays or Sundays.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (editingDay) {
        const payload = {
          campus_id: selectedCampusId!,
          date: formData.date,
          day_type: formData.day_type,
          description: formData.description.trim() || undefined,
          applies_to: activeTab,
          ...(activeTab === "STUDENT"
            ? {
                class_id: formData.class_id ? parseInt(formData.class_id, 10) : undefined,
                section_id: formData.section_id ? parseInt(formData.section_id, 10) : undefined,
              }
            : {
                department_id: formData.department_id ? parseInt(formData.department_id, 10) : undefined,
                staff_category: parseStaffCategory(formData.staff_category),
                employee_id: formData.employee_id ? parseInt(formData.employee_id, 10) : undefined,
              }),
        };
        await hrService.updateCalendarDay(editingDay.id, payload);
        setSuccess("Calendar entry updated. Attendance synced for that date.");
      } else if (applyToAllCampuses) {
        const result = await hrService.createBulkCalendarDays({
          date: formData.date,
          day_type: formData.day_type,
          description: formData.description.trim() || undefined,
          applies_to: activeTab,
        });
        setSuccess(
          `Holiday added on ${result.created} of ${result.campuses_total} campuses` +
            (result.skipped > 0 ? ` (${result.skipped} already had an entry)` : "") +
            (result.failed > 0 ? `; ${result.failed} failed` : "") +
            ". Attendance synced per campus.",
        );
      } else {
        const payload = {
          campus_id: selectedCampusId!,
          date: formData.date,
          day_type: formData.day_type,
          description: formData.description.trim() || undefined,
          applies_to: activeTab,
          ...(activeTab === "STUDENT"
            ? {
                class_id: formData.class_id ? parseInt(formData.class_id, 10) : undefined,
                section_id: formData.section_id ? parseInt(formData.section_id, 10) : undefined,
              }
            : {
                department_id: formData.department_id ? parseInt(formData.department_id, 10) : undefined,
                staff_category: parseStaffCategory(formData.staff_category),
                employee_id: formData.employee_id ? parseInt(formData.employee_id, 10) : undefined,
              }),
        };
        await hrService.createCalendarDay(payload);
        setSuccess(
          modalMode === "weekend-open"
            ? "Weekend marked as open. Attendance synced for that date."
            : "Calendar entry added. Attendance synced for that date.",
        );
      }
      setShowModal(false);
      if (selectedCampusId !== null) fetchCalendar(selectedCampusId, activeTab);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to save calendar entry.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remove this calendar entry?")) return;
    setError(null);
    setSuccess(null);
    try {
      await hrService.deleteCalendarDay(id);
      setSuccess("Calendar entry deleted. Attendance re-synced for that date.");
      if (selectedCampusId !== null) fetchCalendar(selectedCampusId, activeTab);
    } catch {
      setError("Failed to delete calendar entry.");
    }
  };

  const handleApplyAttendance = async () => {
    if (!syncAllCampuses && selectedCampusId === null) return;
    setSyncing(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await hrService.syncCalendarAttendance(
        syncAllCampuses ? null : selectedCampusId,
        syncDate,
        { allCampuses: syncAllCampuses },
      );
      setSuccess(
        `Synced attendance for ${syncDate}${syncAllCampuses ? " (all campuses)" : ""}: ${result.students} students and ${result.staff} staff marked EXCUSED` +
          (result.cleared_students > 0 || result.cleared_staff > 0
            ? `; cleared ${result.cleared_students} student and ${result.cleared_staff} staff auto holiday records`
            : "") +
          (result.skipped_manual > 0 ? ` (${result.skipped_manual} manual records skipped)` : "") +
          ".",
      );
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to apply holiday attendance.");
    } finally {
      setSyncing(false);
    }
  };

  const monthGrid = useMemo(() => {
    const [y, m] = viewMonth.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const last = new Date(Date.UTC(y, m, 0));
    const startPad = (first.getUTCDay() + 6) % 7;
    const daysInMonth = last.getUTCDate();
    const dayMap = new Map(calendarDays.map((d) => [d.date.slice(0, 10), d]));
    const cells: { key: string; label: number; entry?: CalendarDay }[] = [];
    for (let i = 0; i < startPad; i++) cells.push({ key: `pad-${i}`, label: 0 });
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ key, label: d, entry: dayMap.get(key) });
    }
    return cells;
  }, [viewMonth, calendarDays]);

  if (user && user.role !== "SUPER_ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="p-4 bg-red-50 text-red-500 rounded-full">
          <ShieldAlert className="h-12 w-12" />
        </div>
        <h2 className="text-xl font-black text-zinc-800">Access Denied</h2>
        <p className="text-zinc-500 max-w-xs text-center text-sm font-medium">
          Only Super Administrator accounts can manage the academic calendar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div
            className={`p-2.5 rounded-2xl transition-colors duration-200 ${
              isStudentTab
                ? "bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400"
                : "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"
            }`}
          >
            <CalendarDays className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Holiday Calendar</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {isStudentTab
                ? "Manage scoped holidays and weekend open days for students"
                : "Manage scoped holidays and working-day overrides for staff"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center space-x-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 shadow-sm">
            <Building className="h-4 w-4 text-zinc-400" />
            <select
              className="bg-transparent border-none text-sm font-semibold outline-none focus:ring-0 text-zinc-800 dark:text-zinc-200"
              value={selectedCampusId || ""}
              onChange={(e) => setSelectedCampusId(parseInt(e.target.value, 10))}
            >
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.campus_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-zinc-200 dark:border-zinc-800 gap-4">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab("STUDENT")}
            className={`flex items-center gap-2 pb-3.5 text-sm font-bold transition-all relative ${
              isStudentTab
                ? "text-purple-600 dark:text-purple-400"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <GraduationCap className="h-4 w-4" />
            Student Calendar
            {isStudentTab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 dark:bg-purple-400 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("STAFF")}
            className={`flex items-center gap-2 pb-3.5 text-sm font-bold transition-all relative ${
              activeTab === "STAFF"
                ? "text-blue-600 dark:text-blue-400"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <Coffee className="h-4 w-4" />
            Staff Calendar
            {activeTab === "STAFF" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-3 pb-2">
          {isStudentTab ? (
            <>
              <button
                onClick={() => openModal("weekend-open")}
                disabled={selectedCampusId === null}
                className="inline-flex items-center justify-center h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none shadow-sm shadow-emerald-500/10"
              >
                <GraduationCap className="h-4 w-4 mr-1.5" />
                Open Weekend
              </button>
              <button
                onClick={() => openModal("holiday")}
                disabled={selectedCampusId === null}
                className="inline-flex items-center justify-center h-9 px-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl text-xs active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none shadow-sm shadow-purple-500/10"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Holiday
              </button>
            </>
          ) : (
            <button
              onClick={openCreate}
              disabled={selectedCampusId === null}
              className="inline-flex items-center justify-center h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none shadow-sm shadow-blue-500/10"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Holiday
            </button>
          )}
        </div>
      </div>

      {isStudentTab && (
        <div className="flex items-start gap-3 bg-purple-50 border border-purple-100 text-purple-900 rounded-2xl p-4 text-sm dark:bg-purple-950/20 dark:border-purple-900/30 dark:text-purple-200">
          <Info className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
          <p className="flex-1">
            <span className="font-semibold">Saturdays and Sundays are off by default</span> for students in the
            parent app. Use <span className="font-semibold">Open Weekend</span> when school runs on a Saturday or
            Sunday (make-up day). Use <span className="font-semibold">Add Holiday</span> for named days off on any
            date. Scope entries to a class or section when the holiday does not apply campus-wide.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl p-4 text-sm">
          <AlertCircle className="h-5 w-5 text-rose-500" />
          <p>{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl p-4 text-sm">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <p>{success}</p>
        </div>
      )}

      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex-1 space-y-1">
          <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Apply holiday attendance manually</p>
          <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
            Calendar saves auto-sync EXCUSED records. Cron also runs at midnight and ~6 AM PKT. Use this if a holiday was added late or you need to re-apply for a specific date.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-200 cursor-pointer">
            <input
              type="checkbox"
              checked={syncAllCampuses}
              onChange={(e) => setSyncAllCampuses(e.target.checked)}
              className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
            />
            All campuses
          </label>
          <div className="flex items-center gap-2">
          <input
            type="date"
            value={syncDate}
            onChange={(e) => setSyncDate(e.target.value)}
            className="h-10 px-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-zinc-900 text-sm"
          />
          <button
            type="button"
            onClick={handleApplyAttendance}
            disabled={syncing || (!syncAllCampuses && selectedCampusId === null)}
            className="inline-flex items-center h-10 px-4 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-xs disabled:opacity-50"
          >
            {syncing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                Applying...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Apply to attendance
              </>
            )}
          </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-zinc-700 dark:text-zinc-200">Month view</h2>
          <input
            type="month"
            value={viewMonth}
            onChange={(e) => setViewMonth(e.target.value)}
            className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm"
          />
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-center text-[10px] font-bold text-zinc-400 uppercase">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {monthGrid.map((cell) =>
            cell.label === 0 ? (
              <div key={cell.key} className="h-10" />
            ) : (
              <div
                key={cell.key}
                title={cell.entry?.description ?? undefined}
                className={`h-10 rounded-lg flex items-center justify-center text-xs font-semibold border ${
                  cell.entry?.day_type === "HOLIDAY"
                    ? "bg-rose-50 border-rose-200 text-rose-700"
                    : cell.entry?.day_type === "WORKDAY"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-zinc-50 border-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:border-zinc-800"
                }`}
              >
                {cell.label}
              </div>
            ),
          )}
        </div>
        <div className="flex gap-4 mt-4 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-rose-100 border border-rose-200" /> Holiday
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200" /> Working day override
          </span>
        </div>
      </div>

      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center gap-3">
          <Loader2 className={`h-8 w-8 animate-spin ${isStudentTab ? "text-purple-500" : "text-blue-500"}`} />
          <p className="text-sm text-zinc-500">Loading calendar entries...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">Type</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">Name</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">Scope</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {calendarDays.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-zinc-500">
                    {isStudentTab
                      ? "No overrides yet. Weekends are off by default — add a holiday or open a weekend when needed."
                      : "No calendar entries yet."}
                  </td>
                </tr>
              ) : (
                calendarDays.map((day) => (
                  <tr key={day.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20">
                    <td className="px-6 py-4 text-sm font-semibold">
                      {new Date(day.date).toLocaleDateString("en-US", {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${getDayTypeBadge(day.day_type)}`}>
                        {getDayTypeLabel(day.day_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {day.description || (day.day_type === "WORKDAY" ? "School Open" : "Holiday")}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-500">{scopeLabel(day)}</td>
                    <td className="px-6 py-4 text-right space-x-1">
                      <button
                        onClick={() => openEdit(day)}
                        className="p-1.5 text-zinc-400 hover:text-purple-600 rounded-lg"
                        title="Edit entry"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(day.id)}
                        className="p-1.5 text-zinc-400 hover:text-rose-600 rounded-lg"
                        title="Delete entry"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl">
            <form onSubmit={handleSave}>
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                  {editingDay
                    ? "Edit Calendar Entry"
                    : modalMode === "weekend-open"
                      ? "Open Weekend (Student)"
                      : `Add ${isStudentTab ? "Student" : "Staff"} Holiday`}
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  {modalMode === "weekend-open"
                    ? "Mark a Saturday or Sunday as a working day for students."
                    : `Add a scoped holiday to the ${isStudentTab ? "student" : "staff"} calendar.`}
                </p>
              </div>
              <div className="p-6 space-y-4">
                {!editingDay && (
                  <label className="flex items-start gap-3 p-3 rounded-xl border border-purple-100 bg-purple-50/50 dark:border-purple-900/40 dark:bg-purple-950/20 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyToAllCampuses}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setApplyToAllCampuses(checked);
                        if (checked) {
                          setFormData((prev) => ({
                            ...prev,
                            class_id: "",
                            section_id: "",
                            department_id: "",
                            staff_category: "",
                            employee_id: "",
                          }));
                        }
                      }}
                      className="mt-0.5 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm">
                      <span className="font-semibold text-purple-900 dark:text-purple-200">Apply to all campuses</span>
                      <span className="block text-xs text-purple-800/80 dark:text-purple-300/80 mt-0.5">
                        Creates the same whole-campus entry on every campus. Class, section, department, and category scoping is not available for bulk add.
                      </span>
                    </span>
                  </label>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase">Date</label>
                    <input
                      type="date"
                      required
                      className="w-full h-10 px-3 mt-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                    {modalMode === "weekend-open" && formData.date && !isWeekendDate(formData.date) && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1">
                        Pick a Saturday or Sunday — weekdays are already working days.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase">Type</label>
                    <select
                      className="w-full h-10 px-3 mt-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm disabled:opacity-60"
                      value={formData.day_type}
                      disabled={modalMode === "weekend-open" && !editingDay}
                      onChange={(e) =>
                        setFormData({ ...formData, day_type: e.target.value as "HOLIDAY" | "WORKDAY" })
                      }
                    >
                      <option value="HOLIDAY">Holiday / Day off</option>
                      <option value="WORKDAY">Working day override (e.g. open Saturday)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase">
                    {modalMode === "weekend-open" ? "Note (optional)" : "Description"}
                  </label>
                  <input
                    type="text"
                    required={modalMode === "holiday"}
                    placeholder={
                      modalMode === "weekend-open"
                        ? "e.g. Make-up day, Exam day"
                        : "e.g. Eid-ul-Fitr, Summer Vacation"
                    }
                    className="w-full h-10 px-3 mt-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                {activeTab === "STUDENT" && !applyToAllCampuses ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-zinc-400 uppercase">Class (optional)</label>
                      <select
                        className="w-full h-10 px-3 mt-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm"
                        value={formData.class_id}
                        onChange={(e) =>
                          setFormData({ ...formData, class_id: e.target.value, section_id: "" })
                        }
                      >
                        <option value="">All classes</option>
                        {offeredClasses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.description}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-zinc-400 uppercase">Section (optional)</label>
                      <select
                        disabled={!formData.class_id}
                        className="w-full h-10 px-3 mt-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm disabled:opacity-50"
                        value={formData.section_id}
                        onChange={(e) => setFormData({ ...formData, section_id: e.target.value })}
                      >
                        <option value="">All sections</option>
                        {offeredSections.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.description}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : activeTab === "STAFF" && !applyToAllCampuses ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-zinc-400 uppercase">Department (optional)</label>
                        <select
                          className="w-full h-10 px-3 mt-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm"
                          value={formData.department_id}
                          onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                        >
                          <option value="">All departments</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-zinc-400 uppercase">Category (optional)</label>
                        <select
                          className="w-full h-10 px-3 mt-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm"
                          value={formData.staff_category}
                          onChange={(e) => setFormData({ ...formData, staff_category: e.target.value })}
                        >
                          <option value="">All categories</option>
                          {STAFF_CATEGORY_OPTIONS.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-zinc-400 uppercase">Employee ID (optional)</label>
                      <input
                        type="number"
                        placeholder="Individual override — takes priority over department and category"
                        className="w-full h-10 px-3 mt-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm"
                        value={formData.employee_id}
                        onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 h-10 rounded-xl text-sm font-semibold text-zinc-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    saving ||
                    (modalMode === "weekend-open" && formData.date !== "" && !isWeekendDate(formData.date))
                  }
                  className="px-6 h-10 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : editingDay ? (
                    "Save Changes"
                  ) : applyToAllCampuses ? (
                    "Save for all campuses"
                  ) : modalMode === "weekend-open" ? (
                    "Save Open Weekend"
                  ) : (
                    "Save Holiday"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
