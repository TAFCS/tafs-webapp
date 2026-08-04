"use client";

import { CalendarClock } from "lucide-react";
import { ShiftHolidayOverridesPanel } from "../../_components/ShiftHolidayOverridesPanel";

interface Props {
  employeeId: number;
  employeeName: string;
  isSuperAdmin: boolean;
}

export function EmployeeShiftOverridesTab({ employeeId, employeeName, isSuperAdmin }: Props) {
  return (
    <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
      <h3 className="text-[15px] font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-1">
        <CalendarClock className="h-4 w-4" /> Shift &amp; holiday overrides
      </h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
        Override {employeeName}'s expected check-in/check-out time, or mark specific day(s) as a holiday or
        working-day override, for this employee only.
      </p>

      <ShiftHolidayOverridesPanel
        employeeIds={[employeeId]}
        employeeName={employeeName}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  );
}
