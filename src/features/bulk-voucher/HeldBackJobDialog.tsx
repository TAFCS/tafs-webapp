"use client";

/**
 * TAFSD-547: "Generate for held-back students".
 *
 * Starts a new bulk job for the students a finished job held back for arrears
 * (POST /v1/bulk-voucher-jobs/:id/held-back). The issuance settings come from
 * the SHARED VoucherSettingsPanel (finance Rule B), prefilled with the original
 * job's settings and editable. The backend:
 *   - limits the job to the students the original held back (the list here can
 *     only narrow it),
 *   - refuses students outside the caller's scope,
 *   - forces "skip already issued", so anyone issued since is reported skipped,
 *   - links the new job to the original (source_job_id).
 */

import { useEffect, useMemo, useState } from "react";
import { Calendar, Loader2, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import type { BankAccount } from "@/lib/bank-accounts.service";
import VoucherSettingsPanel, {
    defaultVoucherSettings,
    type VoucherSettings,
} from "@/features/vouchers/components/VoucherSettingsPanel";
import { classSection, formatRs, heldBackRows, type JobReportRow } from "./job-report";

interface SourceJob {
    id: number;
    status: string;
    academic_year?: string;
    fee_date_from: string;
    fee_date_to: string;
    issue_date: string;
    due_date: string;
    validity_date: string | null;
    bank_account_id: number;
    apply_late_fee: boolean;
    late_fee_amount: number;
    waive_surcharge: boolean;
    send_notification: boolean;
    hold_for_release: boolean;
    pay_immediately_custom_dates?: boolean;
    is_revised?: boolean;
    job_type?: string;
    campus_ids: number[];
    class_ids: number[];
    section_ids: number[];
    report: JobReportRow[] | null;
}

const day = (iso: string | null | undefined) => (iso ? String(iso).slice(0, 10) : "");

interface Props {
    sourceJobId: number;
    banks: BankAccount[];
    onClose: () => void;
    onStarted: (jobId: number) => void;
}

export default function HeldBackJobDialog({ sourceJobId, banks, onClose, onStarted }: Props) {
    const [job, setJob] = useState<SourceJob | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [settings, setSettings] = useState<VoucherSettings>(defaultVoucherSettings());
    const [feeDateFrom, setFeeDateFrom] = useState("");
    const [feeDateTo, setFeeDateTo] = useState("");
    const [payImmediateCustomDates, setPayImmediateCustomDates] = useState(false);
    const [holdBackAgain, setHoldBackAgain] = useState(false);
    const [selected, setSelected] = useState<number[]>([]);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data } = await api.get(`/v1/bulk-voucher-jobs/${sourceJobId}/status`);
                const j: SourceJob = data?.data ?? data;
                if (cancelled) return;
                setJob(j);
                setFeeDateFrom(day(j.fee_date_from));
                setFeeDateTo(day(j.fee_date_to));
                setPayImmediateCustomDates(!!j.pay_immediately_custom_dates);
                setSettings(
                    defaultVoucherSettings({
                        bankAccountId: j.bank_account_id ?? null,
                        issueDate: day(j.issue_date),
                        dueDate: day(j.due_date),
                        validityDate: day(j.validity_date),
                        applyLateFee: j.apply_late_fee,
                        lateFeeAmount: j.late_fee_amount,
                        waiveSurcharge: j.waive_surcharge,
                        sendNotification: j.send_notification,
                        holdForRelease: j.hold_for_release,
                        markRevised: !!j.is_revised,
                    }),
                );
                setSelected(heldBackRows(j.report).map((r) => r.cc!).filter((cc) => typeof cc === "number"));
            } catch (err: unknown) {
                const e = err as { response?: { data?: { message?: string } }; message?: string };
                if (!cancelled) setLoadError(e.response?.data?.message ?? e.message ?? "Could not load the job.");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [sourceJobId]);

    const held = useMemo(() => heldBackRows(job?.report), [job]);
    const allSelected = held.length > 0 && selected.length === held.length;

    const toggle = (cc: number) =>
        setSelected((prev) => (prev.includes(cc) ? prev.filter((x) => x !== cc) : [...prev, cc]));

    const submit = async () => {
        if (!job) return;
        if (selected.length === 0) return toast.error("Select at least one student.");
        if (!settings.bankAccountId) return toast.error("Choose a collection bank.");
        if (!feeDateFrom || !feeDateTo) return toast.error("The fee date range is required.");
        if (!settings.issueDate || !settings.dueDate) return toast.error("Issue and due dates are required.");
        setSubmitting(true);
        try {
            const { data } = await api.post(`/v1/bulk-voucher-jobs/${job.id}/held-back`, {
                campus_ids: job.campus_ids,
                class_ids: job.class_ids,
                section_ids: job.section_ids,
                fee_date_from: feeDateFrom,
                fee_date_to: feeDateTo,
                issue_date: settings.issueDate,
                due_date: settings.dueDate,
                validity_date: settings.validityDate || undefined,
                bank_account_id: settings.bankAccountId,
                apply_late_fee: settings.applyLateFee,
                late_fee_amount: settings.lateFeeAmount,
                waive_surcharge: settings.waiveSurcharge,
                send_notification: settings.sendNotification,
                hold_for_release: settings.holdForRelease,
                is_revised: settings.markRevised,
                pay_immediately_custom_dates: payImmediateCustomDates,
                hold_back_arrears: holdBackAgain,
                job_type: job.job_type || "BULK",
                // Only send a list when it narrows the held-back set.
                student_ccs: allSelected ? undefined : selected,
            });
            const result = (data?.data ?? data) as { job_id: number; student_count: number };
            toast.success(`Job #${result.job_id} started for ${result.student_count} held-back student(s).`);
            onStarted(result.job_id);
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } }; message?: string };
            toast.error(e.response?.data?.message ?? e.message ?? "Could not start the job.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white dark:bg-zinc-950 rounded-[28px] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-800"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">Generate for held-back students</h2>
                        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                            From job #{sourceJobId} &middot; settings prefilled from that job, change any of them
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-9 w-9 bg-zinc-100 dark:bg-zinc-900 rounded-xl flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-8">
                    {loadError ? (
                        <p className="text-[13px] font-medium text-rose-600">{loadError}</p>
                    ) : !job ? (
                        <div className="flex items-center justify-center h-32">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : (
                        <>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Users className="h-4 w-4 text-primary" />
                                        <h3 className="text-[12px] font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">
                                            Students ({selected.length} of {held.length})
                                        </h3>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelected(allSelected ? [] : held.map((r) => r.cc!))}
                                        className="text-[12px] font-black text-primary hover:underline"
                                    >
                                        {allSelected ? "Deselect all" : "Select all"}
                                    </button>
                                </div>
                                <div className="max-h-56 overflow-y-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
                                    <table className="w-full text-left">
                                        <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900">
                                            <tr>
                                                <th className="px-4 py-2 w-10" />
                                                <th className="px-4 py-2 text-[9px] font-black text-zinc-400 uppercase tracking-widest">Student</th>
                                                <th className="px-4 py-2 text-[9px] font-black text-zinc-400 uppercase tracking-widest">Class</th>
                                                <th className="px-4 py-2 text-[9px] font-black text-zinc-400 uppercase tracking-widest">Campus</th>
                                                <th className="px-4 py-2 text-[9px] font-black text-zinc-400 uppercase tracking-widest text-right">Arrears</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                            {held.map((r) => (
                                                <tr key={r.cc} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40 cursor-pointer" onClick={() => toggle(r.cc!)}>
                                                    <td className="px-4 py-2">
                                                        <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={selected.includes(r.cc!)} readOnly />
                                                    </td>
                                                    <td className="px-4 py-2 text-[12px] font-black text-zinc-900 dark:text-zinc-100">
                                                        {r.student_name} <span className="text-zinc-400 font-bold">#{r.cc}</span>
                                                    </td>
                                                    <td className="px-4 py-2 text-[12px] text-zinc-500">{classSection(r) || "—"}</td>
                                                    <td className="px-4 py-2 text-[12px] text-zinc-500">{r.campus_name || "—"}</td>
                                                    <td className="px-4 py-2 text-[12px] font-bold text-rose-600 text-right">
                                                        {formatRs(r.arrears_amount)}
                                                        {r.arrears_months ? ` (${r.arrears_months} mo)` : ""}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="text-[11px] font-medium text-zinc-500">
                                    Anyone who has been issued a voucher for this period since job #{sourceJobId} ran is skipped, never given a second one.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <Calendar className="h-4 w-4 text-primary" />
                                    <h3 className="text-[12px] font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">Fee period</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-3 max-w-md">
                                    {[
                                        { label: "From", value: feeDateFrom, set: setFeeDateFrom },
                                        { label: "To", value: feeDateTo, set: setFeeDateTo },
                                    ].map((f) => (
                                        <div key={f.label} className="space-y-1.5">
                                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-0.5">{f.label}</label>
                                            <input
                                                type="date"
                                                value={f.value}
                                                onChange={(e) => f.set(e.target.value)}
                                                className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl text-[12px] font-black"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <VoucherSettingsPanel
                                value={settings}
                                onChange={setSettings}
                                banks={banks}
                                variant="full"
                                showReprintFee={false}
                                datesNote={
                                    <label className="mt-2 flex items-start gap-2 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            className="mt-0.5 h-4 w-4 accent-rose-600 shrink-0"
                                            checked={payImmediateCustomDates}
                                            onChange={(e) => setPayImmediateCustomDates(e.target.checked)}
                                        />
                                        <span className="text-[11px] font-medium text-zinc-500">
                                            Use these dates for PAY IMMEDIATELY vouchers too (otherwise issue date + 4 days, Monday if that&apos;s a Sunday).
                                        </span>
                                    </label>
                                }
                            >
                                <label className="flex items-start gap-3 p-4 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-2xl cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        className="mt-0.5 h-4 w-4 accent-amber-600 shrink-0"
                                        checked={holdBackAgain}
                                        onChange={(e) => setHoldBackAgain(e.target.checked)}
                                    />
                                    <span className="text-[12px] leading-snug text-amber-800 dark:text-amber-300">
                                        <span className="font-black">Hold back students with arrears (issue them later).</span>{" "}
                                        Off by default here: these students were held back for their arrears, and this job is to issue them.
                                    </span>
                                </label>
                            </VoucherSettingsPanel>
                        </>
                    )}
                </div>

                <div className="p-5 border-t border-zinc-100 dark:border-zinc-900 flex items-center justify-end gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="h-11 px-6 bg-zinc-100 dark:bg-zinc-900 rounded-2xl text-[12px] font-black text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={!job || submitting || selected.length === 0}
                        className="h-11 px-6 bg-primary text-white rounded-2xl text-[12px] font-black flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
                    >
                        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        Generate {selected.length} voucher{selected.length === 1 ? "" : "s"}
                    </button>
                </div>
            </div>
        </div>
    );
}
