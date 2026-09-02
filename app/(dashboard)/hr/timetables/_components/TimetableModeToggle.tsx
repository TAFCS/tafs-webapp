'use client';

import { CalendarRange, CalendarClock } from 'lucide-react';

export type TimetablePageMode = 'schedule' | 'makeup';

interface Props {
  mode: TimetablePageMode;
  onChange: (mode: TimetablePageMode) => void;
  showMakeup: boolean;
}

export function TimetableModeToggle({ mode, onChange, showMakeup }: Props) {
  if (!showMakeup) return null;

  return (
    <div className="bg-zinc-100 dark:bg-zinc-900/60 p-1.5 rounded-2xl flex border border-zinc-200/80 dark:border-zinc-800 max-w-md">
      <button
        type="button"
        onClick={() => onChange('schedule')}
        className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
          mode === 'schedule'
            ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm'
            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
        }`}
      >
        <CalendarRange className="h-4 w-4" />
        Schedule
      </button>
      <button
        type="button"
        onClick={() => onChange('makeup')}
        className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
          mode === 'makeup'
            ? 'bg-white dark:bg-zinc-800 text-indigo-700 dark:text-indigo-300 shadow-sm'
            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
        }`}
      >
        <CalendarClock className="h-4 w-4" />
        Makeup & Reschedules
      </button>
    </div>
  );
}
