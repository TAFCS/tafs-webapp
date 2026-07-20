"use client";

import { format } from "date-fns";
import { FileText, Loader2, Mic, Send, X, User, ShieldCheck, Phone } from "lucide-react";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useDispatch } from "react-redux";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useSocket } from "@/context/SocketContext";
import type { AppDispatch } from "@/store/store";
import type { SupportTicket, TicketMessage } from "@/store/slices/supportTicketsSlice";
import { claimTicket, closeTicket, reviewTicketMessage } from "@/store/slices/supportTicketsSlice";
import { categoryLabel, statusLabel, ticketRequesterLabel } from "@/features/support-tickets/supportTicketLabels";
import { ClaimTransferModal } from "./ClaimTransferModal";
import { ForwardTicketModal } from "./ForwardTicketModal";

interface TicketThreadProps {
  ticket: SupportTicket & { messages?: TicketMessage[]; description?: string };
  userId?: string;
  userRole?: string;
  isSending?: boolean;
  detailError?: string | null;
  onRetryDetail?: () => void;
  onRefresh: () => void;
  onSendMessage: (
    content: string,
    mediaMetadata?: Record<string, unknown>,
    messageType?: string,
  ) => Promise<void>;
}

function mediaUrl(msg: TicketMessage): string {
  const meta = msg.media_metadata as { url?: string } | null | undefined;
  return meta?.url ?? msg.content;
}

function voiceAudioSrc(url: string): string {
  if (url.includes("digitaloceanspaces.com")) {
    return `/api/v1/chat/media/proxy?key=${url.split("digitaloceanspaces.com/")[1]}`;
  }
  return url;
}

function inferMessageType(file: File): "IMAGE" | "VOICE" | "DOCUMENT" {
  if (file.type.startsWith("image/")) return "IMAGE";
  if (file.type.startsWith("audio/")) return "VOICE";
  return "DOCUMENT";
}

const isNewDay = (currentMsg: TicketMessage, prevMsg?: TicketMessage) => {
  if (!prevMsg) return true;
  const currentDate = new Date(currentMsg.created_at).toDateString();
  const prevDate = new Date(prevMsg.created_at).toDateString();
  return currentDate !== prevDate;
};

const formatSeparatorDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  } else if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  } else {
    return format(date, "MMMM d, yyyy");
  }
};

function senderName(msg: TicketMessage): string {
  if (msg.sender_type === "GUARDIAN") {
    return msg.sender_guardian?.full_name ?? "Parent";
  }
  return msg.sender_user?.full_name ?? "Staff";
}

function isSuperAdminMessage(msg: TicketMessage): boolean {
  return msg.sender_type === "STAFF" && msg.sender_user?.role === "SUPER_ADMIN";
}

function isOwnStaffMessage(msg: TicketMessage, userId?: string): boolean {
  return msg.sender_type === "STAFF" && Boolean(userId && msg.sender_user?.id === userId);
}

const SENDER_COLORS = [
  "#e11d48", "#ea580c", "#d97706", "#16a34a", "#0d9488",
  "#2563eb", "#7c3aed", "#db2777", "#0891b2", "#9333ea",
  "#c2410c", "#15803d", "#0369a1", "#6d28d9", "#be185d",
];

function msgSenderKey(msg: TicketMessage): string {
  if (msg.sender_type === "GUARDIAN") {
    return `g:${msg.sender_guardian?.full_name ?? "unknown"}`;
  }
  return `s:${msg.sender_user?.id ?? msg.sender_user?.full_name ?? "unknown"}`;
}

function buildSenderColorMap(messages: TicketMessage[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const msg of messages) {
    const key = msgSenderKey(msg);
    if (!map.has(key)) {
      map.set(key, SENDER_COLORS[map.size % SENDER_COLORS.length]);
    }
  }
  return map;
}

