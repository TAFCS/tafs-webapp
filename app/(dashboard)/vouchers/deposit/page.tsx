"use client";

import { useState, useEffect, useRef } from "react";
import {
    Search, Loader2, AlertCircle, FileText,
    RefreshCw, Filter, CheckCircle2, Clock, XCircle, Receipt,
    Hash, SlidersHorizontal, ShieldAlert,
    ChevronLeft, ChevronRight, Wallet, UserCircle, UserSearch, Ban, X
} from "lucide-react";
import api from "@/lib/api";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { fetchSections } from "@/store/slices/sectionsSlice";
import { fetchVouchers, fetchVouchersByStudent, VoucherItem, clearVouchers } from "@/store/slices/vouchersSlice";
import toast from "react-hot-toast";



// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
    { value: "", label: "All Statuses", icon: Filter, color: "text-zinc-400" },
    { value: "UNPAID", label: "Unpaid", icon: Clock, color: "text-amber-500" },
    { value: "PARTIALLY_PAID", label: "Partially Paid", icon: FileText, color: "text-blue-500" },
    { value: "PAID", label: "Paid", icon: CheckCircle2, color: "text-emerald-500" },
    { value: "OVERDUE", label: "Overdue", icon: XCircle, color: "text-rose-500" },
    { value: "VOID", label: "Void", icon: Ban, color: "text-zinc-400" },
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
            return { label: "Void", classes: "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800/40 dark:text-zinc-500 dark:border-zinc-700" };
        default:
            return { label: "Unpaid", classes: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800" };
    }
}

// ─── Deposit Modal ───────────────────────────────────────────────────────────

interface DepositModalProps {
    voucher: VoucherItem;
    onClose: () => void;
    onSuccess: () => void;
}

