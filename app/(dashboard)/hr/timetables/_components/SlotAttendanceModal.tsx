'use client';

import {
  Check,
  CheckCircle2,
  Loader2,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import type { TimetableSlot } from '@/lib/timetables.service';
import { formatRescheduleDate } from '@/lib/reschedule-ui';
import type { MakeupSlotCellStatus } from '@/lib/makeup-calendar';
import { MAKEUP_STATUS_STYLES } from '@/lib/makeup-calendar';
import type { SourceDatePresentStudent } from '@/lib/class-reschedules.service';
import { useSlotAttendanceSession } from './useSlotAttendanceSession';

interface Props {
  open: boolean;
  slot: TimetableSlot | null;
  dateIso: string;
  campusId: number;
  classId: number;
  teachingGroupId: number;
  cellStatus: MakeupSlotCellStatus | null;
  initialPresentStudents?: SourceDatePresentStudent[];
  canMark: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function SlotAttendanceModal({
  open,
  slot,
  dateIso,
  campusId,
  classId,
  teachingGroupId,
  cellStatus,
  initialPresentStudents = [],
  canMark,
  onClose,
  onSaved,
}: Props) {
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
  } = useSlotAttendanceSession({
    active: open,
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

  if (!open || !slot) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              {slot.subjects?.name ?? 'Lesson'} · Block {slot.block_number}
            </h2>
            <p className="text-sm text-zinc-500 mt-0.5">
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
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Session date
            </span>
            <input
              type="date"
              className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />
            <p className="text-[11px] text-zinc-400">
              Change date to mark attendance for another day this term.
            </p>
          </label>

          {error && (
            <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
              {error}
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
                  {initialPresentStudents.length === 1 ? '' : 's'} marked present when this
                  session was submitted.
                </p>
              )}

              <ul className="space-y-1.5 max-h-64 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800">
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

              {isLocked && (
                <p className="text-xs text-zinc-500">
                  Session is {session.status.toLowerCase()} — attendance cannot be edited unless
                  reopened by an admin.
                </p>
              )}
            </>
          ) : null}
        </div>

        <div className="flex gap-2 p-5 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium"
          >
            Close
          </button>
          {canEdit && session && (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave(false)}
                className="flex-1 h-10 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-sm font-semibold disabled:opacity-50"
              >
                Save draft
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave(true)}
                className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Submit
              </button>
            </>
          )}
          {!canEdit && canMark && session?.status === 'DRAFT' && (
            <div className="flex-1 flex items-center gap-1.5 text-xs text-zinc-500 justify-center">
              <UserCheck className="h-4 w-4" />
              View only
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
