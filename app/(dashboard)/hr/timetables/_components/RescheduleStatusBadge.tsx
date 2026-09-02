import {
  RESCHEDULE_STATUS_STYLES,
  rescheduleStatusLabel,
  type RescheduleStatus,
} from '@/lib/reschedule-ui';

interface Props {
  status: RescheduleStatus;
  className?: string;
}

export function RescheduleStatusBadge({ status, className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full border font-bold uppercase tracking-wider ${RESCHEDULE_STATUS_STYLES[status]} ${className}`}
    >
      {status === 'COMPLETED' && (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      )}
      {status === 'CANCELLED' && (
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
      )}
      {rescheduleStatusLabel(status)}
    </span>
  );
}
