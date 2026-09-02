'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Info,
  Loader2,
  Undo2,
  XCircle,
  User,
  BookOpen,
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
  initialSourceDate?: string;
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
  initialSourceDate,
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
    <div className="space-y-6">
      <div className="rounded-xl border border-rose-200/80 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/30 px-4 py-3 text-xs text-rose-900 dark:text-rose-200 flex gap-2.5">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Click any slot on the timetable grid above to schedule a missed lesson. When the makeup is held, confirm
          it here to excuse the teacher on Staff Register only.
        </p>
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

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-6 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Reschedules for this Section
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Manage teacher lesson excuses and makeup session confirmations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 font-medium">Filter Status:</span>
            <select
              className="h-8 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as StaffLessonRescheduleStatus | '')
              }
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending Confirmation</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-sm text-zinc-500 py-8">
            <Loader2 className="h-5 w-5 animate-spin text-rose-500" />
            Loading reschedules history…
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div className="text-center py-12 text-zinc-400 text-xs">
            No reschedules for this section yet. Click a slot on the grid above to schedule one.
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
                  <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-zinc-400" />
                    {row.employee_profiles?.full_name ?? 'Teacher'}
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                    {row.source_timetable_slot?.subjects?.name ?? 'Lesson'} · Missed on {formatRescheduleDate(row.source_date)}
                  </div>
                </div>

                {/* Arrow Flow */}
                <div className="md:col-span-1 flex items-center justify-center text-zinc-400">
                  <ArrowRight className="w-5 h-5 hidden md:block" />
                </div>

                {/* Makeup Session Column */}
                <div className="md:col-span-4 space-y-1">
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/60 rounded px-2 py-0.5">
                    Makeup Session
                  </span>
                  <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Held on {formatRescheduleDate(row.makeup_date)}
                  </div>
                </div>

                {/* Status & Actions Column */}
                <div className="md:col-span-3 flex flex-col md:items-end gap-2">
                  <RescheduleStatusBadge status={row.status} />

                  <div className="flex items-center gap-2 mt-1">
                    {row.status === 'PENDING' && (
                      <>
                        <button
                          type="button"
                          disabled={actionId === row.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors disabled:opacity-50"
                          onClick={() => void handleComplete(row)}
                        >
                          {actionId === row.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          Confirm Makeup Held
                        </button>
                        <button
                          type="button"
                          disabled={actionId === row.id}
                          className="px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 transition-colors"
                          onClick={() => void handleCancel(row.id)}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {row.status === 'COMPLETED' && (
                      <button
                        type="button"
                        disabled={actionId === row.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 transition-colors"
                        onClick={() => void handleReverse(row.id)}
                      >
                        <Undo2 className="h-3.5 w-3.5" />
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
        defaultSourceDate={initialSourceDate}
      />
    </div>
  );
}
