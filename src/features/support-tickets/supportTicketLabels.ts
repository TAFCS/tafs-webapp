export function categoryLabel(category: string): string {
  if (category === 'FINANCIAL') return 'Financial';
  if (category === 'GENERAL') return 'General';
  return category.replace(/_/g, ' ');
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
