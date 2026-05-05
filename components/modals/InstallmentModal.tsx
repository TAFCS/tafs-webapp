"use client";

import { useState, useEffect, useMemo } from "react";
import {
    X, ChevronRight, ChevronLeft, Loader2,
    CreditCard, AlertCircle, CheckCircle2,
    ArrowRight, Info, List, Layers, Plus
} from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";

const MONTHS = ["August", "September", "October", "November", "December", "January", "February", "March", "April", "May", "June", "July"];
const MONTH_TO_NUM: Record<string, number> = {
    "August": 8, "September": 9, "October": 10, "November": 11, "December": 12,
    "January": 1, "February": 2, "March": 3, "April": 4, "May": 5, "June": 6, "July": 7
};

interface InstallmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    studentId: number;
    studentName: string;
    existingFees: any[]; // The current spreadsheet rows
    academicYear: string;
}

export default function InstallmentModal({ isOpen, onClose, onSuccess, studentId, studentName, existingFees, academicYear }: InstallmentModalProps) {
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    // Step 1 State
    const [feeTypes, setFeeTypes] = useState<any[]>([]);
    const [selectedFeeTypeId, setSelectedFeeTypeId] = useState<number | "">(4); // Default to Annual Fee (ID 4)

    // Step 2 State
    const [totalAmount, setTotalAmount] = useState<number>(0);
    const [installmentCount, setInstallmentCount] = useState<number>(12); // Default 12 for annual breakdown
    const [selectedYear, setSelectedYear] = useState(academicYear);

    // Step 3 State
    const [schedule, setSchedule] = useState<{ target_month: number; fee_date: string; amount: number; merge_target_id?: number }[]>([]);

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            fetchFeeTypes();
        }
    }, [isOpen]);

    const fetchFeeTypes = async () => {
        try {
            const { data } = await api.get("/v1/fee-types");
            setFeeTypes(data?.data || []);
        } catch (err) {
            console.error("Failed to fetch fee types");
        }
    };

    const handleNextToStep3 = () => {
        const baseAmount = Math.round(totalAmount / installmentCount);
        const remainder = totalAmount - (baseAmount * installmentCount);

        const newSchedule = Array.from({ length: installmentCount }).map((_, i) => {
            const monthIdx = i % 12;
            const targetMonthName = MONTHS[monthIdx];
            const target_month = MONTH_TO_NUM[targetMonthName];

            // Improved Year logic to prevent absurd years like 222025
            const yearParts = (selectedYear || academicYear || "").split('-');
            const firstYearRaw = yearParts[0].trim();
            let baseYear = parseInt(firstYearRaw);

            // Handle cases where the input might be 2-digit (e.g., '25' -> 2025)
            if (baseYear < 100) baseYear += 2000;
            if (isNaN(baseYear)) baseYear = new Date().getFullYear();

            const calendarYearOffset = (target_month < 8) ? 1 : 0;
            const cycleOffset = Math.floor(i / 12);
            const finalYear = baseYear + calendarYearOffset + cycleOffset;

            const fee_date = `${finalYear}-${target_month.toString().padStart(2, '0')}-01`;

            // Auto-detect merge target (usually Tuition Fee ID 1)
            const match = existingFees.find(ef => ef.fee_date === fee_date && ef.dbId && ef.feeId === 1);

            return {
                target_month,
                fee_date,
                amount: i === installmentCount - 1 ? baseAmount + remainder : baseAmount,
                merge_target_id: match?.dbId
            };
        });
        setSchedule(newSchedule);
        setStep(3);
    };

    const handleConfirm = async () => {
        setIsLoading(true);
        try {
            const payload = {
                student_id: studentId,
                fee_type_id: Number(selectedFeeTypeId),
                academic_year: selectedYear,
                total_amount: totalAmount,
                installment_count: installmentCount,
                schedule: schedule.map(s => ({
                    target_month: s.target_month,
                    fee_date: s.fee_date,
                    amount: s.amount
                })),
                merge_targets: schedule
                    .map((s, idx) => s.merge_target_id ? { index: idx, existing_head_id: s.merge_target_id } : null)
                    .filter(x => x !== null)
            };

            await api.post("/v1/installments", payload);
            toast.success("Installment plan processed successfully!");
            onSuccess();
            onClose();
        } catch (err: any) {
            const msg = err.response?.data?.message || "Failed to process installments";
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-950 rounded-[32px] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 border border-white/10">

                {/* Header */}
                <div className="px-8 py-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                    <div>
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                             <CreditCard className="h-5 w-5 text-primary" />
                             Installment Breakdown
                        </h2>
                        <p className="text-xs font-semibold text-zinc-400 mt-0.5 uppercase tracking-widest">Student: {studentName} (CC: {studentId})</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X className="h-5 w-5 text-zinc-400" />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="flex px-10 py-5 bg-white dark:bg-zinc-950 border-b border-zinc-50 dark:border-zinc-900 overflow-x-auto gap-4 no-scrollbar">
                    {[1, 2, 3, 4].map((s) => (
                        <div key={s} className="flex items-center gap-3 flex-shrink-0">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                                step === s ? "bg-primary text-white shadow-lg shadow-primary/20 scale-110" :
                                step > s ? "bg-emerald-500 text-white" : "bg-zinc-100 dark:bg-zinc-900 text-zinc-400"
                            }`}>
                                {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
                            </div>
                            <span className={`text-[11px] font-black uppercase tracking-widest ${step === s ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-300"}`}>
                                {s === 1 ? "Selection" : s === 2 ? "Setup" : s === 3 ? "Schedule & Merge" : "Review"}
                            </span>
                            {s < 4 && <div className="w-6 h-px bg-zinc-100 dark:bg-zinc-800" />}
                        </div>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-10 bg-white dark:bg-zinc-950">

                    {step === 1 && (
                        <div className="max-w-md mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-300">
                             <div className="text-center">
                                <div className="h-16 w-16 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                                    <List className="h-8 w-8 text-primary" />
                                </div>
                                <h3 className="text-lg font-bold">Select Installment Source</h3>
                                <p className="text-sm text-zinc-500 font-medium mt-1">Which fee type are you breaking into installments?</p>
                            </div>
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Fee Type</label>
                                <select
                                    value={selectedFeeTypeId}
                                    onChange={(e) => setSelectedFeeTypeId(Number(e.target.value))}
                                    className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none cursor-pointer"
                                >
                                    <option value="" disabled>Select a fee type...</option>
                                    {feeTypes.map(ft => (
                                        <option key={ft.id} value={ft.id}>{ft.description}</option>
                                    ))}
                                </select>
                                {selectedFeeTypeId === 4 && (
                                    <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex items-start gap-3">
                                        <Info className="h-4 w-4 text-primary mt-0.5" />
                                        <p className="text-[11px] font-medium text-primary/80 leading-relaxed text-justify">
                                            <b>Note:</b> For Annual Fees (ID 4), the typical workflow is to break the total into 12 installments and merge them into the Monthly Tuition Fee rows.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="max-w-md mx-auto space-y-8 animate-in slide-in-from-right-4 duration-300">
                            <div className="text-center">
                                <h3 className="text-lg font-bold">Total & Count</h3>
                                <p className="text-sm text-zinc-500 font-medium mt-1">Define the installment parameters.</p>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 block mb-2">Total Amount (PKR)</label>
                                    <input
                                        type="number"
                                        value={totalAmount}
                                        onChange={(e) => setTotalAmount(Number(e.target.value))}
                                        className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-2xl font-black text-primary placeholder:text-zinc-300 outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 block mb-2">Installment Count</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="24"
                                        value={installmentCount}
                                        onChange={(e) => setInstallmentCount(Math.max(1, Number(e.target.value)))}
                                        className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 block mb-2">Academic Year</label>
                                    <input
                                        type="text"
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(e.target.value)}
                                        className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all uppercase"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold">Planned Schedule</h3>
                                    <p className="text-sm text-zinc-500 font-medium">Choose whether to create new separate heads or merge into existing Tuition rows.</p>
                                </div>
                                <div className="bg-primary/5 px-6 py-3 rounded-2xl border border-primary/10">
                                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">Total Split</p>
                                    <p className="text-xl font-black text-primary">PKR {schedule.reduce((acc, r) => acc + r.amount, 0).toLocaleString()}</p>
                                </div>
                            </div>

                            <div className="border border-zinc-100 dark:border-zinc-800 rounded-3xl overflow-hidden bg-white dark:bg-zinc-900/20 shadow-sm overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                        <tr>
                                            <th className="px-6 py-5">Month</th>
                                            <th className="px-6 py-5">Installment Date</th>
                                            <th className="px-6 py-5 text-right">Amount</th>
                                            <th className="px-6 py-5">Action / Target Head</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                                        {schedule.map((row, idx) => {
                                            // Smart filtering: Suggest fees that share the same fee_date as the installment
                                            const matches = existingFees.filter(ef =>
                                                ef.fee_date === row.fee_date &&
                                                ef.dbId &&
                                                (ef.feeId === 1 || !row.merge_target_id) // Prioritize Tuition Fee (ID 1), but allow any if user hasn't selected merge target
                                            );
                                            const monthName = MONTHS[MONTHS.findIndex(m => MONTH_TO_NUM[m] === row.target_month)];
                                            return (
                                                <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="space-y-2">
                                                            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{monthName}</p>
                                                            <div className="flex items-center gap-2">
                                                                <label className="text-[9px] font-black text-zinc-400 uppercase">Tar. Month:</label>
                                                                <select
                                                                    value={String(row.target_month)}
                                                                    onChange={(e) => {
                                                                        const newSch = [...schedule];
                                                                        const newTargetMonth = Number(e.target.value);
                                                                        newSch[idx].target_month = newTargetMonth;

                                                                        // Recalculate fee_date based on new target_month
                                                                        const yearParts = (selectedYear || academicYear || "").split('-');
                                                                        const firstYearRaw = yearParts[0].trim();
                                                                        let baseYear = parseInt(firstYearRaw);
                                                                        if (baseYear < 100) baseYear += 2000;
                                                                        if (isNaN(baseYear)) baseYear = new Date().getFullYear();

                                                                        const calendarYearOffset = (newTargetMonth < 8) ? 1 : 0;
                                                                        const cycleOffset = 0; // Assume no multi-year cycles when editing
                                                                        const finalYear = baseYear + calendarYearOffset + cycleOffset;
                                                                        newSch[idx].fee_date = `${finalYear}-${newTargetMonth.toString().padStart(2, '0')}-01`;

                                                                        setSchedule(newSch);
                                                                    }}
                                                                    className="bg-zinc-50 dark:bg-zinc-900 text-[10px] font-bold px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-primary/50"
                                                                >
                                                                    {Object.entries(MONTH_TO_NUM).map(([name, num]) => (
                                                                        <option key={num} value={String(num)}>
                                                                            {num} - {name}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <input
                                                            type="date"
                                                            value={row.fee_date}
                                                            onChange={(e) => {
                                                                const newSch = [...schedule];
                                                                newSch[idx].fee_date = e.target.value;
                                                                setSchedule(newSch);
                                                            }}
                                                            className="bg-transparent text-sm font-bold outline-none border-b border-dashed border-zinc-200 dark:border-zinc-800 focus:border-primary transition-all"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <input
                                                            type="number"
                                                            value={row.amount}
                                                            onChange={(e) => {
                                                                const newSch = [...schedule];
                                                                newSch[idx].amount = Number(e.target.value);
                                                                setSchedule(newSch);
                                                            }}
                                                            className="w-24 bg-transparent text-right text-sm font-black text-zinc-900 dark:text-zinc-100 outline-none focus:text-primary"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <select
                                                            value={row.merge_target_id || ""}
                                                            onChange={(e) => {
                                                                const newSch = [...schedule];
                                                                newSch[idx].merge_target_id = e.target.value ? Number(e.target.value) : undefined;
                                                                setSchedule(newSch);
                                                            }}
                                                            className={`text-xs font-bold px-4 py-2.5 rounded-xl border transition-all appearance-none cursor-pointer ${
                                                                row.merge_target_id
                                                                ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-600"
                                                                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500"
                                                            }`}
                                                        >
                                                            <option value="">+ Create New Separate Head</option>
                                                            {matches.length > 0 ? (
                                                                matches.map(m => (
                                                                    <option key={m.dbId} value={m.dbId}>
                                                                        Merge into: {m.feeDescription} (Total: {parseInt(m.amount).toLocaleString()})
                                                                    </option>
                                                                ))
                                                            ) : (
                                                                <option disabled>No matching fees for this date</option>
                                                            )}
                                                        </select>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-right-4 duration-300">
                             <div className="text-center">
                                <div className="h-16 w-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-3xl flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                                </div>
                                <h3 className="text-xl font-bold font-mono tracking-tight text-emerald-600">Final Review</h3>
                                <p className="text-sm text-zinc-500 font-medium mt-1">Review the changes before committing to the database.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-6 bg-zinc-50 dark:bg-zinc-900 rounded-[28px] border border-zinc-100 dark:border-zinc-800">
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Total Installment Value</p>
                                    <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100">PKR {totalAmount.toLocaleString()}</p>
                                </div>
                                <div className="p-6 bg-zinc-50 dark:bg-zinc-900 rounded-[28px] border border-zinc-100 dark:border-zinc-800">
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Fee Type being split</p>
                                    <p className="text-lg font-black text-zinc-900 dark:text-zinc-100 truncate">
                                        {feeTypes.find(f => f.id === selectedFeeTypeId)?.description || "N/A"}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">Breakdown Summary</p>
                                {schedule.map((row, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-5 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl shadow-sm">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-black">{idx + 1}</div>
                                            <div>
                                                <p className="text-sm font-black text-zinc-900 dark:text-zinc-100">
                                                    {new Date(row.fee_date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-[10px] font-black uppercase text-zinc-400">{row.fee_date}</p>
                                                    {row.merge_target_id ? (
                                                        <span className="text-[9px] font-black uppercase text-emerald-500 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded">
                                                            <Layers className="h-2 w-2" />
                                                            Merged with existing head
                                                        </span>
                                                    ) : (
                                                        <span className="text-[9px] font-black uppercase text-blue-500 flex items-center gap-1 bg-blue-500/10 px-2 py-0.5 rounded">
                                                            <Plus className="h-2 w-2" />
                                                            Standalone Head
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-base font-black text-zinc-900 dark:text-zinc-100">PKR {row.amount.toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer Controls */}
                <div className="px-10 py-8 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex gap-4">
                    <button
                        onClick={onClose}
                        className="h-16 px-10 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-sm font-black rounded-2xl transition-all active:scale-95"
                    >
                        Cancel
                    </button>
                    <div className="flex-1 flex justify-end gap-3">
                        {step > 1 && (
                            <button
                                onClick={() => setStep(step - 1)}
                                className="h-16 px-10 border border-zinc-200 dark:border-zinc-800 text-sm font-black rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-95 flex items-center gap-2"
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Previous
                            </button>
                        )}
                        <button
                            disabled={
                                (step === 1 && !selectedFeeTypeId) ||
                                (step === 2 && (totalAmount <= 0 || installmentCount <= 0)) ||
                                isLoading
                            }
                            onClick={() => {
                                if (step === 2) handleNextToStep3();
                                else if (step === 3) setStep(4);
                                else if (step === 4) handleConfirm();
                                else setStep(step + 1);
                            }}
                            className="h-16 px-12 bg-primary hover:bg-primary/90 text-white text-sm font-black rounded-2xl shadow-2xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                        >
                            {isLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : step === 4 ? (
                                "Process Installments"
                            ) : (
                                <>
                                    Continue
                                    <ChevronRight className="h-5 w-5" />
                                </>
                            )}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
