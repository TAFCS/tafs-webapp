"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    LayoutDashboard, Loader2, RefreshCw, FileText, AlertTriangle,
    Info, ChevronLeft, ChevronRight, Building2, GraduationCap,
    Users, Banknote, Hash, ArrowRight, AlertCircle,
} from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { useAuthState } from "@/context/AuthContext";
import { useAppSelector } from "@/store/hooks";
import { toggleId, serializeIds } from "@/components/filters/filter-params";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import hrService from "@/lib/hr.service";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FeeHeadItem {
    id: number;
    student_cc: number;
    gr_number: string;
    student_name: string;
    campus: string | null;
    class: string | null;
    section: string | null;
    fee_type: string | null;
    description_prefix: string | null;
    academic_year: string;
    target_month: number;
    term_start_month: number | null;
    period_label: string; // computed on the backend with getMonthYearLabel + termOfHead
    fee_date: string | null;
    status: string | null;
    amount: number | null;
    amount_paid: number | null;
    outstanding: number | null;
}

interface Totals {
    count: number;
    amount: number;
    amount_paid: number;
    outstanding: number;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number | null | undefined) =>
    n == null ? "—" : `Rs. ${Math.round(n).toLocaleString("en-PK")}`;

const STATUS_COLORS: Record<string, string> = {
    NOT_ISSUED: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
    ISSUED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    PARTIALLY_PAID: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    DISCOUNT: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
};

