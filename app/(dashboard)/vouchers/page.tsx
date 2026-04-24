"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
    Search, Loader2, AlertCircle, FileText, ChevronDown, X,
    RefreshCw, Filter, CheckCircle2, Clock, XCircle, Receipt,
    Building2, GraduationCap, Users, Hash, CreditCard, SlidersHorizontal,
    ChevronLeft, ChevronRight, Download, Calendar, Stamp, Split, Trash2
} from "lucide-react";
import api from "@/lib/api";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { fetchClasses } from "@/store/slices/classesSlice";
import { fetchCampuses } from "@/store/slices/campusesSlice";
import { fetchSections } from "@/store/slices/sectionsSlice";
import { fetchVouchers, VoucherFilters, VoucherItem } from "@/store/slices/vouchersSlice";
import toast from "react-hot-toast";


// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
    { value: "", label: "All Statuses", icon: Filter, color: "text-zinc-400" },
    { value: "UNPAID", label: "Unpaid", icon: Clock, color: "text-amber-500" },
    { value: "PARTIALLY_PAID", label: "Partially Paid", icon: FileText, color: "text-blue-500" },
    { value: "PAID", label: "Paid", icon: CheckCircle2, color: "text-emerald-500" },
    { value: "OVERDUE", label: "Overdue", icon: XCircle, color: "text-rose-500" },
    { value: "VOID", label: "Void", icon: XCircle, color: "text-zinc-500" },
];

const PAGE_SIZE_OPTIONS = [20, 50, 100];

const MONTH_NAMES = [
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-PK", {
        day: "2-digit", month: "short", year: "numeric",
    });
}

