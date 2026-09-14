"use client";

import { format } from "date-fns";
import { Loader2, Pencil } from "lucide-react";
import { useState } from "react";
import { useDispatch } from "react-redux";
import toast from "react-hot-toast";
import type { AppDispatch } from "@/store/store";
import type { PendingApproval } from "@/store/slices/supportTicketsSlice";
import { reviewTicketMessage, editTicketMessage } from "@/store/slices/supportTicketsSlice";
import { ticketRequesterLabel } from "@/features/support-tickets/supportTicketLabels";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

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

  const handleSaveEdit = async (messageId: string, andApprove = false) => {
    if (!editContent.trim()) {
      toast.error("Message content cannot be empty");
      return;
    }
    setSavingEdit(true);
    try {
      const editRes = await dispatch(
        editTicketMessage({ messageId, content: editContent.trim() }),
      );
      if (editTicketMessage.rejected.match(editRes)) {
        toast.error((editRes.payload as string) || "Failed to update message");
        return;
      }
      toast.success("Message updated");
      setEditingId(null);
      setEditContent("");
      if (andApprove) {
        await review(messageId, "APPROVED");
      } else {
        onRefresh();
      }
    } catch {
      toast.error("Failed to update message");
    } finally {
      setSavingEdit(false);
    }
  };

  if (isLoading) {
    return (
      <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
        <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
        <p className="text-sm text-zinc-500 font-medium">Loading approvals…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2.5">
        <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        <p className="text-xs text-zinc-400 font-medium">No pending reply approvals</p>
      </div>
    );
  }

  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800">
      {/* Header */}
      <div className="px-5 pt-4 pb-2 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Pending Approvals</p>
        <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>
      {/* Scrollable items */}
      <div className="max-h-64 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
        {items.map((item) => {
          const busy = loadingId === item.id || savingEdit;
          const isEditing = editingId === item.id;
          return (
            <div key={item.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-zinc-500 truncate">
                    {item.ticket ? ticketRequesterLabel(item.ticket) : "Ticket"}
                    {item.sender_user?.full_name && (
                      <span className="text-zinc-400 font-normal"> · {item.sender_user.full_name}</span>
                    )}
                  </p>
                  {isEditing ? (
                    <div className="mt-2 flex flex-col gap-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full min-h-[60px] p-2 text-xs rounded-lg border border-amber-300 dark:border-amber-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                        autoFocus
                        rows={3}
                      />
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          disabled={busy}
                          onClick={() => {
                            setEditingId(null);
                            setEditContent("");
                          }}
                          className="px-2.5 py-1 text-xs rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          disabled={busy || !editContent.trim()}
                          onClick={() => handleSaveEdit(item.id, false)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 transition-colors shadow-sm"
                        >
                          {savingEdit && <Loader2 className="h-3 w-3 animate-spin" />}
                          Save
                        </button>
                        <button
                          disabled={busy || !editContent.trim()}
                          onClick={() => handleSaveEdit(item.id, true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-colors shadow-sm"
                        >
                          {savingEdit && <Loader2 className="h-3 w-3 animate-spin" />}
                          Save & Approve
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 mt-1.5 line-clamp-3">
                      {item.content}
                    </p>
                  )}
                  <p className="text-[10px] text-zinc-400 mt-1.5">{format(new Date(item.created_at), "PPp")}</p>
                </div>
              </div>
              {!isEditing && (
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {item.ticket?.id && onSelectTicket && (
                    <button
                      disabled={busy}
                      onClick={() => onSelectTicket(item.ticket!.id)}
                      className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-50 transition-colors"
                    >
                      Open ticket
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditingId(item.id);
                      setEditContent(item.content);
                      setRejectId(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => review(item.id, "APPROVED")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                    Approve
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setRejectId(rejectId === item.id ? null : item.id)}
                    className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 disabled:opacity-50 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              )}
              {rejectId === item.id && (
                <div className="mt-3 flex gap-2">
                  <input
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Rejection reason…"
                    className="flex-1 h-9 px-3 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    disabled={busy || !comment.trim()}
                    onClick={() => review(item.id, "REJECTED", comment)}
                    className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-semibold disabled:opacity-50 hover:bg-zinc-50 transition-colors"
                  >
                    Confirm
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
