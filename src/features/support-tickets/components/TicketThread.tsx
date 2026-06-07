"use client";

import { format } from "date-fns";
import { useState } from "react";
import { useDispatch } from "react-redux";
import toast from "react-hot-toast";
import api from "@/lib/api";
import type { AppDispatch } from "@/store/store";
import type { SupportTicket, TicketMessage } from "@/store/slices/supportTicketsSlice";
import { claimTicket, closeTicket, reviewTicketMessage } from "@/store/slices/supportTicketsSlice";
import { ClaimTransferModal } from "./ClaimTransferModal";
import { ForwardTicketModal } from "./ForwardTicketModal";

interface TicketThreadProps {
  ticket: SupportTicket & { messages?: TicketMessage[]; description?: string };
  userId?: string;
  userRole?: string;
  isSending?: boolean;
  onRefresh: () => void;
  onSendMessage: (content: string, mediaMetadata?: Record<string, unknown>) => Promise<void>;
}

export function TicketThread({
  ticket,
  userId,
  userRole,
  isSending = false,
  onRefresh,
  onSendMessage,
}: TicketThreadProps) {
  const dispatch = useDispatch<AppDispatch>();
  const [reply, setReply] = useState("");
  const [showClaim, setShowClaim] = useState(false);
  const [showForward, setShowForward] = useState(false);
  const [reviewLoading, setReviewLoading] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [uploading, setUploading] = useState(false);

  const isClosed = ticket.status === "CLOSED";
  const isFinance = ticket.category === "FINANCIAL";
  const isUnclaimedFinance = isFinance && !ticket.current_assignee_id;
  const isAssignee = Boolean(userId && ticket.current_assignee_id === userId);
  const isSuperAdmin = userRole === "SUPER_ADMIN";
  const messages = [...(ticket.messages ?? [])].reverse();

  const handleSend = async () => {
    if (!reply.trim()) return;
    try {
      await onSendMessage(reply.trim());
      setReply("");
      toast.success("Reply submitted for approval");
    } catch {
      toast.error("Failed to send reply");
    }
  };

  const handleClose = async () => {
    if (!window.confirm("Close this ticket? The parent will no longer be able to reply.")) return;
    try {
      await dispatch(closeTicket({ ticketId: ticket.id })).unwrap();
      toast.success("Ticket closed");
      onRefresh();
    } catch {
      toast.error("Failed to close ticket");
    }
  };

  const handleClaim = async () => {
    try {
      await dispatch(claimTicket(ticket.id)).unwrap();
      toast.success("Ticket claimed");
      onRefresh();
    } catch {
      toast.error("Could not claim — someone else may have taken it");
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
    } catch {
      toast.error("Review failed");
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
          <img src={meta.url} alt="" className="mt-2 max-w-full rounded-lg max-h-48 object-cover" />
        </a>
      );
    }
    return (
      <a href={meta.url} target="_blank" rel="noreferrer" className="underline text-xs mt-2 block">
        Open attachment
      </a>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-zinc-900">
      <div className="p-4 border-b bg-white dark:bg-zinc-950 dark:border-zinc-800">
        {isSuperAdmin && !isAssignee && !isClosed && (
          <div className="mb-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-sm text-amber-900 dark:text-amber-100 border border-amber-200 dark:border-amber-900/50">
            <p className="font-bold">Super Admin oversight</p>
            <p className="mt-1 text-xs opacity-90">
              Assigned to {ticket.current_assignee?.full_name ?? "the routed role"}. Approve staff replies below.
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div>
            <h2 className="font-black text-lg">{ticket.families?.household_name}</h2>
            <p className="text-sm text-zinc-500">
              {ticket.category} · {ticket.subtopic}
              {ticket.students?.full_name && ` · ${ticket.students.full_name}`}
            </p>
            <p className="text-xs mt-1">
              Status: <span className="font-bold">{ticket.status}</span>
              {ticket.current_assignee && <> · Assignee: {ticket.current_assignee.full_name}</>}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {isUnclaimedFinance && userRole === "FINANCE_CLERK" && (
              <button onClick={handleClaim} className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-bold">
                Claim
              </button>
            )}
            {isFinance && isAssignee && userRole === "FINANCE_CLERK" && !isClosed && (
              <button onClick={() => setShowClaim(true)} className="px-3 py-1.5 border rounded-lg text-sm">
                Transfer
              </button>
            )}
            {userRole === "GENERAL_RESPONDENT" && isAssignee && !isClosed && (
              <button onClick={() => setShowForward(true)} className="px-3 py-1.5 border rounded-lg text-sm">
                Forward
              </button>
            )}
            {!isClosed && isAssignee && (
              <button onClick={handleClose} className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-sm">
                Close
              </button>
            )}
          </div>
        </div>
        <p className="mt-3 text-sm bg-zinc-100 dark:bg-zinc-800 p-3 rounded-xl">{ticket.description}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`max-w-[80%] p-3 rounded-2xl text-sm ${
              msg.sender_type === "STAFF"
                ? "ml-auto bg-primary text-white"
                : "bg-white dark:bg-zinc-800 border dark:border-zinc-700"
            }`}
          >
            <p>{msg.content}</p>
            {renderMedia(msg)}
            <div className="flex gap-2 mt-1 text-[10px] opacity-70 flex-wrap items-center">
              <span>{format(new Date(msg.created_at), "h:mm a")}</span>
              {msg.sender_type === "STAFF" && <span className="font-bold uppercase">{msg.status}</span>}
              {msg.review_comment && <span>Rejected: {msg.review_comment}</span>}
            </div>
            {isSuperAdmin && msg.sender_type === "STAFF" && msg.status === "PENDING" && (
              <div className="mt-2 pt-2 border-t border-white/20 flex flex-wrap gap-2">
                <button
                  disabled={reviewLoading === msg.id}
                  onClick={() => reviewMessage(msg.id, "APPROVED")}
                  className="px-2 py-1 bg-green-600 text-white rounded text-[10px] font-bold"
                >
                  Approve
                </button>
                <button
                  disabled={reviewLoading === msg.id}
                  onClick={() => setRejectId(rejectId === msg.id ? null : msg.id)}
                  className="px-2 py-1 bg-red-600 text-white rounded text-[10px] font-bold"
                >
                  Reject
                </button>
                {rejectId === msg.id && (
                  <div className="w-full flex gap-2 mt-1">
                    <input
                      value={rejectComment}
                      onChange={(e) => setRejectComment(e.target.value)}
                      placeholder="Rejection reason..."
                      className="flex-1 px-2 py-1 rounded text-xs text-zinc-900"
                    />
                    <button
                      onClick={() => reviewMessage(msg.id, "REJECTED", rejectComment)}
                      className="px-2 py-1 bg-white text-red-600 rounded text-[10px] font-bold"
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
        <div className="p-4 border-t bg-white dark:bg-zinc-950 flex gap-2 items-center">
          <label className="cursor-pointer px-2 py-2 border rounded-xl text-xs font-bold shrink-0">
            {uploading ? "…" : "Attach"}
            <input
              type="file"
              className="hidden"
              accept="image/*,.pdf,.doc,.docx"
              disabled={uploading}
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
            className="flex-1 px-4 py-2 border rounded-xl dark:bg-zinc-900 dark:border-zinc-800"
          />
          <button
            onClick={handleSend}
            disabled={isSending || uploading || !reply.trim()}
            className="px-4 py-2 bg-primary text-white rounded-xl font-bold disabled:opacity-50"
          >
            Send
          </button>
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