function getStatusConfig(status: string | null) {
    switch (status) {
        case "PAID":
            return { label: "Paid", classes: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800" };
        case "PARTIALLY_PAID":
            return { label: "Partially Paid", classes: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800" };
        case "OVERDUE":
            return { label: "Overdue", classes: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800" };
        case "VOID":
            return { label: "Void", classes: "bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-800/10 dark:text-zinc-500 dark:border-zinc-800 line-through" };
        default:
            return { label: "Unpaid", classes: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800" };
    }
}

// ─── Custom Dropdown ─────────────────────────────────────────────────────────

interface DropdownOption { id: number; label: string; sub?: string; }

function FilterDropdown({
    label, icon: Icon, value, options, loading, placeholder, onSelect, onClear,
}: {
    label: string;
    icon: React.ElementType;
    value: number | "";
    options: DropdownOption[];
    loading?: boolean;
    placeholder: string;
    onSelect: (id: number) => void;
    onClear: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const ref = useRef<HTMLDivElement>(null);
    const selected = options.find(o => o.id === value);
    const filtered = options.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        (o.sub && o.sub.toLowerCase().includes(search.toLowerCase()))
    );

    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    return (
        <div className="flex flex-col gap-1.5" ref={ref}>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] flex items-center gap-1.5 ml-1">
                <Icon className="h-3 w-3" /> {label}
            </label>
            <div className="relative">
                <button
                    type="button"
                    id={`filter-${label.toLowerCase().replace(/\s/g, "-")}`}
                    onClick={() => { setOpen(o => !o); setSearch(""); }}
                    className={`w-full h-11 flex items-center justify-between px-4 rounded-xl text-sm transition-all border shadow-sm
                        ${value !== "" ? "bg-primary/5 border-primary/30 text-zinc-900 dark:text-zinc-100" : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400"}
                        hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10`}
                >
                    <span className="font-semibold truncate">
                        {selected ? selected.label : placeholder}
                    </span>
                    <div className="flex items-center gap-1.5 ml-2 shrink-0">
                        {value !== "" && (
                            <span
                                role="button"
                                onClick={(e) => { e.stopPropagation(); onClear(); }}
                                className="p-0.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
                            >
                                <X className="h-3.5 w-3.5" />
                            </span>
                        )}
                        <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
                    </div>
                </button>

                {open && (
                    <div className="absolute z-50 top-full mt-2 w-full min-w-[220px] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                        <div className="p-2.5 border-b border-zinc-100 dark:border-zinc-800">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                                <input
                                    autoFocus type="text" placeholder="Search..."
                                    value={search} onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-3 h-8 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:border-primary placeholder:text-zinc-400"
                                />
                            </div>
                        </div>
                        <div className="max-h-56 overflow-y-auto p-1">
                            {loading ? (
                                <div className="flex items-center justify-center gap-2 py-6 text-zinc-400 text-xs">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="py-6 text-center text-xs text-zinc-400">No results</div>
                            ) : filtered.map(o => (
                                <button
                                    key={o.id} type="button"
                                    onClick={() => { onSelect(o.id); setOpen(false); }}
                                    className={`w-full flex items-center justify-between px-3.5 h-10 rounded-lg text-sm transition-all
                                        ${value === o.id ? "bg-primary text-white font-semibold" : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                                >
                                    <span>{o.label}</span>
                                    {o.sub && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${value === o.id ? "bg-white/20" : "bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"}`}>{o.sub}</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Partially Paid Modal ────────────────────────────────────────────────────

function PartiallyPaidModal({
    voucher,
    sections,
    user,
    onClose,
    onSuccess,
}: {
    voucher: VoucherItem;
    sections: any[];
    user: any;
    onClose: () => void;
    onSuccess: (newVoucherId: number) => void;
}) {
    const heads = voucher.voucher_heads || [];
    const paidHeads = heads.filter(h => Number(h.amount_deposited) > 0);
    const unpaidHeads = heads.filter(h => Number(h.balance) > 0);

    const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [dueDate, setDueDate] = useState("");
    const [validityDate, setValidityDate] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const paidTotal = paidHeads.reduce((s, h) => s + Number(h.amount_deposited), 0);
    const unpaidTotal = unpaidHeads.reduce((s, h) => s + Number(h.balance), 0);

    const handleConfirm = async () => {
        if (!dueDate) { toast.error("Please enter the due date for the new balance voucher."); return; }

        setSubmitting(true);
        const loadingToast = toast.loading("Splitting voucher…");
        try {
            // POST dates as JSON — backend generates both PDFs server-side
            const { data: splitRes } = await api.post(`/v1/vouchers/${voucher.id}/split-partially-paid`, {
                issue_date: issueDate,
                due_date: dueDate,
                ...(validityDate ? { validity_date: validityDate } : {}),
            });

            toast.dismiss(loadingToast);
            toast.success(`Voucher split — Paid #${splitRes.data?.paid_voucher_id}, Balance #${splitRes.data?.unpaid_voucher_id}`);

            // Auto-download the paid PDF from the server-generated URL
            if (splitRes.data?.paid_pdf_url) {
                const link = document.createElement('a');
                link.href = splitRes.data.paid_pdf_url;
                link.download = `paid-voucher-${splitRes.data?.paid_voucher_id}.pdf`;
                link.target = '_blank';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }

            onSuccess(splitRes.data?.unpaid_voucher_id);
        } catch (err: any) {
            toast.dismiss(loadingToast);
            toast.error(err?.response?.data?.message || 'Failed to process partial payment split.');
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <span className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                            <Split className="h-5 w-5 text-blue-500" />
                        </span>
                        <div>
                            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                                Partially Paid Voucher — VCH-{voucher.id}
                            </h2>
                            <p className="text-xs text-zinc-400">
                                {voucher.students?.full_name} · CC-{voucher.students?.cc}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={submitting} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50">
                        <X className="h-4 w-4 text-zinc-400" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5">
                    {/* Summary */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                            <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Already Deposited</p>
                            <p className="text-xl font-black text-emerald-700 dark:text-emerald-300 font-mono">
                                {paidTotal.toLocaleString()}
                            </p>
                            <p className="text-[10px] text-emerald-600/70 mt-1">{paidHeads.length} head{paidHeads.length !== 1 ? "s" : ""}</p>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                            <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">Outstanding Balance</p>
                            <p className="text-xl font-black text-amber-700 dark:text-amber-300 font-mono">
                                {unpaidTotal.toLocaleString()}
                            </p>
                            <p className="text-[10px] text-amber-600/70 mt-1">{unpaidHeads.length} head{unpaidHeads.length !== 1 ? "s" : ""} → new unpaid voucher</p>
                        </div>
                    </div>

                    {/* Breakdown table */}
                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                        <table className="w-full text-xs">
                            <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                                <tr>
                                    {["Fee Head", "Net Amount", "Deposited", "Balance", "Goes to"].map(h => (
                                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {heads.map(h => {
                                    const dep = Number(h.amount_deposited);
                                    const bal = Number(h.balance);
                                    const net = Number(h.net_amount);
                                    const inPaid = dep > 0;
                                    const inUnpaid = bal > 0;
                                    const goesTo = inPaid && inUnpaid ? "Both" : inPaid ? "Paid PDF" : "New Unpaid";
                                    const goesToColor = goesTo === "Both" ? "text-purple-600 dark:text-purple-400" : goesTo === "Paid PDF" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400";
                                    return (
                                        <tr key={h.id} className="border-b border-zinc-100 dark:border-zinc-800/60">
                                            <td className="px-4 py-2.5 font-medium text-zinc-700 dark:text-zinc-300 flex flex-col gap-0.5">
                                                <span>
                                                    {h.description_prefix ? `${h.description_prefix}` : ''}
                                                    {h.student_fees?.fee_types?.description || `Head #${h.id}`}
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    {h.student_fees?.fee_date && (
                                                        <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md ${
                                                            new Date(h.student_fees.fee_date) < new Date(voucher.fee_date || 0)
                                                                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                                                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                                                        }`}>
                                                            {new Date(h.student_fees.fee_date) < new Date(voucher.fee_date || 0) ? "Arrear" : "Current"}
                                                        </span>
                                                    )}
                                                    {(h.student_fees?.target_month || h.student_fees?.month) && (
                                                        <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-md">
                                                            {MONTH_NAMES[h.student_fees.target_month || h.student_fees.month!] || h.student_fees.target_month || h.student_fees.month}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5 font-mono text-zinc-600 dark:text-zinc-400">{net.toLocaleString()}</td>
                                            <td className="px-4 py-2.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">{dep.toLocaleString()}</td>
                                            <td className="px-4 py-2.5 font-mono font-bold text-amber-600 dark:text-amber-400">{bal.toLocaleString()}</td>
                                            <td className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-wider ${goesToColor}`}>{goesTo}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* New voucher date form */}
                    {unpaidHeads.length > 0 && (
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-4">
                            <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5 text-primary" />
                                New Unpaid Voucher Dates
                            </p>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { id: "pp-issue", label: "Issue Date", value: issueDate, onChange: setIssueDate, required: true },
                                    { id: "pp-due", label: "Due Date", value: dueDate, onChange: setDueDate, required: true },
                                    { id: "pp-validity", label: "Validity Date", value: validityDate, onChange: setValidityDate, required: false },
                                ].map(f => (
                                    <div key={f.id} className="flex flex-col gap-1">
                                        <label htmlFor={f.id} className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                            {f.label}{f.required && <span className="text-rose-500 ml-0.5">*</span>}
                                        </label>
                                        <input
                                            id={f.id}
                                            type="date"
                                            value={f.value}
                                            onChange={e => f.onChange(e.target.value)}
                                            className="h-10 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/40 transition-all text-zinc-700 dark:text-zinc-300"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-1">
                        <p className="text-[11px] text-zinc-400 max-w-xs">
                            The original voucher stays in the system unchanged. A PAID-stamped PDF will be downloaded for the deposited amount.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                disabled={submitting}
                                className="px-4 py-2 text-sm font-semibold border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={submitting || unpaidHeads.length === 0}
                                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Split className="h-4 w-4" />}
                                {submitting ? "Processing…" : "Confirm & Create"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Voucher Row ─────────────────────────────────────────────────────────────

function VoucherRow({ voucher, index, sections, onRefresh }: { voucher: VoucherItem; index: number; sections: any[]; onRefresh: () => void }) {
    const status = getStatusConfig(voucher.status);
    const [isDownloading, setIsDownloading] = useState(false);
    const [showPartialModal, setShowPartialModal] = useState(false);
    const user = useAppSelector(s => s.auth.user);

    // ── UNPAID / OVERDUE: serve existing pdf_url directly ─────────────────
    const handleUnpaidDownload = () => {
        const pdfUrl = typeof voucher.pdf_url === "string" ? voucher.pdf_url.trim() : "";
        if (pdfUrl) {
            const link = document.createElement("a");
            link.href = pdfUrl;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("Voucher opened in a new tab.");
            return;
        }
        toast.error("No PDF available for this voucher.");
    };

    // ── PAID: always regenerate server-side with paid_stamp — pdf_url may still point at an
    //    older unpaid/uploaded PDF without the stamp; opening it directly would show no PAID watermark.
    const handlePaidDownload = async () => {
        setIsDownloading(true);
        const loadingToast = toast.loading("Generating PAID PDF…");
        try {
            const { data: pdfRes } = await api.post(`/v1/vouchers/${voucher.id}/generate-pdf`, { paid_stamp: true });
            const pdfUrl = pdfRes.data?.pdf_url;
            if (!pdfUrl) throw new Error("No PDF URL returned from server.");

            const link = document.createElement("a");
            link.href = pdfUrl;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.dismiss(loadingToast);
            toast.success("PAID voucher opened in a new tab.");
        } catch (err) {
            console.error(err);
            toast.dismiss(loadingToast);
            toast.error("Failed to generate paid PDF.");
        } finally {
            setIsDownloading(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(`Are you sure you want to PERMANENTLY delete Voucher #${voucher.id}? This will reset the associated fee heads to 'Not Issued'.`)) {
            return;
        }

        const loadingToast = toast.loading("Deleting voucher...");
        try {
            await api.delete(`/v1/vouchers/${voucher.id}`);
            toast.dismiss(loadingToast);
            toast.success("Voucher deleted successfully.");
            onRefresh();
        } catch (err: any) {
            toast.dismiss(loadingToast);
            toast.error(err.response?.data?.message || "Failed to delete voucher.");
            console.error(err);
        }
    };

    const isPaid = voucher.status === "PAID";
    const isPartiallyPaid = voucher.status === "PARTIALLY_PAID";

    return (
        <>
        <tr className="group border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
            <td className="px-5 py-3.5 text-center">
                <span className="text-[11px] font-mono text-zinc-400">{voucher.id}</span>
            </td>
            <td className="px-5 py-3.5">
                <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[180px]">
                        {voucher.students?.full_name || "—"}
                    </span>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-md">
                            CC-{voucher.students?.cc}
                        </span>
                        {voucher.students?.gr_number && (
                            <span className="text-[10px] font-semibold text-zinc-400">
                                GR: {voucher.students.gr_number}
                            </span>
                        )}
                    </div>
                </div>
            </td>
            <td className="px-5 py-3.5">
                <span className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                    {voucher.campuses?.campus_name || "—"}
                </span>
            </td>
            <td className="px-5 py-3.5">
                <span className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                    {voucher.classes?.description || "—"}
                </span>
            </td>
            <td className="px-5 py-3.5">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {voucher.sections?.description || <span className="text-zinc-300">—</span>}
                </span>
            </td>
            <td className="px-5 py-3.5">
                <span className="text-sm text-zinc-600 dark:text-zinc-400 font-mono">
                    {formatDate(voucher.issue_date)}
                </span>
            </td>
            <td className="px-5 py-3.5">
                <span className="text-sm text-zinc-600 dark:text-zinc-400 font-mono">
                    {formatDate(voucher.due_date)}
                </span>
            </td>
            <td className="px-5 py-3.5">
                <span className="text-sm text-zinc-600 dark:text-zinc-400 font-mono">
                    {formatDate(voucher.validity_date || voucher.due_date)}
                </span>
            </td>
            <td className="px-5 py-3.5">
                <span className="text-sm text-zinc-400 dark:text-zinc-600 font-mono line-through decoration-rose-300">
                    {Number(voucher.sf_gross_total ?? voucher.voucher_heads?.reduce((sum, h) => sum + Number(h.net_amount) + Number(h.discount_amount || 0), 0)).toLocaleString()}
                </span>
            </td>
            <td className="px-5 py-3.5">
                <span className="text-sm text-emerald-600 dark:text-emerald-400 font-black font-mono">
                    {Number(voucher.sf_net_total ?? voucher.total_payable_before_due ?? 0).toLocaleString()}
                </span>
            </td>
            <td className="px-5 py-3.5">
                <span className={`inline-flex items-center px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border ${status.classes}`}>
                    {status.label}
                </span>
            </td>
            <td className="px-5 py-3.5">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[140px] block">
                    {voucher.bank_accounts?.bank_name || "—"}
                </span>
            </td>
            <td className="px-5 py-3.5">
                <div className="flex items-center gap-2">
                    {/* Download / PDF button */}
                    {isPaid ? (
                        <button
                            onClick={handlePaidDownload}
                            disabled={isDownloading}
                            title="Download PAID-stamped PDF"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors disabled:opacity-50"
                        >
                            {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Stamp className="h-3.5 w-3.5" />}
                            {isDownloading ? "…" : "PAID PDF"}
                        </button>
                    ) : isPartiallyPaid ? (
                        <button
                            onClick={() => setShowPartialModal(true)}
                            title="View breakdown and create new unpaid voucher"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-blue-200 dark:border-blue-800/50 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                        >
                            <Split className="h-3.5 w-3.5" />
                            Split
                        </button>
                    ) : (
                        <button
                            onClick={handleUnpaidDownload}
                            disabled={isDownloading}
                            title="Download original PDF"
                            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors disabled:opacity-50"
                        >
                            <Download className="h-3.5 w-3.5" />
                            {isDownloading ? "..." : "PDF"}
                        </button>
                    )}

                    {(voucher.status === "UNPAID" || voucher.status === "OVERDUE") && (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                            title="Delete Voucher & Reset Heads"
                            className="p-1.5 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </td>
        </tr>
        {showPartialModal && createPortal(
            <PartiallyPaidModal
                voucher={voucher}
                sections={sections}
                user={user}
                onClose={() => setShowPartialModal(false)}
                onSuccess={(_newId) => {
                    setShowPartialModal(false);
                    onRefresh();
                }}
            />,
            document.body
        )}
        </>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VouchersPage() {
    const dispatch = useAppDispatch();

    // Redux data
    const vouchers = useAppSelector(s => s.vouchers.items);
    const vouchersLoading = useAppSelector(s => s.vouchers.isLoading);
    const vouchersError = useAppSelector(s => s.vouchers.error);
    const pagination = useAppSelector(s => s.vouchers.pagination);
    const campuses = useAppSelector(s => s.campuses.items);
    const campusesLoading = useAppSelector(s => s.campuses.isLoading);
    const classes = useAppSelector(s => s.classes.items);
    const classesLoading = useAppSelector(s => s.classes.isLoading);
    const sections = useAppSelector(s => s.sections.items);
    const sectionsLoading = useAppSelector(s => s.sections.isLoading);

    // Filter state
    const [campusId, setCampusId] = useState<number | "">("");
    const [classId, setClassId] = useState<number | "">("");
    const [sectionId, setSectionId] = useState<number | "">("");
    const [ccInput, setCcInput] = useState("");
    const [grInput, setGrInput] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [activeFiltersApplied, setActiveFiltersApplied] = useState<VoucherFilters>({});

    // Table state
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [showFilters, setShowFilters] = useState(true);

    // Load reference data
    useEffect(() => {
        if (campuses.length === 0) dispatch(fetchCampuses());
        if (classes.length === 0) dispatch(fetchClasses());
        if (sections.length === 0) dispatch(fetchSections());
    }, [dispatch]);

    // Fetch vouchers on page/filter change
    useEffect(() => {
        dispatch(fetchVouchers({ 
            ...activeFiltersApplied, 
            page, 
            limit: pageSize 
        }));
    }, [dispatch, page, pageSize, activeFiltersApplied]);

    const buildFilters = useCallback((): VoucherFilters => {
        const f: VoucherFilters = {};
        if (campusId !== "") f.campus_id = campusId as number;
        if (classId !== "") f.class_id = classId as number;
        if (sectionId !== "") f.section_id = sectionId as number;
        if (statusFilter) f.status = statusFilter;
        if (dateFrom) f.date_from = dateFrom;
        if (dateTo) f.date_to = dateTo;

        const ccNum = parseInt(ccInput.replace(/\D/g, ""));
        if (!isNaN(ccNum) && ccNum > 0) f.cc = ccNum;
        if (grInput.trim()) f.gr = grInput.trim();
        return f;
    }, [campusId, classId, sectionId, statusFilter, ccInput, grInput, dateFrom, dateTo]);

    const handleApplyFilters = useCallback(() => {
        const filters = buildFilters();
        setActiveFiltersApplied(filters);
        setPage(1);
    }, [buildFilters]);

    const handleClearFilters = () => {
        setCampusId("");
        setClassId("");
        setSectionId("");
        setCcInput("");
        setGrInput("");
        setStatusFilter("");
        setDateFrom("");
        setDateTo("");
        setActiveFiltersApplied({});
        setPage(1);
        dispatch(fetchVouchers({}));
    };

    const handleRefresh = () => {
        dispatch(fetchVouchers(activeFiltersApplied));
        toast.success("Vouchers refreshed");
    };

    // Pagination
    const totalPages = Math.ceil(vouchers.length / pageSize);
    const paginatedVouchers = vouchers.slice((page - 1) * pageSize, page * pageSize);

    const activeFilterCount = Object.keys(activeFiltersApplied).length;

    // Stat cards (Showing current page stats for now, total count from pagination)
    const stats = {
        total: pagination.total,
        pageTotal: vouchers.length,
        paid: vouchers.filter(v => v.status === "PAID").length,
        unpaid: vouchers.filter(v => v.status !== "PAID" && v.status !== "OVERDUE").length,
        overdue: vouchers.filter(v => v.status === "OVERDUE").length,
    };

    const campusOptions: DropdownOption[] = campuses.map(c => ({ id: c.id, label: c.campus_name, sub: c.campus_code }));
    const classOptions: DropdownOption[] = classes.map(c => ({ id: c.id, label: c.description, sub: c.class_code }));
    const sectionOptions: DropdownOption[] = sections.map(s => ({ id: s.id, label: s.description }));

    return (
        <div className="space-y-6 pb-20">
            {/* ── Header ───────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                        <span className="p-2 bg-primary/10 rounded-xl">
                            <Receipt className="h-6 w-6 text-primary" />
                        </span>
                        Vouchers
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm">
                        Browse and filter fee vouchers across campuses and classes.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        id="btn-toggle-filters"
                        onClick={() => setShowFilters(f => !f)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all
                            ${showFilters ? "bg-primary/10 border-primary/20 text-primary" : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300"}`}
                    >
                        <SlidersHorizontal className="h-4 w-4" />
                        Filters
                        {activeFilterCount > 0 && (
                            <span className="ml-1 bg-primary text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>

                    <button
                        id="btn-refresh-vouchers"
                        onClick={handleRefresh}
                        disabled={vouchersLoading}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 transition-all disabled:opacity-60"
                    >
                        <RefreshCw className={`h-4 w-4 ${vouchersLoading ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* ── Stat Cards ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Total Vouchers", value: stats.total, icon: FileText, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" },
                    { label: "Paid", value: stats.paid, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
                    { label: "Unpaid", value: stats.unpaid, icon: Clock, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20" },
                    { label: "Overdue", value: stats.overdue, icon: XCircle, color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-900/20" },
                ].map(s => (
                    <div key={s.label} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
                        <div className={`p-3 rounded-xl ${s.bg}`}>
                            <s.icon className={`h-5 w-5 ${s.color}`} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{s.label}</p>
                            <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tabular-nums leading-tight">
                                {vouchersLoading ? <span className="text-zinc-300">—</span> : s.value}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Filter Panel ─────────────────────────────────────────────── */}
            {showFilters && (
                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[28px] p-6 shadow-sm animate-in slide-in-from-top-4 fade-in duration-200">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-primary" />
                            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Filter Vouchers</span>
                            {activeFilterCount > 0 && (
                                <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                    {activeFilterCount} active
                                </span>
                            )}
                        </div>
                        {activeFilterCount > 0 && (
                            <button
                                id="btn-clear-filters"
                                onClick={handleClearFilters}
                                className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-rose-500 transition-colors"
                            >
                                <X className="h-3.5 w-3.5" /> Clear all
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                        {/* Campus */}
                        <FilterDropdown
                            label="Campus"
                            icon={Building2}
                            value={campusId}
                            options={campusOptions}
                            loading={campusesLoading}
                            placeholder="All Campuses"
                            onSelect={v => setCampusId(v)}
                            onClear={() => setCampusId("")}
                        />

                        {/* Class */}
                        <FilterDropdown
                            label="Class"
                            icon={GraduationCap}
                            value={classId}
                            options={classOptions}
                            loading={classesLoading}
                            placeholder="All Classes"
                            onSelect={v => setClassId(v)}
                            onClear={() => setClassId("")}
                        />

                        {/* Section */}
                        <FilterDropdown
                            label="Section"
                            icon={Users}
                            value={sectionId}
                            options={sectionOptions}
                            loading={sectionsLoading}
                            placeholder="All Sections"
                            onSelect={v => setSectionId(v)}
                            onClear={() => setSectionId("")}
                        />

                        {/* CC Number */}
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="filter-cc" className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] flex items-center gap-1.5 ml-1">
                                <Hash className="h-3 w-3" /> CC Number
                            </label>
                            <div className="relative">
                                <input
                                    id="filter-cc"
                                    type="text"
                                    placeholder="e.g. 1001 or CC-1001"
                                    value={ccInput}
                                    onChange={e => setCcInput(e.target.value)}
                                    className="w-full h-11 px-4 pr-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/40 transition-all placeholder:text-zinc-400"
                                />
                                {ccInput && (
                                    <button
                                        onClick={() => setCcInput("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-500 transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* GR Number */}
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="filter-gr" className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] flex items-center gap-1.5 ml-1">
                                <CreditCard className="h-3 w-3" /> GR Number
                            </label>
                            <div className="relative">
                                <input
                                    id="filter-gr"
                                    type="text"
                                    placeholder="e.g. GR-2024-001"
                                    value={grInput}
                                    onChange={e => setGrInput(e.target.value)}
                                    className="w-full h-11 px-4 pr-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/40 transition-all placeholder:text-zinc-400"
                                />
                                {grInput && (
                                    <button
                                        onClick={() => setGrInput("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-500 transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Date From */}
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="filter-date-from" className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] flex items-center gap-1.5 ml-1">
                                <Calendar className="h-3 w-3" /> Fee Date From
                            </label>
                            <div className="relative">
                                <input
                                    id="filter-date-from"
                                    type="date"
                                    value={dateFrom}
                                    onChange={e => setDateFrom(e.target.value)}
                                    className="w-full h-11 px-4 pr-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/40 transition-all text-zinc-700 dark:text-zinc-300"
                                />
                                {dateFrom && (
                                    <button
                                        onClick={() => setDateFrom("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-500 transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Date To */}
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="filter-date-to" className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] flex items-center gap-1.5 ml-1">
                                <Calendar className="h-3 w-3" /> Fee Date To
                            </label>
                            <div className="relative">
                                <input
                                    id="filter-date-to"
                                    type="date"
                                    value={dateTo}
                                    onChange={e => setDateTo(e.target.value)}
                                    className="w-full h-11 px-4 pr-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/40 transition-all text-zinc-700 dark:text-zinc-300"
                                />
                                {dateTo && (
                                    <button
                                        onClick={() => setDateTo("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-500 transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Status */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] flex items-center gap-1.5 ml-1">
                                <CheckCircle2 className="h-3 w-3" /> Status
                            </label>
                            <div className="flex gap-2 flex-wrap">
                                {STATUS_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        id={`status-filter-${opt.value || "all"}`}
                                        type="button"
                                        onClick={() => setStatusFilter(opt.value)}
                                        className={`flex items-center gap-1.5 px-3.5 py-2 h-11 rounded-xl text-xs font-bold border transition-all
                                            ${statusFilter === opt.value
                                                ? "bg-primary text-white border-primary shadow-sm"
                                                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300"
                                            }`}
                                    >
                                        <opt.icon className={`h-3.5 w-3.5 ${statusFilter === opt.value ? "text-white" : opt.color}`} />
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Apply Button */}
                    <div className="mt-5 flex justify-end">
                        <button
                            id="btn-apply-filters"
                            onClick={handleApplyFilters}
                            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
                        >
                            <Filter className="h-4 w-4" />
                            Apply Filters
                        </button>
                    </div>
                </div>
            )}

            {/* ── Error Banner ─────────────────────────────────────────────── */}
            {vouchersError && (
                <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl p-4 text-sm">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <span className="font-medium">{vouchersError}</span>
                </div>
            )}

            {/* ── Table ────────────────────────────────────────────────────── */}
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[24px] shadow-sm overflow-hidden">

                {/* Table header bar */}
                <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                            {vouchersLoading ? "Loading…" : `${pagination.total.toLocaleString()} total voucher${pagination.total !== 1 ? "s" : ""}`}
                        </span>
                        {activeFilterCount > 0 && (
                            <span className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                                filtered
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Per page</label>
                        <select
                            id="select-page-size"
                            value={pageSize}
                            onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                            className="h-8 px-3 text-xs font-bold bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:border-primary"
                        >
                            {PAGE_SIZE_OPTIONS.map(n => (
                                <option key={n} value={n}>{n}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {vouchersLoading ? (
                    <div className="flex flex-col items-center justify-center py-40 gap-4">
                        <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
                        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Fetching Vouchers…</p>
                    </div>
                ) : vouchers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-40 gap-5 text-center">
                        <div className="p-7 bg-zinc-50 dark:bg-zinc-900 rounded-full border border-zinc-200 dark:border-zinc-800">
                            <Receipt className="h-10 w-10 text-zinc-200 dark:text-zinc-700" />
                        </div>
                        <div>
                            <p className="font-bold text-zinc-900 dark:text-zinc-100">No vouchers found</p>
                            <p className="text-sm text-zinc-400 mt-1">
                                {activeFilterCount > 0 ? "Try adjusting your filters." : "No vouchers have been generated yet."}
                            </p>
                        </div>
                        {activeFilterCount > 0 && (
                            <button
                                onClick={handleClearFilters}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-primary border border-primary/20 bg-primary/5 rounded-xl hover:bg-primary/10 transition-colors"
                            >
                                <X className="h-4 w-4" /> Clear Filters
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-auto">
                        <table className="w-full border-collapse">
                            <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
                                <tr>
                                    {["ID", "Student", "Campus", "Class", "Section", "Issue Date", "Due Date", "Validity", "Original", "Net", "Status", "Bank", "Actions"].map(h => (
                                        <th key={h} className="px-5 py-3.5 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest whitespace-nowrap">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {vouchers.map((v, i) => (
                                    <VoucherRow key={v.id} voucher={v} index={(page - 1) * pageSize + i} sections={sections} onRefresh={handleRefresh} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {!vouchersLoading && pagination.totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                        <p className="text-xs text-zinc-400 font-medium">
                            Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, pagination.total)} of {pagination.total}
                        </p>
                        <div className="flex items-center gap-1">
                            <button
                                id="btn-prev-page"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft className="h-4 w-4 text-zinc-500" />
                            </button>
                            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                                let p: number;
                                if (pagination.totalPages <= 5) { p = i + 1; }
                                else if (page <= 3) { p = i + 1; }
                                else if (page >= pagination.totalPages - 2) { p = pagination.totalPages - 4 + i; }
                                else { p = page - 2 + i; }
                                return (
                                    <button
                                        key={p} id={`btn-page-${p}`}
                                        onClick={() => setPage(p)}
                                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all
                                            ${p === page ? "bg-primary text-white" : "border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900"}`}
                                    >
                                        {p}
                                    </button>
                                );
                            })}
                            <button
                                id="btn-next-page"
                                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                                disabled={page === pagination.totalPages}
                                className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronRight className="h-4 w-4 text-zinc-500" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
