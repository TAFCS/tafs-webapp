"use client";

import { useCallback, useEffect, useRef } from "react";
import { AlertCircle, Loader2, RefreshCcw } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { useSocket } from "@/context/SocketContext";
import { useAuthState } from "@/context/AuthContext";
import type { AppDispatch, RootState } from "@/store/store";
import {
  addPendingApproval,
  appendTicketMessage,
  clearQueueError,
  fetchClosedTickets,
  fetchFinanceQueue,
  fetchMyQueue,
  fetchOversightQueue,
  fetchPendingApprovals,
  fetchTicketDetail,
  markTicketRead,
  removeOpenQueueTicket,
  sendTicketMessage,
  setQueueTab,
  setSelectedTicketId,
  updateMessageReviewStatus,
  upsertQueueTicket,
} from "@/store/slices/supportTicketsSlice";
import {
  TicketQueueList,
  TicketThreadLoading,
  TicketThreadPlaceholder,
} from "@/features/support-tickets/components/TicketQueueList";
import { TicketThread } from "@/features/support-tickets/components/TicketThread";
import { SuperAdminApprovalQueue } from "@/features/support-tickets/components/SuperAdminApprovalQueue";
import { canViewSupportTickets } from "@/features/support-tickets/supportTicketAccess";
import type { PendingApproval, SupportTicket, TicketMessage } from "@/store/slices/supportTicketsSlice";

