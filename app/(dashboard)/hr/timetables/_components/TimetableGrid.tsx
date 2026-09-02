"use client";

import { useMemo } from "react";
import { Plus, ChevronLeft, ChevronRight, Calendar, User, Info, MapPin, Loader2 } from "lucide-react";
import type { TimetableBlock, TimetableSlot } from "@/lib/timetables.service";
import {
  MAKEUP_STATUS_STYLES,
  type MakeupCalendarOverlay,
  type MakeupSlotCellStatus,
  blockCellStatusKey,
  cellStatusKey,
  clampWeekMonday,
  formatDayHeader,
  formatWeekRangeLabel,
  getMondayUtc,
  isDateBeforeAugust,
  minWeekMondayForAcademicYear,
  weekDatesFromMonday,
} from "@/lib/makeup-calendar";

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

export type TimetableGridInteractionMode = "edit" | "makeup" | "view";

interface Props {
  blocks: TimetableBlock[];
  slots: TimetableSlot[];
  canEdit: boolean;
  interactionMode?: TimetableGridInteractionMode;
  pendingSlotIds?: number[];
  selectedMakeupSlotIds?: number[];
  selectedMakeupCell?: { slotId?: number | null; blockNumber?: number; dateIso: string } | null;
  makeupOverlays?: MakeupCalendarOverlay[];
  selectedAttendanceCell?: { slotId: number; dateIso: string } | null;
  academicYear?: string;
  activeWeekDateIso?: string;
  onActiveWeekDateChange?: (mondayIso: string) => void;
  statusByCell?: Record<string, MakeupSlotCellStatus>;
  statusLoading?: boolean;
  statusWeekRefreshing?: boolean;
  onAdd: (dayOfWeek: number, blockNumber: number, slotOrder: number) => void;
  onEdit: (slot: TimetableSlot) => void;
  onMakeupSlot?: (slot: TimetableSlot, dateIso: string) => void;
}

function getSubjectTheme(name?: string) {
  if (!name) {
    return {
      card: "bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60 text-indigo-950 dark:text-indigo-100",
      accent: "bg-indigo-500",
    };
  }
  const lower = name.toLowerCase();
  if (lower.includes("comp") || lower.includes("cs") || lower.includes("it")) {
    return {
      card: "bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700/80 text-indigo-950 dark:text-indigo-100",
      accent: "bg-indigo-600",
    };
  }
  return {
    card: "bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700/80 text-rose-950 dark:text-rose-100",
    accent: "bg-rose-600",
  };
}

