"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, ChevronDown, Loader2, Repeat } from "lucide-react";
import { getAcademicYears } from "@/lib/fee-utils";
import api from "@/lib/api";
import toast from "react-hot-toast";

const ACADEMIC_YEARS = getAcademicYears(1, 2);
const sel = "w-full h-10 px-3 appearance-none bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-primary transition-all cursor-pointer";
const label = "block text-[10px] font-bold text-zinc-500 mb-1.5";

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface TransferCandidate {
    dbId: number;
    feeDescription: string;
    target_month: number;
    amount: string;
    status?: string;
}

interface PreviewRow {
    id: number;
    fee_type: string | null;
    target_month: number;
    amount: string | number | null;
    status: string | null;
    from_academic_year: string;
    label_before: string;
    label_after: string;
    label_on_voucher: string | null;
    voucher_ids: number[];
    collision_with_fee_id: number | null;
    flags: {
        on_voucher: boolean;
        on_paid_voucher: boolean;
        frozen_receipt: boolean;
        collision: boolean;
        label_unchanged: boolean;
        voucher_label_differs: boolean;
    };
}

interface PreviewResult {
    rows: PreviewRow[];
    total: number;
    changes: number;
    unchanged: number;
    on_paid_voucher: number;
    frozen_receipts: number;
    collisions: number;
}

const errMessage = (err: unknown, fallback: string): string =>
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

/** Risk badges, worst first — each one names a consequence the admin is accepting. */
const BADGES: { key: keyof PreviewRow["flags"]; text: string; cls: string; title: string }[] = [
    {
        key: "collision",
        text: "COLLISION",
        cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
        title: "A head of the same fee type already sits on this month of the destination year.",
    },
    {
        key: "frozen_receipt",
        text: "FROZEN RECEIPT",
        cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
        title: "The paid receipt PDF is already generated and pinned. It will NOT re-render, so that receipt keeps the old month label permanently.",
    },
    {
        key: "on_paid_voucher",
        text: "PAID VOUCHER",
        cls: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
        title: "This head is attached to a PAID voucher. The voucher stays in its own academic year while the head moves out of it.",
    },
    {
        key: "label_unchanged",
        text: "NO CHANGE",
        cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
        title: "The month label is identical before and after — transferring this head achieves nothing.",
    },
];

