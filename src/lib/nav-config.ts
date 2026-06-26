import {
    Users, UserPlus, ArrowLeftRight, UserCircle, Banknote,
    Settings, Landmark, UserCog, ShieldCheck, LandPlot, BookOpen,
    LayoutGrid, TrendingUp, UserCheck, Contact, Tags, CalendarDays,
    FilePlus2, HandCoins, Printer, FileText, History, Layers,
    MessageSquare, Database, Briefcase, Clock, CalendarCheck,
    CalendarClock, ClipboardList, ClipboardCheck, Bell, Tag,
    Fingerprint, BarChart3, CreditCard, Wallet, Building2,
} from "lucide-react";
import { SUPPORT_TICKETS_VIEW_PERMISSION } from "@/features/support-tickets/supportTicketAccess";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
    name: string;
    href: string;
    icon: LucideIcon;
    permission?: string;
    permissions?: string[];
}

export interface NavModule {
    id: string;
    name: string;
    description: string;
    icon: LucideIcon;
    color: string;
    bg: string;
    border: string;
    permissions: string[];
    items: NavItem[];
}

export const NAV_MODULES: NavModule[] = [
    {
        id: "student",
        name: "Student & Profiling",
        description: "Registrations, enrollments, student directory and family records.",
        icon: UserCircle,
        color: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-50 dark:bg-blue-950/40",
        border: "border-blue-100 dark:border-blue-900/50",
        permissions: [
            "students.registration.view", "students.enrollment.view",
            "students.directory.view", "students.families.view",
            "academic.transfers.view", "academic.bulk_promote.execute",
        ],
        items: [
            { name: "Registration", href: "/identity/register", icon: UserPlus, permission: "students.registration.view" },
            { name: "Enrollments", href: "/enrollments", icon: UserCheck, permission: "students.enrollment.view" },
            { name: "Student Directory", href: "/identity/students", icon: Users, permission: "students.directory.view" },
            { name: "Families", href: "/families", icon: Contact, permission: "students.families.view" },
            { name: "Parent Change Requests", href: "/parent-change-requests", icon: ShieldCheck, permission: "students.families.view" },
            { name: "Transfers", href: "/transfers", icon: ArrowLeftRight, permission: "academic.transfers.view" },
            { name: "Academic Actions", href: "/bulk-promote", icon: TrendingUp, permission: "academic.bulk_promote.execute" },
        ],
    },
    {
        id: "finance",
        name: "Finance",
        description: "Vouchers, payments, deposits, post-dated cheques and financial reports.",
        icon: Banknote,
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-50 dark:bg-emerald-950/40",
        border: "border-emerald-100 dark:border-emerald-900/50",
        permissions: [
            "fee_admin.classwise_schedule.view", "fee_admin.studentwise_schedule.view",
            "finance.vouchers.view", "finance.deposits.view", "system.analytics.view",
        ],
        items: [
            { name: "Financial Reports", href: "/financial-reports", icon: BarChart3, permission: "system.analytics.view" },
            { name: "Class Fee Schedule", href: "/classwise-fees-schedule", icon: CalendarDays, permission: "fee_admin.classwise_schedule.view" },
            { name: "Student Overrides", href: "/studentwise-fees", icon: UserCog, permission: "fee_admin.studentwise_schedule.view" },
            { name: "Single Voucher Issuance", href: "/fee-challan", icon: Printer, permission: "finance.vouchers.view" },
            { name: "Bulk Voucher Issuance", href: "/bulk-voucher", icon: FilePlus2, permission: "finance.vouchers.generate_bulk" },
            { name: "Vouchers", href: "/vouchers", icon: CreditCard, permission: "finance.vouchers.view" },
            { name: "Payment History", href: "/payment-history", icon: History, permission: "finance.vouchers.view" },
            { name: "Receive Deposit", href: "/vouchers/deposit", icon: HandCoins, permission: "finance.deposits.record" },
            { name: "Post-dated Cheques", href: "/postdated-cheques", icon: Clock, permission: "finance.vouchers.view" },
        ],
    },
    {
        id: "communication",
        name: "Communications",
        description: "Announcements, notice boards and support tickets.",
        icon: MessageSquare,
        color: "text-violet-600 dark:text-violet-400",
        bg: "bg-violet-50 dark:bg-violet-950/40",
        border: "border-violet-100 dark:border-violet-900/50",
        permissions: ["communication.send_announcements", SUPPORT_TICKETS_VIEW_PERMISSION],
        items: [
            { name: "Notice Board", href: "/notice-board", icon: Bell, permission: "communication.send_announcements" },
            { name: "Support Tickets", href: "/support-tickets", icon: MessageSquare, permission: SUPPORT_TICKETS_VIEW_PERMISSION },
        ],
    },
    {
        id: "hr",
        name: "HR & Payroll",
        description: "Employee records, departments, payroll, leave and policies.",
        icon: Briefcase,
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-50 dark:bg-amber-950/40",
        border: "border-amber-100 dark:border-amber-900/50",
        permissions: ["hr.employees.view", "hr.policies.manage", "hr.leave.apply", "hr.payroll.view", "attendance.staff.mark"],
        items: [
            { name: "Employee Directory", href: "/hr/employees", icon: Users, permission: "hr.employees.view" },
            { name: "Departments", href: "/hr/departments", icon: Layers, permission: "hr.employees.view" },
            { name: "Staff Types", href: "/hr/staff-types", icon: Tag, permission: "hr.employees.view" },
            { name: "HR Policies", href: "/hr/policies", icon: FileText, permission: "hr.policies.manage" },
            { name: "Staff Register", href: "/hr/staff-register", icon: ClipboardCheck, permission: "attendance.staff.mark" },
            { name: "Payroll", href: "/hr/payroll", icon: Wallet, permission: "hr.payroll.view" },
            { name: "My Leave", href: "/hr/leave", icon: CalendarClock, permission: "hr.leave.apply" },
            { name: "Academic Calendar", href: "/hr/calendar", icon: CalendarDays, permission: "hr.policies.manage" },
        ],
    },
    {
        id: "attendance",
        name: "Attendance",
        description: "Staff and student attendance, roll calls, class modes and device logs.",
        icon: CalendarCheck,
        color: "text-rose-600 dark:text-rose-400",
        bg: "bg-rose-50 dark:bg-rose-950/40",
        border: "border-rose-100 dark:border-rose-900/50",
        permissions: [
            "attendance.staff.mark", "hr.policies.manage",
            "attendance.student.rollcall.mark", "attendance.student.rollcall.view",
        ],
        items: [
            { name: "Staff Attendance", href: "/hr/attendance-dashboard", icon: CalendarCheck, permission: "attendance.staff.mark" },
            { name: "Attendance Settings", href: "/hr/attendance-settings", icon: Settings, permission: "hr.policies.manage" },
            { name: "Class Modes", href: "/hr/class-modes", icon: Clock, permission: "hr.policies.manage" },
            { name: "Student Attendance", href: "/hr/student-attendance-dashboard", icon: UserCheck, permissions: ["attendance.student.rollcall.mark", "attendance.student.rollcall.view"] },
            { name: "A-Level Roll Call", href: "/hr/roll-call", icon: ClipboardList, permissions: ["attendance.student.rollcall.mark", "attendance.student.rollcall.view"] },
            { name: "ZK Device Logs", href: "/attendance/zk-device-logs", icon: Fingerprint, permission: "system.permissions.manage" },
        ],
    },
    {
        id: "school-setup",
        name: "School Setup",
        description: "Define the institution — campuses, classes, sections, fee types and banks.",
        icon: Building2,
        color: "text-indigo-600 dark:text-indigo-400",
        bg: "bg-indigo-50 dark:bg-indigo-950/40",
        border: "border-indigo-100 dark:border-indigo-900/50",
        permissions: [
            "academic.campuses.view", "academic.classes.view", "academic.sections.view",
            "fee_admin.fee_types.view", "finance.banks.view",
        ],
        items: [
            { name: "Campuses", href: "/campuses", icon: LandPlot, permission: "academic.campuses.view" },
            { name: "Classes", href: "/classes", icon: BookOpen, permission: "academic.classes.view" },
            { name: "Sections", href: "/sections", icon: LayoutGrid, permission: "academic.sections.view" },
            { name: "Fee Types", href: "/fee-types", icon: Tags, permission: "fee_admin.fee_types.view" },
            { name: "Discount Presets", href: "/discount-presets", icon: HandCoins, permission: "fee_admin.fee_types.view" },
            { name: "Banks", href: "/banks", icon: Landmark, permission: "finance.banks.view" },
        ],
    },
    {
        id: "system",
        name: "System",
        description: "User accounts, permission roles, backups and developer tools.",
        icon: Settings,
        color: "text-zinc-600 dark:text-zinc-400",
        bg: "bg-zinc-50 dark:bg-zinc-900/60",
        border: "border-zinc-100 dark:border-zinc-800/60",
        permissions: ["system.users.view", "system.permissions.manage", "system.backups.view"],
        items: [
            { name: "User Management", href: "/system/users", icon: UserCog, permission: "system.users.view" },
            { name: "Permissions", href: "/system/permissions", icon: ShieldCheck, permission: "system.permissions.manage" },
            { name: "Database Backups", href: "/admin/backups", icon: Database, permission: "system.backups.view" },
            { name: "Developer Settings", href: "/admin/developer", icon: Settings, permission: "system.permissions.manage" },
        ],
    },
];
