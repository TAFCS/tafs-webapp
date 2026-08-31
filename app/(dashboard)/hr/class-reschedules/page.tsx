"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  Loader2,
  RefreshCw,
  XCircle,
  Undo2,
  CheckCircle2,
  Search,
  ArrowRight,
  ClipboardList,
  Sparkles,
  Calendar,
  User,
  BookOpen,
  Pencil,
  Info,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCampuses } from "@/store/slices/campusesSlice";
import { useAuthState } from "@/context/AuthContext";
import {
  classReschedulesService,
  ClassReschedule,
  ClassRescheduleStatus,
} from "@/lib/class-reschedules.service";
import Link from "next/link";

const STATUS_STYLES: Record<ClassRescheduleStatus, string> = {
  PENDING:
    "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60",
  COMPLETED:
    "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60",
  CANCELLED:
    "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700",
};

const WEEKDAY_FULL: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function missedLessonLabel(row: ClassReschedule): string {
  const day =
    row.source_timetable_slot?.day_of_week != null
      ? WEEKDAY_FULL[row.source_timetable_slot.day_of_week]
      : row.source_day_label ?? "Lesson";
  const period = row.source_timetable_slot?.block_number ?? "?";
  return `${day}, ${formatDate(row.source_date)} · Period ${period}`;
}

function rollCallHref(row: ClassReschedule): string {
  const params = new URLSearchParams({
    makeup: "1",
    date: row.makeup_date.slice(0, 10),
    teaching_group_id: String(row.teaching_group_id),
    class_id: String(row.teaching_groups?.class_id ?? ""),
  });
  if (row.teaching_groups?.campus_id) {
    params.set("campus_id", String(row.teaching_groups.campus_id));
  }
  return `/hr/roll-call?${params.toString()}`;
}

