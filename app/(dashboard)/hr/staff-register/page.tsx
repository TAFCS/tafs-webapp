"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarOff,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCampuses } from "@/store/slices/campusesSlice";
import { useAuthState } from "@/context/AuthContext";
import { hrService, Department, formatStaffCategory } from "@/lib/hr.service";
import {
  attendanceService,
  StaffAttendanceStatus,
  StaffRegisterRow,
} from "@/lib/attendance.service";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_OPTIONS: { value: StaffAttendanceStatus; label: string; color: string }[] = [
  { value: "PRESENT",  label: "Present",  color: "emerald" },
  { value: "ABSENT",   label: "Absent",   color: "rose"    },
  { value: "LATE",     label: "Late",     color: "amber"   },
  { value: "HALF_DAY", label: "Half Day", color: "orange"  },
  { value: "EXCUSED",  label: "Excused",  color: "sky"     },
];

const STATUS_STYLES: Record<StaffAttendanceStatus, string> = {
  PRESENT:  "bg-emerald-600 text-white ring-emerald-600",
  ABSENT:   "bg-rose-600    text-white ring-rose-600",
  LATE:     "bg-amber-500   text-white ring-amber-500",
  HALF_DAY: "bg-orange-500  text-white ring-orange-500",
  EXCUSED:  "bg-sky-500     text-white ring-sky-500",
};

const INACTIVE_STYLES: Record<StaffAttendanceStatus, string> = {
  PRESENT:  "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
  ABSENT:   "bg-rose-50    text-rose-700    hover:bg-rose-100",
  LATE:     "bg-amber-50   text-amber-700   hover:bg-amber-100",
  HALF_DAY: "bg-orange-50  text-orange-700  hover:bg-orange-100",
  EXCUSED:  "bg-sky-50     text-sky-700     hover:bg-sky-100",
};

