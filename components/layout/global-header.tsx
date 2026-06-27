"use client";

import { Bell, Sun, Moon } from "lucide-react";
import Image from "next/image";
import LogoImage from "@/public/logo.png";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { NotificationPanel } from "./notification-panel";
import api from "@/lib/api";
import { useAuthState } from "@/context/AuthContext";
import { useNavigation } from "@/context/NavigationContext";

export function GlobalHeader() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notificationCount, setNotificationCount] = useState(0);
    const { user } = useAuthState();
    const { activeModuleName } = useNavigation();

    useEffect(() => {
        setMounted(true);
        fetchNotificationCount();
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

            {/* Left: active module name */}
            <div className="flex flex-1 items-center min-w-0">
                {activeModuleName && (
                    <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200 truncate tracking-tight">
                        {activeModuleName}
                    </span>
                )}
            </div>

            {/* Center: TAFSync branding */}
            <div className="flex justify-center shrink-0">
                <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity active:scale-[0.98]">
                    <div className="relative">
                        <Image src={LogoImage} alt="TAFSync Logo" width={32} height={32} className="object-contain drop-shadow-sm" priority unoptimized />
                        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full z-[-1]" />
                    </div>
                    <div className="flex flex-col items-start justify-center">
                        <h1 className="text-lg font-bold text-primary tracking-tight leading-tight">TAFSync</h1>
                        <span className="text-[10px] font-medium text-secondary uppercase tracking-widest leading-none hidden sm:block">All-in-One Portal</span>
                    </div>
                </Link>
            </div>

            {/* Right: user name + theme + notifications */}
            <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2 relative">
                {user?.fullName && (
                    <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 hidden sm:block pr-2 border-r border-zinc-200 dark:border-zinc-700 mr-1 truncate max-w-[200px]">
                        {user.fullName}
                    </span>
                )}

                {mounted && (
                    <button
                        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                        className="w-10 h-10 flex items-center justify-center rounded-full text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:ring-offset-zinc-950"
                        aria-label="Toggle theme"
                    >
                        {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    </button>
                )}

                <div className="relative">
                    <button
                        onClick={() => setShowNotifications(!showNotifications)}
                        className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors relative focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:ring-offset-zinc-950 ${showNotifications ? "bg-zinc-100 dark:bg-zinc-800 text-primary" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                        aria-label="View notifications"
                    >
                        <Bell className={`h-5 w-5 ${showNotifications ? "fill-primary/10" : ""}`} />
                        {notificationCount > 0 && (
                            <span className="absolute top-2.5 right-2.5 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary ring-2 ring-white dark:ring-zinc-950" />
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
