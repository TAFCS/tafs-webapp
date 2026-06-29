"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    Printer, CreditCard, HandCoins, History, Clock,
    UserPlus, Users, BarChart3, MessageSquare, UserCog,
    Ticket, FilePlus, FilePen, Trash2, RefreshCw,
} from "lucide-react";
import { useAuthState } from "@/context/AuthContext";
import { NAV_MODULES } from "@/lib/nav-config";
import { auditLogsService, type AuditLog } from "@/lib/audit-logs.service";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchMyQueue, type SupportTicket } from "@/store/slices/supportTicketsSlice";
import type { LucideIcon } from "lucide-react";

// ── Inline Components ──────────────────────────────────────────────────────────

function ActionCard({ label, href, icon: Icon }: { label: string; href: string; icon: LucideIcon }) {
    return (
        <Link
            href={href}
            className="flex items-center gap-3 p-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:shadow-md hover:border-primary/30 transition-all group"
        >
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-primary transition-colors">
                {label}
            </span>
        </Link>
    );
}

function SidebarShell({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">{title}</p>
            {children}
        </div>
    );
}

function SkeletonRows({ count = 4 }: { count?: number }) {
    return (
        <div className="flex flex-col gap-2">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
            ))}
        </div>
    );
}

function relativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

// ── Sidebars ──────────────────────────────────────────────────────────────────

