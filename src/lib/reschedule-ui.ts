export type RescheduleStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export const RESCHEDULE_STATUS_STYLES: Record<RescheduleStatus, string> = {
  PENDING:
    'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
  COMPLETED:
    'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
  CANCELLED:
    'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700',
};

export function formatRescheduleDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function timetablesMakeupHref(params: {
  campusId?: string | number;
  classId?: string | number;
  sectionId?: string | number;
  teachingGroupId?: string | number;
}): string {
  const q = new URLSearchParams({ mode: 'makeup' });
  if (params.campusId) q.set('campus_id', String(params.campusId));
  if (params.classId) q.set('class_id', String(params.classId));
  if (params.sectionId) q.set('section_id', String(params.sectionId));
  if (params.teachingGroupId) q.set('teaching_group_id', String(params.teachingGroupId));
  return `/hr/timetables?${q.toString()}`;
}

export function rollCallMakeupHref(params: {
  makeupDate: string;
  teachingGroupId: number;
  classId: number;
  campusId?: number;
}): string {
  const q = new URLSearchParams({
    makeup: '1',
    date: params.makeupDate.slice(0, 10),
    teaching_group_id: String(params.teachingGroupId),
    class_id: String(params.classId),
  });
  if (params.campusId) q.set('campus_id', String(params.campusId));
  return `/hr/roll-call?${q.toString()}`;
}
