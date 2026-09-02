"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Search,
  Undo2,
  XCircle,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCampuses } from "@/store/slices/campusesSlice";
import { useAuthState } from "@/context/AuthContext";
import {
  staffLessonReschedulesService,
  StaffLessonReschedule,
  StaffLessonRescheduleStatus,
  StaffLessonTeacher,
  StaffLessonTeacherSlot,
} from "@/lib/staff-lesson-reschedules.service";
import {
  generateWeekdayOccurrences,
  WEEKDAY_FULL,
} from "@/lib/weekday-dates";

const STATUS_STYLES: Record<StaffLessonRescheduleStatus, string> = {
  PENDING:
    "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60",
  COMPLETED:
    "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60",
  CANCELLED:
    "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function StaffLessonReschedulesPage() {
  const dispatch = useAppDispatch();
  const campuses = useAppSelector((s) => s.campuses.items);
  const { user } = useAuthState();

  const canMark =
    user?.permissions?.includes("attendance.staff.mark") ||
    user?.role === "SUPER_ADMIN";

  const [campusId, setCampusId] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [teachers, setTeachers] = useState<StaffLessonTeacher[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<StaffLessonTeacher | null>(null);
  const [slots, setSlots] = useState<StaffLessonTeacherSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [sourceDate, setSourceDate] = useState("");
  const [makeupDate, setMakeupDate] = useState("");
  const [rows, setRows] = useState<StaffLessonReschedule[]>([]);
  const [statusFilter, setStatusFilter] = useState<StaffLessonRescheduleStatus | "">("PENDING");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [staffHint, setStaffHint] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchCampuses());
  }, [dispatch]);

  useEffect(() => {
    if (user?.campusId && !campusId) setCampusId(String(user.campusId));
  }, [user?.campusId, campusId]);

  const loadTeachers = useCallback(async () => {
    if (!campusId || !canMark) return;
    setLoading(true);
    setError(null);
    try {
      const data = await staffLessonReschedulesService.listTeachers({
        campus_id: Number(campusId),
        search: teacherSearch.trim() || undefined,
      });
      setTeachers(data);
    } catch {
      setError("Failed to load O-Level teachers.");
      setTeachers([]);
    } finally {
      setLoading(false);
    }
  }, [campusId, canMark, teacherSearch]);

  const loadRows = useCallback(async () => {
    if (!canMark) return;
    try {
      const data = await staffLessonReschedulesService.list({
        ...(campusId ? { campus_id: Number(campusId) } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      setRows(data);
    } catch {
      setRows([]);
    }
  }, [canMark, campusId, statusFilter]);

  useEffect(() => {
    void loadTeachers();
  }, [loadTeachers]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const selectedSlot = useMemo(
    () => slots.find((s) => s.id === selectedSlotId) ?? null,
    [slots, selectedSlotId],
  );

  const sourceDateOptions = useMemo(() => {
    if (!selectedSlot) return [];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const minIso = selectedSlot.timetable_effective_from;
    const fromIso =
      minIso > "2026-08-01" ? minIso : "2026-08-01";
    const to = new Date(today);
    to.setUTCDate(to.getUTCDate() - 1);
    return generateWeekdayOccurrences(
      selectedSlot.day_of_week,
      fromIso,
      to.toISOString().slice(0, 10),
    ).reverse();
  }, [selectedSlot]);

  const selectTeacher = async (teacher: StaffLessonTeacher) => {
    setSelectedTeacher(teacher);
    setSelectedSlotId(null);
    setSourceDate("");
    setMakeupDate("");
    setStaffHint(null);
    setError(null);
    try {
      const data = await staffLessonReschedulesService.getTeacherSlots(teacher.employee_id);
      setSlots(data.slots);
    } catch {
      setError("Failed to load teacher slots.");
      setSlots([]);
    }
  };

  useEffect(() => {
    if (!selectedSlot || !sourceDate || !selectedTeacher) {
      setStaffHint(null);
      return;
    }
    void staffLessonReschedulesService
      .getSourceDateStatus({
        employee_id: selectedTeacher.employee_id,
        source_timetable_slot_id: selectedSlot.id,
        source_date: sourceDate,
      })
      .then((s) => {
        if (s.staff_status) {
          setStaffHint(`Staff register on missed day: ${s.staff_status}${s.staff_notes ? ` — ${s.staff_notes}` : ""}`);
        } else {
          setStaffHint("Staff register on missed day: unmarked");
        }
      })
      .catch(() => setStaffHint(null));
  }, [selectedSlot, sourceDate, selectedTeacher]);

  const handleCreate = async () => {
    if (!selectedTeacher || !selectedSlot || !sourceDate || !makeupDate) return;
    setActionId(-1);
    setError(null);
    setSuccess(null);
    try {
      await staffLessonReschedulesService.create({
        employee_id: selectedTeacher.employee_id,
        campus_id: selectedSlot.campus_id,
        class_id: selectedSlot.class_id,
        section_id: selectedSlot.section_id,
        source_timetable_slot_id: selectedSlot.id,
        source_date: sourceDate,
        makeup_date: makeupDate,
      });
      setSuccess("Pending reschedule created.");
      await loadRows();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || "Failed to create reschedule.");
    } finally {
      setActionId(null);
    }
  };

  const handleComplete = async (row: StaffLessonReschedule) => {
    setActionId(row.id);
    setError(null);
    setSuccess(null);
    try {
      const result = await staffLessonReschedulesService.complete(row.id);
      if (result.staffExcused) {
        setSuccess("Makeup confirmed — teacher excused on Staff Register for missed day.");
      } else {
        setSuccess(result.staffExcuseWarning ?? "Completed without auto staff excuse.");
      }
      await loadRows();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || "Failed to confirm makeup.");
    } finally {
      setActionId(null);
    }
  };

  const handleCancel = async (id: number) => {
    setActionId(id);
    try {
      await staffLessonReschedulesService.cancel(id);
      setSuccess("Reschedule cancelled.");
      await loadRows();
    } catch {
      setError("Failed to cancel.");
    } finally {
      setActionId(null);
    }
  };

  const handleReverse = async (id: number) => {
    setActionId(id);
    try {
      await staffLessonReschedulesService.reverse(id);
      setSuccess("Completed reschedule reversed.");
      await loadRows();
    } catch {
      setError("Failed to reverse.");
    } finally {
      setActionId(null);
    }
  };

  if (!canMark) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        You need attendance.staff.mark permission to manage staff lesson reschedules.
      </div>
    );
  }

  const slotsByDay = useMemo(() => {
    const map = new Map<number, StaffLessonTeacherSlot[]>();
    for (const slot of slots) {
      const list = map.get(slot.day_of_week) ?? [];
      list.push(slot);
      map.set(slot.day_of_week, list);
    }
    return map;
  }, [slots]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarClock className="h-7 w-7 text-primary" />
          Staff Lesson Reschedules
        </h1>
        <p className="text-muted-foreground mt-1">
          O-Level missed lessons — confirm makeup held to excuse the teacher on Staff Register only.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {success}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-end">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Campus</span>
          <select
            className="block rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={campusId}
            onChange={(e) => {
              setCampusId(e.target.value);
              setSelectedTeacher(null);
              setSlots([]);
            }}
          >
            <option value="">All</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.campus_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <section className="space-y-4 rounded-xl border border-border p-4">
          <h2 className="font-semibold">1. Pick teacher (timetable payroll)</h2>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-2 text-sm"
              placeholder="Search by name or code…"
              value={teacherSearch}
              onChange={(e) => setTeacherSearch(e.target.value)}
            />
          </div>
          {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          <ul className="max-h-64 overflow-y-auto divide-y divide-border rounded-md border border-border">
            {teachers.map((t) => (
              <li key={t.employee_id}>
                <button
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 ${
                    selectedTeacher?.employee_id === t.employee_id ? "bg-primary/10" : ""
                  }`}
                  onClick={() => void selectTeacher(t)}
                >
                  <div className="font-medium">{t.full_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.employee_code ?? "—"} · {t.slot_count} slot{t.slot_count === 1 ? "" : "s"}
                  </div>
                </button>
              </li>
            ))}
            {!loading && teachers.length === 0 && (
              <li className="px-3 py-4 text-sm text-muted-foreground text-center">
                No O-Level timetable teachers found.
              </li>
            )}
          </ul>

          {selectedTeacher && slots.length > 0 && (
            <>
              <h2 className="font-semibold pt-2">2. Missed slot & dates</h2>
              <div className="flex flex-wrap gap-2">
                {[...slotsByDay.entries()]
                  .sort(([a], [b]) => a - b)
                  .map(([dow, daySlots]) => (
                    <div key={dow} className="w-full space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">
                        {WEEKDAY_FULL[dow]}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {daySlots.map((slot) => (
                          <button
                            key={slot.id}
                            type="button"
                            className={`rounded-full border px-3 py-1 text-xs ${
                              selectedSlotId === slot.id
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border"
                            }`}
                            onClick={() => {
                              setSelectedSlotId(slot.id);
                              setSourceDate(slot.default_source_date);
                              setMakeupDate(new Date().toISOString().slice(0, 10));
                            }}
                          >
                            {slot.class_code} {slot.section_code} · P{slot.block_number} ·{" "}
                            {slot.subject.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>

              {selectedSlot && (
                <div className="space-y-3 pt-2">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium">Missed date</span>
                    <select
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      value={sourceDate}
                      onChange={(e) => setSourceDate(e.target.value)}
                    >
                      {sourceDateOptions.map((d) => (
                        <option key={d} value={d}>
                          {formatDate(d)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium">Makeup date</span>
                    <input
                      type="date"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      value={makeupDate}
                      onChange={(e) => setMakeupDate(e.target.value)}
                    />
                  </label>
                  {staffHint && (
                    <p className="text-xs text-muted-foreground">{staffHint}</p>
                  )}
                  <button
                    type="button"
                    disabled={actionId !== null}
                    className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                    onClick={() => void handleCreate()}
                  >
                    {actionId === -1 ? "Saving…" : "Save pending reschedule"}
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <section className="space-y-4 rounded-xl border border-border p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Reschedules</h2>
            <select
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as StaffLessonRescheduleStatus | "")
              }
            >
              <option value="">All</option>
              <option value="PENDING">Pending</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <ul className="space-y-3 max-h-[32rem] overflow-y-auto">
            {rows.map((row) => (
              <li
                key={row.id}
                className="rounded-lg border border-border p-3 space-y-2 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {row.employee_profiles?.full_name ?? "Teacher"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.classes?.class_code} {row.sections?.description} ·{" "}
                      {row.source_timetable_slot?.subjects?.name ?? "Lesson"}
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLES[row.status]}`}
                  >
                    {row.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatDate(row.source_date)}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span>{formatDate(row.makeup_date)}</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {row.status === "PENDING" && (
                    <>
                      <button
                        type="button"
                        disabled={actionId === row.id}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                        onClick={() => void handleComplete(row)}
                      >
                        {actionId === row.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        Confirm makeup held
                      </button>
                      <button
                        type="button"
                        disabled={actionId === row.id}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs"
                        onClick={() => void handleCancel(row.id)}
                      >
                        <XCircle className="h-3 w-3" />
                        Cancel
                      </button>
                    </>
                  )}
                  {row.status === "COMPLETED" && (
                    <button
                      type="button"
                      disabled={actionId === row.id}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs"
                      onClick={() => void handleReverse(row.id)}
                    >
                      <Undo2 className="h-3 w-3" />
                      Reverse
                    </button>
                  )}
                </div>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="text-sm text-muted-foreground text-center py-8">
                No reschedules yet.
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
