import { RESCHEDULE_STATUS_STYLES, type RescheduleStatus } from '@/lib/reschedule-ui';

interface Props {
  status: RescheduleStatus;
  className?: string;
}

export function RescheduleStatusBadge({ status, className = '' }: Props) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full border font-medium ${RESCHEDULE_STATUS_STYLES[status]} ${className}`}
    >
      {status}
    </span>
  );
}
