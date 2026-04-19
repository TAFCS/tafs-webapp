import {
    X, LogOut, Users, UserPlus, ArrowLeftRight, LayoutDashboard,
    School, UserCircle, Wallet, Banknote, Settings, ChevronDown,
    Landmark, UserCog, BarChart3, ShieldCheck,
    LandPlot, BookOpen, LayoutGrid, TrendingUp, UserCheck, Contact,
    Tags, CalendarDays, FilePlus2, HandCoins, Printer,
    FileText
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAuth, useAuthState } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

interface ProfileDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ProfileDrawer({ isOpen, onClose }: ProfileDrawerProps) {
    const { logout } = useAuth();
    const { user } = useAuthState();
    const [signingOut, setSigningOut] = useState(false);
    const [openModules, setOpenModules] = useState<Record<string, boolean>>({
        academic: true,
        students: true,
        fees: true,
        finance: true,
        system: true
    });

    const toggleModule = (module: string) => {
        setOpenModules(prev => ({ ...prev, [module]: !prev[module] }));
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

    const hasPermission = (perm: string) => user?.permissions?.includes(perm) || user?.role === 'SUPER_ADMIN';

    const navModules = [
        {
            id: 'academic',
            name: 'Academic Administration',
            icon: School,
            permissions: ['academic.campuses.view', 'academic.classes.view', 'academic.sections.view'],
            items: [
                { name: 'Campuses', href: '/campuses', icon: LandPlot, permission: 'academic.campuses.view' },
                { name: 'Classes', href: '/classes', icon: BookOpen, permission: 'academic.classes.view' },
                { name: 'Sections', href: '/sections', icon: LayoutGrid, permission: 'academic.sections.view' },
                { name: 'Transfers', href: '/transfers', icon: ArrowLeftRight, permission: 'academic.transfers.view' },
                { name: 'Academic Actions', href: '/bulk-promote', icon: TrendingUp, permission: 'academic.bulk_promote.execute' },
            ]
        },
        {
            id: 'students',
            name: 'Student Management',
            icon: UserCircle,
            permissions: ['students.registration.view', 'students.enrollment.view', 'students.directory.view', 'students.families.view'],
            items: [
                { name: 'Registration', href: '/identity/register', icon: UserPlus, permission: 'students.registration.view' },
                { name: 'Enrollments', href: '/enrollments', icon: UserCheck, permission: 'students.enrollment.view' },
                { name: 'Student Directory', href: '/identity/students', icon: Users, permission: 'students.directory.view' },
                { name: 'Families', href: '/families', icon: Contact, permission: 'students.families.view' },
            ]
        },
        {
            id: 'fees',
            name: 'Fee Administration',
            icon: Wallet,
            permissions: ['fee_admin.fee_types.view', 'fee_admin.classwise_schedule.view', 'fee_admin.studentwise_schedule.view'],
            items: [
                { name: 'Fee Types', href: '/fee-types', icon: Tags, permission: 'fee_admin.fee_types.view' },
                { name: 'Class Schedule', href: '/classwise-fees-schedule', icon: CalendarDays, permission: 'fee_admin.classwise_schedule.view' },
                { name: 'Student Overrides', href: '/studentwise-fees', icon: UserCog, permission: 'fee_admin.studentwise_schedule.view' },
            ]
        },
        {
            id: 'finance',
            name: 'Finance Operations',
            icon: Banknote,
            permissions: ['finance.vouchers.view', 'finance.deposits.view', 'finance.banks.view'],
            items: [
                { name: 'Single Voucher Issuance', href: '/fee-challan', icon: Printer, permission: 'finance.vouchers.view' },
                { name: 'Bulk Voucher Issuance', href: '/bulk-voucher', icon: FilePlus2, permission: 'finance.vouchers.generate_bulk' },
                { name: 'Vouchers', href: '/vouchers', icon: FileText, permission: 'finance.vouchers.view' },
                { name: 'Receive Deposit', href: '/vouchers/deposit', icon: HandCoins, permission: 'finance.deposits.record' },
                { name: 'Banks', href: '/banks', icon: Landmark, permission: 'finance.banks.view' },
            ]
        },
        {
            id: 'system',
            name: 'System Administration',
            icon: Settings,
            permissions: ['system.users.view', 'system.permissions.manage', 'system.analytics.view'],
            items: [
                { name: 'User Management', href: '/system/users', icon: UserCog, permission: 'system.users.view' },
                { name: 'Permissions', href: '/system/permissions', icon: ShieldCheck, permission: 'system.permissions.manage' },
                { name: 'Analytics', href: '/dashboard', icon: BarChart3, permission: 'system.analytics.view' },
            ]
        }
    ];

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.05, delayChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, x: 20 },
        show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
    };

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
                        className="fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-white/80 dark:bg-zinc-950/80 backdrop-blur-2xl z-[70] border-r border-white/20 dark:border-zinc-800/50 shadow-[0_0_40px_rgba(0,0,0,0.1)] dark:shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col"
                    >
                        {/* Futuristic Header with Glow */}
                        <div className="h-40 relative p-6 flex flex-col justify-end overflow-hidden flex-shrink-0">
                            {/* Animated Gradient Background */}
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/70 to-purple-600/80 dark:from-primary/40 dark:via-primary/20 dark:to-purple-900/40 z-0"></div>
                            
                            {/* Glass overlay */}
                            <div className="absolute inset-0 bg-white/10 dark:bg-black/20 backdrop-blur-md z-0"></div>

                            {/* Glow Orbs */}
                            <motion.div 
                                animate={{ 
                                    scale: [1, 1.2, 1],
                                    opacity: [0.5, 0.8, 0.5] 
                                }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute -top-10 -left-10 w-40 h-40 bg-white/20 rounded-full blur-2xl z-0"
                            ></motion.div>

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
                                    </div>
                                </motion.div>
                            </div>
                        </div>

                        {/* Navigation List */}
                        <motion.div 
                            variants={containerVariants}
                            initial="hidden"
                            animate="show"
                            className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-2 custom-scrollbar"
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

                            {navModules.map(module => {
                                const visibleItems = module.items.filter(item => hasPermission(item.permission));
                                if (visibleItems.length === 0) return null;

                                const isModuleOpen = openModules[module.id];

                                return (
                                    <motion.div key={module.id} variants={itemVariants} className="flex flex-col mb-1">
                                        <button
                                            onClick={() => toggleModule(module.id)}
                                            className="flex items-center justify-between px-3 py-2.5 text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] hover:text-primary dark:hover:text-primary-400 transition-colors group w-full"
                                        >
                                            <div className="flex items-center">
                                                <module.icon className="h-4 w-4 mr-2.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                                                {module.name}
                                            </div>
                                            <ChevronDown className={`h-4 w-4 transition-transform duration-300 ease-out ${!isModuleOpen ? "-rotate-90 opacity-50" : "opacity-100"}`} />
                                        </button>

                                        <AnimatePresence>
                                            {isModuleOpen && (
                                                <motion.div 
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.3, ease: "easeInOut" }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="flex flex-col gap-1 ml-4 pl-3 py-1 border-l-2 border-zinc-100 dark:border-zinc-800/80">
                                                        {visibleItems.map(item => (
                                                            <Link
                                                                key={item.href}
                                                                href={item.href}
                                                                onClick={onClose}
                                                                className="flex items-center px-3 py-2.5 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-primary hover:bg-zinc-100/80 dark:hover:bg-zinc-800/50 hover:pl-5 transition-all duration-300 group"
                                                            >
                                                                <item.icon className="h-4 w-4 mr-3 opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300" />
                                                                <span className="text-sm font-semibold tracking-tight">{item.name}</span>
                                                            </Link>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                );
                            })}

                            <div className="mt-6 mb-2">
                                <div className="w-full h-px bg-gradient-to-r from-transparent via-zinc-200 dark:via-zinc-800 to-transparent" />
                            </div>

                            <motion.div variants={itemVariants} className="flex flex-col gap-2">
                                <Link href="/settings" onClick={onClose} className="flex items-center px-4 py-3 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/50 transition-all group border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800">
                                    <Settings className="h-5 w-5 mr-3 opacity-60 group-hover:opacity-100 group-hover:rotate-90 transition-all duration-500" />
                                    <span className="text-sm font-semibold tracking-tight">System Settings</span>
                                </Link>

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
