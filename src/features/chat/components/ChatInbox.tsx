"use client";

import { Search, User } from "lucide-react";
import { format } from "date-fns";

interface ChatInboxProps {
    conversations: any[];
    selectedId: number | null;
    onSelect: (id: number) => void;
}

export const ChatInbox = ({ conversations, selectedId, onSelect }: ChatInboxProps) => {
    return (
        <div className="w-80 border-r border-zinc-200 dark:border-zinc-800 flex flex-col h-full bg-white dark:bg-zinc-950">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                <h1 className="text-xl font-bold mb-4">Chat Hub</h1>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                        type="text"
                        placeholder="Search families..."
                        className="w-full pl-10 pr-4 py-2 bg-zinc-100 dark:bg-zinc-900 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                {(!Array.isArray(conversations) || conversations.length === 0) ? (
                    <div className="p-8 text-center text-zinc-500">
                        <p className="text-sm">No conversations found</p>
                    </div>
                ) : (
                    conversations.map((conv) => (
                        <button
                            key={conv.id}
                            onClick={() => onSelect(conv.family_id)}
                            className={`w-full p-4 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors border-b border-zinc-100 dark:border-zinc-900 ${
                                selectedId === conv.family_id ? "bg-zinc-50 dark:bg-zinc-900" : ""
                            }`}
                        >
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <User className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-semibold truncate">
                                        {conv.families?.household_name || "Unknown Household"}
                                    </span>
                                    <span className="text-[10px] text-zinc-400">
                                        {conv.last_message_at ? format(new Date(conv.last_message_at), "hh:mm a") : ""}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                        {conv.last_message_snippet || "No messages yet"}
                                    </p>
                                    {conv.unread_by_admin > 0 && (
                                        <span className="h-4 w-4 bg-primary text-[10px] text-white rounded-full flex items-center justify-center">
                                            {conv.unread_by_admin}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
};
