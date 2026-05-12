"use client";

import { useState, useEffect } from "react";
import { ChatInbox } from "@/features/chat/components/ChatInbox";
import { ChatWindow } from "@/features/chat/components/ChatWindow";
import { useSocket } from "@/context/SocketContext";
import api from "@/lib/api";

export default function ChatHubPage() {
    const { socket, isConnected } = useSocket();
    const [selectedFamilyId, setSelectedFamilyId] = useState<number | null>(null);
    const [conversations, setConversations] = useState<any[]>([]);
    const [messages, setMessages] = useState<any[]>([]);

    useEffect(() => {
        // Fetch inbox
        const fetchInbox = async () => {
            try {
                const res = await api.get("/v1/chat/inbox");
                if (Array.isArray(res.data)) {
                    setConversations(res.data);
                } else if (res.data?.data && Array.isArray(res.data.data)) {
                    // Handle wrapped responses if any
                    setConversations(res.data.data);
                } else {
                    console.error("Inbox data is not an array:", res.data);
                    setConversations([]);
                }
            } catch (err) {
                console.error("Failed to fetch inbox:", err);
                setConversations([]);
            }
        };

        fetchInbox();
    }, []);

    useEffect(() => {
        if (!selectedFamilyId) return;

        // Fetch history
        const fetchHistory = async () => {
            try {
                const res = await api.get(`/v1/chat/history/admin/${selectedFamilyId}`);
                const data = res.data;
                const history = Array.isArray(data) ? data : (data.data || []);
                setMessages([...history].reverse());
                
                // Mark as read
                if (socket) {
                    socket.emit("markAsRead", { familyId: selectedFamilyId, role: "ADMIN" });
                }
            } catch (err) {
                console.error("Failed to fetch history:", err);
            }
        };

        fetchHistory();
    }, [selectedFamilyId, socket]);

    useEffect(() => {
        if (!socket) return;

        const handleReceiveMessage = (data: any) => {
            const { message, conversation } = data;
            
            // Update inbox snippet
            setConversations(prev => {
                if (!Array.isArray(prev)) return [];
                const exists = prev.some(c => c.id === conversation.id);
                if (exists) {
                    return prev.map(c => c.id === conversation.id ? conversation : c);
                }
                return [conversation, ...prev];
            });

            // Update active message list if it belongs to current family
            if (conversation.family_id === selectedFamilyId) {
                setMessages(prev => {
                    // 1. If it's a message from ADMIN, check if we have an optimistic version of it
                    if (message.sender_type === "ADMIN") {
                        const optimisticIndex = prev.findIndex(m => 
                            m.status === "sending" && 
                            m.content.trim() === message.content.trim()
                        );
                        if (optimisticIndex !== -1) {
                            const updated = [...prev];
                            updated[optimisticIndex] = { ...message, status: "sent" };
                            return updated;
                        }
                    }

                    // 2. Avoid duplicates by real ID
                    if (prev.some(m => m.id === message.id)) return prev;
                    
                    return [...prev, message];
                });
                socket.emit("markAsRead", { familyId: selectedFamilyId, role: "ADMIN" });
            }
        };

        const handleMessageDeleted = (data: { messageId: string, familyId: number }) => {
            if (selectedFamilyId === data.familyId) {
                setMessages(prev => prev.filter(m => m.id !== data.messageId));
            }
        };

        socket.on("receiveMessage", handleReceiveMessage);
        socket.on("messageDeleted", handleMessageDeleted);

        return () => {
            socket.off("receiveMessage", handleReceiveMessage);
            socket.off("messageDeleted", handleMessageDeleted);
        };
    }, [socket, selectedFamilyId]);

    const sendMessage = (content: string, type: string, mediaMetadata?: any) => {
        if (!socket || !selectedFamilyId) {
            console.warn("[ChatHub] Cannot send message: socket or familyId missing", { hasSocket: !!socket, selectedFamilyId });
            return;
        }

        const tempId = `temp-${Date.now()}`;
        const optimisticMessage = {
            id: tempId,
            content: content,
            sender_type: "ADMIN",
            message_type: type,
            media_metadata: mediaMetadata,
            created_at: new Date().toISOString(),
            status: "sending"
        };

        setMessages(prev => [...prev, optimisticMessage]);

        console.log("[ChatHub] Emitting sendMessage:", { 
            familyId: selectedFamilyId, 
            type: type,
            contentLength: content?.length,
            mediaMetadata
        });

        socket.emit("sendMessage", {
            familyId: selectedFamilyId,
            senderType: "ADMIN",
            messageType: type,
            content: content,
            mediaMetadata: mediaMetadata,
        }, (response: any) => {
            // Replace optimistic message with real one, but ONLY if it's not already there
            setMessages(prev => {
                const alreadyExists = prev.some(m => m.id === response.id);
                if (alreadyExists) {
                    // Just remove the temp one
                    return prev.filter(m => m.id !== tempId);
                }
                return prev.map(m => m.id === tempId ? { ...response, status: "sent" } : m);
            });
        });
    };

    const unsendMessage = (messageId: string) => {
        if (!socket || !selectedFamilyId) return;
        socket.emit("deleteMessage", { messageId, familyId: selectedFamilyId });
    };

    return (
        <div className="h-[calc(100vh-160px)] flex bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-xl">
            <ChatInbox 
                conversations={conversations} 
                selectedId={selectedFamilyId} 
                onSelect={setSelectedFamilyId} 
            />
            <ChatWindow 
                familyId={selectedFamilyId} 
                messages={Array.from(new Map(messages.map(m => [m.id, m])).values())} 
                onSendMessage={sendMessage} 
                onUnsend={unsendMessage}
                isConnected={isConnected}
            />
        </div>
    );
}
