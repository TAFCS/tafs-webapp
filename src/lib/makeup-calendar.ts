/** Calendar helpers for makeup / reschedule week view on timetables. */

import type { SourceDateHoldStatus } from './class-reschedules.service';

export type MakeupSlotCellStatus =
  | 'conducted'
  | 'missed'
  | 'upcoming'
  | 'rescheduled'
  | 'made_up'
  | 'off_day'
  | 'skipped';

export const MAKEUP_STATUS_STYLES: Record<
  MakeupSlotCellStatus,
  { card: string; accent: string; label: string }
> = {
  conducted: {
    card: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-400 dark:border-emerald-600 text-emerald-950 dark:text-emerald-100',
    accent: 'bg-emerald-500',
    label: 'Conducted',
  },
  missed: {
    card: 'bg-rose-50 dark:bg-rose-950/50 border-rose-400 dark:border-rose-600 text-rose-950 dark:text-rose-100',
    accent: 'bg-rose-500',
    label: 'Not conducted',
  },
  upcoming: {
    card: 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 opacity-90',
    accent: 'bg-amber-400',
    label: 'Upcoming',
  },
  rescheduled: {
    card: 'bg-purple-50 dark:bg-purple-950/50 border-purple-400 dark:border-purple-600 text-purple-950 dark:text-purple-100',
    accent: 'bg-purple-500',
    label: 'Rescheduled',
  },
  made_up: {
    card: 'bg-pink-50 dark:bg-pink-950/50 border-pink-400 dark:border-pink-600 text-pink-950 dark:text-pink-100',
    accent: 'bg-pink-500',
    label: 'Made up class',
  },
  off_day: {
    card: 'bg-zinc-100/80 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500',
    accent: 'bg-zinc-300 dark:bg-zinc-600',
    label: 'Off day',
  },
  skipped: {
    card: 'bg-zinc-100 dark:bg-zinc-800/60 border-zinc-300 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400',
    accent: 'bg-zinc-400',
    label: 'Skipped',
  },
};

export function academicYearAugustFirst(academicYear: string): string {
  const startYear = academicYear.split('-')[0]?.trim() ?? String(new Date().getUTCFullYear());
  return `${startYear}-08-01`;
}

/** Monday (UTC) of the week containing `iso`. */
export function getMondayUtc(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  const dow = d.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Mon–Sat dates for a week starting on Monday (UTC). */
export function weekDatesFromMonday(mondayIso: string): string[] {
  const base = new Date(`${mondayIso}T00:00:00.000Z`);
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

/**
 * Earliest Monday whose week includes at least one day on or after 1 August
 * for the given academic year (e.g. 2026-2027 → Aug 2026).
 */
export function minWeekMondayForAcademicYear(academicYear: string): string {
  const aug1Iso = academicYearAugustFirst(academicYear);
  const aug1 = new Date(`${aug1Iso}T00:00:00.000Z`);
  let monday = new Date(`${getMondayUtc(aug1Iso)}T00:00:00.000Z`);

  while (true) {
    const saturday = new Date(monday);
    saturday.setUTCDate(monday.getUTCDate() + 5);
    if (monday >= aug1 || saturday >= aug1) {
      return monday.toISOString().slice(0, 10);
    }
    monday.setUTCDate(monday.getUTCDate() + 7);
  }
}

export function clampWeekMonday(mondayIso: string, academicYear: string): string {
  const min = minWeekMondayForAcademicYear(academicYear);
  return mondayIso < min ? min : mondayIso;
}

export function isDateBeforeAugust(iso: string, academicYear: string): boolean {
  return iso < academicYearAugustFirst(academicYear);
}

export function cellStatusKey(slotId: number, dateIso: string): string {
  return `${slotId}|${dateIso}`;
}

export function blockCellStatusKey(blockNumber: number, dateIso: string): string {
  return `block:${blockNumber}|${dateIso}`;
}

export type MakeupCalendarOverlay = {
  dateIso: string;
  blockNumber: number;
  status: MakeupSlotCellStatus;
  rescheduleId: number;
};

export function resolveMakeupOverlayStatus(
  row: {
    status: string;
    makeup_date: string;
    makeup_roll_session?: { status: string } | null;
  },
  todayIso: string = todayIsoUtc(),
): MakeupSlotCellStatus {
  const makeupIso = rescheduleDateIso(row.makeup_date);
  if (row.status === 'COMPLETED' || row.makeup_roll_session?.status === 'SUBMITTED') {
    return 'made_up';
  }
  if (makeupIso >= todayIso) return 'upcoming';
  return 'missed';
}

export function hasRecurringSlotOnDate(
  slots: Array<{ day_of_week: number; block_number: number }>,
  dateIso: string,
  blockNumber: number,
): boolean {
  const dow = new Date(`${dateIso}T00:00:00.000Z`).getUTCDay();
  return slots.some((s) => s.day_of_week === dow && s.block_number === blockNumber);
}

export function formatWeekRangeLabel(mondayIso: string): string {
  const monday = new Date(`${mondayIso}T00:00:00.000Z`);
  const saturday = new Date(monday);
  saturday.setUTCDate(monday.getUTCDate() + 5);
  const start = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const end = saturday.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `${start} – ${end}`;
}

export function formatDayHeader(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).toUpperCase();
}

export type RescheduleCellRole = {
  role: 'source' | 'makeup';
  status: 'SCHEDULED' | 'COMPLETED';
};

export function rescheduleDateIso(value: string): string {
  return value.slice(0, 10);
}

export function todayIsoUtc(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function isValidRescheduleRow(
  row: { source_date: string; makeup_date: string; status: string },
  todayIso: string = todayIsoUtc(),
): boolean {
  if (row.status === 'CANCELLED') return false;
  const src = rescheduleDateIso(row.source_date);
  const makeup = rescheduleDateIso(row.makeup_date);
  if (src >= todayIso) return false;
  if (src >= makeup) return false;
  return true;
}

export function getRescheduleInvalidReason(
  row: { source_date: string; makeup_date: string; status: string },
  todayIso: string = todayIsoUtc(),
): string | null {
  if (row.status === 'CANCELLED') return null;
  const src = rescheduleDateIso(row.source_date);
  const makeup = rescheduleDateIso(row.makeup_date);
  if (src >= todayIso) {
    return 'Original date is in the future — this lesson has not happened yet.';
  }
  if (src >= makeup) {
    return 'Makeup date is before the missed lesson — cancel and recreate.';
  }
  return null;
}

export function resolveMakeupCellStatus(
  hold: SourceDateHoldStatus,
  reschedule?: RescheduleCellRole,
): MakeupSlotCellStatus {
  if (hold === 'upcoming') return 'upcoming';
  if (hold === 'off_day') return 'off_day';
  if (hold === 'skipped') return 'skipped';

  if (reschedule?.role === 'source') {
    if (hold === 'held' || reschedule.status === 'COMPLETED') return 'conducted';
    if (hold === 'missed' || hold === 'skipped') return 'rescheduled';
  }

  if (reschedule?.role === 'makeup' && reschedule.status === 'COMPLETED') {
    return 'made_up';
  }

  if (hold === 'held') return 'conducted';

  return 'missed';
}
