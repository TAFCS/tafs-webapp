"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useAuthState } from "@/context/AuthContext";
import { canViewSupportTickets, SUPPORT_TICKETS_VIEW_PERMISSION } from "@/features/support-tickets/supportTicketAccess";
import { NAV_MODULES, type NavItem } from "@/lib/nav-config";
import { useNavigation } from "@/context/NavigationContext";

// Stat cards per module — wire to APIs as they become available
const MODULE_STATS: Record<string, { label: string; value: string; sub?: string; subColor?: string }[]> = {
    student: [
        { label: "Total Enrolled", value: "—" },
        { label: "New Registrations", value: "—" },
        { label: "Active Families", value: "—" },
        { label: "Open Transfers", value: "—" },
    ],
    finance: [
        { label: "Fees Collected", value: "—" },
        { label: "Outstanding", value: "—" },
        { label: "Vouchers Issued", value: "—" },
        { label: "Collection Rate", value: "—" },
    ],
    communication: [
        { label: "Open Tickets", value: "—" },
        { label: "Announcements", value: "—" },
        { label: "Unread", value: "—" },
        { label: "Resolved Today", value: "—" },
    ],
    hr: [
        { label: "Total Staff", value: "—" },
        { label: "On Leave", value: "—" },
        { label: "Departments", value: "—" },
        { label: "Payroll Runs", value: "—" },
    ],
    attendance: [
        { label: "Present (Staff)", value: "—" },
        { label: "Present (Students)", value: "—" },
        { label: "Absent", value: "—" },
        { label: "Late Arrivals", value: "—" },
    ],
    "school-setup": [
        { label: "Campuses", value: "—" },
        { label: "Classes", value: "—" },
        { label: "Sections", value: "—" },
        { label: "Fee Types", value: "—" },
    ],
    system: [
        { label: "Total Users", value: "—" },
        { label: "Roles Defined", value: "—" },
        { label: "Last Backup", value: "—" },
        { label: "Active Sessions", value: "—" },
    ],
};

export default function DashboardPage() {
    const { user } = useAuthState();
    const { activeModuleId, setActiveModule } = useNavigation();
    const searchParams = useSearchParams();
    const moduleParam = searchParams.get("module");

    useEffect(() => {
        if (!moduleParam) return;
        const mod = NAV_MODULES.find(m => m.id === moduleParam);
        if (mod) setActiveModule(mod.id, mod.name);
    }, [moduleParam, setActiveModule]);

    const hasPermission = (perm: string) => {
        if (user?.role === "SUPER_ADMIN") return true;
        if (perm === SUPPORT_TICKETS_VIEW_PERMISSION) return canViewSupportTickets(user);
        return user?.permissions?.includes(perm) ?? false;
    };

    const isItemVisible = (item: NavItem) => {
        if (item.href === "/admin/developer" || item.href === "/attendance/zk-device-logs") {
            return user?.role === "SUPER_ADMIN";
        }
        if (item.permissions) return item.permissions.some(hasPermission);
        if (item.permission) return hasPermission(item.permission);
        return false;
    };

    const visibleModules = NAV_MODULES.filter(m => m.permissions.some(hasPermission));
    const activeModule = visibleModules.find(m => m.id === activeModuleId) ?? visibleModules[0];
    const visibleItems = activeModule?.items.filter(isItemVisible) ?? [];
    const stats = MODULE_STATS[activeModule?.id ?? ""] ?? [];

    // Keep header in sync with whichever module is shown
    useEffect(() => {
        if (activeModule && !activeModuleId) {
            setActiveModule(activeModule.id, activeModule.name);
        }
    }, [activeModule?.id]);

    return (
        <AnimatePresence mode="wait">
            {activeModule && (
                <motion.div
                    key={activeModule.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="space-y-7"
                >
                    {/* Module Header */}
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${activeModule.bg} ${activeModule.color} shadow-sm`}>
                            <activeModule.icon className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight font-outfit">
                                {activeModule.name}
                            </h1>
                            <p className="text-[13px] text-zinc-400 font-medium mt-0.5 leading-snug">
                                {activeModule.description}
                            </p>
                        </div>
                    </div>

                    {/* Stat Cards */}
                    {stats.length > 0 && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {stats.map((stat, i) => (
                                <div
                                    key={i}
                                    className="bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/80 rounded-2xl p-4"
                                >
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] leading-tight">
                                        {stat.label}
                                    </p>
                                    <p className="text-3xl font-black text-zinc-900 dark:text-zinc-50 mt-2 font-outfit tracking-tight">
                                        {stat.value}
                                    </p>
                                    {stat.sub && (
                                        <p className={`text-xs font-bold mt-1 ${stat.subColor ?? "text-zinc-400"}`}>
                                            {stat.sub}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Page Grid */}
                    <div>
                        <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.25em] mb-4">
                            Pages
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {visibleItems.map(item => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className="group bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/80 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-2xl p-5 flex flex-col gap-3 transition-all duration-150 hover:shadow-md"
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${activeModule.bg} ${activeModule.color} transition-transform duration-150 group-hover:scale-110`}>
                                        <item.icon className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-black text-zinc-900 dark:text-zinc-50 text-sm tracking-tight">
                                            {item.name}
                                        </p>
                                        <p className="text-[12px] text-zinc-400 font-medium mt-0.5 leading-snug">
                                            {item.description}
                                        </p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
