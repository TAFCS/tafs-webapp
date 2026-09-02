'use client';

import { CalendarRange, CalendarClock, UserCheck } from 'lucide-react';

export type TimetablePageMode =
  | 'schedule'
  | 'alevel_makeup'
  | 'olevel_teacher_makeup';

interface Props {
  mode: TimetablePageMode;
  onChange: (mode: TimetablePageMode) => void;
  showAlevelMakeup: boolean;
  showOlevelTeacherMakeup: boolean;
}

export function TimetableModeToggle({
  mode,
  onChange,
  showAlevelMakeup,
  showOlevelTeacherMakeup,
}: Props) {
  if (!showAlevelMakeup && !showOlevelTeacherMakeup) return null;

  const tabCls = (active: boolean, accent: 'rose' | 'indigo' | 'pink') => {
    if (active) {
      if (accent === 'indigo') {
        return 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20 ring-1 ring-indigo-500 scale-[1.01]';
      }
      if (accent === 'pink') {
        return 'bg-pink-600 text-white shadow-md shadow-pink-500/20 ring-1 ring-pink-500 scale-[1.01]';
      }
      return 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-md ring-1 ring-zinc-200/60 dark:ring-zinc-700/60 scale-[1.01]';
    }
    return 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-white/50 dark:hover:bg-zinc-800/40';
  };

  return (
    <div className="bg-zinc-100/90 dark:bg-zinc-900/80 p-1.5 rounded-2xl flex flex-wrap gap-1 border border-zinc-200/90 dark:border-zinc-800/80 max-w-3xl shadow-inner">
      <button
        type="button"
        onClick={() => onChange('schedule')}
        className={`flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${tabCls(mode === 'schedule', 'rose')}`}
      >
        <CalendarRange
          className={`h-4 w-4 ${mode === 'schedule' ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-400'}`}
        />
        <span>Master Timetable</span>
      </button>

      {showAlevelMakeup && (
        <button
          type="button"
          onClick={() => onChange('alevel_makeup')}
          className={`flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${tabCls(mode === 'alevel_makeup', 'indigo')}`}
        >
          <CalendarClock className="h-4 w-4" />
          <span>A-Level Makeup</span>
        </button>
      )}

      {showOlevelTeacherMakeup && (
        <button
          type="button"
          onClick={() => onChange('olevel_teacher_makeup')}
          className={`flex-1 min-w-[160px] inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${tabCls(mode === 'olevel_teacher_makeup', 'pink')}`}
        >
          <UserCheck className="h-4 w-4" />
          <span>O-Level Teacher Makeup</span>
        </button>
      )}
    </div>
  );
}
