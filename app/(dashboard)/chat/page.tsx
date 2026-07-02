"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChatInbox } from "@/features/chat/components/ChatInbox";
import { ChatWindow } from "@/features/chat/components/ChatWindow";
import { useSocket } from "@/context/SocketContext";
import api from "@/lib/api";

export default function ChatHubPage() {
    const { socket, isConnected } = useSocket();
    const [selectedFamilyId, setSelectedFamilyId] = useState<number | null>(null);
    const [conversations, setConversations] = useState<any[]>([]);
    const [messages, setMessages] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [onlineFamilyIds, setOnlineFamilyIds] = useState<Set<number>>(new Set());

    // ✅ FIX: Use ref for selectedFamilyId inside socket event callbacks
    // to avoid stale closures when the user switches conversations.
    const selectedFamilyIdRef = useRef<number | null>(null);
    selectedFamilyIdRef.current = selectedFamilyId;

    // ✅ FIX: Track the last conversation we emitted enterChat for, so we
    // can emit leaveChat when switching away.
    const enteredChatFamilyRef = useRef<number | null>(null);

    // ✅ FIX: Guards against a stale fetchHistory response (from a conversation
    // the admin already navigated away from) overwriting the current one.
    const historyRequestIdRef = useRef(0);

    const fetchInbox = useCallback(async () => {
        try {
            const res = await api.get("v1/chat/inbox");
            if (Array.isArray(res.data)) {
                setConversations(res.data);
            } else if (res.data?.data && Array.isArray(res.data.data)) {
                setConversations(res.data.data);
            } else {
                console.error("Inbox data is not an array:", res.data);
                setConversations([]);
            }
        } catch (err) {
            console.error("Failed to fetch inbox:", err);
            setConversations([]);
        }
    }, []);

    const fetchHistory = useCallback(async (familyId: number | null) => {
        if (familyId === null) return;
        // Stamp this request; if a newer fetchHistory call starts before this one
        // resolves (fast conversation switching), its response must win instead.
        const requestId = ++historyRequestIdRef.current;
        setIsLoadingHistory(true);
        try {
            const res = await api.get(`v1/chat/history/admin/${familyId}`);
            if (historyRequestIdRef.current !== requestId) return; // stale — a newer request has since started
            const data = res.data;
            const history = Array.isArray(data) ? data : (data.data || []);
            setMessages([...history].reverse());
        } catch (err) {
            console.error("Failed to fetch history:", err);
        } finally {
            if (historyRequestIdRef.current === requestId) setIsLoadingHistory(false);
        }
    }, []);

    // ─── Initial inbox load ───────────────────────────────────────────────────
    useEffect(() => {
        fetchInbox();
    }, [fetchInbox]);

    // ─── Load history + manage enterChat/leaveChat when conversation changes ─
    useEffect(() => {
        // Emit leaveChat for the previous conversation
        if (socket && enteredChatFamilyRef.current !== null) {
            socket.emit("leaveChat", { familyId: enteredChatFamilyRef.current });
        }

        if (selectedFamilyId === null) {
            enteredChatFamilyRef.current = null;
            historyRequestIdRef.current++; // invalidate any in-flight fetchHistory for the previous selection
            setMessages([]);
            return;
        }

        fetchHistory(selectedFamilyId);

        // Emit enterChat + markAsRead for the newly selected conversation
        if (socket && selectedFamilyId !== 0) {
            socket.emit("enterChat", { familyId: selectedFamilyId });
            socket.emit("markAsRead", { familyId: selectedFamilyId, role: "ADMIN" });
            enteredChatFamilyRef.current = selectedFamilyId;
        } else if (socket && selectedFamilyId === 0) {
            // Announcement channel — no enterChat needed
            enteredChatFamilyRef.current = 0;
        }

        // Update unread count in inbox immediately (optimistic UI)
        setConversations(prev =>
            prev.map(c =>
                c.family_id === selectedFamilyId ? { ...c, unread_by_admin: 0 } : c
            )
        );
    }, [selectedFamilyId, socket, fetchHistory]);

    // ─── Socket reconnect sync (registered ONCE, uses ref for familyId) ──────
    useEffect(() => {
        if (!socket) return;

        const handleReconnect = () => {
            console.log("[ChatHub] Reconnected! Syncing state...");
            fetchInbox();
            fetchHistory(selectedFamilyIdRef.current);

            // Re-enter the chat we were viewing
            if (selectedFamilyIdRef.current !== null && selectedFamilyIdRef.current !== 0) {
                socket.emit("enterChat", { familyId: selectedFamilyIdRef.current });
            }

            socket.emit("getOnlineStatus", (res: any) => {
                if (res?.onlineFamilyIds) {
                    setOnlineFamilyIds(new Set(res.onlineFamilyIds));
                }
            });
        };

        const handleStatusChanged = (data: { familyId: number; status: "ONLINE" | "OFFLINE" }) => {
            setOnlineFamilyIds(prev => {
                const next = new Set(prev);
                if (data.status === "ONLINE") {
                    next.add(data.familyId);
                } else {
                    next.delete(data.familyId);
                }
                return next;
            });
        };

        socket.on("connect", handleReconnect);
        socket.on("userStatusChanged", handleStatusChanged);

        // Initial online status fetch
        socket.emit("getOnlineStatus", (res: any) => {
            if (res?.onlineFamilyIds) {
                setOnlineFamilyIds(new Set(res.onlineFamilyIds));
            }
        });

        return () => {
            socket.off("connect", handleReconnect);
            socket.off("userStatusChanged", handleStatusChanged);
        };
    // ✅ FIX: Only depends on socket — NOT selectedFamilyId (use ref instead)
    }, [socket, fetchInbox, fetchHistory]);

    // ─── Socket message events (registered ONCE, uses ref for familyId) ──────
    useEffect(() => {
        if (!socket) return;

        const ANNOUNCEMENT_CONV_ID = "00000000-0000-0000-0000-000000000000";

        const handleReceiveMessage = (data: any) => {
            const { message, conversation } = data;
            const currentFamilyId = selectedFamilyIdRef.current;

            // Update inbox snippet
            setConversations(prev => {
                if (!Array.isArray(prev)) return [];
                if (conversation.id === ANNOUNCEMENT_CONV_ID) return prev;
                const exists = prev.some(c => c.id === conversation.id);
                if (exists) {
                    return prev.map(c => c.id === conversation.id ? conversation : c);
                }
                return [conversation, ...prev];
            });

            // Update active message list if this message belongs to the open conversation
            const isForSelectedAnnouncement =
                currentFamilyId === 0 && conversation.id === ANNOUNCEMENT_CONV_ID;
            const isForSelectedFamily =
                currentFamilyId !== null &&
                currentFamilyId !== 0 &&
                conversation.family_id === currentFamilyId;

            if (isForSelectedAnnouncement || isForSelectedFamily) {
                setMessages(prev => {
                    if (message.sender_type === "ADMIN") {
                        // Replace optimistic message (matched by content) with confirmed one
                        const optimisticIndex = prev.findIndex(
                            m => m.status === "sending" && m.content.trim() === message.content.trim()
                        );
                        if (optimisticIndex !== -1) {
                            const updated = [...prev];
                            updated[optimisticIndex] = { ...message, status: "sent" };
                            return updated;
                        }
                    }
                    if (prev.some(m => m.id === message.id)) return prev;
                    return [...prev, message];
                });

                // Auto-mark as read since admin is actively viewing this conversation
                if (isForSelectedFamily) {
                    socket.emit("markAsRead", { familyId: currentFamilyId, role: "ADMIN" });
                }
            }
        };

        const handleMessageDeleted = (data: { messageId: string; familyId: number }) => {
            if (selectedFamilyIdRef.current === data.familyId) {
                setMessages(prev => prev.filter(m => m.id !== data.messageId));
            }
        };

        const handleMessagesRead = (data: { familyId: number; by: "GUARDIAN" | "ADMIN" }) => {
            if (data.by === "GUARDIAN" && selectedFamilyIdRef.current === data.familyId) {
                setMessages(prev => prev.map(m => ({ ...m, is_read: true })));
            }
        };

        socket.on("receiveMessage", handleReceiveMessage);
        socket.on("messageDeleted", handleMessageDeleted);
        socket.on("messagesRead", handleMessagesRead);

        return () => {
            socket.off("receiveMessage", handleReceiveMessage);
            socket.off("messageDeleted", handleMessageDeleted);
            socket.off("messagesRead", handleMessagesRead);
        };
    // ✅ FIX: Only depends on socket — NOT selectedFamilyId (use ref instead)
    }, [socket]);

    // ─── Cleanup: emit leaveChat on page unmount ──────────────────────────────
    useEffect(() => {
        return () => {
            if (socket && enteredChatFamilyRef.current !== null) {
                socket.emit("leaveChat", { familyId: enteredChatFamilyRef.current });
            }
        };
    }, [socket]);

    const sendMessage = async (
        content: string,
        type: string,
        mediaMetadata?: any,
        announcementTarget?: { grade: string | null; section: string | null }
    ) => {
        if (selectedFamilyId === null) {
            console.warn("[ChatHub] Cannot send message: familyId missing");
            return;
        }

        const tempId = `temp-${Date.now()}`;
        const isAnnouncement = selectedFamilyId === 0;

        const optimisticMessage = {
            id: tempId,
            content: content,
            sender_type: "ADMIN",
            sender_name: isAnnouncement ? "TAFS Support" : "TAFS Admin",
            message_type: type,
            media_metadata: mediaMetadata,
            created_at: new Date().toISOString(),
            status: "sending",
            is_announcement: isAnnouncement,
            target_grade: announcementTarget?.grade,
            target_section: announcementTarget?.section,
        };
        setMessages(prev => [...prev, optimisticMessage]);

        // Thread the same tempId through to the server (in mediaMetadata) so a
        // retried/duplicate send (e.g. socket ack lost, admin retries manually,
        // or a REST-fallback races a socket send that actually landed) can be
        // deduped server-side instead of creating two persisted messages.
        const mediaMetadataWithTempId = isAnnouncement
            ? mediaMetadata
            : { ...(mediaMetadata ?? {}), tempId };

        const eventName = isAnnouncement ? "sendAnnouncement" : "sendMessage";
        const socketPayload = isAnnouncement
            ? {
                  messageType: type,
                  content,
                  mediaMetadata,
                  targetGrade: announcementTarget?.grade,
                  targetSection: announcementTarget?.section,
              }
            : {
                  familyId: selectedFamilyId,
                  senderType: "ADMIN",
                  messageType: type,
                  content,
                  mediaMetadata: mediaMetadataWithTempId,
              };

        // ✅ FIX: Try socket first; if disconnected use REST fallback so messages are never lost
        if (socket && isConnected) {
            socket.emit(eventName, socketPayload, (response: any) => {
                if (!response) return;
                setMessages(prev => {
                    const alreadyExists = prev.some(m => m.id === response.id);
                    if (alreadyExists) return prev.filter(m => m.id !== tempId);
                    return prev.map(m => m.id === tempId ? { ...response, status: "sent" } : m);
                });
            });
        } else if (!isAnnouncement) {
            // REST fallback for direct messages when socket is down
            try {
                const res = await api.post("v1/chat/messages/admin", {
                    familyId: selectedFamilyId,
                    messageType: type,
                    content,
                    mediaMetadata: mediaMetadataWithTempId,
                });
                const savedMessage = res.data;
                setMessages(prev => {
                    if (prev.some(m => m.id === savedMessage.id)) return prev.filter(m => m.id !== tempId);
                    return prev.map(m => m.id === tempId ? { ...savedMessage, status: "sent" } : m);
                });
            } catch (err) {
                console.error("[ChatHub] REST fallback failed:", err);
                setMessages(prev =>
                    prev.map(m => m.id === tempId ? { ...m, status: "error" } : m)
                );
            }
        } else {
            // Announcement while offline — mark optimistic as error
            setMessages(prev =>
                prev.map(m => m.id === tempId ? { ...m, status: "error" } : m)
            );
        }
    };

    const unsendMessage = (messageId: string) => {
        if (!socket || !selectedFamilyId) return;
        socket.emit("deleteMessage", { messageId, familyId: selectedFamilyId });
    };

    const activeConversation = conversations.find(c => c.family_id === selectedFamilyId);

    return (
        <div className="h-[calc(100vh-160px)] flex bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-xl">
            <ChatInbox
                conversations={conversations}
                selectedId={selectedFamilyId}
                onSelect={setSelectedFamilyId}
            />
            <ChatWindow
                familyId={selectedFamilyId}
                activeConversation={activeConversation}
                messages={Array.from(new Map(messages.map(m => [m.id, m])).values())}
                onSendMessage={sendMessage}
                onUnsend={unsendMessage}
                isConnected={isConnected}
                isParentOnline={selectedFamilyId !== null && onlineFamilyIds.has(selectedFamilyId)}
                isLoading={isLoadingHistory}
            />
        </div>
    );
}
