"use client";

import type { AuditLog } from "@/lib/audit-logs.service";
import { isEmployeeAuditLog } from "@/lib/audit-entity";
import { getSectionColor } from "@/lib/log-colors";

export function AuditLogEntityCell({ log, muted = false }: { log: AuditLog; muted?: boolean }) {
  const sColor = getSectionColor(log.section);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span
        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${muted ? "opacity-80 " : ""}${sColor.bg} ${sColor.text}`}
      >
        {log.entity_type.replace(/_/g, " ")}
      </span>

      {isEmployeeAuditLog(log) ? (
        <>
          {log.employee_name ? (
            <span
              className={`text-xs font-semibold ${muted ? "text-zinc-600 dark:text-zinc-400" : "text-zinc-800 dark:text-zinc-200"}`}
            >
              {log.employee_name}
            </span>
          ) : null}
          {log.employee_code ? (
            <span className="text-[10px] font-mono font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30 px-1.5 py-0.5 rounded">
              {log.employee_code}
            </span>
          ) : null}
          <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
            #{log.employee_id ?? log.entity_id}
          </span>
        </>
      ) : (
        <>
          <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">#{log.entity_id}</span>
          {log.student_id ? (
            <span className="text-[10px] font-mono text-blue-500 bg-blue-50 dark:bg-blue-950/30 px-1 rounded">
              CC {log.student_id}
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}
