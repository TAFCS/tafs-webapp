"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
    Search, Loader2, Filter, CheckCircle2, Clock, XCircle, Trash2,
    Building2, GraduationCap, Users, Hash, SlidersHorizontal,
    ChevronLeft, ChevronRight, RefreshCw, X, Calendar, AlertTriangle,
    Layers, Landmark, Banknote, ArrowRight, Download, ChevronDown,
    FilePlus2, Calculator
} from "lucide-react";
import api from "@/lib/api";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { fetchClasses } from "@/store/slices/classesSlice";
import { fetchCampuses } from "@/store/slices/campusesSlice";
import { fetchSections } from "@/store/slices/sectionsSlice";
import { fetchBanks } from "@/store/slices/banksSlice";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

// --- Custom Dropdown ---
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

export default function BatchIssuePage() {
    const dispatch = useAppDispatch();
    const router = useRouter();

    // Redux data
    const campuses = useAppSelector(s => s.campuses.items);
    const classes = useAppSelector(s => s.classes.items);
    const sections = useAppSelector(s => s.sections.items);
    const banks = useAppSelector(s => s.banks.items);

    // Filter/Config State
    const [campusId, setCampusId] = useState<number | "">("");
    const [classId, setClassId] = useState<number | "">("");
    const [sectionId, setSectionId] = useState<number | "">("");
    const [feeDateFrom, setFeeDateFrom] = useState("");
    const [feeDateTo, setFeeDateTo] = useState("");
    const [academicYear, setAcademicYear] = useState("");
    const [bankAccountId, setBankAccountId] = useState<number | "">("");
    const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [dueDate, setDueDate] = useState("");
    const [validityDate, setValidityDate] = useState("");
    const [applyLateFee, setApplyLateFee] = useState(true);
    const [lateFeeAmount, setLateFeeAmount] = useState(1000);
    const [waiveSurcharge, setWaiveSurcharge] = useState(false);

    // Preview State
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [isPrevewing, setIsPreviewing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [expandedCC, setExpandedCC] = useState<number[]>([]);
    const [skippedVouchers, setSkippedVouchers] = useState<Record<string, boolean>>({}); // studentCc|feeDate -> boolean

    // Load reference data
    useEffect(() => {
        if (campuses.length === 0) dispatch(fetchCampuses());
        if (classes.length === 0) dispatch(fetchClasses());
        if (sections.length === 0) dispatch(fetchSections());
        if (banks.length === 0) dispatch(fetchBanks());
    }, [dispatch]);

    const handleExportCSV = () => {
        if (previewData.length === 0) return;

        const rows = [
            ["CC", "Full Name", "Class", "Section", "Fee Month", "Academic Year", "Heads Count", "Total Amount", "Status"]
        ];

        previewData.forEach(student => {
            student.voucher_groups.forEach((group: any) => {
                const skipKey = `${student.cc}|${group.fee_date}`;
                const isSkipped = group.already_issued || skippedVouchers[skipKey];
                const total = group.heads.reduce((sum: number, h: any) => sum + h.amount, 0);
                
                rows.push([
                    student.cc.toString(),
                    student.full_name,
                    student.class,
                    student.section,
                    group.fee_date,
                    group.academic_year,
                    group.heads.length.toString(),
                    total.toString(),
                    isSkipped ? "SKIPPED" : "WILL_GENERATE"
                ]);
            });
        });

        const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `batch_preview_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePreview = async () => {
        if (!campusId || !feeDateFrom || !feeDateTo) {
            toast.error("Please select Campus and Fee Date Range.");
            return;
        }

        setIsPreviewing(true);
        const loadingToast = toast.loading("Generating preview...");
        try {
            const { data } = await api.post("/v1/vouchers/batch-preview", {
                campus_id: campusId,
                class_id: classId || undefined,
                section_id: sectionId || undefined,
                fee_date_from: feeDateFrom,
                fee_date_to: feeDateTo,
                academic_year: academicYear || undefined,
            });
            setPreviewData(data.data);
            toast.dismiss(loadingToast);
            toast.success("Preview loaded.");
        } catch (err: any) {
            toast.dismiss(loadingToast);
            toast.error(err.response?.data?.message || "Failed to generate preview.");
            console.error(err);
        } finally {
            setIsPreviewing(false);
        }
    };

    const handleGenerate = async () => {
        if (!bankAccountId || !issueDate || !dueDate) {
            toast.error("Please select Bank Account, Issue Date and Due Date.");
            return;
        }

        // Collect all student CCs that have at least one voucher group NOT skipped
        const studentCCs = previewData
            .filter(student => {
                const hasVouchers = student.voucher_groups.some((group: any) => {
                    const skipKey = `${student.cc}|${group.fee_date}`;
                    return !group.already_issued && !skippedVouchers[skipKey];
                });
                return hasVouchers;
            })
            .map(s => s.cc);

        if (studentCCs.length === 0) {
            toast.error("No vouchers to generate based on selection.");
            return;
        }

        if (!window.confirm(`Generate vouchers for ${studentCCs.length} students?`)) {
            return;
        }

        setIsGenerating(true);
        const loadingToast = toast.loading("Starting batch generation job...");
        try {
            const { data } = await api.post("/v1/vouchers/batch-issue", {
                campus_id: campusId,
                class_id: classId || undefined,
                section_id: sectionId || undefined,
                fee_date_from: feeDateFrom,
                fee_date_to: feeDateTo,
                academic_year: academicYear || undefined,
                bank_account_id: bankAccountId,
                issue_date: issueDate,
                due_date: dueDate,
                validity_date: validityDate || undefined,
                apply_late_fee: applyLateFee,
                late_fee_amount: lateFeeAmount,
                waive_surcharge: waiveSurcharge,
                student_ccs: studentCCs,
                skip_already_issued: true,
            });

            toast.dismiss(loadingToast);
            toast.success("Batch generation job started!");
            router.push(`/bulk-voucher`); // Redirect to status page
        } catch (err: any) {
            toast.dismiss(loadingToast);
            toast.error(err.response?.data?.message || "Failed to start batch generation.");
            console.error(err);
        } finally {
            setIsGenerating(false);
        }
    };

    const toggleExpand = (cc: number) => {
        setExpandedCC(prev => prev.includes(cc) ? prev.filter(c => c !== cc) : [...prev, cc]);
    };

    const toggleSkip = (cc: number, date: string) => {
        const key = `${cc}|${date}`;
        setSkippedVouchers(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Stats
    const totalStudents = previewData.length;
    let totalGroups = 0;
    let willGenerateCount = 0;
    let alreadyIssuedCount = 0;
    let manuallySkippedCount = 0;
    let estimatedTotal = 0;

    previewData.forEach(student => {
        student.voucher_groups.forEach((group: any) => {
            totalGroups++;
            const skipKey = `${student.cc}|${group.fee_date}`;
            if (group.already_issued) {
                alreadyIssuedCount++;
            } else if (skippedVouchers[skipKey]) {
                manuallySkippedCount++;
            } else {
                willGenerateCount++;
                estimatedTotal += group.heads.reduce((sum: number, h: any) => sum + h.amount, 0);
            }
        });
    });

    const campusOptions: DropdownOption[] = campuses.map(c => ({ id: c.id, label: c.campus_name, sub: c.campus_code }));
    const classOptions: DropdownOption[] = classes.map(c => ({ id: c.id, label: c.description, sub: c.class_code }));
    const sectionOptions: DropdownOption[] = sections.map(s => ({ id: s.id, label: s.description }));
    const bankOptions: DropdownOption[] = banks.map(b => ({ id: b.id, label: b.bank_name, sub: b.account_number }));

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                        <span className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600">
                            <Layers className="h-6 w-6" />
                        </span>
                        Batch Issue Vouchers
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm">
                        Preview fee heads and generate vouchers in bulk with precision.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* Configuration Panel (4 cols) */}
                <div className="xl:col-span-4 space-y-6 sticky top-6">
                    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[28px] p-6 shadow-sm overflow-hidden">
                        <div className="flex items-center gap-2 mb-6">
                            <SlidersHorizontal className="h-4 w-4 text-primary" />
                            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Batch Configuration</h2>
                        </div>

                        <div className="space-y-5">
                            {/* Scope Filters */}
                            <div className="grid grid-cols-1 gap-4">
                                <FilterDropdown
                                    label="Campus" icon={Building2} value={campusId} options={campusOptions}
                                    placeholder="Select Campus" onSelect={setCampusId} onClear={() => setCampusId("")}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <FilterDropdown
                                        label="Class" icon={GraduationCap} value={classId} options={classOptions}
                                        placeholder="Select Class" onSelect={setClassId} onClear={() => setClassId("")}
                                    />
                                    <FilterDropdown
                                        label="Section" icon={Users} value={sectionId} options={sectionOptions}
                                        placeholder="Select Section" onSelect={setSectionId} onClear={() => setSectionId("")}
                                    />
                                </div>
                            </div>

                            <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-2" />

                            {/* Fee Dates */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] flex items-center gap-1.5 ml-1">
                                    <Calendar className="h-3.5 w-3.5" /> Fee Month Range
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="date" value={feeDateFrom} onChange={e => setFeeDateFrom(e.target.value)}
                                        className="h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all text-zinc-700 dark:text-zinc-300"
                                    />
                                    <input
                                        type="date" value={feeDateTo} onChange={e => setFeeDateTo(e.target.value)}
                                        className="h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all text-zinc-700 dark:text-zinc-300"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] flex items-center gap-1.5 ml-1">
                                    <Hash className="h-3.5 w-3.5" /> Academic Year
                                </label>
                                <input
                                    type="text" placeholder="e.g. 2025-2026" value={academicYear} onChange={e => setAcademicYear(e.target.value)}
                                    className="h-11 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all text-zinc-700 dark:text-zinc-300 font-semibold"
                                />
                            </div>

                            <button
                                onClick={handlePreview}
                                disabled={isPrevewing}
                                className="w-full flex items-center justify-center gap-2 h-12 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all shadow-xl shadow-zinc-500/10 active:scale-95"
                            >
                                {isPrevewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                                {isPrevewing ? "Loading Preview..." : "Calculate Preview"}
                            </button>
                        </div>
                    </div>

                    {previewData.length > 0 && (
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[28px] p-6 shadow-sm animate-in slide-in-from-bottom-4 duration-300">
                            <div className="flex items-center gap-2 mb-6">
                                <Banknote className="h-4 w-4 text-emerald-500" />
                                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Issuance Settings</h2>
                            </div>

                            <div className="space-y-5">
                                <FilterDropdown
                                    label="Bank Account" icon={Landmark} value={bankAccountId} options={bankOptions}
                                    placeholder="Select Bank" onSelect={setBankAccountId} onClear={() => setBankAccountId("")}
                                />

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Issue Date</label>
                                        <input
                                            type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)}
                                            className="h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 text-rose-500">Due Date</label>
                                        <input
                                            type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                                            className="h-11 px-3 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 rounded-xl text-sm"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-4 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Late Fee Charge</span>
                                        <button 
                                            onClick={() => setApplyLateFee(!applyLateFee)}
                                            className={`w-10 h-5 rounded-full relative transition-colors ${applyLateFee ? "bg-primary" : "bg-zinc-300"}`}
                                        >
                                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${applyLateFee ? "right-1" : "left-1"}`} />
                                        </button>
                                    </div>
                                    {applyLateFee && (
                                        <input
                                            type="number" value={lateFeeAmount} onChange={e => setLateFeeAmount(Number(e.target.value))}
                                            className="h-9 px-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm font-mono"
                                        />
                                    )}
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Waive Surcharges</span>
                                        <button 
                                            onClick={() => setWaiveSurcharge(!waiveSurcharge)}
                                            className={`w-10 h-5 rounded-full relative transition-colors ${waiveSurcharge ? "bg-amber-500" : "bg-zinc-300"}`}
                                        >
                                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${waiveSurcharge ? "right-1" : "left-1"}`} />
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating}
                                    className="w-full flex items-center justify-center gap-2 h-14 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-primary-hover transition-all shadow-xl shadow-primary/20 active:scale-95 disabled:opacity-50"
                                >
                                    {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <FilePlus2 className="h-5 w-5" />}
                                    {isGenerating ? "Generating..." : "Generate Batch"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Preview Table (8 cols) */}
                <div className="xl:col-span-8 space-y-6">
                    {previewData.length === 0 ? (
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[28px] p-20 flex flex-col items-center text-center shadow-sm">
                            <div className="p-6 bg-zinc-50 dark:bg-zinc-900 rounded-full mb-4">
                                <Search className="h-10 w-10 text-zinc-300" />
                            </div>
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Ready to Preview</h3>
                            <p className="text-zinc-400 text-sm max-w-sm mt-2">
                                Configure the scope and fee date range on the left, then click "Calculate Preview" to see exactly what will be issued.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Summary Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { label: "Students", value: totalStudents, icon: Users, color: "text-blue-500" },
                                    { label: "Will Generate", value: willGenerateCount, icon: FilePlus2, color: "text-emerald-500" },
                                    { label: "Already Issued", value: alreadyIssuedCount, icon: AlertTriangle, color: "text-amber-500" },
                                    { label: "Est. Total Amount", value: `PKR ${estimatedTotal.toLocaleString()}`, icon: Banknote, color: "text-indigo-500", full: true },
                                ].map(s => (
                                    <div key={s.label} className={`bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col ${s.full ? "md:col-span-1" : ""}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{s.label}</span>
                                            <s.icon className={`h-4 w-4 ${s.color}`} />
                                        </div>
                                        <p className="text-lg font-black text-zinc-900 dark:text-zinc-100 tabular-nums">{s.value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Actions Toolbar */}
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest">Preview Results</h3>
                                <button
                                    onClick={handleExportCSV}
                                    className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl text-xs font-bold hover:bg-zinc-200 transition-all border border-zinc-200 dark:border-zinc-700"
                                >
                                    <Download className="h-4 w-4" />
                                    Export CSV
                                </button>
                            </div>

                            {/* Student List */}
                            <div className="space-y-4">
                                {previewData.map((student) => (
                                    <div 
                                        key={student.cc}
                                        className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm transition-all"
                                    >
                                        {/* Student Header */}
                                        <div 
                                            onClick={() => toggleExpand(student.cc)}
                                            className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-black text-zinc-500">
                                                    CC-{student.cc}
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{student.full_name}</h3>
                                                    <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">{student.class} · {student.section}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="hidden md:flex items-center gap-4">
                                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                                        {student.voucher_groups.length} Groups
                                                    </span>
                                                    <div className="flex -space-x-1">
                                                        {student.voucher_groups.map((g: any, i: number) => {
                                                            const skipKey = `${student.cc}|${g.fee_date}`;
                                                            const isSkipped = g.already_issued || skippedVouchers[skipKey];
                                                            return (
                                                                <div 
                                                                    key={i} 
                                                                    className={`w-2 h-2 rounded-full border-2 border-white dark:border-zinc-950 ${isSkipped ? "bg-amber-400" : "bg-emerald-500"}`} 
                                                                    title={g.fee_date}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                                <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${expandedCC.includes(student.cc) ? "rotate-180" : ""}`} />
                                            </div>
                                        </div>

                                        {/* Expandable Voucher Groups */}
                                        <AnimatePresence>
                                            {expandedCC.includes(student.cc) && (
                                                <motion.div
                                                    initial={{ height: 0 }}
                                                    animate={{ height: "auto" }}
                                                    exit={{ height: 0 }}
                                                    className="overflow-hidden bg-zinc-50/50 dark:bg-zinc-900/30 border-t border-zinc-100 dark:border-zinc-800"
                                                >
                                                    <div className="p-6 space-y-4">
                                                        {student.voucher_groups.map((group: any, idx: number) => {
                                                            const skipKey = `${student.cc}|${group.fee_date}`;
                                                            const isManuallySkipped = skippedVouchers[skipKey];
                                                            const isWillGenerate = !group.already_issued && !isManuallySkipped;
                                                            const total = group.heads.reduce((s: number, h: any) => s + h.amount, 0);

                                                            return (
                                                                <div 
                                                                    key={idx}
                                                                    className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all
                                                                        ${isWillGenerate ? "bg-white dark:bg-zinc-950 border-emerald-100 dark:border-emerald-900/30 shadow-sm" : "bg-zinc-100/50 dark:bg-zinc-800/20 border-zinc-200 dark:border-zinc-800 opacity-70"}`}
                                                                >
                                                                    <div className="flex items-center gap-4">
                                                                        <div className={`p-2 rounded-lg ${isWillGenerate ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"}`}>
                                                                            <Calendar className="h-4 w-4" />
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{new Date(group.fee_date).toLocaleDateString("en-PK", { month: "long", year: "numeric" })}</p>
                                                                            <p className="text-[10px] text-zinc-400 font-medium">Academic Year: {group.academic_year}</p>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex-1 max-w-xs">
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {group.heads.map((h: any) => (
                                                                                <span key={h.id} className="text-[9px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded border border-zinc-200 dark:border-zinc-700 whitespace-nowrap">
                                                                                    {h.fee_type}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    </div>

                                                                    <div className="text-right flex items-center gap-6 justify-between md:justify-end">
                                                                        <div className="flex flex-col items-end">
                                                                            <p className={`text-sm font-black tabular-nums ${isWillGenerate ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"}`}>
                                                                                {total.toLocaleString()}
                                                                            </p>
                                                                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md mt-1
                                                                                ${group.already_issued ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600" : 
                                                                                  isManuallySkipped ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400" : 
                                                                                  "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"}`}>
                                                                                {group.already_issued ? "Already Issued" : isManuallySkipped ? "Skipped" : "Will Generate"}
                                                                            </span>
                                                                        </div>

                                                                        {!group.already_issued && (
                                                                            <button 
                                                                                onClick={(e) => { e.stopPropagation(); toggleSkip(student.cc, group.fee_date); }}
                                                                                className={`p-2 rounded-lg transition-colors ${isManuallySkipped ? "text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" : "text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"}`}
                                                                                title={isManuallySkipped ? "Restore" : "Skip this voucher"}
                                                                            >
                                                                                {isManuallySkipped ? <RefreshCw className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Warning Footer */}
            <div className="flex items-center gap-3 p-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-[24px] shadow-2xl">
                <div className="p-2 bg-white/10 dark:bg-black/5 rounded-xl">
                    <AlertTriangle className="h-5 w-5 text-amber-400" />
                </div>
                <div className="flex-1">
                    <p className="text-xs font-bold">Important Notice</p>
                    <p className="text-[10px] opacity-70">
                        Vouchers will only be generated for groups marked as "Will Generate". Existing non-VOID vouchers are automatically skipped to prevent duplication.
                    </p>
                </div>
            </div>
        </div>
    );
}
