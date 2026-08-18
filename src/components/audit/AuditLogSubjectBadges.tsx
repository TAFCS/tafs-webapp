"use client";

import type { AuditLog } from "@/lib/audit-logs.service";
import { isEmployeeAuditLog } from "@/lib/audit-entity";

export type AuditEmployeeSubject = {
  id: string;
  name?: string | null;
  code?: string | null;
};

export function employeeSubjectFromLog(log: AuditLog): AuditEmployeeSubject | null {
  if (!isEmployeeAuditLog(log)) return null;
  return {
    id: log.employee_id != null ? String(log.employee_id) : log.entity_id,
    name: log.employee_name,
    code: log.employee_code,
  };
}

/** Compact name + code chips for dashboard activity rows. */
export function AuditLogSubjectBadges({
  employees = [],
  entityIds = [],
  studentIds = [],
  max = 5,
}: {
  employees?: AuditEmployeeSubject[];
  entityIds?: string[];
  studentIds?: number[];
  max?: number;
}) {
  if (employees.length > 0) {
    const shown = employees.slice(0, max);
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {shown.map((emp) => (
          <span
            key={emp.id}
            className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-950/30 text-violet-800 dark:text-violet-200"
          >
            {emp.name ? <span>{emp.name}</span> : null}
            {emp.code ? (
              <span className="font-mono font-bold text-violet-600 dark:text-violet-300">{emp.code}</span>
            ) : null}
            {!emp.name && !emp.code ? (
              <span className="font-mono font-bold text-zinc-500">#{emp.id}</span>
            ) : (
              <span className="font-mono text-zinc-400 dark:text-zinc-500">#{emp.id}</span>
            )}
          </span>
        ))}
        {employees.length > max && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
            +{employees.length - max} more
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {entityIds.slice(0, max).map((id) => (
        <span
          key={id}
          className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
        >
          #{id}
        </span>
      ))}
      {entityIds.length > max && (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
          +{entityIds.length - max} more
        </span>
      )}
      {studentIds.slice(0, 3).map((cc) => (
        <span key={cc} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
          CC {cc}
        </span>
      ))}
    </div>
  );
}

/** Inline subject label for a single attendance activity row. */
export function AuditLogSubjectLine({ log }: { log: AuditLog }) {
  const emp = employeeSubjectFromLog(log);
  if (emp?.name || emp?.code) {
    return (
      <span className="text-[11px] text-zinc-600 dark:text-zinc-400">
        {emp.name ? <span className="font-semibold text-zinc-800 dark:text-zinc-200">{emp.name}</span> : null}
        {emp.name && emp.code ? " · " : null}
        {emp.code ? <span className="font-mono font-bold text-violet-600 dark:text-violet-400">{emp.code}</span> : null}
        {(emp.name || emp.code) && emp.id ? (
          <>
            {" · "}
            <span className="font-mono text-zinc-400">#{emp.id}</span>
          </>
        ) : null}
      </span>
    );
  }

  if (log.student_id) {
    return <span className="text-[11px] font-mono font-bold text-primary">CC {log.student_id}</span>;
  }

  return <span className="text-[11px] font-mono text-zinc-400">#{log.entity_id}</span>;
}
