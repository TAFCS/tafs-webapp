'use client';

import { useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  Trash2,
  Undo2,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import type { TimetableSlot } from '@/lib/timetables.service';
import { formatRescheduleDate } from '@/lib/reschedule-ui';
import type { MakeupSlotCellStatus, RescheduleLinkInfo } from '@/lib/makeup-calendar';
import { MAKEUP_STATUS_STYLES } from '@/lib/makeup-calendar';
import { classReschedulesService, type SourceDatePresentStudent } from '@/lib/class-reschedules.service';
import { useSlotAttendanceSession } from './useSlotAttendanceSession';

interface Props {
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
  onMakeupDeleted?: () => void;
}

export function SlotAttendancePanel({
  slot,
  dateIso,
  campusId,
  classId,
  teachingGroupId,
  cellStatus,
  rescheduleLink,
  initialPresentStudents = [],
  canMark,
  onSaved,
  onMakeupDeleted,
}: Props) {
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const active = Boolean(slot && dateIso);

  const {
    sessionDate,
    setSessionDate,
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
  } = useSlotAttendanceSession({
    active,
    slot,
    dateIso,
    campusId,
    classId,
    teachingGroupId,
    cellStatus,
    initialPresentStudents,
    canMark,
    onSaved,
  });

  const statusMeta = cellStatus ? MAKEUP_STATUS_STYLES[cellStatus] : null;
  const canDeleteMakeup =
    canMark &&
    rescheduleLink?.status === 'SCHEDULED' &&
    (cellStatus === 'makeup_upcoming' ||
      (cellStatus === 'rescheduled' && rescheduleLink.role === 'source'));

  const handleDeleteMakeup = async () => {
    if (!rescheduleLink || !canDeleteMakeup) return;
    const label =
      rescheduleLink.role === 'makeup'
        ? 'Delete this makeup class?'
        : 'Cancel this reschedule?';
    const detail =
      rescheduleLink.role === 'makeup'
        ? 'The missed lesson(s) will show as not conducted again on the calendar.'
        : 'The makeup class will be removed and this lesson will show as not conducted again.';
    if (!window.confirm(`${label} ${detail}`)) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      if (rescheduleLink.role === 'makeup') {
        const rows = await classReschedulesService.list({
          teaching_group_id: teachingGroupId,
          status: 'SCHEDULED',
        });
        const bundle = rows.filter(
          (row) =>
            row.makeup_date.slice(0, 10) === rescheduleLink.makeupDate &&
            row.makeup_period === rescheduleLink.makeupPeriod,
        );
        for (const row of bundle) {
          await classReschedulesService.cancel(row.id);
        }
      } else {
        await classReschedulesService.cancel(rescheduleLink.rescheduleId);
      }
      onMakeupDeleted?.();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setDeleteError(msg || 'Failed to delete makeup class.');
    } finally {
      setDeleting(false);
    }
  };

  if (!slot) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-8 text-center">
        <Users className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-600 mb-3" />
        <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
          Students present that day
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 max-w-md mx-auto">
          Click a class on the calendar above to view who was present and mark attendance.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 p-6 space-y-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            Students present · {slot.subjects?.name ?? 'Lesson'} · Block {slot.block_number}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {slot.employee_profiles?.full_name ?? `Teacher #${slot.employee_id}`}
          </p>
          {statusMeta && (
            <span
              className={`inline-flex mt-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusMeta.card}`}
            >
              {statusMeta.label}
            </span>
          )}
        </div>
        {canDeleteMakeup && (
          <button
            type="button"
            disabled={deleting || saving || reverting}
            onClick={() => void handleDeleteMakeup()}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            {rescheduleLink?.role === 'makeup' ? 'Delete makeup class' : 'Cancel reschedule'}
          </button>
        )}
      </div>

      {rescheduleLink && (
        <div className="rounded-xl border border-pink-200 dark:border-pink-900/60 bg-pink-50/80 dark:bg-pink-950/30 px-4 py-3 text-sm text-pink-950 dark:text-pink-100">
          {rescheduleLink.role === 'source' ? (
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">Missed lesson rescheduled</span>
              <ArrowRight className="w-4 h-4 shrink-0 text-pink-500" />
              <span>
                Makeup on{' '}
                <strong>{formatRescheduleDate(rescheduleLink.makeupDate)}</strong>
                {' · '}Block {rescheduleLink.makeupPeriod}
              </span>
            </p>
          ) : (
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">Makeup class</span>
              <ArrowRight className="w-4 h-4 shrink-0 text-pink-500" />
              <span>
                Covers missed lesson on{' '}
                <strong>{formatRescheduleDate(rescheduleLink.sourceDate)}</strong>
              </span>
            </p>
          )}
        </div>
      )}

      <label className="block space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
          Session date
        </span>
        <input
          type="date"
          className="w-full max-w-xs h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
          value={sessionDate}
          onChange={(e) => setSessionDate(e.target.value)}
        />
      </label>

      {error && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}
      {deleteError && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
          {deleteError}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {success}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading roster…
        </div>
      ) : session ? (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              {formatRescheduleDate(sessionDate)}
            </span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              {presentCount} / {roster.length} present
            </span>
          </div>

          {cellStatus === 'conducted' && initialPresentStudents.length > 0 && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-3 py-2">
              {initialPresentStudents.length} student
              {initialPresentStudents.length === 1 ? '' : 's'} marked present when this session
              was submitted.
            </p>
          )}

          <ul className="space-y-1.5 max-h-80 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800">
            {roster.map((row) => {
              const isPresent = marks[row.student.cc] === 'PRESENT';
              return (
                <li key={row.student.cc}>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => togglePresent(row.student.cc)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                      canEdit ? 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer' : ''
                    } ${isPresent ? 'bg-emerald-50/80 dark:bg-emerald-950/30' : ''}`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                        isPresent
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-zinc-300 dark:border-zinc-600 text-zinc-400'
                      }`}
                    >
                      {isPresent ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <UserX className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate block">
                        {row.student.full_name}
                      </span>
                      <span className="text-xs text-zinc-500">
                        CC {row.student.cc}
                        {row.student.gr_number ? ` · GR ${row.student.gr_number}` : ''}
                      </span>
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase ${
                        isPresent ? 'text-emerald-600' : 'text-zinc-400'
                      }`}
                    >
                      {isPresent ? 'Present' : 'Absent'}
                    </span>
                  </button>
                </li>
              );
            })}
            {roster.length === 0 && (
              <li className="px-3 py-8 text-center text-sm text-zinc-400">
                No students enrolled in this teaching group.
              </li>
            )}
          </ul>

          {isLocked && !canRevert && (
            <p className="text-xs text-zinc-500">
              Session is {session.status.toLowerCase()} — attendance cannot be edited unless
              reopened by an admin.
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            {canRevert && (
              <button
                type="button"
                disabled={reverting || saving}
                onClick={() => void handleRevert()}
                className="h-10 px-4 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {reverting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Undo2 className="h-4 w-4" />
                )}
                Revert
              </button>
            )}
            {canEdit && (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSave(false)}
                  className="h-10 px-4 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-sm font-semibold disabled:opacity-50"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSave(true)}
                  className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Submit attendance
                </button>
              </>
            )}
            {!canEdit && canMark && session?.status === 'DRAFT' && (
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <UserCheck className="h-4 w-4" />
                View only
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
