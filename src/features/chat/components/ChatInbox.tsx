import { Search, User, Megaphone } from "lucide-react";
import { format } from "date-fns";

interface ChatInboxProps {
    conversations: any[];
    selectedId: number | null;
    onSelect: (id: number) => void;
}

export const ChatInbox = ({ conversations, selectedId, onSelect }: ChatInboxProps) => {
    return (
        <div className="w-85 border-r border-zinc-200 dark:border-zinc-800 flex flex-col h-full bg-white dark:bg-zinc-950 overflow-hidden">
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20">
                <h1 className="text-2xl font-black mb-4 bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                    Chat Hub
                </h1>
                <div className="relative group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Search families..."
                        className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar pb-4">
                {/* Pinned Announcements */}
                <div className="px-3 pt-4 mb-2">
                    <p className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2">Pinned</p>
                    <button
                        onClick={() => onSelect(0)}
                        className={`w-full p-4 flex items-center gap-4 rounded-2xl transition-all duration-300 relative group overflow-hidden ${
                            selectedId === 0 
                                ? "bg-gradient-to-br from-primary to-blue-700 text-white shadow-lg shadow-primary/20 scale-[0.98]" 
                                : "bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                        }`}
                    >
                        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${
                            selectedId === 0 ? "bg-white/20" : "bg-primary/10"
                        }`}>
                            <Megaphone className={`h-6 w-6 ${selectedId === 0 ? "text-white" : "text-primary"}`} />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                            <div className="flex justify-between items-center mb-0.5">
                                <span className="font-bold text-sm tracking-tight">Official Announcements</span>
                                <span className={`text-[9px] font-medium opacity-60`}>
                                    Broadcast
                                </span>
                            </div>
                            <p className={`text-xs truncate ${selectedId === 0 ? "text-white/80" : "text-zinc-500"}`}>
                                Send to Grades & Sections
                            </p>
                        </div>
                        {selectedId === 0 && (
                            <div className="absolute right-0 top-0 h-full w-1 bg-white opacity-20" />
                        )}
                    </button>
                </div>

                <div className="px-3">
                    <p className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 mt-4">Direct Messages</p>
                    {(!Array.isArray(conversations) || conversations.length === 0) ? (
                        <div className="p-8 text-center">
                            <div className="h-12 w-12 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-3">
                                <User className="h-6 w-6 text-zinc-300" />
                            </div>
                            <p className="text-xs text-zinc-500 font-medium">No conversations found</p>
                        </div>
                    ) : (
                        conversations.map((conv) => (
                            <button
                                key={conv.id}
                                onClick={() => onSelect(conv.family_id)}
                                className={`w-full p-4 flex items-center gap-4 rounded-2xl transition-all duration-200 mb-1 group ${
                                    selectedId === conv.family_id 
                                        ? "bg-zinc-100 dark:bg-zinc-900 shadow-inner" 
                                        : "bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                                }`}
                            >
                                <div className="h-12 w-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 group-hover:rotate-3 transition-transform overflow-hidden">
                                    {conv.primary_guardian?.photo_url ? (
                                        <img src={conv.primary_guardian.photo_url} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                        <User className="h-6 w-6 text-zinc-400" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`font-bold text-sm tracking-tight truncate ${selectedId === conv.family_id ? "text-primary" : "text-zinc-900 dark:text-zinc-100"}`}>
                                            {conv.primary_guardian?.name || conv.families?.household_name || "Unknown Family"}
                                        </span>
                                        <span className="text-[9px] font-medium text-zinc-400 flex-shrink-0 ml-2">
                                            {conv.last_message_at ? format(new Date(conv.last_message_at), "h:mm a") : ""}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate font-medium">
                                            {conv.last_message_snippet || "No messages yet"}
                                        </p>
                                        {conv.unread_by_admin > 0 && (
                                            <span className="h-5 min-w-[20px] px-1.5 bg-primary text-[10px] font-black text-white rounded-full flex items-center justify-center animate-pulse shadow-lg shadow-primary/30">
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
        </div>
    );
};
