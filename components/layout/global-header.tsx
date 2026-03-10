import { Bell, Menu, Sun, Moon } from "lucide-react";
import Image from "next/image";
import LogoImage from "@/public/logo.png";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

interface GlobalHeaderProps {
    onMenuClick: () => void;
}

export function GlobalHeader({ onMenuClick }: GlobalHeaderProps) {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    return (
        <header className="h-16 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 sticky top-0 z-20 flex-shrink-0">

            {/* Left: Menu/Profile Trigger */}
            <button
                onClick={onMenuClick}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:ring-offset-zinc-950 transition-colors"
                aria-label="Open profile menu"
            >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
                    <Menu className="h-5 w-5" />
                </div>
            </button>

            {/* Center: Branding */}
            <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity active:scale-[0.98]">
                <Image src={LogoImage} alt="TAFSync Logo" width={32} height={32} className="object-contain" priority unoptimized />
                <div className="flex flex-col items-start justify-center">
                    <h1 className="text-lg font-bold text-primary tracking-tight leading-tight">TAFSync</h1>
                    <span className="text-[10px] font-medium text-secondary uppercase tracking-widest leading-none">All-in-One Portal</span>
                </div>
            </Link>

            {/* Right: Notifications & Theme */}
            <div className="flex items-center gap-2">
                {mounted && (
                    <button
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="w-10 h-10 flex items-center justify-center rounded-full text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors relative focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:ring-offset-zinc-950"
                        aria-label="Toggle theme"
                    >
                        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    </button>
                )}

                <button
                    className="w-10 h-10 flex items-center justify-center rounded-full text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors relative focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:ring-offset-zinc-950"
                    aria-label="View notifications"
                >
                    <Bell className="h-5 w-5" />
                    {/* Unread dot indicator */}
                    <span className="absolute top-2.5 right-2.5 block h-2 w-2 rounded-full bg-secondary ring-2 ring-white dark:ring-zinc-950"></span>
                </button>
            </div>

        </header>
    );
}
