"use client";

/**
 * TAFSD-550 (Rule B): Regenerate the student's latest voucher.
 *
 * Collects the same settings as single issuance on /fee-challan through the
 * SHARED VoucherSettingsPanel (bank, issue / due / valid-till dates, late fee,
 * arrear surcharge waiver, reprint fee, parent notification, hold for release,
 * REVISED), plus the same PAY IMMEDIATELY prefill and "use my own dates" opt-out.
 * Do not add fields here: add them to the panel so every issuance entry point
 * gets them.
 *
 * The period is not editable: the backend reissues the same fee date and heads
 * (POST /v1/vouchers/:id/regenerate), the old voucher is voided, and deleting
 * the new one brings it back. A different period is a new voucher from
 * /fee-challan.
 */

import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { bankAccountsService, type BankAccount } from "@/lib/bank-accounts.service";
import { useAppSelector } from "@/store/hooks";
import type { VoucherItem } from "@/store/slices/vouchersSlice";
import VoucherSettingsPanel, { defaultVoucherSettings, type VoucherSettings } from "./VoucherSettingsPanel";
import { PayImmediateDatesNote } from "./PayImmediateDatesNote";

const isoDay = (d: Date) => d.toISOString().split("T")[0];

/** /fee-challan's default: due in 10 days, valid for 15, counted from the issue date. */
function defaultDates(issueDate: string) {
    const d = new Date(`${issueDate}T00:00:00`);
    const plus = (n: number) => isoDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12));
    return { dueDate: plus(10), validityDate: plus(15) };
}

export interface RegenerateResult {
    voucher: { id: number };
    replaced_voucher_id: number;
    pdf_url: string | null;
    filename?: string;
}

