"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
    X,
    ClipboardList,
    RefreshCw,
    ChevronDown,
    Loader2,
    FileText,
    Wallet,
    PlusCircle,
    MinusCircle,
    RotateCcw,
    CheckCircle2,
    AlertCircle,
    Clock,
} from "lucide-react";
import { auditLogsService, AuditLog } from "@/lib/audit-logs.service";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
    isOpen: boolean;
    onClose: () => void;
    studentId: number | null;
    studentName: string;
}

const PAGE_SIZE = 20;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    return new Date(iso).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
}

function formatFullDate(iso: string): string {
    return new Date(iso).toLocaleString("en-PK", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

// ─── Action Config ────────────────────────────────────────────────────────────

type ActionKey = "CREATED" | "DELETED" | "UPDATED" | "STATUS_CHANGED";
type EntityKey = "VOUCHER" | "DEPOSIT";

const ACTION_CONFIG: Record<ActionKey, { label: string; icon: any; bg: string; text: string; border: string }> = {
    CREATED: {
        label: "Created",
        icon: PlusCircle,
        bg: "bg-emerald-50 dark:bg-emerald-950/30",
        text: "text-emerald-600",
        border: "border-emerald-100 dark:border-emerald-900",
    },
    DELETED: {
        label: "Deleted",
        icon: MinusCircle,
        bg: "bg-rose-50 dark:bg-rose-950/30",
        text: "text-rose-600",
        border: "border-rose-100 dark:border-rose-900",
    },
    UPDATED: {
        label: "Updated",
        icon: RefreshCw,
        bg: "bg-blue-50 dark:bg-blue-950/30",
        text: "text-blue-600",
        border: "border-blue-100 dark:border-blue-900",
    },
    STATUS_CHANGED: {
        label: "Status Changed",
        icon: RotateCcw,
        bg: "bg-amber-50 dark:bg-amber-950/30",
        text: "text-amber-600",
        border: "border-amber-100 dark:border-amber-900",
    },
};

const ENTITY_CONFIG: Record<EntityKey, { label: string; icon: any; accent: string }> = {
    VOUCHER: {
        label: "Voucher",
        icon: FileText,
        accent: "text-violet-600",
    },
    DEPOSIT: {
        label: "Deposit",
        icon: Wallet,
        accent: "text-teal-600",
    },
};

type FilterEntity = "ALL" | "VOUCHER" | "DEPOSIT";

// ─── Entry Card ───────────────────────────────────────────────────────────────

function AuditEntryCard({ log }: { log: AuditLog }) {
    const [expanded, setExpanded] = useState(false);
    const action = ACTION_CONFIG[log.action as ActionKey] ?? ACTION_CONFIG.UPDATED;
    const entity = ENTITY_CONFIG[log.entity_type as EntityKey];
    const ActionIcon = action.icon;
    const EntityIcon = entity?.icon ?? ClipboardList;

    return (
        <div
            className={`rounded-2xl border ${action.border} ${action.bg} transition-all duration-200`}
        >
            <button
                onClick={() => setExpanded((p) => !p)}
                className="w-full flex items-start gap-3 p-3.5 text-left"
            >
                {/* Action Icon */}
                <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 bg-white dark:bg-zinc-900 border ${action.border} shadow-sm`}>
                    <ActionIcon className={`h-3.5 w-3.5 ${action.text}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        {/* Entity badge */}
                        {entity && (
                            <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest ${entity.accent}`}>
                                <EntityIcon className="h-2.5 w-2.5" />
                                {entity.label}
                            </span>
                        )}
                        {/* Divider */}
                        <span className="text-zinc-200 dark:text-zinc-700">·</span>
                        {/* Action label */}
                        <span className={`text-[9px] font-black uppercase tracking-widest ${action.text}`}>
                            {action.label}
                        </span>
                    </div>

                    {/* Note */}
                    {log.note && (
                        <p className="text-[12px] font-semibold text-zinc-700 dark:text-zinc-300 leading-snug line-clamp-2 pr-2">
                            {log.note}
                        </p>
                    )}

                    {/* Meta */}
                    <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px] font-bold text-zinc-400">{log.changed_by}</span>
                        <span className="text-zinc-200 dark:text-zinc-700 text-[10px]">·</span>
                        <span className="text-[10px] font-medium text-zinc-400" title={formatFullDate(log.changed_at)}>
                            {formatRelativeTime(log.changed_at)}
                        </span>
                    </div>
                </div>

                {/* Expand chevron if there's field-level detail */}
                {(log.field || log.old_value || log.new_value) && (
                    <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 shrink-0 mt-2 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
                )}
            </button>

            {/* Expanded detail */}
            {expanded && (log.field || log.old_value || log.new_value) && (
                <div className="px-3.5 pb-3.5 pt-0 border-t border-current/10 space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                    {log.field && (
                        <div className="flex items-center gap-2 text-[10px]">
                            <span className="font-black text-zinc-400 uppercase tracking-widest w-14 shrink-0">Field</span>
                            <span className="font-bold text-zinc-600 dark:text-zinc-300">{log.field}</span>
                        </div>
                    )}
                    {log.old_value !== null && log.old_value !== undefined && (
                        <div className="flex items-center gap-2 text-[10px]">
                            <span className="font-black text-zinc-400 uppercase tracking-widest w-14 shrink-0">Before</span>
                            <span className="font-mono font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded-md">{log.old_value}</span>
                        </div>
                    )}
                    {log.new_value !== null && log.new_value !== undefined && (
                        <div className="flex items-center gap-2 text-[10px]">
                            <span className="font-black text-zinc-400 uppercase tracking-widest w-14 shrink-0">After</span>
                            <span className="font-mono font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-md">{log.new_value}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-[10px]">
                        <span className="font-black text-zinc-400 uppercase tracking-widest w-14 shrink-0">Time</span>
                        <span className="font-medium text-zinc-500">{formatFullDate(log.changed_at)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Drawer ──────────────────────────────────────────────────────────────

export function FinanceAuditDrawer({ isOpen, onClose, studentId, studentName }: Props) {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<FilterEntity>("ALL");
    const [offset, setOffset] = useState(0);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    const fetchLogs = useCallback(async (sid: number, entityFilter: FilterEntity, newOffset: number, append: boolean) => {
        if (newOffset === 0) setIsLoading(true);
        else setIsLoadingMore(true);
        setError(null);

        try {
            const params: Parameters<typeof auditLogsService.list>[0] = {
                student_id: sid,
                limit: PAGE_SIZE,
                offset: newOffset,
                entity_type: entityFilter !== "ALL" ? entityFilter : "VOUCHER,DEPOSIT",
            };

            const result = await auditLogsService.list(params);
            const incoming = result.data ?? [];
            setLogs((prev) => append ? [...prev, ...incoming] : incoming);
            setTotal(result.total ?? 0);
            setOffset(newOffset + incoming.length);
        } catch (e: any) {
            setError(e?.response?.data?.message ?? "Failed to load finance audit logs.");
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, []);

    // Reset + load when drawer opens or filter/student changes
    useEffect(() => {
        if (!isOpen || !studentId) return;
        setLogs([]);
        setOffset(0);
        fetchLogs(studentId, filter, 0, false);
    }, [isOpen, studentId, filter, fetchLogs]);

    const handleLoadMore = () => {
        if (!studentId || isLoadingMore) return;
        fetchLogs(studentId, filter, offset, true);
    };

    const hasMore = logs.length < total;

    if (!isOpen) return null;

    // ── Overlay (click-outside to close) ─────────────────────────────────
    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[90] bg-black/20 backdrop-blur-[2px] animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Drawer Panel */}
            <div className="fixed right-0 top-0 bottom-0 z-[91] w-full max-w-md flex flex-col bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl animate-in slide-in-from-right duration-300">

                {/* ── Header ───────────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-6 pt-6 pb-5 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center">
                            <ClipboardList className="h-5 w-5 text-violet-600" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none mb-0.5">Finance Audit Log</p>
                            <p className="font-black text-zinc-900 dark:text-zinc-100 text-sm leading-tight truncate max-w-[200px]">
                                {studentName || "Student"}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Refresh */}
                        <button
                            onClick={() => { if (studentId) { setLogs([]); setOffset(0); fetchLogs(studentId, filter, 0, false); } }}
                            disabled={isLoading}
                            className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-all disabled:opacity-40"
                            title="Refresh"
                        >
                            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                        </button>
                        {/* Close */}
                        <button
                            onClick={onClose}
                            className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* ── Filter Pills ──────────────────────────────────────────── */}
                <div className="px-6 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2 shrink-0">
                    {(["ALL", "VOUCHER", "DEPOSIT"] as FilterEntity[]).map((f) => {
                        const isActive = filter === f;
                        const config = f !== "ALL" ? ENTITY_CONFIG[f as EntityKey] : null;
                        const Icon = config?.icon ?? null;
                        return (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                                    isActive
                                        ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-sm"
                                        : "bg-zinc-50 dark:bg-zinc-900 text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                }`}
                            >
                                {Icon && <Icon className="h-3 w-3" />}
                                {f === "ALL" ? "All" : config!.label}
                                {/* Count badge */}
                                {isActive && !isLoading && (
                                    <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[8px] font-black ${
                                        isActive ? "bg-white/20 dark:bg-black/20" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"
                                    }`}>
                                        {total}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* ── Body ─────────────────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3">

                    {/* Loading skeleton */}
                    {isLoading && (
                        <div className="space-y-3">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
                            ))}
                        </div>
                    )}

                    {/* Error */}
                    {!isLoading && error && (
                        <div className="flex flex-col items-center justify-center py-16 gap-4">
                            <div className="h-14 w-14 rounded-3xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center">
                                <AlertCircle className="h-7 w-7 text-rose-400" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Failed to load logs</p>
                                <p className="text-xs text-zinc-400 mt-1">{error}</p>
                            </div>
                            <button
                                onClick={() => { if (studentId) fetchLogs(studentId, filter, 0, false); }}
                                className="px-5 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-80 transition-all"
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {/* No student selected */}
                    {!isLoading && !error && !studentId && (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="h-14 w-14 rounded-3xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
                                <ClipboardList className="h-7 w-7 text-zinc-300" />
                            </div>
                            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest text-center">
                                Select a student to view<br />their finance audit trail
                            </p>
                        </div>
                    )}

                    {/* Empty state */}
                    {!isLoading && !error && studentId && logs.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="h-14 w-14 rounded-3xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
                                <CheckCircle2 className="h-7 w-7 text-zinc-300" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-bold text-zinc-600 dark:text-zinc-400">No audit events found</p>
                                <p className="text-xs text-zinc-400 mt-1">
                                    {filter !== "ALL" ? `No ${filter.toLowerCase()} events recorded.` : "No finance activities recorded for this student yet."}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Log entries */}
                    {!isLoading && logs.length > 0 && (
                        <>
                            {/* Total count badge */}
                            <div className="flex items-center gap-2 pb-1">
                                <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
                                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                                    {total} event{total !== 1 ? "s" : ""}
                                </span>
                                <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
                            </div>

                            {logs.map((log) => (
                                <AuditEntryCard key={log.id} log={log} />
                            ))}

                            {/* Load More */}
                            {hasMore && (
                                <div ref={loadMoreRef} className="pt-2 pb-4">
                                    <button
                                        onClick={handleLoadMore}
                                        disabled={isLoadingMore}
                                        className="w-full h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isLoadingMore ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <>
                                                <ChevronDown className="h-3.5 w-3.5" />
                                                Load {Math.min(PAGE_SIZE, total - logs.length)} more
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* End of log */}
                            {!hasMore && logs.length > 0 && (
                                <div className="flex items-center justify-center gap-2 py-4">
                                    <Clock className="h-3 w-3 text-zinc-300" />
                                    <span className="text-[9px] font-bold text-zinc-300 uppercase tracking-widest">End of audit trail</span>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* ── Footer ───────────────────────────────────────────────── */}
                <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-50/50 dark:bg-zinc-950/50">
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest leading-tight">
                        Showing voucher &amp; deposit events only
                    </p>
                    <kbd className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700 text-[9px] font-bold text-zinc-400 uppercase tracking-tighter shadow-sm">
                        ESC
                    </kbd>
                </div>
            </div>
        </>
    );
}
