"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "@/store/store";
import { 
    setStep, 
    updateFilters, 
    setSelectedStudents, 
    fetchBulkPreview,
    startBulkJob,
    pollJobStatus,
    resetBulkProcess,
    fetchBulkHistory
} from "@/store/slices/bulkVoucherSlice";
import { fetchCampuses } from "@/store/slices/campusesSlice";
import { fetchBanks } from "@/store/slices/banksSlice";
import { 
    ChevronRight, 
    ChevronLeft, 
    ChevronDown,
    Layers, 
    Building2, 
    Calendar, 
    CreditCard, 
    Users, 
    CheckCircle2, 
    Loader2, 
    AlertCircle,
    Info,
    Check,
    X,
    FileText,
    Banknote,
    Clock,
    Download,
    History,
    RefreshCw,
    ExternalLink
} from "lucide-react";
import toast from "react-hot-toast";

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export default function BulkVoucherPage() {
    const dispatch = useDispatch<AppDispatch>();
    const { 
        currentStep, 
        filters, 
        previewStudents, 
        selectedStudentCCs, 
        isFetchingPreview,
        isGenerating,
        jobId,
        jobStatus,
        progress,
        totalCount,
        successCount,
        skipCount,
        failCount,
        mergedPdfUrl,
        history,
        isFetchingHistory
    } = useSelector((state: RootState) => state.bulkVoucher);

    const { items: campuses, isLoading: isCampusesLoading } = useSelector((state: RootState) => state.campuses);
    const { items: banks, isLoading: isBanksLoading } = useSelector((state: RootState) => state.banks);
    const user = useSelector((state: RootState) => state.auth.user);

    const [isHistoryView, setIsHistoryView] = useState(false);

    const [showYearDropdown, setShowYearDropdown] = useState(false);
    const [baseYear, setBaseYear] = useState(new Date().getFullYear() - 2);
    const yearDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isHistoryView) {
            dispatch(fetchBulkHistory(filters.campusId || undefined));
        }
    }, [dispatch, isHistoryView, filters.campusId]);

    useEffect(() => {
        dispatch(fetchCampuses());
        dispatch(fetchBanks());

        const handleClickOutside = (e: MouseEvent) => {
            if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target as Node)) {
                setShowYearDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dispatch]);

    // ── Polling ────────────────────────────────────────────────────────────
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopPolling = useCallback(() => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    }, []);

    const startPolling = useCallback((id: number) => {
        stopPolling();
        pollIntervalRef.current = setInterval(async () => {
            const result = await dispatch(pollJobStatus(id));
            if (pollJobStatus.fulfilled.match(result)) {
                const { status } = result.payload;
                if (status === 'DONE' || status === 'FAILED' || status === 'PARTIAL_FAILURE') {
                    stopPolling();
                }
            }
        }, 2000); // poll every 2s
    }, [dispatch, stopPolling]);

    // Clean up interval on unmount
    useEffect(() => () => stopPolling(), [stopPolling]);

    // Auto-start polling when jobId is set for the first time
    useEffect(() => {
        if (jobId && jobStatus === 'processing') {
            startPolling(jobId);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jobId]);

    // Derived logic for filtered classes/sections
    const selectedCampusItem = useMemo(() => 
        campuses.find(c => c.id === parseInt(filters.campusId)), 
    [campuses, filters.campusId]);

    const filteredClasses = useMemo(() => 
        selectedCampusItem?.offered_classes || [], 
    [selectedCampusItem]);

    const filteredSections = useMemo(() => {
        if (!filters.classId) return [];
        const cls = filteredClasses.find(c => c.id === parseInt(filters.classId));
        return cls?.sections || [];
    }, [filteredClasses, filters.classId]);

    const handleFilterChange = (updates: Partial<any>) => {
        dispatch(updateFilters(updates));
    };

    const YearPicker = () => {
        const years = Array.from({ length: 12 }, (_, i) => `${baseYear + i}-${baseYear + i + 1}`);
        return (
            <div className="relative" ref={yearDropdownRef}>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">Academic Year</label>
                <button
                    onClick={() => setShowYearDropdown(!showYearDropdown)}
                    className="w-full h-12 px-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[13px] font-bold flex items-center justify-between focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all shadow-sm"
                >
                    <span className="text-zinc-900 dark:text-zinc-100">{filters.academicYear}</span>
                    <Calendar className="h-4 w-4 text-zinc-400" />
                </button>
                {showYearDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[28px] shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 min-w-[280px]">
                        <div className="p-4 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                            <button onClick={() => setBaseYear(prev => prev - 12)} className="p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all"><ChevronLeft className="h-4 w-4" /></button>
                            <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">{baseYear} - {baseYear + 11}</span>
                            <button onClick={() => setBaseYear(prev => prev + 12)} className="p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all"><ChevronRight className="h-4 w-4" /></button>
                        </div>
                        <div className="p-4 grid grid-cols-2 gap-3">
                            {years.map(y => (
                                <button key={y} onClick={() => { handleFilterChange({ academicYear: y }); setShowYearDropdown(false); }} className={`px-3 py-3 text-center text-[12px] font-bold rounded-xl transition-all border ${filters.academicYear === y ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-transparent hover:border-zinc-100"}`}>
                                    {y}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const handleNext = async () => {
        if (currentStep === 1) {
            if (!filters.campusId) return toast.error("Campus is required");
            if (!filters.dateFrom || !filters.dateTo) return toast.error("Date range is required");
            if (!filters.bankAccountId) return toast.error("Bank is required");
            if (!filters.validityDate) return toast.error("Validity Date is required");
            
            await dispatch(fetchBulkPreview(filters)).unwrap();
            dispatch(setStep(2));
        } else if (currentStep === 2) {
            if (selectedStudentCCs.length === 0) return toast.error("Select at least one student");
            try {
                const result = await dispatch(
                    startBulkJob({ filters, studentCCs: selectedStudentCCs })
                ).unwrap();
                dispatch(setStep(3));
                toast.success("Generation job started!");
                startPolling(result.job_id);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                toast.error(msg || "Failed to start job");
            }
        }
    };

    const handleBack = () => {
        if (currentStep > 1) dispatch(setStep(currentStep - 1));
    };

    const toggleStudent = (cc: number) => {
        if (selectedStudentCCs.includes(cc)) {
            dispatch(setSelectedStudents(selectedStudentCCs.filter(id => id !== cc)));
        } else {
            dispatch(setSelectedStudents([...selectedStudentCCs, cc]));
        }
    };

    const toggleAll = () => {
        if (selectedStudentCCs.length === previewStudents.length) {
            dispatch(setSelectedStudents([]));
        } else {
            dispatch(setSelectedStudents(previewStudents.map(s => s.cc)));
        }
    };

    const handleDownloadUrls = (job: any) => {
        if (!job.report || job.report.length === 0) {
            toast.error("No URLs found for this job.");
            return;
        }

        const headers = ["Student Name", "CC", "PDF URL", "Status"];
        const rows = (job.report as any[]).map(item => [
            item.student_name,
            item.cc,
            item.pdf_url || "",
            item.status
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `bulk_voucher_urls_job_${job.id}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderHistory = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-500">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] overflow-hidden shadow-sm">
                <div className="p-8 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                            <History className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100">Job History</h3>
                            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Previous generation jobs</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => dispatch(fetchBulkHistory(filters.campusId || undefined))}
                        className="h-10 px-4 bg-zinc-100 dark:bg-zinc-900 rounded-xl flex items-center gap-2 text-[12px] font-black hover:bg-zinc-200 transition-all"
                    >
                        <RefreshCw className={`h-4 w-4 ${isFetchingHistory ? "animate-spin" : ""}`} />
                        REFRESH
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-zinc-50 dark:bg-zinc-900/50">
                                <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">ID & Date</th>
                                <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Scope</th>
                                <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Progress</th>
                                <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-8 py-12 text-center text-zinc-500 font-medium italic">No recent jobs found.</td>
                                </tr>
                            ) : (
                                history.map(job => (
                                    <tr key={job.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/10 transition-colors">
                                        <td className="px-8 py-6">
                                            <p className="text-[14px] font-black text-zinc-900 dark:text-zinc-100">Job #{job.id}</p>
                                            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">{new Date(job.created_at).toLocaleString()}</p>
                                        </td>
                                        <td className="px-8 py-6">
                                            <p className="text-[13px] font-bold text-zinc-900 dark:text-zinc-100">{job.campuses?.campus_name}</p>
                                            <p className="text-[11px] font-medium text-zinc-500">{job.academic_year} • {new Date(job.fee_date_from).toLocaleDateString()} - {new Date(job.fee_date_to).toLocaleDateString()}</p>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="flex-1 min-w-[100px] h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                    <div className="h-full bg-primary" style={{ width: `${Math.round(((job.success_count + job.skip_count + job.fail_count) / job.total_count) * 100)}%` }} />
                                                </div>
                                                <span className="text-[11px] font-black text-zinc-600 dark:text-zinc-400">{job.success_count}/{job.total_count}</span>
                                            </div>
                                            <div className="flex gap-2 mt-2">
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${job.status === 'DONE' ? 'bg-emerald-50 text-emerald-600' : job.status === 'FAILED' ? 'bg-rose-50 text-rose-600' : 'bg-primary/10 text-primary'}`}>
                                                    {job.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2">
                                                {job.merged_pdf_url && (
                                                    <a 
                                                        href={job.merged_pdf_url}
                                                        target="_blank"
                                                        className="h-9 px-4 bg-emerald-500 text-white rounded-xl flex items-center gap-2 text-[11px] font-black hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/10"
                                                    >
                                                        <Download className="h-3.5 w-3.5" />
                                                        MERGED PDF
                                                    </a>
                                                )}
                                                <button 
                                                    onClick={() => handleDownloadUrls(job)}
                                                    className="h-9 px-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center gap-2 text-[11px] font-black hover:bg-zinc-50 transition-all"
                                                >
                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                    URLS CSV
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    // --- Steps UI ---

    const renderStep1 = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-500">
            {/* Main Configuration Card */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Scope Configuration */}
                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 space-y-8 shadow-sm">
                    <div className="flex items-center gap-4 border-b border-zinc-100 dark:border-zinc-900 pb-6">
                        <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                            <Building2 className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100">Generation Scope</h3>
                            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Select targets for generation</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-1 gap-6">
                            <div>
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">Campus (Required)</label>
                                <div className="relative">
                                    <select 
                                        className="w-full h-12 px-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[13px] font-bold focus:ring-4 focus:ring-primary/5 transition-all outline-none appearance-none"
                                        value={filters.campusId}
                                        onChange={(e) => handleFilterChange({ campusId: e.target.value, classId: '', sectionId: '' })}
                                        disabled={isCampusesLoading}
                                    >
                                        <option value="">Select Campus</option>
                                        {campuses.map(c => <option key={c.id} value={c.id}>{c.campus_name}</option>)}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                                        {isCampusesLoading ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <ChevronDown className="h-4 w-4" />}
                                    </div>
                                </div>
                            </div>

                            <YearPicker />

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">Class (Optional)</label>
                                    <div className="relative">
                                        <select 
                                            className="w-full h-12 px-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[13px] font-bold focus:ring-4 focus:ring-primary/5 transition-all outline-none appearance-none disabled:opacity-50"
                                            value={filters.classId}
                                            disabled={!filters.campusId || isCampusesLoading}
                                            onChange={(e) => handleFilterChange({ classId: e.target.value, sectionId: '' })}
                                        >
                                            <option value="">All Classes</option>
                                            {filteredClasses.map(c => <option key={c.id} value={c.id}>{c.description}</option>)}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                                            <ChevronDown className="h-4 w-4" />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">Section (Optional)</label>
                                    <div className="relative">
                                        <select 
                                            className="w-full h-12 px-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[13px] font-bold focus:ring-4 focus:ring-primary/5 transition-all outline-none appearance-none disabled:opacity-50"
                                            value={filters.sectionId}
                                            disabled={!filters.classId || isCampusesLoading}
                                            onChange={(e) => handleFilterChange({ sectionId: e.target.value })}
                                        >
                                            <option value="">All Sections</option>
                                            {filteredSections.map(s => <option key={s.id} value={s.id}>{s.description}</option>)}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                                            <ChevronDown className="h-4 w-4" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex items-start gap-4">
                            <Info className="h-5 w-5 text-primary mt-1" />
                            <p className="text-[12px] font-medium text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                Filtering by campus is mandatory. You can optionally narrow down to specific classes or sections within the selected campus.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Date & Payment Configuration */}
                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 space-y-8 shadow-sm">
                    <div className="flex items-center gap-4 border-b border-zinc-100 dark:border-zinc-900 pb-6">
                        <div className="h-12 w-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500">
                            <Calendar className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100">Validity & Bank</h3>
                            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Billing and deadlines</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">Voucher Date Range</label>
                            <div className="grid grid-cols-2 gap-2">
                                <input 
                                    type="date"
                                    className="w-full h-12 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[12px] font-bold focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                                    value={filters.dateFrom}
                                    onChange={(e) => handleFilterChange({ dateFrom: e.target.value })}
                                />
                                <input 
                                    type="date"
                                    className="w-full h-12 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[12px] font-bold focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                                    value={filters.dateTo}
                                    onChange={(e) => handleFilterChange({ dateTo: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">Bank Account</label>
                            <div className="relative">
                                <select 
                                    className="w-full h-12 px-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[13px] font-bold focus:ring-4 focus:ring-primary/5 transition-all outline-none appearance-none"
                                    value={filters.bankAccountId}
                                    onChange={(e) => handleFilterChange({ bankAccountId: e.target.value })}
                                    disabled={isBanksLoading}
                                >
                                    <option value="">Select Bank</option>
                                    {banks.map(b => <option key={b.id} value={b.id}>{b.bank_name} - {b.account_number}</option>)}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                                    {isBanksLoading ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <ChevronDown className="h-4 w-4" />}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">Issue Date</label>
                            <input 
                                type="date"
                                className="w-full h-12 px-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[13px] font-bold focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                                value={filters.issueDate}
                                onChange={(e) => handleFilterChange({ issueDate: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">Due Date</label>
                            <input 
                                type="date"
                                className="w-full h-12 px-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[13px] font-bold focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                                value={filters.dueDate}
                                onChange={(e) => handleFilterChange({ dueDate: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">Validity Date</label>
                            <input 
                                type="date"
                                className="w-full h-12 px-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[13px] font-bold focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                                value={filters.validityDate}
                                onChange={(e) => handleFilterChange({ validityDate: e.target.value })}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Optional Settings Card */}
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500">
                            <Info className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100">Generation Rules</h3>
                            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Policies and safety checks</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

                    <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                        <div>
                            <p className="text-[13px] font-black text-zinc-900 dark:text-zinc-100">Apply Late Fee</p>
                            <p className="text-[11px] font-medium text-zinc-500">Automatic late fee charge</p>
                        </div>
                        <button 
                            onClick={() => handleFilterChange({ applyLateFee: !filters.applyLateFee })}
                            className={`h-6 w-11 rounded-full transition-all relative ${filters.applyLateFee ? "bg-primary" : "bg-zinc-300 dark:bg-zinc-700"}`}
                        >
                            <div className={`h-4 w-4 bg-white rounded-full absolute top-1 transition-all ${filters.applyLateFee ? "left-6" : "left-1"}`} />
                        </button>
                    </div>

                    {filters.applyLateFee && (
                        <div className="flex items-center gap-4 animate-in zoom-in duration-300">
                            <div className="flex-1">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">Late Fee Amount</label>
                                <input 
                                    type="number"
                                    className="w-full h-12 px-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[13px] font-bold focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                                    value={isNaN(filters.lateFeeAmount) ? "" : filters.lateFeeAmount}
                                    onChange={(e) => handleFilterChange({ lateFeeAmount: e.target.value === "" ? 0 : parseInt(e.target.value) })}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-500">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] overflow-hidden shadow-sm">
                <div className="p-8 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                            <Users className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100">Student Preview</h3>
                            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Verify the auto-selected list</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className="text-[12px] font-black text-zinc-400">{selectedStudentCCs.length} / {previewStudents.length} SELECTED</span>
                        <button 
                            onClick={toggleAll}
                            className="text-[12px] font-black text-primary hover:underline"
                        >
                            {selectedStudentCCs.length === previewStudents.length ? "Deselect All" : "Select All"}
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-zinc-50 dark:bg-zinc-900/50">
                                <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Selection</th>
                                <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Student Info</th>
                                <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Class & Section</th>
                                <th className="px-8 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                            {previewStudents.map(student => (
                                <tr 
                                    key={student.cc} 
                                    className={`transition-colors ${student.is_already_issued ? "bg-zinc-50/50 dark:bg-zinc-900/10 opacity-60" : "hover:bg-zinc-50 dark:hover:bg-zinc-900/30"}`}
                                >
                                    <td className="px-8 py-4">
                                        <button 
                                            onClick={() => toggleStudent(student.cc)}
                                            className={`h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedStudentCCs.includes(student.cc) ? "bg-primary border-primary text-white" : "border-zinc-200 dark:border-zinc-800"}`}
                                        >
                                            {selectedStudentCCs.includes(student.cc) && <Check className="h-4 w-4" />}
                                        </button>
                                    </td>
                                    <td className="px-8 py-4">
                                        <div>
                                            <p className="text-[14px] font-black text-zinc-900 dark:text-zinc-100">{student.student_full_name}</p>
                                            <p className="text-[11px] font-bold text-primary">CC: {student.cc} • GR: {student.gr_number}</p>
                                        </div>
                                    </td>
                                    <td className="px-8 py-4">
                                        <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-[11px] font-black text-zinc-600 dark:text-zinc-400 uppercase">
                                            {student.class_name} - {student.section_name}
                                        </span>
                                    </td>
                                    <td className="px-8 py-4 text-right">
                                        {student.is_already_issued ? (
                                            <div className="flex items-center justify-end gap-2 text-rose-500 bg-rose-50 dark:bg-rose-950/30 px-3 py-1.5 rounded-xl border border-rose-100 dark:border-rose-900 w-fit ml-auto">
                                                <AlertCircle className="h-3.5 w-3.5" />
                                                <span className="text-[10px] font-black uppercase tracking-wider">ISSUED</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-end gap-2 text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-900 w-fit ml-auto">
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                <span className="text-[10px] font-black uppercase tracking-wider">READY</span>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="p-8 bg-zinc-50 dark:bg-zinc-900 flex justify-between items-center">
                    <p className="text-[12px] font-medium text-zinc-500 max-w-md">
                        Staff should verify the list above. Students already issued a voucher for this range are flagged and can be excluded to prevent double-billing.
                    </p>
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Total Population</p>
                            <p className="text-xl font-black text-zinc-900 dark:text-zinc-100">{previewStudents.length}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Already Issued</p>
                            <p className="text-xl font-black text-rose-600 dark:text-rose-400">{previewStudents.filter(s => s.is_already_issued).length}</p>
                        </div>
                        <div className="text-right pl-6 border-l border-zinc-200 dark:border-zinc-800">
                            <p className="text-[10px] font-black text-primary uppercase tracking-widest">Selected to Generate</p>
                            <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{selectedStudentCCs.length}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderStep3 = () => (
        <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in duration-700">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[40px] p-12 text-center space-y-8 shadow-2xl">
                <div className="relative inline-block">
                    <div className={`h-24 w-24 rounded-[32px] flex items-center justify-center text-white shadow-xl ${jobStatus === 'done' ? "bg-emerald-500 shadow-emerald-500/20" : jobStatus === 'failed' ? "bg-rose-500 shadow-rose-500/20" : "bg-primary shadow-primary/20 animate-pulse"}`}>
                        {jobStatus === 'done' ? <CheckCircle2 className="h-12 w-12" /> : jobStatus === 'failed' ? <X className="h-12 w-12" /> : <Layers className="h-12 w-12" />}
                    </div>
                    {jobStatus !== 'done' && jobStatus !== 'failed' && (
                        <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-[32px] animate-spin" />
                    )}
                </div>

                <div className="space-y-3">
                    <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100">
                        {jobStatus === 'done' ? "Bulk Generation Complete!" : jobStatus === 'failed' ? "Job Failed" : "Generating Vouchers..."}
                    </h2>
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium max-w-sm mx-auto">
                        {jobStatus === 'done' ? `Successfully generated ${successCount} vouchers for ${filters.campusId}.` : jobStatus === 'failed' ? "Something went wrong during the generation process." : `Processing ${selectedStudentCCs.length} students. This may take a few minutes.`}
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                            className={`h-full transition-all duration-500 ${jobStatus === 'failed' ? "bg-rose-500" : "bg-primary"}`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-[11px] font-black text-zinc-400 uppercase tracking-widest">
                        <span>{progress}% COMPLETED</span>
                        <span>{successCount} / {totalCount} GENERATED</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-900">
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Generated</p>
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{successCount}</p>
                    </div>
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-100 dark:border-amber-900">
                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Skipped</p>
                        <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{skipCount}</p>
                    </div>
                    <div className="p-4 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-100 dark:border-rose-900">
                        <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Failed</p>
                        <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{failCount}</p>
                    </div>
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Total</p>
                        <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{totalCount}</p>
                    </div>
                </div>

                {jobStatus === 'done' && mergedPdfUrl && (
                    <div className="pt-4">
                        <a 
                            href={mergedPdfUrl}
                            target="_blank"
                            className="w-full h-16 bg-emerald-500 text-white rounded-3xl flex items-center justify-center gap-4 font-black hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
                        >
                            <Download className="h-6 w-6" />
                            DOWNLOAD MERGED PDF
                        </a>
                        <p className="text-[11px] font-bold text-zinc-400 mt-4 uppercase tracking-widest">Single file containing all generated vouchers</p>
                    </div>
                )}
            </div>
            
            {jobStatus === 'done' && (
                <div className="flex justify-center">
                    <button 
                        onClick={() => dispatch(resetBulkProcess())}
                        className="text-[12px] font-black text-zinc-400 hover:text-primary transition-colors flex items-center gap-2"
                    >
                        <Layers className="h-4 w-4" />
                        START ANOTHER BATCH
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-12 pb-32 mt-6 px-4">
            {/* Header with Stepper */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                <div className="space-y-4">
                    <h1 className="text-4xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-4">
                        <div className="h-14 w-14 bg-primary/10 rounded-3xl flex items-center justify-center text-primary rotate-3 transition-transform hover:rotate-0">
                            <Layers className="h-8 w-8" />
                        </div>
                        Bulk Voucher Engine
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium">Issue fee vouchers for entire classes or campuses at once.</p>
                </div>

                <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-[22px]">
                    <button 
                        onClick={() => setIsHistoryView(false)}
                        className={`h-11 px-6 rounded-2xl flex items-center gap-2 text-[12px] font-black transition-all ${!isHistoryView ? "bg-white dark:bg-zinc-800 text-primary shadow-sm" : "text-zinc-500 hover:text-zinc-900"}`}
                    >
                        <Layers className="h-4 w-4" />
                        NEW JOB
                    </button>
                    <button 
                        onClick={() => setIsHistoryView(true)}
                        className={`h-11 px-6 rounded-2xl flex items-center gap-2 text-[12px] font-black transition-all ${isHistoryView ? "bg-white dark:bg-zinc-800 text-primary shadow-sm" : "text-zinc-500 hover:text-zinc-900"}`}
                    >
                        <History className="h-4 w-4" />
                        HISTORY
                    </button>
                </div>

                {/* Progress Stepper */}
                <div className="flex items-center gap-12 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-2 pl-6 rounded-3xl shadow-sm">
                    {[
                        { step: 1, label: "Configure Filters", icon: Building2 },
                        { step: 2, label: "Preview List", icon: Users },
                        { step: 3, label: "Execution", icon: CreditCard }
                    ].map((s, idx) => (
                        <div key={s.step} className="flex items-center gap-4 relative">
                            <div className={`h-10 w-10 rounded-2xl flex items-center justify-center transition-all ${currentStep >= s.step ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-zinc-100 dark:bg-zinc-900 text-zinc-400"}`}>
                                <s.icon className="h-5 w-5" />
                                {currentStep > s.step && <div className="absolute -top-1 -right-1 h-5 w-5 bg-emerald-500 rounded-full border-2 border-white dark:border-zinc-950 flex items-center justify-center text-white scale-75"><Check className="h-3 w-3" /></div>}
                            </div>
                            <div className="hidden sm:block">
                                <p className={`text-[10px] font-black uppercase tracking-widest ${currentStep >= s.step ? "text-primary" : "text-zinc-400"}`}>Step 0{s.step}</p>
                                <p className={`text-[12px] font-black ${currentStep >= s.step ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400"}`}>{s.label}</p>
                            </div>
                            {idx < 2 && <ChevronRight className="h-5 w-5 text-zinc-200 dark:text-zinc-800 ml-4 hidden md:block" />}
                        </div>
                    ))}
                </div>
            </div>

            {/* Step Content */}
            <div className="min-h-[500px]">
                {isHistoryView ? renderHistory() : (
                    <>
                        {currentStep === 1 && renderStep1()}
                        {currentStep === 2 && renderStep2()}
                        {currentStep === 3 && renderStep3()}
                    </>
                )}
            </div>

            {/* Global Actions */}
            {currentStep < 3 && !isHistoryView && (
                <div className="fixed bottom-0 left-0 right-0 p-8 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-200 dark:border-zinc-800 z-50">
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <button 
                            onClick={handleBack}
                            disabled={currentStep === 1}
                            className={`h-14 px-8 flex items-center gap-3 font-black text-[14px] rounded-[22px] transition-all ${currentStep === 1 ? "opacity-0 pointer-events-none" : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 active:scale-95"}`}
                        >
                            <ChevronLeft className="h-5 w-5" />
                            BACK
                        </button>

                        <div className="flex items-center gap-6">
                            <div className="hidden md:block text-right">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Logged in As</p>
                                <p className="text-[13px] font-bold text-zinc-900 dark:text-zinc-100">{user?.fullName || "Administrator"}</p>
                            </div>

                            <button 
                                onClick={handleNext}
                                disabled={isFetchingPreview || isGenerating}
                                className="h-16 px-12 bg-primary text-white rounded-[28px] flex items-center gap-4 font-black text-[16px] shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isFetchingPreview ? (
                                    <>
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                        FETCHING...
                                    </>
                                ) : (
                                    <>
                                        {currentStep === 1 ? "CONTINUE TO PREVIEW" : "GENERATE VOUCHERS"}
                                        <ChevronRight className="h-6 w-6" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
