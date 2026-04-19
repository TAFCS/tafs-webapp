"use client";

import { Bell, Menu, Sun, Moon, Loader2 } from "lucide-react";
import Image from "next/image";
import LogoImage from "@/public/logo.png";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { NotificationPanel } from "./notification-panel";
import api from "@/lib/api";

interface GlobalHeaderProps {
    onMenuClick: () => void;
}

export function GlobalHeader({ onMenuClick }: GlobalHeaderProps) {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notificationCount, setNotificationCount] = useState(0);

    useEffect(() => {
        setMounted(true);
        fetchNotificationCount();
        
        // Refresh count every 5 minutes
        const interval = setInterval(fetchNotificationCount, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const fetchNotificationCount = async () => {
        try {
            const { data } = await api.get("/v1/student-flags/all/notifications");
            setNotificationCount(data.data.length);
        } catch (error) {
            console.error("Failed to fetch notification count:", error);
        }
    };

    return (
        <header className="h-16 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 sticky top-0 z-50 flex-shrink-0">

            {/* Left: Menu/Profile Trigger */}
            <div className="flex flex-1 items-center">
                <button
                    onClick={onMenuClick}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:ring-offset-zinc-950 transition-all group"
                    aria-label="Open profile menu"
                >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 text-primary group-hover:scale-110 transition-transform shadow-[0_0_10px_rgba(var(--primary),0.2)]">
                        <Menu className="h-4 w-4" />
                    </div>
                </button>
            </div>

            {/* Center: Branding */}
            <div className="flex justify-center shrink-0">
                <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity active:scale-[0.98]">
                    <div className="relative">
                        <Image src={LogoImage} alt="TAFSync Logo" width={32} height={32} className="object-contain drop-shadow-sm" priority unoptimized />
                        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full z-[-1]"></div>
                    </div>
                    <div className="flex flex-col items-start justify-center">
                        <h1 className="text-lg font-bold text-primary tracking-tight leading-tight">TAFSync</h1>
                        <span className="text-[10px] font-medium text-secondary uppercase tracking-widest leading-none hidden sm:block">All-in-One Portal</span>
                    </div>
                </Link>
            </div>

            {/* Right: Notifications & Theme */}
            <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2 relative">
                {mounted && (
                    <button
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="w-10 h-10 flex items-center justify-center rounded-full text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors relative focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:ring-offset-zinc-950"
                        aria-label="Toggle theme"
                    >
                        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    </button>
                )}

                <div className="relative">
                    <button
                        onClick={() => setShowNotifications(!showNotifications)}
                        className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors relative focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:ring-offset-zinc-950 ${showNotifications ? 'bg-zinc-100 dark:bg-zinc-800 text-primary' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                        aria-label="View notifications"
                    >
                        <Bell className={`h-5 w-5 ${showNotifications ? 'fill-primary/10' : ''}`} />
                        {/* Unread dot indicator */}
                        {notificationCount > 0 && (
                            <span className="absolute top-2.5 right-2.5 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary ring-2 ring-white dark:ring-zinc-950"></span>
                            </span>
                        )}
                    </button>

                    {showNotifications && (
                        <NotificationPanel onClose={() => setShowNotifications(false)} />
                    )}
                </div>
            </div>

        </header>
    );
}
