"use client";

import { useState, useEffect, useRef } from "react";
import api from "@/lib/api";
import {
    Pin, Trash2, Plus, X, Eye, Calendar, Loader2, Megaphone,
    Users, BarChart2, CheckCircle2, RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ─── Types ──────────────────────────────────────────────────────────────────

type StaffRole =
    | "SUPER_ADMIN" | "CAMPUS_ADMIN" | "PRINCIPAL" | "FINANCE_CLERK"
    | "RECEPTIONIST" | "TEACHER" | "STAFF_EDITOR" | "GENERAL_RESPONDENT" | "EMPLOYEE";

const ALL_ROLES: StaffRole[] = [
    "EMPLOYEE", "TEACHER", "FINANCE_CLERK", "RECEPTIONIST",
    "PRINCIPAL", "CAMPUS_ADMIN", "STAFF_EDITOR", "GENERAL_RESPONDENT", "SUPER_ADMIN",
];

const ROLE_LABELS: Record<StaffRole, string> = {
    EMPLOYEE: "Employee",
    TEACHER: "Teacher",
    FINANCE_CLERK: "Finance Clerk",
    RECEPTIONIST: "Receptionist",
    PRINCIPAL: "Principal",
    CAMPUS_ADMIN: "Campus Admin",
    STAFF_EDITOR: "Staff Editor",
    GENERAL_RESPONDENT: "Respondent",
    SUPER_ADMIN: "Super Admin",
};

interface EmployeeNotice {
    id: number;
    title: string | null;
    body: string;
    target_roles: StaffRole[];
    campus_ids: number[];
    media_urls: string[];
    media_types: string[];
    is_pinned: boolean;
    posted_at: string;
    expires_at: string | null;
    deleted_at: string | null;
    users: { full_name: string };
    _count: { post_reads: number };
    total_reached: number;
}

interface Campus {
    id: number;
    campus_name: string;
}

type PanelMode = "list" | "compose" | "stats";

// ─── Component ───────────────────────────────────────────────────────────────

export default function EmployeeNoticesPage() {
    const [notices, setNotices] = useState<EmployeeNotice[]>([]);
    const [loading, setLoading] = useState(true);
    const [campuses, setCampuses] = useState<Campus[]>([]);
    const [panelMode, setPanelMode] = useState<PanelMode>("list");
    const [selectedNotice, setSelectedNotice] = useState<EmployeeNotice | null>(null);

    // ── Compose state ──
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [selectedRoles, setSelectedRoles] = useState<StaffRole[]>([]);   // empty = all
    const [selectedCampusIds, setSelectedCampusIds] = useState<number[]>([]); // empty = all
    const [isPinned, setIsPinned] = useState(false);
    const [expiresAt, setExpiresAt] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // ── Edit state ──
    const [editingId, setEditingId] = useState<number | null>(null);

    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchNotices();
        fetchCampuses();
    }, []);

    async function fetchNotices() {
        setLoading(true);
        try {
            const res = await api.get("v1/admin/employee-notices");
            setNotices(Array.isArray(res.data) ? res.data : res.data?.data ?? []);
        } finally {
            setLoading(false);
        }
    }

    async function fetchCampuses() {
        try {
            const res = await api.get("v1/campuses");
            setCampuses(Array.isArray(res.data) ? res.data : res.data?.data ?? []);
        } catch { }
    }

    // ── Compose helpers ───────────────────────────────────────────────────────

    function resetCompose() {
        setTitle(""); setBody(""); setSelectedRoles([]); setSelectedCampusIds([]);
        setIsPinned(false); setExpiresAt(""); setEditingId(null);
    }

    function openCompose(notice?: EmployeeNotice) {
        if (notice) {
            setEditingId(notice.id);
            setTitle(notice.title ?? "");
            setBody(notice.body);
            setSelectedRoles(notice.target_roles);
            setSelectedCampusIds(notice.campus_ids);
            setIsPinned(notice.is_pinned);
            setExpiresAt(notice.expires_at ? notice.expires_at.slice(0, 16) : "");
        } else {
            resetCompose();
        }
        setPanelMode("compose");
    }

    function toggleRole(role: StaffRole) {
        setSelectedRoles(prev =>
            prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
        );
    }

    function toggleCampus(id: number) {
        setSelectedCampusIds(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    }

    async function handleSubmit() {
        if (!body.trim()) return;
        setSubmitting(true);
        try {
            const payload = {
                title: title.trim() || undefined,
                body: body.trim(),
                target_roles: selectedRoles,
                campus_ids: selectedCampusIds,
                is_pinned: isPinned,
                expires_at: expiresAt || undefined,
            };
            if (editingId != null) {
                const res = await api.patch(`v1/admin/employee-notices/${editingId}`, payload);
                setNotices(prev => prev.map(n => n.id === editingId ? { ...n, ...res.data } : n));
            } else {
                const res = await api.post("v1/admin/employee-notices", payload);
                setNotices(prev => [res.data, ...prev]);
            }
            resetCompose();
            setPanelMode("list");
        } finally {
            setSubmitting(false);
        }
    }

    async function togglePin(notice: EmployeeNotice) {
        const next = !notice.is_pinned;
        await api.patch(`v1/admin/employee-notices/${notice.id}`, { is_pinned: next });
        setNotices(prev => prev.map(n => n.id === notice.id ? { ...n, is_pinned: next } : n));
        setSelectedNotice(prev => prev?.id === notice.id ? { ...prev, is_pinned: next } : prev);
    }

    async function deleteNotice(notice: EmployeeNotice) {
        if (!confirm(`Delete "${notice.title || "this notice"}"?`)) return;
        await api.delete(`v1/admin/employee-notices/${notice.id}`);
        setNotices(prev => prev.filter(n => n.id !== notice.id));
        if (selectedNotice?.id === notice.id) setPanelMode("list");
    }

    // ── Scope labels ──────────────────────────────────────────────────────────

    function roleLabel(notice: EmployeeNotice) {
        if (!notice.target_roles.length) return "All Roles";
        return notice.target_roles.map(r => ROLE_LABELS[r] ?? r).join(", ");
    }

    function campusLabel(notice: EmployeeNotice) {
        if (!notice.campus_ids.length) return "All Campuses";
        return campuses
            .filter(c => notice.campus_ids.includes(c.id))
            .map(c => c.campus_name)
            .join(", ") || "Selected Campuses";
    }

    function composeScopeLabel() {
        const rolePart = selectedRoles.length
            ? selectedRoles.map(r => ROLE_LABELS[r]).join(", ")
            : "All roles";
        const campusPart = selectedCampusIds.length
            ? campuses.filter(c => selectedCampusIds.includes(c.id)).map(c => c.campus_name).join(", ")
            : "all campuses";
        return `${rolePart} · ${campusPart}`;
    }

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="h-[calc(100vh-160px)] flex gap-6">

            {/* ── Left: notice list ── */}
            <div className="w-80 flex-shrink-0 flex flex-col bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Megaphone className="h-4 w-4 text-amber-500" />
                        <span className="font-bold text-zinc-800 dark:text-zinc-100 text-sm">Employee Notices</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={fetchNotices}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                        <button
                            onClick={() => { resetCompose(); setPanelMode("compose"); }}
                            className="flex items-center gap-1.5 text-xs font-semibold bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors"
                        >
                            <Plus className="h-3.5 w-3.5" /> New
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                        </div>
                    ) : notices.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-400">
                            <Megaphone className="h-8 w-8 opacity-30" />
                            <p className="text-sm">No notices yet.</p>
                        </div>
                    ) : notices.map(notice => (
                        <div
                            key={notice.id}
                            onClick={() => { setSelectedNotice(notice); setPanelMode("stats"); }}
                            className={`p-4 border-b border-zinc-100 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors ${selectedNotice?.id === notice.id ? "bg-zinc-50 dark:bg-zinc-900" : ""}`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                        {notice.is_pinned && <Pin className="h-3 w-3 text-amber-500 flex-shrink-0" />}
                                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-full px-2 py-0.5 truncate max-w-[140px]">
                                            {roleLabel(notice)}
                                        </span>
                                    </div>
                                    {notice.title && <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100 truncate">{notice.title}</p>}
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-0.5">{notice.body}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1 flex-shrink-0 text-xs text-zinc-400">
                                    <span>{formatDistanceToNow(new Date(notice.posted_at), { addSuffix: true })}</span>
                                    <span className="flex items-center gap-1">
                                        <CheckCircle2 className="h-3 w-3" />
                                        {notice._count?.post_reads ?? 0}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Right: compose / stats panel ── */}
            <div className="flex-1 bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col">

                {/* Empty state */}
                {panelMode === "list" && (
                    <div className="flex-1 flex items-center justify-center flex-col gap-4 text-zinc-400">
                        <Eye className="h-12 w-12 opacity-20" />
                        <p className="text-sm">Select a notice to view details, or create a new one.</p>
                    </div>
                )}

                {/* ── Compose / Edit ── */}
                {panelMode === "compose" && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Megaphone className="h-4 w-4 text-amber-500" />
                                <span className="font-bold text-zinc-800 dark:text-zinc-100">
                                    {editingId != null ? "Edit Notice" : "New Employee Notice"}
                                </span>
                            </div>
                            <button onClick={() => { resetCompose(); setPanelMode("list"); }} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">

                            {/* 1. Content */}
                            <div className="flex flex-col gap-3">
                                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Content</p>
                                <input
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="Title (optional)"
                                    className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-semibold bg-transparent focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                                />
                                <textarea
                                    value={body}
                                    onChange={e => setBody(e.target.value)}
                                    placeholder="Write your notice here…"
                                    rows={5}
                                    className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none"
                                />
                            </div>

                            {/* 2. Target Roles */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Target Roles</p>
                                    <button
                                        onClick={() => setSelectedRoles(prev => prev.length === ALL_ROLES.length ? [] : [...ALL_ROLES])}
                                        className="text-xs text-amber-600 dark:text-amber-400 font-medium hover:underline"
                                    >
                                        {selectedRoles.length === ALL_ROLES.length ? "Clear all" : "Select all"}
                                    </button>
                                </div>
                                <p className="text-xs text-zinc-400 mb-2">Leave empty to target all roles.</p>
                                <div className="flex flex-wrap gap-2">
                                    {ALL_ROLES.map(role => (
                                        <button
                                            key={role}
                                            onClick={() => toggleRole(role)}
                                            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${selectedRoles.includes(role)
                                                ? "bg-amber-500 text-white border-amber-500"
                                                : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-amber-400"
                                                }`}
                                        >
                                            {ROLE_LABELS[role]}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 3. Campus */}
                            {campuses.length > 0 && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Campus</p>
                                        {selectedCampusIds.length > 0 && (
                                            <button
                                                onClick={() => setSelectedCampusIds([])}
                                                className="text-xs text-amber-600 dark:text-amber-400 font-medium hover:underline"
                                            >
                                                All campuses
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-xs text-zinc-400 mb-2">Leave empty to target all campuses.</p>
                                    <div className="flex flex-wrap gap-2">
                                        {campuses.map(c => (
                                            <button
                                                key={c.id}
                                                onClick={() => toggleCampus(c.id)}
                                                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${selectedCampusIds.includes(c.id)
                                                    ? "bg-amber-500 text-white border-amber-500"
                                                    : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-amber-400"
                                                    }`}
                                            >
                                                {c.campus_name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 4. Options */}
                            <div className="flex items-center gap-6 flex-wrap">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isPinned}
                                        onChange={e => setIsPinned(e.target.checked)}
                                        className="rounded accent-amber-500"
                                    />
                                    <Pin className="h-3.5 w-3.5 text-amber-500" />
                                    <span className="text-sm text-zinc-600 dark:text-zinc-400">Pin notice</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                                    <span className="text-sm text-zinc-600 dark:text-zinc-400">Expires</span>
                                    <input
                                        type="datetime-local"
                                        value={expiresAt}
                                        onChange={e => setExpiresAt(e.target.value)}
                                        className="text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 bg-transparent focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                                    />
                                </label>
                            </div>

                            {/* Live scope preview */}
                            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-xl px-4 py-3">
                                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                    <Users className="h-3.5 w-3.5" />
                                    Visible to: {composeScopeLabel()}
                                </p>
                            </div>
                        </div>

                        <div className="p-5 border-t border-zinc-100 dark:border-zinc-800">
                            <button
                                onClick={handleSubmit}
                                disabled={submitting || !body.trim()}
                                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                            >
                                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                {editingId != null ? "Save Changes" : "Post Notice"}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Stats / detail panel ── */}
                {panelMode === "stats" && selectedNotice && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <BarChart2 className="h-5 w-5 text-amber-500" />
                                <span className="font-bold text-zinc-800 dark:text-zinc-100">Notice Details</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => openCompose(selectedNotice)}
                                    className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors text-xs font-medium flex items-center gap-1"
                                    title="Edit"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => togglePin(selectedNotice)}
                                    className={`p-2 rounded-lg transition-colors ${selectedNotice.is_pinned ? "bg-amber-50 dark:bg-amber-950/30 text-amber-500" : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                                    title={selectedNotice.is_pinned ? "Unpin" : "Pin"}
                                >
                                    <Pin className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => deleteNotice(selectedNotice)}
                                    className="p-2 rounded-lg text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 transition-colors"
                                    title="Delete"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
                            {/* Notice preview */}
                            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-4">
                                <div className="flex flex-wrap items-center gap-2 mb-3">
                                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-full px-2.5 py-0.5">
                                        {roleLabel(selectedNotice)}
                                    </span>
                                    <span className="text-xs font-semibold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 rounded-full px-2.5 py-0.5">
                                        {campusLabel(selectedNotice)}
                                    </span>
                                    {selectedNotice.is_pinned && (
                                        <span className="text-xs font-bold text-amber-500 bg-amber-50 dark:bg-amber-950/40 rounded-full px-2.5 py-0.5 flex items-center gap-1">
                                            <Pin className="h-3 w-3" />Pinned
                                        </span>
                                    )}
                                </div>
                                {selectedNotice.title && <p className="font-bold text-zinc-800 dark:text-zinc-100 mb-1">{selectedNotice.title}</p>}
                                <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">{selectedNotice.body}</p>
                                <p className="text-xs text-zinc-400 mt-3">
                                    Posted by {selectedNotice.users.full_name} · {formatDistanceToNow(new Date(selectedNotice.posted_at), { addSuffix: true })}
                                    {selectedNotice.expires_at && ` · Expires ${formatDistanceToNow(new Date(selectedNotice.expires_at), { addSuffix: true })}`}
                                </p>
                            </div>

                            {/* Read stats */}
                            <div>
                                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Delivery Analytics</p>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-4 text-center">
                                        <p className="text-2xl font-black text-zinc-800 dark:text-zinc-100">{selectedNotice.total_reached}</p>
                                        <p className="text-xs text-zinc-400 mt-1">Staff Reached</p>
                                    </div>
                                    <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-4 text-center">
                                        <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{selectedNotice._count?.post_reads ?? 0}</p>
                                        <p className="text-xs text-zinc-400 mt-1">Staff Read</p>
                                    </div>
                                </div>
                                {selectedNotice.total_reached > 0 && (
                                    <div>
                                        <div className="flex justify-between text-xs text-zinc-500 mb-1">
                                            <span>Read rate</span>
                                            <span>{Math.round(((selectedNotice._count?.post_reads ?? 0) / selectedNotice.total_reached) * 100)}%</span>
                                        </div>
                                        <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-amber-500 rounded-full transition-all duration-700"
                                                style={{ width: `${Math.round(((selectedNotice._count?.post_reads ?? 0) / selectedNotice.total_reached) * 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
