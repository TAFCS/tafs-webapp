import { X, LogOut, LayoutDashboard, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAuth, useAuthState } from "@/context/AuthContext";
import { canViewSupportTickets, SUPPORT_TICKETS_VIEW_PERMISSION } from "@/features/support-tickets/supportTicketAccess";
import { classBandLabel } from "@/lib/class-bands";
import { motion, AnimatePresence } from "framer-motion";
import { NAV_MODULES, type NavItem } from "@/lib/nav-config";

interface ProfileDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ProfileDrawer({ isOpen, onClose }: ProfileDrawerProps) {
    const { logout } = useAuth();
    const { user } = useAuthState();
    const [signingOut, setSigningOut] = useState(false);
    const [openModule, setOpenModule] = useState<string | null>(null);

    const toggleModule = (moduleId: string) => {
        setOpenModule(prev => (prev === moduleId ? null : moduleId));
    };

    const handleLogout = async () => {
        setSigningOut(true);
        try {
            await logout();
        } finally {
            setSigningOut(false);
        }
    };

    const initials = user?.fullName
        ? user.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
        : "?";

    const hasPermission = (perm: string) => {
        if (user?.role === "SUPER_ADMIN") return true;
        if (perm === SUPPORT_TICKETS_VIEW_PERMISSION) return canViewSupportTickets(user);
        return user?.permissions?.includes(perm) ?? false;
    };

