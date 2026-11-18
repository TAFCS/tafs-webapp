"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Loader2, Send, RotateCw } from "lucide-react";
import { LaneChip } from "@/features/support-tickets/components/LaneChip";
import { ticketPathLabel, ticketRequesterLabel } from "@/features/support-tickets/supportTicketLabels";
import {
  EMPTY_SENT_COUNTS,
  SENT_FILTERS,
  SENT_FILTER_LABEL,
  fetchSentReplies,
  type SentFilter,
  type SentReply,
  type SentReplyCounts,
  type SentReplyStatus,
} from "@/features/support-tickets/sentReplies";

const PAGE_SIZE = 50;

const STATUS_BADGE: Record<SentReplyStatus, { label: string; cls: string }> = {
  PENDING: {
    label: "Pending",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  },
  APPROVED: {
    label: "Approved",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  },
  REJECTED: {
    label: "Rejected",
    cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  },
};

const FILTER_ON: Record<SentFilter, string> = {
  pending: "bg-amber-500 text-white border-transparent",
  approved: "bg-emerald-600 text-white border-transparent",
  rejected: "bg-rose-600 text-white border-transparent",
};

/** Family first, then the student when the ticket is about one child. */
function ticketWho(reply: SentReply): { family: string; student: string | null } {
  const family = ticketRequesterLabel({ families: reply.ticket.families });
  const s = reply.ticket.students;
  return { family, student: s ? `${s.full_name} · CC ${s.cc}` : null };
}

