'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Info,
  Loader2,
  Sparkles,
  Undo2,
  XCircle,
} from 'lucide-react';
import type { TimetableSlot } from '@/lib/timetables.service';
import type { TeachingGroup } from '@/lib/teaching-groups.service';
import {
  classReschedulesService,
  ClassReschedule,
  ClassRescheduleStatus,
  EligibleSourceSlot,
} from '@/lib/class-reschedules.service';
import { generateWeekdayOccurrences, WEEKDAY_FULL } from '@/lib/weekday-dates';
import { formatRescheduleDate, rollCallMakeupHref } from '@/lib/reschedule-ui';
import { RescheduleStatusBadge } from './RescheduleStatusBadge';

type SourcePick = { slotId: number; sourceDate: string };

interface Props {
  campusId: number;
  classId: number;
  teachingGroupId: number;
  selectedGroup: TeachingGroup | undefined;
  slots: TimetableSlot[];
  canMark: boolean;
  canView: boolean;
  canEditLocked: boolean;
  onSlotClick: (slot: TimetableSlot) => void;
  selectedSlotIds: number[];
  onPendingSlotIdsChange: (ids: number[]) => void;
  onSelectionClear?: () => void;
}

function minVisibleSourceDateIso(makeupDateIso: string, timetableEffectiveFrom: string | null): string {
  const augustFirst = `${makeupDateIso.slice(0, 4)}-08-01`;
  if (timetableEffectiveFrom && timetableEffectiveFrom > augustFirst) {
    return timetableEffectiveFrom;
  }
  return augustFirst;
}

