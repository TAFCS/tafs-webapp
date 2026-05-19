"use client";

import { CalendarClock } from "lucide-react";

export default function LeaveStubPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <div className="p-2.5 bg-primary/10 rounded-xl">
          <CalendarClock className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Leave Management</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Leave applications and requests (Phase 3)</p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col items-center justify-center h-64 text-center">
        <CalendarClock className="h-10 w-10 text-zinc-400 mb-2" />
        <h3 className="font-semibold text-zinc-900 dark:text-white">Under Construction</h3>
        <p className="text-sm text-zinc-500 max-w-sm mt-1">
          Leave management features are planned for Phase 3. 
        </p>
      </div>
    </div>
  );
}
