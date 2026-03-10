"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { GlobalHeader } from "@/components/layout/global-header";
import { ProfileDrawer } from "@/components/layout/profile-drawer";
import { useAuthState } from "@/context/AuthContext";

export default function ERPLayout({ children }: { children: React.ReactNode }) {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const { user } = useAuthState();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (user?.role === "STAFF_EDITOR") {
            if (!pathname.startsWith("/staff-editing/students")) {
                router.replace("/staff-editing/students");
            }
        }
    }, [user, pathname, router]);

    return (
        <div className="flex h-screen bg-zinc-50 dark:bg-zinc-900 overflow-hidden selection:bg-primary/30 font-sans">
            {/* Slide-out Drawer Menu */}
            <ProfileDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
            />

            {/* Main Canvas Area */}
            <div className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">
                {/* Top App Header */}
                <GlobalHeader onMenuClick={() => setIsDrawerOpen(true)} />

                {/* Scrollable Content Area */}
                <main className="flex-1 overflow-y-auto w-full pb-8">
                    <div className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
