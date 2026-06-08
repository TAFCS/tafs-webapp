"use client";

import { useState, useEffect, useMemo } from "react";
import {
    X, ChevronRight, ChevronLeft, Loader2,
    CreditCard, CheckCircle2, List, Layers, Plus,
    GitMerge, CalendarDays
} from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

function getAcademicYearOptions(): string[] {
    const y = new Date().getFullYear();
    const opts: string[] = [];
    for (let i = y - 2; i <= y + 3; i++) opts.push(`${i}-${i + 1}`);
    return opts;
}

function parseAcademicYear(ay: string): [number, number] {
    const parts = ay.split("-");
    let y1 = parseInt(parts[0]?.trim() || "0");
    let y2 = parseInt(parts[1]?.trim() || "0");
    if (y1 < 100) y1 += 2000;
    if (y2 < 100) y2 += 2000;
    if (isNaN(y2) || y2 === 0) y2 = y1 + 1;
    return [y1, y2];
}

interface SelectedMonth { year: number; month: number; }

type Mode = "merge" | "standalone";

interface InstallmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    studentId: number;
    studentName: string;
    existingFees: any[];
    academicYear: string;
}

export default function InstallmentModal({
    isOpen, onClose, onSuccess, studentId, studentName, existingFees, academicYear,
}: InstallmentModalProps) {
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    // Step 1
    const [feeTypes, setFeeTypes] = useState<any[]>([]);
    const [selectedFeeTypeId, setSelectedFeeTypeId] = useState<number | "">(4);
    const [totalAmount, setTotalAmount] = useState<number>(0);
    const [selectedYear, setSelectedYear] = useState(academicYear);

    // Step 2
    const [mode, setMode] = useState<Mode | null>(null);

    // Step 3 — merge
    const [selectedHeadIds, setSelectedHeadIds] = useState<Set<number>>(new Set());

    // Step 3 — standalone
    const [selectedMonths, setSelectedMonths] = useState<SelectedMonth[]>([]);

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setMode(null);
            setSelectedHeadIds(new Set());
            setSelectedMonths([]);
            setTotalAmount(0);
            setSelectedYear(academicYear);
            fetchFeeTypes();
        }
    }, [isOpen]);

    const fetchFeeTypes = async () => {
        try {
            const { data } = await api.get("/v1/fee-types");
            setFeeTypes(data?.data || []);
        } catch {
            // silent
        }
    };

    const mergeableHeads = useMemo(
        // Only NOT_ISSUED heads that aren't already part of another plan can be merged
        // into — the backend snapshots voucher_heads.net_amount at issuance, so merging
        // into an issued/paid head would silently desync the voucher from the balance.
        () => existingFees.filter(ef => ef.dbId && ef.status === 'NOT_ISSUED' && !ef.installment_id),
        [existingFees],
    );

    const calendarYears = useMemo(() => {
        const [y1, y2] = parseAcademicYear(selectedYear);
        return [y1, y2];
    }, [selectedYear]);

    const isMonthSelected = (year: number, month: number) =>
        selectedMonths.some(s => s.year === year && s.month === month);

    const toggleMonth = (year: number, month: number) => {
        setSelectedMonths(prev => {
            const exists = prev.some(s => s.year === year && s.month === month);
            if (exists) return prev.filter(s => !(s.year === year && s.month === month));
            return [...prev, { year, month }].sort((a, b) =>
                a.year !== b.year ? a.year - b.year : a.month - b.month,
            );
        });
    };

    const mergeCount = selectedHeadIds.size;
    const standaloneCount = selectedMonths.length;

    const perMerge = mergeCount > 0 ? Math.floor(totalAmount / mergeCount) : 0;
    const mergeRem = mergeCount > 0 ? totalAmount - perMerge * mergeCount : 0;

    const perStandalone = standaloneCount > 0 ? Math.floor(totalAmount / standaloneCount) : 0;
    const standaloneRem = standaloneCount > 0 ? totalAmount - perStandalone * standaloneCount : 0;

    const selectedMergeHeads = mergeableHeads.filter(h => selectedHeadIds.has(h.dbId));

    const handleConfirm = async () => {
        setIsLoading(true);
        try {
            let schedule: any[] = [];
            let merge_targets: any[] = [];

            if (mode === "merge") {
                schedule = selectedMergeHeads.map((h, i) => ({
                    target_month: h.target_month,
                    fee_date: h.fee_date || `${calendarYears[0]}-${String(h.target_month).padStart(2, "0")}-01`,
                    amount: i === selectedMergeHeads.length - 1 ? perMerge + mergeRem : perMerge,
                }));
                merge_targets = selectedMergeHeads.map((h, i) => ({
                    index: i,
                    existing_head_id: h.dbId,
                }));
            } else {
                schedule = selectedMonths.map((m, i) => ({
                    target_month: m.month,
                    fee_date: `${m.year}-${String(m.month).padStart(2, "0")}-01`,
                    amount: i === selectedMonths.length - 1 ? perStandalone + standaloneRem : perStandalone,
                }));
            }

            await api.post("/v1/installments", {
                student_id: studentId,
                fee_type_id: Number(selectedFeeTypeId),
                academic_year: selectedYear,
                total_amount: totalAmount,
                installment_count: schedule.length,
                schedule,
                merge_targets: merge_targets.length > 0 ? merge_targets : undefined,
            });

            toast.success("Installment plan processed successfully!");
            onSuccess();
            onClose();
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to process installments");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const canProceed =
        (step === 1 && !!selectedFeeTypeId && totalAmount > 0) ||
        (step === 2 && mode !== null) ||
        (step === 3 && (mode === "merge" ? mergeCount > 0 : standaloneCount > 0)) ||
        step === 4;

    const stepLabels = ["Details", "Mode", "Configure", "Review"];

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
                        <p className="text-xs font-semibold text-zinc-400 mt-0.5 uppercase tracking-widest">
                            Student: {studentName} (CC: {studentId})
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X className="h-5 w-5 text-zinc-400" />
                    </button>
                </div>

                {/* Progress */}
                <div className="flex px-10 py-5 bg-white dark:bg-zinc-950 border-b border-zinc-50 dark:border-zinc-900 overflow-x-auto gap-4 no-scrollbar">
                    {stepLabels.map((label, i) => {
                        const s = i + 1;
                        return (
                            <div key={s} className="flex items-center gap-3 flex-shrink-0">
                                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                                    step === s ? "bg-primary text-white shadow-lg shadow-primary/20 scale-110" :
                                    step > s ? "bg-emerald-500 text-white" : "bg-zinc-100 dark:bg-zinc-900 text-zinc-400"
                                }`}>
                                    {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
                                </div>
                                <span className={`text-[11px] font-black uppercase tracking-widest ${
                                    step === s ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-300"
                                }`}>
                                    {label}
                                </span>
                                {s < 4 && <div className="w-6 h-px bg-zinc-100 dark:bg-zinc-800" />}
                            </div>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-10 bg-white dark:bg-zinc-950">

                    {/* ── Step 1: Fee type + total + academic year ── */}
                    {step === 1 && (
                        <div className="max-w-md mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-300">
                            <div className="text-center">
                                <div className="h-16 w-16 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                                    <List className="h-8 w-8 text-primary" />
                                </div>
                                <h3 className="text-lg font-bold">Installment Details</h3>
                                <p className="text-sm text-zinc-500 font-medium mt-1">Choose the fee type, enter the total, and select the academic year.</p>
                            </div>
                            <div className="space-y-5">
                                <div>
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 block mb-2">Fee Type</label>
                                    <select
                                        value={selectedFeeTypeId}
                                        onChange={e => setSelectedFeeTypeId(Number(e.target.value))}
                                        className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="" disabled>Select a fee type…</option>
                                        {feeTypes.map(ft => (
                                            <option key={ft.id} value={ft.id}>{ft.description}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 block mb-2">Total Amount (PKR)</label>
                                    <input
                                        type="number"
                                        value={totalAmount || ""}
                                        onChange={e => setTotalAmount(Number(e.target.value))}
                                        className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-2xl font-black text-primary placeholder:text-zinc-300 outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 block mb-2">Academic Year</label>
                                    <select
                                        value={selectedYear}
                                        onChange={e => setSelectedYear(e.target.value)}
                                        className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all appearance-none cursor-pointer"
                                    >
                                        {getAcademicYearOptions().map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Step 2: Mode selection ── */}
                    {step === 2 && (
                        <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-right-4 duration-300">
                            <div className="text-center">
                                <h3 className="text-lg font-bold">Distribution Mode</h3>
                                <p className="text-sm text-zinc-500 font-medium mt-1">How should the installments be applied?</p>
                            </div>
                            <div className="grid grid-cols-2 gap-5">
                                {([
                                    {
                                        key: "merge" as Mode,
                                        icon: GitMerge,
                                        title: "Merge into Existing",
                                        desc: "Split the total across already-created fee heads. Select which rows absorb the installment amounts.",
                                    },
                                    {
                                        key: "standalone" as Mode,
                                        icon: CalendarDays,
                                        title: "Standalone Heads",
                                        desc: "Create new independent fee rows. Pick months from a calendar — the total is divided equally across selected months.",
                                    },
                                ] as const).map(opt => {
                                    const Icon = opt.icon;
                                    const active = mode === opt.key;
                                    return (
                                        <button
                                            key={opt.key}
                                            onClick={() => setMode(opt.key)}
                                            className={`flex flex-col gap-5 p-8 rounded-[28px] border-2 transition-all text-left ${
                                                active
                                                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                                                    : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                                            }`}
                                        >
                                            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${active ? "bg-primary/20" : "bg-zinc-100 dark:bg-zinc-800"}`}>
                                                <Icon className={`h-7 w-7 ${active ? "text-primary" : "text-zinc-400"}`} />
                                            </div>
                                            <div className="flex-1">
                                                <p className={`text-base font-black ${active ? "text-primary" : "text-zinc-900 dark:text-zinc-100"}`}>{opt.title}</p>
                                                <p className="text-xs text-zinc-400 font-medium mt-1 leading-relaxed">{opt.desc}</p>
                                            </div>
                                            {active && <CheckCircle2 className="h-5 w-5 text-primary self-end" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── Step 3: Merge — head selection ── */}
                    {step === 3 && mode === "merge" && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold">Select Fee Heads to Merge Into</h3>
                                    <p className="text-sm text-zinc-500 font-medium">
                                        Check the rows that should absorb the installment. Total ÷ selected count.
                                    </p>
                                </div>
                                <div className="bg-primary/5 px-6 py-3 rounded-2xl border border-primary/10 text-right shrink-0">
                                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">Per Head</p>
                                    <p className="text-xl font-black text-primary">PKR {mergeCount > 0 ? perMerge.toLocaleString() : "—"}</p>
                                    {mergeRem > 0 && <p className="text-[9px] text-primary/60 font-bold">+{mergeRem} on last</p>}
                                </div>
                            </div>

                            {mergeableHeads.length === 0 ? (
                                <div className="text-center py-20 text-zinc-400">
                                    <p className="font-bold">No existing fee heads found.</p>
                                    <p className="text-sm mt-1">Go back and switch to Standalone mode.</p>
                                </div>
                            ) : (
                                <div className="border border-zinc-100 dark:border-zinc-800 rounded-3xl overflow-hidden">
                                    <table className="w-full text-left">
                                        <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800">
                                            <tr>
                                                <th className="px-5 py-4 w-10">
                                                    <input
                                                        type="checkbox"
                                                        checked={mergeCount === mergeableHeads.length && mergeableHeads.length > 0}
                                                        onChange={e => {
                                                            if (e.target.checked) setSelectedHeadIds(new Set(mergeableHeads.map(h => h.dbId)));
                                                            else setSelectedHeadIds(new Set());
                                                        }}
                                                        className="h-4 w-4 rounded border-zinc-300 text-primary cursor-pointer"
                                                    />
                                                </th>
                                                {["Fee Head", "Period", "Current Amount", "Installment Share"].map(h => (
                                                    <th key={h} className="px-5 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                                            {mergeableHeads.map(h => {
                                                const checked = selectedHeadIds.has(h.dbId);
                                                return (
                                                    <tr
                                                        key={h.dbId}
                                                        onClick={() => setSelectedHeadIds(prev => {
                                                            const next = new Set(prev);
                                                            if (next.has(h.dbId)) next.delete(h.dbId);
                                                            else next.add(h.dbId);
                                                            return next;
                                                        })}
                                                        className={`cursor-pointer transition-colors ${
                                                            checked ? "bg-primary/[0.03] dark:bg-primary/10" : "hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30"
                                                        }`}
                                                    >
                                                        <td className="px-5 py-3.5">
                                                            <input type="checkbox" checked={checked} readOnly className="h-4 w-4 rounded border-zinc-300 text-primary pointer-events-none" />
                                                        </td>
                                                        <td className="px-5 py-3.5">
                                                            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{h.feeDescription}</p>
                                                            {h.description_prefix && <p className="text-[10px] text-zinc-400">{h.description_prefix}</p>}
                                                        </td>
                                                        <td className="px-5 py-3.5 text-sm text-zinc-500">{h.month || h.fee_date || "—"}</td>
                                                        <td className="px-5 py-3.5 text-sm font-mono text-zinc-700 dark:text-zinc-300">
                                                            {parseInt(h.amount).toLocaleString()}
                                                        </td>
                                                        <td className="px-5 py-3.5">
                                                            {checked ? (
                                                                <span className="text-sm font-black text-primary">PKR {perMerge.toLocaleString()}</span>
                                                            ) : (
                                                                <span className="text-xs text-zinc-300">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Step 3: Standalone — month calendar ── */}
                    {step === 3 && mode === "standalone" && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold">Select Months</h3>
                                    <p className="text-sm text-zinc-500 font-medium">
                                        Click months to toggle. Total ÷ selected months — equal split.
                                    </p>
                                </div>
                                <div className="bg-primary/5 px-6 py-3 rounded-2xl border border-primary/10 text-right shrink-0">
                                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">Per Month</p>
                                    <p className="text-xl font-black text-primary">PKR {standaloneCount > 0 ? perStandalone.toLocaleString() : "—"}</p>
                                    {standaloneRem > 0 && <p className="text-[9px] text-primary/60 font-bold">+{standaloneRem} on last</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {calendarYears.map(year => (
                                    <div key={year} className="border border-zinc-100 dark:border-zinc-800 rounded-3xl overflow-hidden">
                                        <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800">
                                            <p className="text-sm font-black text-zinc-700 dark:text-zinc-300">{year}</p>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 p-4">
                                            {MONTH_NAMES.map((name, i) => {
                                                const month = i + 1;
                                                const selected = isMonthSelected(year, month);
                                                return (
                                                    <button
                                                        key={month}
                                                        onClick={() => toggleMonth(year, month)}
                                                        className={`py-3 px-2 rounded-xl text-xs font-black transition-all ${
                                                            selected
                                                                ? "bg-primary text-white shadow-md shadow-primary/20 scale-105"
                                                                : "bg-zinc-50 dark:bg-zinc-900 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-100 dark:border-zinc-800"
                                                        }`}
                                                    >
                                                        {name.slice(0, 3)}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {selectedMonths.length > 0 && (
                                <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl">
                                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">
                                        {selectedMonths.length} month{selectedMonths.length !== 1 ? "s" : ""} selected
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedMonths.map(m => (
                                            <span key={`${m.year}-${m.month}`} className="text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
                                                {MONTH_NAMES[m.month - 1].slice(0, 3)} {m.year}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Step 4: Review ── */}
                    {step === 4 && (
                        <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-right-4 duration-300">
                            <div className="text-center">
                                <div className="h-16 w-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-3xl flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                                </div>
                                <h3 className="text-xl font-bold font-mono tracking-tight text-emerald-600">Final Review</h3>
                                <p className="text-sm text-zinc-500 font-medium mt-1">Review before committing to the database.</p>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { label: "Total", value: `PKR ${totalAmount.toLocaleString()}` },
                                    { label: "Fee Type", value: feeTypes.find(f => f.id === selectedFeeTypeId)?.description || "N/A" },
                                    { label: "Mode", value: mode === "merge" ? "Merge into Existing" : "Standalone Heads" },
                                ].map(c => (
                                    <div key={c.label} className="p-5 bg-zinc-50 dark:bg-zinc-900 rounded-[20px] border border-zinc-100 dark:border-zinc-800">
                                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{c.label}</p>
                                        <p className="text-sm font-black text-zinc-900 dark:text-zinc-100 truncate">{c.value}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-2">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3 ml-1">
                                    {mode === "merge"
                                        ? `${mergeCount} head${mergeCount !== 1 ? "s" : ""} selected`
                                        : `${standaloneCount} month${standaloneCount !== 1 ? "s" : ""} selected`}
                                </p>

                                {mode === "merge"
                                    ? selectedMergeHeads.map((h, i) => {
                                        const amt = i === selectedMergeHeads.length - 1 ? perMerge + mergeRem : perMerge;
                                        return (
                                            <div key={h.dbId} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                                                        <Layers className="h-4 w-4 text-emerald-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{h.feeDescription}</p>
                                                        <p className="text-[10px] text-zinc-400">{h.month || h.fee_date}</p>
                                                    </div>
                                                </div>
                                                <p className="text-sm font-black text-zinc-900 dark:text-zinc-100">PKR {amt.toLocaleString()}</p>
                                            </div>
                                        );
                                    })
                                    : selectedMonths.map((m, i) => {
                                        const amt = i === selectedMonths.length - 1 ? perStandalone + standaloneRem : perStandalone;
                                        return (
                                            <div key={`${m.year}-${m.month}`} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                                        <Plus className="h-4 w-4 text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{MONTH_NAMES[m.month - 1]} {m.year}</p>
                                                        <p className="text-[10px] text-zinc-400">{m.year}-{String(m.month).padStart(2, "0")}-01</p>
                                                    </div>
                                                </div>
                                                <p className="text-sm font-black text-zinc-900 dark:text-zinc-100">PKR {amt.toLocaleString()}</p>
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
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
                                onClick={() => setStep(s => s - 1)}
                                className="h-16 px-10 border border-zinc-200 dark:border-zinc-800 text-sm font-black rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-95 flex items-center gap-2"
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Previous
                            </button>
                        )}
                        <button
                            disabled={!canProceed || isLoading}
                            onClick={() => step === 4 ? handleConfirm() : setStep(s => s + 1)}
                            className="h-16 px-12 bg-primary hover:bg-primary/90 text-white text-sm font-black rounded-2xl shadow-2xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                        >
                            {isLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : step === 4 ? (
                                "Process Installments"
                            ) : (
                                <>Continue <ChevronRight className="h-5 w-5" /></>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
