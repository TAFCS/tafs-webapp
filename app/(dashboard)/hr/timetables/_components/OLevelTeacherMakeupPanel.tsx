'use client';

import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Sparkles,
  Calendar,
  User,
  Undo2,
  Trash2,
} from 'lucide-react';
import type { TimetableBlock, TimetableSlot } from '@/lib/timetables.service';
import {
  staffLessonReschedulesService,
  StaffLessonTeacherSlot,
} from '@/lib/staff-lesson-reschedules.service';
import type { MakeupSlotCellStatus, RescheduleLinkInfo } from '@/lib/makeup-calendar';
import { formatRescheduleDate } from '@/lib/reschedule-ui';
import { MAKEUP_STATUS_STYLES } from '@/lib/makeup-calendar';
import { blockDisplayLabel, type MakeupCalendarMode } from './TimetableGrid';

export type OlevelSourcePick = {
  slotId: number;
  sourceDate: string;
  classId: number;
  sectionId: number;
  campusId: number;
};

interface Props {
  employeeId: number;
  employeeName: string | null;
  teacherSlots: StaffLessonTeacherSlot[];
  gridSlots: TimetableSlot[];
  blocks: TimetableBlock[];
  canMark: boolean;
  selectedSources: OlevelSourcePick[];
  onSelectedSourcesChange: (sources: OlevelSourcePick[]) => void;
  onSelectionClear?: () => void;
  onRescheduleCreated?: () => void;
  makeupDate: string;
  onMakeupDateChange: (dateIso: string) => void;
  makeupBlockNumber: number | null;
  onMakeupBlockNumberChange: (blockNumber: number | null) => void;
  confirmSlot: TimetableSlot | null;
  confirmDateIso: string;
  confirmCellStatus: MakeupSlotCellStatus | null;
  confirmRescheduleLink?: RescheduleLinkInfo;
  calendarMode?: MakeupCalendarMode;
}

function slotMeta(slotId: number, teacherSlots: StaffLessonTeacherSlot[]) {
  return teacherSlots.find((s) => s.id === slotId);
}

