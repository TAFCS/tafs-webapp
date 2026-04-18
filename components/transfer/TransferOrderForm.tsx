'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Download, Loader2, ArrowLeftRight, CheckCircle2, ChevronDown, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface TransferStudent {
    cc: number;
    gr_number?: string;
    reg_number?: string;
    full_name: string;
    dob?: string;
    gender?: string;
    scholastic_year?: string;
    academic_year?: string;
    campus_name?: string;
    campus_number?: string;
    class_name?: string;
    section_name?: string;
    academic_system?: string;
    segment_head?: string;
    address?: string;
    home_phone?: string;
    father_name?: string;
    father_cell?: string;
    mother_cell?: string;
    nearest_relationship?: string;
    nearest_name?: string;
    nearest_phone?: string;
    email?: string;
    fax?: string;
    day?: string;
    date?: string;
    photograph_url?: string | null;
}

interface ClassOption {
    id: number;
    description: string;
    class_code: string;
    academic_system: string;
}


interface Props {
    student: TransferStudent;
}

export default function TransferOrderForm({ student }: Props) {
    // Classes
    const [allClasses, setAllClasses] = useState<ClassOption[]>([]);
    const [loadingClasses, setLoadingClasses] = useState(true);

    // Form inputs — only what the user must decide
    const [toClassId, setToClassId] = useState<number | ''>('');
    const [discipline, setDiscipline] = useState('');
    const [remarks, setRemarks] = useState('');

    // Execution state
    const [isExecuting, setIsExecuting] = useState(false);
    const [transferred, setTransferred] = useState(false);
    const [updatedData, setUpdatedData] = useState<TransferStudent | null>(null);

    // PDF Generation state
    const [isGenerating, setIsGenerating] = useState(false);

    // Fetch classes on mount
    useEffect(() => {
        api.get(`/v1/transfers/${student.cc}/classes`)
            .then(({ data: res }) => setAllClasses(res.data || res))
            .catch(() => toast.error('Failed to load class list'))
            .finally(() => setLoadingClasses(false));
    }, [student.cc]);



    // Derived: the selected class object
    const selectedClass = allClasses.find(c => c.id === toClassId);
    const fromSystem = student.academic_system || '';
    const toSystem = selectedClass?.academic_system || '';

    // Grouped classes — exclude current class to stop same-class transfer
    const groupedClasses = allClasses.reduce<Record<string, ClassOption[]>>((acc, cls) => {
        if (!acc[cls.academic_system]) acc[cls.academic_system] = [];
        acc[cls.academic_system].push(cls);
        return acc;
    }, {});

    // Execute the actual transfer
    const handleExecuteTransfer = async () => {
        if (!toClassId) { toast.error('Please select a target class'); return; }
        setIsExecuting(true);
        try {
            const { data: res } = await api.post(`/v1/transfers/${student.cc}/execute`, {
                to_class_id: Number(toClassId),
                discipline: discipline || undefined,
                remarks: remarks || undefined,
            });
            const updated = res.data || res;
            setUpdatedData(updated);
            setTransferred(true);
            toast.success('Transfer completed successfully!');
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Transfer failed. Please try again.');
        } finally {
            setIsExecuting(false);
        }
    };

    // Generate and download the PDF
    const handleDownload = useCallback(async () => {
        const source = updatedData || student;
        setIsGenerating(true);
        try {
            const now = new Date();
            const months = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
            const dateStr = `${String(now.getDate()).padStart(2,'0')} ${months[now.getMonth()]} ${now.getFullYear()}`;

            const { data: res } = await api.post(`/v1/transfers/${source.cc}/generate-pdf`, {
                transfer_from: fromSystem,
                transfer_to: toSystem,
                discipline: discipline || undefined,
                remarks: remarks || undefined,
                date_of_transfer: dateStr,
            });

            const pdfUrl: string = res.data?.url || res.url;
            if (!pdfUrl) throw new Error('No URL returned from server');

            // Trigger browser download
            const a = document.createElement('a');
            a.href = pdfUrl;
            a.target = '_blank';
            a.download = `transfer-order-${source.cc}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            toast.success('Transfer Order PDF downloaded!');
        } catch (err: any) {
            console.error(err);
            toast.error(err?.response?.data?.message || 'PDF generation failed. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    }, [student, updatedData, fromSystem, toSystem, discipline, remarks]);

    const displayPhoto = (() => {
        if (student.photograph_url && typeof window !== 'undefined')
            return `${window.location.origin}/api/photo-proxy?url=${encodeURIComponent(student.photograph_url)}`;
        return null;
    })();

    // ── SUCCESS STATE ──────────────────────────────────────────────────────────
    if (transferred && updatedData) {
        return (
            <div className="max-w-2xl mx-auto space-y-6 py-8">
                {/* Success Banner */}
                <div className="bg-gradient-to-br from-green-600 to-emerald-700 text-white p-8 rounded-3xl shadow-2xl shadow-green-900/20 text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/5 rounded-3xl" />
                    <div className="relative z-10">
                        <div className="h-16 w-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="h-9 w-9" />
                        </div>
                        <h2 className="text-2xl font-black tracking-tight mb-1">Transfer Complete!</h2>
                        <p className="text-green-100 font-medium">
                            {student.full_name} has been moved to{' '}
                            <span className="font-black text-white">{selectedClass?.description}</span>
                            {' '}({toSystem})
                        </p>
                    </div>
                </div>

                {/* Summary card */}
                <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                    <div className="p-5 border-b border-zinc-100 dark:border-zinc-800">
                        <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Transfer Summary</p>
                    </div>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {[
                            { label: 'Student', value: student.full_name },
                            { label: 'CC #', value: `${student.cc}` },
                            { label: 'From', value: `${fromSystem} — ${student.class_name || '—'}` },
                            { label: 'To', value: `${toSystem} — ${selectedClass?.description || '—'}` },
                            { label: 'Discipline', value: discipline || '—' },
                        ].map(({ label, value }) => (
                            <div key={label} className="flex items-center justify-between px-5 py-3">
                                <span className="text-xs font-black uppercase tracking-wider text-zinc-400">{label}</span>
                                <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Download PDF */}
                <button
                    onClick={handleDownload}
                    disabled={isGenerating}
                    className="group w-full flex items-center justify-center gap-3 px-8 py-5 bg-gradient-to-r from-red-700 to-red-800 text-white rounded-2xl font-black text-base shadow-xl shadow-red-900/25 hover:shadow-red-900/40 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isGenerating ? (
                        <><Loader2 className="h-5 w-5 animate-spin" />Generating PDF...</>
                    ) : (
                        <><Download className="h-5 w-5" />Download Transfer Order PDF</>
                    )}
                </button>
            </div>
        );
    }

    // ── TRANSFER FORM ──────────────────────────────────────────────────────────
    return (
        <div className="max-w-2xl mx-auto space-y-5">

            {/* Student banner */}
            <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 dark:from-zinc-950 dark:to-zinc-900 text-white p-5 rounded-2xl shadow-lg flex items-center gap-4">
                {displayPhoto ? (
                    <img src={displayPhoto} alt={student.full_name}
                        className="w-14 h-16 object-cover rounded-xl border-2 border-white/20 shadow-md flex-shrink-0" />
                ) : (
                    <div className="w-14 h-16 rounded-xl border-2 border-dashed border-white/20 bg-white/5 flex items-center justify-center text-[10px] text-white/30 font-bold flex-shrink-0">
                        No Photo
                    </div>
                )}
                <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-0.5">Student</p>
                    <h2 className="text-xl font-black tracking-tight truncate">{student.full_name}</h2>
                    <p className="text-zinc-400 text-xs font-medium mt-0.5">
                        CC #{student.cc} · GR #{student.gr_number || '—'} · {student.campus_name || '—'}
                    </p>
                </div>
            </div>

            {/* Current state */}
            <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                <div className="px-5 pt-5 pb-3">
                    <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-3">Current Assignment</p>
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                fromSystem === 'CAMBRIDGE'
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                    : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                            }`}>{fromSystem || 'UNKNOWN'}</span>
                            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{student.class_name || 'No class'}</span>
                            {student.section_name && (
                                <span className="text-xs text-zinc-400">· {student.section_name}</span>
                            )}
                        </div>
                        <ArrowLeftRight className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                        <div className="text-xs text-zinc-400 font-medium italic">Select target below</div>
                    </div>
                </div>
            </div>

            {/* Transfer inputs */}
            <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5 space-y-4">
                <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Transfer To</p>

                {/* Target class picker */}
                <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block mb-1.5">
                        Target Class <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <select
                            value={toClassId}
                            onChange={(e) => setToClassId(e.target.value === '' ? '' : Number(e.target.value))}
                            disabled={loadingClasses}
                            className="w-full appearance-none px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-semibold text-sm text-zinc-800 dark:text-zinc-200 cursor-pointer disabled:opacity-50"
                        >
                            <option value="">— Select target class —</option>
                            {Object.entries(groupedClasses).map(([system, classes]) => (
                                <optgroup key={system} label={system}>
                                    {classes.map((cls) => (
                                        <option key={cls.id} value={cls.id}>
                                            {cls.description} ({cls.class_code})
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                    </div>
                    {selectedClass && (
                        <p className="mt-1.5 text-[11px] font-medium text-zinc-500">
                            Moving to{' '}
                            <span className={`font-black ${
                                selectedClass.academic_system === 'CAMBRIDGE' ? 'text-blue-600' : 'text-green-600'
                            }`}>{selectedClass.academic_system}</span>
                            {' '}system
                            {fromSystem === selectedClass.academic_system && (
                                <span className="ml-2 text-amber-500">⚠ Same academic system</span>
                            )}
                        </p>
                    )}
                </div>

                {/* Discipline */}
                <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block mb-1.5">
                        Discipline <span className="text-zinc-300">(optional)</span>
                    </label>
                    <input
                        type="text"
                        value={discipline}
                        onChange={(e) => setDiscipline(e.target.value)}
                        placeholder="e.g. Science, Arts, Commerce"
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-medium text-sm"
                    />
                </div>

                {/* Remarks */}
                <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block mb-1.5">
                        Remarks <span className="text-zinc-300">(optional)</span>
                    </label>
                    <textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        rows={2}
                        placeholder="Any additional notes about this transfer..."
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-medium text-sm resize-none"
                    />
                </div>
            </div>

            {/* Warning if no class selected */}
            {!toClassId && (
                <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl text-amber-700 dark:text-amber-400 text-xs font-semibold">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    Select a target class to enable the transfer
                </div>
            )}

            {/* Primary action */}
            <button
                onClick={handleExecuteTransfer}
                disabled={!toClassId || isExecuting || loadingClasses}
                className="group w-full flex items-center justify-center gap-3 px-8 py-5 bg-gradient-to-r from-red-700 to-red-800 text-white rounded-2xl font-black text-base shadow-xl shadow-red-900/25 hover:shadow-red-900/40 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
            >
                {isExecuting ? (
                    <><Loader2 className="h-5 w-5 animate-spin" />Processing Transfer...</>
                ) : (
                    <><ArrowLeftRight className="h-5 w-5" />Perform Transfer</>
                )}
            </button>

            <p className="text-center text-[11px] text-zinc-400 pb-4">
                The transfer will update the student's class record and create a new admission entry.
                You can download the Transfer Order PDF after the transfer is complete.
            </p>
        </div>
    );
}
