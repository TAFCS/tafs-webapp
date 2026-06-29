"use client";

import { useState } from "react";
import { Loader2, MessageSquare, Search, Check, X } from "lucide-react";
import { format } from "date-fns";
import { useDispatch } from "react-redux";
import toast from "react-hot-toast";
import type { AppDispatch } from "@/store/store";
import type { PendingApproval, QueueTab, SupportTicket } from "@/store/slices/supportTicketsSlice";
import { reviewTicketMessage } from "@/store/slices/supportTicketsSlice";
import { categoryLabel } from "@/features/support-tickets/supportTicketLabels";

interface TicketQueueListProps {
  tickets: SupportTicket[];
  selectedId: string | null;
  activeTab: QueueTab;
  isLoading?: boolean;
  onTabChange: (tab: QueueTab) => void;
  onSelect: (id: string) => void;
  showFinanceTab?: boolean;
  showOversightTab?: boolean;
  pendingApprovals?: PendingApproval[];
  isLoadingApprovals?: boolean;
  onRefreshApprovals?: () => void;
  onSelectTicketFromApproval?: (ticketId: string) => void;
}

// ── Approval item inside the Approvals tab ────────────────────────────────────

function ApprovalItem({
  item,
  onRefresh,
  onSelectTicket,
}: {
  item: PendingApproval;
  onRefresh?: () => void;
  onSelectTicket?: (id: string) => void;
}) {
  const dispatch = useDispatch<AppDispatch>();
  const [loading, setLoading] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState("");

  const review = async (status: "APPROVED" | "REJECTED") => {
    if (status === "REJECTED" && !comment.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
    setLoading(true);
    try {
      await dispatch(reviewTicketMessage({ messageId: item.id, status, comment: comment || undefined })).unwrap();
      toast.success(status === "APPROVED" ? "Reply approved" : "Reply rejected");
      setRejecting(false);
      setComment("");
      onRefresh?.();
    } catch (err: unknown) {
      toast.error(typeof err === "string" ? err : "Review failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800/60">
      {/* Sender → Family */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-500 uppercase shrink-0">
          {item.sender_user?.full_name?.[0] ?? "S"}
        </div>
        <p className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 truncate">
          {item.sender_user?.full_name ?? "Staff"}
          <span className="text-zinc-400 font-normal"> → {item.ticket?.families?.household_name ?? "Family"}</span>
        </p>
        <span className="ml-auto text-[10px] text-zinc-400 shrink-0">
          {format(new Date(item.created_at), "MMM d, h:mm a")}
        </span>
      </div>

      {/* Message preview */}
      <p className="text-[13px] text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-900 rounded-xl px-3 py-2.5 leading-relaxed line-clamp-3 mb-3">
        {item.content}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {item.ticket?.id && onSelectTicket && (
          <button
            onClick={() => onSelectTicket(item.ticket!.id)}
            className="px-2.5 py-1.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          >
            View thread
          </button>
        )}
        <button
          disabled={loading}
          onClick={() => review("APPROVED")}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-[11px] font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          Approve
        </button>
        <button
          disabled={loading}
          onClick={() => setRejecting(r => !r)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-rose-600 dark:text-rose-400 rounded-lg text-[11px] font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-50 transition-colors"
        >
          <X className="h-3 w-3" />
          Reject
        </button>
      </div>

      {rejecting && (
        <div className="mt-2 flex gap-2">
          <input
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Rejection reason…"
            className="flex-1 h-8 px-3 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
          />
          <button
            disabled={loading || !comment.trim()}
            onClick={() => review("REJECTED")}
            className="px-3 text-xs font-semibold text-rose-600 border border-rose-200 dark:border-rose-900/50 rounded-lg disabled:opacity-50 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
          >
            Confirm
          </button>
        </div>
      )}
    </div>
  );
}

// ── Ticket card ───────────────────────────────────────────────────────────────

function TicketCard({
  ticket,
  isSelected,
  onSelect,
}: {
  ticket: SupportTicket;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-5 py-4 border-b border-zinc-50 dark:border-zinc-800/40 transition-colors ${
        isSelected
          ? "bg-primary/5 dark:bg-primary/10 border-l-2 border-l-primary"
          : "hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="font-bold text-[13px] text-zinc-900 dark:text-zinc-100 truncate leading-snug">
          {ticket.families?.household_name ?? `Family #${ticket.family_id}`}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {ticket.unread_by_staff > 0 && (
            <span className="min-w-[16px] h-4 px-1 bg-primary text-white text-[9px] font-black rounded-full flex items-center justify-center">
              {ticket.unread_by_staff > 9 ? "9+" : ticket.unread_by_staff}
            </span>
          )}
          <span className="text-[10px] text-zinc-400 tabular-nums">
            {format(new Date(ticket.last_message_at), "MMM d")}
          </span>
        </div>
      </div>
      <p className="text-[11px] font-medium text-zinc-500 truncate mb-1">
        {categoryLabel(ticket.category)}
        {ticket.subtopic && ` · ${ticket.subtopic}`}
      </p>
      <p className="text-[12px] text-zinc-400 dark:text-zinc-500 truncate">
        {ticket.last_message_snippet || ticket.description}
      </p>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TicketQueueList({
  tickets,
  selectedId,
  activeTab,
  isLoading = false,
  onTabChange,
  onSelect,
  showFinanceTab = false,
  showOversightTab = false,
  pendingApprovals,
  isLoadingApprovals = false,
  onRefreshApprovals,
  onSelectTicketFromApproval,
}: TicketQueueListProps) {
  const [search, setSearch] = useState("");
  const showApprovalsTab = pendingApprovals !== undefined;

  const tabs: { id: QueueTab; label: string; show: boolean; badge?: number }[] = [
    { id: "oversight", label: "All Open", show: !!showOversightTab },
    { id: "my-queue", label: "My Queue", show: true },
    { id: "finance-queue", label: "Finance Queue", show: !!showFinanceTab },
    { id: "approvals", label: "Approvals", show: showApprovalsTab, badge: pendingApprovals?.length },
    { id: "closed", label: "Closed", show: true },
  ];

  const filtered =
    search.trim()
      ? tickets.filter(t => {
          const q = search.toLowerCase();
          return (
            (t.families?.household_name?.toLowerCase().includes(q)) ||
            (t.subtopic?.toLowerCase().includes(q)) ||
            (t.last_message_snippet?.toLowerCase().includes(q))
          );
        })
      : tickets;

  return (
    <div className="w-[340px] shrink-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col h-full bg-white dark:bg-zinc-950">

      {/* Header */}
      <div className="px-6 pt-6 pb-0 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">Support Tickets</h1>
          {activeTab !== "approvals" && tickets.length > 0 && (
            <span className="text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-full tabular-nums">
              {tickets.length}
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 flex-wrap pb-4" role="tablist">
          {tabs.filter(t => t.show).map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? "bg-primary text-white shadow-sm"
                  : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span
                  className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                    activeTab === tab.id
                      ? "bg-white/25 text-white"
                      : "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Search — hidden on approvals tab */}
      {activeTab !== "approvals" && (
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tickets…"
              aria-label="Search tickets"
              className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "approvals" ? (
          <>
            {isLoadingApprovals && (
              <div className="py-12 flex flex-col items-center gap-3">
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
                <p className="text-sm text-zinc-500">Loading approvals…</p>
              </div>
            )}
            {!isLoadingApprovals && (pendingApprovals ?? []).length === 0 && (
              <div className="py-16 flex flex-col items-center gap-3 text-zinc-400 px-6 text-center">
                <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
                  <Check className="h-5 w-5 text-zinc-300" />
                </div>
                <p className="text-sm font-medium">All caught up</p>
                <p className="text-xs text-zinc-400">No replies waiting for approval.</p>
              </div>
            )}
            {!isLoadingApprovals &&
              (pendingApprovals ?? []).map(item => (
                <ApprovalItem
                  key={item.id}
                  item={item}
                  onRefresh={onRefreshApprovals}
                  onSelectTicket={onSelectTicketFromApproval}
                />
              ))}
          </>
        ) : (
          <>
            {isLoading && (
              <div className="py-12 flex flex-col items-center gap-3">
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
                <p className="text-sm text-zinc-500">Loading…</p>
              </div>
            )}
            {!isLoading &&
              filtered.map(ticket => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  isSelected={selectedId === ticket.id}
                  onSelect={() => onSelect(ticket.id)}
                />
              ))}
            {!isLoading && filtered.length === 0 && (
              <div className="py-16 flex flex-col items-center gap-3 text-zinc-400">
                <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-zinc-300" />
                </div>
                <p className="text-sm font-medium">
                  {search.trim() ? "No tickets match your search" : "No tickets in this queue"}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function TicketThreadPlaceholder() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-zinc-50 dark:bg-zinc-900 text-zinc-400">
      <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
        <MessageSquare className="h-7 w-7 text-zinc-300 dark:text-zinc-600" />
      </div>
      <p className="text-sm font-medium">Select a ticket to view the thread</p>
    </div>
  );
}

export function TicketThreadLoading() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-zinc-50 dark:bg-zinc-900">
      <Loader2 className="h-7 w-7 text-primary animate-spin" />
      <p className="text-sm text-zinc-500">Loading thread…</p>
    </div>
  );
}