export function TransferHeadsModal({
    open,
    onClose,
    onTransferred,
    candidates,
    studentName,
    grNumber,
    currentAcademicYear,
    currentClassTermStartMonth,
}: {
    open: boolean;
    onClose: () => void;
    onTransferred: () => void;
    candidates: TransferCandidate[];
    studentName?: string | null;
    grNumber?: string | null;
    currentAcademicYear: string;
    /** 4 = Apr-Mar, 8 = Aug-Jul. Defaults the destination to the student's own term. */
    currentClassTermStartMonth?: number | null;
}) {
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [targetYear, setTargetYear] = useState(currentAcademicYear);
    const [targetTerm, setTargetTerm] = useState<number>(currentClassTermStartMonth ?? 8);
    const [preview, setPreview] = useState<PreviewResult | null>(null);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isTransferring, setIsTransferring] = useState(false);
    const [acknowledged, setAcknowledged] = useState(false);

    // Any change to the inputs invalidates the preview the acknowledgement refers to.
    const invalidate = useCallback(() => {
        setPreview(null);
        setAcknowledged(false);
    }, []);

    useEffect(() => {
        if (!open) {
            setSelectedIds([]);
            setPreview(null);
            setAcknowledged(false);
        }
    }, [open]);

    useEffect(() => {
        setTargetTerm(currentClassTermStartMonth ?? 8);
    }, [currentClassTermStartMonth]);

    const toggle = (id: number) => {
        invalidate();
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handlePreview = async () => {
        if (!selectedIds.length) {
            toast.error("Select at least one fee head.");
            return;
        }
        setIsPreviewing(true);
        setPreview(null);
        setAcknowledged(false);
        try {
            const { data } = await api.get("/v1/student-fees/transfer-preview", {
                params: {
                    student_fee_ids: selectedIds.join(","),
                    target_academic_year: targetYear,
                    target_term_start_month: targetTerm,
                },
            });
            setPreview(data?.data);
        } catch (err: unknown) {
            toast.error(errMessage(err, "Preview failed."));
        } finally {
            setIsPreviewing(false);
        }
    };

    const handleTransfer = async () => {
        if (!preview || !acknowledged) return;
        setIsTransferring(true);
        try {
            const { data } = await api.patch("/v1/student-fees/transfer", {
                student_fee_ids: preview.rows.map(r => r.id),
                target_academic_year: targetYear,
                target_term_start_month: targetTerm,
                acknowledgement: true,
            });
            toast.success(`${data?.data?.transferred ?? 0} fee head(s) transferred to ${targetYear}.`);
            onTransferred();
            onClose();
        } catch (err: unknown) {
            toast.error(errMessage(err, "Transfer failed."));
        } finally {
            setIsTransferring(false);
        }
    };

    const riskCount = useMemo(() => {
        if (!preview) return 0;
        return preview.rows.filter(r =>
            r.flags.collision || r.flags.frozen_receipt || r.flags.on_paid_voucher).length;
    }, [preview]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div className="bg-white dark:bg-zinc-950 border border-amber-200 dark:border-amber-900 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-start gap-4 p-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="h-10 w-10 bg-amber-100 dark:bg-amber-950/50 rounded-2xl flex items-center justify-center shrink-0 mt-0.5">
                        <Repeat className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100">Transfer Fee Heads to Another Year</h3>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                            {studentName ?? "Student"}{grNumber ? ` — GR ${grNumber}` : ""} · from {currentAcademicYear}
                        </p>
                    </div>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto">

                    {/* Why this exists */}
                    <div className="flex gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                            Use this when a student moved between term systems (Aug–Jul ↔ Apr–Mar) and their
                            older heads now show the wrong calendar year. The transfer rewrites the head&apos;s
                            academic year <strong>and</strong> its term together — the two can never be set apart,
                            because a year without a term is what causes the wrong label in the first place.
                        </p>
                    </div>

                    {/* Destination */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={label}>Target Academic Year <span className="text-rose-500">*</span></label>
                            <div className="relative">
                                <select
                                    value={targetYear}
                                    onChange={e => { setTargetYear(e.target.value); invalidate(); }}
                                    className={sel}
                                >
                                    {ACADEMIC_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                            </div>
                        </div>
                        <div>
                            <label className={label}>Target Term <span className="text-rose-500">*</span></label>
                            <div className="relative">
                                <select
                                    value={targetTerm}
                                    onChange={e => { setTargetTerm(Number(e.target.value)); invalidate(); }}
                                    className={sel}
                                >
                                    <option value={8}>Aug – Jul</option>
                                    <option value={4}>Apr – Mar</option>
                                </select>
                                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                            </div>
                            <p className="text-[10px] text-zinc-400 mt-1">
                                Defaulted to the student&apos;s current class term.
                            </p>
                        </div>
                    </div>

                    {/* Head selection */}
                    <div>
                        <label className={label}>Heads to Transfer ({selectedIds.length} selected)</label>
                        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800 max-h-52 overflow-y-auto">
                            {candidates.length === 0 && (
                                <p className="p-4 text-xs text-zinc-400">No saved fee heads in this year.</p>
                            )}
                            {candidates.map(c => (
                                <label key={c.dbId} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(c.dbId)}
                                        onChange={() => toggle(c.dbId)}
                                        className="h-3.5 w-3.5 accent-amber-600"
                                    />
                                    <span className="text-xs font-mono text-zinc-400 w-10">{MONTHS[c.target_month]}</span>
                                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex-1 truncate">{c.feeDescription}</span>
                                    <span className="text-xs font-mono text-zinc-500">Rs {c.amount}</span>
                                    {c.status && (
                                        <span className="text-[9px] font-bold text-zinc-400 w-20 text-right">{c.status}</span>
                                    )}
                                </label>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handlePreview}
                        disabled={isPreviewing || !selectedIds.length}
                        className="w-full h-10 rounded-xl text-sm font-black text-white bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-700 dark:hover:bg-zinc-600 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                        {isPreviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Preview Changes
                    </button>

                    {/* Preview */}
                    {preview && (
                        <div className="space-y-3">
                            <div className="text-[11px] font-bold text-zinc-500">
                                {preview.changes} label(s) change · {preview.unchanged} unchanged · {riskCount} carrying risk
                            </div>
                            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800 max-h-60 overflow-y-auto">
                                {preview.rows.map(r => (
                                    <div key={r.id} className="px-3 py-2.5 space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[10px] font-mono text-zinc-400">#{r.id}</span>
                                            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex-1 truncate">
                                                {r.fee_type ?? "Fee"}
                                            </span>
                                            <span className="text-xs font-mono text-zinc-400 line-through">{r.label_before}</span>
                                            <ArrowRight className="h-3 w-3 text-zinc-400" />
                                            <span className="text-xs font-mono font-black text-emerald-600">{r.label_after}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {BADGES.filter(b => r.flags[b.key]).map(b => (
                                                <span key={b.text} title={b.title}
                                                    className={`text-[9px] font-black px-1.5 py-0.5 rounded ${b.cls}`}>
                                                    {b.text}
                                                </span>
                                            ))}
                                            {r.flags.collision && (
                                                <span className="text-[9px] text-rose-500">with #{r.collision_with_fee_id}</span>
                                            )}
                                            {r.flags.voucher_label_differs && (
                                                <span className="text-[9px] text-zinc-400" title="The voucher renders this head through the class it was issued against, so it already differs from the schedule.">
                                                    voucher shows {r.label_on_voucher}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Acknowledgement */}
                            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={acknowledged}
                                    onChange={e => setAcknowledged(e.target.checked)}
                                    className="h-3.5 w-3.5 accent-amber-600 mt-0.5"
                                />
                                <span className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
                                    I understand these heads will move to <strong>{targetYear}</strong>: they will
                                    disappear from the {preview.rows[0]?.from_academic_year} fee schedule while any
                                    voucher they sit on stays in that year, already-generated receipt PDFs will keep
                                    the old month label, and collection figures shift between years.
                                </span>
                            </label>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
                    <button
                        onClick={onClose}
                        className="h-10 px-5 rounded-2xl text-sm font-black text-zinc-600 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleTransfer}
                        disabled={!preview || !acknowledged || isTransferring}
                        className="h-10 px-8 rounded-2xl text-sm font-black text-white bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-600/20 transition-all disabled:opacity-40 flex items-center gap-2"
                    >
                        {isTransferring ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Transfer {preview ? `${preview.rows.length} Head(s)` : ""}
                    </button>
                </div>
            </div>
        </div>
    );
}
