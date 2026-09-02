'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Info,
  Loader2,
  Sparkles,
  Calendar,
  User,
  BookOpen,
} from 'lucide-react';
import type { TimetableSlot } from '@/lib/timetables.service';
import type { TeachingGroup } from '@/lib/teaching-groups.service';
import {
  classReschedulesService,
  EligibleSourceSlot,
  SourceDatePresentStudent,
} from '@/lib/class-reschedules.service';
import { WEEKDAY_FULL } from '@/lib/weekday-dates';
import type { MakeupSlotCellStatus } from '@/lib/makeup-calendar';
import { formatRescheduleDate } from '@/lib/reschedule-ui';
import { SlotAttendancePanel } from './SlotAttendancePanel';

type SourcePick = { slotId: number; sourceDate: string };

interface Props {
  campusId: number;
  classId: number;
  teachingGroupId: number;
  selectedGroup: TeachingGroup | undefined;
  slots: TimetableSlot[];
  canMark: boolean;
  canView: boolean;
  selectedSources: SourcePick[];
  onSelectedSourcesChange: (sources: SourcePick[]) => void;
  onSelectionClear?: () => void;
  onRescheduleCreated?: () => void;
  attendanceSlot: TimetableSlot | null;
  attendanceDateIso: string;
  attendanceCellStatus: MakeupSlotCellStatus | null;
  initialPresentStudents?: SourceDatePresentStudent[];
  onAttendanceSaved: () => void;
}

export function ALevelMakeupPanel({
  campusId,
  classId,
  teachingGroupId,
  selectedGroup,
  slots,
  canMark,
  canView,
  selectedSources,
  onSelectedSourcesChange,
  onSelectionClear,
  onRescheduleCreated,
  attendanceSlot,
  attendanceDateIso,
  attendanceCellStatus,
  initialPresentStudents = [],
  onAttendanceSaved,
}: Props) {
  const [makeupDate, setMakeupDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [makeupBlockNumber, setMakeupBlockNumber] = useState<number | null>(null);
  const [eligibleSlots, setEligibleSlots] = useState<EligibleSourceSlot[]>([]);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!teachingGroupId || !makeupDate) {
      setEligibleSlots([]);
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
      })
      .catch(() => {
        if (!cancelled) {
          setEligibleSlots([]);
        }
      })
      .finally(() => !cancelled && setEligibleLoading(false));
    return () => {
      cancelled = true;
    };
  }, [teachingGroupId, makeupDate]);

  useEffect(() => {
    if (eligibleLoading || selectedSources.length === 0) return;
    const valid = selectedSources.filter((pick) => {
      const slot = eligibleSlots.find((s) => s.id === pick.slotId);
      return slot?.missed_dates.includes(pick.sourceDate);
    });
    if (valid.length !== selectedSources.length) {
      onSelectedSourcesChange(valid);
    }
  }, [eligibleLoading, eligibleSlots, selectedSources, onSelectedSourcesChange]);

  const makeupDayOfWeek = useMemo(
    () => new Date(`${makeupDate}T00:00:00.000Z`).getUTCDay(),
    [makeupDate],
  );

  const makeupDaySlots = useMemo(
    () =>
      slots
        .filter((s) => s.day_of_week === makeupDayOfWeek)
        .sort((a, b) => a.block_number - b.block_number),
    [slots, makeupDayOfWeek],
  );

  useEffect(() => {
    if (makeupDaySlots.length === 0) {
      setMakeupBlockNumber(null);
      return;
    }
    setMakeupBlockNumber((prev) => {
      if (prev != null && makeupDaySlots.some((s) => s.block_number === prev)) {
        return prev;
      }
      return makeupDaySlots[0].block_number;
    });
  }, [makeupDaySlots, makeupDate]);

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
      }));
  }, [eligibleSlots]);

  const toggleSlot = (slot: EligibleSourceSlot) => {
    const defaultDate = slot.default_source_date;
    const exists = selectedSources.some(
      (p) => p.slotId === slot.id && p.sourceDate === defaultDate,
    );
    if (exists) {
      onSelectedSourcesChange(
        selectedSources.filter(
          (p) => !(p.slotId === slot.id && p.sourceDate === defaultDate),
        ),
      );
      return;
    }
    onSelectedSourcesChange([
      ...selectedSources.filter((p) => p.slotId !== slot.id),
      { slotId: slot.id, sourceDate: defaultDate },
    ]);
  };

  const handleCreate = async () => {
    if (selectedSources.length === 0 || !canMark) return;
    const makeupSlot = makeupDaySlots.find((s) => s.block_number === makeupBlockNumber);
    if (!makeupSlot) {
      setError('Select a makeup block for the chosen date.');
      return;
    }
    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      await classReschedulesService.create({
        campus_id: campusId,
        class_id: classId,
        teaching_group_id: teachingGroupId,
        sources: selectedSources.map((s) => ({
          source_timetable_slot_id: s.slotId,
          source_date: s.sourceDate,
        })),
        makeup_date: makeupDate,
        makeup_period: makeupSlot.block_number,
        makeup_timetable_slot_id: makeupSlot.id,
      });
      setSuccess('Pending makeup reschedule created. Take attendance on the makeup date to excuse teacher.');
      onSelectedSourcesChange([]);
      onSelectionClear?.();
      onRescheduleCreated?.();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to create reschedule.');
    } finally {
      setCreating(false);
    }
  };

  const updateSourceDate = (slotId: number, sourceDate: string) => {
    onSelectedSourcesChange(
      selectedSources.map((p) => (p.slotId === slotId ? { ...p, sourceDate } : p)),
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
                No missed lessons found for this teaching group. Only past working days without roll call appear here.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Select missed slot(s) using pills below:
                </p>
                {slotsByWeekday.map((group) => (
                  <div key={group.dayOfWeek} className="space-y-1.5">
                    <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                      {group.dayLabel}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.slots.map((slot) => {
                        const selected = selectedSources.some((p) => p.slotId === slot.id);
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
                    onSelectedSourcesChange([]);
                  }}
                />
              </label>

              {makeupDaySlots.length > 0 ? (
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Makeup Block ({WEEKDAY_FULL[makeupDayOfWeek] ?? 'Day'})
                  </span>
                  <select
                    className="block w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium text-zinc-900 dark:text-zinc-100"
                    value={makeupBlockNumber ?? ''}
                    onChange={(e) => setMakeupBlockNumber(Number(e.target.value))}
                  >
                    {makeupDaySlots.map((slot) => (
                      <option key={slot.id} value={slot.block_number}>
                        Block {slot.block_number}
                        {slot.room ? ` · ${slot.room}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  No timetable slot on {WEEKDAY_FULL[makeupDayOfWeek] ?? 'this day'} — add one in Schedule mode or pick another makeup date.
                </p>
              )}

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

        {selectedSources.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-indigo-200/80 dark:border-indigo-900/60">
            <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              Confirm Original Missed Date(s) ({selectedSources.length} slot{selectedSources.length === 1 ? '' : 's'})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selectedSources.map((pick) => {
                const slot = eligibleSlots.find((s) => s.id === pick.slotId);
                if (!slot) return null;
                const dates = [...slot.missed_dates].reverse();
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
                  disabled={creating || makeupBlockNumber == null}
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

      <SlotAttendancePanel
        slot={attendanceSlot}
        dateIso={attendanceDateIso}
        campusId={campusId}
        classId={classId}
        teachingGroupId={teachingGroupId}
        cellStatus={attendanceCellStatus}
        initialPresentStudents={initialPresentStudents}
        canMark={canMark}
        onSaved={onAttendanceSaved}
      />
    </div>
  );
}