const STATUS_OPTIONS = [
    { id: "NOT_ISSUED", label: "Not Issued" },
    { id: "ISSUED", label: "Issued" },
    { id: "PARTIALLY_PAID", label: "Partially Paid" },
    { id: "PAID", label: "Paid" },
    { id: "DISCOUNT", label: "Discount" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function FeeHeadsReportPage() {
    const { user } = useAuthState();
    const canView =
        user?.role === "SUPER_ADMIN" ||
        user?.permissions?.includes("system.analytics.view");

    const campusLocked = user?.campusId != null;

    // Campus options from Redux — the global campus list is always loaded
    const allCampuses = useAppSelector((s: any) => s.campuses.items) as {
        id: number;
        campus_name: string;
        offered_classes: {
            id: number;
            description: string;
            class_code: string;
            sections: { id: number; description: string }[];
            segment_id?: number;
        }[];
    }[];

    // Segments fetched from API (no Redux slice for segments)
    const [segments, setSegments] = useState<{ id: number; code: string; name: string; display_order: number }[]>([]);
    useEffect(() => {
        hrService.listSegments().then(setSegments).catch(() => { /* non-critical */ });
    }, []);

    // ── Filters ──────────────────────────────────────────────────────────────
    const [campusIds, setCampusIds] = useState<number[]>(
        campusLocked && user?.campusId != null ? [user.campusId] : [],
    );
    const [classIds, setClassIds] = useState<number[]>([]);
    const [sectionIds, setSectionIds] = useState<number[]>([]);
    const [segmentIds, setSegmentIds] = useState<number[]>([]);
    const [statusFilter, setStatusFilter] = useState<string[]>([]);
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [page, setPage] = useState(1);
    const LIMIT = 50;

    // ── Data ─────────────────────────────────────────────────────────────────
    const [items, setItems] = useState<FeeHeadItem[]>([]);
    const [totals, setTotals] = useState<Totals | null>(null);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [loading, setLoading] = useState(false);

    // ── Derived options ───────────────────────────────────────────────────────
    // Campus options (hidden when campusLocked)
    const campusOptions = allCampuses.map((c) => ({ id: c.id, label: c.campus_name }));

    // Classes across ALL selected campuses (multi-campus = union of classes)
    const visibleCampuses = campusIds.length > 0
        ? allCampuses.filter((c) => campusIds.includes(c.id))
        : allCampuses;
    const classOptions = visibleCampuses
        .flatMap((c) => c.offered_classes ?? [])
        // deduplicate by class id in case the same class appears in multiple campuses
        .filter((cls, idx, arr) => arr.findIndex((x) => x.id === cls.id) === idx)
        .map((c) => ({
            id: c.id,
            label: c.class_code ? `${c.class_code} — ${c.description}` : c.description,
        }));

    // Sections across ALL selected classes
    const visibleClasses = visibleCampuses
        .flatMap((c) => c.offered_classes ?? [])
        .filter((cls) => classIds.length === 0 || classIds.includes(cls.id));
    const sectionOptions = visibleClasses
        .flatMap((cls) => cls.sections ?? [])
        .filter((s, idx, arr) => arr.findIndex((x) => x.id === s.id) === idx)
        .map((s) => ({ id: s.id, label: s.description }));

    const segmentOptions = [...segments]
        .sort((a, b) => a.display_order - b.display_order)
        .map((s) => ({ id: s.id, label: `${s.code} — ${s.name}` }));

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const fetchData = useCallback(async (pg: number) => {
        if (!canView) return;
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (fromDate) params.set("from", fromDate);
            if (toDate) params.set("to", toDate);
            const csvCampus = serializeIds(campusIds);
            if (csvCampus) params.set("campus_id", csvCampus);
            const csvClass = serializeIds(classIds);
            if (csvClass) params.set("class_id", csvClass);
            const csvSection = serializeIds(sectionIds);
            if (csvSection) params.set("section_id", csvSection);
            const csvSegment = serializeIds(segmentIds);
            if (csvSegment) params.set("segment_id", csvSegment);
            if (statusFilter.length) params.set("status", statusFilter.join(","));
            params.set("page", String(pg));
            params.set("limit", String(LIMIT));

            const { data } = await api.get(`/v1/financial-reports/fee-heads?${params}`);
            if (data.status === 200) {
                setItems(data.data.items);
                setTotals(data.data.totals);
                setPagination(data.data.pagination);
            }
        } catch {
            toast.error("Failed to load fee heads report");
        } finally {
            setLoading(false);
        }
    }, [canView, fromDate, toDate, campusIds, classIds, sectionIds, segmentIds, statusFilter]);

    // Filter changes → reset to page 1
    useEffect(() => { setPage(1); fetchData(1); }, [fromDate, toDate, campusIds, classIds, sectionIds, segmentIds, statusFilter]);
    const handlePageChange = (newPage: number) => { setPage(newPage); fetchData(newPage); };

    if (!canView) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
                <LayoutDashboard className="h-12 w-12 text-zinc-300 mb-4" />
                <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Access Restricted</h2>
                <p className="text-zinc-500 mt-2 max-w-md">You do not have permission to view financial reports.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">
                        <Link href="/financial-reports" className="hover:text-primary transition-colors">Financial Reports</Link>
                        <span>/</span>
                        <span className="text-zinc-600 dark:text-zinc-300">Fee Heads</span>
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 font-outfit">
                        Fee Heads Report
                    </h1>
                    <p className="text-sm text-zinc-500 mt-1">
                        Accrual basis — what was billed, grouped by <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded text-xs">fee_date</code>
                    </p>
                </div>
                <button
                    onClick={() => fetchData(page)}
                    disabled={loading}
                    className="h-10 px-4 flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-500 hover:text-primary transition-all text-sm font-medium disabled:opacity-50 shrink-0"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                </button>
            </div>

            {/* LPS Cross-link — persistent, not dismissible */}
            <div className="flex items-start gap-3 px-4 py-3 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20">
                <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-300">
                    Late payment surcharges are excluded from this report. For LPS figures, see{" "}
                    <Link href="/financial-reports/deposits" className="font-bold underline underline-offset-2 hover:text-amber-600 transition-colors">
                        Deposit Reports
                    </Link>
                    .
                </p>
            </div>

            {/* Filters */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Filters</p>

                {/* Date range */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[10px] font-bold text-zinc-500 mb-1.5">From (fee_date)</label>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="w-full h-10 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-primary transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-zinc-500 mb-1.5">To (fee_date)</label>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="w-full h-10 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-primary transition-all"
                        />
                    </div>
                </div>

                {/* Scope filters — all multi-select */}
                <div className={`grid gap-3 ${campusLocked ? "grid-cols-3" : "grid-cols-4"}`}>
                    {!campusLocked && (
                        <FilterDropdown
                            label="Campus"
                            icon={Building2}
                            value={campusIds}
                            options={campusOptions}
                            placeholder="All campuses"
                            onToggle={(id) => {
                                setCampusIds((p) => toggleId(p, id));
                                // Don't auto-clear class/section — let user pick freely
                                // Only clear selections that are no longer available
                            }}
                            onClear={() => { setCampusIds([]); setClassIds([]); setSectionIds([]); }}
                        />
                    )}
                    <FilterDropdown
                        label="Class"
                        icon={GraduationCap}
                        value={classIds}
                        options={classOptions}
                        placeholder="All classes"
                        onToggle={(id) => {
                            setClassIds((p) => toggleId(p, id));
                        }}
                        onClear={() => { setClassIds([]); setSectionIds([]); }}
                    />
                    <FilterDropdown
                        label="Section"
                        icon={Users}
                        value={sectionIds}
                        options={sectionOptions}
                        placeholder="All sections"
                        onToggle={(id) => setSectionIds((p) => toggleId(p, id))}
                        onClear={() => setSectionIds([])}
                    />
                    <FilterDropdown
                        label="Segment"
                        icon={Hash}
                        value={segmentIds}
                        options={segmentOptions}
                        placeholder="All segments"
                        onToggle={(id) => setSegmentIds((p) => toggleId(p, id))}
                        onClear={() => setSegmentIds([])}
                    />
                </div>

                {/* Status — multi-select pill buttons */}
                <div>
                    <p className="text-[10px] font-bold text-zinc-500 mb-2">Status</p>
                    <div className="flex flex-wrap gap-2">
                        {STATUS_OPTIONS.map((s) => {
                            const active = statusFilter.includes(s.id);
                            return (
                                <button
                                    key={s.id}
                                    onClick={() =>
                                        setStatusFilter((p) =>
                                            p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id],
                                        )
                                    }
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${active
                                        ? "border-primary bg-primary/10 text-primary"
                                        : "border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-300"
                                        }`}
                                >
                                    {s.label}
                                </button>
                            );
                        })}
                        {statusFilter.length > 0 && (
                            <button
                                onClick={() => setStatusFilter([])}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-600"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    {statusFilter.includes("NOT_ISSUED") && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1.5">
                            <AlertCircle className="h-3 w-3" />
                            NOT_ISSUED heads are scheduled but not yet billed — including them inflates the expected total relative to what&apos;s actually gone out on a voucher.
                        </p>
                    )}
                </div>
            </div>

            {/* Totals tiles */}
            {totals && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-4"
                >
                    {[
                        { label: "Total Billed (Amount)", value: fmt(totals.amount), icon: FileText, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-900/10" },
                        { label: "Collected (amount_paid)", value: fmt(totals.amount_paid), icon: Banknote, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/10" },
                        { label: "Outstanding", value: fmt(totals.outstanding), icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/10" },
                        { label: "Fee Head Rows", value: totals.count.toLocaleString(), icon: Hash, color: "text-zinc-600", bg: "bg-zinc-50 dark:bg-zinc-900/10" },
                    ].map((t) => (
                        <div key={t.label} className={`${t.bg} rounded-2xl border border-zinc-100 dark:border-zinc-800 p-4`}>
                            <t.icon className={`h-5 w-5 ${t.color} mb-3`} />
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t.label}</p>
                            <p className="text-xl font-black text-zinc-800 dark:text-zinc-100 mt-1">{t.value}</p>
                        </div>
                    ))}
                </motion.div>
            )}

            {/* Table */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
                {loading && items.length === 0 ? (
                    <div className="flex items-center justify-center h-48">
                        <Loader2 className="h-6 w-6 animate-spin text-primary opacity-50" />
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-center">
                        <FileText className="h-8 w-8 text-zinc-300 mb-3" />
                        <p className="text-sm font-bold text-zinc-500">No fee heads found</p>
                        <p className="text-xs text-zinc-400 mt-1">Adjust your filters or date range</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                                <tr>
                                    {["CC", "GR", "Student", "Campus", "Class", "Section", "Fee Type", "Period", "Fee Date", "Status", "Amount", "Paid", "Outstanding"].map(
                                        (h) => (
                                            <th
                                                key={h}
                                                className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400 whitespace-nowrap"
                                            >
                                                {h}
                                            </th>
                                        ),
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                {items.map((item) => (
                                    <tr
                                        key={item.id}
                                        className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors"
                                    >
                                        <td className="px-3 py-2.5 font-mono font-bold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{item.student_cc}</td>
                                        <td className="px-3 py-2.5 text-zinc-500 whitespace-nowrap">{item.gr_number}</td>
                                        <td className="px-3 py-2.5 font-medium text-zinc-800 dark:text-zinc-100 whitespace-nowrap max-w-[180px] truncate">{item.student_name}</td>
                                        <td className="px-3 py-2.5 text-zinc-500 whitespace-nowrap">{item.campus ?? "—"}</td>
                                        <td className="px-3 py-2.5 text-zinc-500 whitespace-nowrap">{item.class ?? "—"}</td>
                                        <td className="px-3 py-2.5 text-zinc-500 whitespace-nowrap">{item.section ?? "—"}</td>
                                        <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-300 whitespace-nowrap max-w-[160px] truncate">
                                            {item.description_prefix ? (
                                                <span className="text-zinc-400">{item.description_prefix} </span>
                                            ) : null}
                                            {item.fee_type ?? "—"}
                                        </td>
                                        {/* Period: use the correctly-computed label from the backend */}
                                        <td className="px-3 py-2.5 text-zinc-500 whitespace-nowrap">{item.period_label}</td>
                                        <td className="px-3 py-2.5 text-zinc-500 whitespace-nowrap">
                                            {item.fee_date ? new Date(item.fee_date).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                                        </td>
                                        <td className="px-3 py-2.5 whitespace-nowrap">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${STATUS_COLORS[item.status ?? ""] ?? "bg-zinc-100 text-zinc-500"}`}>
                                                {item.status?.replace(/_/g, " ") ?? "—"}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 font-mono text-right text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{fmt(item.amount)}</td>
                                        <td className="px-3 py-2.5 font-mono text-right text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{fmt(item.amount_paid)}</td>
                                        <td className="px-3 py-2.5 font-mono text-right whitespace-nowrap">
                                            <span className={item.outstanding && item.outstanding > 0 ? "text-amber-600 font-bold" : "text-zinc-400"}>
                                                {fmt(item.outstanding)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {pagination && pagination.pages > 1 && (
                    <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                        <p className="text-xs text-zinc-500">
                            Page {pagination.page} of {pagination.pages} &mdash; {pagination.total.toLocaleString()} total rows
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={!pagination.hasPrev || loading}
                                onClick={() => handlePageChange(page - 1)}
                                className="h-8 w-8 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-primary disabled:opacity-40 transition-all"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                                disabled={!pagination.hasNext || loading}
                                onClick={() => handlePageChange(page + 1)}
                                className="h-8 w-8 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-primary disabled:opacity-40 transition-all"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer note */}
            <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>
                    Totals reflect the <strong>entire filtered set</strong>, not just the current page. Discount memo rows and legacy LPS rows are excluded.
                    For LPS and late fee figures:{" "}
                    <Link href="/financial-reports/deposits" className="text-primary font-bold hover:underline inline-flex items-center gap-0.5">
                        Deposit Reports <ArrowRight className="h-3 w-3" />
                    </Link>
                </span>
            </div>
        </div>
    );
}