export default function RegenerateVoucherModal({
    voucher,
    periodLabel,
    onClose,
    onDone,
}: {
    voucher: VoucherItem;
    /** Human label for the voucher's months, e.g. "August, September". */
    periodLabel: string;
    onClose: () => void;
    onDone: (result: RegenerateResult) => void | Promise<void>;
}) {
    const user = useAppSelector((s) => s.auth.user);
    const oldIssue = voucher.issue_date ? String(voucher.issue_date).slice(0, 10) : "";
    const feeDate = voucher.fee_date ? String(voucher.fee_date).slice(0, 10) : "";

    const [settings, setSettings] = useState<VoucherSettings>(() => {
        // Today, unless the voucher was issued later: the new voucher has to be
        // the student's latest so it can be deleted first and bring this one back.
        const today = isoDay(new Date());
        const issueDate = oldIssue && oldIssue > today ? oldIssue : today;
        const held = voucher.released_to_parent_at == null;
        const lateFee =
            Number(voucher.total_payable_after_due ?? 0) - Number(voucher.total_payable_before_due ?? 0);
        return defaultVoucherSettings({
            issueDate,
            ...defaultDates(issueDate),
            // Same voucher, so carry its bank, late fee, visibility and REVISED
            // over; everything else starts at /fee-challan's defaults.
            bankAccountId: voucher.bank_account_id ?? null,
            applyLateFee: voucher.late_fee_charge ?? true,
            lateFeeAmount: voucher.late_fee_charge && lateFee > 0 ? lateFee : 1000,
            holdForRelease: held,
            sendNotification: !held,
            markRevised: voucher.is_revised === true,
        });
    });
    const [banks, setBanks] = useState<BankAccount[]>([]);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        bankAccountsService.getAll().then(setBanks).catch(() => setBanks([]));
    }, []);

    // ── PAY IMMEDIATELY (TAFSD-174), exactly as /fee-challan asks it ─────────
    const [payImmediate, setPayImmediate] = useState<{ due: string } | null>(null);
    const [payImmediateCustom, setPayImmediateCustom] = useState(false);
    const studentCc = voucher.students?.cc ?? voucher.student_id;
    useEffect(() => {
        if (!studentCc || !feeDate || !settings.issueDate) {
            setPayImmediate(null);
            return;
        }
        let cancelled = false;
        api.get("/v1/vouchers/pay-immediate-preview", {
            params: { student_id: studentCc, fee_date: feeDate, issue_date: settings.issueDate },
        })
            .then(({ data }) => {
                if (cancelled) return;
                const res = data?.data as { pay_immediately: boolean; due_date: string | null } | undefined;
                setPayImmediate(res?.pay_immediately && res.due_date ? { due: res.due_date } : null);
            })
            .catch(() => !cancelled && setPayImmediate(null));
        return () => {
            cancelled = true;
        };
    }, [studentCc, feeDate, settings.issueDate]);
    useEffect(() => {
        if (payImmediate && !payImmediateCustom) {
            setSettings((s) => ({ ...s, dueDate: payImmediate.due, validityDate: payImmediate.due }));
        }
    }, [payImmediate, payImmediateCustom]);

    const issueTooEarly = !!oldIssue && settings.issueDate < oldIssue;
    const bankName = useMemo(
        () => banks.find((b) => b.id === settings.bankAccountId)?.bank_name,
        [banks, settings.bankAccountId],
    );

    const handleConfirm = async () => {
        if (!settings.bankAccountId) return toast.error("Select the collection bank.");
        if (!settings.dueDate) return toast.error("Enter the due date.");
        if (issueTooEarly) return toast.error(`The issue date can't be before ${oldIssue}.`);
        setSubmitting(true);
        const loading = toast.loading("Regenerating voucher…");
        try {
            // KEEP IN SYNC with /fee-challan's FormData and regenerate-voucher.dto.ts.
            const { data } = await api.post(`/v1/vouchers/${voucher.id}/regenerate`, {
                bank_account_id: settings.bankAccountId,
                issue_date: settings.issueDate,
                due_date: settings.dueDate,
                ...(settings.validityDate ? { validity_date: settings.validityDate } : {}),
                late_fee_charge: settings.applyLateFee,
                late_fee_amount: settings.lateFeeAmount || 0,
                reprint_fee_charge: settings.applyReprintFee,
                reprint_fee_amount: settings.reprintFeeAmount || 100,
                waive_surcharge: settings.waiveSurcharge,
                waived_by: user?.fullName || user?.username || "Administrator",
                send_notification: settings.holdForRelease ? false : settings.sendNotification,
                requires_release: settings.holdForRelease,
                is_revised: settings.markRevised,
                ...(payImmediate && payImmediateCustom ? { pay_immediately_custom_dates: true } : {}),
            });
            toast.dismiss(loading);
            const result = data?.data as RegenerateResult;
            toast.success(`Voucher #${voucher.id} replaced by #${result.voucher.id}.`);
            await onDone(result);
        } catch (err) {
            toast.dismiss(loading);
            const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
            toast.error(Array.isArray(msg) ? msg.join(", ") : msg || "Failed to regenerate the voucher.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4">
            <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <span className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-xl">
                            <RefreshCw className="h-5 w-5 text-zinc-600 dark:text-zinc-300" />
                        </span>
                        <div>
                            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                                Regenerate voucher VCH-{voucher.id}
                            </h2>
                            <p className="text-xs text-zinc-400">
                                {voucher.students?.full_name} · CC-{studentCc}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={submitting}
                        aria-label="Close"
                        className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                        <X className="h-4 w-4 text-zinc-400" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Period</p>
                            <p className="mt-1 font-bold text-zinc-800 dark:text-zinc-200">{periodLabel}</p>
                        </div>
                        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Fee date</p>
                            <p className="mt-1 font-bold font-mono text-zinc-800 dark:text-zinc-200">{feeDate || "—"}</p>
                        </div>
                        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 col-span-2 sm:col-span-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Heads</p>
                            <p className="mt-1 font-bold text-zinc-800 dark:text-zinc-200">
                                {voucher.voucher_heads?.length ?? 0} on this voucher
                            </p>
                        </div>
                    </div>

                    {/* SHARED with /fee-challan, bulk held-back and both split modals —
                        see the banner in VoucherSettingsPanel.tsx. */}
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                        <VoucherSettingsPanel
                            value={settings}
                            onChange={setSettings}
                            banks={banks}
                            variant="compact"
                            showReprintFee
                            disabled={submitting}
                            lockDates={!!payImmediate && !payImmediateCustom}
                            datesNote={
                                <>
                                    {issueTooEarly && (
                                        <p className="text-[11px] font-bold text-rose-600 ml-0.5">
                                            The issue date can&apos;t be before the current voucher&apos;s ({oldIssue}).
                                        </p>
                                    )}
                                    {payImmediate && (
                                        <PayImmediateDatesNote
                                            defaultDate={payImmediate.due}
                                            custom={payImmediateCustom}
                                            disabled={submitting}
                                            onCustomChange={setPayImmediateCustom}
                                        />
                                    )}
                                </>
                            }
                        />
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-1">
                        <p className="text-[11px] text-zinc-500 max-w-sm">
                            A new voucher is issued for the same fee date and heads
                            {bankName ? ` (${bankName})` : ""}, arrears and surcharges are worked out again,
                            and VCH-{voucher.id} is voided. Deleting the new voucher brings this one back.
                        </p>
                        <div className="flex gap-3 shrink-0">
                            <button
                                onClick={onClose}
                                disabled={submitting}
                                className="px-4 py-2 text-sm font-semibold border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={submitting || issueTooEarly}
                                className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-50"
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                {submitting ? "Regenerating…" : "Regenerate"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
