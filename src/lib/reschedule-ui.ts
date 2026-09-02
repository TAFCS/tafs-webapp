export type RescheduleStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

export const RESCHEDULE_STATUS_STYLES: Record<RescheduleStatus, string> = {
  SCHEDULED:
    'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60',
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
  employeeId?: string | number;
  mode?: 'alevel_makeup' | 'olevel_teacher_makeup';
}): string {
  const q = new URLSearchParams({
    mode: params.mode ?? (params.employeeId ? 'olevel_teacher_makeup' : 'alevel_makeup'),
  });
  if (params.campusId) q.set('campus_id', String(params.campusId));
  if (params.classId) q.set('class_id', String(params.classId));
  if (params.sectionId) q.set('section_id', String(params.sectionId));
  if (params.teachingGroupId) q.set('teaching_group_id', String(params.teachingGroupId));
  if (params.employeeId) q.set('employee_id', String(params.employeeId));
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

export function rescheduleStatusLabel(status: RescheduleStatus): string {
  if (status === 'SCHEDULED') return 'Scheduled';
  if (status === 'COMPLETED') return 'Completed';
  return 'Cancelled';
}
