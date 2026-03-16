"use client";

import { useState, useEffect } from "react";
import { 
    Search, 
    Loader2, 
    ArrowLeft, 
    CreditCard, 
    User, 
    Calendar,
    CheckCircle2,
    AlertCircle,
    Info,
    ChevronRight,
    ArrowRightCircle,
    Save
} from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

interface FeeItem {
    id: number;
    student_id: number;
    fee_type_id: number;
    month: number | null;
    academic_year: string;
    amount_before_discount: number;
    fee_deposited: number;
    balance: number;
    status: string;
    fee_types: {
        description: string;
    };
    voucher_heads?: {
        voucher_id: number;
        vouchers: {
            id: number;
            month: number | null;
            academic_year: string;
            status: string;
            late_fee_charge: boolean;
            total_payable_after_due: number;
            total_payable_before_due: number;
            late_fee_deposited: number;
        }
    }[];
}

interface StudentData {
    student_id: number;
    full_name: string;
    cc: number;
    gr_number: string;
    classes: { description: string } | null;
    sections: { description: string } | null;
    fees: FeeItem[];
}

interface GroupedVoucher {
    id: string; // "monthly" or voucher id
    month: number | null;
    academic_year: string;
    fees: FeeItem[];
    lateFeeOwed: number;
    lateFeePaid: number;
    isVoucher: boolean;
    voucherId?: number;
}

