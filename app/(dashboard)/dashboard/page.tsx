"use client";

import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useAuthState } from "@/context/AuthContext";
import { canViewSupportTickets, SUPPORT_TICKETS_VIEW_PERMISSION } from "@/features/support-tickets/supportTicketAccess";
import { NAV_MODULES, type NavItem } from "@/lib/nav-config";

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.08, delayChildren: 0.1 }
    }
};

const cardVariant = {
    hidden: { y: 24, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 260, damping: 22 } }
};

export default function DashboardPage() {
    const { user } = useAuthState();

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

    const displayName = user?.fullName ?? "there";

    return (
        <div className="space-y-10 pb-10">
            {/* Welcome header */}
            <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="pt-2"
            >
                <p className="text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-1">Welcome back</p>
                <h1 className="text-4xl md:text-5xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 font-outfit">
                    {displayName}
                </h1>
                {user?.campusName && (
                    <p className="text-sm font-semibold text-zinc-400 mt-2 flex items-center gap-2">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {user.campusName}
                    </p>
                )}
            </motion.div>

            {/* Category grid */}
            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6"
            >
                {NAV_MODULES.map((module) => {
                    const visibleItems = module.items.filter(isItemVisible);
                    if (visibleItems.length === 0) return null;

                    return (
                        <motion.div
                            key={module.id}
                            variants={cardVariant}
                            className={`group relative bg-white dark:bg-zinc-950 border ${module.border} rounded-[2rem] p-7 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden`}
                        >
                            {/* Icon + title */}
                            <div className="flex items-start justify-between mb-5">
                                <div className={`p-3.5 rounded-2xl ${module.bg} ${module.color} shadow-sm transition-transform duration-300 group-hover:scale-110`}>
                                    <module.icon className="h-6 w-6" />
                                </div>
                            </div>

                            <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-50 tracking-tight font-outfit mb-1.5">
                                {module.name}
                            </h2>
                            <p className="text-[13px] font-medium text-zinc-400 dark:text-zinc-500 leading-relaxed mb-6">
                                {module.description}
                            </p>

                            {/* All permitted items */}
                            <div className="space-y-1.5">
                                {visibleItems.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className="flex items-center justify-between px-3 py-2.5 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-primary hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-all duration-150 group/link"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <item.icon className="h-3.5 w-3.5 opacity-50 group-hover/link:opacity-100 transition-opacity" />
                                            <span className="text-[13px] font-semibold">{item.name}</span>
                                        </div>
                                        <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover/link:opacity-60 -translate-x-1 group-hover/link:translate-x-0 transition-all duration-150" />
                                    </Link>
                                ))}
                            </div>
                        </motion.div>
                    );
                })}
            </motion.div>
        </div>
    );
}
