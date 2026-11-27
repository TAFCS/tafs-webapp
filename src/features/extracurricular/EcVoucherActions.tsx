"use client";

import { useEffect, useMemo, useState } from "react";
import { Ban, HandCoins, Loader2, RefreshCcw, Undo2 } from "lucide-react";
import toast from "react-hot-toast";
import { bankAccountsService, type BankAccount } from "@/lib/bank-accounts.service";
import { ecFeesService } from "@/lib/ec-fees.service";
import { ecAddDays, ecDate, ecErrMsg, ecRs, ecTodayKey, type EcDeposit, type EcVoucherDetail } from "@/lib/ec-fees.types";
import { MANUAL_PAYMENT_METHODS, formatPaymentMethod } from "@/lib/payment-methods";
import { EC_TILES, useExtracurricularAccess } from "@/hooks/use-extracurricular-access";
import { EcField, EcModal, ecInputClass, ecPrimaryButton, ecSecondaryButton } from "./ui";

/**
 * TAFSD-605: what can be done to an extracurricular voucher, and the dialogs
 * that do it. Buttons only appear when both the user's actions and the
 * voucher's state allow them; the server enforces the same rules regardless.
 */

/** A voucher can take a payment while live, or (dated on or before its valid-till day) once expired. */
export const ecCanTakePayment = (v: EcVoucherDetail) =>
    v.state === "UNPAID" || v.state === "PARTIALLY_PAID" || (v.state === "EXPIRED" && !v.reissued_to);

const minKey = (a: string, b: string) => (a < b ? a : b);
const actionButton =
    "inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900";

export function EcVoucherActionButtons({ voucher, onChanged }: { voucher: EcVoucherDetail; onChanged: (v: EcVoucherDetail) => void }) {
    const deposit = useExtracurricularAccess(EC_TILES.receiveDeposit);
    const vouchers = useExtracurricularAccess(EC_TILES.vouchers);
    const history = useExtracurricularAccess(EC_TILES.paymentHistory);
    const [open, setOpen] = useState<"pay" | "reissue" | "waive" | "unwaive" | "reverse" | null>(null);
    const latest = voucher.deposits.find((d) => d.is_latest) ?? null;
    const done = (v: EcVoucherDetail) => {
        setOpen(null);
        onChanged(v);
    };

    return (
        <>
            {deposit.can("record") && ecCanTakePayment(voucher) && (
                <button type="button" className={ecPrimaryButton} onClick={() => setOpen("pay")}>
                    <HandCoins className="h-4 w-4" /> Record payment
                </button>
            )}
            {vouchers.can("reissue") && voucher.state === "EXPIRED" && (
                <button type="button" className={actionButton} onClick={() => setOpen("reissue")}>
                    <RefreshCcw className="h-4 w-4" /> Reissue
                </button>
            )}
            {vouchers.can("waive") && (voucher.state === "UNPAID" || voucher.state === "PARTIALLY_PAID" || voucher.state === "EXPIRED") && (
                <button type="button" className={actionButton} onClick={() => setOpen("waive")}>
                    <Ban className="h-4 w-4" /> Waive
                </button>
            )}
            {vouchers.can("waive") && voucher.state === "WAIVED" && (
                <button type="button" className={actionButton} onClick={() => setOpen("unwaive")}>
                    <Undo2 className="h-4 w-4" /> Undo waiver
                </button>
            )}
            {history.can("reverse") && latest && voucher.state !== "REISSUED" && voucher.state !== "WAIVED" && (
                <button type="button" className={`${actionButton} text-rose-600`} onClick={() => setOpen("reverse")}>
                    <Undo2 className="h-4 w-4" /> Reverse latest payment
                </button>
            )}

            {open === "pay" && <EcDepositModal voucher={voucher} onClose={() => setOpen(null)} onDone={done} />}
            {open === "reissue" && <EcReissueDialog voucher={voucher} onClose={() => setOpen(null)} onDone={done} />}
            {open === "waive" && <EcWaiveDialog voucher={voucher} onClose={() => setOpen(null)} onDone={done} />}
            {open === "unwaive" && <EcUnwaiveDialog voucher={voucher} onClose={() => setOpen(null)} onDone={done} />}
            {open === "reverse" && latest && <EcReverseDialog voucher={voucher} deposit={latest} onClose={() => setOpen(null)} onDone={done} />}
        </>
    );
}

