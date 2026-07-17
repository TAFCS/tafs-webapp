"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LogOut, Home } from "lucide-react";
import { GlobalHeader } from "@/components/layout/global-header";
import { useAuth, useAuthState } from "@/context/AuthContext";
import { NavigationProvider } from "@/context/NavigationContext";
import { useNavigation } from "@/context/NavigationContext";
import { NAV_MODULES } from "@/lib/nav-config";
import { useSelector, useDispatch } from "react-redux";
import type { RootState } from "@/store/store";
import { useSocket } from "@/context/SocketContext";
import {
    fetchPendingApprovals,
    addPendingApproval,
    updateMessageReviewStatus
} from "@/store/slices/supportTicketsSlice";

const RAIL_LABELS: Record<string, string> = {
    student: "Students",
    finance: "Finance",
    communication: "Comms",
    hr: "HR",
    attendance: "Attend.",
    "school-setup": "Setup",
    system: "System",
};

// Map every nav item href → its module id for URL-based highlighting
const URL_TO_MODULE: Record<string, string> = {};
NAV_MODULES.forEach(m => m.items.forEach(item => { URL_TO_MODULE[item.href] = m.id; }));

function LayoutInner({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuthState();
    const { logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const { activeModuleId } = useNavigation();
    const dispatch = useDispatch();
    const { socket } = useSocket();
    const { pendingApprovals } = useSelector((state: RootState) => state.supportTickets);

    useEffect(() => {
        if (user?.role === "SUPER_ADMIN") {
            dispatch(fetchPendingApprovals() as any);
        }
    }, [dispatch, user]);

    useEffect(() => {
        if (!socket || user?.role !== "SUPER_ADMIN") return;

        const onPending = (payload: { message?: any; ticket?: any }) => {
            if (payload.message) {
                dispatch(
                    addPendingApproval({
                        ...payload.message,
                        ticket: payload.ticket,
                    }) as any
                );
            }
        };

        const onReviewed = (payload: { message?: any }) => {
            if (payload.message?.id) {
                dispatch(
                    updateMessageReviewStatus({
                        messageId: payload.message.id,
                        status: payload.message.status ?? "APPROVED",
                    }) as any
                );
            }
        };

        socket.on("replyPendingApproval", onPending);
        socket.on("replyReviewed", onReviewed);

        return () => {
            socket.off("replyPendingApproval", onPending);
            socket.off("replyReviewed", onReviewed);
        };
    }, [socket, user, dispatch]);

    useEffect(() => {
        if (!isLoading && !user) {
            router.push("/auth/login");
            return;
        }
        if (user?.role === "STAFF_EDITOR" && !pathname.startsWith("/staff-editing/students")) {
            router.replace("/staff-editing/students");
        }
    }, [user, isLoading, pathname, router]);

    const hasPermission = (perm: string) => {
        if (user?.role === "SUPER_ADMIN") return true;
        return user?.permissions?.includes(perm) ?? false;
    };

    const visibleModules = NAV_MODULES.filter(m => m.permissions.some(hasPermission));

    // Determine which module to highlight:
    // - on /dashboard: use context state
    // - on any other page: derive from URL
    const highlightedId =
        pathname === "/home"
            ? "home"
            : pathname === "/dashboard"
                ? activeModuleId
                : (URL_TO_MODULE[pathname] ?? null);

    const initials = user?.fullName
        ? user.fullName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
        : "?";

    return (
        <div className="flex h-screen bg-zinc-50 dark:bg-zinc-900 overflow-hidden selection:bg-primary/30 font-sans">

            {/* ── Universal Left Rail ── */}
            <div className="w-[80px] shrink-0 h-full flex flex-col items-center py-4 gap-1 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-y-auto">
                {/* Home — always visible, above all modules */}
                <Link
                    href="/home"
                    title="Home"
                    className={`w-[60px] flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl transition-all duration-150 ${
                        highlightedId === "home"
                            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                            : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    }`}
                >
                    <Home className="h-6 w-6" />
                    <span className="text-[9px] font-bold tracking-wide leading-tight text-center">Home</span>
                </Link>

                {visibleModules.map(module => {
                    const isActive = module.id === highlightedId;
                    const isComms = module.id === "communication";
                    const showBadge = isComms && user?.role === "SUPER_ADMIN" && pendingApprovals.length > 0;
                    return (
                        <Link
                            key={module.id}
                            href={`/dashboard?module=${module.id}`}
                            title={module.name}
                            className={`w-[60px] flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl transition-all duration-150 relative ${
                                isActive
                                    ? `${module.bg} ${module.color}`
                                    : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                            }`}
                        >
                            <module.icon className="h-6 w-6" />
                            {showBadge && (
                                <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                                </span>
                            )}
                            <span className="text-[9px] font-bold tracking-wide leading-tight text-center">
                                {RAIL_LABELS[module.id] ?? module.name}
                            </span>
                        </Link>
                    );
                })}

                {/* Logout at the bottom */}
                <div className="mt-auto flex flex-col items-center gap-3 pb-1">
                    <div
                        title={user?.fullName ?? ""}
                        className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-[11px] font-black select-none"
                    >
                        {initials}
                    </div>
                    <button
                        onClick={() => logout()}
                        title="Sign out"
                        className="w-9 h-9 flex items-center justify-center rounded-full text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all"
                    >
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* ── Main Canvas ── */}
            <div className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">
                <GlobalHeader />

                <main className="flex-1 overflow-y-auto w-full pb-8">
                    <div className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}

export default function ERPLayout({ children }: { children: React.ReactNode }) {
    return (
        <NavigationProvider>
            <LayoutInner>{children}</LayoutInner>
        </NavigationProvider>
    );
}
