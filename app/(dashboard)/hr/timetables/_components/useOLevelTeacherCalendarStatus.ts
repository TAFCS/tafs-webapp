'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TimetableSlot } from '@/lib/timetables.service';
import {
  staffLessonReschedulesService,
  StaffLessonReschedule,
  type StaffLessonTeacherSlot,
} from '@/lib/staff-lesson-reschedules.service';
import { attendanceService, type TimelineDay } from '@/lib/attendance.service';
import {
  blockCellStatusKey,
  cellStatusKey,
  hasRecurringSlotOnDate,
  isValidRescheduleRow,
  MakeupCalendarOverlay,
  MakeupSlotCellStatus,
  resolveMakeupCellStatus,
  RescheduleCellRole,
  RescheduleLinkInfo,
  todayIsoUtc,
  weekDatesFromMonday,
} from '@/lib/makeup-calendar';

type TeacherHoldStatus = 'held' | 'missed' | 'off_day' | 'upcoming';

type HoldStatusPayload = {
  dates: Array<{
    date: string;
    hold_status?: TeacherHoldStatus;
    by_slot?: Array<{ slot_id: number; hold_status: TeacherHoldStatus }>;
  }>;
};

function mapTeacherHold(hold: TeacherHoldStatus) {
  if (hold === 'held') return 'held' as const;
  if (hold === 'upcoming') return 'upcoming' as const;
  if (hold === 'off_day') return 'off_day' as const;
  return 'missed' as const;
}

function baselineHoldForSlotDate(
  slot: TimetableSlot,
  dateIso: string,
  todayIso: string = todayIsoUtc(),
): TeacherHoldStatus {
  const dow = new Date(`${dateIso}T00:00:00.000Z`).getUTCDay();
  if (slot.day_of_week !== dow) return 'off_day';
  if (dateIso > todayIso) return 'upcoming';
  return 'missed';
}

function timelineDayPresent(day: TimelineDay): boolean {
  if (
    day.status === 'PRESENT' ||
    day.status === 'LATE' ||
    day.status === 'HALF_DAY'
  ) {
    return true;
  }
  return day.segments.some((s) => s.type === 'WORK' || s.type === 'OVERTIME');
}

async function buildHoldFromTimeline(
  employeeId: number,
  weekDates: string[],
  gridSlots: TimetableSlot[],
): Promise<HoldStatusPayload> {
  if (weekDates.length === 0) return { dates: [] };

  const todayIso = todayIsoUtc();
  const timeline = await attendanceService.getStaffTimeline(employeeId, {
    date_from: weekDates[0]!,
    date_to: weekDates[weekDates.length - 1]!,
  });
  const dayByDate = new Map(
    timeline.days.map((d) => [d.date.slice(0, 10), d]),
  );

  return {
    dates: weekDates.map((dateIso) => {
      const day = dayByDate.get(dateIso);
      const dow = new Date(`${dateIso}T00:00:00.000Z`).getUTCDay();
      const by_slot = gridSlots
        .filter((slot) => slot.day_of_week === dow)
        .map((slot) => {
          let hold_status: TeacherHoldStatus = 'missed';
          if (dateIso > todayIso) {
            hold_status = 'upcoming';
          } else if (day?.is_working_day === false) {
            hold_status = 'off_day';
          } else if (day && timelineDayPresent(day)) {
            hold_status = 'held';
          }
          return { slot_id: slot.id, hold_status };
        });
      return { date: dateIso, by_slot };
    }),
  };
}

function buildHoldByKey(
  holdStatus: HoldStatusPayload,
  slotIds: number[],
  gridSlots: TimetableSlot[],
  weekDates: string[],
) {
  const holdByKey = new Map<string, TeacherHoldStatus>();

  for (const slot of gridSlots) {
    for (const dateIso of weekDates) {
      holdByKey.set(
        cellStatusKey(slot.id, dateIso),
        baselineHoldForSlotDate(slot, dateIso),
      );
    }
  }

  for (const row of holdStatus.dates) {
    const dateIso = row.date.slice(0, 10);
    for (const slotId of slotIds) {
      const key = cellStatusKey(slotId, dateIso);
      const slotHold =
        row.by_slot?.find((s) => s.slot_id === slotId)?.hold_status ??
        (slotIds.length === 1 ? row.hold_status : undefined);
      if (slotHold) holdByKey.set(key, slotHold);
    }
  }

  return holdByKey;
}

