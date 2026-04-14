"use client";

import { useState, useEffect } from "react";
import { Bell, CheckCircle, Clock, ExternalLink, Loader2, User, ChevronRight } from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { format } from "date-fns";

interface Notification {
    id: number;
    student_id: number;
    student_name: string;
    current_class: string;
    doa: string;
    flag: string;
    reminder_date: string;
    message: string;
}

export function NotificationPanel({ onClose }: { onClose: () => void }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState<number | null>(null);

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            const { data } = await api.get("/v1/student-flags/all/notifications");
            setNotifications(data.data);
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const markAsDone = async (n: Notification) => {
        setIsProcessing(n.id);
        try {
            await api.patch(`/v1/student-flags/${n.student_id}/${n.flag}/done`);
            toast.success("Action marked as completed");
            setNotifications(prev => prev.filter(item => item.id !== n.id));
        } catch (error) {
            toast.error("Failed to update status");
        } finally {
            setIsProcessing(null);
        }
    };

    return (
        <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" />
                    Pending Actions
                </h3>
                <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-black rounded-full">
                    {notifications.length} NEW
                </span>
            </div>

            <div className="max-h-[400px] overflow-y-auto">
                {isLoading ? (
                    <div className="p-12 flex flex-col items-center justify-center gap-2">
                        <Loader2 className="h-6 w-6 text-zinc-300 animate-spin" />
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Checking alerts...</p>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-3">
                            <CheckCircle className="h-6 w-6 text-zinc-300" />
                        </div>
                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1">All caught up!</p>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest leading-relaxed">No pending fast-track promotions or flags found.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
                        {notifications.map((n) => (
                            <div key={n.id} className="p-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors group">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center border border-amber-100 dark:border-amber-900/30 text-amber-600 shrink-0">
                                        <Clock className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase text-zinc-400 tracking-tight">Promote To Next Class</span>
                                            <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                                {n.reminder_date ? format(new Date(n.reminder_date), 'dd MMM yyyy') : 'Immediate'}
                                            </span>
                                        </div>
                                        <p className="text-sm font-black text-zinc-900 dark:text-zinc-100 leading-tight">
                                            {n.student_name}
                                        </p>
                                        <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-500">
                                            <span className="flex items-center gap-1 uppercase tracking-tight">
                                                <User className="h-3 w-3" /> CC #{n.student_id}
                                            </span>
                                            <span className="w-1 h-1 bg-zinc-300 rounded-full"></span>
                                            <span className="uppercase">{n.current_class || 'Grade N/A'}</span>
                                        </div>
                                        
                                        <div className="pt-3 flex items-center gap-2">
                                            <button 
                                                onClick={() => markAsDone(n)}
                                                disabled={isProcessing === n.id}
                                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-sm shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50"
                                            >
                                                {isProcessing === n.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                                                Mark as Done
                                            </button>
                                            <a 
                                                href={`/identity/register?cc=${n.student_id}`}
                                                className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-white transition-all shadow-sm group-hover:border-zinc-400"
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-900">
                <button 
                    onClick={onClose}
                    className="w-full py-2 hover:bg-white dark:hover:bg-zinc-800 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 hover:text-primary transition-all flex items-center justify-center gap-2"
                >
                    Dismiss Panel <ChevronRight className="h-3 w-3" />
                </button>
            </div>
        </div>
    );
}