export default function ClassReschedulesPage() {
  const dispatch = useAppDispatch();
  const campuses = useAppSelector((s) => s.campuses.items);
  const { user } = useAuthState();

  const canMark =
    user?.permissions?.includes("attendance.student.rollcall.mark") ||
    user?.role === "SUPER_ADMIN";
  const canView =
    canMark ||
    user?.permissions?.includes("attendance.student.rollcall.view") ||
    user?.role === "SUPER_ADMIN";
  const canEditLocked =
    user?.role === "SUPER_ADMIN" ||
    (user?.permissions ?? []).includes("attendance.student.edit_locked");

  const [campusId, setCampusId] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClassRescheduleStatus | "">("PENDING");
  const [searchQuery, setSearchQuery] = useState("");
  const [rows, setRows] = useState<ClassReschedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [editingMakeupId, setEditingMakeupId] = useState<number | null>(null);
  const [makeupDraft, setMakeupDraft] = useState("");

  const [confirmModal, setConfirmModal] = useState<{
    type: "cancel" | "reverse";
    reschedule: ClassReschedule;
  } | null>(null);

  useEffect(() => {
    dispatch(fetchCampuses());
  }, [dispatch]);

  useEffect(() => {
    if (user?.campusId && !campusId) {
      setCampusId(String(user.campusId));
    }
  }, [user?.campusId, campusId]);

  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      const data = await classReschedulesService.list({
        ...(campusId ? { campus_id: Number(campusId) } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      setRows(data);
    } catch {
      setError("Failed to load class reschedules.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [canView, campusId, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCancel = async (id: number) => {
    if (!canMark) return;
    setActionId(id);
    setError(null);
    setSuccess(null);
    try {
      await classReschedulesService.cancel(id);
      setSuccess("Missed lesson removed from the makeup schedule.");
      setConfirmModal(null);
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || "Failed to remove missed lesson.");
    } finally {
      setActionId(null);
    }
  };

  const handleReverse = async (id: number) => {
    if (!canEditLocked) return;
    setActionId(id);
    setError(null);
    setSuccess(null);
    try {
      await classReschedulesService.reverse(id);
      setSuccess("Completed reschedule reversed. Student & staff attendance updated.");
      setConfirmModal(null);
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || "Failed to reverse reschedule.");
    } finally {
      setActionId(null);
    }
  };

  const saveMakeupDate = async (row: ClassReschedule) => {
    if (!canMark || !makeupDraft) return;
    setActionId(row.id);
    setError(null);
    setSuccess(null);
    try {
      await classReschedulesService.updateMakeupDate(row.id, makeupDraft);
      setSuccess(`Makeup date updated to ${formatDate(makeupDraft)}.`);
      setEditingMakeupId(null);
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || "Failed to update makeup date.");
    } finally {
      setActionId(null);
    }
  };

  const filteredRows = useMemo(() => {
    let list = rows;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) => {
        const subject = r.teaching_groups?.subjects?.name?.toLowerCase() ?? "";
        const teacher = r.teaching_groups?.employee_profiles?.full_name?.toLowerCase() ?? "";
        return subject.includes(q) || teacher.includes(q) || missedLessonLabel(r).toLowerCase().includes(q);
      });
    }
    return [...list].sort((a, b) => {
      const dateCmp = b.makeup_date.localeCompare(a.makeup_date);
      if (dateCmp !== 0) return dateCmp;
      return b.source_date.localeCompare(a.source_date);
    });
  }, [rows, searchQuery]);

  const stats = useMemo(() => {
    const total = rows.length;
    const pending = rows.filter((r) => r.status === "PENDING").length;
    const completed = rows.filter((r) => r.status === "COMPLETED").length;
    const cancelled = rows.filter((r) => r.status === "CANCELLED").length;
    return { total, pending, completed, cancelled };
  }, [rows]);

  if (!canView) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          You do not have permission to view class reschedules.
        </div>
      </div>
    );
  }

  const selectCls =
    "h-10 px-3 pr-8 appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm cursor-pointer";

  return (
    <div className="max-w-6xl mx-auto pb-24 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/80 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
            <span className="p-2 bg-indigo-500/10 dark:bg-indigo-400/10 rounded-xl text-indigo-600 dark:text-indigo-400">
              <CalendarClock className="h-6 w-6" />
            </span>
            A-Level Class Reschedules
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-xl">
            Each row is one missed lesson waiting for a makeup. Set when the replacement class
            will be held, take attendance, or remove entries you no longer need.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/hr/roll-call"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-md shadow-indigo-600/20"
          >
            <ClipboardList className="h-4 w-4" /> New Makeup Roll Call
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="h-9 w-9 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 flex items-center justify-center hover:border-zinc-300 shadow-sm"
            aria-label="Refresh list"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-indigo-200/80 dark:border-indigo-900/50 bg-indigo-50/60 dark:bg-indigo-950/30 px-4 py-3 text-xs text-indigo-900 dark:text-indigo-200 flex gap-2.5">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-indigo-600" />
        <p>
          <strong>How this works:</strong> Missed lesson → pick a makeup date → take roll call on
          that day → students who attended get auto-excused on the original missed date. Use{" "}
          <strong>New Makeup Roll Call</strong> to create entries, or edit the makeup date below.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">Total</p>
          <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-zinc-950 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl p-4 shadow-sm">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-amber-600">Pending</p>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-white dark:bg-zinc-950 border border-emerald-200/80 dark:border-emerald-900/40 rounded-2xl p-4 shadow-sm">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600">Done</p>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">{stats.completed}</p>
        </div>
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">Removed</p>
          <p className="text-2xl font-black text-zinc-600 dark:text-zinc-400 mt-1">{stats.cancelled}</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 rounded-2xl flex gap-3 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
          <div className="font-medium">{error}</div>
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 rounded-2xl flex gap-3 text-sm">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          <div className="font-medium">{success}</div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-900/60 p-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <select value={campusId} onChange={(e) => setCampusId(e.target.value)} className={selectCls}>
            <option value="">All Campuses</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.campus_name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ClassRescheduleStatus | "")}
            className={selectCls}
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Removed</option>
          </select>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search subject, teacher, date…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <Loader2 className="h-9 w-9 animate-spin text-indigo-600" />
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 py-16 text-center">
          <CalendarClock className="h-10 w-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
          <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">No reschedules found.</p>
          <Link
            href="/hr/roll-call"
            className="inline-flex items-center gap-1.5 mt-4 text-xs font-bold text-indigo-600 hover:underline"
          >
            <ClipboardList className="h-3.5 w-3.5" /> Create one from Roll Call
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRows.map((row) => (
            <div
              key={row.id}
              className="bg-white dark:bg-zinc-950 border border-zinc-200/90 dark:border-zinc-800/90 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="p-1.5 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg text-indigo-600 shrink-0">
                    <BookOpen className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                      {row.teaching_groups?.subjects?.name ?? "Subject"}
                    </h3>
                    <p className="text-xs text-zinc-500 flex items-center gap-1">
                      <User className="h-3 w-3 shrink-0" />
                      {row.teaching_groups?.employee_profiles?.full_name ?? "Teacher"}
                    </p>
                  </div>
                </div>
                <span
                  className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${STATUS_STYLES[row.status]}`}
                >
                  {row.status === "CANCELLED" ? "Removed" : row.status}
                </span>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-4 rounded-xl bg-zinc-50/80 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-rose-600 uppercase tracking-wider mb-1">
                    Missed lesson
                  </p>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-rose-500 shrink-0" />
                    {missedLessonLabel(row)}
                  </p>
                </div>

                <ArrowRight className="h-5 w-5 text-zinc-400 shrink-0 hidden lg:block" />

                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-wider mb-1">
                    Makeup held on
                  </p>
                  {row.status === "PENDING" && canMark && editingMakeupId === row.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="date"
                        value={makeupDraft}
                        onChange={(e) => setMakeupDraft(e.target.value)}
                        className="h-9 px-3 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-zinc-900 text-sm font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => void saveMakeupDate(row)}
                        disabled={actionId === row.id}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {actionId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingMakeupId(null)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-indigo-500 shrink-0" />
                      {formatDate(row.makeup_date)} · Period {row.makeup_period}
                      {row.status === "PENDING" && canMark && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMakeupId(row.id);
                            setMakeupDraft(row.makeup_date.slice(0, 10));
                          }}
                          className="ml-1 p-1 rounded-md text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                          title="Change makeup date"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-900">
                {row.status === "PENDING" && canMark && (
                  <>
                    <Link
                      href={rollCallHref(row)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                    >
                      <ClipboardList className="h-3.5 w-3.5" />
                      Take Attendance
                    </Link>
                    <button
                      type="button"
                      onClick={() => setConfirmModal({ type: "cancel", reschedule: row })}
                      disabled={actionId === row.id}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-zinc-900 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Remove missed lesson
                    </button>
                  </>
                )}
                {row.status === "COMPLETED" && canEditLocked && (
                  <button
                    type="button"
                    onClick={() => setConfirmModal({ type: "reverse", reschedule: row })}
                    disabled={actionId === row.id}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 border border-amber-200 hover:bg-amber-100 disabled:opacity-50"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    Undo excusals
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  confirmModal.type === "cancel"
                    ? "bg-rose-100 text-rose-600"
                    : "bg-amber-100 text-amber-600"
                }`}
              >
                {confirmModal.type === "cancel" ? (
                  <XCircle className="h-6 w-6" />
                ) : (
                  <Undo2 className="h-6 w-6" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-base">
                  {confirmModal.type === "cancel" ? "Remove missed lesson?" : "Undo excusals?"}
                </h3>
              </div>
            </div>

            <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {confirmModal.type === "cancel" ? (
                <>
                  Remove <strong>{missedLessonLabel(confirmModal.reschedule)}</strong> from the
                  makeup scheduled on{" "}
                  <strong>{formatDate(confirmModal.reschedule.makeup_date)}</strong>? This won&apos;t
                  delete any submitted roll call — it just unlinks this missed lesson.
                </>
              ) : (
                <>
                  Undo auto-excusals for{" "}
                  <strong>{missedLessonLabel(confirmModal.reschedule)}</strong>? Students and staff
                  will revert on the original missed date.
                </>
              )}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-900">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-800"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={() =>
                  confirmModal.type === "cancel"
                    ? handleCancel(confirmModal.reschedule.id)
                    : handleReverse(confirmModal.reschedule.id)
                }
                disabled={actionId === confirmModal.reschedule.id}
                className={`px-4 py-2 text-xs font-bold rounded-xl text-white flex items-center gap-1.5 ${
                  confirmModal.type === "cancel" ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-600"
                }`}
              >
                {actionId === confirmModal.reschedule.id && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                {confirmModal.type === "cancel" ? "Yes, remove" : "Yes, undo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