export default function StaffRegisterPage() {
  const dispatch = useAppDispatch();
  const campuses = useAppSelector((s) => s.campuses.items);
  const { user } = useAuthState();

  const canMark =
    user?.permissions?.includes("attendance.staff.mark") ||
    user?.role === "SUPER_ADMIN";

  const [campusId, setCampusId] = useState<string>(
    user?.campusId ? String(user.campusId) : "",
  );
  const [deptId, setDeptId] = useState<string>("");
  const [date, setDate] = useState(todayIso());
  const [departments, setDepartments] = useState<Department[]>([]);
  const [rows, setRows] = useState<StaffRegisterRow[]>([]);
  const [marks, setMarks] = useState<Record<number, StaffAttendanceStatus>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchCampuses());
    hrService.listDepartments().then(setDepartments).catch(console.error);
  }, [dispatch]);

  useEffect(() => {
    if (!campusId && user?.campusId) setCampusId(String(user.campusId));
  }, [user?.campusId, campusId]);

  const applyRows = useCallback((data: StaffRegisterRow[]) => {
    setRows(data);
    const nextMarks: Record<number, StaffAttendanceStatus> = {};
    const nextNotes: Record<number, string> = {};
    for (const row of data) {
      if (row.record) {
        nextMarks[row.employee.id] = row.record.status;
        nextNotes[row.employee.id] = row.record.notes ?? "";
      } else if (row.is_working_day === false) {
        nextMarks[row.employee.id] = "EXCUSED";
      }
    }
    setMarks(nextMarks);
    setNotes(nextNotes);
  }, []);

  const loadRegister = useCallback(async () => {
    if (!campusId || !date) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await attendanceService.getStaffRegister({
        date,
        campus_id: Number(campusId),
        ...(deptId ? { department_id: Number(deptId) } : {}),
      });
      applyRows(data);
    } catch {
      setError("Failed to load staff register.");
    } finally {
      setLoading(false);
    }
  }, [campusId, date, deptId, applyRows]);

  useEffect(() => {
    loadRegister();
  }, [loadRegister]);

  const setMark = (employeeId: number, status: StaffAttendanceStatus) => {
    if (!canMark) return;
    const row = rows.find((r) => r.employee.id === employeeId);
    if (row?.is_working_day === false) return;
    setMarks((prev) => ({ ...prev, [employeeId]: status }));
  };

  const setNote = (employeeId: number, value: string) => {
    setNotes((prev) => ({ ...prev, [employeeId]: value }));
  };

  // Mark everyone with one status (bulk shortcut)
  const markAll = (status: StaffAttendanceStatus) => {
    if (!canMark) return;
    const next: Record<number, StaffAttendanceStatus> = { ...marks };
    rows.forEach((r) => {
      if (r.is_working_day !== false) next[r.employee.id] = status;
    });
    setMarks(next);
  };

  // Filtered rows for display (deptId filter is server-side, but also apply here so
  // department change doesn't require extra round-trip)
  const displayRows = useMemo(() => {
    if (!deptId) return rows;
    return rows.filter((r) => String(r.employee.departments?.id) === deptId);
  }, [rows, deptId]);

  const handleSave = async () => {
    if (!canMark || !campusId) return;
    const workingRows = rows.filter((r) => r.is_working_day !== false);
    const records = workingRows.map((r) => ({
      employee_id: r.employee.id,
      status: marks[r.employee.id] ?? ("ABSENT" as StaffAttendanceStatus),
      ...(notes[r.employee.id] ? { notes: notes[r.employee.id] } : {}),
    }));
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await attendanceService.bulkMarkStaff({
        date,
        campus_id: Number(campusId),
        records,
      });
      const data = await attendanceService.getStaffRegister({
        date,
        campus_id: Number(campusId),
        ...(deptId ? { department_id: Number(deptId) } : {}),
      });
      applyRows(data);
      setSuccess(`Attendance saved for ${records.length} staff members.`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || "Failed to save attendance.");
    } finally {
      setSaving(false);
    }
  };

  if (!canMark) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-slate-600">
          You do not have permission to view or mark staff attendance.
        </p>
      </div>
    );
  }

  const sel =
    "h-10 px-3 border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400";

  const unmarked = displayRows.filter(
    (r) => r.is_working_day !== false && !marks[r.employee.id],
  ).length;

  const offDayRows = displayRows.filter((r) => r.is_working_day === false);
  const offDayLabel =
    offDayRows[0]?.day_description ??
    offDayRows[0]?.day_type ??
    "Holiday / day off";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
            <ClipboardCheck className="h-6 w-6 text-indigo-600" />
            Staff Daily Register
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Mark daily attendance for all campus staff.
          </p>
        </div>
        <button
          type="button"
          onClick={loadRegister}
          disabled={loading}
          className="mt-3 md:mt-0 flex items-center gap-2 px-4 py-2 text-sm border rounded-lg bg-white hover:bg-slate-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg flex gap-3 items-center">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="text-sm">{success}</span>
        </div>
      )}

      {offDayRows.length > 0 && (
        <div className="p-4 bg-sky-50 border border-sky-200 text-sky-900 rounded-lg flex gap-3 items-start">
          <CalendarOff className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Non-working day — {offDayLabel}</p>
            <p className="text-sky-800/80 mt-1">
              {offDayRows.length} staff member{offDayRows.length > 1 ? "s are" : " is"} auto-marked EXCUSED.
              Manual attendance marking is disabled for this date.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border rounded-xl p-5 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3">
          Filters
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 mb-1.5">
              Campus <span className="text-rose-500">*</span>
            </label>
            <select
              value={campusId}
              onChange={(e) => { setCampusId(e.target.value); setDeptId(""); }}
              className={`w-full ${sel}`}
            >
              <option value="">Select campus...</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>{c.campus_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-500 mb-1.5">Department</label>
            <select
              value={deptId}
              onChange={(e) => setDeptId(e.target.value)}
              disabled={!campusId}
              className={`w-full ${sel} disabled:opacity-40`}
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-500 mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`w-full ${sel}`}
            />
          </div>

          {/* Quick mark all */}
          {canMark && rows.length > 0 && (
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 mb-1.5">
                Mark all as
              </label>
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) markAll(e.target.value as StaffAttendanceStatus);
                  e.target.value = "";
                }}
                className={`w-full ${sel}`}
              >
                <option value="">Select status…</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      {!campusId ? (
        <p className="text-sm text-slate-500 text-center py-14">
          Select a campus to load the staff register.
        </p>
      ) : loading ? (
        <div className="flex flex-col items-center py-16">
          <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
          <p className="text-sm text-slate-500 mt-2">Loading staff register…</p>
        </div>
      ) : displayRows.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-14">
          No staff profiles linked to this campus
          {deptId ? " and department" : ""}.
        </p>
      ) : (
        <>
          <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 border-b text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Department</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Expected In</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayRows.map((row) => {
                  const emp = row.employee;
                  const currentStatus = marks[emp.id];
                  const isOffDay = row.is_working_day === false;

                  return (
                    <tr
                      key={emp.id}
                      className={`hover:bg-slate-50/60 transition ${isOffDay ? "bg-sky-50/40" : ""}`}
                    >
                      <td className="px-5 py-3 font-medium text-slate-800">
                        {emp.full_name ?? emp.users?.full_name ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-xs font-semibold uppercase">
                        {emp.job_title ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {emp.departments?.name ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {formatStaffCategory(emp.staff_category) ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        {emp.reporting_time ? (
                          <span className="inline-flex items-center gap-1 text-xs font-mono text-zinc-600">
                            <Clock className="h-3 w-3 text-zinc-400" />
                            {new Date(emp.reporting_time).toLocaleTimeString("en-US", {
                              hour: "2-digit", minute: "2-digit", timeZone: "UTC",
                            })}
                            {emp.late_relaxation_minutes ? (
                              <span className="text-[10px] text-zinc-400">+{emp.late_relaxation_minutes}m</span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {isOffDay ? (
                          <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-100 text-sky-800">
                            EXCUSED — {row.day_description ?? row.day_type ?? "Day off"}
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {STATUS_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                disabled={!canMark}
                                onClick={() => setMark(emp.id, opt.value)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition disabled:opacity-40 ${
                                  currentStatus === opt.value
                                    ? STATUS_STYLES[opt.value]
                                    : INACTIVE_STYLES[opt.value]
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <input
                          type="text"
                          value={notes[emp.id] ?? ""}
                          onChange={(e) => setNote(emp.id, e.target.value)}
                          disabled={!canMark || isOffDay}
                          placeholder={isOffDay ? "Auto holiday" : "Optional note…"}
                          className="w-full min-w-32 px-2 py-1 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-40"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Save bar */}
          {canMark && (
            <div className="flex items-center justify-between bg-white border rounded-xl px-5 py-3 shadow-sm">
              <p className="text-sm text-slate-500">
                {unmarked > 0 ? (
                  <span className="text-amber-600 font-medium">
                    {unmarked} staff member{unmarked > 1 ? "s" : ""} not yet marked
                  </span>
                ) : (
                  <span className="text-emerald-600 font-medium">All staff marked</span>
                )}
              </p>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || rows.length === 0}
                className="px-5 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {saving ? "Saving…" : "Save attendance"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
