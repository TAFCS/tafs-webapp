import {
    Users, UserPlus, ArrowLeftRight, UserCircle, Banknote,
    Settings, Landmark, UserCog, ShieldCheck, LandPlot, BookOpen,
    LayoutGrid, TrendingUp, UserCheck, Contact, Tags, CalendarDays,
    FilePlus2, HandCoins, Printer, FileText, History, Layers,
    MessageSquare, Database, Briefcase, Clock, CalendarCheck,
    CalendarClock, ClipboardList, ClipboardCheck, Bell,
    Fingerprint, CreditCard, Wallet, Building2, Megaphone, ScrollText, ClipboardPlus,
    Shuffle, SlidersHorizontal,
} from "lucide-react";
import { SUPPORT_TICKETS_VIEW_PERMISSION, canViewSupportTickets } from "@/features/support-tickets/supportTicketAccess";
import type { LucideIcon } from "lucide-react";
import type { StaffUser } from "@/store/slices/authSlice";

export interface NavItem {
    id?: string;
    name: string;
    description: string;
    href: string;
    icon: LucideIcon;
    permission?: string;
    permissions?: string[];
    /**
     * Optional section heading on the module page. Items are grouped in the
     * order their group first appears in `items`, so keep same-group entries
     * contiguous. Modules that set no groups render as one flat "Pages" grid.
     */
    group?: string;
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

export interface AccessCatalogTile {
    id: string;
    module: string;
    label: string;
    description: string;
    href: string;
    group: string | null;
    sort_order: number;
    capabilities: string[];
}

export interface AccessCatalog {
    modules: { id: string; tiles: AccessCatalogTile[] }[];
}

/** Icons cannot come from the API JSON — keyed by tile id from the backend manifest. */
export const TILE_ICONS: Record<string, LucideIcon> = {
    "student.quick_registration": ClipboardPlus,
    "student.registration": UserPlus,
    "student.enrollments": UserCheck,
    "student.directory": Users,
    "student.families": Contact,
    "student.parent_change_requests": ShieldCheck,
    "student.transfers": ArrowLeftRight,
    "student.academic_actions": TrendingUp,
    "student.section_allocation": SlidersHorizontal,
    "student.house_balancer": Shuffle,
    "finance.financial_reports": FileText,
    "finance.class_fee_schedule": CalendarDays,
    "finance.student_overrides": UserCog,
    "finance.single_voucher": Printer,
    "finance.bulk_voucher": FilePlus2,
    "finance.vouchers": CreditCard,
    "finance.pending_release": Clock,
    "finance.payment_history": History,
    "finance.receive_deposit": HandCoins,
    "finance.postdated_cheques": Clock,
    "communication.notice_board": Bell,
    "communication.support_tickets": MessageSquare,
    "communication.notification_templates": Bell,
    "hr.employee_directory": Users,
    "hr.register_employee": UserPlus,
    "hr.departments": Layers,
    "hr.payroll": Wallet,
    "hr.payroll_rules": Landmark,
    "hr.security_deposits": HandCoins,
    "hr.employee_loans": Banknote,
    "hr.employee_notices": Megaphone,
    "attendance.staff_register": ClipboardCheck,
    "attendance.employee_attendance": UserCheck,
    "attendance.employee_attendance_cycle": LayoutGrid,
    "attendance.objections": ClipboardList,
    "attendance.leave_requests": CalendarClock,
    "attendance.student_attendance": UserCheck,
    "attendance.student_attendance_cycle": LayoutGrid,
    "attendance.quick_check_in": Clock,
    "attendance.alevel_roll_call": ClipboardList,
    "attendance.timetables": CalendarDays,
    "attendance.teaching_groups": BookOpen,
    "attendance.saturday_schedules": CalendarDays,
    "attendance.shift_overrides": CalendarClock,
    "attendance.academic_calendar": CalendarDays,
    "attendance.settings": Settings,
    "attendance.class_modes": Clock,
    "attendance.zk_device_logs": Fingerprint,
    "school-setup.campuses": LandPlot,
    "school-setup.classes": BookOpen,
    "school-setup.sections": LayoutGrid,
    "school-setup.section_allocation": SlidersHorizontal,
    "school-setup.house_balancer": Shuffle,
    "school-setup.fee_types": Tags,
    "school-setup.discount_presets": HandCoins,
    "school-setup.banks": Landmark,
    "system.people_access": UserCog,
    "system.access_packs": ShieldCheck,
    "system.activity_logs": ScrollText,
    "system.backups": Database,
    "system.developer_settings": Settings,
};

export const NAV_MODULES: NavModule[] = [
    {
        id: "student",
        name: "Student & Profiling",
        description: "Registrations, enrollments, family records and academic actions.",
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
            { id: "student.quick_registration", name: "Quick Registration", description: "Unconfirmed admission intake", href: "/identity/quick-registration", icon: ClipboardPlus, permission: "students.registration.view" },
            { id: "student.registration", name: "Registration", description: "New student intake", href: "/identity/register", icon: UserPlus, permission: "students.registration.view" },
            { id: "student.enrollments", name: "Enrollments", description: "Class and section assignment", href: "/enrollments", icon: UserCheck, permission: "students.enrollment.view" },
            { id: "student.directory", name: "Student Directory", description: "Search all students", href: "/identity/students", icon: Users, permission: "students.directory.view" },
            { id: "student.families", name: "Families", description: "Guardian and contact info", href: "/families", icon: Contact, permission: "students.families.view" },
            { id: "student.parent_change_requests", name: "Parent Change Requests", description: "Profile update approvals", href: "/parent-change-requests", icon: ShieldCheck, permission: "students.families.view" },
            { id: "student.transfers", name: "Transfers", description: "Inter-school movements", href: "/transfers", icon: ArrowLeftRight, permission: "academic.transfers.view" },
            { id: "student.academic_actions", name: "Academic Actions", description: "Bulk promotions and actions", href: "/bulk-promote", icon: TrendingUp, permission: "academic.bulk_promote.execute" },
            { id: "student.section_allocation", name: "Section Allocation Rules", description: "Capacity and gender limits per campus/class/section", href: "/campuses/allocation-rules", icon: SlidersHorizontal, permission: "academic.campuses.view" },
            { id: "student.house_balancer", name: "House Balancer", description: "Random evenly balanced house redistribution", href: "/house-balancer", icon: Shuffle, permission: "academic.campuses.view" },
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
            "finance.vouchers.view", "finance.vouchers.release", "finance.deposits.view", "system.analytics.view",
        ],
        items: [
            { id: "finance.financial_reports", name: "Financial Reports", description: "Fee heads (accrual), deposits (cash), a student x month fee matrix, and the defaulters list, with filters and exports", href: "/financial-reports", icon: FileText, permission: "system.analytics.view" },
            { id: "finance.class_fee_schedule", name: "Class Fee Schedule", description: "Per-class fee configuration", href: "/classwise-fees-schedule", icon: CalendarDays, permission: "fee_admin.classwise_schedule.view" },
            { id: "finance.student_overrides", name: "Student Overrides", description: "Individual fee adjustments", href: "/studentwise-fees", icon: UserCog, permission: "fee_admin.studentwise_schedule.view" },
            { id: "finance.single_voucher", name: "Single Voucher Issuance", description: "Print individual fee slips", href: "/fee-challan", icon: Printer, permission: "finance.vouchers.view" },
            { id: "finance.bulk_voucher", name: "Bulk Voucher Issuance", description: "Generate multiple vouchers", href: "/bulk-voucher", icon: FilePlus2, permission: "finance.vouchers.generate_bulk" },
            { id: "finance.vouchers", name: "Vouchers", description: "All issued vouchers", href: "/vouchers", icon: CreditCard, permission: "finance.vouchers.view" },
            { id: "finance.pending_release", name: "Pending Release", description: "Held vouchers awaiting parent visibility", href: "/pending-release", icon: Clock, permission: "finance.vouchers.release" },
            { id: "finance.payment_history", name: "Payment History", description: "Payment transaction log", href: "/payment-history", icon: History, permission: "finance.vouchers.view" },
            { id: "finance.receive_deposit", name: "Receive Deposit", description: "Record cash and cheque deposits", href: "/vouchers/deposit", icon: HandCoins, permission: "finance.deposits.record" },
            { id: "finance.postdated_cheques", name: "Post-dated Cheques", description: "Cheque tracking and alerts", href: "/postdated-cheques", icon: Clock, permission: "finance.vouchers.view" },
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
        permissions: ["communication.send_announcements", SUPPORT_TICKETS_VIEW_PERMISSION, "system.permissions.manage"],
        items: [
            { id: "communication.notice_board", name: "Notice Board", description: "Broadcast announcements", href: "/notice-board", icon: Bell, permission: "communication.send_announcements" },
            { id: "communication.support_tickets", name: "Support Tickets", description: "Issue tracking and resolution", href: "/support-tickets", icon: MessageSquare, permission: SUPPORT_TICKETS_VIEW_PERMISSION },
            { id: "communication.notification_templates", name: "Notification Templates", description: "Edit push notification text", href: "/admin/notification-templates", icon: Bell, permission: "system.permissions.manage" },
        ],
    },
    {
        id: "hr",
        name: "HR & Payroll",
        description: "Employee records, departments and salary processing.",
        icon: Briefcase,
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-50 dark:bg-amber-950/40",
        border: "border-amber-100 dark:border-amber-900/50",
        permissions: ["hr.employees.view", "hr.payroll.view", "communication.send_employee_announcements"],
        items: [
            { id: "hr.employee_directory", name: "Employee Directory", description: "Staff profiles and records", href: "/hr/employees", icon: Users, permission: "hr.employees.view" },
            { id: "hr.register_employee", name: "Register a Employee", description: "Create new employee profile", href: "/hr/employees/new", icon: UserPlus, permission: "hr.employees.view" },
            { id: "hr.departments", name: "Departments", description: "Departments and staff categories", href: "/hr/departments", icon: Layers, permission: "hr.employees.view" },
            { id: "hr.payroll", name: "Payroll", description: "Salary processing", href: "/hr/payroll", icon: Wallet, permission: "hr.payroll.view" },
            { id: "hr.payroll_rules", name: "Payroll Rules", description: "EOBI, SESSI & income tax rates", href: "/hr/payroll/rules", icon: Landmark, permission: "hr.payroll.view" },
            { id: "hr.security_deposits", name: "Security Deposits", description: "Caution money plans across employees", href: "/hr/security-deposits", icon: HandCoins, permission: "hr.employees.view" },
            { id: "hr.employee_loans", name: "Employee Loans", description: "Salary advance loans across employees", href: "/hr/employee-loans", icon: Banknote, permission: "hr.employees.view" },
            { id: "hr.employee_notices", name: "Employee Notices", description: "Broadcast announcements to staff by role", href: "/hr/notices", icon: Megaphone, permission: "communication.send_employee_announcements" },
        ],
    },
    {
        id: "attendance",
        name: "Attendance",
        description: "Staff and student attendance, leave, schedules, roll calls and device logs.",
        icon: CalendarCheck,
        color: "text-rose-600 dark:text-rose-400",
        bg: "bg-rose-50 dark:bg-rose-950/40",
        border: "border-rose-100 dark:border-rose-900/50",
        permissions: [
            "attendance.staff.mark", "hr.policies.manage", "hr.objections.review", "hr.leave.approve",
            "attendance.student.rollcall.mark", "attendance.student.rollcall.view",
            "hr.timetable.view", "hr.timetable.manage", "system.permissions.manage",
            "hr.payroll.view",
        ],
        items: [
            { id: "attendance.staff_register", group: "Employees", name: "Staff Register", description: "Daily staff punch-in", href: "/hr/staff-register", icon: ClipboardCheck, permission: "attendance.staff.mark" },
            { id: "attendance.employee_attendance", group: "Employees", name: "Employee Attendance", description: "Daily staff clock-in/out from biometric devices", href: "/hr/attendance-dashboard", icon: UserCheck, permissions: ["attendance.staff.mark", "hr.objections.review"] },
            { id: "attendance.employee_attendance_cycle", group: "Employees", name: "Employee Attendance by Cycle", description: "Employee lines and punch matrix over a date range", href: "/hr/attendance-dashboard/cycle", icon: LayoutGrid, permission: "hr.payroll.view" },
            { id: "attendance.objections", group: "Employees", name: "Attendance Objections", description: "Review employee attendance disputes", href: "/hr/objections", icon: ClipboardList, permission: "hr.objections.review" },
            { id: "attendance.leave_requests", group: "Employees", name: "Leave Requests", description: "Review employee leave applications", href: "/hr/leaves", icon: CalendarClock, permission: "hr.leave.approve" },
            { id: "attendance.student_attendance", group: "Students", name: "Student Attendance", description: "Per-class attendance records", href: "/hr/student-attendance-dashboard", icon: UserCheck, permissions: ["attendance.student.rollcall.mark", "attendance.student.rollcall.view"] },
            { id: "attendance.student_attendance_cycle", group: "Students", name: "Student Attendance by Cycle", description: "Student lines and punch matrix over a date range", href: "/hr/student-attendance-dashboard/cycle", icon: LayoutGrid, permissions: ["attendance.student.rollcall.mark", "attendance.student.rollcall.view"] },
            { id: "attendance.quick_check_in", group: "Students", name: "Quick Check-In", description: "Filter, search, and punch students in or out — including default absents", href: "/attendance/quick-check-in", icon: Clock, permissions: ["attendance.student.rollcall.mark"] },
            { id: "attendance.alevel_roll_call", group: "Students", name: "A-Level Roll Call", description: "A-level section marking", href: "/hr/roll-call", icon: ClipboardList, permissions: ["attendance.student.rollcall.mark", "attendance.student.rollcall.view"] },
            { id: "attendance.timetables", group: "Scheduling", name: "Timetables", description: "Weekly schedules and O/A-Level makeup reschedules", href: "/hr/timetables", icon: CalendarDays, permissions: ["hr.timetable.view", "hr.timetable.manage"] },
            { id: "attendance.teaching_groups", group: "Scheduling", name: "Teaching Groups", description: "Subject classes and student subject enrollment", href: "/hr/teaching-groups", icon: BookOpen, permissions: ["hr.timetable.view", "hr.timetable.manage"] },
            { id: "attendance.saturday_schedules", group: "Scheduling", name: "Saturday Schedules", description: "Mandatory teacher Saturdays", href: "/hr/saturday-schedules", icon: CalendarDays, permission: "hr.policies.manage" },
            { id: "attendance.shift_overrides", group: "Scheduling", name: "Shift Overrides", description: "Override check-in/out time for a campus or segment on specific days", href: "/hr/shift-overrides", icon: CalendarClock, permission: "hr.policies.manage" },
            { id: "attendance.academic_calendar", group: "Scheduling", name: "Academic Calendar", description: "School year and events", href: "/hr/calendar", icon: CalendarDays, permission: "hr.policies.manage" },
            { id: "attendance.settings", group: "Configuration", name: "Attendance Settings", description: "Rules and thresholds", href: "/hr/attendance-settings", icon: Settings, permission: "hr.policies.manage" },
            { id: "attendance.class_modes", group: "Configuration", name: "Class Modes", description: "Online / offline configuration", href: "/hr/class-modes", icon: Clock, permission: "hr.policies.manage" },
            { id: "attendance.zk_device_logs", group: "Configuration", name: "ZK Device Logs", description: "Biometric device data", href: "/attendance/zk-device-logs", icon: Fingerprint, permission: "system.permissions.manage" },
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
            { id: "school-setup.campuses", name: "Campuses", description: "Branch locations and details", href: "/campuses", icon: LandPlot, permission: "academic.campuses.view" },
            { id: "school-setup.classes", name: "Classes", description: "Grade and year configuration", href: "/classes", icon: BookOpen, permission: "academic.classes.view" },
            { id: "school-setup.sections", name: "Sections", description: "Class subdivisions", href: "/sections", icon: LayoutGrid, permission: "academic.sections.view" },
            { id: "school-setup.section_allocation", name: "Section Allocation Rules", description: "Capacity and gender limits per campus/class/section", href: "/campuses/allocation-rules", icon: SlidersHorizontal, permission: "academic.campuses.view" },
            { id: "school-setup.house_balancer", name: "House Balancer", description: "Random evenly balanced house redistribution", href: "/house-balancer", icon: Shuffle, permission: "academic.campuses.view" },
            { id: "school-setup.fee_types", name: "Fee Types", description: "Fee head definitions", href: "/fee-types", icon: Tags, permission: "fee_admin.fee_types.view" },
            { id: "school-setup.discount_presets", name: "Discount Presets", description: "Standard discount templates", href: "/discount-presets", icon: HandCoins, permission: "fee_admin.fee_types.view" },
            { id: "school-setup.banks", name: "Banks", description: "Banking relationships", href: "/banks", icon: Landmark, permission: "finance.banks.view" },
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
            { id: "system.people_access", name: "People & Access", description: "Create people, job assignment and ERP tile access", href: "/system/users", icon: UserCog, permission: "system.users.view" },
            { id: "system.access_packs", name: "Access Packs", description: "Reusable tile bundles layered on top of roles", href: "/system/permissions", icon: ShieldCheck, permission: "system.permissions.manage" },
            { id: "system.activity_logs", name: "Activity Logs", description: "Full audit log across all modules", href: "/system/logs", icon: ScrollText, permission: "system.users.view" },
            { id: "system.backups", name: "Database Backups", description: "Data backup management", href: "/admin/backups", icon: Database, permission: "system.backups.view" },
            { id: "system.developer_settings", name: "Developer Settings", description: "Technical configuration", href: "/admin/developer", icon: Settings, permission: "system.permissions.manage" },
        ],
    },
];

export function catalogTileToNavItem(tile: AccessCatalogTile): NavItem {
    return {
        id: tile.id,
        name: tile.label,
        description: tile.description,
        href: tile.href,
        icon: TILE_ICONS[tile.id] ?? LayoutGrid,
        group: tile.group ?? undefined,
        permission: tile.capabilities[0],
        permissions: tile.capabilities.length > 1 ? tile.capabilities : undefined,
    };
}

/** Overlay live catalog tiles onto module metadata. Falls back to checked-in items. */
export function mergeNavModules(catalog: AccessCatalog | null | undefined): NavModule[] {
    if (!catalog?.modules?.length) return NAV_MODULES;
    const tilesByModule = new Map(catalog.modules.map((m) => [m.id, m.tiles]));
    return NAV_MODULES.map((mod) => {
        const tiles = tilesByModule.get(mod.id);
        if (!tiles) return { ...mod, items: [] };
        return { ...mod, items: tiles.map(catalogTileToNavItem) };
    });
}

export function isTileVisible(
    user: Pick<StaffUser, "role" | "permissions" | "effectiveTileIds"> | null | undefined,
    item: NavItem,
): boolean {
    if (!user) return false;
    if (item.href === "/admin/developer" || item.href === "/attendance/zk-device-logs") {
        return user.role === "SUPER_ADMIN";
    }
    if (user.effectiveTileIds) {
        if (!item.id) return false;
        return user.effectiveTileIds.includes(item.id);
    }
    if (user.role === "SUPER_ADMIN") return true;
    if (item.href === "/hr/saturday-schedules" || item.href === "/hr/shift-overrides") {
        return user.role === "CAMPUS_ADMIN";
    }
    if (item.permission === SUPPORT_TICKETS_VIEW_PERMISSION || item.permissions?.includes(SUPPORT_TICKETS_VIEW_PERMISSION)) {
        return canViewSupportTickets(user);
    }
    if (item.permissions) return item.permissions.some((p) => user.permissions?.includes(p));
    if (item.permission) return user.permissions?.includes(item.permission) ?? false;
    return false;
}

export function visibleModulesForUser(
    user: Pick<StaffUser, "role" | "permissions" | "effectiveTileIds"> | null | undefined,
    modules: NavModule[] = NAV_MODULES,
): NavModule[] {
    if (!user) return [];
    return modules
        .map((mod) => ({ ...mod, items: mod.items.filter((item) => isTileVisible(user, item)) }))
        .filter((mod) => mod.items.length > 0);
}

export function hrefToModuleId(modules: NavModule[]): Record<string, string> {
    const map: Record<string, string> = {};
    modules.forEach((m) => m.items.forEach((item) => { map[item.href] = m.id; }));
    return map;
}
