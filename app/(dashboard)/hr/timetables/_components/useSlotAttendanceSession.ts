'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TimetableSlot } from '@/lib/timetables.service';
import {
  attendanceService,
  RollRecordStatus,
  RollSession,
  RollSessionRosterEntry,
} from '@/lib/attendance.service';
import { classReschedulesService } from '@/lib/class-reschedules.service';
import type { MakeupSlotCellStatus, RescheduleLinkInfo } from '@/lib/makeup-calendar';
import type { SourceDatePresentStudent } from '@/lib/class-reschedules.service';

interface Options {
  active: boolean;
  slot: TimetableSlot | null;
  dateIso: string;
  campusId: number;
  classId: number;
  teachingGroupId: number;
  cellStatus: MakeupSlotCellStatus | null;
  rescheduleLink?: RescheduleLinkInfo;
  initialPresentStudents?: SourceDatePresentStudent[];
  canMark: boolean;
  onSaved: () => void;
}

function normalizeIsoDate(value: string): string | null {
  if (!value) return null;
  const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function useSlotAttendanceSession({
  active,
  slot,
  dateIso: initialDateIso,
  campusId,
  classId,
  teachingGroupId,
  cellStatus,
  rescheduleLink,
  initialPresentStudents = [],
  canMark,
  onSaved,
}: Options) {
  const normalizedInitial = normalizeIsoDate(initialDateIso) ?? '';
  const [sessionDate, setSessionDate] = useState(normalizedInitial);
  const [session, setSession] = useState<RollSession | null>(null);
  const [marks, setMarks] = useState<Record<number, RollRecordStatus>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reverting, setReverting] = useState(false);
  const loadSeq = useRef(0);
  const reschedulesCache = useRef<{
    teachingGroupId: number;
    rows: Awaited<ReturnType<typeof classReschedulesService.list>>;
  } | null>(null);

  const applySession = useCallback(
    (s: RollSession, prefillPresent?: SourceDatePresentStudent[]) => {
      setSession(s);
      const next: Record<number, RollRecordStatus> = {};
      let hasRecord = false;
      for (const row of s.roster ?? []) {
        if (row.record?.status) {
          next[row.student.cc] = row.record.status;
          hasRecord = true;
        }
      }
      if (!hasRecord && prefillPresent?.length) {
        const ccSet = new Set(prefillPresent.map((p) => p.cc));
        const grSet = new Set(
          prefillPresent.map((p) => p.gr_number).filter(Boolean) as string[],
        );
        for (const row of s.roster ?? []) {
          if (
            ccSet.has(row.student.cc) ||
            (row.student.gr_number && grSet.has(row.student.gr_number))
          ) {
            next[row.student.cc] = 'PRESENT';
          }
        }
      }
      setMarks(next);
    },
    [],
  );

  useEffect(() => {
    if (active && slot) {
      setSessionDate(normalizeIsoDate(initialDateIso) ?? '');
    }
  }, [active, slot, initialDateIso]);

  const loadSession = useCallback(
    async (dateToLoad: string) => {
      const dateIso = normalizeIsoDate(dateToLoad);
      if (!active || !slot || !dateIso) return;

      const seq = ++loadSeq.current;
      setLoading(true);
      setError(null);
      setSuccess(null);

      try {
        let reschedules = reschedulesCache.current?.rows;
        if (reschedulesCache.current?.teachingGroupId !== teachingGroupId || !reschedules) {
          reschedules = await classReschedulesService.list({
            teaching_group_id: teachingGroupId,
          });
          reschedulesCache.current = { teachingGroupId, rows: reschedules };
        }

        const asSource = reschedules.find(
          (row) =>
            row.status !== 'CANCELLED' &&
            row.source_timetable_slot_id === slot.id &&
            row.source_date.slice(0, 10) === dateIso,
        );
        const asMakeup = reschedules.find(
          (row) =>
            row.status !== 'CANCELLED' &&
            row.makeup_date.slice(0, 10) === dateIso &&
            (row.makeup_timetable_slot_id === slot.id ||
              row.source_timetable_slot_id === slot.id ||
              row.makeup_period === slot.block_number),
        );

        const isMakeupAttendance =
          cellStatus === 'makeup_upcoming' ||
          cellStatus === 'made_up' ||
          rescheduleLink?.role === 'makeup' ||
          Boolean(asMakeup);

        const linkedSessionId =
          asMakeup?.makeup_roll_session_id ??
          asSource?.source_roll_session_id ??
          null;

        let activeSession: RollSession | null = null;

        if (linkedSessionId) {
          activeSession = await attendanceService.getRollSession(linkedSessionId);
        } else {
          const makeupPeriod = asMakeup?.makeup_period ?? slot.block_number;
          const listParams: {
            date: string;
            campus_id: number;
            class_id: number;
            teaching_group_id: number;
            period: number;
            timetable_slot_id?: number;
          } = {
            date: dateIso,
            campus_id: campusId,
            class_id: classId,
            teaching_group_id: teachingGroupId,
            period: makeupPeriod,
          };
          if (!isMakeupAttendance || asMakeup?.makeup_timetable_slot_id != null) {
            const slotIdForQuery =
              asMakeup?.makeup_timetable_slot_id ?? slot.id;
            const slotDow = slot.day_of_week;
            const sessionDow = new Date(`${dateIso}T00:00:00.000Z`).getUTCDay();
            if (!isMakeupAttendance || slotDow === sessionDow) {
              listParams.timetable_slot_id = slotIdForQuery;
            }
          }

          const existing = await attendanceService.listRollSessions(listParams);

          activeSession =
            existing.find((s) => {
              if (asMakeup?.makeup_roll_session_id) {
                return s.id === asMakeup.makeup_roll_session_id;
              }
              if (isMakeupAttendance && asMakeup?.makeup_timetable_slot_id == null) {
                return (
                  s.timetable_slot_id == null &&
                  s.period === makeupPeriod &&
                  s.session_date.slice(0, 10) === dateIso
                );
              }
              return (
                s.timetable_slot_id === slot.id ||
                (s.timetable_slot_id == null && s.period === makeupPeriod)
              );
            }) ?? null;

          if (!activeSession && canMark) {
            if (isMakeupAttendance) {
              if (seq !== loadSeq.current) return;
              setSession(null);
              setMarks({});
              setError(
                'Makeup roll session not found. Refresh the page or re-schedule the makeup class.',
              );
              return;
            }
            activeSession = await attendanceService.createRollSession({
              session_date: dateIso,
              campus_id: campusId,
              class_id: classId,
              teaching_group_id: teachingGroupId,
              period: slot.block_number,
              ...(slot.day_of_week === new Date(`${dateIso}T00:00:00.000Z`).getUTCDay()
                ? { timetable_slot_id: slot.id }
                : {}),
            });
          } else if (activeSession) {
            activeSession = await attendanceService.getRollSession(activeSession.id);
          }
        }

        if (seq !== loadSeq.current) return;

        if (!activeSession) {
          setSession(null);
          setMarks({});
          setError('No roll session available. You need mark permission to create one.');
          return;
        }

        const prefill =
          dateIso === normalizeIsoDate(initialDateIso) &&
          (cellStatus === 'conducted' ||
            cellStatus === 'made_up' ||
            cellStatus === 'makeup_upcoming' ||
            cellStatus === 'rescheduled')
            ? initialPresentStudents
            : undefined;
        applySession(activeSession, prefill);
      } catch (err: unknown) {
        if (seq !== loadSeq.current) return;
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data
            ?.message;
        setError(msg || 'Failed to load attendance session.');
        setSession(null);
      } finally {
        if (seq === loadSeq.current) {
          setLoading(false);
        }
      }
    },
    [
      active,
      slot,
      campusId,
      classId,
      teachingGroupId,
      canMark,
      applySession,
      initialDateIso,
      cellStatus,
      rescheduleLink,
      initialPresentStudents,
    ],
  );

  useEffect(() => {
    if (!active || !slot) {
      setSession(null);
      setMarks({});
      setError(null);
      setSuccess(null);
      return;
    }
    const dateIso = normalizeIsoDate(sessionDate);
    if (!dateIso) return;
    void loadSession(dateIso);
  }, [active, slot, sessionDate, loadSession]);

  const roster: RollSessionRosterEntry[] = session?.roster ?? [];
  const isLocked = session?.status === 'SUBMITTED' || session?.status === 'SKIPPED';
  const canEdit = canMark && session?.status === 'DRAFT';

  const presentCount = useMemo(
    () => roster.filter((r) => marks[r.student.cc] === 'PRESENT').length,
    [roster, marks],
  );

  const togglePresent = (cc: number) => {
    if (!canEdit) return;
    setMarks((prev) => {
      const next = { ...prev };
      if (next[cc] === 'PRESENT') delete next[cc];
      else next[cc] = 'PRESENT';
      return next;
    });
  };

  const buildRecords = () =>
    roster.map((row) => ({
      student_cc: row.student.cc,
      status: marks[row.student.cc] ?? ('ABSENT' as RollRecordStatus),
    }));

  const handleSave = async (submit: boolean) => {
    if (!session || !canEdit) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await attendanceService.updateRollSession(session.id, {
        records: buildRecords(),
        ...(submit ? { submit: true } : {}),
      });
      applySession(updated);
      setSuccess(submit ? 'Attendance submitted.' : 'Draft saved.');
      onSaved();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to save attendance.');
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = async () => {
    if (!session || !canMark || session.status !== 'SUBMITTED') return;
    setReverting(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await attendanceService.revertRollSession(session.id);
      applySession(updated);
      setMarks({});
      reschedulesCache.current = null;
      setSuccess('Attendance reverted. You can mark again.');
      onSaved();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to revert attendance.');
    } finally {
      setReverting(false);
    }
  };

  const canRevert = canMark && session?.status === 'SUBMITTED';

  return {
    sessionDate,
    setSessionDate: (value: string) => {
      const normalized = normalizeIsoDate(value);
      if (normalized) setSessionDate(normalized);
    },
    session,
    roster,
    marks,
    loading,
    saving,
    error,
    success,
    isLocked,
    canEdit,
    presentCount,
    togglePresent,
    handleSave,
    handleRevert,
    canRevert,
    reverting,
  };
}
