"use client";

import { useMemo, useState } from "react";
import { Plus, ChevronLeft, ChevronRight, Calendar, User, Info, MapPin } from "lucide-react";
import type { TimetableBlock, TimetableSlot } from "@/lib/timetables.service";

const DAYS: Array<{ dow: number; label: string }> = [
  { dow: 1, label: "Mon" },
  { dow: 2, label: "Tue" },
  { dow: 3, label: "Wed" },
  { dow: 4, label: "Thu" },
  { dow: 5, label: "Fri" },
  { dow: 6, label: "Sat" },
];

function formatBlockTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const hour12 = ((h + 11) % 12) + 1;
  const suffix = h < 12 ? "am" : "pm";
  return m === 0 ? `${hour12}${suffix}` : `${hour12}:${String(m).padStart(2, "0")}${suffix}`;
}

export function blockDisplayLabel(block: TimetableBlock): string {
  if (block.label) return block.label;
  return `${formatBlockTime(block.start_time)}–${formatBlockTime(block.end_time)}`;
}

export type TimetableGridInteractionMode = 'edit' | 'makeup' | 'view';

interface Props {
  blocks: TimetableBlock[];
  slots: TimetableSlot[];
  canEdit: boolean;
  interactionMode?: TimetableGridInteractionMode;
  pendingSlotIds?: number[];
  selectedMakeupSlotIds?: number[];
  activeWeekDateIso?: string;
  onActiveWeekDateChange?: (dateIso: string) => void;
  onAdd: (dayOfWeek: number, blockNumber: number, slotOrder: number) => void;
  onEdit: (slot: TimetableSlot) => void;
  onMakeupSlot?: (slot: TimetableSlot) => void;
}