function staffOverlayStatus(
  row: StaffLessonReschedule,
  todayIso: string = todayIsoUtc(),
): MakeupSlotCellStatus {
  if (row.status === 'COMPLETED') return 'made_up';
  const makeupIso = row.makeup_date.slice(0, 10);
  if (makeupIso >= todayIso) return 'makeup_upcoming';
  return 'missed';
}

function buildMaps(
  reschedules: StaffLessonReschedule[],
  holdStatus: HoldStatusPayload,
  slotIds: number[],
  gridSlots: TimetableSlot[],
  weekDates: string[],
) {
  const holdByKey = buildHoldByKey(holdStatus, slotIds, gridSlots, weekDates);

  const rescheduleByKey = new Map<string, RescheduleCellRole>();
  const makeupOverlays: MakeupCalendarOverlay[] = [];
  const rescheduleLinksByCell: Record<string, RescheduleLinkInfo> = {};

  for (const row of reschedules) {
    if (row.status === 'CANCELLED') continue;

    const src = row.source_date.slice(0, 10);
    const makeup = row.makeup_date.slice(0, 10);
    const makeupPeriod =
      row.makeup_period ??
      row.makeup_timetable_slot?.block_number ??
      row.source_timetable_slot?.block_number ??
      1;

    const linkBase = {
      rescheduleId: row.id,
      sourceDate: src,
      makeupDate: makeup,
      makeupPeriod,
      status: (row.status === 'COMPLETED' ? 'COMPLETED' : 'SCHEDULED') as
        | 'SCHEDULED'
        | 'COMPLETED',
    };

    rescheduleLinksByCell[cellStatusKey(row.source_timetable_slot_id, src)] = {
      ...linkBase,
      role: 'source',
    };

    const makeupSlotKey =
      row.makeup_timetable_slot_id != null &&
      hasRecurringSlotOnDate(gridSlots, makeup, makeupPeriod)
        ? cellStatusKey(row.makeup_timetable_slot_id, makeup)
        : blockCellStatusKey(makeupPeriod, makeup);
    rescheduleLinksByCell[makeupSlotKey] = {
      ...linkBase,
      role: 'makeup',
    };

    const sourceKey = cellStatusKey(row.source_timetable_slot_id, src);
    if (row.status === 'COMPLETED') {
      rescheduleByKey.set(sourceKey, { role: 'source', status: 'COMPLETED' });
    } else if (
      isValidRescheduleRow(
        { source_date: src, makeup_date: makeup, status: row.status },
      ) &&
      holdByKey.get(sourceKey) !== 'held'
    ) {
      rescheduleByKey.set(sourceKey, { role: 'source', status: 'SCHEDULED' });
    }

    if (!weekDates.includes(makeup)) continue;

    const overlayStatus = staffOverlayStatus(row);
    const onRecurringCell =
      row.makeup_timetable_slot_id != null &&
      hasRecurringSlotOnDate(gridSlots, makeup, makeupPeriod);

    if (onRecurringCell && row.makeup_timetable_slot_id != null) {
      rescheduleByKey.set(cellStatusKey(row.makeup_timetable_slot_id, makeup), {
        role: 'makeup',
        status: row.status === 'COMPLETED' ? 'COMPLETED' : 'SCHEDULED',
      });
    } else {
      const next: MakeupCalendarOverlay = {
        dateIso: makeup,
        blockNumber: makeupPeriod,
        status: overlayStatus,
        rescheduleId: row.id,
      };
      const existing = makeupOverlays.find(
        (o) => o.dateIso === makeup && o.blockNumber === makeupPeriod,
      );
      if (
        !existing ||
        overlayStatus === 'made_up' ||
        (overlayStatus === 'makeup_upcoming' &&
          (existing.status === 'missed' || existing.status === 'upcoming'))
      ) {
        if (existing) {
          makeupOverlays[makeupOverlays.indexOf(existing)] = next;
        } else {
          makeupOverlays.push(next);
        }
      }
    }
  }

  const statusPatch: Record<string, MakeupSlotCellStatus> = {};

  for (const [key, slotHold] of holdByKey) {
    if (slotHold === 'off_day') continue;
    statusPatch[key] = resolveMakeupCellStatus(
      mapTeacherHold(slotHold),
      rescheduleByKey.get(key),
    );
  }

  for (const overlay of makeupOverlays) {
    statusPatch[blockCellStatusKey(overlay.blockNumber, overlay.dateIso)] =
      overlay.status;
  }

  return {
    statusPatch,
    makeupOverlays,
    rescheduleLinksByCell,
  };
}