function incomingLabelForSuperAdmin(
  msg: TicketMessage,
  assigneeId?: string | null,
): string {
  if (msg.sender_type === "GUARDIAN") {
    const name = msg.sender_guardian?.full_name;
    return name ? `Parent · ${name}` : "Parent";
  }
  const name = msg.sender_user?.full_name ?? "Staff";
  const role = msg.sender_user?.role?.replaceAll("_", " ") ?? "Assignee";
  if (msg.sender_user?.id === assigneeId) {
    return `${name} · ${role}`;
  }
  if (isSuperAdminMessage(msg)) {
    return `${name} · Super Admin`;
  }
  return `${name} · ${role}`;
}

export function TicketThread({
  ticket,
  userId,
  userRole,
  isSending = false,
  detailError,
  onRetryDetail,
  onRefresh,
  onSendMessage,
}: TicketThreadProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { socket } = useSocket();
  const [reply, setReply] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageTailRef = useRef<string | null>(null);
  const [parentTyping, setParentTyping] = useState(false);
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
  const [isRecording, setIsRecording] = useState(false);
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmit = useRef(0);
  const [recordingTime, setRecordingTime] = useState(0);

  const [showStudentDetails, setShowStudentDetails] = useState(false);
  const [familyStudents, setFamilyStudents] = useState<any[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const shouldSend = useRef(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchFamilyStudents = async () => {
    if (!ticket.family_id) return;
    setIsLoadingStudents(true);
    try {
      const res = await api.get(`v1/chat/family/${ticket.family_id}/students`);
      setFamilyStudents(res.data);
      setShowStudentDetails(true);
    } catch (err) {
      console.error("Failed to fetch family students:", err);
      toast.error("Failed to load family students");
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const isClosed = ticket.status === "CLOSED";
  const isFinance = ticket.category === "FINANCIAL";
  const isUnclaimedFinance = isFinance && !ticket.current_assignee_id;
  const isAssignee = Boolean(userId && ticket.current_assignee_id === userId);
  const isSuperAdmin = userRole === "SUPER_ADMIN";
  const isReadOnlyViewer = !isClosed && !isAssignee;
  const canCompose = !isClosed && (isAssignee || isSuperAdmin);
  const messages = useMemo(
    () => [...(ticket.messages ?? [])].reverse(),
    [ticket.messages],
  );
  const senderColorMap = buildSenderColorMap(messages);
  const composerDisabled = isSending || uploading;

  const messageTailKey = useMemo(() => {
    if (messages.length === 0) return "";
    const tail = messages[messages.length - 1];
    return `${tail?.id ?? ""}:${tail?.status ?? ""}:${messages.length}`;
  }, [messages]);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = messagesScrollRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? "smooth" : "instant",
    });
  }, []);

  useEffect(() => {
    prevMessageTailRef.current = null;
  }, [ticket.id]);

  useEffect(() => {
    if (!messageTailKey) return;

    const jump = () => scrollToBottom(false);
    jump();
    const raf1 = requestAnimationFrame(() => {
      jump();
      requestAnimationFrame(jump);
    });
    return () => cancelAnimationFrame(raf1);
  }, [ticket.id, messageTailKey, scrollToBottom]);

  useEffect(() => {
    if (!messageTailKey) return;

    if (prevMessageTailRef.current === messageTailKey) return;

    const isFirstPaint = prevMessageTailRef.current === null;
    prevMessageTailRef.current = messageTailKey;
    scrollToBottom(!isFirstPaint);
  }, [messageTailKey, scrollToBottom]);

  const emitTyping = (isTyping: boolean) => {
    if (!socket || !ticket.id) return;
    socket.emit("ticketTyping", { ticketId: ticket.id, isTyping });
  };

  const handleReplyChange = (value: string) => {
    setReply(value);
    if (!canCompose) return;
    const now = Date.now();
    // Emit promptly so the parent sees "Support is typing…" without a long delay.
    if (value.trim() && now - lastTypingEmit.current > 400) {
      lastTypingEmit.current = now;
      emitTyping(true);
    }
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    typingStopTimer.current = setTimeout(() => emitTyping(false), 1600);
  };

  useEffect(() => {
    if (!socket || !ticket.id) return;
    const onTyping = (payload: {
      ticketId?: string;
      isTyping?: boolean;
      userType?: string;
      userId?: string;
    }) => {
      if (payload.ticketId !== ticket.id) return;
      if (payload.userType !== "PARENT") return;
      if (payload.userId && payload.userId === userId) return;
      setParentTyping(!!payload.isTyping);
      if (payload.isTyping) {
        window.setTimeout(() => setParentTyping(false), 3000);
      }
    };
    socket.on("ticketTyping", onTyping);
    return () => {
      socket.off("ticketTyping", onTyping);
      if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
      emitTyping(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, ticket.id, userId]);

  const handleSend = async () => {
    if (!reply.trim() || composerDisabled) return;
    try {
      emitTyping(false);
      await onSendMessage(reply.trim());
      setReply("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "40px";
      }
      toast.success(isSuperAdmin ? "Reply sent" : "Reply submitted for approval");
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
    if (status === "REJECTED" && !comment?.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
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
      const url = media.url as string;
      const messageType = inferMessageType(file);
      await onSendMessage(url, { ...media, url }, messageType);
      toast.success(messageType === "VOICE" ? "Voice note sent" : "Attachment sent");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "audio/webm";
      mediaRecorder.current = new MediaRecorder(stream, { mimeType });
      audioChunks.current = [];
      shouldSend.current = true;
      mediaRecorder.current.ondataavailable = (e) => audioChunks.current.push(e.data);
      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: "audio/mp4" });
        const audioFile = new File([audioBlob], `voice_${Date.now()}.m4a`, { type: "audio/mp4" });

        if (shouldSend.current) {
          setUploading(true);
          try {
            const form = new FormData();
            form.append("file", audioFile);
            const res = await api.post("v1/support-tickets/media", form, {
              headers: { "Content-Type": "multipart/form-data" },
            });
            const media = res.data.data ?? res.data;
            const url = media.url as string;
            await onSendMessage(url, { ...media, url, duration: recordingTime }, "VOICE");
            toast.success("Voice note sent");
          } catch {
            toast.error("Failed to upload voice note");
          } finally {
            setUploading(false);
          }
        }
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const renderMedia = (msg: TicketMessage) => {
    if (msg.message_type === "TEXT") return null;

    const url = mediaUrl(msg);
    const isPlayableUrl = url.startsWith("http") || url.includes("digitaloceanspaces.com");

    if (msg.message_type === "VOICE") {
      if (!isPlayableUrl) {
        return <p className="text-xs opacity-70 mt-2">Voice message unavailable</p>;
      }
      return (
        <audio
          src={voiceAudioSrc(url)}
          controls
          className="max-w-full h-10 scale-90 origin-left mt-2"
        />
      );
    }

    if (!isPlayableUrl) return null;

    if (msg.message_type === "IMAGE") {
      return (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt="Attachment" className="mt-2 max-w-full rounded-lg max-h-48 object-cover" />
        </a>
      );
    }

    const meta = msg.media_metadata as { originalName?: string; mimetype?: string } | null | undefined;
    return (
      <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-3 mt-2 min-w-[200px]">
        <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <span className="text-xs font-bold truncate underline">
          {meta?.originalName ?? "Document"}
        </span>
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

      {/* ── Thread Header ── */}
      <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950">

        {/* Row 1: Family name + badges + actions */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2 flex-wrap">
            <h2 className="font-black text-sm tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
              {ticketRequesterLabel(ticket)}
            </h2>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide shrink-0 ${
              isClosed
                ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                : ticket.status === "ASSIGNED"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
            }`}>
              {statusLabel(ticket.status)}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide shrink-0 ${
              isFinance
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                : "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400"
            }`}>
              {categoryLabel(ticket.category)}
            </span>
            <span className="text-xs text-zinc-400 truncate hidden sm:inline">
              {ticket.subtopic ?? "General inquiry"}
              {ticket.current_assignee && ` · ${ticket.current_assignee.full_name}`}
            </span>
            {isSuperAdmin && isReadOnlyViewer && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400 shrink-0">
                Awaiting reply from {ticket.current_assignee?.full_name ?? "assignee"} — you can reply or close.
              </span>
            )}
            {!isSuperAdmin && isReadOnlyViewer && (
              <span className="text-[11px] text-zinc-400 shrink-0">Read-only</span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {ticket.family_id && (
              <button
                onClick={fetchFamilyStudents}
                disabled={isLoadingStudents}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
              >
                {isLoadingStudents ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                Family
              </button>
            )}
            {isUnclaimedFinance && userRole === "FINANCE_CLERK" && (
              <button
                onClick={handleClaim}
                disabled={claimLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-bold hover:opacity-90 disabled:opacity-40 transition-colors"
              >
                {claimLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Claim
              </button>
            )}
            {isFinance && isAssignee && userRole === "FINANCE_CLERK" && !isClosed && (
              <button
                onClick={() => setShowClaim(true)}
                className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Transfer
              </button>
            )}
            {userRole === "GENERAL_RESPONDENT" && isAssignee && !isClosed && (
              <button
                onClick={() => setShowForward(true)}
                className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Forward
              </button>
            )}
            {!isClosed && (isAssignee || isSuperAdmin) && (
              <button
                onClick={() => setShowCloseModal(true)}
                className="px-3 py-1.5 border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Student info — compact inline card */}
        {ticket.students && (
          <div className="mt-2 flex items-center gap-2 px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800">
            <div className="h-7 w-7 rounded-md overflow-hidden bg-zinc-200 dark:bg-zinc-800 flex-shrink-0">
              {(ticket.students.photograph_url || ticket.students.photo_blue_bg_url) ? (
                <img
                  src={ticket.students.photograph_url || ticket.students.photo_blue_bg_url || ""}
                  alt={ticket.students.full_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <User className="h-3 w-3 text-zinc-400" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">{ticket.students.full_name}</span>
              <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[9px] font-black">CC: {ticket.students.cc}</span>
              {ticket.students.gr_number && (
                <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded text-[9px] font-black">GR: {ticket.students.gr_number}</span>
              )}
              {ticket.students.classes?.description && (
                <span className="text-[10px] text-zinc-400">{ticket.students.classes.description} {ticket.students.sections?.description}</span>
              )}
              {ticket.students.campuses?.campus_name && (
                <span className="text-[10px] text-zinc-400">· {ticket.students.campuses.campus_name}</span>
              )}
              {(ticket.students.primary_phone || ticket.students.whatsapp_number) && (
                <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                  <Phone className="h-2.5 w-2.5" />
                  {ticket.students.primary_phone || ticket.students.whatsapp_number}
                  {ticket.students.whatsapp_number && ticket.students.whatsapp_number !== ticket.students.primary_phone && (
                    <span className="px-1 bg-green-500/10 text-green-600 rounded text-[8px] font-black">WA</span>
                  )}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Row 3: Original description */}
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/40 rounded-lg px-3 py-1.5 leading-relaxed">
          {ticket.description}
        </p>
      </div>

      <div ref={messagesScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 relative">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400 gap-2">
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs">
              {isAssignee ? "Send a reply when you are ready to respond." : "Waiting for conversation to begin."}
            </p>
          </div>
        )}
        {messages.map((msg, index) => {
          const ownMessage = isOwnStaffMessage(msg, userId);
          const onRight = ownMessage;
          const incomingStaff =
            msg.sender_type === "STAFF" && !ownMessage;
          const prevMsg = index > 0 ? messages[index - 1] : undefined;
          const showDateHeader = isNewDay(msg, prevMsg);

          return (
            <div key={msg.id} className="w-full flex flex-col gap-3">
              {showDateHeader && (
                <div className="flex justify-center my-3 w-full">
                  <span className="px-3 py-1 bg-zinc-200/80 dark:bg-zinc-800/80 text-[10px] font-black uppercase text-zinc-500 rounded-full select-none">
                    {formatSeparatorDate(msg.created_at)}
                  </span>
                </div>
              )}
              <div
                className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                  onRight
                    ? "ml-auto bg-primary text-white"
                    : "bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700"
                }`}
              >
                <p
                  className={`text-[10px] font-bold opacity-80 mb-1 flex flex-wrap items-center gap-1 ${
                    onRight ? "justify-end" : ""
                  }`}
                >
                  {isSuperAdmin ? (
                    ownMessage ? (
                      <>
                        <span>{senderName(msg)}</span>
                        {isSuperAdminMessage(msg) && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-400/90 text-amber-950 text-[9px] uppercase tracking-wide">
                            Super Admin
                          </span>
                        )}
                      </>
                    ) : (
                      <span style={{ color: senderColorMap.get(msgSenderKey(msg)) }}>
                        {incomingLabelForSuperAdmin(msg, ticket.current_assignee_id)}
                      </span>
                    )
                  ) : (
                    <>
                      <span style={onRight ? undefined : { color: senderColorMap.get(msgSenderKey(msg)) }}>
                        {msg.sender_type === "GUARDIAN"
                          ? incomingLabelForSuperAdmin(msg, ticket.current_assignee_id)
                          : senderName(msg)}
                      </span>
                      {isSuperAdminMessage(msg) && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-400/90 text-amber-950 text-[9px] uppercase tracking-wide">
                          Super Admin
                        </span>
                      )}
                    </>
                  )}
                </p>
                {msg.message_type === "TEXT" && (
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                )}
                {renderMedia(msg)}
                <div className="flex gap-2 mt-1 text-[10px] opacity-70 flex-wrap items-center">
                  <span>{format(new Date(msg.created_at), "h:mm a")}</span>
                  {msg.sender_type === "STAFF" &&
                    msg.status !== "APPROVED" &&
                    !(isSuperAdmin && ownMessage) && (
                    <span className="font-bold uppercase">{statusLabel(msg.status)}</span>
                  )}
                  {msg.status === "REJECTED" && msg.review_comment && (
                    <span className={onRight ? "font-semibold text-red-200" : "text-red-600 dark:text-red-400"}>
                      Reason: {msg.review_comment}
                    </span>
                  )}
                </div>
                {isSuperAdmin && incomingStaff && msg.status === "PENDING" && (
                  <div className={`mt-2 pt-2 border-t flex flex-wrap gap-2 ${
                    onRight ? "border-white/20" : "border-zinc-200 dark:border-zinc-700"
                  }`}>
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
                          disabled={reviewLoading === msg.id || !rejectComment.trim()}
                          onClick={() => reviewMessage(msg.id, "REJECTED", rejectComment)}
                          className="px-2 py-1 bg-white text-red-600 rounded-lg text-xs font-bold disabled:opacity-50"
                        >
                          Confirm
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} aria-hidden="true" className="h-px shrink-0" />
      </div>

      {canCompose ? (
        <div className="relative p-4 border-t bg-white dark:bg-zinc-950">
          {parentTyping && (
            <p className="absolute -top-7 left-4 text-[11px] font-semibold text-zinc-500 animate-pulse">
              Parent is typing…
            </p>
          )}
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-1 shrink-0">
              {!isRecording && (
                <>
                  <label className={`cursor-pointer px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold ${composerDisabled ? "opacity-50 pointer-events-none" : ""}`}>
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin inline" />
                    ) : (
                      "Attach"
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,audio/*"
                      disabled={composerDisabled}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={composerDisabled}
                    className="p-2 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-500 hover:text-primary disabled:opacity-50"
                    aria-label="Record voice note"
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                </>
              )}
              {isRecording && (
                <button
                  type="button"
                  onClick={() => {
                    shouldSend.current = false;
                    stopRecording();
                  }}
                  className="p-2 border border-red-200 dark:border-red-900/50 rounded-xl text-red-500"
                  aria-label="Cancel recording"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {isRecording ? (
              <div className="flex-1 flex items-center gap-3 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-xl border border-red-100 dark:border-red-900/30">
                <div className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                  Recording • {formatRecordingTime(recordingTime)}
                </span>
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                value={reply}
                onChange={(e) => {
                  handleReplyChange(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  isSuperAdmin
                    ? "Write a direct reply to the parent..."
                    : "Write a reply (requires Super Admin approval)..."
                }
                disabled={composerDisabled}
                rows={1}
                className="flex-1 px-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 resize-none min-h-[40px] max-h-[120px] align-middle overflow-y-auto"
                style={{ height: "40px" }}
              />
            )}
            <button
              onClick={isRecording ? stopRecording : handleSend}
              disabled={composerDisabled || (!isRecording && !reply.trim())}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold hover:opacity-90 disabled:opacity-40 ${
                isRecording ? "bg-red-500 text-white" : "bg-primary text-white"
              }`}
            >
              {(isSending || uploading) && !isRecording && <Loader2 className="h-4 w-4 animate-spin" />}
              {isRecording ? (
                <div className="h-4 w-4 rounded-sm bg-white animate-pulse" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      ) : isClosed ? (
        <div className="p-4 border-t bg-white dark:bg-zinc-950 shrink-0">
          <div className="px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700">
            <p className="text-xs font-bold text-zinc-700 dark:text-zinc-200">This query is closed</p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Messaging is disabled. You can still review the conversation history.
            </p>
          </div>
        </div>
      ) : null}

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

      {showStudentDetails && (
        <div
          className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowStudentDetails(false)}
        >
          <div
            className="bg-white dark:bg-zinc-950 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
              <div>
                <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 tracking-tight">Family Students</h3>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">{familyStudents.length} Students Enrolled</p>
              </div>
              <button onClick={() => setShowStudentDetails(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto flex flex-col gap-4">
              {familyStudents.map((student) => (
                <div key={student.cc} className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 group hover:border-primary/30 transition-all">
                  <div className="h-16 w-16 rounded-xl overflow-hidden bg-zinc-200 dark:bg-zinc-800 flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    {(student.photograph_url || student.photo_blue_bg_url) ? (
                      <img src={student.photograph_url || student.photo_blue_bg_url} className="h-full w-full object-cover" alt="" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center"><User className="h-8 w-8 text-zinc-400" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-black text-sm text-zinc-900 dark:text-zinc-100 tracking-tight">{student.full_name}</h4>
                      <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded-md text-[9px] font-black uppercase tracking-wider">
                        CC: {student.cc}
                      </span>
                      {student.gr_number && (
                        <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-md text-[9px] font-black uppercase tracking-wider">
                          GR: {student.gr_number}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="px-2 py-0.5 bg-white dark:bg-zinc-800 rounded-md text-[9px] font-black border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400">{student.classes?.description} {student.sections?.description}</span>
                      <span className="px-2 py-0.5 bg-white dark:bg-zinc-800 rounded-md text-[9px] font-black border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400">{student.campuses?.campus_name}</span>
                    </div>
                    {(student.primary_phone || student.whatsapp_number) && (
                      <div className="flex gap-2 items-center text-[10px] text-zinc-500 font-semibold mt-2">
                        <Phone className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                        <span>{student.primary_phone || student.whatsapp_number}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800">
              <button onClick={() => setShowStudentDetails(false)} className="w-full py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all shadow-sm">Close Details</button>
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
