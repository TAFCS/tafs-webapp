"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarOff,
  CheckCircle2,
  ClipboardList,
  Loader2,
  RefreshCw,
  SkipForward,
  MapPin,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCampuses } from "@/store/slices/campusesSlice";
import { useAuthState } from "@/context/AuthContext";
import { ScopeBlock, ScopeValue } from "../../studentwise-fees/components/ScopeBlock";
import {
  attendanceService,
  RollRecordStatus,
  RollSession,
  RollSessionRosterEntry,
} from "@/lib/attendance.service";
import { DaySlotsResponse, timetablesService } from "@/lib/timetables.service";
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

  const [scope, setScope] = useState<ScopeValue>({
    campusId: lockedCampusId,
    classId: "",
    sectionId: "",
  });
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

  useEffect(() => {
    if (lockedCampusId && scope.campusId !== lockedCampusId) {
      setScope((s) => ({ ...s, campusId: lockedCampusId }));
    }
  }, [lockedCampusId, scope.campusId]);

  // Clear class/section if selection is not AS/A2 (e.g. after campus change)
  useEffect(() => {
    if (!scope.campusId || !scope.classId) return;
    const campus = campuses.find((c) => String(c.id) === scope.campusId);
    const cls = campus?.offered_classes?.find((c) => String(c.id) === scope.classId);
    if (cls && !isAsA2Class(cls)) {
      setScope((s) => ({ ...s, classId: "", sectionId: "" }));
    }
  }, [scope.campusId, scope.classId, campuses]);

  const isScopeReady =
    !!scope.campusId && !!scope.classId && !!scope.sectionId && !!sessionDate;

  const slotPills =
    daySlots?.blocks.flatMap((block) =>
      block.slots.map((slot) => ({
        slot,
        block,
        pillLabel: `${blockLabel(block)} — ${slot.subject.name} (${slot.employee.full_name ?? "TBA"})`,
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
        const campusId = Number(scope.campusId);
        const classId = Number(scope.classId);
        const sectionId = Number(scope.sectionId);

        const existing = await attendanceService.listRollSessions({
          date: sessionDate,
          campus_id: campusId,
          class_id: classId,
          section_id: sectionId,
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
            class_id: classId,
            section_id: sectionId,
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
      scope,
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
        const data = await timetablesService.getDaySlots({
          campus_id: Number(scope.campusId),
          class_id: Number(scope.classId),
          section_id: Number(scope.sectionId),
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
  }, [
    isScopeReady,
    scope.campusId,
    scope.classId,
    scope.sectionId,
    sessionDate,
    canView,
  ]);

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
  const isLocked = session?.status === "SUBMITTED" || session?.status === "SKIPPED";
  const canEdit = canMark && session?.status === "DRAFT";
  const isHolidaySkip =
    session?.status === "SKIPPED" &&
    !!session.skip_reason &&
    session.skip_reason.startsWith("Holiday:");

  const setMark = (cc: number, status: RollRecordStatus) => {
    if (!canEdit) return;
    setMarks((prev) => ({ ...prev, [cc]: status }));
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
    const unmarked = roster.filter((r) => !marks[r.student.cc]);
    if (unmarked.length > 0) {
      setError(`Mark all students before submit (${unmarked.length} unmarked).`);
      return;
    }
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
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-slate-600">You do not have permission to view A-Level roll call.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
            <ClipboardList className="h-6 w-6 text-amber-600" />
            A-Level Roll Call
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Mark present/absent at end of class for AS and A2 sections (roll call mode).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadSession()}
          disabled={loading || daySlotsLoading || !isScopeReady}
          className="mt-3 md:mt-0 flex items-center gap-2 px-4 py-2 text-sm border rounded-lg bg-white hover:bg-slate-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading || daySlotsLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg flex gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="text-sm">{success}</span>
        </div>
      )}

      {isHolidaySkip && (
        <div className="p-4 bg-sky-50 border border-sky-200 text-sky-900 rounded-lg flex gap-3 items-start">
          <CalendarOff className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Roll call skipped — holiday / day off</p>
            <p className="text-sky-800/80 mt-1">{session?.skip_reason?.replace(/^Holiday:\s*/, "") ?? "This date is not a working day for this class."}</p>
            <p className="text-sky-700/70 mt-1">Attendance marking is disabled for this session.</p>
          </div>
        </div>
      )}

      <div className="bg-white border rounded-xl p-5 space-y-4 shadow-sm">
        {/* Campus – Permanent Badge */}
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            <MapPin className="w-3.5 h-3.5" />
            Gulistan-e-Jauhar Campus
          </span>
          <span className="text-zinc-400 text-xs">·</span>
          <span className="text-zinc-400 text-xs">Campus is fixed</span>
        </div>

        <ScopeBlock
          value={scope}
          onChange={(v) => {
            setScope(v);
            setSession(null);
          }}
          filterClass={isAsA2Class}
          lockCampusId={Number(lockedCampusId)}
          allowedClassIds={user?.allowedClassIds?.length ? user.allowedClassIds : undefined}
          requireClassAndSection
          hideCampusSelect={true}
        />
        <div className="grid grid-cols-1 gap-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 mb-1.5">Date</label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="w-full h-10 px-3 border rounded-xl text-sm"
              />
            </div>
            {!timetableMode && (
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 mb-1.5">Period</label>
                <select
                  value={period}
                  onChange={(e) => selectLegacyPeriod(Number(e.target.value))}
                  disabled={daySlotsLoading}
                  className="w-full h-10 px-3 border rounded-xl text-sm"
                >
                  {LEGACY_PERIODS.map((p) => (
                    <option key={p} value={p}>
                      Period {p}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {session && (
              <div className={`${timetableMode ? "col-span-2" : "col-span-2"} flex items-end`}>
                <span
                  className={`inline-flex px-3 py-1.5 rounded-full text-xs font-semibold ${
                    session.status === "SUBMITTED"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : session.status === "SKIPPED"
                        ? "bg-slate-100 text-slate-600 border border-slate-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}
                >
                  {session.status}
                  {session.skip_reason ? ` — ${session.skip_reason}` : ""}
                </span>
              </div>
            )}
          </div>
          {timetableMode && (
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 mb-1.5">
                Scheduled lessons
              </label>
              <div className="flex flex-wrap gap-2">
                {slotPills.map(({ slot, block, pillLabel }) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => selectSlot(slot.id, block.block_number)}
                    disabled={daySlotsLoading || loading}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      selectedSlotId === slot.id
                        ? "bg-amber-600 text-white border-amber-600"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-amber-50"
                    }`}
                  >
                    {pillLabel}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {!isScopeReady ? (
        <p className="text-sm text-slate-500 text-center py-12">
          Select campus, class, and section to begin roll call.
        </p>
      ) : loading || daySlotsLoading ? (
        <div className="flex flex-col items-center py-16">
          <Loader2 className="h-8 w-8 text-amber-600 animate-spin" />
          <p className="text-sm text-slate-500 mt-2">
            {daySlotsLoading ? "Loading schedule..." : "Loading roster..."}
          </p>
        </div>
      ) : !session ? null : (
        <>
          <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 border-b text-xs font-semibold text-slate-500 uppercase">
                  <th className="px-6 py-3">GR</th>
                  <th className="px-6 py-3">Student</th>
                  <th className="px-6 py-3 text-right">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {roster.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-10 text-center text-slate-500">
                      No enrolled students in this section.
                    </td>
                  </tr>
                ) : (
                  roster.map((row) => {
                    const status = marks[row.student.cc];
                    return (
                      <tr key={row.student.cc} className="hover:bg-slate-50/50">
                        <td className="px-6 py-3 font-mono text-slate-600">
                          {row.student.gr_number ?? "—"}
                        </td>
                        <td className="px-6 py-3 font-medium">{row.student.full_name}</td>
                        <td className="px-6 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => setMark(row.student.cc, "PRESENT")}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                                status === "PRESENT"
                                  ? "bg-emerald-600 text-white"
                                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              } disabled:opacity-40`}
                            >
                              Present
                            </button>
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => setMark(row.student.cc, "ABSENT")}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                                status === "ABSENT"
                                  ? "bg-rose-600 text-white"
                                  : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                              } disabled:opacity-40`}
                            >
                              Absent
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {canMark && session.status === "DRAFT" && (
            <div className="flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowSkip((v) => !v)}
                className="px-4 py-2 text-sm border rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-2"
              >
                <SkipForward className="h-4 w-4" />
                Mark as skipped
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={saving}
                className="px-4 py-2 text-sm border rounded-lg bg-white hover:bg-slate-50"
              >
                Save draft
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="px-5 py-2 text-sm font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {saving ? "Submitting..." : "Submit roll call"}
              </button>
            </div>
          )}

          {showSkip && canMark && session.status === "DRAFT" && (
            <div className="bg-slate-50 border rounded-xl p-4 space-y-3">
              <label className="block text-sm font-medium text-slate-700">Skip reason</label>
              <textarea
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. Public holiday, teacher absent..."
              />
              <button
                type="button"
                onClick={handleSkip}
                disabled={saving || !skipReason.trim()}
                className="px-4 py-2 text-sm bg-slate-700 text-white rounded-lg disabled:opacity-50"
              >
                Confirm skip
              </button>
            </div>
          )}

          {isLocked && (
            <p className="text-xs text-slate-500 text-center">
              This session is locked. Contact an administrator with edit_locked permission to
              change submitted records.
            </p>
          )}
        </>
      )}
    </div>
  );
}