function SentReplyRow({
  reply,
  isSelected,
  onSelect,
}: {
  reply: SentReply;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const badge = STATUS_BADGE[reply.status] ?? STATUS_BADGE.PENDING;
  const { family, student } = ticketWho(reply);
  const topic = reply.ticket.topic ?? ticketPathLabel(reply.ticket);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left px-5 py-4 border-b border-zinc-50 dark:border-zinc-800/40 transition-colors ${
        isSelected
          ? "bg-primary/5 dark:bg-primary/10 border-l-2 border-l-primary"
          : "hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-bold text-[13px] text-zinc-900 dark:text-zinc-100 truncate leading-snug">{family}</span>
        <span
          className="text-[10px] text-zinc-400 tabular-nums shrink-0"
          title={format(new Date(reply.created_at), "PPpp")}
        >
          {format(new Date(reply.created_at), "MMM d, h:mm a")}
        </span>
      </div>
      {student && <p className="text-[11px] text-zinc-500 truncate mb-1">{student}</p>}
      <div className="flex items-center gap-1.5 min-w-0 mb-1.5">
        <LaneChip lane={reply.ticket.lane} category={reply.ticket.category} size="xs" />
        {topic && <p className="text-[11px] font-medium text-zinc-500 truncate">{topic}</p>}
      </div>
      <div className="flex items-start gap-2">
        <p className="flex-1 min-w-0 text-[12px] text-zinc-600 dark:text-zinc-400 line-clamp-2">{reply.snippet}</p>
        <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide ${badge.cls}`}>
          {badge.label}
        </span>
      </div>
      {reply.status === "REJECTED" && (
        <div className="mt-2 rounded-lg border border-rose-100 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-950/20 px-2.5 py-1.5">
          <p className="text-[11px] text-rose-700 dark:text-rose-300 line-clamp-3">
            {reply.review_comment?.trim() || "No reason given"}
          </p>
          <p className="text-[10px] text-rose-500/80 dark:text-rose-400/70 mt-0.5">
            Rejected by {reply.reviewer?.full_name ?? "a super admin"}
            {reply.reviewed_at ? ` · ${format(new Date(reply.reviewed_at), "MMM d, h:mm a")}` : ""}
          </p>
        </div>
      )}
    </button>
  );
}

/**
 * The Sent tab body: status filter chips with counts (multi-select, empty =
 * all) and the caller's replies, newest first. Fetches its own pages; bump
 * `refreshKey` to reload after a review lands over the socket.
 */
export function SentRepliesList({
  filters,
  onFiltersChange,
  selectedTicketId,
  onSelect,
  refreshKey = 0,
}: {
  filters: SentFilter[];
  onFiltersChange: (filters: SentFilter[]) => void;
  selectedTicketId: string | null;
  onSelect: (ticketId: string) => void;
  refreshKey?: number;
}) {
  const [items, setItems] = useState<SentReply[]>([]);
  const [counts, setCounts] = useState<SentReplyCounts>(EMPTY_SENT_COUNTS);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const filterKey = filters.join(",");

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const page = await fetchSentReplies(filterKey ? (filterKey.split(",") as SentFilter[]) : [], PAGE_SIZE, 0);
      if (id !== requestId.current) return;
      setItems(page.items);
      setCounts(page.counts);
      setTotal(page.total);
    } catch {
      if (id !== requestId.current) return;
      setError("Could not load your sent replies.");
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, [filterKey]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const loadMore = async () => {
    const id = requestId.current;
    setIsLoadingMore(true);
    try {
      const page = await fetchSentReplies(filters, PAGE_SIZE, items.length);
      if (id !== requestId.current) return;
      setItems((prev) => [...prev, ...page.items.filter((p) => !prev.some((x) => x.id === p.id))]);
      setCounts(page.counts);
      setTotal(page.total);
    } catch {
      setError("Could not load more replies.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const toggle = (f: SentFilter) =>
    onFiltersChange(
      filters.includes(f) ? filters.filter((x) => x !== f) : SENT_FILTERS.filter((x) => x === f || filters.includes(x)),
    );

  return (
    <>
      <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-1" role="group" aria-label="Filter sent replies by status">
        <button
          type="button"
          aria-pressed={filters.length === 0}
          onClick={() => onFiltersChange([])}
          className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition ${
            filters.length === 0
              ? "bg-primary text-white border-transparent"
              : "text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
          }`}
        >
          All <span className="tabular-nums opacity-80">{counts.all}</span>
        </button>
        {SENT_FILTERS.map((f) => {
          const on = filters.includes(f);
          return (
            <button
              key={f}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(f)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition ${
                on ? FILTER_ON[f] : "text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              }`}
            >
              {SENT_FILTER_LABEL[f]} <span className="tabular-nums opacity-80">{counts[f]}</span>
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="py-12 flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
          <p className="text-sm text-zinc-500">Loading your replies…</p>
        </div>
      )}

      {!isLoading && error && (
        <div className="py-12 flex flex-col items-center gap-3 px-6 text-center">
          <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 px-3 h-8 text-[11px] font-bold text-zinc-700 border border-zinc-200 rounded-xl hover:bg-zinc-50 dark:text-zinc-300 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <RotateCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <div className="py-16 flex flex-col items-center gap-3 text-zinc-400 px-6 text-center">
          <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
            <Send className="h-5 w-5 text-zinc-300" />
          </div>
          <p className="text-sm font-medium">
            {filters.length ? "No replies with this status" : "You haven't replied to any tickets yet"}
          </p>
        </div>
      )}

      {!isLoading &&
        !error &&
        items.map((reply) => (
          <SentReplyRow
            key={reply.id}
            reply={reply}
            isSelected={selectedTicketId === reply.ticket.id}
            onSelect={() => onSelect(reply.ticket.id)}
          />
        ))}

      {!isLoading && !error && items.length < total && (
        <div className="p-4 flex justify-center">
          <button
            type="button"
            disabled={isLoadingMore}
            onClick={() => void loadMore()}
            className="inline-flex items-center gap-1.5 px-3 h-8 text-[11px] font-bold text-zinc-700 border border-zinc-200 rounded-xl hover:bg-zinc-50 disabled:opacity-50 dark:text-zinc-300 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            {isLoadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Load more ({total - items.length})
          </button>
        </div>
      )}
    </>
  );
}
