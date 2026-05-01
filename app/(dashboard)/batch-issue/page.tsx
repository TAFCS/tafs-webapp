"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    AlertCircle,
    CheckCircle2,
    Clock3,
    FileText,
    RefreshCw,
    Send,
    Search,
    Users,
    ChevronDown,
    ChevronUp,
    Download,
    Ban,
    Banknote,
    Calendar,
    Building2,
    Sparkles,
    Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/src/lib/api";
import { AppDispatch, RootState } from "@/src/store/store";
import { fetchClasses } from "@/src/store/slices/classesSlice";
import { fetchCampuses } from "@/src/store/slices/campusesSlice";
import { fetchSections } from "@/src/store/slices/sectionsSlice";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BulkStudentPreview {
    cc: number;
    student_full_name: string;
    gr_number: string | null;
    class_name: string;
    section_name: string;
    is_already_issued: boolean;
}

type ResolvedStudent = {
    cc: number;
    full_name: string;
    gr_number?: string | null;
};

interface BankAccount {
    id: number;
    bank_name: string;
    account_number: string;
    is_active: boolean;
}

// ─── Components ──────────────────────────────────────────────────────────────
interface MultiSelectProps {
    label: string;
    options: { id: number; label: string }[];
    selectedIds: number[];
    onChange: (ids: number[]) => void;
    placeholder: string;
    icon: React.ReactNode;
}