export function TimetableGrid({
  blocks,
  slots,
  canEdit,
  interactionMode = "edit",
  pendingSlotIds = [],
  selectedMakeupSlotIds = [],
  selectedMakeupCell = null,
  makeupOverlays = [],
  selectedAttendanceCell = null,
  academicYear,
  activeWeekDateIso,
  onActiveWeekDateChange,
  statusByCell = {},
  statusLoading = false,
  statusWeekRefreshing = false,
  onAdd,
  onEdit,
  onMakeupSlot,
}: Props) {
  const isMakeup = interactionMode === "makeup";
  const pendingSet = useMemo(() => new Set(pendingSlotIds), [pendingSlotIds]);
  const selectedSet = useMemo(() => new Set(selectedMakeupSlotIds), [selectedMakeupSlotIds]);

  const minMondayIso = useMemo(
    () => (academicYear ? minWeekMondayForAcademicYear(academicYear) : null),
    [academicYear],
  );

  const mondayIso = useMemo(() => {
    const base = activeWeekDateIso ?? new Date().toISOString().slice(0, 10);
    const mon = getMondayUtc(base);
    if (academicYear) return clampWeekMonday(mon, academicYear);
    return mon;
  }, [activeWeekDateIso, academicYear]);

  const weekDays = useMemo(() => {
    const dates = weekDatesFromMonday(mondayIso);
    const todayIso = new Date().toISOString().slice(0, 10);
    return DAYS.map((d, index) => {
      const iso = dates[index];
      return {
        ...d,
        iso,
        dateFormatted: formatDayHeader(iso),
        isToday: iso === todayIso,
        beforeAugust: academicYear ? isDateBeforeAugust(iso, academicYear) : false,
      };
    });
  }, [mondayIso, academicYear]);

  const weekRangeLabel = formatWeekRangeLabel(mondayIso);

  const canGoPrev = minMondayIso ? mondayIso > minMondayIso : true;

  const shiftWeek = (delta: number) => {
    const d = new Date(`${mondayIso}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + delta * 7);
    let next = d.toISOString().slice(0, 10);
    if (academicYear) next = clampWeekMonday(next, academicYear);
    onActiveWeekDateChange?.(next);
  };

  function slotsFor(day: number, block: number): TimetableSlot[] {
    return slots
      .filter((s) => s.day_of_week === day && s.block_number === block)
      .sort((a, b) => a.slot_order - b.slot_order);
  }

  return (
    <div className="space-y-3">
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
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Week of {weekRangeLabel}
                {statusWeekRefreshing && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                )}
              </div>
              {academicYear && (
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  Term starts August {academicYear.split("-")[0]}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => shiftWeek(-1)}
              disabled={!canGoPrev}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev Week
            </button>
            <button
              type="button"
              onClick={() => {
                const today = new Date().toISOString().slice(0, 10);
                const mon = academicYear
                  ? clampWeekMonday(getMondayUtc(today), academicYear)
                  : getMondayUtc(today);
                onActiveWeekDateChange?.(mon);
              }}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => shiftWeek(1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            >
              Next Week
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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
                      key={d.iso}
                      className={`px-3 py-2.5 text-center border-b border-zinc-200 dark:border-zinc-700/80 transition-colors ${
                        d.isToday
                          ? "bg-indigo-100/60 dark:bg-indigo-900/40 text-indigo-900 dark:text-indigo-200 font-extrabold"
                          : d.beforeAugust
                            ? "bg-zinc-100/60 dark:bg-zinc-800/40 text-zinc-400"
                            : "text-zinc-600 dark:text-zinc-300"
                      }`}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest">
                          {d.label}
                          {d.isToday && (
                            <span className="px-1.5 py-0.2 text-[8px] font-black tracking-normal bg-indigo-600 text-white rounded-full">
                              TODAY
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-bold tracking-tight">{d.dateFormatted}</div>
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
                  <td className="sticky left-0 z-10 bg-white dark:bg-zinc-900 px-4 py-3 border-b border-r border-zinc-200 dark:border-zinc-800 min-w-[6.5rem]">
                    <div className="text-sm font-extrabold text-zinc-850 dark:text-zinc-100 tabular-nums">
                      Block {block.block_number}
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap mt-0.5 font-medium">
                      {blockDisplayLabel(block)}
                    </div>
                  </td>

                  {isMakeup
                    ? weekDays.map((dayCol) => {
                    const dow = dayCol.dow;
                    const dateIso = dayCol.iso;
                    const beforeAugust = dayCol.beforeAugust;

                    const cellSlots = slotsFor(dow, block.block_number);

                    if (beforeAugust) {
                      return (
                        <td
                          key={`${dow}-${block.block_number}-na`}
                          className="px-2 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 min-w-[145px]"
                        />
                      );
                    }

                    return (
                      <td
                        key={`${dow}-${block.block_number}-${dateIso}`}
                        className="px-2 py-2 border-b border-zinc-200 dark:border-zinc-800 min-w-[145px]"
                      >
                        <div className="flex flex-col gap-1.5 min-h-[58px]">
                          {cellSlots.map((slot) => {
                            const hasPending = pendingSet.has(slot.id);
                            const isWizardSelected = selectedSet.has(slot.id);
                            const isMakeupTarget =
                              selectedMakeupCell?.dateIso === dateIso &&
                              (selectedMakeupCell?.slotId === slot.id ||
                                (selectedMakeupCell?.slotId == null &&
                                  selectedMakeupCell?.blockNumber === block.block_number));
                            const isAttendanceSelected =
                              selectedAttendanceCell?.slotId === slot.id &&
                              selectedAttendanceCell?.dateIso === dateIso;
                            const slotClickable = Boolean(onMakeupSlot);
                            const cellKey = cellStatusKey(slot.id, dateIso);
                            const cellStatus = statusByCell[cellKey];
                            const statusStyle = cellStatus
                              ? MAKEUP_STATUS_STYLES[cellStatus]
                              : null;
                            const theme = statusStyle ?? getSubjectTheme(slot.subjects?.name);

                            return (
                              <button
                                key={slot.id}
                                type="button"
                                disabled={!slotClickable || (statusLoading && !cellStatus)}
                                onClick={() => onMakeupSlot?.(slot, dateIso)}
                                className={`text-left rounded-xl p-2.5 border text-[11px] leading-snug transition-all relative group overflow-hidden ${
                                  isAttendanceSelected
                                    ? "border-emerald-500 dark:border-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 ring-2 ring-emerald-500/50 shadow-sm cursor-pointer"
                                    : isMakeupTarget
                                      ? "border-violet-500 dark:border-violet-400 bg-violet-50 dark:bg-violet-950/60 ring-2 ring-violet-500/50 shadow-sm cursor-pointer"
                                      : isWizardSelected
                                        ? "border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 ring-2 ring-indigo-500/50 shadow-sm cursor-pointer"
                                        : `${theme.card} hover:brightness-[0.98] dark:hover:brightness-110 cursor-pointer hover:shadow-sm`
                                }`}
                              >
                                <span
                                  className={`absolute left-0 top-0 bottom-0 w-1 ${statusStyle?.accent ?? theme.accent}`}
                                />
                                {hasPending &&
                                  cellStatus !== "rescheduled" &&
                                  cellStatus !== "conducted" &&
                                  cellStatus !== "made_up" && (
                                  <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                                  </span>
                                )}
                                {cellStatus && (
                                  <span className="absolute top-1 right-1 text-[8px] font-black uppercase tracking-wide opacity-70">
                                    {MAKEUP_STATUS_STYLES[cellStatus].label}
                                  </span>
                                )}
                                <div className="pl-1.5 pr-4">
                                  <div className="font-extrabold truncate tracking-tight uppercase text-[10.5px]">
                                    {slot.subjects?.name ?? `Subject #${slot.subject_id}`}
                                  </div>
                                  <div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-300 truncate mt-1 text-[10px] font-medium">
                                    <User className="w-3 h-3 text-zinc-400 shrink-0" />
                                    <span className="truncate">
                                      {slot.employee_profiles?.full_name ??
                                        `Teacher #${slot.employee_id}`}
                                    </span>
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
                          {(() => {
                            const overlay = makeupOverlays.find(
                              (o) =>
                                o.dateIso === dateIso &&
                                o.blockNumber === block.block_number,
                            );
                            if (!overlay || cellSlots.length > 0) return null;

                            const template =
                              slots.find((s) => s.block_number === block.block_number) ??
                              slots[0];
                            if (!template) return null;

                            const isMakeupTarget =
                              selectedMakeupCell?.dateIso === dateIso &&
                              selectedMakeupCell?.blockNumber === block.block_number;
                            const overlayKey = blockCellStatusKey(
                              block.block_number,
                              dateIso,
                            );
                            const cellStatus =
                              statusByCell[overlayKey] ?? overlay.status;
                            const statusStyle = MAKEUP_STATUS_STYLES[cellStatus];
                            const theme = getSubjectTheme(template.subjects?.name);

                            return (
                              <button
                                key={`overlay-${overlay.rescheduleId}`}
                                type="button"
                                disabled={!onMakeupSlot || statusLoading}
                                onClick={() =>
                                  onMakeupSlot?.(
                                    { ...template, block_number: block.block_number },
                                    dateIso,
                                  )
                                }
                                className={`text-left rounded-xl p-2.5 border border-dashed text-[11px] leading-snug transition-all relative group overflow-hidden ${
                                  isMakeupTarget
                                    ? "border-violet-500 dark:border-violet-400 bg-violet-50 dark:bg-violet-950/60 ring-2 ring-violet-500/50 shadow-sm cursor-pointer"
                                    : `${statusStyle.card} hover:brightness-[0.98] dark:hover:brightness-110 cursor-pointer hover:shadow-sm`
                                }`}
                              >
                                <span
                                  className={`absolute left-0 top-0 bottom-0 w-1 ${statusStyle.accent}`}
                                />
                                <span className="absolute top-1 right-1 text-[8px] font-black uppercase tracking-wide opacity-70">
                                  {MAKEUP_STATUS_STYLES[cellStatus].label}
                                </span>
                                <div className="pl-1.5 pr-4">
                                  <div className="font-extrabold truncate tracking-tight uppercase text-[10.5px]">
                                    {template.subjects?.name ??
                                      `Subject #${template.subject_id}`}
                                  </div>
                                  <div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-300 truncate mt-1 text-[10px] font-medium">
                                    <User className="w-3 h-3 text-zinc-400 shrink-0" />
                                    <span className="truncate">
                                      {template.employee_profiles?.full_name ??
                                        `Teacher #${template.employee_id}`}
                                    </span>
                                  </div>
                                  <div className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 rounded-md px-1.5 py-0.5 uppercase tracking-wider">
                                    Makeup class
                                  </div>
                                </div>
                              </button>
                            );
                          })()}
                        </div>
                      </td>
                    );
                  })
                    : DAYS.map((dayCol) => {
                    const dow = dayCol.dow;
                    const cellSlots = slotsFor(dow, block.block_number);
                    const maxSlotOrder = cellSlots.reduce(
                      (max, s) => Math.max(max, s.slot_order),
                      0,
                    );
                    const nextSlotOrder = maxSlotOrder + 1;
                    const themeFor = (slot: TimetableSlot) =>
                      getSubjectTheme(slot.subjects?.name);

                    return (
                      <td
                        key={`${dow}-${block.block_number}`}
                        className="px-2 py-2 border-b border-zinc-200 dark:border-zinc-800 min-w-[145px]"
                      >
                        <div className="flex flex-col gap-1.5 min-h-[58px]">
                          {cellSlots.map((slot) => {
                            const theme = themeFor(slot);
                            return (
                              <button
                                key={slot.id}
                                type="button"
                                disabled={!canEdit}
                                onClick={() => canEdit && onEdit(slot)}
                                className={`text-left rounded-xl p-2.5 border text-[11px] leading-snug transition-all relative group overflow-hidden ${
                                  canEdit
                                    ? `${theme.card} hover:-translate-y-0.5 hover:shadow-md cursor-pointer active:scale-[0.98]`
                                    : `${theme.card} opacity-90 cursor-default`
                                }`}
                              >
                                <span className={`absolute left-0 top-0 bottom-0 w-1 ${theme.accent}`} />
                                <div className="pl-1.5">
                                  <div className="font-extrabold truncate tracking-tight uppercase text-[10.5px]">
                                    {slot.subjects?.name ?? `Subject #${slot.subject_id}`}
                                  </div>
                                  <div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-300 truncate mt-1 text-[10px] font-medium">
                                    <User className="w-3 h-3 text-zinc-400 shrink-0" />
                                    <span className="truncate">
                                      {slot.employee_profiles?.full_name ??
                                        `Teacher #${slot.employee_id}`}
                                    </span>
                                  </div>
                                </div>
                              </button>
                            );
                          })}

                          {canEdit && cellSlots.length === 0 && (
                            <button
                              type="button"
                              onClick={() => onAdd(dow, block.block_number, 1)}
                              className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700/80 text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-400 dark:hover:border-rose-600 hover:bg-rose-50/70 dark:hover:bg-rose-950/20 text-[11px] font-medium py-3 transition-all min-h-[58px]"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add Period
                            </button>
                          )}

                          {canEdit && maxSlotOrder >= 1 && maxSlotOrder < 3 && (
                            <button
                              type="button"
                              onClick={() => onAdd(dow, block.block_number, nextSlotOrder)}
                              className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 text-[10px] py-1 transition-all"
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
              ),
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400 px-2 py-1">
        <div className="flex items-center gap-3 flex-wrap">
          {isMakeup ? (
            (
              [
                "conducted",
                "missed",
                "upcoming",
                "rescheduled",
                "made_up",
              ] as MakeupSlotCellStatus[]
            ).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${MAKEUP_STATUS_STYLES[s].accent}`}
                />
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {MAKEUP_STATUS_STYLES[s].label}
                </span>
              </span>
            ))
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Class slot</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-zinc-400">
          <Info className="w-3.5 h-3.5" />
          {isMakeup
            ? "Green = conducted. Red = not conducted. Yellow = upcoming. Purple = rescheduled. Pink = made up class."
            : "Click any slot to edit or remove"}
        </div>
      </div>
    </div>
  );
}

export { DAYS };
