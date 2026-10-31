import type { TicketLane } from "@/store/slices/supportTicketsSlice";
import { FlowIcon } from "@/features/support-tickets/flow-builder/flow-icons";
import { categoryLabel } from "@/features/support-tickets/supportTicketLabels";

/** The ticket's lane in its own colour; the old category for tickets from before lanes (TAFSD-447). */
export function LaneChip({ lane, category, size = "sm" }: { lane?: TicketLane | null; category: string; size?: "sm" | "xs" }) {
  const cls =
    size === "xs"
      ? "px-1.5 py-0.5 text-[9px] gap-1"
      : "px-2 py-0.5 text-[10px] gap-1";
  if (!lane) {
    return (
      <span className={`inline-flex items-center rounded-full font-black uppercase tracking-wide shrink-0 bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 ${cls}`}>
        {categoryLabel(category)}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center rounded-full font-black uppercase tracking-wide shrink-0 ${cls}`}
      style={{ background: `${lane.color}1f`, color: lane.color }}
      title={lane.is_active ? lane.name : `${lane.name} (no longer offered)`}
    >
      <FlowIcon name={lane.icon} className={size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {lane.name}
    </span>
  );
}