export function ALevelMakeupPanel({
  campusId,
  classId,
  teachingGroupId,
  selectedGroup,
  slots,
  canMark,
  canView,
  canEditLocked,
  onSlotClick,
  selectedSlotIds,
  onPendingSlotIdsChange,
  onSelectionClear,
}: Props) {
  const [makeupDate, setMakeupDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [eligibleSlots, setEligibleSlots] = useState<EligibleSourceSlot[]>([]);
  const [timetableEffectiveFrom, setTimetableEffectiveFrom] = useState<string | null>(null);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [selectedSources, setSelectedSources] = useState<SourcePick[]>([]);
  const [rows, setRows] = useState<ClassReschedule[]>([]);
  const [statusFilter, setStatusFilter] = useState<ClassRescheduleStatus | ''>('PENDING');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);

  useEffect(() => {
    if (!teachingGroupId || !makeupDate) {
      setEligibleSlots([]);
      setTimetableEffectiveFrom(null);
      return;
    }
    let cancelled = false;
    setEligibleLoading(true);
    classReschedulesService
      .getEligibleSlots({
        teaching_group_id: teachingGroupId,
        makeup_date: makeupDate,
      })
      .then((data) => {
        if (cancelled) return;
        setEligibleSlots(data.slots);
        setTimetableEffectiveFrom(data.timetable_effective_from);
      })
      .catch(() => {
        if (!cancelled) {
          setEligibleSlots([]);
          setTimetableEffectiveFrom(null);
        }
      })
      .finally(() => !cancelled && setEligibleLoading(false));
    return () => {
      cancelled = true;
    };
  }, [teachingGroupId, makeupDate]);

  const loadRows = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const data = await classReschedulesService.list({
        teaching_group_id: teachingGroupId,
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [canView, teachingGroupId, statusFilter]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const pendingSlotIds = useMemo(
    () =>
      rows
        .filter((r) => r.status === 'PENDING')
        .map((r) => r.source_timetable_slot_id),
    [rows],
  );

  useEffect(() => {
    onPendingSlotIdsChange(pendingSlotIds);
  }, [pendingSlotIds, onPendingSlotIdsChange]);

  const eligibleIdSet = useMemo(
    () => new Set(eligibleSlots.map((s) => s.id)),
    [eligibleSlots],
  );

  const minSourceDateIso = useMemo(
    () => minVisibleSourceDateIso(makeupDate, timetableEffectiveFrom),
    [makeupDate, timetableEffectiveFrom],
  );

  const slotsByWeekday = useMemo(() => {
    const map = new Map<number, EligibleSourceSlot[]>();
    for (const slot of eligibleSlots) {
      const list = map.get(slot.day_of_week) ?? [];
      list.push(slot);
      map.set(slot.day_of_week, list);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([dayOfWeek, daySlots]) => ({
        dayOfWeek,
        dayLabel: WEEKDAY_FULL[dayOfWeek] ?? daySlots[0].day_label,
        slots: [...daySlots].sort((a, b) => a.block_number - b.block_number),
        defaultSourceDate: daySlots[0].default_source_date,
      }));
  }, [eligibleSlots]);

  // Sync grid slot clicks into selectedSources
  useEffect(() => {
    setSelectedSources((prev) => {
      const idSet = new Set(selectedSlotIds);
      const kept = prev.filter((p) => idSet.has(p.slotId));
      const keptIds = new Set(kept.map((p) => p.slotId));
      const added: SourcePick[] = [];
      for (const slotId of selectedSlotIds) {
        if (!eligibleIdSet.has(slotId) || keptIds.has(slotId)) continue;
        const slot = eligibleSlots.find((s) => s.id === slotId);
        if (slot) added.push({ slotId, sourceDate: slot.default_source_date });
      }
      return [...kept, ...added];
    });
  }, [selectedSlotIds, eligibleSlots, eligibleIdSet]);

  const toggleSlot = (slot: EligibleSourceSlot) => {
    const gridSlot = slots.find((s) => s.id === slot.id);
    if (gridSlot) onSlotClick(gridSlot);
  };

  const handleCreate = async () => {
    if (selectedSources.length === 0 || !canMark) return;
    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const makeupSlot = slots.find(
        (s) =>
          s.day_of_week === new Date(`${makeupDate}T00:00:00Z`).getUTCDay() &&
          eligibleIdSet.has(s.id),
      );
      await classReschedulesService.create({
        campus_id: campusId,
        class_id: classId,
        teaching_group_id: teachingGroupId,
        sources: selectedSources.map((s) => ({
          source_timetable_slot_id: s.slotId,
          source_date: s.sourceDate,
        })),
        makeup_date: makeupDate,
        makeup_period: makeupSlot?.block_number ?? selectedSources[0]
          ? eligibleSlots.find((e) => e.id === selectedSources[0].slotId)?.block_number ?? 1
          : 1,
        ...(makeupSlot ? { makeup_timetable_slot_id: makeupSlot.id } : {}),
      });
      setSuccess('Pending makeup reschedule created. Take attendance on the makeup date.');
      setSelectedSources([]);
      onSelectionClear?.();
      await loadRows();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to create reschedule.');
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = async (id: number) => {
    setActionId(id);
    try {
      await classReschedulesService.cancel(id);
      setSuccess('Reschedule cancelled.');
      await loadRows();
    } catch {
      setError('Failed to cancel.');
    } finally {
      setActionId(null);
    }
  };

  const handleReverse = async (id: number) => {
    if (!canEditLocked) return;
    setActionId(id);
    try {
      await classReschedulesService.reverse(id);
      setSuccess('Completed reschedule reversed.');
      await loadRows();
    } catch {
      setError('Failed to reverse.');
    } finally {
      setActionId(null);
    }
  };

  const updateSourceDate = (slotId: number, sourceDate: string) => {
    setSelectedSources((prev) =>
      prev.map((p) => (p.slotId === slotId ? { ...p, sourceDate } : p)),
    );
  };

  if (!canView) {
    return (
      <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl px-4 py-2.5">
        You need roll call view permission to manage A-Level makeup reschedules.
      </p>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-indigo-200/80 dark:border-indigo-900/50 bg-indigo-50/60 dark:bg-indigo-950/30 px-4 py-3 text-xs text-indigo-900 dark:text-indigo-200 flex gap-2.5">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Pick a makeup date, select missed slot(s), then save. Take student attendance on Roll Call
          on the makeup date — students who attended get excused on the original missed date.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {success}
        </div>
      )}

      <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-b from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-zinc-950 p-5 space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Makeup date (held on)
            </span>
            <input
              type="date"
              className="block h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
              value={makeupDate}
              onChange={(e) => {
                setMakeupDate(e.target.value);
                setSelectedSources([]);
              }}
            />
          </label>
          {selectedGroup && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 pb-2">
              {selectedGroup.subjects?.name} — {selectedGroup.employee_profiles?.full_name}
            </p>
          )}
        </div>

        <div>
          <h3 className="text-sm font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            Select missed slot(s)
          </h3>
          {eligibleLoading ? (
            <div className="flex items-center gap-2 py-4 text-xs text-indigo-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading eligible slots…
            </div>
          ) : eligibleSlots.length === 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
              No timetable slots for this teaching group. Add slots in Schedule mode first.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {slotsByWeekday.map((group) => (
                <div key={group.dayOfWeek} className="space-y-2">
                  <div className="text-xs font-bold text-zinc-500">{group.dayLabel}</div>
                  <div className="flex flex-wrap gap-2">
                    {group.slots.map((slot) => {
                      const selected = selectedSlotIds.includes(slot.id);
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => toggleSlot(slot)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                            selected
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-indigo-300'
                          }`}
                        >
                          P{slot.block_number} · {slot.time_label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedSources.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-indigo-200/60 dark:border-indigo-900/40">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Missed dates ({selectedSources.length} slot{selectedSources.length === 1 ? '' : 's'})
            </p>
            {selectedSources.map((pick) => {
              const slot = eligibleSlots.find((s) => s.id === pick.slotId);
              if (!slot) return null;
              const yesterday = new Date();
              yesterday.setUTCDate(yesterday.getUTCDate() - 1);
              const dates = generateWeekdayOccurrences(
                slot.day_of_week,
                minSourceDateIso,
                yesterday.toISOString().slice(0, 10),
              ).reverse();
              return (
                <div key={pick.slotId} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {WEEKDAY_FULL[slot.day_of_week]} P{slot.block_number}:
                  </span>
                  <select
                    className="h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                    value={pick.sourceDate}
                    onChange={(e) => updateSourceDate(pick.slotId, e.target.value)}
                  >
                    {dates.map((d) => (
                      <option key={d} value={d}>
                        {formatRescheduleDate(d)}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
            {canMark && (
              <button
                type="button"
                disabled={creating}
                onClick={() => void handleCreate()}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                Save pending reschedule
              </button>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Reschedules for this teaching group
          </h3>
          <select
            className="h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ClassRescheduleStatus | '')}
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-zinc-500 py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        )}

        <ul className="space-y-3 max-h-96 overflow-y-auto">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 space-y-2 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {row.teaching_groups?.subjects?.name ?? 'Lesson'}
                  </div>
                  <div className="text-xs text-zinc-500">
                    Missed P{row.source_timetable_slot?.block_number ?? '?'}
                  </div>
                </div>
                <RescheduleStatusBadge status={row.status} />
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span>{formatRescheduleDate(row.source_date)}</span>
                <ArrowRight className="h-3 w-3" />
                <span>{formatRescheduleDate(row.makeup_date)}</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {row.status === 'PENDING' && canMark && (
                  <>
                    <Link
                      href={rollCallMakeupHref({
                        makeupDate: row.makeup_date,
                        teachingGroupId: row.teaching_group_id,
                        classId,
                        campusId,
                      })}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs text-white"
                    >
                      <ClipboardList className="h-3 w-3" />
                      Take Attendance
                    </Link>
                    <button
                      type="button"
                      disabled={actionId === row.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-xs"
                      onClick={() => void handleCancel(row.id)}
                    >
                      <XCircle className="h-3 w-3" />
                      Cancel
                    </button>
                  </>
                )}
                {row.status === 'COMPLETED' && canEditLocked && (
                  <button
                    type="button"
                    disabled={actionId === row.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-xs"
                    onClick={() => void handleReverse(row.id)}
                  >
                    <Undo2 className="h-3 w-3" />
                    Reverse
                  </button>
                )}
              </div>
            </li>
          ))}
          {!loading && rows.length === 0 && (
            <li className="text-sm text-zinc-400 text-center py-8">
              No reschedules for this teaching group yet.
            </li>
          )}
        </ul>
      </div>
    </>
  );
}
