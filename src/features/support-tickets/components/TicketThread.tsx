"use client";

import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useDispatch } from "react-redux";
import toast from "react-hot-toast";
import api from "@/lib/api";
import type { AppDispatch } from "@/store/store";
import type { SupportTicket, TicketMessage } from "@/store/slices/supportTicketsSlice";
import { claimTicket, closeTicket, reviewTicketMessage } from "@/store/slices/supportTicketsSlice";
import { categoryLabel, statusLabel } from "@/features/support-tickets/supportTicketLabels";
import { ClaimTransferModal } from "./ClaimTransferModal";
import { ForwardTicketModal } from "./ForwardTicketModal";

interface TicketThreadProps {
  ticket: SupportTicket & { messages?: TicketMessage[]; description?: string };
  userId?: string;
  userRole?: string;
  isSending?: boolean;
  isConnected?: boolean;
  detailError?: string | null;
  onRetryDetail?: () => void;
  onRefresh: () => void;
  onSendMessage: (content: string, mediaMetadata?: Record<string, unknown>) => Promise<void>;
}

function senderName(msg: TicketMessage): string {
  if (msg.sender_type === "GUARDIAN") {
    return msg.sender_guardian?.full_name ?? "Parent";
  }
  return msg.sender_user?.full_name ?? "Staff";
}

