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
    X,
    Check,
    FileSpreadsheet,
    CreditCard
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/src/lib/api";
import { AppDispatch, RootState } from "@/src/store/store";
import { fetchClasses } from "@/src/store/slices/classesSlice";
import { fetchCampuses } from "@/src/store/slices/campusesSlice";
import { fetchSections } from "@/src/store/slices/sectionsSlice";
import { fetchBanks } from "@/src/store/slices/banksSlice";
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

interface ResolvedStudent {
    cc: number;
    full_name: string;
    gr_number?: string | null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BatchIssuePage() {
    const router = useRouter();
    const dispatch = useDispatch<AppDispatch>();

    // Redux State
    const { items: campuses } = useSelector((state: RootState) => state.campuses);
    const { items: classes } = useSelector((state: RootState) => state.classes);
    const { items: sections } = useSelector((state: RootState) => state.sections);
    const { items: banks } = useSelector((state: RootState) => state.banks);

    // ── Configuration State ────────────────────────────────────────────────────
    const [campusId, setCampusId] = useState("");
    const [classId, setClassId] = useState("");
    const [sectionId, setSectionId] = useState("");
    const [studentIdsRaw, setStudentIdsRaw] = useState("");
    
    const [feeDateFrom, setFeeDateFrom] = useState(new Date().toISOString().split('T')[0]);
    const [feeDateTo, setFeeDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [bankAccountId, setBankAccountId] = useState("");
    const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState("");
    const [validityDate, setValidityDate] = useState("");
    
    const [applyLateFee, setApplyLateFee] = useState(true);
    const [lateFeeAmount, setLateFeeAmount] = useState(1000);
    const [waiveSurcharge, setWaiveSurcharge] = useState(false);
    const [skipAlreadyIssued, setSkipAlreadyIssued] = useState(true);

    // ── Student ID Resolution ──────────────────────────────────────────────────
    const [resolvedIds, setResolvedIds] = useState<Map<number, ResolvedStudent | "not_found" | "loading">>(new Map());
    const [isResolvingIds, setIsResolvingIds] = useState(false);
    const resolveAbortRef = useRef<AbortController | null>(null);
    const resolveDebouncerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Preview State ──────────────────────────────────────────────────────────
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewStudents, setPreviewStudents] = useState<BulkStudentPreview[] | null>(null);
    const [selectedCcs, setSelectedCcs] = useState<Set<number>>(new Set());
    const [isGenerating, setIsGenerating] = useState(false);

    // ── Data Loading ────────────────────────────────────────────────────────────
    useEffect(() => {
        dispatch(fetchCampuses());
        dispatch(fetchClasses());
        dispatch(fetchSections());
        dispatch(fetchBanks());
    }, [dispatch]);

    // ── CC Resolution Logic ─────────────────────────────────────────────────────
    const parsedStudentCcs = useMemo(() => {
        return studentIdsRaw
            .split(/[\s,]+/)
            .map((x) => x.trim())
            .filter(Boolean)
            .map((x) => Number(x))
            .filter((n) => Number.isInteger(n) && n > 0);
    }, [studentIdsRaw]);

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
    }, [studentIdsRaw, parsedStudentCcs]);

    // ── Handlers ────────────────────────────────────────────────────────────────

    const handlePreview = async () => {
        if (!campusId) return toast.error("Campus is required");

        setPreviewLoading(true);
        try {
            const { data } = await api.post('/v1/bulk-voucher-jobs/preview', {
                campus_id: Number(campusId),
                class_id: classId ? Number(classId) : undefined,
                section_id: sectionId ? Number(sectionId) : undefined,
                student_ccs: parsedStudentCcs.length > 0 ? parsedStudentCcs : undefined,
                fee_date_from: feeDateFrom,
                fee_date_to: feeDateTo,
                skip_already_issued: skipAlreadyIssued
            });

            const students: BulkStudentPreview[] = data.data || data;
            setPreviewStudents(students);
            
            // Auto-selection logic based on skipAlreadyIssued
            const initialSelected = new Set<number>();
            students.forEach(s => {
                if (skipAlreadyIssued) {
                    if (!s.is_already_issued) initialSelected.add(s.cc);
                } else {
                    initialSelected.add(s.cc);
                }
            });
            setSelectedCcs(initialSelected);
            
            toast.success(`Loaded ${students.length} students`);
        } catch (error) {
            toast.error("Failed to load preview");
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleGenerateBatch = async () => {
        if (!campusId || !bankAccountId || !issueDate || !dueDate) {
            return toast.error("Please fill all required configuration fields");
        }
        if (selectedCcs.size === 0) {
            return toast.error("No students selected for generation");
        }

        if (!window.confirm(`Generate vouchers for ${selectedCcs.size} students? This will start a background job.`)) return;

        setIsGenerating(true);
        try {
            const { data } = await api.post('/v1/bulk-voucher-jobs', {
                campus_id: Number(campusId),
                class_id: classId ? Number(classId) : undefined,
                section_id: sectionId ? Number(sectionId) : undefined,
                fee_date_from: feeDateFrom,
                fee_date_to: feeDateTo,
                issue_date: issueDate,
                due_date: dueDate,
                validity_date: validityDate || undefined,
                bank_account_id: Number(bankAccountId),
                skip_already_issued: skipAlreadyIssued,
                apply_late_fee: applyLateFee,
                late_fee_amount: lateFeeAmount,
                waive_surcharge: waiveSurcharge,
                student_ccs: Array.from(selectedCcs)
            });

            const jobId = data.data?.job_id || data.job_id;
            toast.success("Batch job started! Redirecting...");
            router.push(`/bulk-voucher?highlight=${jobId}`);
        } catch (error) {
            toast.error("Failed to start bulk job");
            setIsGenerating(false);
        }
    };

    const handleExportCsv = () => {
        if (!previewStudents) return;
        const headers = ["CC", "Name", "GR#", "Class", "Section", "Status"];
        const rows = previewStudents.map(s => [
            s.cc,
            s.student_full_name,
            s.gr_number || "",
            s.class_name,
            s.section_name,
            s.is_already_issued ? "Already Issued" : "Will Generate"
        ]);

        const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `voucher_preview_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const toggleAll = () => {
        if (!previewStudents) return;
        if (selectedCcs.size === previewStudents.length) {
            setSelectedCcs(new Set());
        } else {
            setSelectedCcs(new Set(previewStudents.map(s => s.cc)));
        }
    };

    const toggleStudent = (cc: number) => {
        const next = new Set(selectedCcs);
        if (next.has(cc)) next.delete(cc);
        else next.add(cc);
        setSelectedCcs(next);
    };

    // ── Render ──────────────────────────────────────────────────────────────────

    return (
        <div className="max-w-[1400px] mx-auto p-6 space-y-8 pb-32">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Sparkles className="h-6 w-6 text-amber-500" />
                        Batch Voucher Issue
                    </h1>
                    <p className="text-sm text-zinc-500 font-medium tracking-tight">Generate vouchers with custom rules and student lists.</p>
                </div>
            </div>

            {/* C2.1 — Layout: Config Card (top) */}
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-8 shadow-sm space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Primary Filters */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1 flex items-center gap-1.5">
                                    <Building2 className="h-3 w-3" /> Campus <span className="text-rose-500">*</span>
                                </label>
                                <select 
                                    className="w-full h-12 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-sm outline-none"
                                    value={campusId}
                                    onChange={e => setCampusId(e.target.value)}
                                >
                                    <option value="">Select Campus</option>
                                    {campuses.map(c => <option key={c.id} value={c.id}>{c.campus_name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Class</label>
                                <select 
                                    className="w-full h-12 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-sm outline-none"
                                    value={classId}
                                    onChange={e => setClassId(e.target.value)}
                                >
                                    <option value="">All Classes</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.description}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Section</label>
                                <select 
                                    className="w-full h-12 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-sm outline-none"
                                    value={sectionId}
                                    onChange={e => setSectionId(e.target.value)}
                                >
                                    <option value="">All Sections</option>
                                    {sections.filter(s => !classId || s.class_id === Number(classId)).map(s => <option key={s.id} value={s.id}>{s.description}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Specific CCs Textarea */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Specific CC Numbers (Optional)</label>
                            <textarea 
                                className="w-full min-h-[100px] p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl font-mono text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                                placeholder="Comma or space separated (e.g. 1001, 1002, 1005)"
                                value={studentIdsRaw}
                                onChange={e => setStudentIdsRaw(e.target.value)}
                            />
                            {/* CC Chips UX */}
                            {parsedStudentCcs.length > 0 && (
                                <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1">
                                    {parsedStudentCcs.map(cc => {
                                        const res = resolvedIds.get(cc);
                                        return (
                                            <div key={cc} className={`px-3 py-1.5 rounded-full border text-[10px] font-black flex items-center gap-2 ${res === 'loading' ? 'bg-zinc-50 border-zinc-200 text-zinc-400 animate-pulse' : res === 'not_found' ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
                                                <span>CC {cc}</span>
                                                {typeof res === 'object' && <span className="opacity-70 truncate max-w-[100px]">{res.full_name}</span>}
                                                {res === 'not_found' && <span className="opacity-70">Not Found</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Job Settings */}
                    <div className="lg:col-span-4 space-y-6 lg:border-l border-zinc-100 dark:border-zinc-900 lg:pl-8">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Fee From</label>
                                <input type="date" className="w-full h-12 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-[12px] outline-none" value={feeDateFrom} onChange={e => setFeeDateFrom(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Fee To</label>
                                <input type="date" className="w-full h-12 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-[12px] outline-none" value={feeDateTo} onChange={e => setFeeDateTo(e.target.value)} />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1 flex items-center gap-1.5">
                                <CreditCard className="h-3 w-3" /> Bank Account <span className="text-rose-500">*</span>
                            </label>
                            <select 
                                className="w-full h-12 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-sm outline-none"
                                value={bankAccountId}
                                onChange={e => setBankAccountId(e.target.value)}
                            >
                                <option value="">Select Account</option>
                                {banks.map(b => <option key={b.id} value={b.id}>{b.bank_name} ({b.account_number})</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Issue Date</label>
                                <input type="date" className="w-full h-12 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-[12px] outline-none" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Due Date</label>
                                <input type="date" className="w-full h-12 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-[12px] outline-none" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Toggles */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-6 border-t border-zinc-100 dark:border-zinc-900">
                    <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/40 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                        <div className="space-y-0.5">
                            <p className="text-[11px] font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">Late Fee</p>
                            <p className="text-[9px] font-bold text-zinc-400 uppercase">Policy Rules</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {applyLateFee && <input type="number" className="w-16 h-8 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-center text-[11px] font-black text-primary outline-none" value={lateFeeAmount} onChange={e => setLateFeeAmount(Number(e.target.value))} />}
                            <button onClick={() => setApplyLateFee(!applyLateFee)} className={`h-5 w-10 rounded-full relative transition-all ${applyLateFee ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                                <div className={`h-3 w-3 bg-white rounded-full absolute top-1 transition-all ${applyLateFee ? 'left-6' : 'left-1'}`} />
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/40 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                        <div className="space-y-0.5">
                            <p className="text-[11px] font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">Surcharge</p>
                            <p className="text-[9px] font-bold text-zinc-400 uppercase">Waive Arrears</p>
                        </div>
                        <button onClick={() => setWaiveSurcharge(!waiveSurcharge)} className={`h-5 w-10 rounded-full relative transition-all ${waiveSurcharge ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                            <div className={`h-3 w-3 bg-white rounded-full absolute top-1 transition-all ${waiveSurcharge ? 'left-6' : 'left-1'}`} />
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/40 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                        <div className="space-y-0.5">
                            <p className="text-[11px] font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">Deduplicate</p>
                            <p className="text-[9px] font-bold text-zinc-400 uppercase">Skip Issued</p>
                        </div>
                        <button onClick={() => setSkipAlreadyIssued(!skipAlreadyIssued)} className={`h-5 w-10 rounded-full relative transition-all ${skipAlreadyIssued ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                            <div className={`h-3 w-3 bg-white rounded-full absolute top-1 transition-all ${skipAlreadyIssued ? 'left-6' : 'left-1'}`} />
                        </button>
                    </div>

                    <button 
                        onClick={handlePreview}
                        disabled={previewLoading || !campusId}
                        className="h-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black text-xs shadow-lg flex items-center justify-center gap-3 hover:bg-zinc-800 active:scale-95 transition-all disabled:opacity-50 min-h-[56px]"
                    >
                        {previewLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                        PREVIEW STUDENTS →
                    </button>
                </div>
            </div>

            {/* C2.2 — Preview Table (below) */}
            {previewStudents && (
                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4">
                    <div className="px-8 py-6 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                                <FileText className="h-4 w-4" />
                            </div>
                            <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100">Generation Preview</h2>
                        </div>
                        <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{previewStudents.length} Students Matching</div>
                    </div>

                    <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-zinc-50 dark:bg-zinc-900/50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-8 py-4 w-20">
                                        <button onClick={toggleAll} className={`h-4 w-4 rounded border flex items-center justify-center transition-all ${selectedCcs.size === previewStudents.length ? 'bg-primary border-primary text-white' : 'border-zinc-300 bg-white dark:bg-zinc-800'}`}>
                                            {selectedCcs.size === previewStudents.length && <Check className="h-2.5 w-2.5 stroke-[4]" />}
                                        </button>
                                    </th>
                                    <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">CC</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Name</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">GR#</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Class</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Section</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                                {previewStudents.map(s => (
                                    <tr key={s.cc} className={`group transition-colors ${selectedCcs.has(s.cc) ? 'bg-primary/[0.03]' : 'hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50'}`}>
                                        <td className="px-8 py-4">
                                            <button onClick={() => toggleStudent(s.cc)} className={`h-4 w-4 rounded border flex items-center justify-center transition-all ${selectedCcs.has(s.cc) ? 'bg-primary border-primary text-white' : 'border-zinc-300 bg-white dark:bg-zinc-800'}`}>
                                                {selectedCcs.has(s.cc) && <Check className="h-2.5 w-2.5 stroke-[4]" />}
                                            </button>
                                        </td>
                                        <td className="px-8 py-4 font-black text-zinc-900 dark:text-zinc-100 text-sm">CC{s.cc}</td>
                                        <td className="px-8 py-4 text-[13px] font-bold text-zinc-800 dark:text-zinc-200">{s.student_full_name}</td>
                                        <td className="px-8 py-4 text-xs font-mono text-zinc-500">{s.gr_number || "—"}</td>
                                        <td className="px-8 py-4 text-[10px] font-black text-zinc-600 uppercase tracking-tight">{s.class_name}</td>
                                        <td className="px-8 py-4 text-[10px] font-black text-zinc-600 uppercase tracking-tight">{s.section_name}</td>
                                        <td className="px-8 py-4 text-right">
                                            {s.is_already_issued ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 border border-amber-100 dark:border-amber-900/30 rounded-full text-[9px] font-black uppercase">
                                                    <AlertCircle className="h-3 w-3" /> Already Issued
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border border-emerald-100 dark:border-emerald-900/30 rounded-full text-[9px] font-black uppercase">
                                                    <CheckCircle2 className="h-3 w-3" /> Will Generate
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* C2.3 — Summary Bar (Fixed Bottom) */}
            {previewStudents && (
                <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-200 dark:border-zinc-800 z-40 animate-in slide-in-from-bottom-full">
                    <div className="max-w-[1400px] mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-10">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Total</span>
                                <span className="text-xl font-black text-zinc-900 dark:text-zinc-100">{previewStudents.length}</span>
                            </div>
                            <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-800" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Will Generate</span>
                                <span className="text-xl font-black text-emerald-600">{selectedCcs.size}</span>
                            </div>
                            <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-800" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Skipping</span>
                                <span className="text-xl font-black text-amber-600">{previewStudents.length - selectedCcs.size}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <button 
                                onClick={handleExportCsv}
                                className="h-14 px-8 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-2xl font-black text-xs flex items-center gap-3 hover:bg-zinc-200 transition-all uppercase tracking-widest"
                            >
                                <FileSpreadsheet className="h-5 w-5" />
                                Export CSV
                            </button>
                            <button 
                                onClick={handleGenerateBatch}
                                disabled={isGenerating || selectedCcs.size === 0}
                                className="h-14 px-10 bg-primary text-white rounded-2xl font-black text-xs shadow-xl shadow-primary/20 flex items-center gap-3 hover:translate-y-[-2px] active:scale-95 transition-all disabled:opacity-50 uppercase tracking-widest"
                            >
                                {isGenerating ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                                Generate Batch →
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
