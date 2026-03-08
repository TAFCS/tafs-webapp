import { Bell, Menu } from "lucide-react";
import Image from "next/image";
import LogoImage from "@/public/logo.png";
import Link from "next/link";

interface GlobalHeaderProps {
    onMenuClick: () => void;
}

export function GlobalHeader({ onMenuClick }: GlobalHeaderProps) {
    return (
        <header className="h-16 bg-white  border-b border-zinc-200  flex items-center justify-between px-4 sticky top-0 z-20 flex-shrink-0">

            {/* Left: Menu/Profile Trigger */}
            <button
                onClick={onMenuClick}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-100 :bg-zinc-900 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 :ring-offset-black"
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

            {/* Right: Notifications */}
            <button
                className="w-10 h-10 flex items-center justify-center rounded-full text-zinc-500 hover:text-zinc-900 :text-zinc-100 hover:bg-zinc-100 :bg-zinc-900 transition-colors relative focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 :ring-offset-black"
                aria-label="View notifications"
            >
                <Bell className="h-5 w-5" />
                {/* Unread dot indicator */}
                <span className="absolute top-2.5 right-2.5 block h-2 w-2 rounded-full bg-secondary ring-2 ring-white "></span>
            </button>

        </header>
    );
}
