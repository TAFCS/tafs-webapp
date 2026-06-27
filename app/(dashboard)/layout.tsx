"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { GlobalHeader } from "@/components/layout/global-header";
import { useAuth, useAuthState } from "@/context/AuthContext";
import { NavigationProvider } from "@/context/NavigationContext";
import { useNavigation } from "@/context/NavigationContext";
import { NAV_MODULES } from "@/lib/nav-config";

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
    const { user } = useAuthState();
    const { logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const { activeModuleId, setActiveModule } = useNavigation();

    useEffect(() => {
        if (user?.role === "STAFF_EDITOR" && !pathname.startsWith("/staff-editing/students")) {
            router.replace("/staff-editing/students");
        }
    }, [user, pathname, router]);

    const hasPermission = (perm: string) => {
        if (user?.role === "SUPER_ADMIN") return true;
        return user?.permissions?.includes(perm) ?? false;
    };

    const visibleModules = NAV_MODULES.filter(m => m.permissions.some(hasPermission));

    // Determine which module to highlight:
    // - on /dashboard: use context state
    // - on any other page: derive from URL
    const highlightedId =
        pathname === "/dashboard"
            ? activeModuleId
            : (URL_TO_MODULE[pathname] ?? null);

    const initials = user?.fullName
        ? user.fullName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
        : "?";

    const handleModuleClick = (id: string, name: string) => {
        setActiveModule(id, name);
        router.push("/dashboard");
    };

    return (
        <div className="flex h-screen bg-zinc-50 dark:bg-zinc-900 overflow-hidden selection:bg-primary/30 font-sans">

            {/* ── Universal Left Rail ── */}
            <div className="w-[80px] shrink-0 h-full flex flex-col items-center py-4 gap-1 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-y-auto">
                {visibleModules.map(module => {
                    const isActive = module.id === highlightedId;
                    return (
                        <button
                            key={module.id}
                            onClick={() => handleModuleClick(module.id, module.name)}
                            title={module.name}
                            className={`w-[60px] flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl transition-all duration-150 ${
                                isActive
                                    ? `${module.bg} ${module.color}`
                                    : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                            }`}
                        >
                            <module.icon className="h-6 w-6" />
                            <span className="text-[9px] font-bold tracking-wide leading-tight text-center">
                                {RAIL_LABELS[module.id] ?? module.name}
                            </span>
                        </button>
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
