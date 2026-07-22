"use client";

import { useEffect, useRef, useState } from "react";
import { ClipboardList, Loader2, RefreshCw, ChevronRight, UserCircle2 } from "lucide-react";
import api from "@/lib/api";

interface QuickAdmissionItem {
    cc: number;
    full_name: string;
    campus_name?: string;
    requested_grade?: string;
    academic_system?: string;
    photograph_url?: string;
}

interface Props {
    onSelect: (cc: number) => void;
}

export function QuickAdmissionsPopup({ onSelect }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [items, setItems] = useState<QuickAdmissionItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const fetchItems = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data } = await api.get("/v1/students", {
                params: { status: "QUICK_ADMISSION", fields: "core", limit: 50 },
            });
            const list = (data?.data?.items || []).map((s: any) => ({
                cc: s.core?.cc ?? s.cc,
                full_name: s.core?.full_name,
                campus_name: s.core?.campus_name,
                requested_grade: s.core?.requested_grade,
                academic_system: s.core?.academic_system,
                photograph_url: s.core?.photograph_url,
            }));
            setItems(list);
        } catch {
            setError("Failed to load pending quick admissions.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen((v) => !v)}
                className="relative flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-lg text-amber-700 dark:text-amber-400 text-xs font-black uppercase tracking-wider hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
            >
                <ClipboardList className="h-3.5 w-3.5" />
                Pending Quick Admissions
                {items.length > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-black">
                        {items.length}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-96 max-h-[28rem] overflow-y-auto bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-950">
                        <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Unconfirmed Admissions</span>
                        <button
                            type="button"
                            onClick={fetchItems}
                            disabled={isLoading}
                            className="text-zinc-400 hover:text-primary transition-colors disabled:opacity-50"
                            title="Refresh"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                        </button>
                    </div>

                    {isLoading && items.length === 0 ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="h-5 w-5 text-primary animate-spin" />
                        </div>
                    ) : error ? (
                        <div className="px-4 py-8 text-center text-xs font-semibold text-rose-500">{error}</div>
                    ) : items.length === 0 ? (
                        <div className="px-4 py-8 text-center text-xs font-medium text-zinc-400">
                            No pending quick admissions right now.
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {items.map((item) => (
                                <button
                                    key={item.cc}
                                    type="button"
                                    onClick={() => {
                                        onSelect(item.cc);
                                        setIsOpen(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors group"
                                >
                                    <div className="h-9 w-9 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                                        {item.photograph_url ? (
                                            <img src={item.photograph_url} alt={item.full_name} className="h-full w-full object-cover" />
                                        ) : (
                                            <UserCircle2 className="h-5 w-5 text-zinc-300" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">{item.full_name}</p>
                                        <p className="text-[11px] text-zinc-400 font-medium truncate">
                                            CC #{item.cc}
                                            {item.campus_name ? ` · ${item.campus_name}` : ""}
                                            {item.requested_grade ? ` · ${item.requested_grade}` : ""}
                                        </p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-primary transition-colors shrink-0" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
