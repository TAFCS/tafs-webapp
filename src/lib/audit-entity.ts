import type { AuditLog } from "./audit-logs.service";

const EMPLOYEE_ENTITY_TYPES = new Set(["STAFF_ATTENDANCE", "EMPLOYEE"]);

export function isEmployeeAuditLog(log: Pick<AuditLog, "entity_type">): boolean {
  return EMPLOYEE_ENTITY_TYPES.has(log.entity_type);
}

/** Primary label for the person referenced by an audit row (staff attendance, employee profile, etc.). */
export function formatAuditEntitySubject(log: AuditLog): string | null {
  if (isEmployeeAuditLog(log)) {
    const name = log.employee_name?.trim();
    const code = log.employee_code?.trim();
    if (name && code) return `${name} (${code})`;
    if (name) return name;
    if (code) return code;
  }
  return null;
}
