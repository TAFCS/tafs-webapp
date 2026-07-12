"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
    Search,
    Loader2,
    TrendingUp,
    History,
    AlertCircle,
    ChevronDown,
    User,
    Building2,
    GraduationCap,
    Hash,
    FileText,
    Info,
    SearchX,
    Receipt,
    RefreshCw,
    X,
    Trash2,
    Wallet,
    CreditCard,
    ChevronRight,
    Calendar,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { formatPaymentMethod } from "@/lib/payment-methods";

// --- Types ---

interface StudentProfile {
    cc: number;
    gr_number: string;
    full_name: string;
    photograph_url?: string;
    campuses: { campus_name: string; campus_code: string };
    classes: { description: string; class_code: string };
    sections: { description: string };
    status: string;
    is_fee_endowment?: boolean;
    is_complementary?: boolean;
}

interface DepositAllocation {
    amount: number;
    type?: "FEE_HEAD" | "LATE_FEE" | "SURCHARGE";
    fee_type_description?: string;
    fee_date?: string | null;
    target_month?: number | null;
    academic_year?: string | null;
    student_fee_id?: number;
    voucher_id?: number;
}

interface DepositItem {
    id: number;
    deposit_date: string;
    total_amount: number;
    payment_method: string;
    reference_number?: string;
    remarks?: string;
    allocations: DepositAllocation[];
    // True only for this student's single most recent deposit — deposits can
    // only be reversed most-recent-first (see assertDepositIsLatest on the backend).
    is_latest?: boolean;
}

interface PaymentStats {
    total_due: number;
    total_paid: number;
    collection_rate: number;
    still_outstanding: number;
    total_surcharges_charged: number;
    total_surcharges_waived: number;
}

interface PaymentHistoryResponse {
    student: StudentProfile;
    stats: PaymentStats;
    deposits: DepositItem[];
}

// --- Shared Micro-components ---

