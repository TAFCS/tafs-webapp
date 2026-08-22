"use client";

import { AlertTriangle, WifiOff } from "lucide-react";
import { StudentAttendanceLine } from "@/lib/attendance.service";

/**
 * Why a student's row may have no punches at all — shown on the lines table,
 * the punch matrix and the detail modal so the reason travels with the student
 * instead of looking like missing data.
 */
export function StudentLineTags({
  line,
  className = "",
}: {
  line: Pick<StudentAttendanceLine, "is_mapped" | "has_punches">;
  className?: string;
}) {
  const base = "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide whitespace-nowrap";

  if (!line.is_mapped) {
    return (
      <span className={`${base} bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 ${className}`}>
        <WifiOff className="h-2.5 w-2.5 shrink-0" /> Not Mapped
      </span>
    );
  }
  if (!line.has_punches) {
    return (
      <span className={`${base} bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 ${className}`}>
        <AlertTriangle className="h-2.5 w-2.5 shrink-0" /> No Punches
      </span>
    );
  }
  return null;
}