function getMondayOfDate(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

function formatDateMonthDay(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}

function getSubjectTheme(name?: string) {
  if (!name) {
    return {
      card: "bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60 text-indigo-950 dark:text-indigo-100",
      accent: "bg-indigo-500",
      tag: "bg-indigo-100/90 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300",
    };
  }
  const lower = name.toLowerCase();
  if (lower.includes('comp') || lower.includes('cs') || lower.includes('it') || lower.includes('code')) {
    return {
      card: "bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700/80 text-indigo-950 dark:text-indigo-100",
      accent: "bg-indigo-600",
      tag: "bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300",
    };
  }
  if (lower.includes('math') || lower.includes('stat') || lower.includes('alg')) {
    return {
      card: "bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/80 text-emerald-950 dark:text-emerald-100",
      accent: "bg-emerald-600",
      tag: "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300",
    };
  }
  if (lower.includes('phy') || lower.includes('sci')) {
    return {
      card: "bg-purple-50/90 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700/80 text-purple-950 dark:text-purple-100",
      accent: "bg-purple-600",
      tag: "bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300",
    };
  }
  if (lower.includes('chem') || lower.includes('bio')) {
    return {
      card: "bg-teal-50/90 dark:bg-teal-950/40 border-teal-300 dark:border-teal-700/80 text-teal-950 dark:text-teal-100",
      accent: "bg-teal-600",
      tag: "bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300",
    };
  }
  if (lower.includes('econ') || lower.includes('acc') || lower.includes('bus')) {
    return {
      card: "bg-sky-50/90 dark:bg-sky-950/40 border-sky-300 dark:border-sky-700/80 text-sky-950 dark:text-sky-100",
      accent: "bg-sky-600",
      tag: "bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-300",
    };
  }
  if (lower.includes('eng') || lower.includes('lit') || lower.includes('lang')) {
    return {
      card: "bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/80 text-amber-950 dark:text-amber-100",
      accent: "bg-amber-600",
      tag: "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300",
    };
  }
  return {
    card: "bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700/80 text-rose-950 dark:text-rose-100",
    accent: "bg-rose-600",
    tag: "bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300",
  };
}

export function TimetableGrid({
  blocks,
  slots,
  canEdit,
  interactionMode = 'edit',
  pendingSlotIds = [],
  selectedMakeupSlotIds = [],
  activeWeekDateIso,
  onActiveWeekDateChange,
  onAdd,
  onEdit,
  onMakeupSlot,
}: Props) {
  const isMakeup = interactionMode === 'makeup';
  const pendingSet = useMemo(() => new Set(pendingSlotIds), [pendingSlotIds]);
  const selectedSet = useMemo(() => new Set(selectedMakeupSlotIds), [selectedMakeupSlotIds]);

  const [internalWeekDate, setInternalWeekDate] = useState(() => new Date());

  const activeDate = useMemo(() => {
    if (activeWeekDateIso) {
      const parsed = new Date(`${activeWeekDateIso}T00:00:00.000Z`);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return internalWeekDate;
  }, [activeWeekDateIso, internalWeekDate]);

  const mondayDate = useMemo(() => getMondayOfDate(activeDate), [activeDate]);

  const weekDays = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    return DAYS.map((d, index) => {
      const dateObj = new Date(mondayDate);
      dateObj.setDate(mondayDate.getDate() + index);
      const iso = dateObj.toISOString().slice(0, 10);
      const isToday = iso === todayIso;
      return {
        ...d,
        dateObj,
        iso,
        dateFormatted: formatDateMonthDay(dateObj),
        isToday,
      };
    });
  }, [mondayDate]);

  const weekRangeLabel = useMemo(() => {
    const start = mondayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endDate = new Date(mondayDate);
    endDate.setDate(mondayDate.getDate() + 5);
    const end = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${start} – ${end}`;
  }, [mondayDate]);

  const handlePrevWeek = () => {
    const prev = new Date(mondayDate);
    prev.setDate(mondayDate.getDate() - 7);
    const iso = prev.toISOString().slice(0, 10);
    setInternalWeekDate(prev);
    onActiveWeekDateChange?.(iso);
  };

  const handleNextWeek = () => {
    const next = new Date(mondayDate);
    next.setDate(mondayDate.getDate() + 7);
    const iso = next.toISOString().slice(0, 10);
    setInternalWeekDate(next);
    onActiveWeekDateChange?.(iso);
  };

  const handleTodayWeek = () => {
    const now = new Date();
    const iso = now.toISOString().slice(0, 10);
    setInternalWeekDate(now);
    onActiveWeekDateChange?.(iso);
  };

  function slotsFor(day: number, block: number): TimetableSlot[] {
    return slots
      .filter((s) => s.day_of_week === day && s.block_number === block)
      .sort((a, b) => a.slot_order - b.slot_order);
  }

  return (
    <div className="space-y-3">
      {/* Week Navigation Toolbar for Makeup Mode */}
      {isMakeup && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/60 p-3 rounded-2xl">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
              <Calendar className="w-4 h-4" />
            </span>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Reschedule Calendar View
              </div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Week of {weekRangeLabel}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevWeek}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev Week
            </button>
            <button
              type="button"
              onClick={handleTodayWeek}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNextWeek}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            >
              Next Week
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Timetable Grid */}
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm dark:shadow-none">
        <table className="w-full min-w-[850px] border-collapse text-sm">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-800/80">
              <th className="sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-800/80 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 border-b border-r border-zinc-200 dark:border-zinc-700/80 w-28">
                Block / Period
              </th>
              {isMakeup
                ? weekDays.map((d) => (
                    <th
                      key={d.dow}
                      className={`px-3 py-2.5 text-center border-b border-zinc-200 dark:border-zinc-700/80 transition-colors ${
                        d.isToday
                          ? "bg-indigo-100/60 dark:bg-indigo-900/40 text-indigo-900 dark:text-indigo-200 font-extrabold"
                          : "text-zinc-600 dark:text-zinc-300"
                      }`}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                          {d.label}
                          {d.isToday && (
                            <span className="px-1.5 py-0.2 text-[8px] font-black tracking-normal bg-indigo-600 text-white rounded-full">
                              TODAY
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                          {d.dateFormatted}
                        </div>
                      </div>
                    </th>
                  ))
                : DAYS.map((d) => (
                    <th
                      key={d.dow}
                      className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700/80"
                    >
                      {d.label}
                    </th>
                  ))}
            </tr>
          </thead>
          <tbody>
            {blocks.map((block, idx) =>
              block.is_break ? (
                <tr key={block.block_number} className="bg-zinc-100/80 dark:bg-zinc-800/60">
                  <td
                    colSpan={DAYS.length + 1}
                    className="px-4 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800"
                  >
                    {block.label || "Break"} · {blockDisplayLabel(block)}
                  </td>
                </tr>
              ) : (
                <tr
                  key={block.block_number}
                  className={`align-top ${idx % 2 === 1 ? "bg-zinc-50/40 dark:bg-zinc-800/20" : ""}`}
                >
                  {/* Block label column */}
                  <td className="sticky left-0 z-10 bg-white dark:bg-zinc-900 px-4 py-3 border-b border-r border-zinc-200 dark:border-zinc-800 min-w-[6.5rem]">
                    <div className="text-sm font-extrabold text-zinc-850 dark:text-zinc-100 tabular-nums">
                      Block {block.block_number}
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap mt-0.5 font-medium">
                      {blockDisplayLabel(block)}
                    </div>
                  </td>

                  {/* Day cells */}
                  {DAYS.map((d) => {
                    const cellSlots = slotsFor(d.dow, block.block_number);
                    const maxSlotOrder = cellSlots.reduce((max, s) => Math.max(max, s.slot_order), 0);
                    const nextSlotOrder = maxSlotOrder + 1;

                    return (
                      <td
                        key={`${d.dow}-${block.block_number}`}
                        className="px-2 py-2 border-b border-zinc-200 dark:border-zinc-800 min-w-[145px]"
                      >
                        <div className="flex flex-col gap-1.5 min-h-[58px]">
                          {cellSlots.map((slot) => {
                            const hasPending = pendingSet.has(slot.id);
                            const isSelected = selectedSet.has(slot.id);
                            const slotClickable = isMakeup ? Boolean(onMakeupSlot) : canEdit;
                            const theme = getSubjectTheme(slot.subjects?.name);

                            return (
                              <button
                                key={slot.id}
                                type="button"
                                disabled={!slotClickable}
                                onClick={() => {
                                  if (isMakeup && onMakeupSlot) onMakeupSlot(slot);
                                  else if (canEdit) onEdit(slot);
                                }}
                                className={`text-left rounded-xl p-2.5 border text-[11px] leading-snug transition-all relative group overflow-hidden ${
                                  isMakeup
                                    ? isSelected
                                      ? "border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 ring-2 ring-indigo-500/50 shadow-sm cursor-pointer scale-[1.01]"
                                      : hasPending
                                        ? "border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/50 hover:border-amber-500 cursor-pointer shadow-2xs"
                                        : `${theme.card} hover:brightness-95 dark:hover:brightness-110 cursor-pointer hover:shadow-sm`
                                    : canEdit
                                    ? `${theme.card} hover:-translate-y-0.5 hover:shadow-md cursor-pointer active:scale-[0.98]`
                                    : `${theme.card} opacity-90 cursor-default`
                                }`}
                              >
                                {/* Left accent bar */}
                                <span className={`absolute left-0 top-0 bottom-0 w-1 ${theme.accent}`} />

                                {hasPending && isMakeup && (
                                  <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                                  </span>
                                )}

                                <div className="pl-1.5">
                                  <div className="font-extrabold truncate tracking-tight uppercase text-[10.5px]">
                                    {slot.subjects?.name ?? `Subject #${slot.subject_id}`}
                                  </div>
                                  <div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-300 truncate mt-1 text-[10px] font-medium">
                                    <User className="w-3 h-3 text-zinc-400 shrink-0" />
                                    <span className="truncate">{slot.employee_profiles?.full_name ?? `Teacher #${slot.employee_id}`}</span>
                                  </div>
                                  {slot.room && (
                                    <div className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-bold text-zinc-700 dark:text-zinc-300 bg-black/5 dark:bg-white/10 rounded-md px-1.5 py-0.5 uppercase tracking-wider">
                                      <MapPin className="w-2.5 h-2.5" />
                                      {slot.room}
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })}

                          {!isMakeup && canEdit && cellSlots.length === 0 && (
                            <button
                              type="button"
                              onClick={() => onAdd(d.dow, block.block_number, 1)}
                              className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700/80 text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-400 dark:hover:border-rose-600 hover:bg-rose-50/70 dark:hover:bg-rose-950/20 text-[11px] font-medium py-3 transition-all min-h-[58px]"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add Period
                            </button>
                          )}

                          {!isMakeup && canEdit && maxSlotOrder >= 1 && maxSlotOrder < 3 && (
                            <button
                              type="button"
                              onClick={() => onAdd(d.dow, block.block_number, nextSlotOrder)}
                              className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-400 dark:hover:border-rose-600 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 text-[10px] py-1 transition-all"
                            >
                              <Plus className="w-3 h-3" />
                              Add Split
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      {/* Grid Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400 px-2 py-1">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Subject Class Slot</span>
          </span>
          {isMakeup && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 ring-2 ring-indigo-300" />
                <span className="font-medium text-indigo-700 dark:text-indigo-300">Selected for Makeup</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="font-medium text-amber-700 dark:text-amber-300">Pending Reschedule</span>
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-zinc-400">
          <Info className="w-3.5 h-3.5" />
          {isMakeup ? "Click any slot to select it for makeup scheduling" : "Click any slot to edit or remove"}
        </div>
      </div>
    </div>
  );
}

export { DAYS };
