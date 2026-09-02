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
  Calendar,
  Clock,
  User,
  BookOpen,
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
        makeup_period: makeupSlot?.block_number ?? (selectedSources[0]
          ? eligibleSlots.find((e) => e.id === selectedSources[0].slotId)?.block_number ?? 1
          : 1),
        ...(makeupSlot ? { makeup_timetable_slot_id: makeupSlot.id } : {}),
      });
      setSuccess('Pending makeup reschedule created. Take attendance on the makeup date to excuse teacher.');
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
    <div className="space-y-6">
      {/* 2-Step Makeup Wizard Creation Box */}
      <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-b from-indigo-50/70 via-white to-white dark:from-indigo-950/30 dark:via-zinc-900 dark:to-zinc-900 p-6 space-y-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 dark:border-indigo-900/50 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-600 text-white shadow-xs">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                Schedule A-Level Makeup Class
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Connect a missed class session with an upcoming makeup session.
              </p>
            </div>
          </div>

          {selectedGroup && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-100/80 dark:bg-indigo-900/50 text-indigo-900 dark:text-indigo-200 text-xs font-semibold">
              <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{selectedGroup.subjects?.name}</span>
              <span className="text-indigo-400">·</span>
              <User className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{selectedGroup.employee_profiles?.full_name}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Step 1: Missed Lesson Selection */}
          <div className="space-y-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 p-4">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
                1
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                Which Lesson Was Missed?
              </h4>
            </div>

            {eligibleLoading ? (
              <div className="flex items-center gap-2 py-4 text-xs text-indigo-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading slots…
              </div>
            ) : eligibleSlots.length === 0 ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                No timetable slots for this teaching group. Add slots in Schedule mode first.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Select missed slot(s) from the grid above or click pills below:
                </p>
                {slotsByWeekday.map((group) => (
                  <div key={group.dayOfWeek} className="space-y-1.5">
                    <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                      {group.dayLabel}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.slots.map((slot) => {
                        const selected = selectedSlotIds.includes(slot.id);
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => toggleSlot(slot)}
                            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                              selected
                                ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                                : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-indigo-400'
                            }`}
                          >
                            Block {slot.block_number} ({slot.time_label})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 2: Makeup Session Target */}
          <div className="space-y-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 p-4">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
                2
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                When Is The Makeup Class Held?
              </h4>
            </div>

            <div className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-indigo-500" />
                  Makeup Date (Held On)
                </span>
                <input
                  type="date"
                  className="block w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  value={makeupDate}
                  onChange={(e) => {
                    setMakeupDate(e.target.value);
                    setSelectedSources([]);
                  }}
                />
              </label>

              {/* Impact Callout */}
              <div className="rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 p-3 text-xs text-indigo-900 dark:text-indigo-200 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  Live Operational Impact
                </div>
                <ul className="space-y-1 text-[11px] list-disc list-inside text-indigo-800/90 dark:text-indigo-300/90">
                  <li>Creates a Roll Call attendance session on <strong>{formatRescheduleDate(makeupDate)}</strong></li>
                  <li>Excuses teacher on Staff Register for the original missed date once Roll Call is taken.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Sources Date Picker & Submit Bar */}
        {selectedSources.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-indigo-200/80 dark:border-indigo-900/60">
            <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              Confirm Original Missed Date(s) ({selectedSources.length} slot{selectedSources.length === 1 ? '' : 's'})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <div key={pick.slotId} className="flex items-center justify-between gap-2 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-850">
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      {WEEKDAY_FULL[slot.day_of_week]} Block {slot.block_number}:
                    </span>
                    <select
                      className="h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-xs font-medium"
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
            </div>

            {canMark && (
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => void handleCreate()}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white shadow-xs disabled:opacity-50 transition-all"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Save Pending Reschedule
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reschedules Activity Dashboard Card */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-6 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Reschedules for this Teaching Group
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Track pending, completed, and cancelled makeup sessions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 font-medium">Filter Status:</span>
            <select
              className="h-8 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ClassRescheduleStatus | '')}
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending Attendance</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-sm text-zinc-500 py-8">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
            Loading reschedules history…
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div className="text-center py-12 text-zinc-400 text-xs">
            No reschedules recorded for this teaching group.
          </div>
        )}

        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 p-4 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800/70"
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                {/* Missed Lesson Column */}
                <div className="md:col-span-4 space-y-1">
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/60 rounded px-2 py-0.5">
                    Original Missed
                  </span>
                  <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    {row.teaching_groups?.subjects?.name ?? 'Lesson'}
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                    {formatRescheduleDate(row.source_date)} · Block {row.source_timetable_slot?.block_number ?? '?'}
                  </div>
                </div>

                {/* Arrow Flow */}
                <div className="md:col-span-1 flex items-center justify-center text-zinc-400">
                  <ArrowRight className="w-5 h-5 hidden md:block" />
                </div>

                {/* Makeup Lesson Column */}
                <div className="md:col-span-4 space-y-1">
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/60 rounded px-2 py-0.5">
                    Makeup Session
                  </span>
                  <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Held on {formatRescheduleDate(row.makeup_date)}
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                    Block {row.makeup_period}
                  </div>
                </div>

                {/* Status & Actions Column */}
                <div className="md:col-span-3 flex flex-col md:items-end gap-2">
                  <RescheduleStatusBadge status={row.status} />

                  <div className="flex items-center gap-2 mt-1">
                    {row.status === 'PENDING' && canMark && (
                      <Link
                        href={rollCallMakeupHref({
                          makeupDate: row.makeup_date,
                          teachingGroupId: row.teaching_group_id,
                          classId: row.teaching_groups?.class_id ?? classId,
                          campusId: row.teaching_groups?.campus_id ?? campusId,
                        })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors"
                      >
                        <ClipboardList className="w-3.5 h-3.5" />
                        Take Roll Call
                      </Link>
                    )}

                    {row.status === 'PENDING' && canMark && (
                      <button
                        type="button"
                        disabled={actionId === row.id}
                        onClick={() => void handleCancel(row.id)}
                        className="px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 transition-colors"
                      >
                        Cancel
                      </button>
                    )}

                    {row.status === 'COMPLETED' && canEditLocked && (
                      <button
                        type="button"
                        disabled={actionId === row.id}
                        onClick={() => void handleReverse(row.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 transition-colors"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        Reverse
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
