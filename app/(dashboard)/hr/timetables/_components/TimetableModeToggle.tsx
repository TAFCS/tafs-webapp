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
    <div className="bg-zinc-100/90 dark:bg-zinc-900/80 p-1.5 rounded-2xl flex border border-zinc-200/90 dark:border-zinc-800/80 max-w-lg shadow-inner">
      <button
        type="button"
        onClick={() => onChange('schedule')}
        className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
          mode === 'schedule'
            ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-md ring-1 ring-zinc-200/60 dark:ring-zinc-700/60 scale-[1.01]'
            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-white/50 dark:hover:bg-zinc-800/40'
        }`}
      >
        <CalendarRange className={`h-4 w-4 ${mode === 'schedule' ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-400'}`} />
        <span>Master Timetable</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('makeup')}
        className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
          mode === 'makeup'
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20 ring-1 ring-indigo-500 scale-[1.01]'
            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-white/50 dark:hover:bg-zinc-800/40'
        }`}
      >
        <CalendarClock className={`h-4 w-4 ${mode === 'makeup' ? 'text-white' : 'text-zinc-400'}`} />
        <span>Makeup & Reschedules</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-md uppercase tracking-wider font-extrabold ${
          mode === 'makeup' ? 'bg-indigo-500/80 text-white' : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
        }`}>
          Active
        </span>
      </button>
    </div>
  );
}