    const isItemVisible = (item: NavItem) => {
        if (item.href === "/admin/developer" || item.href === "/attendance/zk-device-logs" || item.href === "/hr/saturday-schedules") {
            return user?.role === "SUPER_ADMIN";
        }
        if (item.permissions) return item.permissions.some(hasPermission);
        if (item.permission) return hasPermission(item.permission);
        return false;
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.05, delayChildren: 0.1 }
        }
    } as const;

    const itemVariants = {
        hidden: { opacity: 0, x: 20 },
        show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
    } as const;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-[4px] z-[60]"
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ x: "-100%", opacity: 0.5 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: "-100%", opacity: 0 }}
                        transition={{ type: "spring", damping: 28, stiffness: 250, mass: 0.8 }}
                        className="fixed inset-y-0 left-0 w-96 max-w-[85vw] bg-white/80 dark:bg-zinc-950/80 backdrop-blur-2xl z-[70] border-r border-white/20 dark:border-zinc-800/50 shadow-[0_0_40px_rgba(0,0,0,0.1)] dark:shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col"
                    >
                        {/* Header */}
                        <div className="h-32 relative p-6 flex flex-col justify-end overflow-hidden flex-shrink-0">
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/70 to-purple-600/80 dark:from-primary/40 dark:via-primary/20 dark:to-purple-900/40 z-0" />
                            <div className="absolute inset-0 bg-white/10 dark:bg-black/20 backdrop-blur-md z-0" />

                            <motion.div
                                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute -top-10 -left-10 w-40 h-40 bg-white/20 rounded-full blur-2xl z-0"
                            />

                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full transition-all z-20 hover:scale-110 active:scale-95"
                            >
                                <X className="h-5 w-5" />
                            </button>

                            <div className="flex items-center space-x-4 relative z-10">
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: 0.2, type: "spring" }}
                                    className="w-14 h-14 rounded-2xl bg-white/20 dark:bg-black/30 backdrop-blur-xl flex items-center justify-center text-white text-xl font-bold border border-white/30 shadow-lg"
                                >
                                    {initials}
                                </motion.div>
                                <motion.div
                                    initial={{ x: -10, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                    className="text-white"
                                >
                                    <h3 className="font-bold text-lg leading-tight tracking-tight drop-shadow-md">
                                        {user?.fullName ?? "Loading…"}
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                        <span className="text-white/90 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-white/20 backdrop-blur-md rounded-md border border-white/10 shadow-sm">
                                            {user?.role?.replace(/_/g, " ") ?? ""}
                                        </span>
                                        {user?.campusName && (
                                            <span className="text-white/90 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-white/20 backdrop-blur-md rounded-md border border-white/10 shadow-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[100px]">
                                                {user.campusName}
                                            </span>
                                        )}
                                        {user?.allowedClassIds?.length ? (
                                            <span className="text-white/90 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-white/20 backdrop-blur-md rounded-md border border-white/10 shadow-sm whitespace-nowrap">
                                                {classBandLabel(user.allowedClassIds)}
                                            </span>
                                        ) : null}
                                    </div>
                                </motion.div>
                            </div>
                        </div>

                        {/* Navigation */}
                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="show"
                            className="flex-1 py-6 px-4 flex flex-col gap-2 relative overflow-y-auto"
                        >
                            <motion.div variants={itemVariants}>
                                <Link
                                    href="/dashboard"
                                    onClick={onClose}
                                    className="flex items-center px-4 py-3.5 rounded-2xl bg-primary/5 dark:bg-primary/10 text-primary dark:text-primary-400 hover:bg-primary/10 dark:hover:bg-primary/20 transition-all font-bold border border-primary/10 group"
                                >
                                    <LayoutDashboard className="h-5 w-5 mr-3 text-primary group-hover:scale-110 transition-transform" />
                                    <span className="text-sm tracking-wide">Dashboard Home</span>
                                </Link>
                            </motion.div>

                            <div className="w-full h-px bg-gradient-to-r from-transparent via-zinc-200 dark:via-zinc-800 to-transparent my-3" />

                            {NAV_MODULES.map(module => {
                                const visibleItems = module.items.filter(isItemVisible);
                                if (visibleItems.length === 0) return null;

                                const isOpen = openModule === module.id;

                                return (
                                    <motion.div key={module.id} variants={itemVariants} className="flex flex-col mb-1 relative">
                                        <button
                                            onClick={() => toggleModule(module.id)}
                                            className="flex items-center justify-between px-3 py-2.5 text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] hover:text-primary dark:hover:text-primary-400 transition-colors group w-full"
                                        >
                                            <div className="flex items-center">
                                                <module.icon className="h-4 w-4 mr-2.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                                                {module.name}
                                            </div>
                                            <ChevronRight className={`h-4 w-4 transition-all duration-300 ${isOpen ? "opacity-100 text-primary scale-110" : "opacity-50 group-hover:opacity-80"}`} />
                                        </button>

                                        {isOpen && (
                                            <div className="fixed top-32 bottom-0 left-[85vw] md:left-[24rem] w-80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-2xl border-r border-b border-white/20 dark:border-zinc-800/50 shadow-[0_0_40px_rgba(0,0,0,0.1)] dark:shadow-[0_0_40px_rgba(0,0,0,0.5)] p-6 flex flex-col gap-4 z-[65]">
                                                <div className="flex items-center pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
                                                    <module.icon className="h-4 w-4 mr-2.5 opacity-50 text-zinc-400 dark:text-zinc-500" />
                                                    <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">
                                                        {module.name}
                                                    </span>
                                                </div>
                                                <div className="flex-1 overflow-y-auto flex flex-col gap-1">
                                                    {visibleItems.map(item => (
                                                        <Link
                                                            key={item.href}
                                                            href={item.href}
                                                            onClick={onClose}
                                                            className="flex items-center px-3 py-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-primary hover:bg-zinc-100/80 dark:hover:bg-zinc-800/50 hover:pl-5 transition-all duration-200 group"
                                                        >
                                                            <item.icon className="h-4 w-4 mr-3 opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all duration-200 flex-shrink-0" />
                                                            <span className="text-sm font-semibold tracking-tight">{item.name}</span>
                                                        </Link>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                );
                            })}

                            <div className="mt-6 mb-2">
                                <div className="w-full h-px bg-gradient-to-r from-transparent via-zinc-200 dark:via-zinc-800 to-transparent" />
                            </div>

                            <motion.div variants={itemVariants}>
                                <button
                                    onClick={handleLogout}
                                    disabled={signingOut}
                                    className="w-full flex items-center px-4 py-3 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-all group border border-transparent hover:border-red-100 dark:hover:border-red-900/50"
                                >
                                    {signingOut ? (
                                        <svg className="animate-spin h-5 w-5 mr-3 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                    ) : (
                                        <LogOut className="h-5 w-5 mr-3 opacity-60 group-hover:opacity-100 group-hover:-translate-x-1 transition-all" />
                                    )}
                                    <span className="text-sm font-semibold tracking-tight">Secure Sign Out</span>
                                </button>
                            </motion.div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
