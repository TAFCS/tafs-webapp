'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { TimetableSlot } from '@/lib/timetables.service';
import { staffLessonReschedulesService } from '@/lib/staff-lesson-reschedules.service';
import { generateWeekdayOccurrences } from '@/lib/weekday-dates';
import { formatRescheduleDate } from '@/lib/reschedule-ui';
import { DAYS } from './TimetableGrid';

interface Props {
  open: boolean;
  slot: TimetableSlot | null;
  campusId: number;
  classId: number;
  sectionId: number;
  effectiveFrom: string | null;
  onClose: () => void;
  onCreated: () => void;
  defaultSourceDate?: string;
}

export function SlotMakeupModal({
  open,
  slot,
  campusId,
  classId,
  sectionId,
  effectiveFrom,
  onClose,
  onCreated,
  defaultSourceDate,
}: Props) {
  const [sourceDate, setSourceDate] = useState('');
  const [makeupDate, setMakeupDate] = useState('');
  const [staffHint, setStaffHint] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayLabel = slot
    ? DAYS.find((d) => d.dow === slot.day_of_week)?.label ?? `Day ${slot.day_of_week}`
    : '';

  const sourceDateOptions = useMemo(() => {
    if (!slot) return [];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const to = new Date(today);
    to.setUTCDate(to.getUTCDate() - 1);
    const minIso = effectiveFrom && effectiveFrom > '2026-08-01' ? effectiveFrom : '2026-08-01';
    return generateWeekdayOccurrences(
      slot.day_of_week,
      minIso,
      to.toISOString().slice(0, 10),
    ).reverse();
  }, [slot, effectiveFrom]);

  useEffect(() => {
    if (!open || !slot) return;
    const preferred =
      defaultSourceDate && sourceDateOptions.includes(defaultSourceDate)
        ? defaultSourceDate
        : sourceDateOptions[0] ?? '';
    setSourceDate(preferred);
    setMakeupDate(new Date().toISOString().slice(0, 10));
    setStaffHint(null);
    setError(null);
  }, [open, slot, sourceDateOptions, defaultSourceDate]);

  useEffect(() => {
    if (!open || !slot || !sourceDate) {
      setStaffHint(null);
      return;
    }
    void staffLessonReschedulesService
      .getSourceDateStatus({
        employee_id: slot.employee_id,
        source_timetable_slot_id: slot.id,
        source_date: sourceDate,
      })
      .then((s) => {
        if (s.staff_status) {
          setStaffHint(
            `Staff register on missed day: ${s.staff_status}${s.staff_notes ? ` — ${s.staff_notes}` : ''}`,
          );
        } else {
          setStaffHint('Staff register on missed day: unmarked');
        }
      })
      .catch(() => setStaffHint(null));
  }, [open, slot, sourceDate]);

  if (!open || !slot) return null;

  const handleSave = async () => {
    if (!sourceDate || !makeupDate) return;
    setSaving(true);
    setError(null);
    try {
      await staffLessonReschedulesService.create({
        employee_id: slot.employee_id,
        campus_id: campusId,
        class_id: classId,
        section_id: sectionId,
        source_timetable_slot_id: slot.id,
        source_date: sourceDate,
        makeup_date: makeupDate,
      });
      onCreated();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to create reschedule.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Schedule makeup</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              {dayLabel} · Period {slot.block_number} · {slot.subjects?.name ?? 'Lesson'}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {slot.employee_profiles?.full_name ?? `Teacher #${slot.employee_id}`}
            </p>
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

        <div className="p-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Missed date</span>
            <select
              className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
              value={sourceDate}
              onChange={(e) => setSourceDate(e.target.value)}
            >
              {sourceDateOptions.map((d) => (
                <option key={d} value={d}>
                  {formatRescheduleDate(d)}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Makeup date</span>
            <input
              type="date"
              className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
              value={makeupDate}
              onChange={(e) => setMakeupDate(e.target.value)}
            />
          </label>

          {staffHint && <p className="text-xs text-zinc-500 dark:text-zinc-400">{staffHint}</p>}
        </div>

        <div className="flex gap-2 p-5 border-t border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !sourceDate || !makeupDate}
            onClick={() => void handleSave()}
            className="flex-1 h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save pending
          </button>
        </div>
      </div>
    </div>
  );
}
