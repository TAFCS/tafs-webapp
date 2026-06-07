"use client";

import { useCallback, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { useSocket } from "@/context/SocketContext";
import { useAuthState } from "@/context/AuthContext";
import type { AppDispatch, RootState } from "@/store/store";
import {
  addPendingApproval,
  appendTicketMessage,
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
import { TicketQueueList } from "@/features/support-tickets/components/TicketQueueList";
import { TicketThread } from "@/features/support-tickets/components/TicketThread";
import { SuperAdminApprovalQueue } from "@/features/support-tickets/components/SuperAdminApprovalQueue";
import { canViewSupportTickets } from "@/features/support-tickets/supportTicketAccess";

export default function SupportTicketsPage() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { socket, isConnected, isConnecting } = useSocket();
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
    isSending,
    error,
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

    const onCreated = (payload: { ticket?: { id: string; status: string } }) => {
      if (payload.ticket) dispatch(upsertQueueTicket(payload.ticket as any));
      else resync();
    };

    const onClaimed = (payload: { ticket?: { id: string } }) => {
      if (payload.ticket) dispatch(upsertQueueTicket(payload.ticket as any));
    };

    const onClosed = (payload: { ticket?: { id: string } }) => {
      if (payload.ticket?.id) dispatch(removeOpenQueueTicket(payload.ticket.id));
      if (selectedRef.current === payload.ticket?.id) resync();
    };

    const onMessage = (payload: { ticket?: { id: string }; message?: any }) => {
      if (payload.ticket && payload.message) {
        dispatch(
          appendTicketMessage({
            ticketId: payload.ticket.id,
            message: payload.message,
          }),
        );
        dispatch(upsertQueueTicket(payload.ticket as any));
      }
    };

    const onPendingApproval = (payload: { message?: any; ticket?: any }) => {
      if (payload.message && user?.role === "SUPER_ADMIN") {
        dispatch(
          addPendingApproval({
            ...payload.message,
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

    const onReviewed = (payload: { message?: { id: string; status: string; review_comment?: string }; ticket?: any; status?: string }) => {
      const msg = payload.message;
      if (msg?.id) {
        dispatch(
          updateMessageReviewStatus({
            messageId: msg.id,
            status: msg.status ?? payload.status ?? "APPROVED",
            reviewComment: msg.review_comment,
          }),
        );
      }
      if (payload.ticket && payload.status === "APPROVED") {
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
      <div className="m-4 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-center text-zinc-400">
        Loading…
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

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {!isConnected && !isConnecting && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold">
          Connection lost — reconnecting…
        </div>
      )}
      {error && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-red-100 text-red-800 text-xs flex justify-between items-center">
          <span>{error}</span>
          <button onClick={loadQueue} className="underline font-bold">
            Retry
          </button>
        </div>
      )}
      {user?.role === "SUPER_ADMIN" && (
        <SuperAdminApprovalQueue
          items={pendingApprovals}
          onSelectTicket={(ticketId) => dispatch(setSelectedTicketId(ticketId))}
          onRefresh={() => dispatch(fetchPendingApprovals())}
        />
      )}
      <div className="flex flex-1 min-h-0 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden m-4">
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
        {isLoadingDetail && !selectedTicket ? (
          <div className="flex-1 flex items-center justify-center text-zinc-400">Loading thread…</div>
        ) : selectedTicket ? (
          <TicketThread
            ticket={selectedTicket}
            userId={user?.id}
            userRole={user?.role}
            isSending={isSending}
            onRefresh={() => {
              loadQueue();
              if (selectedTicketId) dispatch(fetchTicketDetail(selectedTicketId));
            }}
            onSendMessage={async (content, mediaMetadata) => {
              if (!selectedTicketId) return;
              await dispatch(
                sendTicketMessage({
                  ticketId: selectedTicketId,
                  content,
                  messageType: mediaMetadata ? "DOCUMENT" : "TEXT",
                  mediaMetadata,
                }),
              ).unwrap();
              if (user?.role === "SUPER_ADMIN") dispatch(fetchPendingApprovals());
            }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-400">
            Select a ticket to view the thread
          </div>
        )}
      </div>
    </div>
  );
}
