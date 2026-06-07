"use client";

import { Loader2, MessageSquare, Search, User } from "lucide-react";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import type { SupportTicket } from "@/store/slices/supportTicketsSlice";
import { categoryLabel } from "@/features/support-tickets/supportTicketLabels";

type QueueTab = "my-queue" | "finance-queue" | "oversight" | "closed";

interface TicketQueueListProps {
  tickets: SupportTicket[];
  selectedId: string | null;
  activeTab: QueueTab;
  isLoading?: boolean;
  onTabChange: (tab: QueueTab) => void;
  onSelect: (id: string) => void;
  showFinanceTab?: boolean;
  showOversightTab?: boolean;
}

export function TicketQueueList({
  tickets,
  selectedId,
  activeTab,
  isLoading = false,
  onTabChange,
  onSelect,
  showFinanceTab = false,
  showOversightTab = false,
}: TicketQueueListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return tickets;
    const q = searchQuery.toLowerCase();
    return tickets.filter((t) => {
      const household = t.families?.household_name?.toLowerCase() ?? "";
      const subtopic = t.subtopic?.toLowerCase() ?? "";
      const snippet = t.last_message_snippet?.toLowerCase() ?? "";
      return household.includes(q) || subtopic.includes(q) || snippet.includes(q);
    });
  }, [tickets, searchQuery]);

  const tabs: { id: QueueTab; label: string; hidden?: boolean }[] = [
    { id: "oversight", label: "All Open", hidden: !showOversightTab },
    { id: "my-queue", label: "My Queue" },
    { id: "finance-queue", label: "Finance Queue", hidden: !showFinanceTab },
    { id: "closed", label: "Closed" },
  ];

  const hasSearch = searchQuery.trim().length > 0;

  return (
    <div className="w-85 border-r border-zinc-200 dark:border-zinc-800 flex flex-col h-full bg-white dark:bg-zinc-950">
      <div className="p-5 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-2xl font-black mb-4">Support Tickets</h1>
        <div className="flex gap-1 mb-4 flex-wrap" role="tablist">
          {tabs.filter((t) => !t.hidden).map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === tab.id
                  ? "bg-primary text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-primary" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tickets..."
            aria-label="Search tickets"
            className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-8 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading queue…</p>
          </div>
        )}
        {!isLoading && filtered.map((ticket) => (
          <button
            key={ticket.id}
            aria-selected={selectedId === ticket.id}
            onClick={() => onSelect(ticket.id)}
            className={`w-full text-left p-4 border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors ${
              selectedId === ticket.id ? "bg-primary/5 border-l-4 border-l-primary" : ""
            }`}
          >
            <div className="flex justify-between items-start gap-2">
              <span className="font-bold text-sm truncate">
                {ticket.families?.household_name ?? `Family #${ticket.family_id}`}
              </span>
              {ticket.unread_by_staff > 0 && (
                <span className="bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                  {ticket.unread_by_staff}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              {categoryLabel(ticket.category)} · {ticket.subtopic}
            </p>
            <p className="text-xs truncate mt-1 text-zinc-600 dark:text-zinc-400">
              {ticket.last_message_snippet || ticket.description}
            </p>
            <p className="text-[10px] text-zinc-400 mt-2">
              {format(new Date(ticket.last_message_at), "MMM d, h:mm a")}
            </p>
          </button>
        ))}
        {!isLoading && filtered.length === 0 && (
          <div className="p-8 text-center flex flex-col items-center gap-3">
            <div className="h-12 w-12 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center">
              <User className="h-6 w-6 text-zinc-300" />
            </div>
            <p className="text-xs text-zinc-500 font-medium">
              {hasSearch ? "No tickets match your search" : "No tickets in this queue"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function TicketThreadPlaceholder() {
  return (
    <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm flex-col gap-3 bg-zinc-50 dark:bg-zinc-900">
      <MessageSquare className="h-10 w-10 opacity-20" />
      <p className="font-medium">Select a ticket to view the thread</p>
    </div>
  );
}

export function TicketThreadLoading() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-zinc-50 dark:bg-zinc-900 relative">
      <Loader2 className="h-8 w-8 text-primary animate-spin" />
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading thread…</p>
    </div>
  );
}
