"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useAuthState } from "@/context/AuthContext";
import { canViewSupportTickets, SUPPORT_TICKETS_VIEW_PERMISSION } from "@/features/support-tickets/supportTicketAccess";
import { NAV_MODULES, type NavItem } from "@/lib/nav-config";
import { useNavigation } from "@/context/NavigationContext";
import api from "@/lib/api";
import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";
import { AttendanceBoard } from "../hr/attendance-dashboard/_components/AttendanceBoard";
import { AttendanceCycleWidget } from "./_components/AttendanceCycleWidget";

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

function ModuleParamSync() {
    const searchParams = useSearchParams();
    const { setActiveModule } = useNavigation();
    const moduleParam = searchParams.get("module");

    useEffect(() => {
        if (!moduleParam) return;
        const mod = NAV_MODULES.find(m => m.id === moduleParam);
        if (mod) setActiveModule(mod.id, mod.name);
    }, [moduleParam, setActiveModule]);

    return null;
}

export default function DashboardPage() {
    const { user } = useAuthState();
    const { activeModuleId, setActiveModule } = useNavigation();
    const [statsData, setStatsData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { pendingApprovals } = useSelector((s: RootState) => s.supportTickets);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const { data } = await api.get("/v1/analytics/module-stats");
                if (data.status === 200) {
                    setStatsData(data.data);
                }
            } catch (error) {
                console.error("Failed to fetch module stats:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchStats();
    }, []);

    const hasPermission = (perm: string) => {
        if (user?.role === "SUPER_ADMIN") return true;
        if (perm === SUPPORT_TICKETS_VIEW_PERMISSION) return canViewSupportTickets(user);
        return user?.permissions?.includes(perm) ?? false;
    };

    const isItemVisible = (item: NavItem) => {
        if (item.href === "/admin/developer" || item.href === "/attendance/zk-device-logs") {
            return user?.role === "SUPER_ADMIN";
        }
        if (item.href === "/hr/saturday-schedules") {
            return user?.role === "SUPER_ADMIN" || user?.role === "CAMPUS_ADMIN";
        }
        if (item.permissions) return item.permissions.some(hasPermission);
        if (item.permission) return hasPermission(item.permission);
        return false;
    };

    const visibleModules = NAV_MODULES.filter(m => m.permissions.some(hasPermission));
    const activeModule = visibleModules.find(m => m.id === activeModuleId) ?? visibleModules[0];
    const visibleItems = activeModule?.items.filter(isItemVisible) ?? [];
    
    const stats = (MODULE_STATS[activeModule?.id ?? ""] ?? []).map(stat => {
        if (!statsData || !statsData[activeModule?.id]) return stat;
        const apiValue = statsData[activeModule.id][stat.label];
        if (apiValue === undefined || apiValue === null) return stat;

        let formattedValue = String(apiValue);
        if (stat.label === "Fees Collected" || stat.label === "Outstanding") {
            formattedValue = `Rs. ${Math.round(Number(apiValue)).toLocaleString()}`;
        } else if (stat.label === "Collection Rate") {
            formattedValue = `${Number(apiValue).toFixed(1)}%`;
        } else {
            formattedValue = Number(apiValue).toLocaleString();
        }

        return { ...stat, value: formattedValue };
    });

    // Keep header in sync with whichever module is shown
    useEffect(() => {
        if (activeModule && !activeModuleId) {
            setActiveModule(activeModule.id, activeModule.name);
        }
    }, [activeModule?.id]);

    return (
        <>
        <Suspense fallback={null}><ModuleParamSync /></Suspense>
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
                                    className="bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between min-h-[96px]"
                                >
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] leading-tight">
                                        {stat.label}
                                    </p>
                                    {isLoading ? (
                                        <div className="h-8 w-24 bg-zinc-100 dark:bg-zinc-800/60 animate-pulse rounded-lg mt-2" />
                                    ) : (
                                        <p className="text-3xl font-black text-zinc-900 dark:text-zinc-50 mt-2 font-outfit tracking-tight">
                                            {stat.value}
                                        </p>
                                    )}
                                    {stat.sub && !isLoading && (
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
                                    className="group bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/80 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-2xl p-5 flex flex-col gap-3 transition-all duration-150 hover:shadow-md relative"
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${activeModule.bg} ${activeModule.color} transition-transform duration-150 group-hover:scale-110`}>
                                        <item.icon className="h-5 w-5" />
                                    </div>
                                    {item.href === "/support-tickets" && user?.role === "SUPER_ADMIN" && pendingApprovals.length > 0 && (
                                        <span className="absolute top-5 right-5 inline-flex items-center justify-center px-2 py-1 text-[10px] font-black leading-none text-white bg-rose-600 rounded-full animate-pulse">
                                            {pendingApprovals.length}
                                        </span>
                                    )}
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

                    {/* HR live attendance widgets — always visible here, no payroll run required */}
                    {activeModule.id === "hr" && (
                        <div className="space-y-8">
                            <div>
                                <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.25em] mb-4">
                                    Today's Register
                                </p>
                                <AttendanceBoard showHeader={false} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.25em] mb-4">
                                    Attendance by Pay Cycle
                                </p>
                                <AttendanceCycleWidget />
                            </div>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
        </>
    );
}

