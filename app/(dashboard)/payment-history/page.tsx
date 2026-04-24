"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { 
    Search, 
    Loader2, 
    Calendar, 
    CreditCard, 
    TrendingUp, 
    History, 
    CheckCircle2, 
    Clock, 
    XCircle, 
    AlertCircle,
    ChevronDown,
    ChevronRight,
    Download,
    ExternalLink,
    FileText,
    User,
    Building2,
    GraduationCap,
    Hash,
    ShieldAlert,
    Wallet,
    Info,
    ArrowUpRight,
    SearchX,
    Receipt,
    RefreshCw,
    X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";
import toast from "react-hot-toast";

// --- Types & Interfaces ---

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
    fee_start_term?: string;
}

interface PaymentStats {
    total_due: number;
    total_paid: number;
    collection_rate: number;
    paid_on_time: number;
    paid_late: number;
    still_outstanding: number;
    total_arrears_ever: number;
    total_surcharges_charged: number;
    total_surcharges_waived: number;
    avg_days_to_pay: number;
    fastest_payment_days: number;
    slowest_payment_days: number;
}

interface VoucherHead {
    id: number;
    description: string;
    is_arrear: boolean;
    is_arrear_surcharge: boolean;
    net_amount: number;
    amount_deposited: number;
    balance: number;
    source_fee_id: number;
}

interface DepositAllocation {
    id?: number;
    deposit_id?: number;
    deposit_date?: string;
    amount: number;
    payment_method?: string;
    reference_number?: string;
    remarks?: string;
    student_fee_id?: number;
    voucher_id?: number;
    fee_type_description?: string;
}

interface VoucherHistoryItem {
    id: number;
    issue_date: string;
    due_date: string;
    validity_date: string;
    fee_date: string;
    status: 'PAID' | 'UNPAID' | 'PARTIALLY_PAID' | 'VOID';
    total_payable_before_due: number;
    total_payable_after_due: number;
    total_arrears: number;
    total_arrear_surcharge: number;
    surcharge_waived: boolean;
    surcharge_waived_by?: string;
    bank_accounts?: { bank_name: string };
    pdf_url?: string;
    heads: VoucherHead[];
    deposit_allocations: DepositAllocation[];
}

interface FeeHead {
    id: number;
    fee_type_description: string;
    fee_date: string;
    target_month: number;
    amount: number;
    amount_before_discount?: number;
    amount_paid: number;
    balance: number;
    status: 'NOT_ISSUED' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID';
    is_arrear_surcharge: boolean;
    installment_label?: string;
    bundle_name?: string;
    deposit_trail: DepositAllocation[];
}

interface MonthGroup {
    target_month: number;
    academic_year: string;
    month_total_due: number;
    month_total_paid: number;
    month_balance: number;
    heads: FeeHead[];
}

interface DepositItem {
    id: number;
    deposit_date: string;
    total_amount: number;
    payment_method: string;
    reference_number?: string;
    remarks?: string;
    allocations: DepositAllocation[];
}

interface PaymentHistoryResponse {
    student: StudentProfile;
    stats: PaymentStats;
    vouchers: VoucherHistoryItem[];
    fee_heads: MonthGroup[];
    deposits: DepositItem[];
}

// --- Shared Components ---

const StatCard = ({ title, value, subValues, icon: Icon, color, progress }: { title: string; value: string | number; subValues?: { label: string; value: string | number; color?: string }[]; icon: any; color: string; progress?: number }) => (
    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-6 shadow-sm flex flex-col gap-4 relative overflow-hidden group hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
            <div className={`p-3 rounded-2xl ${color.replace('text-', 'bg-').replace('-600', '-50')} dark:${color.replace('text-', 'bg-').replace('-600', '-900/20')}`}>
                <Icon className={`h-6 w-6 ${color}`} />
            </div>
            {progress !== undefined && (
                <div className="flex flex-col items-end">
                    <span className={`text-xl font-black ${color}`}>{progress}%</span>
                </div>
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
                    className={`h-full ${color.replace('text-', 'bg-')}`}
                />
            </div>
        )}

        {subValues && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 border-t border-zinc-100 dark:border-zinc-800/50">
                {subValues.map((sv, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">{sv.label}:</span>
                        <span className={`text-[11px] font-black ${sv.color || 'text-zinc-600 dark:text-zinc-400'}`}>{sv.value}</span>
                    </div>
                ))}
            </div>
        )}
    </div>
);

