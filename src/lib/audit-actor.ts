export type AuditActorLike = {
  changed_by: string;
  changed_by_display?: string | null;
};

/** Prefer API-resolved full name; fall back to stored actor id/username. */
export function formatAuditActor(log: AuditActorLike): string {
  return log.changed_by_display?.trim() || log.changed_by;
}

/** Show @username only when display differs from the raw stored value. */
export function formatAuditActorWithHandle(log: AuditActorLike): string {
  const display = formatAuditActor(log);
  const raw = log.changed_by?.trim();
  if (raw && display !== raw && !raw.includes(' ')) {
    return `${display} (@${raw})`;
  }
  return display;
}