export function TicketThread({
  ticket,
  userId,
  userRole,
  isSending = false,
  isConnected = true,
  detailError,
  onRetryDetail,
  onRefresh,
  onSendMessage,
}: TicketThreadProps) {
  const dispatch = useDispatch<AppDispatch>();
  const [reply, setReply] = useState("");
  const [showClaim, setShowClaim] = useState(false);
  const [showForward, setShowForward] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeNote, setCloseNote] = useState("");
  const [reviewLoading, setReviewLoading] = useState<string | null>(null);
  const [claimLoading, setClaimLoading] = useState(false);
  const [closeLoading, setCloseLoading] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [uploading, setUploading] = useState(false);

  const isClosed = ticket.status === "CLOSED";
  const isFinance = ticket.category === "FINANCIAL";
  const isUnclaimedFinance = isFinance && !ticket.current_assignee_id;
  const isAssignee = Boolean(userId && ticket.current_assignee_id === userId);
  const isSuperAdmin = userRole === "SUPER_ADMIN";
  const isReadOnlyViewer = !isClosed && !isAssignee;
  const messages = [...(ticket.messages ?? [])].reverse();
  const composerDisabled = !isConnected || isSending || uploading;

  const handleSend = async () => {
    if (!reply.trim() || composerDisabled) return;
    try {
      await onSendMessage(reply.trim());
      setReply("");
      toast.success("Reply submitted for approval");
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message ?? "Failed to send reply");
    }
  };

  const handleClose = async () => {
    setCloseLoading(true);
    try {
      await dispatch(closeTicket({ ticketId: ticket.id, note: closeNote || undefined })).unwrap();
      toast.success("Ticket closed");
      setShowCloseModal(false);
      setCloseNote("");
      onRefresh();
    } catch (err: unknown) {
      const e = err as string | { message?: string };
      toast.error(typeof e === "string" ? e : e.message ?? "Failed to close ticket");
    } finally {
      setCloseLoading(false);
    }
  };

  const handleClaim = async () => {
    setClaimLoading(true);
    try {
      await dispatch(claimTicket(ticket.id)).unwrap();
      toast.success("Ticket claimed");
      onRefresh();
    } catch (err: unknown) {
      toast.error(typeof err === "string" ? err : "Could not claim — someone else may have taken it");
    } finally {
      setClaimLoading(false);
    }
  };

  const reviewMessage = async (
    messageId: string,
    status: "APPROVED" | "REJECTED",
    comment?: string,
  ) => {
    setReviewLoading(messageId);
    try {
      await dispatch(reviewTicketMessage({ messageId, status, comment })).unwrap();
      toast.success(status === "APPROVED" ? "Reply approved" : "Reply rejected");
      setRejectId(null);
      setRejectComment("");
      onRefresh();
    } catch (err: unknown) {
      toast.error(typeof err === "string" ? err : "Review failed");
    } finally {
      setReviewLoading(null);
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post("v1/support-tickets/media", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const media = res.data.data ?? res.data;
      await onSendMessage(file.name, media);
      toast.success("Attachment sent");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const renderMedia = (msg: TicketMessage) => {
    const meta = msg.media_metadata as { url?: string; mimeType?: string } | null | undefined;
    if (!meta?.url) return null;
    if (msg.message_type === "IMAGE") {
      return (
        <a href={meta.url} target="_blank" rel="noreferrer">
          <img src={meta.url} alt="Attachment" className="mt-2 max-w-full rounded-lg max-h-48 object-cover" />
        </a>
      );
    }
    return (
      <a href={meta.url} target="_blank" rel="noreferrer" className="underline text-xs mt-2 block">
        Open attachment
      </a>
    );
  };

  if (detailError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-zinc-50 dark:bg-zinc-900 p-8">
        <p className="text-sm text-rose-600 dark:text-rose-400 text-center">{detailError}</p>
        {onRetryDetail && (
          <button
            onClick={onRetryDetail}
            className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:opacity-90"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-zinc-900 min-w-0">
      <div className="p-4 border-b bg-white dark:bg-zinc-950 dark:border-zinc-800">
        {isSuperAdmin && isReadOnlyViewer && (
          <div className="mb-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-sm text-amber-900 dark:text-amber-100 border border-amber-200 dark:border-amber-900/50">
            <p className="font-bold">Super Admin oversight</p>
            <p className="mt-1 text-xs opacity-90">
              Assigned to {ticket.current_assignee?.full_name ?? "the routed role"}. Approve staff replies below.
            </p>
          </div>
        )}
        {!isSuperAdmin && isReadOnlyViewer && (
          <div className="mb-3 p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            <p className="font-bold">Read-only view</p>
            <p className="mt-1 text-xs opacity-90">
              You are not the assigned responder on this ticket.
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div>
            <h2 className="font-black text-lg">{ticket.families?.household_name}</h2>
            <p className="text-sm text-zinc-500">
              {categoryLabel(ticket.category)} · {ticket.subtopic}
              {ticket.students?.full_name && ` · ${ticket.students.full_name}`}
            </p>
            <p className="text-xs mt-1">
              Status: <span className="font-bold">{statusLabel(ticket.status)}</span>
              {ticket.current_assignee && <> · Assignee: {ticket.current_assignee.full_name}</>}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {isUnclaimedFinance && userRole === "FINANCE_CLERK" && (
              <button
                onClick={handleClaim}
                disabled={claimLoading}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-40"
              >
                {claimLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Claim
              </button>
            )}
            {isFinance && isAssignee && userRole === "FINANCE_CLERK" && !isClosed && (
              <button
                onClick={() => setShowClaim(true)}
                className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Transfer
              </button>
            )}
            {userRole === "GENERAL_RESPONDENT" && isAssignee && !isClosed && (
              <button
                onClick={() => setShowForward(true)}
                className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Forward
              </button>
            )}
            {!isClosed && isAssignee && (
              <button
                onClick={() => setShowCloseModal(true)}
                className="px-3 py-1.5 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 rounded-xl text-sm font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/20"
              >
                Close
              </button>
            )}
          </div>
        </div>
        <p className="mt-3 text-sm bg-zinc-100 dark:bg-zinc-800 p-3 rounded-xl">{ticket.description}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 relative">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400 gap-2">
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs">
              {isAssignee ? "Send a reply when you are ready to respond." : "Waiting for conversation to begin."}
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`max-w-[80%] p-3 rounded-2xl text-sm ${
              msg.sender_type === "STAFF"
                ? "ml-auto bg-primary text-white"
                : "bg-white dark:bg-zinc-800 border dark:border-zinc-700"
            }`}
          >
            <p className="text-[10px] font-bold opacity-80 mb-1">{senderName(msg)}</p>
            <p>{msg.content}</p>
            {renderMedia(msg)}
            <div className="flex gap-2 mt-1 text-[10px] opacity-70 flex-wrap items-center">
              <span>{format(new Date(msg.created_at), "h:mm a")}</span>
              {msg.sender_type === "STAFF" && (
                <span className="font-bold uppercase">{statusLabel(msg.status)}</span>
              )}
              {msg.review_comment && <span>Rejected: {msg.review_comment}</span>}
            </div>
            {isSuperAdmin && msg.sender_type === "STAFF" && msg.status === "PENDING" && (
              <div className="mt-2 pt-2 border-t border-white/20 flex flex-wrap gap-2">
                <button
                  disabled={reviewLoading === msg.id}
                  onClick={() => reviewMessage(msg.id, "APPROVED")}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  {reviewLoading === msg.id && <Loader2 className="h-3 w-3 animate-spin" />}
                  Approve
                </button>
                <button
                  disabled={reviewLoading === msg.id}
                  onClick={() => setRejectId(rejectId === msg.id ? null : msg.id)}
                  className="px-2 py-1 bg-red-600 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  Reject
                </button>
                {rejectId === msg.id && (
                  <div className="w-full flex gap-2 mt-1">
                    <input
                      value={rejectComment}
                      onChange={(e) => setRejectComment(e.target.value)}
                      placeholder="Rejection reason..."
                      className="flex-1 px-2 py-1 rounded-lg text-xs text-zinc-900"
                    />
                    <button
                      onClick={() => reviewMessage(msg.id, "REJECTED", rejectComment)}
                      className="px-2 py-1 bg-white text-red-600 rounded-lg text-xs font-bold"
                    >
                      Confirm
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {!isClosed && isAssignee && (
        <div className="relative p-4 border-t bg-white dark:bg-zinc-950">
          {!isConnected && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 dark:bg-zinc-950/60 backdrop-blur-sm">
              <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Offline — reconnecting</p>
            </div>
          )}
          <div className="flex gap-2 items-center">
            <label className={`cursor-pointer px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold shrink-0 ${composerDisabled ? "opacity-50 pointer-events-none" : ""}`}>
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin inline" />
              ) : (
                "Attach"
              )}
              <input
                type="file"
                className="hidden"
                accept="image/*,.pdf,.doc,.docx"
                disabled={composerDisabled}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Write a reply (requires Super Admin approval)..."
              disabled={composerDisabled}
              className="flex-1 px-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={composerDisabled || !reply.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-40"
            >
              {isSending && <Loader2 className="h-4 w-4 animate-spin" />}
              Send
            </button>
          </div>
        </div>
      )}

      {showCloseModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => !closeLoading && setShowCloseModal(false)}
        >
          <div
            className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-xl font-bold">Close ticket?</h3>
              <p className="text-sm text-zinc-500 mt-1">The parent will no longer be able to reply.</p>
            </div>
            <div className="p-6">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Closing note (optional)</label>
              <textarea
                value={closeNote}
                onChange={(e) => setCloseNote(e.target.value)}
                rows={3}
                className="w-full mt-2 p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </div>
            <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3">
              <button
                type="button"
                disabled={closeLoading}
                onClick={() => setShowCloseModal(false)}
                className="px-5 h-11 rounded-xl text-zinc-600 dark:text-zinc-400 font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={closeLoading}
                onClick={handleClose}
                className="inline-flex items-center gap-2 px-5 h-11 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm disabled:opacity-50"
              >
                {closeLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Close ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {showClaim && (
        <ClaimTransferModal
          ticketId={ticket.id}
          currentUserId={userId}
          onClose={() => setShowClaim(false)}
          onSuccess={onRefresh}
        />
      )}
      {showForward && (
        <ForwardTicketModal
          ticketId={ticket.id}
          currentUserId={userId}
          onClose={() => setShowForward(false)}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
}
