"use client";

import { Plus } from "lucide-react";
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

interface Props {
  blocks: TimetableBlock[];
  slots: TimetableSlot[];
  canEdit: boolean;
  onAdd: (dayOfWeek: number, blockNumber: number, slotOrder: number) => void;
  onEdit: (slot: TimetableSlot) => void;
}

export function TimetableGrid({ blocks, slots, canEdit, onAdd, onEdit }: Props) {
  function slotsFor(day: number, block: number): TimetableSlot[] {
    return slots
      .filter((s) => s.day_of_week === day && s.block_number === block)
      .sort((a, b) => a.slot_order - b.slot_order);
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm dark:shadow-none">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead>
          <tr className="bg-zinc-50 dark:bg-zinc-800/80">
            <th className="sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-800/80 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 border-b border-r border-zinc-200 dark:border-zinc-700/80 w-28">
              Block
            </th>
            {DAYS.map((d) => (
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
          {blocks.map((block, idx) => (
            <tr
              key={block.block_number}
              className={`align-top ${idx % 2 === 1 ? "bg-zinc-50/50 dark:bg-zinc-800/20" : ""}`}
            >
              {/* Block label column */}
              <td className="sticky left-0 z-10 bg-white dark:bg-zinc-900 px-4 py-3 border-b border-r border-zinc-200 dark:border-zinc-800 min-w-[6rem]">
                <div className="text-sm font-bold text-zinc-850 dark:text-zinc-100 tabular-nums">
                  {block.block_number}
                </div>
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap mt-0.5 font-medium">
                  {blockDisplayLabel(block)}
                </div>
              </td>

              {/* Day cells */}
              {DAYS.map((d) => {
                const cellSlots = slotsFor(d.dow, block.block_number);
                const hasPrimary = cellSlots.some((s) => s.slot_order === 1);
                const hasSplit = cellSlots.some((s) => s.slot_order === 2);

                return (
                  <td
                    key={`${d.dow}-${block.block_number}`}
                    className="px-2 py-2 border-b border-zinc-200 dark:border-zinc-800 min-w-[130px]"
                  >
                    <div className="flex flex-col gap-1.5 min-h-[56px]">
                      {cellSlots.map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          disabled={!canEdit}
                          onClick={() => canEdit && onEdit(slot)}
                          className={`text-left rounded-xl px-2.5 py-2 border text-[11px] leading-snug transition-all ${
                            canEdit
                              ? "border-rose-200 dark:border-rose-800/50 bg-rose-50/70 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 hover:border-rose-300 dark:hover:border-rose-700/60 cursor-pointer active:scale-[0.98]"
                              : "border-zinc-200 dark:border-zinc-700/60 bg-zinc-55 dark:bg-zinc-800/40 cursor-default"
                          }`}
                        >
                          <div className="font-bold text-rose-950 dark:text-zinc-100 truncate tracking-wide uppercase text-[10px]">
                            {slot.subjects?.name ?? `Subject #${slot.subject_id}`}
                          </div>
                          <div className="text-zinc-600 dark:text-zinc-400 truncate mt-0.5">
                            {slot.employee_profiles?.full_name ?? `Teacher #${slot.employee_id}`}
                          </div>
                          {slot.room && (
                            <div className="mt-1 inline-flex items-center text-[9px] font-semibold text-rose-700 dark:text-rose-400/70 bg-rose-100 dark:bg-rose-950/50 rounded px-1.5 py-0.5 uppercase tracking-wider">
                              {slot.room}
                            </div>
                          )}
                        </button>
                      ))}

                      {canEdit && cellSlots.length === 0 && (
                        <button
                          type="button"
                          onClick={() => onAdd(d.dow, block.block_number, 1)}
                          className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-600 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-400 dark:hover:border-rose-700/50 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-[11px] py-3 transition-all min-h-[56px]"
                        >
                          <Plus className="w-3 h-3" />
                          Add
                        </button>
                      )}

                      {canEdit && hasPrimary && !hasSplit && (
                        <button
                          type="button"
                          onClick={() => onAdd(d.dow, block.block_number, 2)}
                          className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-600 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-400 dark:hover:border-rose-700/50 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-[10px] py-1 transition-all"
                        >
                          <Plus className="w-3 h-3" />
                          Add split
                        </button>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { DAYS };