function MultiSelect({ label, options, selectedIds, onChange, placeholder, icon }: MultiSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleId = (id: number) => {
        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter(x => x !== id));
        } else {
            onChange([...selectedIds, id]);
        }
    };

    const selectedLabels = options
        .filter(opt => selectedIds.includes(opt.id))
        .map(opt => opt.label);

    return (
        <div className="space-y-2 relative" ref={containerRef}>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">{label}</label>
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full min-h-14 px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border ${isOpen ? 'border-primary ring-2 ring-primary/10' : 'border-zinc-200 dark:border-zinc-800'} rounded-2xl transition-all cursor-pointer flex items-center justify-between gap-3 group`}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="text-zinc-400 group-hover:text-primary transition-colors">
                        {icon}
                    </div>
                    <div className="flex flex-wrap gap-1 items-center">
                        {selectedIds.length === 0 ? (
                            <span className="text-zinc-400 font-bold text-sm italic">{placeholder}</span>
                        ) : (
                            <span className="text-zinc-900 dark:text-zinc-100 font-black text-sm">
                                {selectedIds.length === options.length ? 'All Selected' : `${selectedIds.length} Selected`}
                            </span>
                        )}
                    </div>
                </div>
                {isOpen ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
            </div>

            {isOpen && (
                <div className="absolute z-[100] top-full mt-2 w-full max-h-60 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-3 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                        <button 
                            onClick={() => onChange(options.map(o => o.id))}
                            className="text-[10px] font-black text-primary hover:underline"
                        >
                            SELECT ALL
                        </button>
                        <button 
                            onClick={() => onChange([])}
                            className="text-[10px] font-black text-rose-500 hover:underline"
                        >
                            CLEAR
                        </button>
                    </div>
                    <div className="overflow-y-auto">
                        {options.map(opt => (
                            <div 
                                key={opt.id}
                                onClick={() => toggleId(opt.id)}
                                className="px-4 py-3 hover:bg-primary/[0.03] flex items-center gap-3 cursor-pointer group transition-colors"
                            >
                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${selectedIds.includes(opt.id) ? 'bg-primary border-primary' : 'border-zinc-200 dark:border-zinc-700 group-hover:border-primary/30'}`}>
                                    {selectedIds.includes(opt.id) && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                                </div>
                                <span className={`text-sm font-bold ${selectedIds.includes(opt.id) ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300'}`}>
                                    {opt.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BatchIssuePage() {
    const dispatch = useDispatch<AppDispatch>();
    const router = useRouter();

    const { items: classes } = useSelector((state: RootState) => state.classes);
    const { items: campuses } = useSelector((state: RootState) => state.campuses);
    const { items: sections } = useSelector((state: RootState) => state.sections);

    // ── Form State ────────────────────────────────────────────────────────────
    const [campusIds, setCampusIds] = useState<number[]>([]);
    const [classIds, setClassIds] = useState<number[]>([]);
    const [sectionIds, setSectionIds] = useState<number[]>([]);
    const [studentIdsRaw, setStudentIdsRaw] = useState("");
    const [feeDateFrom, setFeeDateFrom] = useState("");
    const [feeDateTo, setFeeDateTo] = useState("");
    const [bankAccountId, setBankAccountId] = useState("");
    const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState("");
    const [validityDate, setValidityDate] = useState("");
    const [applyLateFee, setApplyLateFee] = useState(true);
    const [lateFeeAmount, setLateFeeAmount] = useState(1000);
    const [waiveSurcharge, setWaiveSurcharge] = useState(false);
    const [skipAlreadyIssued, setSkipAlreadyIssued] = useState(true);

    // ── UI State ──────────────────────────────────────────────────────────────
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewStudents, setPreviewStudents] = useState<BulkStudentPreview[] | null>(null);
    const [selectedCcs, setSelectedCcs] = useState<Set<number>>(new Set());
    const [isGenerating, setIsGenerating] = useState(false);
    const [lastJobId, setLastJobId] = useState<number | null>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [activeJobStatus, setActiveJobStatus] = useState<any>(null);
    const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        return () => {
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        };
    }, []);

    const startPolling = useCallback((jobId: number) => {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        
        pollingIntervalRef.current = setInterval(async () => {
            try {
                const { data } = await api.get(`/v1/bulk-voucher-jobs/${jobId}/status`);
                const status = data.data || data;
                setActiveJobStatus(status);
                
                if (['DONE', 'FAILED', 'PARTIAL_FAILURE'].includes(status.status)) {
                    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                }
            } catch (error) {
                console.error("Polling error", error);
            }
        }, 1500);
    }, []);

    // ── Student ID resolution state ─────────────────────────────────────────────
    const [resolvedIds, setResolvedIds] = useState<
        Map<number, ResolvedStudent | "not_found" | "loading">
    >(new Map());
    const [isResolvingIds, setIsResolvingIds] = useState(false);
    const resolveAbortRef = useRef<AbortController | null>(null);
    const resolveDebouncerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Data Loading ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!classes.length) dispatch(fetchClasses());
        if (!campuses.length) dispatch(fetchCampuses());
        if (!sections.length) dispatch(fetchSections());
        
        // Load bank accounts
        api.get('/v1/bank-accounts').then(res => {
            setBankAccounts(res.data?.data || []);
        });
    }, [dispatch]);

    // ── Parsed CCs ─────────────────────────────────────────────────────────────
    const parsedStudentCcs = useMemo(() => {
        return studentIdsRaw
            .split(/[\s,]+/)
            .map((x) => x.trim())
            .filter(Boolean)
            .map((x) => Number(x))
            .filter((n) => Number.isInteger(n) && n > 0);
    }, [studentIdsRaw]);

    // ── Live student ID resolution ───────────────────────
    useEffect(() => {
        if (resolveDebouncerRef.current) clearTimeout(resolveDebouncerRef.current);
        if (parsedStudentCcs.length === 0) {
            setResolvedIds(new Map());
            setIsResolvingIds(false);
            return;
        }

        setIsResolvingIds(true);
        const loadingMap = new Map<number, "loading">(parsedStudentCcs.map((id) => [id, "loading"]));
        setResolvedIds(loadingMap as Map<number, ResolvedStudent | "not_found" | "loading">);

        resolveDebouncerRef.current = setTimeout(async () => {
            if (resolveAbortRef.current) resolveAbortRef.current.abort();
            const ctrl = new AbortController();
            resolveAbortRef.current = ctrl;

            const results = await Promise.allSettled(
                parsedStudentCcs.map((id) =>
                    api.get<{ data: { cc: number; full_name: string; gr_number?: string | null }[] }>(
                        `/v1/students/search-simple`,
                        { params: { q: String(id) }, signal: ctrl.signal }
                    ).then((res) => {
                        const match = res.data?.data?.find?.((s: { cc: number }) => s.cc === id);
                        return { id, student: match ?? null };
                    }).catch(() => ({ id, student: null }))
                )
            );

            if (ctrl.signal.aborted) return;

            const newMap = new Map<number, ResolvedStudent | "not_found" | "loading">();
            for (const res of results) {
                if (res.status === "fulfilled") {
                    const { id, student } = res.value;
                    newMap.set(id, student ? { cc: student.cc, full_name: student.full_name, gr_number: student.gr_number } : "not_found");
                }
            }
            setResolvedIds(newMap);
            setIsResolvingIds(false);
        }, 600);

        return () => {
            if (resolveDebouncerRef.current) clearTimeout(resolveDebouncerRef.current);
        };
    }, [studentIdsRaw]);

    // ── Handlers ────────────────────────────────────────────────────────────────

    const handlePreview = async () => {
        if (campusIds.length === 0 && parsedStudentCcs.length === 0) return toast.error("Please select at least one campus or enter specific CCs");
        if (!feeDateFrom || !feeDateTo) return toast.error("Please select fee date range");

        setPreviewLoading(true);
        try {
            const { data } = await api.post('/v1/bulk-voucher-jobs/preview', {
                campus_ids: campusIds.length > 0 ? campusIds : undefined,
                class_ids: classIds.length > 0 ? classIds : undefined,
                section_ids: sectionIds.length > 0 ? sectionIds : undefined,
                student_ccs: parsedStudentCcs.length > 0 ? parsedStudentCcs : undefined,
                fee_date_from: feeDateFrom,
                fee_date_to: feeDateTo,
                skip_already_issued: skipAlreadyIssued
            });

            const students: BulkStudentPreview[] = data.data || data;
            setPreviewStudents(students);
            
            // Auto-select students who aren't already issued
            const initialSelected = new Set<number>();
            students.forEach(s => {
                if (!s.is_already_issued) initialSelected.add(s.cc);
            });
            setSelectedCcs(initialSelected);
            
            toast.success(`Found ${students.length} students matching criteria`);
        } catch (error) {
            toast.error("Failed to load preview");
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleGenerateBatch = async () => {
        if (!bankAccountId || !issueDate || !dueDate) {
            return toast.error("Missing required configuration fields");
        }
        if (selectedCcs.size === 0) {
            return toast.error("No students selected for voucher generation");
        }

        if (!window.confirm(`Generate vouchers for ${selectedCcs.size} students?`)) return;

        setIsGenerating(true);
        try {
            const { data } = await api.post('/v1/bulk-voucher-jobs', {
                campus_ids: campusIds,
                class_ids: classIds,
                section_ids: sectionIds,
                fee_date_from: feeDateFrom,
                fee_date_to: feeDateTo,
                issue_date: issueDate,
                due_date: dueDate,
                validity_date: validityDate || undefined,
                bank_account_id: Number(bankAccountId),
                skip_already_issued: true,
                apply_late_fee: applyLateFee,
                late_fee_amount: lateFeeAmount,
                waive_surcharge: waiveSurcharge,
                student_ccs: Array.from(selectedCcs)
            });

            const jobId = data.data?.job_id || data.job_id;
            setLastJobId(jobId);
            setShowSuccessModal(true);
            startPolling(jobId);
            toast.success("Bulk job started successfully!");
        } catch (error) {
            toast.error("Failed to start bulk job");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleExportCsv = () => {
        if (!previewStudents) return;
        
        const headers = ["CC", "Name", "GR#", "Class", "Section", "Status"];
        const rows = previewStudents.map(s => [
            s.cc,
            s.student_full_name,
            s.gr_number || "N/A",
            s.class_name,
            s.section_name,
            s.is_already_issued ? "Already Issued" : "Will Generate"
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `voucher_preview_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const toggleSelectAll = () => {
        if (!previewStudents) return;
        if (selectedCcs.size === previewStudents.length) {
            setSelectedCcs(new Set());
        } else {
            setSelectedCcs(new Set(previewStudents.map(s => s.cc)));
        }
    };

    const toggleCc = (cc: number) => {
        const next = new Set(selectedCcs);
        if (next.has(cc)) next.delete(cc);
        else next.add(cc);
        setSelectedCcs(next);
    };

    // ─── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="max-w-[1600px] mx-auto p-6 space-y-8">
            {/* Header */}
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                    <Sparkles className="h-8 w-8 text-amber-500" />
                    Batch Voucher Issuance
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    A smarter front-door for bulk fee generation. Select students, preview, and generate vouchers in one flow.
                </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                {/* ── Left: Configuration Panel ── */}
                <div className="xl:col-span-8 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm space-y-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <FileText className="h-32 w-32" />
                    </div>

                    <div className="flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-6 mb-2">
                        <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-primary" />
                        </div>
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Configuration</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Campus */}
                        <MultiSelect 
                            label="Campuses"
                            placeholder="All Campuses"
                            options={campuses.map(c => ({ id: c.id, label: c.campus_name }))}
                            selectedIds={campusIds}
                            onChange={setCampusIds}
                            icon={<Building2 className="h-5 w-5" />}
                        />

                        {/* Class */}
                        <MultiSelect 
                            label="Classes"
                            placeholder="All Classes"
                            options={classes.map(c => ({ id: c.id, label: c.description }))}
                            selectedIds={classIds}
                            onChange={setClassIds}
                            icon={<Users className="h-5 w-5" />}
                        />

                        {/* Section */}
                        <MultiSelect 
                            label="Sections"
                            placeholder="All Sections"
                            options={sections.map(s => ({ id: s.id, label: s.description }))}
                            selectedIds={sectionIds}
                            onChange={setSectionIds}
                            icon={<Search className="h-5 w-5" />}
                        />
                    </div>

                    {/* Specific CCs */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">
                            Specific CC Numbers <span className="font-medium lowercase">(comma or space separated)</span>
                        </label>
                        <div className="relative group">
                            <textarea
                                value={studentIdsRaw}
                                onChange={e => setStudentIdsRaw(e.target.value)}
                                placeholder="Enter CC numbers..."
                                className="w-full min-h-[100px] p-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono text-sm leading-relaxed"
                            />
                            <div className="absolute right-4 bottom-4 pointer-events-none group-focus-within:opacity-0 transition-opacity">
                                <Search className="h-5 w-5 text-zinc-300" />
                            </div>
                        </div>

                        {/* Resolved CC chips */}
                        {parsedStudentCcs.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-2">
                                {parsedStudentCcs.map(cc => {
                                    const student = resolvedIds.get(cc);
                                    if (student === 'loading') return (
                                        <div key={cc} className="px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center gap-2 animate-pulse">
                                            <div className="w-2 h-2 rounded-full bg-zinc-400" />
                                            <span className="text-[10px] font-black font-mono">{cc}</span>
                                        </div>
                                    );
                                    if (student === 'not_found') return (
                                        <div key={cc} className="px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 flex items-center gap-2">
                                            <Ban className="h-3 w-3 text-rose-500" />
                                            <span className="text-[10px] font-black font-mono text-rose-600">{cc}</span>
                                        </div>
                                    );
                                    return (
                                        <div key={cc} className="px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-2">
                                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                            <span className="text-[10px] font-black font-mono text-emerald-600">{cc}</span>
                                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">{student?.full_name}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Date Range Section */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                <Clock3 className="h-4 w-4" /> Date Range
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Fee Date From</label>
                                    <input 
                                        type="date"
                                        value={feeDateFrom}
                                        onChange={e => setFeeDateFrom(e.target.value)}
                                        className="w-full h-14 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Fee Date To</label>
                                    <input 
                                        type="date"
                                        value={feeDateTo}
                                        onChange={e => setFeeDateTo(e.target.value)}
                                        className="w-full h-14 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Payment Configuration */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                                <Building2 className="h-4 w-4" /> Bank & Issues
                            </h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Bank Account</label>
                                    <select 
                                        value={bankAccountId}
                                        onChange={e => setBankAccountId(e.target.value)}
                                        className="w-full h-14 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-sm"
                                    >
                                        <option value="">Select Account</option>
                                        {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.bank_name} ({b.account_number})</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Issue Date</label>
                                        <input 
                                            type="date"
                                            value={issueDate}
                                            onChange={e => setIssueDate(e.target.value)}
                                            className="w-full h-14 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-sm"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Due Date</label>
                                        <input 
                                            type="date"
                                            value={dueDate}
                                            onChange={e => setDueDate(e.target.value)}
                                            className="w-full h-14 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Toggles Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-[2rem] border border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setApplyLateFee(!applyLateFee)}
                                className={`w-12 h-6 rounded-full transition-all relative ${applyLateFee ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                            >
                                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all ${applyLateFee ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                            <span className="text-xs font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400">Late Fee</span>
                            {applyLateFee && (
                                <input 
                                    type="number"
                                    value={lateFeeAmount}
                                    onChange={e => setLateFeeAmount(Number(e.target.value))}
                                    className="w-16 bg-transparent border-b border-zinc-300 dark:border-zinc-700 text-xs font-black text-primary outline-none"
                                />
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setWaiveSurcharge(!waiveSurcharge)}
                                className={`w-12 h-6 rounded-full transition-all relative ${waiveSurcharge ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                            >
                                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all ${waiveSurcharge ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                            <span className="text-xs font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400">Waive Surcharge</span>
                        </div>

                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setSkipAlreadyIssued(!skipAlreadyIssued)}
                                className={`w-12 h-6 rounded-full transition-all relative ${skipAlreadyIssued ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                            >
                                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all ${skipAlreadyIssued ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                            <span className="text-xs font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400">Skip Already Issued</span>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button 
                            onClick={handlePreview}
                            disabled={previewLoading}
                            className="h-16 px-10 bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white rounded-3xl font-black text-base shadow-xl hover:translate-y-[-2px] transition-all flex items-center gap-3 disabled:opacity-50"
                        >
                            {previewLoading ? <RefreshCw className="h-6 w-6 animate-spin" /> : <Users className="h-6 w-6" />}
                            PREVIEW STUDENTS →
                        </button>
                    </div>
                </div>

                {/* ── Right: Preview Table ── */}
                <div className="xl:col-span-4 flex flex-col gap-6">
                    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col h-[700px]">
                        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Preview List</h2>
                            {previewStudents && (
                                <span className="text-[10px] font-black px-3 py-1 bg-zinc-100 dark:bg-zinc-900 rounded-full text-zinc-500">
                                    {selectedCcs.size} / {previewStudents.length} SELECTED
                                </span>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {!previewStudents ? (
                                <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-4">
                                    <div className="h-20 w-20 rounded-full bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
                                        <Users className="h-10 w-10 text-zinc-200" />
                                    </div>
                                    <p className="text-sm font-bold text-zinc-400 leading-relaxed italic">
                                        Configure filters on the left and click preview to see student list.
                                    </p>
                                </div>
                            ) : (
                                <div className="p-4 space-y-3">
                                    {/* Disclaimer */}
                                    <div className="mx-2 mb-4 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl flex items-start gap-3">
                                        <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-400">Disclaimer</p>
                                            <p className="text-xs font-bold text-amber-700/80 dark:text-amber-500/80 leading-relaxed">
                                                This list strictly excludes students who have already been issued a voucher for the selected period.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Select All Toggle */}
                                    <button 
                                        onClick={toggleSelectAll}
                                        className="w-full p-4 rounded-2xl border-2 border-dashed border-zinc-100 dark:border-zinc-800 hover:border-primary/20 transition-all flex items-center justify-center gap-3 group"
                                    >
                                        <div className={`w-5 h-5 rounded-md border-2 transition-all ${selectedCcs.size === previewStudents.length ? 'bg-primary border-primary' : 'border-zinc-200 group-hover:border-primary/30'}`}>
                                            {selectedCcs.size === previewStudents.length && <CheckCircle2 className="h-full w-full text-white p-0.5" />}
                                        </div>
                                        <span className="text-xs font-black uppercase tracking-widest text-zinc-500">Select All Students</span>
                                    </button>

                                    {previewStudents.map(student => (
                                        <button
                                            key={student.cc}
                                            disabled={student.is_already_issued}
                                            onClick={() => toggleCc(student.cc)}
                                            className={`w-full p-5 rounded-3xl border-2 transition-all text-left relative group ${student.is_already_issued ? 'opacity-50 grayscale cursor-not-allowed border-zinc-100' : selectedCcs.has(student.cc)
                                                ? 'border-primary bg-primary/[0.02]'
                                                : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-200'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-black font-mono text-zinc-400">#{student.cc}</span>
                                                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${student.is_already_issued ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                            {student.is_already_issued ? 'Already Issued' : 'Ready'}
                                                        </span>
                                                    </div>
                                                    <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100 truncate">{student.student_full_name}</h3>
                                                    <div className="flex items-center gap-2 mt-2 opacity-50">
                                                        <span className="text-[10px] font-bold uppercase">{student.class_name}</span>
                                                        <span className="w-1 h-1 rounded-full bg-zinc-300" />
                                                        <span className="text-[10px] font-bold uppercase">{student.section_name}</span>
                                                    </div>
                                                </div>
                                                <div className={`w-6 h-6 rounded-lg border-2 mt-1 flex items-center justify-center transition-all ${student.is_already_issued ? 'bg-zinc-100 border-zinc-200' : selectedCcs.has(student.cc) ? 'bg-primary border-primary shadow-lg shadow-primary/20' : 'border-zinc-200 group-hover:border-primary/30'}`}>
                                                    {selectedCcs.has(student.cc) && <CheckCircle2 className="h-4 w-4 text-white" />}
                                                    {student.is_already_issued && <Ban className="h-3 w-3 text-zinc-400" />}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Summary Bar */}
                        <div className="p-8 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Selected</div>
                                    <div className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{selectedCcs.size} <span className="text-sm text-zinc-400">Students</span></div>
                                </div>
                                {previewStudents && (
                                    <button 
                                        onClick={handleExportCsv}
                                        className="h-12 w-12 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center hover:shadow-lg transition-all"
                                        title="Export CSV"
                                    >
                                        <Download className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                                    </button>
                                )}
                            </div>

                            <button
                                onClick={handleGenerateBatch}
                                disabled={isGenerating || selectedCcs.size === 0}
                                className="w-full h-16 bg-primary text-white rounded-3xl font-black text-base shadow-xl shadow-primary/20 hover:translate-y-[-2px] active:translate-y-[0px] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                {isGenerating ? <RefreshCw className="h-6 w-6 animate-spin" /> : <Banknote className="h-6 w-6" />}
                                GENERATE BATCH →
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            {/* Success/Progress Modal Overlay */}
            {showSuccessModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-zinc-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[3rem] p-10 max-w-lg w-full shadow-2xl space-y-8 animate-in zoom-in-95 duration-300">
                        <div className="flex flex-col items-center text-center space-y-4">
                            {!activeJobStatus || activeJobStatus.status === 'PENDING' || activeJobStatus.status === 'PROCESSING' ? (
                                <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                                    <RefreshCw className="h-12 w-12 text-primary animate-spin" />
                                </div>
                            ) : activeJobStatus.status === 'DONE' ? (
                                <div className="h-24 w-24 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-2">
                                    <CheckCircle2 className="h-12 w-12 text-emerald-500 animate-bounce" />
                                </div>
                            ) : (
                                <div className="h-24 w-24 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center mb-2">
                                    <AlertCircle className="h-12 w-12 text-rose-500" />
                                </div>
                            )}
                            
                            <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                                {activeJobStatus?.status === 'DONE' ? 'Generation Complete!' : 
                                 activeJobStatus?.status === 'FAILED' ? 'Generation Failed' : 
                                 'Processing Vouchers...'}
                            </h2>
                            
                            <p className="text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
                                {activeJobStatus?.status === 'DONE' 
                                    ? `Successfully generated ${activeJobStatus.success_count} vouchers. ${activeJobStatus.skip_count} were skipped.`
                                    : `Voucher generation job #${lastJobId} is currently in progress. Please stay on this page.`}
                            </p>
                        </div>

                        {/* Progress Stats */}
                        {activeJobStatus && (
                            <div className="grid grid-cols-3 gap-4 p-6 bg-zinc-50 dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800">
                                <div className="text-center space-y-1">
                                    <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Success</div>
                                    <div className="text-xl font-black text-emerald-600">{activeJobStatus.success_count}</div>
                                </div>
                                <div className="text-center space-y-1">
                                    <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Skipped</div>
                                    <div className="text-xl font-black text-amber-600">{activeJobStatus.skip_count}</div>
                                </div>
                                <div className="text-center space-y-1 border-l border-zinc-200 dark:border-zinc-800">
                                    <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Failed</div>
                                    <div className="text-xl font-black text-rose-600">{activeJobStatus.fail_count}</div>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-3">
                            {activeJobStatus?.merged_pdf_url && (
                                <a 
                                    href={activeJobStatus.merged_pdf_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="h-16 w-full bg-emerald-600 text-white rounded-3xl font-black text-base shadow-xl flex items-center justify-center gap-3 hover:translate-y-[-2px] transition-all"
                                >
                                    <Download className="h-5 w-5" />
                                    DOWNLOAD ALL VOUCHERS →
                                </a>
                            )}
                            
                            {activeJobStatus?.status === 'DONE' || activeJobStatus?.status === 'FAILED' || activeJobStatus?.status === 'PARTIAL_FAILURE' ? (
                                <button 
                                    onClick={() => {
                                        setShowSuccessModal(false);
                                        setActiveJobStatus(null);
                                        setPreviewStudents(null);
                                    }}
                                    className="h-16 w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-3xl font-black text-base shadow-xl flex items-center justify-center gap-3 hover:translate-y-[-2px] transition-all"
                                >
                                    DONE & CLOSE
                                </button>
                            ) : (
                                <button 
                                    disabled
                                    className="h-16 w-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 rounded-3xl font-black text-base flex items-center justify-center gap-3 cursor-not-allowed"
                                >
                                    <RefreshCw className="h-5 w-5 animate-spin" />
                                    PLEASE WAIT...
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
