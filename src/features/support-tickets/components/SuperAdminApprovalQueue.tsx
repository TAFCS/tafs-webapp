"use client";

import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useDispatch } from "react-redux";
import toast from "react-hot-toast";
import type { AppDispatch } from "@/store/store";
import type { PendingApproval } from "@/store/slices/supportTicketsSlice";
import { reviewTicketMessage } from "@/store/slices/supportTicketsSlice";

interface SuperAdminApprovalQueueProps {
  items: PendingApproval[];
  isLoading?: boolean;
  onRefresh: () => void;
  onSelectTicket?: (ticketId: string) => void;
}

export function SuperAdminApprovalQueue({
  items,
  isLoading = false,
  onRefresh,
  onSelectTicket,
}: SuperAdminApprovalQueueProps) {
  const dispatch = useDispatch<AppDispatch>();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const review = async (messageId: string, status: "APPROVED" | "REJECTED", reviewComment?: string) => {
    if (status === "REJECTED" && !reviewComment?.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
    setLoadingId(messageId);
    try {
      await dispatch(reviewTicketMessage({ messageId, status, comment: reviewComment })).unwrap();
      toast.success(status === "APPROVED" ? "Reply approved" : "Reply rejected");
      setRejectId(null);
      setComment("");
      onRefresh();
    } catch (err: unknown) {
      toast.error(typeof err === "string" ? err : "Review failed");
    } finally {
      setLoadingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 border-b bg-amber-50 dark:bg-amber-950/30 flex items-center gap-2">
        <Loader2 className="h-4 w-4 text-amber-700 animate-spin" />
        <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">Loading approvals…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-4 border-b bg-amber-50 dark:bg-amber-950/30 text-sm text-amber-800 dark:text-amber-200">
        <p className="font-bold">No pending reply approvals</p>
        <p className="mt-1 text-xs opacity-90">
          New tickets appear under <strong>All Open</strong>. Staff replies show here once the assignee responds.
        </p>
      </div>
    );
  }

  return (
    <div className="border-b bg-amber-50 dark:bg-amber-950/20 max-h-64 overflow-y-auto">
      <p className="px-4 pt-3 text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
        Pending Approvals ({items.length})
      </p>
      {items.map((item) => {
        const busy = loadingId === item.id;
        return (
          <div key={item.id} className="p-4 border-t border-amber-100 dark:border-amber-900/50">
            <p className="text-xs text-zinc-500">
              {item.ticket?.families?.household_name} · {item.sender_user?.full_name} ({item.sender_user?.role})
            </p>
            <p className="text-sm mt-1 font-medium">{item.content}</p>
            <p className="text-[10px] text-zinc-400 mt-1">{format(new Date(item.created_at), "PPp")}</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              {item.ticket?.id && onSelectTicket && (
                <button
                  disabled={busy}
                  onClick={() => onSelectTicket(item.ticket!.id)}
                  className="px-3 py-1 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold hover:bg-white/50 disabled:opacity-50"
                >
                  Open ticket
                </button>
              )}
              <button
                disabled={busy}
                onClick={() => review(item.id, "APPROVED")}
                className="inline-flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded-xl text-xs font-bold hover:opacity-90 disabled:opacity-50"
              >
                {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                Approve
              </button>
              <button
                disabled={busy}
                onClick={() => setRejectId(rejectId === item.id ? null : item.id)}
                className="px-3 py-1 bg-red-600 text-white rounded-xl text-xs font-bold hover:opacity-90 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
            {rejectId === item.id && (
              <div className="mt-2 flex gap-2">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Rejection reason..."
                  className="flex-1 h-9 px-2 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  disabled={busy || !comment.trim()}
                  onClick={() => review(item.id, "REJECTED", comment)}
                  className="px-3 py-1 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold disabled:opacity-50"
                >
                  Confirm
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