function DepositModal({ voucher, onClose, onSuccess }: DepositModalProps) {
    // Guard: do not allow deposit on a VOID voucher
    if (voucher.status === "VOID") {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="px-8 py-6 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 bg-zinc-200/60 dark:bg-zinc-800 rounded-2xl flex items-center justify-center">
                                <Ban className="h-6 w-6 text-zinc-500" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">Voucher Voided</h2>
                                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Voucher #{voucher.id} • {voucher.students.full_name}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                            <X className="h-5 w-5 text-zinc-400" />
                        </button>
                    </div>
                    <div className="p-8 space-y-4">
                        <div className="flex items-start gap-4 p-5 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/40 rounded-2xl">
                            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-sm font-black text-amber-800 dark:text-amber-300">This voucher has been superseded</p>
                                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                                    The unpaid fee heads from this voucher have been rolled into a newer voucher.
                                    Please locate that voucher and record the deposit against it to avoid double-payment.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="px-8 py-6 border-t border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-end">
                        <button onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-zinc-500 hover:text-zinc-700 transition-colors">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const [amount, setAmount] = useState<string>("");
    const [isSaving, setIsSaving] = useState(false);
    const [fillingMode, setFillingMode] = useState<"auto" | "manual">("auto");
    const [manualDistributions, setManualDistributions] = useState<Record<number, string>>({});
    const [manualLateFee, setManualLateFee] = useState<string>("0");
    const [surchargeDistributions, setSurchargeDistributions] = useState<Record<number, string>>({});
    const [paymentMethod, setPaymentMethod] = useState<string>("cash");
    const [referenceNumber, setReferenceNumber] = useState<string>("");

    const heads = [...(voucher.voucher_heads || [])].sort((a, b) => {
        const dateA = new Date(a.student_fees?.fee_date || 0).getTime();
        const dateB = new Date(b.student_fees?.fee_date || 0).getTime();
        return dateA - dateB;
    });

    // Arrear surcharges from the voucher
    const arrearSurcharges = (voucher.voucher_arrear_surcharges || []).filter(s => !s.waived);
    const waivedSurcharges = (voucher.voucher_arrear_surcharges || []).filter(s => s.waived);
    const getSurchargeBalance = (s: typeof arrearSurcharges[0]) =>
        Math.max(Number(s.amount) - Number(s.amount_paid ?? 0), 0);
    const totalArrearSurchargeBalance = arrearSurcharges.reduce((sum, s) => sum + getSurchargeBalance(s), 0);

    const MONTH_LABELS = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const getSurchargeLabel = (s: typeof arrearSurcharges[0]) => {
        const yr = s.arrear_year?.split('-');
        const m = s.arrear_month;
        const yearPart = m >= 8 ? yr?.[0] : yr?.[1];
        return `${MONTH_LABELS[m] || m} ${yearPart ? `'${String(yearPart).slice(-2)}` : s.arrear_year}`;
    };

    const voucherFeeDate = voucher.fee_date ? new Date(voucher.fee_date) : null;
    const isArrearHead = (h: typeof heads[0]) => {
        if (!voucherFeeDate || !h.student_fees?.fee_date) return false;
        return new Date(h.student_fees.fee_date) < voucherFeeDate;
    };
    const arrearCount = heads.filter(h => isArrearHead(h)).length;

    const sfNetAmt = (h: typeof heads[0]) => Number(h.student_fees?.amount ?? h.net_amount ?? 0);
    const sfBalance = (h: typeof heads[0]) => Number(h.balance ?? 0);
    const sfDeposited = (h: typeof heads[0]) => Math.max(sfNetAmt(h) - sfBalance(h), 0);

    const totalBalance = heads.reduce((sum, h) => sum + sfBalance(h), 0);
    const totalSurcharge = (voucher.late_fee_charge) ? Math.max(Number(voucher.total_payable_after_due ?? 0) - Number(voucher.total_payable_before_due ?? 0), 0) : 0;
    const remainingSurcharge = Math.max(totalSurcharge - Number(voucher.late_fee_deposited ?? 0), 0);
    const isOverdue = new Date() > new Date(voucher.due_date);
    const actualLateFee = isOverdue ? remainingSurcharge : 0;
    const finalTotal = totalBalance + actualLateFee + totalArrearSurchargeBalance;

    const surchargeDistTotal = Object.values(surchargeDistributions).reduce((s, v) => s + (Number(v) || 0), 0);
    const distributedTotal = fillingMode === "auto"
        ? Number(amount) || 0
        : Object.values(manualDistributions).reduce((sum, val) => sum + (Number(val) || 0), 0)
            + (Number(manualLateFee) || 0)
            + surchargeDistTotal;

    const remainingPool = (Number(amount) || 0) - distributedTotal;

    const handleAutoFill = () => {
        const depositAmt = Number(amount) || 0;
        let remaining = depositAmt;
        const dist: Record<number, string> = {};
        const sDist: Record<number, string> = {};
        const lateToFill = Math.min(remaining, actualLateFee);
        setManualLateFee(lateToFill.toString());
        remaining -= lateToFill;
        heads.forEach(h => {
            const hBal = sfBalance(h);
            const toFill = Math.min(remaining, hBal);
            dist[h.id] = toFill.toString();
            remaining -= toFill;
        });
        arrearSurcharges.forEach(s => {
            const sBal = getSurchargeBalance(s);
            const toFill = Math.min(remaining, sBal);
            sDist[s.id] = toFill.toString();
            remaining -= toFill;
        });
        setManualDistributions(dist);
        setSurchargeDistributions(sDist);
    };

    useEffect(() => {
        if (fillingMode === "auto") {
            handleAutoFill();
        } else {
            const clearedDistributions: Record<number, string> = {};
            heads.forEach(h => clearedDistributions[h.id] = "0");
            setManualDistributions(clearedDistributions);
            const clearedSurcharges: Record<number, string> = {};
            arrearSurcharges.forEach(s => clearedSurcharges[s.id] = "0");
            setSurchargeDistributions(clearedSurcharges);
            setManualLateFee("0");
        }
    }, [amount, fillingMode]);

    const handleSave = async () => {
        if (!amount || Number(amount) <= 0) { toast.error("Please enter a valid deposit amount."); return; }
        if (distributedTotal > finalTotal) { toast.error("Distribution exceeds voucher balance."); return; }
        if (remainingPool !== 0) { toast.error("Total distribution must match deposit amount."); return; }
        const surchargeAllocations = arrearSurcharges
            .filter(s => Number(surchargeDistributions[s.id] || 0) > 0)
            .map(s => ({ surcharge_id: s.id, amount: Number(surchargeDistributions[s.id]) }));
        setIsSaving(true);
        try {
            await api.post(`/v1/vouchers/${voucher.id}/deposit`, {
                amount: Number(amount),
                distributions: manualDistributions,
                late_fee: Number(manualLateFee),
                surcharge_allocations: surchargeAllocations.length > 0 ? surchargeAllocations : undefined,
                payment_method: paymentMethod || undefined,
                reference_number: referenceNumber.trim() || undefined,
            });
            toast.success("Deposit recorded successfully");
            onSuccess();
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to record deposit");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] shadow-2xl w-full max-w-5xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="px-8 py-6 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                            <Wallet className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">Record Deposit</h2>
                            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Voucher #{voucher.id} • {voucher.students.full_name}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {arrearCount > 0 && (
                            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-amber-500/20">
                                <AlertCircle className="h-3 w-3" />
                                {arrearCount} arrear head{arrearCount !== 1 ? "s" : ""}
                            </span>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                            <X className="h-5 w-5 text-zinc-400" />
                        </button>
                    </div>
                </div>

                <div className="p-8 space-y-8 max-h-[75vh] overflow-y-auto">
                    {/* Amount Input */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between ml-1">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Deposit Amount (PKR)</label>
                            <button
                                type="button"
                                onClick={() => setAmount(finalTotal.toString())}
                                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all active:scale-95"
                            >
                                <Wallet className="h-3 w-3" />
                                Pay Full (Rs. {finalTotal.toLocaleString()})
                            </button>
                        </div>
                        <div className="relative">
                            <input
                                autoFocus
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="Enter amount..."
                                value={amount}
                                onChange={e => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    if (val === "") { setAmount(""); return; }
                                    const num = Number(val);
                                    if (num > finalTotal) {
                                        setAmount(finalTotal.toString());
                                        toast.error(`Amount cannot exceed the total balance of Rs. ${finalTotal.toLocaleString()}`);
                                    } else { setAmount(val); }
                                }}
                                className="w-full h-16 px-6 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] text-2xl font-black text-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/30 transition-all placeholder:text-zinc-300"
                            />
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-end">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Total Balance</span>
                                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Rs. {finalTotal.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Payment Details */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Payment Method</label>
                            <select
                                value={paymentMethod}
                                onChange={e => setPaymentMethod(e.target.value)}
                                className="w-full h-11 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[14px] text-sm font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-emerald-500/30 transition-all"
                            >
                                <option value="cash">Cash</option>
                                <option value="bank_transfer">Bank Transfer</option>
                                <option value="cheque">Cheque</option>
                                <option value="online">Online Payment</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Reference No. <span className="normal-case font-medium">(optional)</span></label>
                            <input
                                type="text"
                                placeholder="Slip / cheque / TXN no."
                                value={referenceNumber}
                                onChange={e => setReferenceNumber(e.target.value)}
                                className="w-full h-11 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[14px] text-sm font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-emerald-500/30 transition-all placeholder:text-zinc-300"
                            />
                        </div>
                    </div>

                    {/* Filling Mode Toggle */}
                    {Number(amount) > 0 && Number(amount) !== finalTotal && (
                        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Distribution Mode</span>
                                <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                                    <button onClick={() => setFillingMode("auto")} className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${fillingMode === "auto" ? "bg-white dark:bg-zinc-950 text-primary shadow-sm" : "text-zinc-400"}`}>Auto Fill</button>
                                    <button onClick={() => setFillingMode("manual")} className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${fillingMode === "manual" ? "bg-white dark:bg-zinc-950 text-primary shadow-sm" : "text-zinc-400"}`}>Manual</button>
                                </div>
                            </div>
                            {fillingMode === "manual" && (
                                <div className="p-4 bg-primary/5 border border-primary/10 rounded-[20px] flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 bg-primary/20 rounded-lg flex items-center justify-center">
                                            <SlidersHorizontal className="h-4 w-4 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-primary uppercase tracking-widest">Manual Adjustment Pool</p>
                                            <p className="text-xs font-bold text-zinc-600">Distribute across heads manually.</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Remaining</p>
                                        <p className={`text-sm font-black ${remainingPool === 0 ? "text-emerald-500" : remainingPool < 0 ? "text-rose-500" : "text-primary"}`}>
                                            Rs. {remainingPool.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Full Heads Breakdown Table */}
                    <div className="space-y-2">
                        {/* Column Headers */}
                        <div className="grid grid-cols-[1fr_120px_120px_120px_130px] gap-x-4 px-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em]">Fee Head</span>
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] text-right">Net Amt</span>
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] text-right">Deposited</span>
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] text-right">Balance</span>
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] text-right">To Deposit</span>
                        </div>

                        {/* Late Fee row */}
                        {actualLateFee > 0 && (
                            <div className="grid grid-cols-[1fr_120px_120px_120px_130px] gap-x-4 items-center px-4 py-3 bg-rose-50/30 dark:bg-rose-900/10 border border-rose-100/50 dark:border-rose-900/30 rounded-2xl">
                                <div>
                                    <p className="text-[12px] font-black text-rose-600">Late Payment Surcharge</p>
                                    <span className="inline-flex items-center px-1.5 py-0.5 bg-rose-100 dark:bg-rose-900/30 text-rose-600 text-[9px] font-black uppercase tracking-widest rounded-md mt-0.5">System • Priority 0</span>
                                </div>
                                <span className="text-[11px] font-bold text-zinc-400 tabular-nums text-right">—</span>
                                <span className="text-[11px] font-bold text-zinc-500 tabular-nums text-right">{Number(voucher.late_fee_deposited ?? 0).toLocaleString()}</span>
                                <span className="text-[11px] font-black text-rose-600 tabular-nums text-right">{actualLateFee.toLocaleString()}</span>
                                <div className="flex justify-end">
                                    {fillingMode === "manual" ? (
                                        <input type="text" inputMode="numeric" pattern="[0-9]*" value={manualLateFee}
                                            onChange={e => { const v = e.target.value.replace(/[^0-9]/g,''); setManualLateFee(v === "" || Number(v) <= actualLateFee ? v : actualLateFee.toString()); }}
                                            className="w-24 h-8 px-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-bold text-right focus:outline-none focus:border-rose-500 transition-all font-mono" />
                                    ) : (
                                        <span className="text-[12px] font-black text-rose-600 tabular-nums">Rs. {Number(manualLateFee || 0).toLocaleString()}</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Fee head rows */}
                        {heads.map(h => {
                            const arrear = isArrearHead(h);
                            const hSfBal = sfBalance(h);
                            const hSfNet = sfNetAmt(h);
                            const hSfDep = sfDeposited(h);
                            return (
                                <div
                                    key={h.id}
                                    className={`grid grid-cols-[1fr_120px_120px_120px_130px] gap-x-4 items-center px-4 py-3 border rounded-2xl transition-all ${
                                        arrear
                                            ? "bg-amber-50/30 dark:bg-amber-900/5 border-amber-100 dark:border-amber-900/20 hover:border-amber-200 dark:hover:border-amber-800/40"
                                            : "bg-zinc-50 dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700"
                                    }`}
                                >
                                    <div>
                                        <p className="text-[12px] font-black text-zinc-900 dark:text-zinc-100 truncate">
                                            {h.student_fees?.fee_types?.description || "Fee Head"}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-md ${
                                                arrear ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                                            }`}>
                                                {arrear ? "Arrear" : "Current"}
                                            </span>
                                            {(h.student_fees?.target_month || h.student_fees?.month) && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[9px] font-black uppercase tracking-widest rounded-md">
                                                    {MONTH_NAMES[h.student_fees.target_month || h.student_fees.month!] || h.student_fees.target_month || h.student_fees.month}
                                                </span>
                                            )}
                                            {h.is_installment && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[9px] font-black uppercase tracking-widest rounded-md">
                                                    Installment
                                                </span>
                                            )}
                                            {h.has_installment_merged && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-[9px] font-black uppercase tracking-widest rounded-md">
                                                    Merged Installment
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {/* Net Amount from student_fees */}
                                    <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 tabular-nums text-right">{hSfNet.toLocaleString()}</span>
                                    {/* Deposited from student_fees.amount_paid */}
                                    <span className="text-[11px] font-bold text-zinc-500 tabular-nums text-right">{hSfDep.toLocaleString()}</span>
                                    {/* Balance = student_fees.amount - student_fees.amount_paid */}
                                    <span className={`text-[11px] font-black tabular-nums text-right ${hSfBal === 0 ? "text-emerald-600" : "text-zinc-900 dark:text-zinc-100"}`}>
                                        {hSfBal.toLocaleString()}
                                    </span>
                                    <div className="flex justify-end">
                                        {fillingMode === "manual" ? (
                                            <input type="text" inputMode="numeric" pattern="[0-9]*" value={manualDistributions[h.id] || ""}
                                                onChange={e => {
                                                    const v = e.target.value.replace(/[^0-9]/g,'');
                                                    setManualDistributions({ ...manualDistributions, [h.id]: v === "" || Number(v) <= hSfBal ? v : hSfBal.toString() });
                                                }}
                                                className="w-24 h-8 px-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-bold text-right focus:outline-none focus:border-primary transition-all font-mono" />
                                        ) : (
                                            <span className="text-[12px] font-black text-zinc-900 dark:text-zinc-100 tabular-nums">Rs. {Number(manualDistributions[h.id] || 0).toLocaleString()}</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* ── Arrear Surcharges Section ─────────────────────── */}
                        {(arrearSurcharges.length > 0 || waivedSurcharges.length > 0) && (
                            <>
                                <div className="pt-3 pb-1 px-1">
                                    <span className="flex items-center gap-2 text-[10px] font-black text-rose-500 uppercase tracking-[0.18em]">
                                        <ShieldAlert className="h-3.5 w-3.5" />
                                        Arrear Surcharges
                                    </span>
                                </div>

                                {/* Active (unpaid) surcharges */}
                                {arrearSurcharges.map(s => {
                                    const sBal = getSurchargeBalance(s);
                                    const sPaid = Number(s.amount_paid ?? 0);
                                    const sTotal = Number(s.amount);
                                    const sDistVal = Number(surchargeDistributions[s.id] || 0);
                                    return (
                                        <div
                                            key={s.id}
                                            className="grid grid-cols-[1fr_120px_120px_120px_130px] gap-x-4 items-center px-4 py-3 bg-rose-50/30 dark:bg-rose-900/10 border border-rose-100/60 dark:border-rose-900/30 rounded-2xl"
                                        >
                                            <div>
                                                <p className="text-[12px] font-black text-rose-600">
                                                    Late Surcharge — {getSurchargeLabel(s)}
                                                </p>
                                                <span className="inline-flex items-center px-1.5 py-0.5 bg-rose-100 dark:bg-rose-900/30 text-rose-600 text-[9px] font-black uppercase tracking-widest rounded-md mt-0.5">
                                                    Arrear Penalty
                                                </span>
                                            </div>
                                            <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 tabular-nums text-right">{sTotal.toLocaleString()}</span>
                                            <span className="text-[11px] font-bold text-zinc-500 tabular-nums text-right">{sPaid.toLocaleString()}</span>
                                            <span className={`text-[11px] font-black tabular-nums text-right ${sBal === 0 ? "text-emerald-600" : "text-rose-600"}`}>{sBal.toLocaleString()}</span>
                                            <div className="flex justify-end">
                                                {fillingMode === "manual" ? (
                                                    <input
                                                        type="text" inputMode="numeric" pattern="[0-9]*"
                                                        value={surchargeDistributions[s.id] || ""}
                                                        onChange={e => {
                                                            const v = e.target.value.replace(/[^0-9]/g, '');
                                                            setSurchargeDistributions({ ...surchargeDistributions, [s.id]: v === "" || Number(v) <= sBal ? v : sBal.toString() });
                                                        }}
                                                        className="w-24 h-8 px-2 bg-white dark:bg-zinc-950 border border-rose-200 dark:border-rose-900 rounded-lg text-xs font-bold text-right focus:outline-none focus:border-rose-400 transition-all font-mono"
                                                    />
                                                ) : (
                                                    <span className="text-[12px] font-black text-rose-600 tabular-nums">Rs. {sDistVal.toLocaleString()}</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Waived surcharges — display only */}
                                {waivedSurcharges.map(s => (
                                    <div key={s.id} className="grid grid-cols-[1fr_120px_120px_120px_130px] gap-x-4 items-center px-4 py-3 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800 rounded-2xl opacity-60">
                                        <div>
                                            <p className="text-[12px] font-black text-zinc-500">Late Surcharge — {getSurchargeLabel(s)}</p>
                                            <span className="inline-flex items-center px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-[9px] font-black uppercase tracking-widest rounded-md mt-0.5">
                                                Waived{s.waived_by ? ` by ${s.waived_by}` : ""}
                                            </span>
                                        </div>
                                        <span className="text-[11px] font-bold text-zinc-400 tabular-nums text-right">{Number(s.amount).toLocaleString()}</span>
                                        <span className="text-[11px] font-bold text-zinc-400 tabular-nums text-right">—</span>
                                        <span className="text-[11px] font-black text-emerald-500 tabular-nums text-right">0</span>
                                        <div className="flex justify-end">
                                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Waived</span>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}

                        {/* Summary totals row */}
                        <div className="grid grid-cols-[1fr_120px_120px_120px_130px] gap-x-4 items-center px-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                            <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Total</span>
                            <span className="text-[11px] font-black text-zinc-700 dark:text-zinc-300 tabular-nums text-right">{(heads.reduce((s,f) => s+sfNetAmt(f),0) + arrearSurcharges.reduce((s,x) => s+Number(x.amount),0)).toLocaleString()}</span>
                            <span className="text-[11px] font-black text-zinc-700 dark:text-zinc-300 tabular-nums text-right">{(heads.reduce((s,f) => s+sfDeposited(f),0) + arrearSurcharges.reduce((s,x) => s+Number(x.amount_paid??0),0)).toLocaleString()}</span>
                            <span className="text-[11px] font-black text-emerald-600 tabular-nums text-right">{(totalBalance + totalArrearSurchargeBalance).toLocaleString()}</span>
                            <span />
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="px-8 py-6 border-t border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-zinc-500 hover:text-zinc-700 transition-colors">Cancel</button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || (fillingMode === "manual" && remainingPool !== 0)}
                        className="flex items-center gap-2 px-8 py-3 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Record Deposit
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Voucher Row ─────────────────────────────────────────────────────────────

function VoucherRow({ voucher, index, sections, onDeposit }: { voucher: VoucherItem; index: number; sections: any[]; onDeposit: (v: VoucherItem) => void }) {
    const status = getStatusConfig(voucher.status);
    const isVoid = voucher.status === "VOID";

    // ── Fee Date: from first head's student_fee (they share the same date) ───────
    const feeDate = voucher.voucher_heads?.find(h => h.student_fees?.fee_date)?.student_fees?.fee_date
        ?? voucher.fee_date ?? null;

    // ── Amount Payable: sum of voucher_heads.balance (authoritative, already ───
    //    normalised by backend against student_fees)
    const heads = voucher.voucher_heads || [];
    const sfTotalNet = heads.reduce((s, h) => s + Number(h.student_fees?.amount ?? h.net_amount ?? 0), 0);
    const sfTotalDeposited = heads.reduce((s, h) => s + Math.max(Number(h.student_fees?.amount ?? h.net_amount ?? 0) - Number(h.balance ?? 0), 0), 0);
    const sfTotalBalance = heads.reduce((s, h) => s + Number(h.balance ?? 0), 0);

    return (
        <tr className={`group border-b border-zinc-100 dark:border-zinc-800/60 transition-colors ${
            isVoid ? "opacity-60 bg-zinc-50/50 dark:bg-zinc-900/20" : "hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
        }`}>
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
            <td className="px-5 py-3.5 text-center">
                <div className="flex flex-col items-center">
                    <span className="text-[12px] font-mono text-zinc-700 dark:text-zinc-300">
                        {formatDate(feeDate)}
                    </span>
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter leading-none">
                        {voucher.academic_year || "—"}
                    </span>
                </div>
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
                <span className={`inline-flex items-center px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border ${status.classes}`}>
                    {status.label}
                </span>
            </td>
            <td className="px-5 py-3.5">
                <div className="flex flex-col gap-0.5">
                    <span className={`text-[13px] font-black tabular-nums ${
                        isVoid ? "text-zinc-400" : "text-zinc-900 dark:text-zinc-100"
                    }`}>
                        Rs. {sfTotalBalance.toLocaleString()}
                    </span>
                    {!isVoid && sfTotalDeposited > 0 && (
                        <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-tight leading-none">
                            Paid: Rs. {sfTotalDeposited.toLocaleString()}
                        </span>
                    )}
                    {!isVoid && sfTotalBalance > 0 && sfTotalNet !== sfTotalBalance && (
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-tight leading-none">
                            Total: Rs. {sfTotalNet.toLocaleString()}
                        </span>
                    )}
                </div>
            </td>
            <td className="px-5 py-3.5">
                <div className="flex items-center gap-2">
                    {isVoid ? (
                        <button
                            onClick={() => onDeposit(voucher)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800/60 text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-not-allowed"
                            title="This voucher has been superseded. Its unpaid heads are included in a newer voucher."
                        >
                            <Ban className="h-3.5 w-3.5" />
                            Voided
                        </button>
                    ) : voucher.status !== "PAID" ? (
                        <button
                            onClick={() => onDeposit(voucher)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all active:scale-95"
                        >
                            <Wallet className="h-3.5 w-3.5" />
                            Deposit
                        </button>
                    ) : null}
                </div>
            </td>
        </tr>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VoucherDepositPage() {
    const dispatch = useAppDispatch();
    const user = useAppSelector(s => s.auth.user);

    // Redux data
    const vouchers = useAppSelector(s => s.vouchers.items);
    const vouchersLoading = useAppSelector(s => s.vouchers.isLoading);
    const vouchersError = useAppSelector(s => s.vouchers.error);
    const sections = useAppSelector(s => s.sections.items);

    // Search state
    const [searchMode, setSearchMode] = useState<"student" | "voucher">("student");
    const [searchQuery, setSearchQuery] = useState("");
    const [voucherIdInput, setVoucherIdInput] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<{ cc: number; full_name: string; gr_number: string }[]>([]);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const searchDropdownRef = useRef<HTMLDivElement>(null);

    // Filter state
    const [statusFilter, setStatusFilter] = useState("");
    const [activeStudent, setActiveStudent] = useState<{ cc: number; full_name: string } | null>(null);
    const [activeVoucherId, setActiveVoucherId] = useState<number | null>(null);

    // Modal state
    const [selectedVoucher, setSelectedVoucher] = useState<VoucherItem | null>(null);

    // Table state
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    // Initial load
    useEffect(() => {
        if (sections.length === 0) dispatch(fetchSections());

        const h = (e: MouseEvent) => {
            if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target as Node)) {
                setShowSearchDropdown(false);
            }
        };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [dispatch]);

    // Simple search effect
    useEffect(() => {
        if (searchMode !== "student" || !searchQuery.trim()) {
            setSearchResults([]);
            setShowSearchDropdown(false);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const { data } = await api.get(`/v1/students/search-simple?q=${searchQuery}`);
                setSearchResults(data?.data || []);
                setShowSearchDropdown(true);
            } catch (err) {
                console.error("Search failed:", err);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery, searchMode]);

    const handleSelectStudent = (student: { cc: number; full_name: string }) => {
        setActiveStudent(student);
        setActiveVoucherId(null);
        setSearchQuery("");
        setShowSearchDropdown(false);
        setPage(1);
        dispatch(fetchVouchersByStudent(student.cc));
    };

    const handleVoucherSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!voucherIdInput.trim()) return;

        const vid = parseInt(voucherIdInput);
        if (isNaN(vid)) {
            toast.error("Invalid Voucher ID");
            return;
        }

        setActiveVoucherId(vid);
        setActiveStudent(null);
        setPage(1);
        dispatch(fetchVouchers({ id: vid }));
    };

    const handleClearSearch = () => {
        setActiveStudent(null);
        setActiveVoucherId(null);
        setVoucherIdInput("");
        dispatch(clearVouchers());
    };

    const handleRefresh = () => {
        if (activeStudent) {
            dispatch(fetchVouchersByStudent(activeStudent.cc));
            toast.success("Vouchers refreshed");
        } else if (activeVoucherId) {
            dispatch(fetchVouchers({ id: activeVoucherId }));
            toast.success("Voucher refreshed");
        }
    };

    // Filter logic locally for status
    const filteredVouchers = statusFilter
        ? vouchers.filter(v => v.status === statusFilter)
        : vouchers;

    const totalPages = Math.ceil(filteredVouchers.length / pageSize);
    const paginatedVouchers = filteredVouchers.slice((page - 1) * pageSize, page * pageSize);

    return (
        <div className="space-y-6 pb-20">
            {/* ── Header ───────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                        <span className="p-2.5 bg-emerald-500/10 rounded-[20px]">
                            <Wallet className="h-7 w-7 text-emerald-600" />
                        </span>
                        Pay Vouchers
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1.5 text-sm font-medium">
                        Search student or voucher code, manage distributions, and record deposits.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Status Filter Integrated in Header */}
                    <div className="flex bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-1 rounded-xl shadow-sm">
                        {STATUS_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => { setStatusFilter(opt.value); setPage(1); }}
                                className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all
                                    ${statusFilter === opt.value
                                        ? "bg-primary text-white shadow-md shadow-primary/20"
                                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600"
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={handleRefresh}
                        disabled={vouchersLoading || (!activeStudent && !activeVoucherId)}
                        className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-400 hover:text-primary transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={`h-5 w-5 ${vouchersLoading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* ── Simple Search Area ───────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-12">
                    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-sm">
                        <div className="max-w-3xl mx-auto space-y-6">
                            {/* Search Mode Toggle */}
                            <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-[14px] w-fit mx-auto border border-zinc-200 dark:border-zinc-800">
                                <button
                                    onClick={() => { setSearchMode("student"); handleClearSearch(); }}
                                    className={`px-6 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${searchMode === "student" ? "bg-white dark:bg-zinc-950 text-primary shadow-sm" : "text-zinc-400"}`}
                                >
                                    Search Student
                                </button>
                                <button
                                    onClick={() => { setSearchMode("voucher"); handleClearSearch(); }}
                                    className={`px-6 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${searchMode === "voucher" ? "bg-white dark:bg-zinc-950 text-primary shadow-sm" : "text-zinc-400"}`}
                                >
                                    Voucher Code
                                </button>
                            </div>

                            {searchMode === "student" ? (
                                <div className="relative" ref={searchDropdownRef}>
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">Student Search</label>
                                    <div className="relative">
                                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                                        <input
                                            type="text"
                                            placeholder="Search by Name, CC, or GR Number..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full h-16 pl-14 pr-14 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[24px] text-lg font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                                        />
                                        {isSearching && (
                                            <div className="absolute right-5 top-1/2 -translate-y-1/2">
                                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                            </div>
                                        )}
                                        {searchQuery && !isSearching && (
                                            <button onClick={() => setSearchQuery("")} className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                                                <X className="h-5 w-5" />
                                            </button>
                                        )}
                                    </div>

                                    {showSearchDropdown && searchResults.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[28px] shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
                                            <div className="max-h-[400px] overflow-y-auto p-2">
                                                {searchResults.map((res) => (
                                                    <button
                                                        key={res.cc}
                                                        onClick={() => handleSelectStudent(res)}
                                                        className="w-full px-6 py-4 flex items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all border-b border-zinc-50 dark:border-zinc-900 last:border-0 text-left group rounded-2xl"
                                                    >
                                                        <div className="h-12 w-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                                                            <UserCircle className="h-7 w-7" />
                                                        </div>
                                                        <div>
                                                            <p className="text-base font-black text-zinc-900 dark:text-zinc-100">{res.full_name}</p>
                                                            <div className="flex items-center gap-3 mt-1">
                                                                <span className="text-[10px] font-black text-primary uppercase tracking-wider bg-primary/5 px-2 py-0.5 rounded-md">CC: {res.cc}</span>
                                                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">GR: {res.gr_number}</span>
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <form onSubmit={handleVoucherSearch} className="relative">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">Quick Voucher ID</label>
                                    <div className="relative">
                                        <Hash className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                                        <input
                                            type="number"
                                            placeholder="Enter exact Voucher ID (e.g. 1042)"
                                            value={voucherIdInput}
                                            onChange={(e) => setVoucherIdInput(e.target.value)}
                                            className="w-full h-16 pl-14 pr-14 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[24px] text-lg font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                                        />
                                        <button
                                            type="submit"
                                            className="absolute right-3 top-1/2 -translate-y-1/2 px-5 py-2.5 bg-zinc-900 dark:bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all active:scale-95"
                                        >
                                            Lookup
                                        </button>
                                    </div>
                                </form>
                            )}

                            {activeStudent && (
                                <div className="flex items-center justify-between p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-[24px] animate-in slide-in-from-bottom-2">
                                    <div className="flex items-center gap-5">
                                        <div className="h-14 w-14 bg-white dark:bg-zinc-900 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-center text-emerald-600 shadow-sm">
                                            <UserSearch className="h-7 w-7" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">Active Selection</p>
                                            <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100">{activeStudent.full_name}</h3>
                                            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Student ID: CC-{activeStudent.cc}</p>
                                        </div>
                                    </div>
                                    <button onClick={handleClearSearch} className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 text-rose-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-500/20 transition-all">
                                        <X className="h-4 w-4" /> Reset
                                    </button>
                                </div>
                            )}

                            {activeVoucherId && (
                                <div className="flex items-center justify-between p-6 bg-primary/5 border border-primary/20 rounded-[24px] animate-in slide-in-from-bottom-2">
                                    <div className="flex items-center gap-5">
                                        <div className="h-14 w-14 bg-white dark:bg-zinc-900 rounded-2xl border border-primary/10 flex items-center justify-center text-primary shadow-sm">
                                            <Hash className="h-7 w-7" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Active Lookup</p>
                                            <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100">Voucher #{activeVoucherId}</h3>
                                            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Direct ID search results</p>
                                        </div>
                                    </div>
                                    <button onClick={handleClearSearch} className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 text-rose-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-500/20 transition-all">
                                        <X className="h-4 w-4" /> Reset
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Error Banner ─────────────────────────────────────────────── */}
            {vouchersError && (
                <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl p-4 text-sm">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <span className="font-medium">{vouchersError}</span>
                </div>
            )}

            {/* ── Table ────────────────────────────────────────────────────── */}
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] shadow-sm overflow-hidden">
                <div className="px-8 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/30">
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-bold text-zinc-900 dark:text-zinc-300">
                            {vouchersLoading ? "Searching…" : `${filteredVouchers.length.toLocaleString()} voucher${filteredVouchers.length !== 1 ? "s" : ""}`}
                        </span>
                        {statusFilter && (
                            <span className="text-[10px] font-black bg-primary text-white px-3 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-primary/20">
                                {statusFilter}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em]">Limit</label>
                        <select
                            value={pageSize}
                            onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                            className="h-9 px-3 text-xs font-black bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all cursor-pointer"
                        >
                            {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                </div>

                {vouchersLoading ? (
                    <div className="flex flex-col items-center justify-center py-40 gap-5">
                        <div className="relative">
                            <Loader2 className="h-14 w-14 animate-spin text-primary" />
                            <Wallet className="h-6 w-6 text-primary/30 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        </div>
                        <p className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.25em] animate-pulse">Retrieving Ledgers…</p>
                    </div>
                ) : filteredVouchers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-40 gap-6 text-center">
                        <div className="p-10 bg-zinc-50 dark:bg-zinc-900 rounded-full border border-zinc-200 dark:border-zinc-800 shadow-inner">
                            <Receipt className="h-12 w-12 text-zinc-200 dark:text-zinc-700" />
                        </div>
                        <div className="space-y-2">
                            <p className="font-black text-xl text-zinc-900 dark:text-zinc-100">Zero Vouchers Found</p>
                            <p className="text-sm text-zinc-400 font-medium">
                                {activeStudent ? "This student doesn't have any matching vouchers." : "Start by searching for a student CC or Name above."}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-auto">
                        <table className="w-full border-collapse">
                            <thead className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800">
                                <tr>
                                    {["ID", "Student", "Campus", "Fee Date", "Issue Date", "Due Date", "Validity", "Status", "Amount Payable", "Actions"].map(h => (
                                        <th key={h} className="px-6 py-5 text-left text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] whitespace-nowrap">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                                {paginatedVouchers.map((v, i) => (
                                    <VoucherRow
                                        key={v.id}
                                        voucher={v}
                                        index={(page - 1) * pageSize + i}
                                        sections={sections}
                                        onDeposit={(v) => setSelectedVoucher(v)}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {!vouchersLoading && totalPages > 1 && (
                    <div className="px-8 py-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/30">
                        <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
                            Ledger Page {page} <span className="mx-2 text-zinc-200">/</span> {totalPages}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-900 disabled:opacity-40 transition-all shadow-sm"
                            >
                                <ChevronLeft className="h-5 w-5 text-zinc-600" />
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let p: number;
                                if (totalPages <= 5) { p = i + 1; }
                                else if (page <= 3) { p = i + 1; }
                                else if (page >= totalPages - 2) { p = totalPages - 4 + i; }
                                else { p = page - 2 + i; }
                                return (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p)}
                                        className={`w-10 h-10 rounded-xl text-xs font-black transition-all shadow-sm
                                            ${p === page ? "bg-primary text-white scale-110 shadow-lg shadow-primary/20" : "border border-zinc-200 dark:border-zinc-800 text-zinc-500 bg-white hover:bg-zinc-50"}`}
                                    >
                                        {p}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-900 disabled:opacity-40 transition-all shadow-sm"
                            >
                                <ChevronRight className="h-5 w-5 text-zinc-600" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Deposit Modal */}
            {selectedVoucher && (
                <DepositModal
                    voucher={selectedVoucher}
                    onClose={() => setSelectedVoucher(null)}
                    onSuccess={() => {
                        setSelectedVoucher(null);
                        handleRefresh();
                    }}
                />
            )}
        </div>
    );
}
