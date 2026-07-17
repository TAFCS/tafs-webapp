export function categoryLabel(category: string): string {
  if (category === 'FINANCIAL') return 'Financial';
  if (category === 'GENERAL') return 'General';
  return category.replace(/_/g, ' ');
}

/** List/thread title: student name when set, otherwise FAMILY OF {household}. */
export function ticketRequesterLabel(ticket: {
  students?: { full_name?: string | null } | null;
  families?: { household_name?: string | null } | null;
  family_id?: number;
}): string {
  const studentName = ticket.students?.full_name?.trim();
  if (studentName) return studentName;

  const household = ticket.families?.household_name?.trim();
  if (household) {
    const name = household.replace(/^family\s+of\s+/i, '').trim();
    if (name) return `FAMILY OF ${name.toUpperCase()}`;
  }

  return ticket.family_id != null ? `Family #${ticket.family_id}` : 'Family';
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    OPEN: 'Open',
    ASSIGNED: 'Assigned',
    CLOSED: 'Closed',
    PENDING: 'Pending approval',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
  };
  return map[status] ?? status.replace(/_/g, ' ');
}

export function roleLabel(role: string): string {
  return role.replace(/_/g, ' ');
}
