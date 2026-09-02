'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Info,
  Loader2,
  Undo2,
  XCircle,
} from 'lucide-react';
import type { TimetableSlot } from '@/lib/timetables.service';
import {
  staffLessonReschedulesService,
  StaffLessonReschedule,
  StaffLessonRescheduleStatus,
} from '@/lib/staff-lesson-reschedules.service';
import { formatRescheduleDate } from '@/lib/reschedule-ui';
import { RescheduleStatusBadge } from './RescheduleStatusBadge';
import { SlotMakeupModal } from './SlotMakeupModal';

interface Props {
  campusId: number;
  classId: number;
  sectionId: number;
  effectiveFrom: string | null;
  slots: TimetableSlot[];
  canMark: boolean;
  selectedSlot: TimetableSlot | null;
  onClearSelectedSlot: () => void;
  onPendingSlotIdsChange: (ids: number[]) => void;
}

export function OLevelMakeupPanel({
  campusId,
  classId,
  sectionId,
  effectiveFrom,
  slots,
  canMark,
  selectedSlot,
  onClearSelectedSlot,
  onPendingSlotIdsChange,
}: Props) {
  const [rows, setRows] = useState<StaffLessonReschedule[]>([]);
  const [statusFilter, setStatusFilter] = useState<StaffLessonRescheduleStatus | ''>('PENDING');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);

  const loadRows = useCallback(async () => {
    if (!canMark) return;
    setLoading(true);
    try {
      const data = await staffLessonReschedulesService.list({
        campus_id: campusId,
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      setRows(
        data.filter((r) => r.class_id === classId && r.section_id === sectionId),
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [canMark, campusId, classId, sectionId, statusFilter]);

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

  const handleComplete = async (row: StaffLessonReschedule) => {
    setActionId(row.id);
    setError(null);
    setSuccess(null);
    try {
      const result = await staffLessonReschedulesService.complete(row.id);
      setSuccess(
        result.staffExcused
          ? 'Makeup confirmed — teacher excused on Staff Register for missed day.'
          : result.staffExcuseWarning ?? 'Completed without auto staff excuse.',
      );
      await loadRows();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to confirm makeup.');
    } finally {
      setActionId(null);
    }
  };

  const handleCancel = async (id: number) => {
    setActionId(id);
    try {
      await staffLessonReschedulesService.cancel(id);
      setSuccess('Reschedule cancelled.');
      await loadRows();
    } catch {
      setError('Failed to cancel.');
    } finally {
      setActionId(null);
    }
  };

  const handleReverse = async (id: number) => {
    setActionId(id);
    try {
      await staffLessonReschedulesService.reverse(id);
      setSuccess('Completed reschedule reversed.');
      await loadRows();
    } catch {
      setError('Failed to reverse.');
    } finally {
      setActionId(null);
    }
  };

  if (!canMark) {
    return (
      <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl px-4 py-2.5">
        You need attendance.staff.mark permission to create or confirm O-Level makeup reschedules.
      </p>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-rose-200/80 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/30 px-4 py-3 text-xs text-rose-900 dark:text-rose-200 flex gap-2.5">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Click a timetable slot above to schedule a missed lesson. When the makeup is held, confirm
          it here to excuse the teacher on Staff Register only — student attendance is unchanged.
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

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Reschedules for this section</h3>
          <select
            className="h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as StaffLessonRescheduleStatus | '')
            }
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
                    {row.employee_profiles?.full_name ?? 'Teacher'}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {row.source_timetable_slot?.subjects?.name ?? 'Lesson'} · P
                    {row.source_timetable_slot?.block_number ?? '?'}
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
                {row.status === 'PENDING' && (
                  <>
                    <button
                      type="button"
                      disabled={actionId === row.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs text-white disabled:opacity-50"
                      onClick={() => void handleComplete(row)}
                    >
                      {actionId === row.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      Confirm makeup held
                    </button>
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
                {row.status === 'COMPLETED' && (
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
              No reschedules for this section yet. Click a slot on the grid to add one.
            </li>
          )}
        </ul>
      </div>

      <SlotMakeupModal
        open={!!selectedSlot}
        slot={selectedSlot}
        campusId={campusId}
        classId={classId}
        sectionId={sectionId}
        effectiveFrom={effectiveFrom}
        onClose={onClearSelectedSlot}
        onCreated={() => {
          setSuccess('Pending reschedule created.');
          void loadRows();
        }}
      />

      {slots.length === 0 && (
        <p className="text-xs text-zinc-400 text-center">
          No timetable slots configured — add slots in Schedule mode first.
        </p>
      )}
    </>
  );
}