const ACTION_META: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
    CREATED:        { icon: FilePlus,  color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/40", label: "created"       },
    UPDATED:        { icon: FilePen,   color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-950/40",       label: "updated"       },
    DELETED:        { icon: Trash2,    color: "text-rose-600",    bg: "bg-rose-50 dark:bg-rose-950/40",       label: "deleted"       },
    STATUS_CHANGED: { icon: RefreshCw, color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-950/40",     label: "changed status on" },
};

const ENTITY_LABELS: Record<string, { singular: string; plural: string; pill: string }> = {
    VOUCHER:  { singular: "voucher",  plural: "vouchers",  pill: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300" },
    DEPOSIT:  { singular: "deposit",  plural: "deposits",  pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
    STUDENT:  { singular: "student",  plural: "students",  pill: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
    GUARDIAN: { singular: "guardian", plural: "guardians", pill: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
    FAMILY:   { singular: "family",   plural: "families",  pill: "bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300" },
};

interface GroupedLog {
    key: string;
    action: string;
    entity_type: string;
    changed_by: string;
    changed_at: string;
    count: number;
    entityIds: string[];
    studentIds: number[];
    field?: string | null;
    old_value?: string | null;
    new_value?: string | null;
}

function groupLogs(logs: AuditLog[]): GroupedLog[] {
    const groups: GroupedLog[] = [];
    for (const log of logs) {
        const bucket = Math.floor(new Date(log.changed_at).getTime() / (5 * 60_000));
        const last = groups[groups.length - 1];
        if (
            last &&
            last.action === log.action &&
            last.entity_type === log.entity_type &&
            last.changed_by === log.changed_by &&
            Math.floor(new Date(last.changed_at).getTime() / (5 * 60_000)) === bucket &&
            !log.field
        ) {
            last.count++;
            if (!last.entityIds.includes(log.entity_id)) last.entityIds.push(log.entity_id);
            if (log.student_id && !last.studentIds.includes(log.student_id)) last.studentIds.push(log.student_id);
        } else {
            groups.push({
                key: String(log.id),
                action: log.action,
                entity_type: log.entity_type,
                changed_by: log.changed_by,
                changed_at: log.changed_at,
                count: 1,
                entityIds: [log.entity_id],
                studentIds: log.student_id ? [log.student_id] : [],
                field: log.field,
                old_value: log.old_value,
                new_value: log.new_value,
            });
        }
    }
    return groups;
}

function AuditLogSidebar({ currentUsername, currentFullName }: { currentUsername?: string; currentFullName?: string }) {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        auditLogsService
            .list({ limit: 50 })
            .then(res => setLogs(res.data))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, []);

    function displayName(changedBy: string) {
        if (currentUsername && changedBy === currentUsername) return currentFullName ?? "You";
        return changedBy;
    }

    const groups = groupLogs(logs);

    return (
        <SidebarShell title="Recent Activity">
            {loading && <SkeletonRows count={5} />}
            {error && (
                <p className="text-sm text-zinc-400 py-4 text-center">Could not load activity.</p>
            )}
            {!loading && !error && groups.length === 0 && (
                <p className="text-sm text-zinc-400 py-4 text-center">No recent activity.</p>
            )}
            {!loading && !error && groups.length > 0 && (
                <div className="overflow-y-auto max-h-[520px] flex flex-col gap-1 pr-1 -mr-1">
                    {groups.map(log => {
                        const meta = ACTION_META[log.action] ?? ACTION_META.UPDATED;
                        const Icon = meta.icon;
                        const entity = ENTITY_LABELS[log.entity_type];
                        const entityLabel = log.count > 1
                            ? `${log.count} ${entity?.plural ?? log.entity_type.toLowerCase()}`
                            : entity?.singular ?? log.entity_type.toLowerCase();
                        const name = displayName(log.changed_by);
                        return (
                            <div key={log.key} className="flex items-start gap-2.5 px-2 py-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors group">
                                <div className={`mt-0.5 h-6 w-6 rounded-md flex items-center justify-center shrink-0 ${meta.bg}`}>
                                    <Icon className={`h-3 w-3 ${meta.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[12px] leading-snug text-zinc-700 dark:text-zinc-300">
                                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{name}</span>
                                        {" "}{meta.label}{" "}
                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${entity?.pill ?? "bg-zinc-100 text-zinc-600"}`}>
                                            {entityLabel}
                                        </span>
                                    </p>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {log.entityIds.slice(0, 5).map(id => (
                                            <span key={id} className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                                                #{id}
                                            </span>
                                        ))}
                                        {log.entityIds.length > 5 && (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
                                                +{log.entityIds.length - 5} more
                                            </span>
                                        )}
                                        {log.studentIds.slice(0, 3).map(cc => (
                                            <span key={cc} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                                CC {cc}
                                            </span>
                                        ))}
                                    </div>
                                    {log.field && log.old_value != null && log.new_value != null && (
                                        <p className="text-[10px] text-zinc-400 mt-0.5 truncate">
                                            {log.field}: <span className="line-through opacity-60">{log.old_value}</span>
                                            <span className="mx-1 opacity-40">→</span>
                                            <span className="text-zinc-600 dark:text-zinc-300">{log.new_value}</span>
                                        </p>
                                    )}
                                    <p className="text-[10px] text-zinc-400 mt-0.5">{relativeTime(log.changed_at)}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </SidebarShell>
    );
}

function TicketsSidebar() {
    const dispatch = useAppDispatch();
    const tickets = useAppSelector(s => s.supportTickets.queueItems);
    const loading = useAppSelector(s => s.supportTickets.isLoadingQueue);

    useEffect(() => {
        dispatch(fetchMyQueue());
    }, [dispatch]);

    const statusColor = (status: SupportTicket["status"]) => {
        if (status === "OPEN") return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400";
        if (status === "ASSIGNED") return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400";
        return "bg-zinc-100 text-zinc-500";
    };

    return (
        <SidebarShell title="Open Tickets">
            {loading && <SkeletonRows count={4} />}
            {!loading && tickets.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-6 text-zinc-400">
                    <Ticket className="h-6 w-6 opacity-40" />
                    <p className="text-sm">No open tickets.</p>
                    <Link href="/support-tickets" className="text-xs text-primary hover:underline">
                        View all tickets →
                    </Link>
                </div>
            )}
            {!loading && tickets.length > 0 && (
                <div className="flex flex-col gap-1.5">
                    {tickets.map(t => (
                        <Link
                            key={t.id}
                            href={`/support-tickets?ticket=${t.id}`}
                            className="flex flex-col gap-1 px-3 py-2.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-[12px] font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                                    {t.families?.household_name ?? "Unknown family"}
                                </p>
                                <span className={`text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md shrink-0 ${statusColor(t.status)}`}>
                                    {t.status}
                                </span>
                            </div>
                            {t.students?.full_name && (
                                <p className="text-[10px] text-zinc-400 truncate">{t.students.full_name}</p>
                            )}
                            <p className="text-[10px] text-zinc-400">{relativeTime(t.last_message_at)}</p>
                        </Link>
                    ))}
                    <Link
                        href="/support-tickets"
                        className="text-xs text-primary hover:underline text-center pt-1"
                    >
                        View all tickets →
                    </Link>
                </div>
            )}
        </SidebarShell>
    );
}


// ── Role Configs ──────────────────────────────────────────────────────────────

const SUPER_ADMIN_ACTIONS = [
    { label: "Register New Student", href: "/identity/register", icon: UserPlus },
    { label: "Issue Voucher", href: "/fee-challan", icon: Printer },
    { label: "Add Employee", href: "/hr/employees", icon: Users },
    { label: "Financial Reports", href: "/financial-reports", icon: BarChart3 },
    { label: "Support Tickets", href: "/support-tickets", icon: MessageSquare },
    { label: "Manage Users", href: "/system/users", icon: UserCog },
];

const FINANCE_CLERK_ACTIONS = [
    { label: "Issue Single Voucher", href: "/fee-challan", icon: Printer },
    { label: "Receive Deposit", href: "/vouchers/deposit", icon: HandCoins },
    { label: "View Vouchers", href: "/vouchers", icon: CreditCard },
    { label: "Payment History", href: "/payment-history", icon: History },
    { label: "Post-dated Cheques", href: "/postdated-cheques", icon: Clock },
];

const ROLE_LABELS: Record<string, string> = {
    SUPER_ADMIN: "Super Administrator",
    FINANCE_CLERK: "Finance Clerk",
    PRINCIPAL: "Principal",
    CAMPUS_ADMIN: "Campus Administrator",
    GENERAL_RESPONDENT: "General Respondent",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
    const { user, isLoading } = useAuthState();

    const hasPermission = (perm: string) => {
        if (user?.role === "SUPER_ADMIN") return true;
        return user?.permissions?.includes(perm) ?? false;
    };

    const visibleModules = NAV_MODULES.filter(m => m.permissions.some(hasPermission));
    const fallbackActions = visibleModules.flatMap(m => m.items.slice(0, 1));

    if (isLoading || !user) return null;

    const HONORIFICS = new Set(["Mr.", "Mrs.", "Ms.", "Miss", "Dr.", "Prof.", "Sir"]);
    const nameParts = user.fullName?.split(" ") ?? [];
    const firstName = nameParts.find(p => !HONORIFICS.has(p)) ?? user.username;
    const roleLabel = ROLE_LABELS[user.role] ?? user.role;
    const role = user.role;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
        >
            {/* Greeting */}
            <div>
                <h1 className="text-3xl font-black tracking-tight font-outfit text-zinc-900 dark:text-zinc-50">
                    Welcome back, {firstName}
                </h1>
                <p className="text-sm text-zinc-400 mt-1">{roleLabel}</p>
            </div>

            {/* Body */}
            {role === "PRINCIPAL" ? (
                <div className="mt-8 max-w-2xl">
                    <TicketsSidebar />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">

                    {/* Main — 2/3 */}
                    <div className="md:col-span-2">
                        {role === "SUPER_ADMIN" && (
                            <div className="flex flex-col gap-4">
                                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">Quick Actions</p>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                    {SUPER_ADMIN_ACTIONS.map(a => (
                                        <ActionCard key={a.href} {...a} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {role === "FINANCE_CLERK" && (
                            <div className="flex flex-col gap-4">
                                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">Quick Actions</p>
                                <div className="grid grid-cols-2 gap-4">
                                    {FINANCE_CLERK_ACTIONS.map(a => (
                                        <ActionCard key={a.href} {...a} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {role !== "SUPER_ADMIN" && role !== "FINANCE_CLERK" && fallbackActions.length > 0 && (
                            <div className="flex flex-col gap-4">
                                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">Quick Actions</p>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                    {fallbackActions.map(a => (
                                        <ActionCard key={a.href} label={a.name} href={a.href} icon={a.icon} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar — 1/3 */}
                    {(role === "SUPER_ADMIN" || role === "CAMPUS_ADMIN") && (
                        <div className="md:col-span-1">
                            <AuditLogSidebar currentUsername={user.username} currentFullName={user.fullName} />
                        </div>
                    )}
                </div>
            )}
        </motion.div>
    );
}