function VoucherHeader({ v }: { v: EcVoucherDetail }) {
    return (
        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/60 px-4 py-3 text-sm grid grid-cols-2 gap-2">
            <div>
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Student</div>
                <div className="font-semibold">{v.student.full_name}</div>
                <div className="text-xs text-zinc-500">C.C. {v.student.cc}</div>
            </div>
            <div className="text-right">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Balance</div>
                <div className="font-black text-orange-600">{ecRs(v.balance)}</div>
                <div className="text-xs text-zinc-500">valid till {ecDate(v.expiry_date)}</div>
            </div>
        </div>
    );
}

export function EcDepositModal({ voucher, onClose, onDone }: { voucher: EcVoucherDetail; onClose: () => void; onDone: (v: EcVoucherDetail) => void }) {
    const today = ecTodayKey();
    const latestAllowed = minKey(today, voucher.expiry_date);
    const [amount, setAmount] = useState(String(voucher.balance));
    const [paidOn, setPaidOn] = useState(latestAllowed);
    const [method, setMethod] = useState("cash");
    const [reference, setReference] = useState("");
    const [bankName, setBankName] = useState("");
    const [remarks, setRemarks] = useState("");
    const [mode, setMode] = useState<"AUTO" | "MANUAL">("AUTO");
    const [manual, setManual] = useState<Record<number, string>>({});
    const [busy, setBusy] = useState(false);

    const open = voucher.lines.filter((l) => l.remaining > 0);
    const amt = /^\d+$/.test(amount) ? Number(amount) : NaN;
    const autoSplit = useMemo(() => {
        const out = new Map<number, number>();
        let left = Number.isFinite(amt) ? amt : 0;
        for (const l of open) {
            const take = Math.min(left, l.remaining);
            if (take > 0) out.set(l.id, take);
            left -= take;
        }
        return out;
    }, [open, amt]);
    const manualSum = open.reduce((n, l) => n + (Number(manual[l.id]) || 0), 0);

    const problems = [
        (!Number.isFinite(amt) || amt < 1) && "Give the amount received, in whole rupees.",
        amt > voucher.balance && `That is more than the balance (${ecRs(voucher.balance)}). Extracurricular vouchers take no excess.`,
        !/^\d{4}-\d{2}-\d{2}$/.test(paidOn) && "Give the date it was paid.",
        paidOn > today && "The paid-on date can't be in the future.",
        paidOn < voucher.issue_date && "The paid-on date is before the voucher was issued.",
        paidOn > voucher.expiry_date && `The voucher was valid till ${ecDate(voucher.expiry_date)}; a later payment can't be taken on it. Reissue it instead.`,
        mode === "MANUAL" && manualSum !== amt && `The split adds up to ${ecRs(manualSum)}, not ${ecRs(Number.isFinite(amt) ? amt : 0)}.`,
        mode === "MANUAL" && open.some((l) => (Number(manual[l.id]) || 0) > l.remaining) && "A line is given more than it still owes.",
    ].filter(Boolean) as string[];

    const submit = async () => {
        if (problems.length) {
            toast.error(problems[0]);
            return;
        }
        setBusy(true);
        try {
            const res = await ecFeesService.recordDeposit({
                voucher_id: voucher.id,
                amount: amt,
                allocation: mode,
                ...(mode === "MANUAL" ? { lines: open.map((l) => ({ line_id: l.id, amount: Number(manual[l.id]) || 0 })).filter((p) => p.amount > 0) } : {}),
                payment_method: method,
                deposit_date: paidOn,
                reference_number: reference.trim() || undefined,
                bank_name: bankName.trim() || undefined,
                remarks: remarks.trim() || undefined,
            });
            toast.success(res.voucher.state === "PAID" ? `${voucher.voucher_number} is now paid` : `Payment recorded; ${ecRs(res.voucher.balance)} still owed`);
            onDone(res.voucher);
        } catch (err) {
            toast.error(ecErrMsg(err, "Couldn't record the payment"));
        } finally {
            setBusy(false);
        }
    };

    const showsBank = method !== "cash";
    return (
        <EcModal
            open
            wide
            title={`Record a payment on ${voucher.voucher_number}`}
            subtitle="Full or partial, up to the balance. Date it the day it was paid (the bank stamp)."
            onClose={onClose}
            footer={
                <>
                    <button type="button" className={ecSecondaryButton} onClick={onClose} disabled={busy}>
                        Cancel
                    </button>
                    <button type="button" className={ecPrimaryButton} onClick={submit} disabled={busy || problems.length > 0} title={problems[0]}>
                        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Record {Number.isFinite(amt) && amt > 0 ? ecRs(amt) : "payment"}
                    </button>
                </>
            }
        >
            <VoucherHeader v={voucher} />
            {voucher.state === "EXPIRED" && (
                <p className="text-xs rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 px-3 py-2">
                    This voucher expired on {ecDate(voucher.expiry_date)}. Only a payment made on or before that day (for example, stamped by the bank in time) can be recorded. Otherwise reissue it.
                </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <EcField label="Amount received" unit="Rs" htmlFor="ec-dep-amount">
                    <input id="ec-dep-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} className={ecInputClass} />
                </EcField>
                <EcField label="Paid on" htmlFor="ec-dep-date" hint={`Between ${ecDate(voucher.issue_date)} and ${ecDate(latestAllowed)}`}>
                    <input id="ec-dep-date" type="date" value={paidOn} min={voucher.issue_date} max={latestAllowed} onChange={(e) => setPaidOn(e.target.value)} className={ecInputClass} />
                </EcField>
                <EcField label="Method" htmlFor="ec-dep-method">
                    <select id="ec-dep-method" value={method} onChange={(e) => setMethod(e.target.value)} className={ecInputClass}>
                        {MANUAL_PAYMENT_METHODS.map((m) => (
                            <option key={m.value} value={m.value}>
                                {m.label}
                            </option>
                        ))}
                    </select>
                </EcField>
                <EcField label="Reference no." htmlFor="ec-dep-ref" hint="Cheque, transaction or receipt number">
                    <input id="ec-dep-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} className={ecInputClass} />
                </EcField>
                {showsBank && (
                    <EcField label="Bank" htmlFor="ec-dep-bank">
                        <input id="ec-dep-bank" value={bankName} onChange={(e) => setBankName(e.target.value)} maxLength={100} className={ecInputClass} />
                    </EcField>
                )}
                <EcField label="Remarks" htmlFor="ec-dep-remarks">
                    <input id="ec-dep-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={500} className={ecInputClass} />
                </EcField>
            </div>

            <EcField label="How it is split across the lines">
                <div className="flex gap-1.5 mb-2">
                    {(
                        [
                            ["AUTO", "In order (automatic)"],
                            ["MANUAL", "Choose per line"],
                        ] as const
                    ).map(([m, label]) => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => setMode(m)}
                            className={`h-8 px-3 rounded-lg text-xs font-semibold border ${mode === m ? "bg-orange-600 border-orange-600 text-white" : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300"}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs text-zinc-500 border-b border-zinc-100 dark:border-zinc-900">
                            <th className="py-1.5 font-medium">Line</th>
                            <th className="py-1.5 font-medium text-right">Still owed (Rs)</th>
                            <th className="py-1.5 font-medium text-right w-40">This payment (Rs)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {open.map((l) => (
                            <tr key={l.id} className="border-b border-zinc-50 dark:border-zinc-900/60">
                                <td className="py-1.5">{l.description}</td>
                                <td className="py-1.5 text-right tabular-nums">{l.remaining.toLocaleString("en-PK")}</td>
                                <td className="py-1.5 text-right">
                                    {mode === "AUTO" ? (
                                        <span className="tabular-nums">{(autoSplit.get(l.id) ?? 0).toLocaleString("en-PK")}</span>
                                    ) : (
                                        <input
                                            aria-label={`Amount for ${l.description}, in rupees`}
                                            inputMode="numeric"
                                            value={manual[l.id] ?? ""}
                                            placeholder="0"
                                            onChange={(e) => setManual((p) => ({ ...p, [l.id]: e.target.value.replace(/[^\d]/g, "") }))}
                                            className="w-28 h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-right px-2 tabular-nums"
                                        />
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </EcField>
            {Number.isFinite(amt) && amt > 0 && amt <= voucher.balance && (
                <p className="text-xs text-zinc-500">After this payment {voucher.balance - amt === 0 ? "the voucher is paid in full" : `${ecRs(voucher.balance - amt)} will still be owed`}.</p>
            )}
            {problems.length > 0 && <p className="text-xs text-rose-600">{problems[0]}</p>}
        </EcModal>
    );
}

function useBanks(preferredId: number | null) {
    const [banks, setBanks] = useState<BankAccount[]>([]);
    const [bankId, setBankId] = useState<number | "">("");
    useEffect(() => {
        bankAccountsService
            .getAll()
            .then((all) => {
                const active = all.filter((b) => (b as BankAccount & { is_active?: boolean }).is_active !== false);
                setBanks(active);
                setBankId(active.find((b) => b.id === preferredId)?.id ?? active.find((b) => b.is_default)?.id ?? active[0]?.id ?? "");
            })
            .catch(() => setBanks([]));
    }, [preferredId]);
    return { banks, bankId, setBankId };
}

export function EcReissueDialog({ voucher, onClose, onDone }: { voucher: EcVoucherDetail; onClose: () => void; onDone: (v: EcVoucherDetail) => void }) {
    const today = ecTodayKey();
    const [issueDate, setIssueDate] = useState(today);
    const [expiryDate, setExpiryDate] = useState(ecAddDays(today, 15));
    const { banks, bankId, setBankId } = useBanks(voucher.bank?.id ?? null);
    const [busy, setBusy] = useState(false);
    const remainder = voucher.lines.reduce((n, l) => n + l.remaining, 0);

    const submit = async () => {
        if (expiryDate < issueDate || expiryDate < today) {
            toast.error("The valid-till date must be after the issue date and not already past");
            return;
        }
        setBusy(true);
        try {
            const v = await ecFeesService.reissueVoucher(voucher.id, { issue_date: issueDate, expiry_date: expiryDate, bank_account_id: bankId === "" ? undefined : bankId });
            toast.success(`${voucher.voucher_number} reissued as ${v.voucher_number}`);
            onDone(v);
        } catch (err) {
            toast.error(ecErrMsg(err, "Couldn't reissue the voucher"));
        } finally {
            setBusy(false);
        }
    };

    return (
        <EcModal
            open
            title={`Reissue ${voucher.voucher_number}`}
            subtitle="Its unpaid part goes on a fresh voucher with new dates. The old voucher stays as history."
            onClose={onClose}
            footer={
                <>
                    <button type="button" className={ecSecondaryButton} onClick={onClose} disabled={busy}>
                        Cancel
                    </button>
                    <button type="button" className={ecPrimaryButton} onClick={submit} disabled={busy}>
                        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Reissue {ecRs(remainder)}
                    </button>
                </>
            }
        >
            <VoucherHeader v={voucher} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <EcField label="Issue date" htmlFor="ec-re-issue">
                    <input id="ec-re-issue" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={ecInputClass} />
                </EcField>
                <EcField label="Valid till" htmlFor="ec-re-expiry">
                    <input id="ec-re-expiry" type="date" value={expiryDate} min={issueDate} onChange={(e) => setExpiryDate(e.target.value)} className={ecInputClass} />
                </EcField>
                <div className="sm:col-span-2">
                    <EcField label="Bank account" htmlFor="ec-re-bank">
                        <select id="ec-re-bank" value={bankId} onChange={(e) => setBankId(e.target.value ? Number(e.target.value) : "")} className={ecInputClass}>
                            {banks.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.bank_name} · {b.account_number}
                                    {b.is_default ? " (default)" : ""}
                                </option>
                            ))}
                        </select>
                    </EcField>
                </div>
            </div>
        </EcModal>
    );
}

export function EcWaiveDialog({ voucher, onClose, onDone }: { voucher: EcVoucherDetail; onClose: () => void; onDone: (v: EcVoucherDetail) => void }) {
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const submit = async () => {
        if (reason.trim().length < 3) {
            toast.error("Give the reason for the waiver");
            return;
        }
        setBusy(true);
        try {
            const v = await ecFeesService.waiveVoucher(voucher.id, reason.trim());
            toast.success(`${voucher.voucher_number} waived`);
            onDone(v);
        } catch (err) {
            toast.error(ecErrMsg(err, "Couldn't waive the voucher"));
        } finally {
            setBusy(false);
        }
    };
    return (
        <EcModal
            open
            title={`Waive ${voucher.voucher_number}?`}
            subtitle={`Writes off ${ecRs(voucher.balance)} still owed. What was already received stays received.`}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className={ecSecondaryButton} onClick={onClose} disabled={busy}>
                        Cancel
                    </button>
                    <button type="button" className={ecPrimaryButton} onClick={submit} disabled={busy}>
                        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Waive {ecRs(voucher.balance)}
                    </button>
                </>
            }
        >
            <EcField label="Reason" htmlFor="ec-waive-reason" hint="Kept on the voucher and in the activity log.">
                <textarea id="ec-waive-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} className={`${ecInputClass} h-auto py-3`} />
            </EcField>
        </EcModal>
    );
}

function EcUnwaiveDialog({ voucher, onClose, onDone }: { voucher: EcVoucherDetail; onClose: () => void; onDone: (v: EcVoucherDetail) => void }) {
    const [busy, setBusy] = useState(false);
    const submit = async () => {
        setBusy(true);
        try {
            const v = await ecFeesService.unwaiveVoucher(voucher.id);
            toast.success(`Waiver on ${voucher.voucher_number} undone`);
            onDone(v);
        } catch (err) {
            toast.error(ecErrMsg(err, "Couldn't undo the waiver"));
        } finally {
            setBusy(false);
        }
    };
    return (
        <EcModal
            open
            title={`Undo the waiver on ${voucher.voucher_number}?`}
            subtitle={voucher.waive_reason ? `It was waived because: ${voucher.waive_reason}` : undefined}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className={ecSecondaryButton} onClick={onClose} disabled={busy}>
                        Cancel
                    </button>
                    <button type="button" className={ecPrimaryButton} onClick={submit} disabled={busy}>
                        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Undo waiver
                    </button>
                </>
            }
        >
            <p className="text-sm text-zinc-600 dark:text-zinc-300">The written-off amount becomes owed again on this voucher.</p>
        </EcModal>
    );
}

export function EcReverseDialog({
    voucher,
    deposit,
    onClose,
    onDone,
}: {
    voucher: EcVoucherDetail;
    deposit: EcDeposit;
    onClose: () => void;
    onDone: (v: EcVoucherDetail) => void;
}) {
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const submit = async () => {
        if (reason.trim().length < 3) {
            toast.error("Give the reason for reversing it");
            return;
        }
        setBusy(true);
        try {
            const v = await ecFeesService.reverseDeposit(deposit.id, reason.trim());
            toast.success(`Payment of ${ecRs(deposit.amount)} reversed`);
            onDone(v);
        } catch (err) {
            toast.error(ecErrMsg(err, "Couldn't reverse the payment"));
        } finally {
            setBusy(false);
        }
    };
    return (
        <EcModal
            open
            title={`Reverse ${ecRs(deposit.amount)} on ${voucher.voucher_number}?`}
            subtitle={`Paid ${ecDate(deposit.deposit_date)} · ${formatPaymentMethod(deposit.payment_method)}${deposit.reference_number ? ` · Ref ${deposit.reference_number}` : ""}`}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className={ecSecondaryButton} onClick={onClose} disabled={busy}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className={ecPrimaryButton.replace("bg-orange-600", "bg-rose-600").replace("hover:bg-orange-700", "hover:bg-rose-700")}
                        onClick={submit}
                        disabled={busy}
                    >
                        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Reverse payment
                    </button>
                </>
            }
        >
            <p className="text-sm text-zinc-600 dark:text-zinc-300">Only the latest payment on a voucher can be reversed. The voucher&apos;s balance is worked out again from the payments that remain.</p>
            <EcField label="Reason" htmlFor="ec-rev-reason" hint="Kept in the activity log with the full payment.">
                <textarea id="ec-rev-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} className={`${ecInputClass} h-auto py-3`} />
            </EcField>
        </EcModal>
    );
}
