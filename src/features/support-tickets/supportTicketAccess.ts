import type { StaffUser } from '@/store/slices/authSlice';

export const SUPPORT_TICKETS_VIEW_PERMISSION = 'communication.support_tickets.view';

const SUPPORT_TICKET_RESPONDER_ROLES = new Set([
  'GENERAL_RESPONDENT',
  'PRINCIPAL',
  'FINANCE_CLERK',
  'CAMPUS_ADMIN',
  'SUPER_ADMIN',
]);

export function canViewSupportTickets(user: Pick<StaffUser, 'role' | 'permissions'> | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  if (user.permissions?.includes(SUPPORT_TICKETS_VIEW_PERMISSION)) return true;
  return SUPPORT_TICKET_RESPONDER_ROLES.has(user.role);
}