export default function SupportTicketsPage() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { socket, isConnected } = useSocket();
  const { user, isLoading: authLoading } = useAuthState();
  const {
    queueTab,
    queueItems,
    closedItems,
    selectedTicketId,
    selectedTicket,
    pendingApprovals,
    isLoadingQueue,
    isLoadingDetail,
    isLoadingApprovals,
    isSending,
    queueError,
    detailError,
  } = useSelector((s: RootState) => s.supportTickets);

  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedTicketId;
  const roleDefaultApplied = useRef(false);

  const hasPermission = canViewSupportTickets(user);

  const loadQueue = useCallback(() => {
    if (queueTab === "my-queue") dispatch(fetchMyQueue());
    else if (queueTab === "finance-queue") dispatch(fetchFinanceQueue());
    else if (queueTab === "oversight") dispatch(fetchOversightQueue());
    else dispatch(fetchClosedTickets());
  }, [dispatch, queueTab]);

  const loadDetail = useCallback(() => {
    if (selectedTicketId) dispatch(fetchTicketDetail(selectedTicketId));
  }, [dispatch, selectedTicketId]);

  useEffect(() => {
    if (!user || roleDefaultApplied.current) return;
    roleDefaultApplied.current = true;
    if (user.role === "SUPER_ADMIN") dispatch(setQueueTab("oversight"));
    else if (user.role === "CAMPUS_ADMIN") dispatch(setQueueTab("closed"));
  }, [dispatch, user]);

  useEffect(() => {
    if (!hasPermission) return;
    loadQueue();
  }, [loadQueue, hasPermission]);

  useEffect(() => {
    if (user?.role === "SUPER_ADMIN") {
      dispatch(fetchPendingApprovals());
    }
  }, [dispatch, user?.role]);

  useEffect(() => {
    if (!selectedTicketId || !hasPermission) return;
    dispatch(fetchTicketDetail(selectedTicketId));
    dispatch(markTicketRead(selectedTicketId));
    socket?.emit("enterTicket", { ticketId: selectedTicketId });
    return () => {
      socket?.emit("leaveTicket", { ticketId: selectedTicketId });
    };
  }, [selectedTicketId, dispatch, socket, hasPermission]);

  useEffect(() => {
    if (!socket || !hasPermission) return;

    const resync = () => {
      loadQueue();
      if (selectedRef.current) {
        dispatch(fetchTicketDetail(selectedRef.current));
        socket.emit("enterTicket", { ticketId: selectedRef.current });
      }
      if (user?.role === "SUPER_ADMIN") dispatch(fetchPendingApprovals());
    };

    const onCreated = (payload: { ticket?: SupportTicket }) => {
      if (payload.ticket) dispatch(upsertQueueTicket(payload.ticket));
      else resync();
    };

    const onClaimed = (payload: { ticket?: SupportTicket }) => {
      if (payload.ticket) dispatch(upsertQueueTicket(payload.ticket));
    };

    const onClosed = (payload: { ticket?: { id: string } }) => {
      if (payload.ticket?.id) dispatch(removeOpenQueueTicket(payload.ticket.id));
      if (selectedRef.current === payload.ticket?.id) resync();
    };

    const onMessage = (payload: { ticket?: { id: string }; message?: TicketMessage }) => {
      if (payload.ticket && payload.message) {
        dispatch(
          appendTicketMessage({
            ticketId: payload.ticket.id,
            message: payload.message,
          }),
        );
        dispatch(upsertQueueTicket(payload.ticket as SupportTicket));
      }
    };

    const onPendingApproval = (payload: { message?: TicketMessage; ticket?: SupportTicket }) => {
      if (payload.message && user?.role === "SUPER_ADMIN") {
        dispatch(
          addPendingApproval({
            ...(payload.message as unknown as PendingApproval),
            ticket: payload.ticket,
          }),
        );
      }
      if (payload.message && payload.ticket?.id === selectedRef.current) {
        dispatch(
          appendTicketMessage({
            ticketId: payload.ticket.id,
            message: payload.message,
          }),
        );
      }
    };

    const onReviewed = (payload: {
      message?: TicketMessage;
      ticket?: SupportTicket;
      status?: string;
      reviewComment?: string;
    }) => {
      const msg = payload.message;
      if (msg?.id) {
        dispatch(
          updateMessageReviewStatus({
            messageId: msg.id,
            status: msg.status ?? payload.status ?? "APPROVED",
            reviewComment: msg.review_comment ?? payload.reviewComment ?? undefined,
          }),
        );
      }
      if (payload.ticket && payload.status === "APPROVED" && msg) {
        onMessage({ ticket: payload.ticket, message: msg });
      }
    };

    socket.on("connect", resync);
    socket.on("ticketCreated", onCreated);
    socket.on("ticketClaimed", onClaimed);
    socket.on("ticketTransferred", resync);
    socket.on("ticketForwarded", resync);
    socket.on("ticketClosed", onClosed);
    socket.on("replyPendingApproval", onPendingApproval);
    socket.on("replyReviewed", onReviewed);
    socket.on("ticketMessageReceived", onMessage);

    return () => {
      socket.off("connect", resync);
      socket.off("ticketCreated", onCreated);
      socket.off("ticketClaimed", onClaimed);
      socket.off("ticketTransferred", resync);
      socket.off("ticketForwarded", resync);
      socket.off("ticketClosed", onClosed);
      socket.off("replyPendingApproval", onPendingApproval);
      socket.off("replyReviewed", onReviewed);
      socket.off("ticketMessageReceived", onMessage);
    };
  }, [socket, loadQueue, dispatch, user?.role, hasPermission]);

  if (authLoading) {
    return (
      <div className="m-4 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center gap-3">
        <div className="h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-zinc-500 font-bold animate-pulse">Loading…</p>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="m-4 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-center">
        <p className="font-bold text-lg">Access denied</p>
        <p className="text-sm text-zinc-500 mt-2">You do not have permission to view support tickets.</p>
        <button onClick={() => router.push("/dashboard")} className="mt-4 text-primary font-bold text-sm">
          Back to dashboard
        </button>
      </div>
    );
  }

  const tickets = queueTab === "closed" ? closedItems : queueItems;
  const showFinanceTab = user?.role === "FINANCE_CLERK" || user?.role === "SUPER_ADMIN";
  const showOversightTab = user?.role === "SUPER_ADMIN";
  const threadReady =
    selectedTicket && selectedTicketId && selectedTicket.id === selectedTicketId;

  return (
    <div className="h-[calc(100vh-160px)] flex flex-col shadow-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
      {!isConnected && (
        <div
          role="alert"
          className="mx-4 mt-2 flex items-center justify-between gap-3 bg-red-500/10 backdrop-blur-md border border-red-500/20 px-4 py-2.5 rounded-2xl"
        >
          <p className="text-[11px] font-black uppercase tracking-widest text-red-600 dark:text-red-400">
            Connection lost — messages may be delayed
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 hover:underline"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Reload
          </button>
        </div>
      )}
      {queueError && (
        <div
          role="alert"
          className="mx-4 mt-2 flex items-center gap-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl p-4 text-sm dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400"
        >
          <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0" />
          <span className="flex-1">{queueError}</span>
          <button
            onClick={() => {
              dispatch(clearQueueError());
              loadQueue();
            }}
            className="underline font-bold shrink-0"
          >
            Retry
          </button>
        </div>
      )}
      {user?.role === "SUPER_ADMIN" && (
        <SuperAdminApprovalQueue
          items={pendingApprovals}
          isLoading={isLoadingApprovals}
          onSelectTicket={(ticketId) => dispatch(setSelectedTicketId(ticketId))}
          onRefresh={() => dispatch(fetchPendingApprovals())}
        />
      )}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <TicketQueueList
          tickets={tickets}
          selectedId={selectedTicketId}
          activeTab={queueTab}
          isLoading={isLoadingQueue}
          onTabChange={(tab) => {
            dispatch(setQueueTab(tab));
            dispatch(setSelectedTicketId(null));
          }}
          onSelect={(id) => dispatch(setSelectedTicketId(id))}
          showFinanceTab={showFinanceTab}
          showOversightTab={showOversightTab}
        />
        {selectedTicketId && (isLoadingDetail || !threadReady) && !detailError ? (
          <TicketThreadLoading />
        ) : threadReady ? (
          <TicketThread
            ticket={selectedTicket}
            userId={user?.id}
            userRole={user?.role}
            isSending={isSending}
            isConnected={isConnected}
            detailError={detailError}
            onRetryDetail={loadDetail}
            onRefresh={() => {
              loadQueue();
              loadDetail();
            }}
            onSendMessage={async (content, mediaMetadata, messageType = "TEXT") => {
              if (!selectedTicketId) return;
              await dispatch(
                sendTicketMessage({
                  ticketId: selectedTicketId,
                  content,
                  messageType,
                  mediaMetadata,
                }),
              ).unwrap();
              if (user?.role === "SUPER_ADMIN") dispatch(fetchPendingApprovals());
            }}
          />
        ) : selectedTicketId && detailError ? (
          <TicketThread
            ticket={{ id: selectedTicketId } as Parameters<typeof TicketThread>[0]["ticket"]}
            detailError={detailError}
            onRetryDetail={loadDetail}
            onRefresh={loadDetail}
            onSendMessage={async () => {}}
          />
        ) : (
          <TicketThreadPlaceholder />
        )}
      </div>
    </div>
  );
}