export function OLevelTeacherMakeupPanel({
  employeeId,
  employeeName,
  teacherSlots,
  gridSlots,
  blocks,
  canMark,
  selectedSources,
  onSelectedSourcesChange,
  onSelectionClear,
  onRescheduleCreated,
  makeupDate,
  onMakeupDateChange,
  makeupBlockNumber,
  onMakeupBlockNumberChange,
  confirmSlot,
  confirmDateIso,
  confirmCellStatus,
  confirmRescheduleLink,
  calendarMode = 'schedule',
}: Props) {
  const [creating, setCreating] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const makeupDayOfWeek = useMemo(
    () => new Date(`${makeupDate}T00:00:00.000Z`).getUTCDay(),
    [makeupDate],
  );

  const makeupDaySlots = useMemo(
    () =>
      gridSlots
        .filter((s) => s.day_of_week === makeupDayOfWeek)
        .sort((a, b) => a.block_number - b.block_number),
    [gridSlots, makeupDayOfWeek],
  );

  const classBlocks = useMemo(
    () => blocks.filter((b) => !b.is_break).sort((a, b) => a.block_number - b.block_number),
    [blocks],
  );

  const makeupBlockOptions = useMemo(() => {
    const maxBlock = Math.max(
      8,
      ...classBlocks.map((b) => b.block_number),
      ...teacherSlots.map((s) => s.block_number),
    );
    return Array.from({ length: maxBlock }, (_, i) => i + 1).map((blockNumber) => {
      const block = classBlocks.find((b) => b.block_number === blockNumber);
      const daySlot = makeupDaySlots.find((s) => s.block_number === blockNumber);
      return {
        blockNumber,
        slotId: daySlot?.id ?? null,
        label: block
          ? `Block ${blockNumber} (${blockDisplayLabel(block)})`
          : `Block ${blockNumber}`,
      };
    });
  }, [classBlocks, makeupDaySlots, teacherSlots]);

  const linkedReschedule = useMemo(() => {
    if (!confirmRescheduleLink) return null;
    return confirmRescheduleLink;
  }, [confirmRescheduleLink]);

  const handleCreate = async () => {
    if (!canMark || selectedSources.length === 0 || makeupBlockNumber == null) return;
    const makeupOption = makeupBlockOptions.find((o) => o.blockNumber === makeupBlockNumber);
    if (!makeupOption) {
      setError('Select a makeup block.');
      return;
    }
    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      for (const pick of selectedSources) {
        await staffLessonReschedulesService.create({
          employee_id: employeeId,
          campus_id: pick.campusId,
          class_id: pick.classId,
          section_id: pick.sectionId,
          source_timetable_slot_id: pick.slotId,
          source_date: pick.sourceDate,
          makeup_date: makeupDate,
          makeup_period: makeupBlockNumber,
          ...(makeupOption.slotId != null
            ? { makeup_timetable_slot_id: makeupOption.slotId }
            : {}),
        });
      }
      setSuccess('Makeup class scheduled. Confirm held in Confirm mode to excuse on Staff Register.');
      onSelectedSourcesChange([]);
      onSelectionClear?.();
      onRescheduleCreated?.();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to schedule makeup.');
    } finally {
      setCreating(false);
    }
  };

  const handleComplete = async (rescheduleId: number) => {
    setActionId(rescheduleId);
    setError(null);
    setSuccess(null);
    try {
      const result = await staffLessonReschedulesService.complete(rescheduleId);
      setSuccess(
        result.staffExcused
          ? 'Makeup confirmed — teacher excused on Staff Register.'
          : result.staffExcuseWarning ?? 'Completed without auto staff excuse.',
      );
      onRescheduleCreated?.();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to confirm makeup.');
    } finally {
      setActionId(null);
    }
  };

  const handleCancel = async (rescheduleId: number) => {
    if (!window.confirm('Cancel this makeup? The missed lesson will show as not conducted again.')) {
      return;
    }
    setActionId(rescheduleId);
    try {
      await staffLessonReschedulesService.cancel(rescheduleId);
      setSuccess('Makeup cancelled.');
      onRescheduleCreated?.();
    } catch {
      setError('Failed to cancel makeup.');
    } finally {
      setActionId(null);
    }
  };

  const handleReverse = async (rescheduleId: number) => {
    if (!window.confirm('Reverse this completed makeup? Staff register excuse will be removed.')) {
      return;
    }
    setActionId(rescheduleId);
    try {
      await staffLessonReschedulesService.reverse(rescheduleId);
      setSuccess('Makeup reversed.');
      onRescheduleCreated?.();
    } catch {
      setError('Failed to reverse makeup.');
    } finally {
      setActionId(null);
    }
  };

  const displayStatus: MakeupSlotCellStatus | null =
    confirmCellStatus === 'missed' && confirmRescheduleLink?.role === 'makeup'
      ? 'makeup_upcoming'
      : confirmCellStatus;
  const statusMeta = displayStatus ? MAKEUP_STATUS_STYLES[displayStatus] : null;

  if (!canMark) {
    return (
      <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl px-4 py-2.5">
        You need staff attendance mark permission to manage O-Level teacher makeup.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {calendarMode === 'schedule' && (
        <div className="rounded-2xl border border-pink-200 dark:border-pink-900/60 bg-gradient-to-b from-pink-50/70 via-white to-white dark:from-pink-950/30 dark:via-zinc-900 dark:to-zinc-900 p-6 space-y-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-pink-100 dark:border-pink-900/50 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-pink-600 text-white shadow-xs">
                <Sparkles className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                  Schedule O-Level Teacher Makeup
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Click missed cells on the calendar, then pick a makeup date and block.
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-pink-100/80 dark:bg-pink-900/50 text-pink-900 dark:text-pink-200 text-xs font-semibold">
              <User className="w-3.5 h-3.5" />
              {employeeName ?? `Teacher #${employeeId}`}
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {success}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                1 · Missed lessons
              </h4>
              {selectedSources.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  Click red or purple cells on the teacher calendar to add missed lessons here.
                </p>
              ) : (
                <ul className="space-y-2">
                  {selectedSources.map((pick) => {
                    const meta = slotMeta(pick.slotId, teacherSlots);
                    return (
                      <li
                        key={`${pick.slotId}|${pick.sourceDate}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-pink-200 dark:border-pink-900/50 bg-pink-50/50 dark:bg-pink-950/20 px-3 py-2 text-xs"
                      >
                        <span>
                          {meta?.subject.name ?? 'Lesson'} · {meta?.class_code}{' '}
                          {meta?.section_code} · {formatRescheduleDate(pick.sourceDate)}
                        </span>
                        <button
                          type="button"
                          className="text-rose-600 font-semibold"
                          onClick={() =>
                            onSelectedSourcesChange(
                              selectedSources.filter(
                                (p) =>
                                  !(
                                    p.slotId === pick.slotId &&
                                    p.sourceDate === pick.sourceDate
                                  ),
                              ),
                            )
                          }
                        >
                          Remove
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="space-y-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                2 · Makeup date & block
              </h4>
              <label className="block space-y-1">
                <span className="text-[10px] font-bold uppercase text-zinc-500">Makeup date</span>
                <input
                  type="date"
                  value={makeupDate}
                  onChange={(e) => onMakeupDateChange(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-bold uppercase text-zinc-500">Makeup block</span>
                <select
                  value={makeupBlockNumber ?? ''}
                  onChange={(e) =>
                    onMakeupBlockNumberChange(
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                  className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                >
                  {makeupBlockOptions.map((o) => (
                    <option key={o.blockNumber} value={o.blockNumber}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={creating || selectedSources.length === 0 || makeupBlockNumber == null}
                onClick={() => void handleCreate()}
                className="w-full h-10 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-sm font-bold disabled:opacity-40 inline-flex items-center justify-center gap-2"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                Schedule makeup
              </button>
            </div>
          </div>
        </div>
      )}

      {calendarMode === 'attendance' && confirmSlot && confirmDateIso && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-6 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Confirm makeup · {confirmSlot.subjects?.name ?? 'Lesson'}
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">{employeeName}</p>
              {statusMeta && (
                <span
                  className={`inline-flex mt-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusMeta.card}`}
                >
                  {statusMeta.label}
                </span>
              )}
            </div>
          </div>

          {confirmRescheduleLink && (
            <div className="rounded-xl border border-pink-200 dark:border-pink-900/60 bg-pink-50/80 dark:bg-pink-950/30 px-4 py-3 text-sm">
              {confirmRescheduleLink.role === 'makeup' ? (
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">Makeup class</span>
                  <ArrowRight className="h-4 w-4" />
                  Covers missed lesson on{' '}
                  <strong>{formatRescheduleDate(confirmRescheduleLink.sourceDate)}</strong>
                </p>
              ) : (
                <p>
                  Missed on {formatRescheduleDate(confirmRescheduleLink.sourceDate)} → makeup{' '}
                  {formatRescheduleDate(confirmRescheduleLink.makeupDate)}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          )}

          {linkedReschedule && (
            <div className="flex flex-wrap gap-2 pt-2">
              {linkedReschedule.status === 'SCHEDULED' && (
                <>
                  <button
                    type="button"
                    disabled={actionId != null}
                    onClick={() => void handleComplete(linkedReschedule.rescheduleId)}
                    className="h-10 px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {actionId === linkedReschedule.rescheduleId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Confirm makeup held
                  </button>
                  <button
                    type="button"
                    disabled={actionId != null}
                    onClick={() => void handleCancel(linkedReschedule.rescheduleId)}
                    className="h-10 px-4 rounded-xl border border-rose-200 text-rose-700 text-sm font-semibold inline-flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Cancel makeup
                  </button>
                </>
              )}
              {linkedReschedule.status === 'COMPLETED' && (
                <button
                  type="button"
                  disabled={actionId != null}
                  onClick={() => void handleReverse(linkedReschedule.rescheduleId)}
                  className="h-10 px-4 rounded-xl border border-amber-200 text-amber-800 text-sm font-semibold inline-flex items-center gap-2"
                >
                  <Undo2 className="h-4 w-4" />
                  Reverse
                </button>
              )}
            </div>
          )}

          {!linkedReschedule && displayStatus === 'missed' && (
            <p className="text-xs text-zinc-500">
              Schedule this missed lesson in Schedule mode first, then confirm here after the makeup
              is held.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