const SectionTitle = ({ icon: Icon, title, count }: { icon: any; title: string; count?: number }) => (
    <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-zinc-100 dark:bg-zinc-900 rounded-xl">
            <Icon className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
        </div>
        <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">
            {title}
            {count !== undefined && <span className="ml-3 text-sm text-zinc-400 font-bold">{count}</span>}
        </h2>
    </div>
);

const SimpleBadge = ({ children, color = 'zinc' }: { children: React.ReactNode; color?: string }) => {
    const colors: Record<string, string> = {
        green: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
        amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
        rose: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800',
        blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
        zinc: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700',
    };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border ${colors[color]}`}>
            {children}
        </span>
    );
};

// --- Student Search Component ---

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
            } catch (error) {
                console.error("Search error", error);
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
                    <button onClick={() => { setQuery(""); setResults([]); setOpen(false); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full">
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
                                            {s.photograph_url ? <img src={s.photograph_url} className="w-full h-full object-cover" /> : <User className="h-5 w-5 text-zinc-400" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black text-zinc-900 dark:text-zinc-100 truncate">{s.full_name}</p>
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                                <span>CC: {s.cc}</span>
                                                <span className="w-1 h-1 rounded-full bg-zinc-200" />
                                                <span>GR: {s.gr_number || 'N/A'}</span>
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

// --- Main Page Component ---

export default function PaymentHistoryPage() {
    const [academicYear, setAcademicYear] = useState("2025-2026");
    const [data, setData] = useState<PaymentHistoryResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'vouchers' | 'fee_heads' | 'deposits'>('vouchers');
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [selectedStudentCc, setSelectedStudentCc] = useState<number | null>(null);

    const toggleRow = (id: string) => {
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
                params: { academic_year: year || academicYear } 
            });
            setData(response.data);
            toast.success("Ledger synchronized successfully");
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Failed to load payment history");
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [academicYear]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(amount);
    };

    return (
        <div className="max-w-[1600px] mx-auto p-6 space-y-8 pb-32">
            {/* Zone 1: Header & Search */}
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[40px] p-6 shadow-xl shadow-zinc-200/10 dark:shadow-none sticky top-6 z-30">
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
                                    {data.student.photograph_url ? (
                                        <img src={data.student.photograph_url} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <User className="h-8 w-8 text-zinc-300" />
                                    )}
                                </div>
                                <div className="absolute -bottom-2 -right-2">
                                    <SimpleBadge color={data.student.status === 'ENROLLED' ? 'green' : 'rose'}>{data.student.status}</SimpleBadge>
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
                                            const newYear = e.target.value;
                                            setAcademicYear(newYear);
                                            if (selectedStudentCc) fetchHistory(selectedStudentCc, newYear);
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
                                    title="Refresh Data"
                                >
                                    <RefreshCw className={`h-5 w-5 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>

            {!data ? (
                <div className="py-40 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="w-24 h-24 bg-zinc-50 dark:bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-100 dark:border-zinc-800">
                        {loading ? <Loader2 className="h-10 w-10 text-primary animate-spin" /> : <SearchX className="h-10 w-10 text-zinc-300" />}
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100">{loading ? "Synchronizing History Matrix..." : "Select a Student to Investigate"}</h3>
                        <p className="text-zinc-400 text-sm mt-1 max-w-sm mx-auto">Search by Name, Computer Code or G.R. Number above to view the full payment ledger.</p>
                    </div>
                </div>
            ) : (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-10"
                >
                    {/* Zone 2: Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard 
                            title="Collection Strength" 
                            value={formatCurrency(data.stats.total_paid)}
                            progress={Math.round(data.stats.collection_rate)}
                            color="text-emerald-600"
                            icon={TrendingUp}
                            subValues={[
                                { label: 'Total Due', value: formatCurrency(data.stats.total_due) },
                                { label: 'Outstanding', value: formatCurrency(data.stats.still_outstanding), color: 'text-rose-600' }
                            ]}
                        />
                        <StatCard 
                            title="Voucher Behavior" 
                            value={data.stats.paid_late > 0 ? "Late Payer" : "Healthy"}
                            color={data.stats.paid_late > 0 ? "text-amber-600" : "text-emerald-600"}
                            icon={ShieldAlert}
                            subValues={[
                                { label: 'On Time', value: formatCurrency(data.stats.paid_on_time), color: 'text-emerald-600' },
                                { label: 'Late', value: formatCurrency(data.stats.paid_late), color: 'text-amber-600' },
                                { label: 'Due', value: formatCurrency(data.stats.still_outstanding), color: 'text-rose-600' }
                            ]}
                        />
                        <StatCard 
                            title="Arrears & Surcharges" 
                            value={data.stats.total_arrears_ever > 0 ? formatCurrency(data.stats.total_arrears_ever) : "None"}
                            color="text-rose-600"
                            icon={Wallet}
                            subValues={[
                                { label: 'Surcharges', value: formatCurrency(data.stats.total_surcharges_charged) },
                                { label: 'Waived', value: formatCurrency(data.stats.total_surcharges_waived), color: 'text-emerald-600' }
                            ]}
                        />
                        <StatCard 
                            title="Settlement Speed" 
                            value={`${data.stats.avg_days_to_pay} Days Avg.`}
                            color="text-blue-600"
                            icon={Clock}
                            subValues={[
                                { label: 'Fastest', value: `${data.stats.fastest_payment_days}d`, color: 'text-emerald-600' },
                                { label: 'Slowest', value: `${data.stats.slowest_payment_days}d`, color: 'text-rose-600' }
                            ]}
                        />
                    </div>

                    {/* Zone 3: Triple-Tab Ledger */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 p-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-[28px] w-fit">
                            {[
                                { id: 'vouchers', label: 'By Voucher', icon: FileText },
                                { id: 'fee_heads', label: 'By Fee Head', icon: CreditCard },
                                { id: 'deposits', label: 'All Deposits', icon: History }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`flex items-center gap-2 px-6 py-3 rounded-[22px] text-xs font-black uppercase tracking-widest transition-all ${
                                        activeTab === tab.id 
                                            ? "bg-white dark:bg-zinc-800 text-primary shadow-lg shadow-zinc-200/50 dark:shadow-none" 
                                            : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                                    }`}
                                >
                                    <tab.icon className="h-4 w-4" />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <AnimatePresence mode="wait">
                            {activeTab === 'vouchers' && (
                                <motion.div 
                                    key="vouchers"
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                    className="space-y-4"
                                >
                                    <SectionTitle icon={FileText} title="Issued Voucher Ledger" count={data.vouchers.length} />
                                    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] overflow-hidden shadow-sm">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                                                <tr className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                                                    <th className="px-6 py-4">Voucher ID</th>
                                                    <th className="px-6 py-4">Lifecycle</th>
                                                    <th className="px-6 py-4">Status</th>
                                                    <th className="px-6 py-4 text-right">Payable</th>
                                                    <th className="px-6 py-4 text-right">Arrears</th>
                                                    <th className="px-6 py-4">Paper Trail</th>
                                                    <th className="px-6 py-4"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                                {data.vouchers.map((v) => (
                                                    <VoucherRow 
                                                        key={v.id} 
                                                        voucher={v} 
                                                        isExpanded={expandedRows.has(`v-${v.id}`)} 
                                                        onToggle={() => toggleRow(`v-${v.id}`)}
                                                        formatCurrency={formatCurrency}
                                                    />
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'fee_heads' && (
                                <motion.div 
                                    key="fee_heads"
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                    className="space-y-12 pb-10"
                                >
                                    {data.fee_heads.map((group, idx) => (
                                        <div key={idx} className="space-y-6">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4">
                                                <div className="flex items-center gap-4">
                                                    <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">
                                                        {new Date(2000, group.target_month - 1).toLocaleString('default', { month: 'long' })} {group.academic_year.split('-')[0]}
                                                    </h3>
                                                    <SimpleBadge color={group.month_balance === 0 ? 'green' : group.month_total_paid > 0 ? 'amber' : 'rose'}>
                                                        {group.month_balance === 0 ? 'Fully Settled' : group.month_total_paid > 0 ? 'Partial Recovery' : 'Non-Recovered'}
                                                    </SimpleBadge>
                                                </div>
                                                <div className="flex items-center gap-8 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-3xl border border-zinc-100 dark:border-zinc-800">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Targeted</span>
                                                        <span className="text-sm font-black">{formatCurrency(group.month_total_due)}</span>
                                                    </div>
                                                    <div className="w-40 flex flex-col gap-1.5">
                                                        <div className="flex justify-between text-[10px] font-bold">
                                                            <span className="text-emerald-600">{group.month_total_due > 0 ? Math.round((group.month_total_paid / group.month_total_due) * 100) : 0}%</span>
                                                            <span className="text-zinc-400">Collection Rate</span>
                                                        </div>
                                                        <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                            <motion.div 
                                                                initial={{ width: 0 }} animate={{ width: `${group.month_total_due > 0 ? (group.month_total_paid / group.month_total_due) * 100 : 0}%` }}
                                                                className={`h-full ${group.month_balance === 0 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]'}`} 
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] overflow-hidden shadow-sm">
                                                <table className="w-full text-left border-collapse">
                                                    <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                                                        <tr className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                                                            <th className="px-6 py-4">Fee Head Description</th>
                                                            <th className="px-6 py-4">Timeline</th>
                                                            <th className="px-6 py-4 text-right">Due</th>
                                                            <th className="px-6 py-4 text-right">Recovered</th>
                                                            <th className="px-6 py-4 text-right text-rose-500">Balance</th>
                                                            <th className="px-6 py-4">Status</th>
                                                            <th className="px-6 py-4"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                                        {group.heads.map((head) => (
                                                            <FeeHeadRow 
                                                                key={head.id} 
                                                                head={head} 
                                                                isExpanded={expandedRows.has(`h-${head.id}`)} 
                                                                onToggle={() => toggleRow(`h-${head.id}`)}
                                                                formatCurrency={formatCurrency}
                                                            />
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ))}
                                </motion.div>
                            )}

                            {activeTab === 'deposits' && (
                                <motion.div 
                                    key="deposits"
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                    className="space-y-4"
                                >
                                    <SectionTitle icon={History} title="Chronological Cash Log" count={data.deposits.length} />
                                    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] overflow-hidden shadow-sm">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                                                <tr className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                                                    <th className="px-6 py-4">Receipt ID</th>
                                                    <th className="px-6 py-4">Transaction Timestamp</th>
                                                    <th className="px-6 py-4 text-right">Cash Amount</th>
                                                    <th className="px-6 py-4">Channel</th>
                                                    <th className="px-6 py-4">Ref Number</th>
                                                    <th className="px-6 py-4"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                                {data.deposits.map((d) => (
                                                    <DepositRow 
                                                        key={d.id} 
                                                        deposit={d} 
                                                        isExpanded={expandedRows.has(`d-${d.id}`)} 
                                                        onToggle={() => toggleRow(`d-${d.id}`)}
                                                        formatCurrency={formatCurrency}
                                                    />
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            )}
        </div>
    );
}

// --- Row Rendering Components ---

const VoucherRow = ({ voucher, isExpanded, onToggle, formatCurrency }: { voucher: VoucherHistoryItem; isExpanded: boolean; onToggle: () => void; formatCurrency: any }) => (
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
                    <span className="text-sm font-black text-zinc-900 dark:text-zinc-100">VCH-{voucher.id}</span>
                </div>
            </td>
            <td className="px-6 py-5">
                <div className="flex flex-col">
                    <span className="text-[11px] font-black text-zinc-900 dark:text-zinc-100">Issued: {new Date(voucher.issue_date).toLocaleDateString()}</span>
                    <span className="text-[10px] font-bold text-zinc-400">Due: {new Date(voucher.due_date).toLocaleDateString()}</span>
                </div>
            </td>
            <td className="px-6 py-5">
                <SimpleBadge color={voucher.status === 'PAID' ? 'green' : voucher.status === 'PARTIALLY_PAID' ? 'amber' : 'rose'}>
                    {voucher.status.replace('_', ' ')}
                </SimpleBadge>
            </td>
            <td className="px-6 py-5 text-right">
                <div className="flex flex-col items-end">
                    <span className="text-sm font-black text-emerald-600">{formatCurrency(voucher.total_payable_before_due)}</span>
                    <span className="text-[10px] font-bold text-rose-500 opacity-60">Late: {formatCurrency(voucher.total_payable_after_due)}</span>
                </div>
            </td>
            <td className="px-6 py-5 text-right">
                <div className="flex flex-col items-end">
                    <span className="text-sm font-black text-amber-600">{formatCurrency(voucher.total_arrears)}</span>
                    {voucher.total_arrear_surcharge > 0 && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] font-black text-rose-400 uppercase">Penalty: {formatCurrency(voucher.total_arrear_surcharge)}</span>
                            {voucher.surcharge_waived && (
                                <span title={`Waived by ${voucher.surcharge_waived_by}`}>
                                    <Info className="h-3 w-3 text-emerald-500" />
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </td>
            <td className="px-6 py-5">
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-zinc-500 max-w-[100px] truncate">{voucher.bank_accounts?.bank_name || 'N/A'}</span>
                    {voucher.pdf_url && (
                        <a href={voucher.pdf_url} target="_blank" onClick={e => e.stopPropagation()} className="p-1.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-lg hover:border-primary/40 transition-all">
                            <Download className="h-3.5 w-3.5 text-primary" />
                        </a>
                    )}
                </div>
            </td>
            <td className="px-6 py-5">
                <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </td>
        </tr>
        <AnimatePresence>
            {isExpanded && (
                <tr>
                    <td colSpan={7} className="p-0 bg-zinc-50/50 dark:bg-zinc-900/20">
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="p-8 grid grid-cols-1 xl:grid-cols-2 gap-10">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                            <CreditCard className="h-3.5 w-3.5" /> Breakdown of Components
                                        </h4>
                                        <span className="text-[10px] font-black text-zinc-400 bg-white dark:bg-zinc-800 px-2 py-0.5 rounded-full border">{voucher.heads.length} items</span>
                                    </div>
                                    <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-zinc-50/80 dark:bg-zinc-900/80">
                                                <tr className="text-[9px] font-black text-zinc-400 uppercase">
                                                    <th className="px-4 py-3">Fee Description</th>
                                                    <th className="px-4 py-3 text-right">Net</th>
                                                    <th className="px-4 py-3 text-right">Paid</th>
                                                    <th className="px-4 py-3 text-right">Rem.</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                                {voucher.heads.map((h) => (
                                                    <tr key={h.id} className="text-[11px] font-bold hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="text-zinc-700 dark:text-zinc-200">{h.description}</span>
                                                                <div className="flex gap-1.5">
                                                                    {h.is_arrear && <SimpleBadge color="amber">Arrear</SimpleBadge>}
                                                                    {h.is_arrear_surcharge && <SimpleBadge color="rose">Surcharge</SimpleBadge>}
                                                                    <span className="text-[9px] text-zinc-400 font-mono">#{h.source_fee_id}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-black">{formatCurrency(h.net_amount)}</td>
                                                        <td className="px-4 py-3 text-right text-emerald-600 font-black">{formatCurrency(h.amount_deposited)}</td>
                                                        <td className="px-4 py-3 text-right text-rose-500 font-black">{formatCurrency(h.balance)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                            <Wallet className="h-3.5 w-3.5" /> Cash Application Trail
                                        </h4>
                                        <span className="text-[10px] font-black text-zinc-400 bg-white dark:bg-zinc-800 px-2 py-0.5 rounded-full border">Direct & Indirect</span>
                                    </div>
                                    {voucher.deposit_allocations.length === 0 ? (
                                        <div className="h-32 flex flex-col items-center justify-center bg-white/50 dark:bg-zinc-950/50 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400 text-[11px] font-bold">
                                            No deposits recorded for this voucher yet.
                                        </div>
                                    ) : (
                                        <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-zinc-50/80 dark:bg-zinc-900/80">
                                                    <tr className="text-[9px] font-black text-zinc-400 uppercase">
                                                        <th className="px-4 py-3">Timestamp</th>
                                                        <th className="px-4 py-3">Channel</th>
                                                        <th className="px-4 py-3 text-right">Applied</th>
                                                        <th className="px-4 py-3 text-right">Ref</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                                    {voucher.deposit_allocations.map((d, i) => (
                                                        <tr key={i} className="text-[11px] font-bold hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                                                            <td className="px-4 py-3 text-zinc-500">{d.deposit_date ? new Date(d.deposit_date).toLocaleDateString() : '—'}</td>
                                                            <td className="px-4 py-3"><SimpleBadge color="blue">{d.payment_method}</SimpleBadge></td>
                                                            <td className="px-4 py-3 text-right text-emerald-600 font-black">{formatCurrency(d.amount)}</td>
                                                            <td className="px-4 py-3 text-right font-mono text-[9px] text-zinc-400">{d.reference_number || '—'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </td>
                </tr>
            )}
        </AnimatePresence>
    </>
);

const FeeHeadRow = ({ head, isExpanded, onToggle, formatCurrency }: { head: FeeHead; isExpanded: boolean; onToggle: () => void; formatCurrency: any }) => (
    <>
        <tr 
            onClick={onToggle}
            className="group hover:bg-zinc-50 dark:hover:bg-zinc-900/40 cursor-pointer transition-colors"
        >
            <td className="px-6 py-5">
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-black text-zinc-900 dark:text-zinc-100">{head.fee_type_description}</span>
                    <div className="flex flex-wrap gap-1.5">
                        {head.is_arrear_surcharge && <SimpleBadge color="rose">Surcharge</SimpleBadge>}
                        {head.bundle_name && <span className="text-[9px] font-black bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded border border-purple-100 dark:border-purple-800 uppercase tracking-tighter">{head.bundle_name}</span>}
                        {head.installment_label && <span className="text-[9px] font-black bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800 uppercase tracking-tighter">{head.installment_label}</span>}
                    </div>
                </div>
            </td>
            <td className="px-6 py-5">
                <span className="text-xs font-bold text-zinc-500">{new Date(head.fee_date).toLocaleDateString()}</span>
            </td>
            <td className="px-6 py-5 text-right">
                <div className="flex flex-col items-end">
                    <span className="text-sm font-black text-zinc-700 dark:text-zinc-300">{formatCurrency(head.amount)}</span>
                </div>
            </td>
            <td className="px-6 py-5 text-right font-black text-emerald-600">{formatCurrency(head.amount_paid)}</td>
            <td className="px-6 py-5 text-right font-black text-rose-500">{formatCurrency(head.balance)}</td>
            <td className="px-6 py-5">
                <SimpleBadge color={head.status === 'PAID' ? 'green' : head.status === 'PARTIALLY_PAID' ? 'amber' : head.status === 'ISSUED' ? 'blue' : 'zinc'}>
                    {head.status.replace('_', ' ')}
                </SimpleBadge>
            </td>
            <td className="px-6 py-5">
                <ChevronDown className="h-4 w-4 text-zinc-400 transition-transform" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }} />
            </td>
        </tr>
        <AnimatePresence>
            {isExpanded && (
                <tr>
                    <td colSpan={7} className="p-0 bg-zinc-50/50 dark:bg-zinc-900/20">
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="p-8">
                                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-4">
                                    <History className="h-3.5 w-3.5" /> Ledger Traceability Matrix
                                </h4>
                                <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-zinc-50/80 dark:bg-zinc-900/80">
                                            <tr className="text-[9px] font-black text-zinc-400 uppercase">
                                                <th className="px-6 py-3">Settlement Date</th>
                                                <th className="px-6 py-3">Channel</th>
                                                <th className="px-6 py-3">Reference</th>
                                                <th className="px-6 py-3 text-right">Amount Applied</th>
                                                <th className="px-6 py-3 text-right">Carrier Voucher</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                            {head.deposit_trail.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 text-xs font-bold italic">No cash has been liquidated against this specific head.</td>
                                                </tr>
                                            ) : (
                                                head.deposit_trail.map((d, i) => (
                                                    <tr key={i} className="text-[11px] font-bold hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                                                        <td className="px-6 py-4 text-zinc-600">{d.deposit_date ? new Date(d.deposit_date).toLocaleDateString() : '—'}</td>
                                                        <td className="px-6 py-4"><SimpleBadge color="blue">{d.payment_method}</SimpleBadge></td>
                                                        <td className="px-6 py-4 font-mono text-zinc-500">{d.reference_number || '—'}</td>
                                                        <td className="px-6 py-4 text-right text-emerald-600 font-black">{formatCurrency(d.amount)}</td>
                                                        <td className="px-6 py-4 text-right">
                                                            {d.voucher_id ? (
                                                                <button className="inline-flex items-center gap-1.5 text-primary hover:underline font-black">
                                                                    VCH-{d.voucher_id} <ArrowUpRight className="h-3 w-3" />
                                                                </button>
                                                            ) : (
                                                                <span className="text-zinc-400 text-[10px] uppercase tracking-widest">Direct Allocation</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </motion.div>
                    </td>
                </tr>
            )}
        </AnimatePresence>
    </>
);

const DepositRow = ({ deposit, isExpanded, onToggle, formatCurrency }: { deposit: DepositItem; isExpanded: boolean; onToggle: () => void; formatCurrency: any }) => (
    <>
        <tr 
            onClick={onToggle}
            className="group hover:bg-zinc-50 dark:hover:bg-zinc-900/40 cursor-pointer transition-colors"
        >
            <td className="px-6 py-5 font-black text-zinc-900 dark:text-zinc-100">RCP-{deposit.id}</td>
            <td className="px-6 py-5 text-xs font-bold text-zinc-600 dark:text-zinc-400">{new Date(deposit.deposit_date).toLocaleString()}</td>
            <td className="px-6 py-5 text-right font-black text-emerald-600">{formatCurrency(deposit.total_amount)}</td>
            <td className="px-6 py-5"><SimpleBadge color="blue">{deposit.payment_method}</SimpleBadge></td>
            <td className="px-6 py-5 font-mono text-[10px] text-zinc-500">{deposit.reference_number || '—'}</td>
            <td className="px-6 py-5">
                <ChevronDown className="h-4 w-4 text-zinc-400 transition-transform" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }} />
            </td>
        </tr>
        <AnimatePresence>
            {isExpanded && (
                <tr>
                    <td colSpan={6} className="p-0 bg-zinc-50/50 dark:bg-zinc-900/20">
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="p-8 max-w-4xl">
                                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-6">
                                    <Info className="h-3.5 w-3.5" /> Ledger Liquidation Breakdown
                                </h4>
                                <div className="space-y-3">
                                    {deposit.allocations.map((a, i) => (
                                        <div key={i} className="bg-white dark:bg-zinc-950 p-5 rounded-[24px] border border-zinc-200 dark:border-zinc-800 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center gap-5">
                                                <div className="w-2 h-10 bg-emerald-500 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.3)]" />
                                                <div>
                                                    <p className="text-sm font-black text-zinc-900 dark:text-zinc-100">
                                                        {a.fee_type_description}
                                                    </p>
                                                    <p className="text-[10px] font-bold text-zinc-400 mt-0.5">
                                                        {a.voucher_id ? `Applied via VCH-${a.voucher_id} • ` : ''}System ID #{a.student_fee_id}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-lg font-black text-emerald-600">{formatCurrency(a.amount)}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {deposit.remarks && (
                                        <div className="mt-6 p-5 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-900/30 rounded-[28px] flex items-start gap-3">
                                            <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mb-1">Audit / Admin Remarks</p>
                                                <p className="text-sm text-blue-800/80 dark:text-blue-300/80 leading-relaxed font-medium italic">"{deposit.remarks}"</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </td>
                </tr>
            )}
        </AnimatePresence>
    </>
);