const SimpleBadge = ({ children, color = "zinc" }: { children: React.ReactNode; color?: string }) => {
    const colors: Record<string, string> = {
        green: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
        amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
        rose: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800",
        blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
        zinc: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
    };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border ${colors[color]}`}>
            {children}
        </span>
    );
};

const StatCard = ({
    title,
    value,
    subValues,
    icon: Icon,
    color,
    progress,
}: {
    title: string;
    value: string | number;
    subValues?: { label: string; value: string | number; color?: string }[];
    icon: any;
    color: string;
    progress?: number;
}) => (
    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-6 shadow-sm flex flex-col gap-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
            <div className={`p-3 rounded-2xl ${color.replace("text-", "bg-").replace("-600", "-50")} dark:${color.replace("text-", "bg-").replace("-600", "-900/20")}`}>
                <Icon className={`h-6 w-6 ${color}`} />
            </div>
            {progress !== undefined && (
                <span className={`text-xl font-black ${color}`}>{progress}%</span>
            )}
        </div>
        <div className="space-y-1">
            <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">{title}</p>
            <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tabular-nums">{value}</p>
        </div>
        {progress !== undefined && (
            <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className={`h-full ${color.replace("text-", "bg-")}`}
                />
            </div>
        )}
        {subValues && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 border-t border-zinc-100 dark:border-zinc-800/50">
                {subValues.map((sv, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">{sv.label}:</span>
                        <span className={`text-[11px] font-black ${sv.color || "text-zinc-600 dark:text-zinc-400"}`}>{sv.value}</span>
                    </div>
                ))}
            </div>
        )}
    </div>
);

// --- Reverse Deposit Modal ---

function ReverseDepositModal({
    isOpen,
    deposit,
    onClose,
    onSuccess,
}: {
    isOpen: boolean;
    deposit: DepositItem | null;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen || !deposit) return null;

    const handleReverse = async () => {
        setIsLoading(true);
        const loadingToast = toast.loading("Reversing deposit...");
        try {
            // Clear this deposit's allocations voucher-by-voucher via /clear-deposit —
            // it recalculates each voucher from its remaining allocations (correct even
            // when other deposits still exist against it) and properly reactivates/cleans
            // up split artifacts, unlike the blanket-reset /v1/deposits/:id DELETE route.
            const voucherIds = [...new Set(
                deposit.allocations.map(a => a.voucher_id).filter((v): v is number => v != null)
            )];
            for (const voucherId of voucherIds) {
                await api.post(`/v1/vouchers/${voucherId}/clear-deposit`, { depositId: deposit.id });
            }
            toast.dismiss(loadingToast);
            toast.success("Deposit reversed and removed successfully");
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.dismiss(loadingToast);
            toast.error(error?.response?.data?.message || "Failed to reverse deposit");
        } finally {
            setIsLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-8 py-6 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-rose-100 dark:bg-rose-900/20 rounded-2xl flex items-center justify-center">
                            <AlertCircle className="h-6 w-6 text-rose-600 dark:text-rose-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100">Reverse Deposit?</h2>
                            <p className="text-xs text-zinc-400 font-bold mt-0.5">RCP-{deposit.id}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-50"
                    >
                        <X className="h-5 w-5 text-zinc-400" />
                    </button>
                </div>

                <div className="p-8 space-y-5">
                    <div className="flex items-start gap-4 p-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800/40 rounded-2xl">
                        <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        <div className="space-y-2">
                            <p className="text-sm font-black text-rose-800 dark:text-rose-300">Destructive — cannot be undone without manual intervention</p>
                            <ul className="text-xs text-rose-700 dark:text-rose-400 leading-relaxed space-y-1 list-disc list-inside">
                                <li>This deposit's allocations will be permanently deleted and its amount removed from each affected voucher</li>
                                <li>Affected vouchers and fee heads are recalculated from whatever payment history remains — fully reverting to UNPAID/ISSUED only if this was their only deposit</li>
                                <li>A voucher that became fully PAID via a split will be restored and its balance counterpart cleaned up</li>
                                <li>Issue / due / validity dates are cleared only on fee heads left with no remaining payment</li>
                            </ul>
                        </div>
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl p-5 space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-zinc-500 font-bold">Date</span>
                            <span className="font-black text-zinc-900 dark:text-zinc-100">
                                {new Date(deposit.deposit_date).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-zinc-500 font-bold">Amount</span>
                            <span className="font-black text-emerald-600">PKR {deposit.total_amount.toLocaleString("en-PK")}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-zinc-500 font-bold">Channel</span>
                            <span className="font-black text-zinc-900 dark:text-zinc-100">{formatPaymentMethod(deposit.payment_method)}</span>
                        </div>
                        {deposit.reference_number && (
                            <div className="flex justify-between text-sm">
                                <span className="text-zinc-500 font-bold">Reference</span>
                                <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{deposit.reference_number}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-sm pt-2 border-t border-zinc-200 dark:border-zinc-700">
                            <span className="text-zinc-500 font-bold">Fee Heads Affected</span>
                            <span className="font-black text-zinc-900 dark:text-zinc-100">{deposit.allocations.length}</span>
                        </div>
                    </div>
                </div>

                <div className="px-8 py-6 border-t border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-6 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl font-bold text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleReverse}
                        disabled={isLoading}
                        className="px-6 py-2.5 bg-rose-600 text-white rounded-xl font-bold text-sm hover:bg-rose-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        {isLoading ? "Reversing..." : "Reverse & Delete"}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// --- Student Search ---

function StudentSearch({ onSelect }: { onSelect: (cc: number) => void }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (!query.trim()) { setResults([]); setOpen(false); return; }
        const timer = setTimeout(async () => {
            setLoading(true);
            setOpen(true);
            try {
                const { data } = await api.get("/v1/students/search-simple", { params: { q: query } });
                setResults(data?.data || []);
            } catch {
                // silent
            } finally {
                setLoading(false);
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [query]);

    return (
        <div className="relative w-full lg:w-96" ref={searchRef}>
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-primary transition-colors" />
                <input
                    type="text"
                    placeholder="Search CC, Name, GR..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query.trim() && setOpen(true)}
                    className="w-full h-14 pl-12 pr-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 transition-all"
                />
                {query && (
                    <button
                        onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full"
                    >
                        <X className="h-4 w-4 text-zinc-400" />
                    </button>
                )}
            </div>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.98 }}
                        className="absolute top-full mt-3 w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] shadow-2xl z-50 overflow-hidden"
                    >
                        {loading ? (
                            <div className="p-8 flex items-center justify-center gap-3 text-zinc-400 text-sm font-bold">
                                <Loader2 className="h-5 w-5 animate-spin" /> Searching database...
                            </div>
                        ) : results.length === 0 ? (
                            <div className="p-8 flex flex-col items-center justify-center text-center gap-2">
                                <SearchX className="h-8 w-8 text-zinc-200" />
                                <p className="text-sm font-bold text-zinc-400">No students found for "{query}"</p>
                            </div>
                        ) : (
                            <div className="p-2">
                                {results.map((s) => (
                                    <button
                                        key={s.cc}
                                        onClick={() => { onSelect(s.cc); setOpen(false); setQuery(""); }}
                                        className="w-full flex items-center gap-4 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-2xl transition-colors text-left"
                                    >
                                        <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                                            {s.photograph_url
                                                ? <img src={s.photograph_url} className="w-full h-full object-cover" alt="" />
                                                : <User className="h-5 w-5 text-zinc-400" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black text-zinc-900 dark:text-zinc-100 truncate">{s.full_name}</p>
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                                <span>CC: {s.cc}</span>
                                                <span className="w-1 h-1 rounded-full bg-zinc-200" />
                                                <span>GR: {s.gr_number || "N/A"}</span>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-zinc-200" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// --- Main Page ---

export default function PaymentHistoryPage() {
    const [academicYear, setAcademicYear] = useState("2025-2026");
    const [data, setData] = useState<PaymentHistoryResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    const [selectedStudentCc, setSelectedStudentCc] = useState<number | null>(null);
    const [reverseModal, setReverseModal] = useState<DepositItem | null>(null);

    const toggleRow = (id: number) => {
        const next = new Set(expandedRows);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedRows(next);
    };

    const fetchHistory = useCallback(async (cc: number, year?: string) => {
        setLoading(true);
        setSelectedStudentCc(cc);
        try {
            const { data: response } = await api.get(`/v1/students/${cc}/payment-history`, {
                params: { academic_year: year || academicYear },
            });
            setData(response.data);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Failed to load payment history");
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [academicYear]);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(amount);

    const totalDeposited = data?.deposits.reduce((s, d) => s + d.total_amount, 0) ?? 0;

    return (
        <div className="max-w-[1400px] mx-auto p-6 space-y-8 pb-32">
            {/* Header */}
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[40px] p-6 shadow-xl shadow-zinc-200/10 dark:shadow-none">
                <div className="flex flex-col lg:flex-row items-center gap-8">
                    <StudentSearch onSelect={fetchHistory} />

                    {data?.student && (
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex-1 flex items-center gap-6 border-l border-zinc-100 dark:border-zinc-800 pl-8"
                        >
                            <div className="relative">
                                <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-white dark:border-zinc-800 shadow-sm">
                                    {data.student.photograph_url
                                        ? <img src={data.student.photograph_url} alt="Profile" className="w-full h-full object-cover" />
                                        : <User className="h-8 w-8 text-zinc-300" />}
                                </div>
                                <div className="absolute -bottom-2 -right-2">
                                    <SimpleBadge color={data.student.status === "ENROLLED" ? "green" : "rose"}>
                                        {data.student.status}
                                    </SimpleBadge>
                                </div>
                            </div>

                            <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-3">
                                    <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">{data.student.full_name}</h1>
                                    <div className="flex gap-1.5">
                                        {data.student.is_fee_endowment && <SimpleBadge color="blue">Endowment</SimpleBadge>}
                                        {data.student.is_complementary && <SimpleBadge color="amber">Complementary</SimpleBadge>}
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
                                    <div className="flex items-center gap-1.5"><Hash className="h-3 w-3" /> CC: {data.student.cc}</div>
                                    <div className="flex items-center gap-1.5"><FileText className="h-3 w-3" /> GR: {data.student.gr_number}</div>
                                    <div className="flex items-center gap-1.5"><Building2 className="h-3 w-3" /> {data.student.campuses?.campus_name}</div>
                                    <div className="flex items-center gap-1.5"><GraduationCap className="h-3 w-3" /> {data.student.classes?.description} • {data.student.sections?.description}</div>
                                </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Academic Year</label>
                                    <select
                                        value={academicYear}
                                        onChange={(e) => {
                                            const y = e.target.value;
                                            setAcademicYear(y);
                                            if (selectedStudentCc) fetchHistory(selectedStudentCc, y);
                                        }}
                                        className="h-12 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-black uppercase tracking-widest outline-none focus:border-primary transition-all cursor-pointer"
                                    >
                                        <option value="2025-2026">2025-2026</option>
                                        <option value="2024-2025">2024-2025</option>
                                        <option value="2023-2024">2023-2024</option>
                                    </select>
                                </div>
                                <button
                                    onClick={() => selectedStudentCc && fetchHistory(selectedStudentCc)}
                                    className="w-12 h-12 flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:bg-zinc-100 transition-all"
                                    title="Refresh"
                                >
                                    <RefreshCw className={`h-5 w-5 text-zinc-400 ${loading ? "animate-spin" : ""}`} />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>

            {!data ? (
                <div className="py-40 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="w-24 h-24 bg-zinc-50 dark:bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-100 dark:border-zinc-800">
                        {loading
                            ? <Loader2 className="h-10 w-10 text-primary animate-spin" />
                            : <SearchX className="h-10 w-10 text-zinc-300" />}
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100">
                            {loading ? "Loading Deposit Ledger..." : "Select a Student to Begin"}
                        </h3>
                        <p className="text-zinc-400 text-sm mt-1 max-w-sm mx-auto">
                            Search by Name, Computer Code or G.R. Number above to view the full deposit history.
                        </p>
                    </div>
                </div>
            ) : (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="space-y-10"
                >
                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard
                            title="Collection Strength"
                            value={formatCurrency(data.stats.total_paid)}
                            progress={Math.round(data.stats.collection_rate)}
                            color="text-emerald-600"
                            icon={TrendingUp}
                            subValues={[
                                { label: "Total Due", value: formatCurrency(data.stats.total_due) },
                                { label: "Outstanding", value: formatCurrency(data.stats.still_outstanding), color: "text-rose-600" },
                            ]}
                        />
                        <StatCard
                            title="Total Deposited"
                            value={formatCurrency(totalDeposited)}
                            color="text-blue-600"
                            icon={Wallet}
                            subValues={[
                                { label: "Receipts", value: `${data.deposits.length}` },
                                { label: "Avg", value: data.deposits.length > 0 ? formatCurrency(totalDeposited / data.deposits.length) : "—" },
                            ]}
                        />
                        <StatCard
                            title="Surcharges"
                            value={formatCurrency(data.stats.total_surcharges_charged)}
                            color="text-rose-600"
                            icon={Receipt}
                            subValues={[
                                { label: "Waived", value: formatCurrency(data.stats.total_surcharges_waived), color: "text-emerald-600" },
                                { label: "Net", value: formatCurrency(data.stats.total_surcharges_charged - data.stats.total_surcharges_waived), color: "text-rose-600" },
                            ]}
                        />
                        <StatCard
                            title="Balance Remaining"
                            value={formatCurrency(data.stats.still_outstanding)}
                            color={data.stats.still_outstanding === 0 ? "text-emerald-600" : "text-amber-600"}
                            icon={CreditCard}
                            subValues={[
                                { label: "Status", value: data.stats.still_outstanding === 0 ? "Fully Cleared" : "Partially Recovered", color: data.stats.still_outstanding === 0 ? "text-emerald-600" : "text-amber-600" },
                            ]}
                        />
                    </div>

                    {/* Deposit Ledger */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-zinc-100 dark:bg-zinc-900 rounded-xl">
                                <History className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                            </div>
                            <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">
                                Deposit Ledger
                                <span className="ml-3 text-sm text-zinc-400 font-bold">{data.deposits.length}</span>
                            </h2>
                        </div>

                        {data.deposits.length === 0 ? (
                            <div className="py-24 flex flex-col items-center justify-center text-center gap-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px]">
                                <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-100 dark:border-zinc-800">
                                    <Receipt className="h-8 w-8 text-zinc-200" />
                                </div>
                                <div>
                                    <p className="text-base font-black text-zinc-900 dark:text-zinc-100">No Deposits Found</p>
                                    <p className="text-sm text-zinc-400 mt-1">No deposits have been recorded for this student in {academicYear}.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] overflow-hidden shadow-sm">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                                        <tr className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                                            <th className="px-6 py-4">Receipt</th>
                                            <th className="px-6 py-4">Date & Time</th>
                                            <th className="px-6 py-4 text-right">Amount</th>
                                            <th className="px-6 py-4">Channel</th>
                                            <th className="px-6 py-4">Reference</th>
                                            <th className="px-6 py-4 text-center">Heads</th>
                                            <th className="px-6 py-4 text-center">Action</th>
                                            <th className="px-6 py-4 w-8"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                        {data.deposits.map((deposit) => (
                                            <DepositRow
                                                key={deposit.id}
                                                deposit={deposit}
                                                isExpanded={expandedRows.has(deposit.id)}
                                                onToggle={() => toggleRow(deposit.id)}
                                                formatCurrency={formatCurrency}
                                                onReverse={() => setReverseModal(deposit)}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}

            <ReverseDepositModal
                isOpen={!!reverseModal}
                deposit={reverseModal}
                onClose={() => setReverseModal(null)}
                onSuccess={() => selectedStudentCc && fetchHistory(selectedStudentCc)}
            />
        </div>
    );
}

// --- Deposit Row ---

const DepositRow = ({
    deposit,
    isExpanded,
    onToggle,
    formatCurrency,
    onReverse,
}: {
    deposit: DepositItem;
    isExpanded: boolean;
    onToggle: () => void;
    formatCurrency: (n: number) => string;
    onReverse: () => void;
}) => (
    <>
        <tr
            onClick={onToggle}
            className="group hover:bg-zinc-50 dark:hover:bg-zinc-900/40 cursor-pointer transition-colors"
        >
            <td className="px-6 py-5">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
                        <Receipt className="h-4 w-4 text-zinc-400 group-hover:text-primary transition-colors" />
                    </div>
                    <span className="text-sm font-black text-zinc-900 dark:text-zinc-100">RCP-{deposit.id}</span>
                </div>
            </td>
            <td className="px-6 py-5">
                <div className="flex flex-col">
                    <span className="text-[11px] font-black text-zinc-900 dark:text-zinc-100">
                        {new Date(deposit.deposit_date).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-400">
                        {new Date(deposit.deposit_date).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                </div>
            </td>
            <td className="px-6 py-5 text-right">
                <span className="text-sm font-black text-emerald-600">{formatCurrency(deposit.total_amount)}</span>
            </td>
            <td className="px-6 py-5">
                <SimpleBadge color="blue">{formatPaymentMethod(deposit.payment_method)}</SimpleBadge>
            </td>
            <td className="px-6 py-5 font-mono text-[10px] text-zinc-500">
                {deposit.reference_number || "—"}
            </td>
            <td className="px-6 py-5 text-center">
                <span className="text-[11px] font-black text-zinc-500 bg-zinc-100 dark:bg-zinc-900 px-2.5 py-1 rounded-full">
                    {deposit.allocations.length}
                </span>
            </td>
            <td className="px-6 py-5 text-center" onClick={(e) => e.stopPropagation()}>
                {deposit.is_latest ? (
                    <button
                        onClick={onReverse}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-900/10 hover:bg-rose-100 dark:hover:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors"
                        title="Reverse this deposit"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Reverse
                    </button>
                ) : (
                    <button
                        disabled
                        title="Only the most recent deposit can be reversed. Reverse newer deposits first."
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-900/30 text-zinc-300 dark:text-zinc-700 border border-zinc-200 dark:border-zinc-800 rounded-lg text-[10px] font-black uppercase tracking-widest cursor-not-allowed"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Reverse
                    </button>
                )}
            </td>
            <td className="px-6 py-5">
                <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
            </td>
        </tr>

        <AnimatePresence>
            {isExpanded && (
                <tr>
                    <td colSpan={8} className="p-0 bg-zinc-50/50 dark:bg-zinc-900/20">
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="p-8 max-w-4xl space-y-6">
                                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Info className="h-3.5 w-3.5" /> Allocation Breakdown — {deposit.allocations.length} fee heads
                                </h4>

                                <div className="space-y-2.5">
                                    {deposit.allocations.map((a, i) => {
                                        const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                                        const accentColor =
                                            a.type === "LATE_FEE" ? "bg-rose-500" :
                                            a.type === "SURCHARGE" ? "bg-amber-500" :
                                            "bg-emerald-500";
                                        const accentShadow =
                                            a.type === "LATE_FEE" ? "shadow-[0_0_10px_rgba(244,63,94,0.3)]" :
                                            a.type === "SURCHARGE" ? "shadow-[0_0_10px_rgba(245,158,11,0.3)]" :
                                            "shadow-[0_0_10px_rgba(16,185,129,0.3)]";
                                        const typeBadgeColor =
                                            a.type === "LATE_FEE" ? "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/10 dark:text-rose-400 dark:border-rose-800/40" :
                                            a.type === "SURCHARGE" ? "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/10 dark:text-amber-400 dark:border-amber-800/40" :
                                            "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-800/40";
                                        const amountColor =
                                            a.type === "LATE_FEE" ? "text-rose-600" :
                                            a.type === "SURCHARGE" ? "text-amber-600" :
                                            "text-emerald-600";

                                        const feeDate = a.fee_date
                                            ? new Date(a.fee_date).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })
                                            : null;
                                        const monthLabel = a.target_month != null
                                            ? MONTH_NAMES[(a.target_month - 1 + 12) % 12]
                                            : null;

                                        return (
                                            <div
                                                key={i}
                                                className="bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-4 shadow-sm"
                                            >
                                                <div className="flex items-start gap-4 flex-1 min-w-0">
                                                    <div className={`w-1.5 mt-1 h-12 ${accentColor} rounded-full ${accentShadow} shrink-0`} />
                                                    <div className="flex-1 min-w-0 space-y-2">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="text-sm font-black text-zinc-900 dark:text-zinc-100">
                                                                {a.fee_type_description || "Fee Allocation"}
                                                            </p>
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${typeBadgeColor}`}>
                                                                {a.type ?? "FEE_HEAD"}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                                            {feeDate && (
                                                                <span className="flex items-center gap-1">
                                                                    <Calendar className="h-3 w-3" /> Fee Date: {feeDate}
                                                                </span>
                                                            )}
                                                            {monthLabel && (
                                                                <span className="flex items-center gap-1">
                                                                    <Hash className="h-3 w-3" /> Month: {monthLabel}
                                                                </span>
                                                            )}
                                                            {a.academic_year && (
                                                                <span className="flex items-center gap-1">
                                                                    <GraduationCap className="h-3 w-3" /> {a.academic_year}
                                                                </span>
                                                            )}
                                                            {a.voucher_id && (
                                                                <span className="flex items-center gap-1">
                                                                    <FileText className="h-3 w-3" /> VCH-{a.voucher_id}
                                                                </span>
                                                            )}
                                                            {a.student_fee_id && (
                                                                <span>Fee #{a.student_fee_id}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className={`text-base font-black shrink-0 ${amountColor}`}>{formatCurrency(a.amount)}</span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {deposit.remarks && (
                                    <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-900/30 rounded-2xl flex items-start gap-3">
                                        <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mb-1">Remarks</p>
                                            <p className="text-sm text-blue-800/80 dark:text-blue-300/80 font-medium italic">"{deposit.remarks}"</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </td>
                </tr>
            )}
        </AnimatePresence>
    </>
);
