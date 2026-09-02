'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  classReschedulesService,
  ClassReschedule,
  SourceDatePresentStudent,
} from '@/lib/class-reschedules.service';
import {
  cellStatusKey,
  isValidRescheduleRow,
  MakeupSlotCellStatus,
  resolveMakeupCellStatus,
  RescheduleCellRole,
  weekDatesFromMonday,
} from '@/lib/makeup-calendar';

interface Options {
  teachingGroupId: number | null;
  slotIds: number[];
  weekMondayIso: string;
  enabled: boolean;
}

function buildMaps(
  reschedules: ClassReschedule[],
  holdStatus: Awaited<ReturnType<typeof classReschedulesService.getSourceDateHoldStatus>>,
  slotIds: number[],
) {
  const holdByKey = new Map<string, string>();
  for (const row of holdStatus.dates) {
    for (const slotId of slotIds) {
      const key = cellStatusKey(slotId, row.date);
      const slotHold =
        row.by_slot?.find((s) => s.slot_id === slotId)?.hold_status ??
        (slotIds.length === 1 ? row.hold_status : undefined);
      if (slotHold) holdByKey.set(key, slotHold);
    }
  }

  const validPendingSlotIds = new Set<number>();
  const rescheduleByKey = new Map<string, RescheduleCellRole>();
  for (const row of reschedules) {
    if (!isValidRescheduleRow(row)) continue;

    const src = row.source_date.slice(0, 10);
    const sourceKey = cellStatusKey(row.source_timetable_slot_id, src);
    if (holdByKey.get(sourceKey) !== 'held') {
      rescheduleByKey.set(sourceKey, {
        role: 'source',
        status: row.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
      });
    }

    const makeup = row.makeup_date.slice(0, 10);
    const makeupSlotId = row.makeup_timetable_slot_id ?? row.source_timetable_slot_id;
    rescheduleByKey.set(cellStatusKey(makeupSlotId, makeup), {
      role: 'makeup',
      status: row.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
    });

    if (row.status === 'PENDING') {
      validPendingSlotIds.add(row.source_timetable_slot_id);
    }
  }

  const statusPatch: Record<string, MakeupSlotCellStatus> = {};
  const presentPatch: Record<string, SourceDatePresentStudent[]> = {};

  for (const row of holdStatus.dates) {
    for (const slotId of slotIds) {
      const key = cellStatusKey(slotId, row.date);
      const slotHold =
        row.by_slot?.find((s) => s.slot_id === slotId)?.hold_status ??
        (slotIds.length === 1 ? row.hold_status : undefined);

      if (!slotHold) continue;

      statusPatch[key] = resolveMakeupCellStatus(slotHold, rescheduleByKey.get(key));

      const present = row.present_by_slot?.find((p) => p.slot_id === slotId);
      if (present?.students?.length) {
        presentPatch[key] = present.students;
      }
    }
  }

  return {
    statusPatch,
    presentPatch,
    pendingSlotIds: [...validPendingSlotIds],
  };
}

export function useMakeupCalendarStatus({
  teachingGroupId,
  slotIds,
  weekMondayIso,
  enabled,
}: Options) {
  const weekDates = useMemo(
    () => weekDatesFromMonday(weekMondayIso),
    [weekMondayIso],
  );

  const slotIdsKey = useMemo(() => slotIds.join(','), [slotIds]);
  const weekDatesKey = useMemo(() => weekDates.join(','), [weekDates]);

  const [statusByCell, setStatusByCell] = useState<Record<string, MakeupSlotCellStatus>>({});
  const [presentByCell, setPresentByCell] = useState<
    Record<string, SourceDatePresentStudent[]>
  >({});
  const [pendingSlotIds, setPendingSlotIds] = useState<number[]>([]);
  const [initialLoading, setInitialLoading] = useState(false);
  const [weekRefreshing, setWeekRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reschedulesCache = useRef<{ teachingGroupId: number; rows: ClassReschedule[] } | null>(
    null,
  );
  const loadSeq = useRef(0);
  const hasLoadedOnce = useRef(false);

  const fetchReschedules = useCallback(async (force = false) => {
    if (!teachingGroupId) return [] as ClassReschedule[];
    if (
      !force &&
      reschedulesCache.current?.teachingGroupId === teachingGroupId
    ) {
      return reschedulesCache.current.rows;
    }
    const rows = await classReschedulesService.list({
      teaching_group_id: teachingGroupId,
    });
    reschedulesCache.current = { teachingGroupId, rows };
    return rows;
  }, [teachingGroupId]);

  const loadWeek = useCallback(
    async (dates: string[], reschedules: ClassReschedule[]) => {
      if (!teachingGroupId || slotIds.length === 0 || dates.length === 0) {
        return;
      }

      const holdStatus = await classReschedulesService.getSourceDateHoldStatus({
        teaching_group_id: teachingGroupId,
        source_timetable_slot_ids: slotIds.join(','),
        dates: dates.join(','),
      });

      return buildMaps(reschedules, holdStatus, slotIds);
    },
    [teachingGroupId, slotIdsKey],
  );

  const applyWeekResult = useCallback(
    (result: ReturnType<typeof buildMaps> | undefined) => {
      if (!result) return;
      setStatusByCell((prev) => ({ ...prev, ...result.statusPatch }));
      setPresentByCell((prev) => ({ ...prev, ...result.presentPatch }));
      setPendingSlotIds(result.pendingSlotIds);
    },
    [],
  );

  useEffect(() => {
    if (!enabled || !teachingGroupId || slotIds.length === 0) {
      setStatusByCell({});
      setPresentByCell({});
      setPendingSlotIds([]);
      setError(null);
      setInitialLoading(false);
      setWeekRefreshing(false);
      reschedulesCache.current = null;
      hasLoadedOnce.current = false;
      return;
    }

    const seq = ++loadSeq.current;
    const isFirstLoad = !hasLoadedOnce.current;
    if (isFirstLoad) {
      setInitialLoading(true);
    } else {
      setWeekRefreshing(true);
    }
    setError(null);

    void (async () => {
      try {
        const reschedules = await fetchReschedules();
        if (seq !== loadSeq.current) return;
        const result = await loadWeek(weekDates, reschedules);
        if (seq !== loadSeq.current) return;
        applyWeekResult(result);
        hasLoadedOnce.current = true;
      } catch {
        if (seq !== loadSeq.current) return;
        setError('Could not load class status for this week.');
      } finally {
        if (seq === loadSeq.current) {
          setInitialLoading(false);
          setWeekRefreshing(false);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- week/teaching group driven reload
  }, [enabled, teachingGroupId, slotIdsKey, weekDatesKey, fetchReschedules, loadWeek, applyWeekResult]);

  const refresh = useCallback(async () => {
    if (!enabled || !teachingGroupId || slotIds.length === 0) return;
    setWeekRefreshing(true);
    setError(null);
    try {
      const reschedules = await fetchReschedules(true);
      const result = await loadWeek(weekDates, reschedules);
      applyWeekResult(result);
    } catch {
      setError('Could not load class status for this week.');
    } finally {
      setWeekRefreshing(false);
    }
  }, [
    enabled,
    teachingGroupId,
    slotIds.length,
    weekDates,
    fetchReschedules,
    loadWeek,
    applyWeekResult,
  ]);

  return {
    weekDates,
    statusByCell,
    presentByCell,
    pendingSlotIds,
    loading: initialLoading,
    weekRefreshing,
    error,
    refresh,
  };
}
