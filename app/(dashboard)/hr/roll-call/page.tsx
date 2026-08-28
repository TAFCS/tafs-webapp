"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CalendarOff,
  CheckCircle2,
  ClipboardList,
  Loader2,
  RefreshCw,
  SkipForward,
  MapPin,
  ChevronDown,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCampuses } from "@/store/slices/campusesSlice";
import type { CampusClass } from "@/store/slices/campusesSlice";
import { useAuthState } from "@/context/AuthContext";
import { getAcademicYears, getCurrentAcademicYear } from "@/lib/fee-utils";
import {
  attendanceService,
  RollRecordStatus,
  RollSession,
  RollSessionRosterEntry,
} from "@/lib/attendance.service";
import { DaySlotsResponse, timetablesService } from "@/lib/timetables.service";
import { teachingGroupsService, TeachingGroup } from "@/lib/teaching-groups.service";
import { isAsA2Class } from "@/lib/alevel-classes";

const LEGACY_PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

function blockLabel(block: DaySlotsResponse["blocks"][number]): string {
  if (block.label) return block.label;
  const d = new Date(block.start_time);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const hour12 = ((h + 11) % 12) + 1;
  const suffix = h < 12 ? "am" : "pm";
  const time =
    m === 0 ? `${hour12}${suffix}` : `${hour12}:${String(m).padStart(2, "0")}${suffix}`;
  return time;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function RollCallPage() {
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

  const gulistanCampus = campuses.find(
    (c) =>
      c.campus_name.toLowerCase().includes("gulistan") ||
      c.campus_name.toLowerCase().includes("johar") ||
      c.campus_name.toLowerCase().includes("jauhar")
  );
  const lockedCampusId = gulistanCampus ? String(gulistanCampus.id) : (user?.campusId ? String(user.campusId) : "");

  const [classId, setClassId] = useState("");
  const [teachingGroupId, setTeachingGroupId] = useState("");
  const [groups, setGroups] = useState<TeachingGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [sessionDate, setSessionDate] = useState(todayIso());
  const [period, setPeriod] = useState(1);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [daySlots, setDaySlots] = useState<DaySlotsResponse | null>(null);
  const [daySlotsLoading, setDaySlotsLoading] = useState(false);
  const [session, setSession] = useState<RollSession | null>(null);
  const [marks, setMarks] = useState<Record<number, RollRecordStatus>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState("");
  const [showSkip, setShowSkip] = useState(false);

  useEffect(() => {
    dispatch(fetchCampuses());
  }, [dispatch]);

  const selectedCampus = gulistanCampus || campuses.find((c) => String(c.id) === lockedCampusId);
  const availableClasses: CampusClass[] = (selectedCampus?.offered_classes ?? []).filter(
    isAsA2Class
  );

  useEffect(() => {
    setTeachingGroupId("");
  }, [classId]);

  useEffect(() => {
    if (!lockedCampusId || !classId) {
      setGroups([]);
      return;
    }
    let cancelled = false;
    setGroupsLoading(true);
    teachingGroupsService
      .list({
        campus_id: Number(lockedCampusId),
        class_id: Number(classId),
        academic_year: getCurrentAcademicYear(),
      })
      .then((data) => {
        if (!cancelled) setGroups(data.filter((g) => g.is_active));
      })
      .catch(() => !cancelled && setGroups([]))
      .finally(() => !cancelled && setGroupsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [lockedCampusId, classId]);

  const isScopeReady = Boolean(lockedCampusId) && Boolean(classId) && Boolean(teachingGroupId) && Boolean(sessionDate);

  const slotPills =
    daySlots?.blocks.flatMap((block) =>
      block.slots.map((slot) => ({
        slot,
        block,
        pillLabel: `${blockLabel(block)} — ${slot.subject.name}`,
      })),
    ) ?? [];
  const timetableMode = slotPills.length > 0;

  const isSlotValidForDay = useCallback(
    (slotId: number | null) => {
      if (!slotId) return true;
      if (!daySlots) return false;
      return daySlots.blocks.some((block) => block.slots.some((slot) => slot.id === slotId));
    },
    [daySlots],
  );

  const applySession = useCallback((s: RollSession) => {
    setSession(s);
    const next: Record<number, RollRecordStatus> = {};
    for (const row of s.roster ?? []) {
      if (row.record?.status) {
        next[row.student.cc] = row.record.status;
      }
    }
    setMarks(next);
  }, []);

  const loadSession = useCallback(
    async (opts?: { slotId?: number | null; periodNum?: number }) => {
      if (!isScopeReady || !canView) return;

      const slotId = opts?.slotId !== undefined ? opts.slotId : selectedSlotId;
      const periodNum = opts?.periodNum ?? period;

      if (opts?.slotId === undefined && !isSlotValidForDay(slotId)) return;

      setLoading(true);
      setError(null);
      setSuccess(null);
      try {
        const campusId = Number(lockedCampusId);
        const classIdNum = Number(classId);
        const groupId = Number(teachingGroupId);

        const existing = await attendanceService.listRollSessions({
          date: sessionDate,
          campus_id: campusId,
          class_id: classIdNum,
          teaching_group_id: groupId,
          period: periodNum,
          ...(slotId ? { timetable_slot_id: slotId } : {}),
        });

        let active =
          existing.find(
            (s) =>
              s.period === periodNum &&
              (slotId ? s.timetable_slot_id === slotId : !s.timetable_slot_id),
          ) ?? null;

        if (!active && canMark) {
          active = await attendanceService.createRollSession({
            session_date: sessionDate,
            campus_id: campusId,
            class_id: classIdNum,
            teaching_group_id: groupId,
            period: periodNum,
            ...(slotId ? { timetable_slot_id: slotId } : {}),
          });
        } else if (active) {
          active = await attendanceService.getRollSession(active.id);
        }

        if (!active) {
          setSession(null);
          setMarks({});
          setError("No roll session found. Select scope with mark permission to open one.");
          return;
        }

        applySession(active);
      } catch (err) {
        console.error(err);
        setError("Failed to load roll call session.");
        setSession(null);
      } finally {
        setLoading(false);
      }
    },
    [
      isScopeReady,
      canView,
      canMark,
      lockedCampusId,
      classId,
      teachingGroupId,
      sessionDate,
      period,
      selectedSlotId,
      isSlotValidForDay,
      applySession,
    ],
  );

  const loadSessionRef = useRef(loadSession);
  useEffect(() => {
    loadSessionRef.current = loadSession;
  }, [loadSession]);

  useEffect(() => {
    if (!isScopeReady) {
      setDaySlots(null);
      setSelectedSlotId(null);
      setDaySlotsLoading(false);
      setSession(null);
      setMarks({});
      return;
    }

    let cancelled = false;
    setDaySlotsLoading(true);
    setDaySlots(null);
    setSelectedSlotId(null);
    setSession(null);
    setMarks({});

    (async () => {
      try {
        const data = await timetablesService.getDaySlotsByGroup({
          teaching_group_id: Number(teachingGroupId),
          date: sessionDate,
        });
        if (cancelled) return;

        setDaySlots(data);
        const pills = data.blocks.flatMap((block) =>
          block.slots.map((slot) => ({ ...slot, block_number: block.block_number })),
        );

        const slotId = pills.length > 0 ? pills[0].id : null;
        const periodNum = pills.length > 0 ? pills[0].block_number : 1;

        setSelectedSlotId(slotId);
        setPeriod(periodNum);
        setDaySlotsLoading(false);

        if (!cancelled && canView) {
          await loadSessionRef.current({ slotId, periodNum });
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setDaySlots(null);
          setSelectedSlotId(null);
          setDaySlotsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isScopeReady, teachingGroupId, sessionDate, canView]);

  const selectSlot = useCallback(
    (slotId: number, blockNumber: number) => {
      setSelectedSlotId(slotId);
      setPeriod(blockNumber);
      void loadSession({ slotId, periodNum: blockNumber });
    },
    [loadSession],
  );

  const selectLegacyPeriod = useCallback(
    (periodNum: number) => {
      setPeriod(periodNum);
      setSelectedSlotId(null);
      void loadSession({ slotId: null, periodNum });
    },
    [loadSession],
  );

  const roster: RollSessionRosterEntry[] = session?.roster ?? [];
  const isHolidaySkip =
    session?.status === "SKIPPED" &&
    !!session.skip_reason &&
    session.skip_reason.startsWith("Holiday:");
  // A non-holiday SKIPPED session (almost always auto-skipped because
  // nobody submitted it by the cutoff time) can still be marked — that's
  // routine correction of a missed roll call, not a locked final state.
  // A holiday skip stays locked since the backend rejects marking on it.
  const isReopenableSkip = session?.status === "SKIPPED" && !isHolidaySkip;
  const isLocked = session?.status === "SUBMITTED" || isHolidaySkip;
  const canEdit = canMark && (session?.status === "DRAFT" || isReopenableSkip);

  const presentCount = useMemo(
    () => roster.filter((r) => marks[r.student.cc] === "PRESENT").length,
    [roster, marks],
  );

  const togglePresent = (cc: number) => {
    if (!canEdit) return;
    setMarks((prev) => {
      const next = { ...prev };
      if (next[cc] === "PRESENT") {
        delete next[cc]; // back to default (absent)
      } else {
        next[cc] = "PRESENT";
      }
      return next;
    });
  };

  const buildRecords = () =>
    roster.map((row) => ({
      student_cc: row.student.cc,
      status: marks[row.student.cc] ?? ("ABSENT" as RollRecordStatus),
    }));

  const handleSaveDraft = async () => {
    if (!session || !canEdit) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await attendanceService.updateRollSession(session.id, {
        records: buildRecords(),
      });
      applySession(updated);
      setSuccess("Draft saved.");
    } catch (err: unknown) {
      console.error(err);
      setError("Failed to save draft.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!session || !canEdit) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await attendanceService.updateRollSession(session.id, {
        records: buildRecords(),
        submit: true,
      });
      applySession(updated);
      setSuccess("Roll call submitted. Parents were notified if enabled by policy.");
    } catch (err: unknown) {
      console.error(err);
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || "Failed to submit roll call.");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    if (!session || !canMark || !skipReason.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await attendanceService.skipRollSession(session.id, skipReason.trim());
      applySession(updated);
      setShowSkip(false);
      setSkipReason("");
      setSuccess("Session marked as skipped.");
    } catch (err) {
      console.error(err);
      setError("Failed to skip session.");
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          You do not have permission to view A-Level roll call.
        </div>
      </div>
    );
  }

  const selectCls =
    "w-full h-11 px-3 pr-8 appearance-none bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-primary transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";
  const labelCls = "block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2";

  return (
    <div className="pb-28 sm:pb-6">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
              <span className="p-2 bg-primary/10 rounded-xl">
                <ClipboardList className="h-5 w-5 text-primary" />
              </span>
              A-Level Roll Call
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm ml-[46px]">
              Everyone defaults to absent — tap a student to mark them present.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadSession()}
            disabled={loading || daySlotsLoading || !isScopeReady}
            className="flex items-center justify-center h-10 w-10 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 active:bg-zinc-50 dark:active:bg-zinc-800 disabled:opacity-40 transition-all"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading || daySlotsLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 rounded-xl flex gap-2 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 rounded-xl flex gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            {success}
          </div>
        )}

        {isHolidaySkip && (
          <div className="p-3 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/50 text-sky-900 dark:text-sky-200 rounded-xl flex gap-2 items-start text-sm">
            <CalendarOff className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Roll call skipped — holiday / day off</p>
              <p className="text-sky-800/80 dark:text-sky-300/80 mt-0.5">{session?.skip_reason?.replace(/^Holiday:\s*/, "") ?? "Not a working day."}</p>
            </div>
          </div>
        )}

        {/* Scope card */}
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4 shadow-sm">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
            <MapPin className="w-3.5 h-3.5" />
            Gulistan-e-Jauhar Campus
          </span>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Class</label>
              <div className="relative">
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className={selectCls}
                >
                  <option value="">Select…</option>
                  {availableClasses.map((c) => (
                    <option key={c.id} value={c.id}>{c.class_code}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className={selectCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Teaching Group (subject)</label>
            <div className="relative">
              <select
                value={teachingGroupId}
                onChange={(e) => setTeachingGroupId(e.target.value)}
                disabled={!classId || groupsLoading}
                className={selectCls}
              >
                <option value="">{groupsLoading ? "Loading…" : "Select subject group…"}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.subjects?.name} — {g.employee_profiles?.full_name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
            </div>
            {classId && !groupsLoading && groups.length === 0 && (
              <p className="text-xs text-zinc-400 mt-1.5">No teaching groups set up for this class yet.</p>
            )}
          </div>

          {!timetableMode && teachingGroupId && (
            <div>
              <label className={labelCls}>Period</label>
              <select
                value={period}
                onChange={(e) => selectLegacyPeriod(Number(e.target.value))}
                disabled={daySlotsLoading}
                className={selectCls}
              >
                {LEGACY_PERIODS.map((p) => (
                  <option key={p} value={p}>Period {p}</option>
                ))}
              </select>
            </div>
          )}

          {timetableMode && (
            <div>
              <label className={labelCls}>Scheduled lessons</label>
              <div className="flex flex-wrap gap-2">
                {slotPills.map(({ slot, block, pillLabel }) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => selectSlot(slot.id, block.block_number)}
                    disabled={daySlotsLoading || loading}
                    className={`px-3 py-2 rounded-full text-xs font-semibold border transition-colors ${
                      selectedSlotId === slot.id
                        ? "bg-primary text-white border-primary"
                        : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                    }`}
                  >
                    {pillLabel}
                  </button>
                ))}
              </div>
            </div>
          )}

          {session && (
            <span
              className={`inline-flex px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                session.status === "SUBMITTED"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50"
                  : session.status === "SKIPPED"
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                    : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50"
              }`}
            >
              {session.status}
              {session.skip_reason ? ` — ${session.skip_reason}` : ""}
            </span>
          )}
        </div>

        {!isScopeReady ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 px-6 py-16 text-center">
            <p className="text-sm text-zinc-400 dark:text-zinc-500">
              Select class, teaching group, and date to begin roll call.
            </p>
          </div>
        ) : loading || daySlotsLoading ? (
          <div className="flex flex-col items-center py-16">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
              {daySlotsLoading ? "Loading schedule..." : "Loading roster..."}
            </p>
          </div>
        ) : !session ? null : (
          <>
            <div className="flex items-center justify-between px-1 gap-3">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                Tap a student to mark present
              </p>
              <div className="flex items-center gap-3">
                {canEdit && roster.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMarks({})}
                    disabled={presentCount === 0}
                    className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-40 disabled:no-underline"
                  >
                    Mark all absent
                  </button>
                )}
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  {presentCount} / {roster.length} present
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {roster.length === 0 ? (
                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-10 text-center text-zinc-500 dark:text-zinc-400 text-sm">
                  No students enrolled in this teaching group yet.
                </div>
              ) : (
                roster.map((row) => {
                  const isPresent = marks[row.student.cc] === "PRESENT";
                  return (
                    <button
                      key={row.student.cc}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => togglePresent(row.student.cc)}
                      className={`w-full flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors active:scale-[0.99] disabled:active:scale-100 ${
                        isPresent
                          ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800"
                          : "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                      } ${!canEdit ? "opacity-70" : ""}`}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{row.student.full_name}</p>
                        <p className="text-xs text-zinc-400 font-mono">GR# {row.student.gr_number ?? "—"}</p>
                      </div>
                      <span
                        className={`shrink-0 flex items-center justify-center h-9 w-9 rounded-full border-2 transition-colors ${
                          isPresent
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-transparent"
                        }`}
                      >
                        <Check className="h-5 w-5" />
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {showSkip && canMark && session.status === "DRAFT" && (
              <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Skip reason</label>
                <textarea
                  value={skipReason}
                  onChange={(e) => setSkipReason(e.target.value)}
                  rows={2}
                  className="w-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100"
                  placeholder="e.g. Teacher absent..."
                />
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={saving || !skipReason.trim()}
                  className="w-full py-2.5 text-sm font-semibold bg-zinc-800 dark:bg-zinc-700 text-white rounded-xl disabled:opacity-50"
                >
                  Confirm skip
                </button>
              </div>
            )}

            {isLocked && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center pb-2">
                {isHolidaySkip
                  ? "This day is marked as a holiday / day off, so attendance can't be recorded for it."
                  : "This session is locked. Contact an administrator with edit_locked permission to change submitted records."}
              </p>
            )}
          </>
        )}
      </div>

      {/* Sticky mobile action bar */}
      {canMark && (session?.status === "DRAFT" || isReopenableSkip) && roster.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 sm:static bg-white dark:bg-zinc-950 border-t sm:border-t-0 border-zinc-200 dark:border-zinc-800 p-3 sm:p-0 sm:mt-4 sm:max-w-3xl sm:mx-auto flex gap-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] sm:shadow-none">
          <button
            type="button"
            onClick={() => setShowSkip((v) => !v)}
            className="px-3 py-3 sm:py-2.5 text-sm border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:border-zinc-300 flex items-center gap-1.5 transition-colors"
          >
            <SkipForward className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving}
            className="flex-1 py-3 sm:py-2.5 text-sm border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-semibold hover:border-zinc-300 disabled:opacity-50 transition-colors"
          >
            Save draft
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-[2] py-3 sm:py-2.5 text-sm font-semibold rounded-xl bg-primary hover:opacity-90 text-white disabled:opacity-50 transition-opacity"
          >
            {saving ? "Submitting..." : "Submit roll call"}
          </button>
        </div>
      )}
    </div>
  );
}
