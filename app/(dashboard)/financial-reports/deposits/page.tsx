"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    LayoutDashboard, Loader2, RefreshCw, Banknote, AlertTriangle,
    Info, ChevronLeft, ChevronRight, Building2, GraduationCap,
    Users, Hash, CheckCircle2, AlertCircle, ArrowLeft,
} from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { useAuthState } from "@/context/AuthContext";
import { useAppSelector } from "@/store/hooks";
import { toggleId, serializeIds } from "@/components/filters/filter-params";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import hrService from "@/lib/hr.service";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DepositItem {
    id: number;
    deposit_date: string;
    student_cc: number;
    gr_number: string;
    student_name: string;
    campus: string | null;
    class: string | null;
    section: string | null;
    payment_method: string | null;
    bank_name: string | null;
    reference_number: string | null;
    total_amount: number;
    allocations: Record<string, number>;
}

interface DepositTotals {
    count: number;
    total_banked: number;
    allocation_by_type: {
        FEE_HEAD: number;
        LATE_FEE: number;
        SURCHARGE: number;
        [key: string]: number;
    };
    total_allocated: number;
    reconciliation_gap: number;
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

const PAYMENT_METHOD_LABELS: Record<string, string> = {
    CASH: "Cash",
    CHEQUE: "Cheque",
    ONLINE: "Online Transfer",
    POSTDATED_CHEQUE: "Post-dated Cheque",
    MEEZAN: "Meezan",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function DepositsReportPage() {
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
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("");
    const [bankName, setBankName] = useState("");
    const [page, setPage] = useState(1);
    const LIMIT = 50;

    // ── Data ─────────────────────────────────────────────────────────────────
    const [items, setItems] = useState<DepositItem[]>([]);
    const [totals, setTotals] = useState<DepositTotals | null>(null);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [loading, setLoading] = useState(false);

    // ── Derived options ───────────────────────────────────────────────────────
    const campusOptions = allCampuses.map((c) => ({ id: c.id, label: c.campus_name }));

    // Classes across ALL selected campuses (multi-campus = union of classes)
    const visibleCampuses = campusIds.length > 0
        ? allCampuses.filter((c) => campusIds.includes(c.id))
        : allCampuses;
    const classOptions = visibleCampuses
        .flatMap((c) => c.offered_classes ?? [])
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
            if (paymentMethod) params.set("payment_method", paymentMethod);
            if (bankName) params.set("bank_name", bankName);
            params.set("page", String(pg));
            params.set("limit", String(LIMIT));

            const { data } = await api.get(`/v1/financial-reports/deposits?${params}`);
            if (data.status === 200) {
                setItems(data.data.items);
                setTotals(data.data.totals);
                setPagination(data.data.pagination);
            }
        } catch {
            toast.error("Failed to load deposits report");
        } finally {
            setLoading(false);
        }
    }, [canView, fromDate, toDate, campusIds, classIds, sectionIds, segmentIds, paymentMethod, bankName]);

    // Filter changes → reset to page 1
    useEffect(() => { setPage(1); fetchData(1); }, [fromDate, toDate, campusIds, classIds, sectionIds, segmentIds, paymentMethod, bankName]);
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

    const gap = totals?.reconciliation_gap ?? 0;
    const hasReconciliationIssue = Math.abs(gap) > 0.01;

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">
                        <Link href="/financial-reports" className="hover:text-primary transition-colors">Financial Reports</Link>
                        <span>/</span>
                        <span className="text-zinc-600 dark:text-zinc-300">Deposits</span>
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 font-outfit">
                        Deposits Report
                    </h1>
                    <p className="text-sm text-zinc-500 mt-1">
                        Cash basis — what was actually banked, keyed on <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded text-xs">deposit_date</code>
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href="/financial-reports/fee-heads"
                        className="h-10 px-4 flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-500 hover:text-primary transition-all text-sm font-medium"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Fee Heads
                    </Link>
                    <button
                        onClick={() => fetchData(page)}
                        disabled={loading}
                        className="h-10 px-4 flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-500 hover:text-primary transition-all text-sm font-medium disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Filters</p>

                {/* Date range + payment method + bank name */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                        <label className="block text-[10px] font-bold text-zinc-500 mb-1.5">From (deposit_date)</label>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="w-full h-10 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-primary transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-zinc-500 mb-1.5">To (deposit_date)</label>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="w-full h-10 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-primary transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-zinc-500 mb-1.5">Payment Method</label>
                        <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            className="w-full h-10 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-primary transition-all"
                        >
                            <option value="">All methods</option>
                            {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-zinc-500 mb-1.5">Bank Name</label>
                        <input
                            type="text"
                            placeholder="Search bank..."
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
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
                            onToggle={(id) => setCampusIds((p) => toggleId(p, id))}
                            onClear={() => { setCampusIds([]); setClassIds([]); setSectionIds([]); }}
                        />
                    )}
                    <FilterDropdown
                        label="Class"
                        icon={GraduationCap}
                        value={classIds}
                        options={classOptions}
                        placeholder="All classes"
                        onToggle={(id) => setClassIds((p) => toggleId(p, id))}
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
            </div>

            {/* Totals */}
            {totals && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                >
                    {/* Cash banked + reconciliation */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 p-5">
                            <Banknote className="h-5 w-5 text-emerald-600 mb-3" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Cash Banked</p>
                            <p className="text-2xl font-black text-zinc-800 dark:text-zinc-100 mt-1">{fmt(totals.total_banked)}</p>
                            <p className="text-xs text-zinc-400 mt-1">{totals.count.toLocaleString()} deposit{totals.count !== 1 ? "s" : ""}</p>
                        </div>

                        <div className={`rounded-2xl border p-5 ${hasReconciliationIssue ? "border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20" : "border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30"}`}>
                            {hasReconciliationIssue ? (
                                <AlertCircle className="h-5 w-5 text-red-600 mb-3" />
                            ) : (
                                <CheckCircle2 className="h-5 w-5 text-emerald-600 mb-3" />
                            )}
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Reconciliation</p>
                            <div className="mt-2 space-y-1 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Total banked</span>
                                    <span className="font-bold font-mono">{fmt(totals.total_banked)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Total allocated</span>
                                    <span className="font-bold font-mono">{fmt(totals.total_allocated)}</span>
                                </div>
                                <div className={`flex justify-between border-t pt-1 ${hasReconciliationIssue ? "border-red-200 dark:border-red-800" : "border-zinc-200 dark:border-zinc-700"}`}>
                                    <span className="font-bold text-zinc-600 dark:text-zinc-300">Gap</span>
                                    <span className={`font-black font-mono ${hasReconciliationIssue ? "text-red-600" : "text-emerald-600"}`}>
                                        {fmt(gap)}
                                    </span>
                                </div>
                            </div>
                            {hasReconciliationIssue && (
                                <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                                    ⚠ Banked ≠ Allocated — data integrity issue. This is not a rounding artifact.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Allocation breakdown — three tiles: FEE_HEAD / LATE_FEE / SURCHARGE */}
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            {
                                type: "FEE_HEAD",
                                label: "Fee Heads",
                                description: "Regular fee head payments",
                                color: "text-violet-600",
                                bg: "bg-violet-50 dark:bg-violet-900/10",
                                border: "border-violet-100 dark:border-violet-900/30",
                            },
                            {
                                type: "LATE_FEE",
                                label: "Late Fee (Rs. 1,000 flat)",
                                description: "Flat late fee per voucher",
                                color: "text-amber-600",
                                bg: "bg-amber-50 dark:bg-amber-900/10",
                                border: "border-amber-100 dark:border-amber-900/30",
                                isLps: true,
                            },
                            {
                                type: "SURCHARGE",
                                label: "Arrear Surcharge",
                                description: "Per-arrear-month late penalty",
                                color: "text-red-600",
                                bg: "bg-red-50 dark:bg-red-900/10",
                                border: "border-red-100 dark:border-red-900/30",
                                isLps: true,
                            },
                        ].map((t) => (
                            <div key={t.type} className={`${t.bg} rounded-2xl border ${t.border} p-4`}>
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t.label}</p>
                                {t.isLps && (
                                    <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">LPS</span>
                                )}
                                <p className={`text-xl font-black mt-2 ${t.color}`}>
                                    {fmt(totals.allocation_by_type[t.type] ?? 0)}
                                </p>
                                <p className="text-[10px] text-zinc-400 mt-0.5">{t.description}</p>
                            </div>
                        ))}
                    </div>

                    {/* Combined LPS callout */}
                    {(totals.allocation_by_type.LATE_FEE > 0 || totals.allocation_by_type.SURCHARGE > 0) && (
                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20">
                            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                            <div className="flex-1 text-xs text-amber-800 dark:text-amber-300">
                                <span className="font-bold">Combined LPS collected: </span>
                                {fmt((totals.allocation_by_type.LATE_FEE ?? 0) + (totals.allocation_by_type.SURCHARGE ?? 0))}
                                <span className="text-amber-600"> (Late Fee + Arrear Surcharge)</span>
                            </div>
                        </div>
                    )}
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
                        <Banknote className="h-8 w-8 text-zinc-300 mb-3" />
                        <p className="text-sm font-bold text-zinc-500">No deposits found</p>
                        <p className="text-xs text-zinc-400 mt-1">Adjust your filters or date range</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                                <tr>
                                    {["ID", "Date", "CC", "GR", "Student", "Campus", "Class", "Section", "Method", "Bank", "Ref #", "Total", "Fee Heads", "Late Fee", "Surcharge"].map(
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
                                        <td className="px-3 py-2.5 font-mono text-zinc-400 whitespace-nowrap">#{item.id}</td>
                                        <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                                            {new Date(item.deposit_date).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}
                                        </td>
                                        <td className="px-3 py-2.5 font-mono font-bold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{item.student_cc}</td>
                                        <td className="px-3 py-2.5 text-zinc-500 whitespace-nowrap">{item.gr_number}</td>
                                        <td className="px-3 py-2.5 font-medium text-zinc-800 dark:text-zinc-100 whitespace-nowrap max-w-[180px] truncate">{item.student_name}</td>
                                        <td className="px-3 py-2.5 text-zinc-500 whitespace-nowrap">{item.campus ?? "—"}</td>
                                        <td className="px-3 py-2.5 text-zinc-500 whitespace-nowrap">{item.class ?? "—"}</td>
                                        <td className="px-3 py-2.5 text-zinc-500 whitespace-nowrap">{item.section ?? "—"}</td>
                                        <td className="px-3 py-2.5 whitespace-nowrap">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                                                {PAYMENT_METHOD_LABELS[item.payment_method ?? ""] ?? item.payment_method ?? "—"}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-zinc-500 whitespace-nowrap">{item.bank_name ?? "—"}</td>
                                        <td className="px-3 py-2.5 font-mono text-zinc-400 whitespace-nowrap">{item.reference_number ?? "—"}</td>
                                        <td className="px-3 py-2.5 font-mono font-bold text-emerald-700 dark:text-emerald-400 text-right whitespace-nowrap">{fmt(item.total_amount)}</td>
                                        <td className="px-3 py-2.5 font-mono text-right text-violet-700 dark:text-violet-400 whitespace-nowrap">{fmt(item.allocations.FEE_HEAD)}</td>
                                        <td className="px-3 py-2.5 font-mono text-right text-amber-700 dark:text-amber-400 whitespace-nowrap">{fmt(item.allocations.LATE_FEE)}</td>
                                        <td className="px-3 py-2.5 font-mono text-right text-red-700 dark:text-red-400 whitespace-nowrap">{fmt(item.allocations.SURCHARGE)}</td>
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
                    Totals reflect the <strong>entire filtered set</strong>, not the current page. Reversed deposits are hard-deleted and do not appear here. Use the payment method and bank filters to reconcile against a bank statement.
                </span>
            </div>
        </div>
    );
}