interface Options {
  employeeId: number | null;
  teacherSlots: StaffLessonTeacherSlot[];
  gridSlots: TimetableSlot[];
  weekMondayIso: string;
  academicYear?: string;
  enabled: boolean;
}

export function useOLevelTeacherCalendarStatus({
  employeeId,
  teacherSlots,
  gridSlots,
  weekMondayIso,
  academicYear,
  enabled,
}: Options) {
  const weekDates = useMemo(
    () => weekDatesFromMonday(weekMondayIso),
    [weekMondayIso],
  );

  const slotIds = useMemo(() => teacherSlots.map((s) => s.id), [teacherSlots]);
  const slotIdsKey = useMemo(() => slotIds.join(','), [slotIds]);
  const weekDatesKey = useMemo(() => weekDates.join(','), [weekDates]);
  const gridSlotsKey = useMemo(
    () => gridSlots.map((s) => `${s.id}:${s.day_of_week}:${s.block_number}`).join(','),
    [gridSlots],
  );

  const [statusByCell, setStatusByCell] = useState<
    Record<string, MakeupSlotCellStatus>
  >({});
  const [makeupOverlays, setMakeupOverlays] = useState<MakeupCalendarOverlay[]>(
    [],
  );
  const [rescheduleLinksByCell, setRescheduleLinksByCell] = useState<
    Record<string, RescheduleLinkInfo>
  >({});
  const [initialLoading, setInitialLoading] = useState(false);
  const [weekRefreshing, setWeekRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reschedulesCache = useRef<{
    employeeId: number;
    rows: StaffLessonReschedule[];
  } | null>(null);
  const loadSeq = useRef(0);
  const hasLoadedOnce = useRef(false);

  const fetchReschedules = useCallback(
    async (force = false) => {
      if (!employeeId) return [] as StaffLessonReschedule[];
      if (
        !force &&
        reschedulesCache.current?.employeeId === employeeId
      ) {
        return reschedulesCache.current.rows;
      }
      const rows = await staffLessonReschedulesService.list({
        employee_id: employeeId,
      });
      reschedulesCache.current = { employeeId, rows };
      return rows;
    },
    [employeeId],
  );

  const loadWeek = useCallback(
    async (dates: string[], reschedules: StaffLessonReschedule[]) => {
      const emptyHold: HoldStatusPayload = { dates: [] };

      if (!employeeId || slotIds.length === 0 || dates.length === 0) {
        return buildMaps(reschedules, emptyHold, slotIds, gridSlots, dates);
      }

      let holdStatus: HoldStatusPayload = emptyHold;
      try {
        holdStatus = await staffLessonReschedulesService.getTeacherHoldStatus(
          employeeId,
          {
            source_timetable_slot_ids: slotIds.join(','),
            dates: dates.join(','),
            ...(academicYear ? { academic_year: academicYear } : {}),
          },
        );
      } catch {
        try {
          holdStatus = await buildHoldFromTimeline(employeeId, dates, gridSlots);
        } catch {
          holdStatus = emptyHold;
        }
      }

      if (holdStatus.dates.length === 0) {
        try {
          holdStatus = await buildHoldFromTimeline(employeeId, dates, gridSlots);
        } catch {
          // keep empty hold; baseline missed/upcoming still applies
        }
      }

      return buildMaps(reschedules, holdStatus, slotIds, gridSlots, dates);
    },
    [employeeId, slotIdsKey, gridSlotsKey, slotIds, gridSlots, academicYear],
  );

  const applyWeekResult = useCallback((result: ReturnType<typeof buildMaps>) => {
    setStatusByCell(result.statusPatch);
    setMakeupOverlays(result.makeupOverlays);
    setRescheduleLinksByCell(result.rescheduleLinksByCell);
  }, []);

  useEffect(() => {
    if (!enabled || !employeeId || slotIds.length === 0) {
      setStatusByCell({});
      setMakeupOverlays([]);
      setRescheduleLinksByCell({});
      setError(null);
      setInitialLoading(false);
      setWeekRefreshing(false);
      reschedulesCache.current = null;
      hasLoadedOnce.current = false;
      return;
    }

    const seq = ++loadSeq.current;
    const isFirstLoad = !hasLoadedOnce.current;
    if (isFirstLoad) setInitialLoading(true);
    else setWeekRefreshing(true);
    setError(null);

    void (async () => {
      let reschedules: StaffLessonReschedule[] = [];
      try {
        reschedules = await fetchReschedules();
        if (seq !== loadSeq.current) return;
        const result = await loadWeek(weekDates, reschedules);
        if (seq !== loadSeq.current) return;
        applyWeekResult(result);
        hasLoadedOnce.current = true;
      } catch (err) {
        if (seq !== loadSeq.current) return;
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? 'Could not load teacher calendar status.';
        setError(message);
        applyWeekResult(
          buildMaps(reschedules, { dates: [] }, slotIds, gridSlots, weekDates),
        );
      } finally {
        if (seq === loadSeq.current) {
          setInitialLoading(false);
          setWeekRefreshing(false);
        }
      }
    })();
  }, [
    enabled,
    employeeId,
    slotIdsKey,
    weekDatesKey,
    fetchReschedules,
    loadWeek,
    applyWeekResult,
  ]);

  const refresh = useCallback(async () => {
    if (!enabled || !employeeId || slotIds.length === 0) return;
    setWeekRefreshing(true);
    setError(null);
    let reschedules: StaffLessonReschedule[] = [];
    try {
      reschedules = await fetchReschedules(true);
      const result = await loadWeek(weekDates, reschedules);
      applyWeekResult(result);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Could not load teacher calendar status.';
      setError(message);
      applyWeekResult(
        buildMaps(reschedules, { dates: [] }, slotIds, gridSlots, weekDates),
      );
    } finally {
      setWeekRefreshing(false);
    }
  }, [
    enabled,
    employeeId,
    slotIds,
    gridSlots,
    weekDates,
    fetchReschedules,
    loadWeek,
    applyWeekResult,
  ]);

  return {
    weekDates,
    statusByCell,
    makeupOverlays,
    rescheduleLinksByCell,
    loading: initialLoading,
    weekRefreshing,
    error,
    refresh,
  };
}

export function teacherSlotToGridSlot(
  slot: StaffLessonTeacherSlot,
  employeeId: number,
  employeeName: string | null,
): TimetableSlot {
  return {
    id: slot.id,
    timetable_id: slot.timetable_id,
    day_of_week: slot.day_of_week,
    block_number: slot.block_number,
    slot_order: 1,
    subject_id: slot.subject.id,
    employee_id: employeeId,
    room: null,
    subjects: {
      id: slot.subject.id,
      name: `${slot.subject.name} · ${slot.class_code} ${slot.section_code}`,
      code: slot.subject.code,
      academic_system: null,
    },
    employee_profiles: {
      id: employeeId,
      full_name: employeeName,
      employee_code: null,
    },
  };
}

export function syntheticTeacherBlocks(maxBlock: number) {
  return Array.from({ length: maxBlock }, (_, i) => ({
    block_number: i + 1,
    start_time: new Date(Date.UTC(1970, 0, 1, 7 + i, 0)).toISOString(),
    end_time: new Date(Date.UTC(1970, 0, 1, 8 + i, 0)).toISOString(),
    is_break: false,
    label: `Period ${i + 1}`,
  }));
}