export default function DepositPage() {
    const [ccNumber, setCcNumber] = useState("");
    const [loading, setLoading] = useState(false);
    const [student, setStudent] = useState<StudentData | null>(null);
    const [depositAmount, setDepositAmount] = useState<number | "">("");
    const [allocations, setAllocations] = useState<Record<number, number>>({});
    const [lateFeeAllocations, setLateFeeAllocations] = useState<Record<number, number>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [step, setStep] = useState<"ENTRY" | "REVIEW">("ENTRY");

    const handleSearch = async () => {
        if (!ccNumber) return;
        setLoading(true);
        try {
            const { data } = await api.get(`/v1/student-fees/by-student/${ccNumber}`);
            if (data.success && data.data) {
                setStudent(data.data);
                toast.success("Student records found");
                setStep("ENTRY");
            } else {
                setStudent(null);
                toast.error("No student found with this CC number");
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to fetch student records");
            setStudent(null);
        } finally {
            setLoading(false);
        }
    };

    // Group fees by month/academic_year to simulate "Vouchers"
    const groupedItems: GroupedVoucher[] = student ? Object.values(
        student.fees.reduce((acc, fee) => {
            const key = `${fee.month}-${fee.academic_year}`;
            if (!acc[key]) {
                const voucherInfo = fee.voucher_heads?.[0]?.vouchers;
                acc[key] = {
                    id: key,
                    month: fee.month,
                    academic_year: fee.academic_year,
                    fees: [],
                    lateFeeOwed: voucherInfo?.late_fee_charge ? (Number(voucherInfo.total_payable_after_due) - Number(voucherInfo.total_payable_before_due)) : 0,
                    lateFeePaid: Number(voucherInfo?.late_fee_deposited || 0),
                    isVoucher: !!voucherInfo,
                    voucherId: voucherInfo?.id
                };
            }
            acc[key].fees.push(fee);
            return acc;
        }, {} as Record<string, GroupedVoucher>)
    ).sort((a, b) => {
        if (a.academic_year !== b.academic_year) return a.academic_year.localeCompare(b.academic_year);
        return (a.month || 0) - (b.month || 0);
    }) : [];

    const handleAllocationChange = (feeId: number, amount: number) => {
        const fee = student?.fees.find(f => f.id === feeId);
        if (fee && amount > Number(fee.balance)) {
            toast.error(`${fee.fee_types.description} balance is only Rs. ${Number(fee.balance).toLocaleString()}`);
            return;
        }
        setAllocations(prev => ({ ...prev, [feeId]: amount }));
    };

    const handleLateFeeAllocationChange = (voucherId: number, amount: number) => {
        const group = groupedItems.find(g => g.voucherId === voucherId);
        const balance = (group?.lateFeeOwed || 0) - (group?.lateFeePaid || 0);
        if (amount > balance) {
            toast.error(`Late fee balance is only Rs. ${balance.toLocaleString()}`);
            return;
        }
        setLateFeeAllocations(prev => ({ ...prev, [voucherId]: amount }));
    };

    const totalAllocated = Object.values(allocations).reduce((a, b) => a + b, 0) + 
                          Object.values(lateFeeAllocations).reduce((a, b) => a + b, 0);

    const remainingToAllocate = (Number(depositAmount) || 0) - totalAllocated;

    const handleAutoDistribute = () => {
        if (!depositAmount) return;
        let amountLeft = Number(depositAmount);
        const newAllocations: Record<number, number> = {};
        const newLateFeeAllocations: Record<number, number> = {};

        for (const group of groupedItems) {
            for (const fee of group.fees) {
                const balance = Number(fee.balance);
                if (balance > 0 && amountLeft > 0) {
                    const toPay = Math.min(amountLeft, balance);
                    newAllocations[fee.id] = toPay;
                    amountLeft -= toPay;
                }
            }
            const lateBalance = group.lateFeeOwed - group.lateFeePaid;
            if (lateBalance > 0 && amountLeft > 0 && group.voucherId) {
                const toPay = Math.min(amountLeft, lateBalance);
                newLateFeeAllocations[group.voucherId] = toPay;
                amountLeft -= toPay;
            }
        }

        setAllocations(newAllocations);
        setLateFeeAllocations(newLateFeeAllocations);
    };

    const handleSubmit = async () => {
        if (!student) return;
        if (remainingToAllocate !== 0) {
            toast.error(`Sum of allocations must equal Rs. ${Number(depositAmount).toLocaleString()} exactly.`);
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                student_id: student.cc,
                total_deposited_amount: Number(depositAmount),
                allocations: Object.entries(allocations).map(([id, amount]) => ({
                    student_fee_id: Number(id),
                    amount: Number(amount)
                })).filter(a => a.amount > 0),
                late_fee_allocations: Object.entries(lateFeeAllocations).map(([id, amount]) => ({
                    voucher_id: Number(id),
                    amount: Number(amount)
                })).filter(a => a.amount > 0)
            };

            await api.post("/v1/student-fees/deposit", payload);
            toast.success("Deposit processed successfully!");
            setStudent(null);
            setCcNumber("");
            setDepositAmount("");
            setAllocations({});
            setLateFeeAllocations({});
            setStep("ENTRY");
        } catch (error) {
            console.error(error);
            toast.error("Failed to process deposit");
        } finally {
            setIsSubmitting(false);
        }
    };

    const getMonthName = (month: number | null) => {
        if (!month) return "N/A";
        const d = new Date(2024, month - 1, 1);
        return format(d, "MMMM");
    };

    const summaryRows: any[] = [];
    groupedItems.forEach(group => {
        group.fees.forEach(fee => {
            const allocated = allocations[fee.id] || 0;
            const balance = Number(fee.balance);
            if (allocated > 0) {
                summaryRows.push({
                    name: `${fee.fee_types.description} (${getMonthName(group.month)})`,
                    amount: balance,
                    allocated: allocated,
                    status: allocated === balance ? "✅ Fully paid" : "⚠️ Partial"
                });
            }
        });
        const lateAlloc = lateFeeAllocations[group.voucherId!] || 0;
        const lateBalance = group.lateFeeOwed - group.lateFeePaid;
        if (lateAlloc > 0) {
            summaryRows.push({
                name: `Late Fee (${getMonthName(group.month)})`,
                amount: lateBalance,
                allocated: lateAlloc,
                status: lateAlloc === lateBalance ? "✅ Fully paid" : "⚠️ Partial"
            });
        }
    });

    return (
        <div className="min-h-screen pb-32 selection:bg-primary/20">
            {/* Header Area */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <Link href="/vouchers" className="flex items-center text-zinc-500 hover:text-primary transition-colors mb-2 text-xs font-bold uppercase tracking-wider">
                        <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Vouchers
                    </Link>
                    <h1 className="text-3xl font-black tracking-tight flex items-center gap-3 text-zinc-900 dark:text-zinc-100">
                        <CreditCard className="h-8 w-8 text-primary" /> Fees Deposit 
                        <span className="text-zinc-300 dark:text-zinc-700 mx-2">/</span>
                        <span className="text-primary/60">{step === "ENTRY" ? "Entry" : "Review"}</span>
                    </h1>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Search & Deposit Amount */}
                <div className="lg:col-span-4 space-y-6">
                    <div className={`bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-sm transition-opacity ${step === "REVIEW" ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
                        <h2 className="text-sm font-black mb-6 flex items-center gap-3 text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">
                            <span className="h-8 w-8 bg-primary/10 rounded-xl flex items-center justify-center text-primary text-sm font-black">1</span>
                            Identification
                        </h2>
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-2 block opacity-70">Student CC Number</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                    <input 
                                        type="text" 
                                        placeholder="Enter CC Number..." 
                                        value={ccNumber}
                                        onChange={(e) => setCcNumber(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                                        className="w-full h-14 pl-12 pr-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] text-sm font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all placeholder:text-zinc-300"
                                    />
                                </div>
                            </div>
                            <button 
                                onClick={handleSearch}
                                disabled={loading || !ccNumber}
                                className="w-full h-14 bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white rounded-[20px] font-black text-xs uppercase tracking-[0.2em] hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center disabled:opacity-30 shadow-lg shadow-zinc-900/10"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify Identity"}
                            </button>
                        </div>

                        {student && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }} 
                                animate={{ opacity: 1, scale: 1 }}
                                className="mt-8 p-6 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[24px] relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-5">
                                    <User className="h-16 w-16" />
                                </div>
                                <div className="flex items-center gap-4 mb-5 relative z-10">
                                    <div className="h-14 w-14 bg-white dark:bg-zinc-950 rounded-2xl flex items-center justify-center border border-zinc-200 dark:border-zinc-800 text-primary shadow-sm">
                                        <CheckCircle2 className="h-7 w-7" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-zinc-900 dark:text-zinc-100 text-base">{student.full_name}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="px-2 py-0.5 bg-primary/10 text-primary text-[9px] font-black rounded-md uppercase tracking-wider">CC-{student.cc}</span>
                                            <span className="px-2 py-0.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-500 text-[9px] font-black rounded-md uppercase tracking-wider">GR-{student.gr_number}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 relative z-10">
                                    <div className="p-3 bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-xl">
                                        <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Class</p>
                                        <p className="text-[11px] font-black text-zinc-700 dark:text-zinc-300 truncate">{student.classes?.description || "N/A"}</p>
                                    </div>
                                    <div className="p-3 bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-xl">
                                        <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-1">Section</p>
                                        <p className="text-[11px] font-black text-zinc-700 dark:text-zinc-300 truncate">{student.sections?.description || "N/A"}</p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>

                    {student && (
                        <div className={`bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-sm transition-opacity ${step === "REVIEW" ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
                            <h2 className="text-sm font-black mb-6 flex items-center gap-3 text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">
                                <span className="h-8 w-8 bg-primary/10 rounded-xl flex items-center justify-center text-primary text-sm font-black">2</span>
                                Financial
                            </h2>
                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-2 block opacity-70">Total Received (Rs.)</label>
                                    <div className="relative">
                                        <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                        <input 
                                            type="number" 
                                            placeholder="0.00" 
                                            value={depositAmount}
                                            onChange={(e) => setDepositAmount(e.target.value ? Number(e.target.value) : "")}
                                            className="w-full h-14 pl-12 pr-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] text-lg font-black text-primary focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all placeholder:text-zinc-200"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button 
                                        onClick={handleAutoDistribute}
                                        disabled={!depositAmount}
                                        className="flex-1 h-12 border-2 border-primary/20 text-primary rounded-2xl font-black text-[10px] uppercase tracking-wider hover:bg-primary/5 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-30"
                                    >
                                        <ArrowRightCircle className="h-4 w-4" /> Auto Distribute
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Fees List / Review State */}
                <div className="lg:col-span-8">
                    <AnimatePresence mode="wait">
                        {step === "ENTRY" ? (
                            <motion.div 
                                key="entry"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                {!student ? (
                                    <div className="bg-zinc-50/50 dark:bg-zinc-900/30 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-[48px] h-[600px] flex flex-col items-center justify-center p-12 text-center group transition-colors hover:border-zinc-300 dark:hover:border-zinc-700">
                                        <div className="h-24 w-24 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-full flex items-center justify-center text-zinc-200 mb-8 shadow-sm group-hover:scale-110 transition-transform">
                                            <User className="h-12 w-12" />
                                        </div>
                                        <h3 className="text-2xl font-black text-zinc-300 dark:text-zinc-700 mb-3 tracking-tight">Ready for Transaction</h3>
                                        <p className="max-w-xs text-zinc-400 text-sm font-medium leading-relaxed uppercase tracking-wider text-[10px]">Verification of CC ID is required to begin funds allocation.</p>
                                    </div>
                                ) : groupedItems.length === 0 ? (
                                    <div className="bg-emerald-50 dark:bg-emerald-900/10 border-2 border-emerald-100 dark:border-emerald-900/20 p-12 rounded-[48px] text-center">
                                        <div className="h-20 w-20 bg-emerald-500 rounded-full flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-emerald-500/20">
                                            <CheckCircle2 className="h-10 w-10" />
                                        </div>
                                        <h3 className="text-2xl font-black text-emerald-900 dark:text-emerald-400 mb-2">Zero Balance</h3>
                                        <p className="text-emerald-700/70 font-medium uppercase tracking-[0.2em] text-[10px]">Student has no outstanding liabilities.</p>
                                    </div>
                                ) : (
                                    groupedItems.map((group) => (
                                        <div 
                                            key={group.id}
                                            className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] overflow-hidden shadow-sm hover:shadow-md transition-all group/card"
                                        >
                                            <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-12 w-12 bg-white dark:bg-zinc-950 rounded-2xl flex items-center justify-center border border-zinc-200 dark:border-zinc-800 shadow-sm group-hover/card:border-primary/30 transition-colors">
                                                        <Calendar className="h-6 w-6 text-primary" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest text-sm">
                                                            {getMonthName(group.month)} {group.academic_year}
                                                        </h3>
                                                        {group.isVoucher && (
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">BILL ID</span>
                                                                <span className="text-[10px] font-black text-primary uppercase bg-primary/5 px-2 py-0.5 rounded">#{group.voucherId}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1 opacity-60">Pending Balance</p>
                                                    <p className="text-lg font-black text-primary">Rs. {Number(group.fees.reduce((s, f) => s + Number(f.balance), 0)).toLocaleString()}</p>
                                                </div>
                                            </div>

                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left">
                                                    <thead className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] bg-zinc-50/30 dark:bg-zinc-900/30 border-b border-zinc-100 dark:border-zinc-800">
                                                        <tr>
                                                            <th className="px-8 py-5">Component</th>
                                                            <th className="px-8 py-5">Status</th>
                                                            <th className="px-8 py-5 text-right">Owed</th>
                                                            <th className="px-8 py-5 text-right">Remaining</th>
                                                            <th className="px-8 py-5 text-right w-40">Allocation (Rs.)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                                                        {group.fees.map((fee) => (
                                                            <tr key={fee.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 transition-colors group/row">
                                                                <td className="px-8 py-5">
                                                                    <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-tight">{fee.fee_types.description}</span>
                                                                </td>
                                                                <td className="px-8 py-5">
                                                                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                                                                        fee.status === "PAID" ? "bg-emerald-100/50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" :
                                                                        fee.status === "PARTIALLY_PAID" ? "bg-amber-100/50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" :
                                                                        "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                                                                    }`}>
                                                                        {fee.status.replace("_", " ")}
                                                                    </span>
                                                                </td>
                                                                <td className="px-8 py-5 text-right text-[11px] font-bold text-zinc-400">{Number(fee.amount_before_discount).toLocaleString()}</td>
                                                                <td className="px-8 py-5 text-right text-[12px] font-black text-zinc-900 dark:text-zinc-100">{Number(fee.balance).toLocaleString()}</td>
                                                                <td className="px-8 py-5 text-right">
                                                                    <input 
                                                                        type="number"
                                                                        placeholder="0"
                                                                        value={allocations[fee.id] || ""}
                                                                        onChange={(e) => handleAllocationChange(fee.id, Number(e.target.value))}
                                                                        className="w-full h-10 px-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-right text-sm font-black text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all group-hover/row:border-primary/40 shadow-sm"
                                                                    />
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {group.isVoucher && group.lateFeeOwed > 0 && (
                                                            <tr className="bg-rose-50/20 dark:bg-rose-900/5 group/row">
                                                                <td className="px-8 py-5">
                                                                    <span className="text-xs font-black text-rose-600 uppercase tracking-tight">Late Surcharge</span>
                                                                </td>
                                                                <td className="px-8 py-5">
                                                                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                                                                        group.lateFeePaid >= group.lateFeeOwed ? "bg-emerald-100/50 text-emerald-700" : "bg-rose-100/50 text-rose-700"
                                                                    }`}>
                                                                        {group.lateFeePaid >= group.lateFeeOwed ? "PAID" : "OUTSTANDING"}
                                                                    </span>
                                                                </td>
                                                                <td className="px-8 py-5 text-right text-[11px] font-bold text-rose-300">{group.lateFeeOwed.toLocaleString()}</td>
                                                                <td className="px-8 py-5 text-right text-[12px] font-black text-rose-600">{(group.lateFeeOwed - group.lateFeePaid).toLocaleString()}</td>
                                                                <td className="px-8 py-5 text-right">
                                                                    <input 
                                                                        type="number"
                                                                        placeholder="0"
                                                                        value={lateFeeAllocations[group.voucherId!] || ""}
                                                                        onChange={(e) => handleLateFeeAllocationChange(group.voucherId!, Number(e.target.value))}
                                                                        className="w-full h-10 px-4 bg-white dark:bg-zinc-950 border border-rose-200 dark:border-rose-900/30 rounded-xl text-right text-sm font-black text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all group-hover/row:border-rose-500/40 shadow-sm"
                                                                    />
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </motion.div>
                        ) : (
                            <motion.div 
                                key="review"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[40px] p-12 shadow-2xl"
                            >
                                <div className="flex items-center gap-4 mb-10">
                                    <div className="h-14 w-14 bg-zinc-900 dark:bg-white rounded-2xl flex items-center justify-center text-white dark:text-zinc-900 shadow-xl">
                                        <Info className="h-7 w-7" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">Final Allocation Summary</h2>
                                        <p className="text-zinc-400 font-black uppercase tracking-[0.2em] text-[10px] mt-1">Review your distribution before persistence</p>
                                    </div>
                                </div>

                                <div className="rounded-[32px] border border-zinc-100 dark:border-zinc-800 overflow-hidden mb-10">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
                                                <th className="px-8 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Fee Component</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Fee Amount</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Allocated</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900 font-medium">
                                            {summaryRows.map((row, i) => (
                                                <tr key={i} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors">
                                                    <td className="px-8 py-6 text-sm font-black text-zinc-800 dark:text-zinc-200 uppercase">{row.name}</td>
                                                    <td className="px-8 py-6 text-right text-sm font-bold text-zinc-400">Rs. {row.amount.toLocaleString()}</td>
                                                    <td className="px-8 py-6 text-right text-sm font-black text-primary">Rs. {row.allocated.toLocaleString()}</td>
                                                    <td className="px-8 py-6">
                                                        <span className="text-[10px] font-black uppercase tracking-wider">{row.status}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {/* Remaining balance if any (should be 0) */}
                                            {remainingToAllocate !== 0 && (
                                                <tr className="bg-rose-50 dark:bg-rose-900/10">
                                                    <td className="px-8 py-6 text-sm font-black text-rose-600 uppercase">Unallocated Balance</td>
                                                    <td className="px-8 py-6"></td>
                                                    <td className="px-8 py-6 text-right text-sm font-black text-rose-600">Rs. {remainingToAllocate.toLocaleString()}</td>
                                                    <td className="px-8 py-6">
                                                        <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-2">
                                                            <AlertCircle className="h-3 w-3" /> System Out of Balance
                                                        </span>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-primary/5 border-t-2 border-primary/10">
                                                <td className="px-8 py-8 text-base font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tighter self-center">TOTAL ALLOCATION</td>
                                                <td className="px-8 py-8 text-right text-sm font-bold text-zinc-400 self-center">Rs. {student?.fees.reduce((s, f) => s + Number(f.balance), 0).toLocaleString()}</td>
                                                <td className="px-8 py-8 text-right text-xl font-black text-primary self-center">Rs. {totalAllocated.toLocaleString()}</td>
                                                <td className="px-8 py-8 self-center">
                                                    <span className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest ${remainingToAllocate === 0 ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-zinc-200 text-zinc-500"}`}>
                                                        {remainingToAllocate === 0 ? "✓ Balanced" : "Pending"}
                                                    </span>
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                <div className="flex flex-col items-center">
                                    <p className="text-zinc-400 font-bold text-sm mb-6 flex items-center gap-2">
                                        Deposit of <span className="text-primary font-black">Rs. {Number(depositAmount).toLocaleString()}</span> is fully allocated. Ready to confirm?
                                    </p>
                                    <div className="flex gap-4 w-full max-w-md">
                                        <button 
                                            onClick={() => setStep("ENTRY")}
                                            className="flex-1 h-14 border-2 border-zinc-200 dark:border-zinc-800 text-zinc-500 rounded-[20px] font-black text-xs uppercase tracking-widest hover:bg-zinc-50 active:scale-95 transition-all"
                                        >
                                            Adjust Allocation
                                        </button>
                                        <button 
                                            onClick={handleSubmit}
                                            disabled={isSubmitting || remainingToAllocate !== 0}
                                            className="flex-1 h-14 bg-emerald-600 text-white rounded-[20px] font-black text-xs uppercase tracking-[0.2em] hover:bg-emerald-500 active:scale-95 transition-all shadow-xl shadow-emerald-600/20 disabled:opacity-30 disabled:grayscale"
                                        >
                                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Confirm & Save"}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Sticky Summary Bar (Entry state only) */}
            {student && step === "ENTRY" && (
                <div className="fixed bottom-0 inset-x-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-2xl border-t border-zinc-200 dark:border-zinc-800 h-24 z-50 flex items-center shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                    <div className="max-w-[1600px] mx-auto w-full px-12 flex items-center justify-between">
                        <div className="flex items-center gap-16">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] opacity-60">Total Bill</p>
                                <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100 flex items-center self-center">
                                    <span className="text-zinc-300 mr-2 text-sm">Rs.</span>
                                    {Number(depositAmount || 0).toLocaleString()}
                                </p>
                            </div>
                            <div className="space-y-1 relative">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] opacity-60">Currently Allocated</p>
                                <p className={`text-2xl font-black flex items-center transition-colors self-center ${remainingToAllocate === 0 ? "text-emerald-500" : remainingToAllocate < 0 ? "text-rose-500" : "text-primary"}`}>
                                    <span className="opacity-30 mr-2 text-sm italic">Rs.</span>
                                    {totalAllocated.toLocaleString()}
                                </p>
                                {remainingToAllocate !== 0 && (
                                    <div className="absolute top-1/2 left-full ml-4 -translate-y-1/2 flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-100 dark:border-amber-900/20 whitespace-nowrap">
                                        <Info className="h-3 w-3 text-amber-500" />
                                        <span className="text-[9px] font-black text-amber-600 uppercase tracking-wider">
                                            {remainingToAllocate > 0 ? `${remainingToAllocate.toLocaleString()} left` : `${Math.abs(remainingToAllocate).toLocaleString()} over`}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => setStep("REVIEW")}
                                disabled={totalAllocated === 0}
                                className="h-14 px-10 bg-primary/10 text-primary border border-primary/20 rounded-[20px] font-black text-xs uppercase tracking-widest hover:bg-primary text-primary hover:text-white transition-all active:scale-[0.98] disabled:opacity-30 flex items-center gap-3 self-center"
                            >
                                Preview Allocation <ChevronRight className="h-4 w-4" />
                            </button>
                            <button 
                                onClick={handleSubmit}
                                disabled={isSubmitting || remainingToAllocate !== 0}
                                className="h-14 px-10 bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white rounded-[20px] font-black text-xs uppercase tracking-widest hover:opacity-90 active:scale-[0.98] transition-all flex items-center gap-3 shadow-xl shadow-zinc-900/10 disabled:opacity-30 self-center"
                            >
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Final Commit</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
