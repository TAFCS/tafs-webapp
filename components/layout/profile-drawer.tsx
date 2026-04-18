import { 
    X, LogOut, Users, UserPlus, ArrowLeftRight, LayoutDashboard, 
    School, UserCircle, Wallet, Banknote, Settings, ChevronDown, 
    Database, FileText, Landmark, UserCog, BarChart3, ShieldCheck,
    LandPlot, BookOpen, LayoutGrid, TrendingUp, UserCheck, Contact,
    Tags, CalendarDays, Library, FilePlus2, HandCoins, History,
    LayoutGrid as GridIcon
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAuth, useAuthState } from "@/context/AuthContext";

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
                { name: 'Bulk Promote', href: '/bulk-promote', icon: TrendingUp, permission: 'academic.bulk_promote.execute' },
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
                { name: 'Transitions', href: '/transitions', icon: ArrowLeftRight, permission: 'academic.transfers.view' },
            ]
        },
        {
            id: 'finance',
            name: 'Finance Operations',
            icon: Banknote,
            permissions: ['finance.vouchers.view', 'finance.deposits.view', 'finance.banks.view'],
            items: [
                { name: 'Generate Vouchers', href: '/bulk-voucher', icon: FilePlus2, permission: 'finance.vouchers.generate_bulk' },
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
                { name: 'User Management', href: '/identity', icon: UserCog, permission: 'system.users.view' },
                { name: 'Permissions', href: '/system/permissions', icon: ShieldCheck, permission: 'system.permissions.manage' },
                { name: 'Analytics', href: '/dashboard', icon: BarChart3, permission: 'system.analytics.view' },
            ]
        }
    ];

    return (
        <>
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity animate-in fade-in"
                    onClick={onClose}
                />
            )}

            <div className={`fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-white dark:bg-zinc-950 z-[60] transform transition-transform duration-300 ease-in-out border-r border-zinc-200 dark:border-zinc-800 shadow-xl flex flex-col ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>

                <div className="h-40 bg-gradient-to-br from-primary to-primary/80 p-6 flex flex-col justify-end relative overflow-hidden flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white dark:hover:bg-zinc-800 rounded-full transition-colors z-20"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    <div className="flex items-center space-x-3 relative z-10">
                        <div className="w-14 h-14 rounded-full bg-white dark:bg-zinc-950 flex items-center justify-center text-primary text-xl font-bold border-2 border-white/20 shadow-md">
                            {initials}
                        </div>
                        <div className="text-white">
                            <h3 className="font-semibold text-lg leading-tight">
                                {user?.fullName ?? "Loading…"}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <p className="text-white/80 text-xs font-medium px-2 py-0.5 bg-white/10 rounded-full">
                                    {user?.role?.replace(/_/g, " ") ?? ""}
                                </p>
                                {user?.campusName && (
                                    <p className="text-white/80 text-xs font-medium px-2 py-0.5 bg-white/10 rounded-full whitespace-nowrap overflow-hidden text-ellipsis max-w-[100px]">
                                        {user.campusName}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="absolute top-0 right-0 w-32 h-32 bg-white dark:bg-zinc-950 opacity-5 rounded-full blur-2xl -mr-10 -mt-10"></div>
                </div>

                <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-2">
                    <Link 
                        href="/dashboard" 
                        onClick={onClose}
                        className="flex items-center px-4 py-3 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all font-semibold"
                    >
                        <LayoutDashboard className="h-5 w-5 mr-3 text-primary" />
                        <span className="text-sm">Dashboard Home</span>
                    </Link>

                    {navModules.map(module => {
                        const visibleItems = module.items.filter(item => hasPermission(item.permission));
                        if (visibleItems.length === 0) return null;

                        const isModuleOpen = openModules[module.id];

                        return (
                            <div key={module.id} className="flex flex-col gap-1 mt-2">
                                <button
                                    onClick={() => toggleModule(module.id)}
                                    className="flex items-center justify-between px-4 py-2 text-xs font-bold text-zinc-500 uppercase tracking-widest hover:text-primary transition-colors group"
                                >
                                    <div className="flex items-center">
                                        <module.icon className="h-4 w-4 mr-2 opacity-70 group-hover:opacity-100" />
                                        {module.name}
                                    </div>
                                    <ChevronDown className={`h-4 w-4 transition-transform ${!isModuleOpen ? "-rotate-90" : ""}`} />
                                </button>
                                
                                {isModuleOpen && (
                                    <div className="flex flex-col gap-1 ml-2 pl-2 border-l border-zinc-100 dark:border-zinc-800">
                                        {visibleItems.map(item => (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                onClick={onClose}
                                                className="flex items-center px-4 py-2.5 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all group"
                                            >
                                                <item.icon className="h-4 w-4 mr-3 opacity-60 group-hover:opacity-100 group-hover:text-primary" />
                                                <span className="text-sm font-medium">{item.name}</span>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    <div className="mt-8 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-1">
                        <Link href="/settings" onClick={onClose} className="flex items-center px-4 py-3 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all group">
                            <Settings className="h-5 w-5 mr-3 opacity-60 group-hover:opacity-100" />
                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Settings</span>
                        </Link>
                        
                        <button
                            onClick={handleLogout}
                            disabled={signingOut}
                            className="w-full flex items-center px-4 py-3 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/10 transition-colors group"
                        >
                            {signingOut ? (
                                <svg className="animate-spin h-5 w-5 mr-3 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                            ) : (
                                <LogOut className="h-5 w-5 mr-3 text-zinc-400 group-hover:text-red-500" />
                            )}
                            <span className="text-sm font-medium">Sign Out</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
