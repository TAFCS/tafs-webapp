"use client";

/**
 * ============================================================================
 * SHARED VOUCHER-ISSUANCE SETTINGS FORM
 * ----------------------------------------------------------------------------
 * ONE component, used by BOTH voucher-generation entry points:
 *
 *   1. /fee-challan  (single voucher issuance)            — app/(dashboard)/fee-challan/page.tsx
 *   2. Voucher split modals (balance / unpaid voucher)    — app/(dashboard)/vouchers/page.tsx
 *                                                          — app/(dashboard)/vouchers/deposit/page.tsx
 *
 * WHY THIS EXISTS: the split flow must offer the exact same knobs as single
 * issuance (bank, dates, late fee + amount, waive surcharge, parent
 * notification, hold-for-release, reprint fee). Keeping them in one component
 * means the two screens can never drift apart.
 *
 * >>> IF YOU ADD / REMOVE / RENAME A SETTING HERE <<<
 * You MUST mirror it in ALL of these, or one of the two flows will silently
 * ignore it:
 *   • VoucherSettings type + defaultVoucherSettings() (this file)
 *   • tafs-backend  create-voucher.dto.ts             (single issuance contract)
 *   • tafs-backend  split-partially-paid.dto.ts       (split contract)
 *   • tafs-backend  VouchersService.create()          (applies to a fresh voucher)
 *   • tafs-backend  VouchersService.splitPartiallyPaid()  (applies to the balance voucher)
 *   • the FormData / JSON body built on /fee-challan and in both split modals
 * ============================================================================
 */

import { Bell, Building2, Calendar, FileText, Info, Lock, AlertCircle, Printer } from "lucide-react";
import type { BankAccount } from "@/lib/bank-accounts.service";

export type BalanceDisposition =
    | "ISSUE_AND_NOTIFY"
    | "ISSUE_AND_RELEASE"
    | "ISSUE_AND_HOLD"
    | "DO_NOT_ISSUE";

export interface VoucherSettings {
    bankAccountId: number | null;
    issueDate: string;
    dueDate: string;
    validityDate: string;
    applyLateFee: boolean;
    lateFeeAmount: number;
    waiveSurcharge: boolean;
    /** Instant "voucher issued" push at generation/release time. */
    sendNotification: boolean;
    /** Create held (invisible to parents) until an admin releases it. */
    holdForRelease: boolean;
    applyReprintFee: boolean;
    reprintFeeAmount: number;
    /**
     * Split-only: what to do with the balance (unpaid) half. Ignored by single
     * issuance. When present, it is the source of truth for sendNotification /
     * holdForRelease (the panel keeps them in sync).
     */
    balanceDisposition: BalanceDisposition;
}

export function defaultVoucherSettings(
    overrides: Partial<VoucherSettings> = {},
): VoucherSettings {
    return {
        bankAccountId: null,
        issueDate: new Date().toISOString().split("T")[0],
        dueDate: "",
        validityDate: "",
        applyLateFee: true,
        lateFeeAmount: 1000,
        waiveSurcharge: false,
        sendNotification: true,
        holdForRelease: false,
        applyReprintFee: false,
        reprintFeeAmount: 100,
        balanceDisposition: "ISSUE_AND_NOTIFY",
        ...overrides,
    };
}

/**
 * Translate the split's 4-way disposition into the two underlying flags so the
 * rest of the app (and the backend fallback) stay consistent.
 */
export function applyDisposition(
    s: VoucherSettings,
    disposition: BalanceDisposition,
): VoucherSettings {
    return {
        ...s,
        balanceDisposition: disposition,
        holdForRelease: disposition === "ISSUE_AND_HOLD",
        sendNotification: disposition === "ISSUE_AND_NOTIFY",
    };
}

const DISPOSITION_OPTIONS: {
    value: BalanceDisposition;
    label: string;
    hint: string;
}[] = [
    {
        value: "ISSUE_AND_NOTIFY",
        label: "Generate & notify parents",
        hint: "Balance voucher is created, visible to parents, and an app notification is sent now.",
    },
    {
        value: "ISSUE_AND_RELEASE",
        label: "Generate, don't notify",
        hint: "Balance voucher is created and visible to parents, but no notification is sent. Due / overdue reminders still go out on schedule.",
    },
    {
        value: "ISSUE_AND_HOLD",
        label: "Generate, hold for release",
        hint: "Balance voucher is created but stays invisible & silent until an admin releases it from the Pending Release page. The issued notification fires then.",
    },
    {
        value: "DO_NOT_ISSUE",
        label: "Don't issue the balance",
        hint: "The split still runs (paid receipt, fee split, original voided), but no balance voucher is created. The unpaid amount is left un-issued for a later voucher run.",
    },
];

interface Props {
    value: VoucherSettings;
    onChange: (next: VoucherSettings) => void;
    banks: BankAccount[];
    /** "full" = /fee-challan Step 2 grid. "compact" = split modal. */
    variant?: "full" | "compact";
    /** Show the reprint-fee toggle (split modals: yes; /fee-challan handles its own in Step 3). */
    showReprintFee?: boolean;
    /** Show the split-only 4-way "what to do with the balance voucher" control. */
    showBalanceDisposition?: boolean;
    disabled?: boolean;
    /** Extra split-only controls (e.g. balance fee-date roll-forward) rendered at the end. */
    children?: React.ReactNode;
}

export default function VoucherSettingsPanel({
    value,
    onChange,
    banks,
    variant = "compact",
    showReprintFee = true,
    showBalanceDisposition = false,
    disabled = false,
    children,
}: Props) {
    const set = (patch: Partial<VoucherSettings>) => onChange({ ...value, ...patch });

    const doNotIssue =
        showBalanceDisposition && value.balanceDisposition === "DO_NOT_ISSUE";

    // When the disposition control is shown it subsumes the standalone
    // notify / hold toggles — hide those to avoid a contradictory UI.
    const showNotifyHoldToggles = !showBalanceDisposition;

    const sectionTitle = (icon: React.ReactNode, text: string) => (
        <div className="flex items-center gap-3">
            {icon}
            <h3 className="text-[12px] font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">
                {text}
            </h3>
        </div>
    );

    const gridClass =
        variant === "full"
            ? "grid grid-cols-1 xl:grid-cols-2 gap-10"
            : "grid grid-cols-1 gap-6";

    return (
        <div
            className={`space-y-8 ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        >
            {showBalanceDisposition && (
                <div className="space-y-3">
                    {sectionTitle(
                        <FileText className="h-4 w-4 text-primary" />,
                        "Balance Voucher",
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {DISPOSITION_OPTIONS.map((opt) => {
                            const active = value.balanceDisposition === opt.value;
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => onChange(applyDisposition(value, opt.value))}
                                    className={`text-left p-3.5 rounded-2xl border transition-all ${
                                        active
                                            ? "border-primary bg-primary/5 ring-2 ring-primary/15"
                                            : "border-zinc-200 dark:border-zinc-800 hover:border-primary/40"
                                    }`}
                                >
                                    <span
                                        className={`block text-[12px] font-black uppercase tracking-wide ${
                                            active ? "text-primary" : "text-zinc-700 dark:text-zinc-300"
                                        }`}
                                    >
                                        {opt.label}
                                    </span>
                                    <span className="block text-[11px] font-medium text-zinc-500 mt-1 leading-snug">
                                        {opt.hint}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className={gridClass}>
                {/* Collection bank */}
                <div className="space-y-3">
                    {sectionTitle(
                        <Building2 className="h-4 w-4 text-primary" />,
                        "Collection Bank",
                    )}
                    <select
                        value={value.bankAccountId ?? ""}
                        onChange={(e) =>
                            set({ bankAccountId: e.target.value ? Number(e.target.value) : null })
                        }
                        className="w-full h-12 px-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[13px] font-bold focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                    >
                        <option value="">Select bank account…</option>
                        {banks.map((b) => (
                            <option key={b.id} value={b.id}>
                                {b.bank_name} — {b.account_title} ({b.account_number})
                            </option>
                        ))}
                    </select>
                </div>

                {/* Timeline */}
                <div className="space-y-3">
                    {sectionTitle(
                        <Calendar className="h-4 w-4 text-primary" />,
                        "Voucher Timeline",
                    )}
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { key: "issueDate" as const, label: "Issue" },
                            { key: "dueDate" as const, label: "Due" },
                            { key: "validityDate" as const, label: "Valid Till" },
                        ].map((f) => (
                            <div key={f.key} className="space-y-1.5">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-0.5">
                                    {f.label}
                                </label>
                                <input
                                    type="date"
                                    value={value[f.key]}
                                    disabled={doNotIssue}
                                    onChange={(e) => set({ [f.key]: e.target.value } as Partial<VoucherSettings>)}
                                    className={`w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl text-[12px] font-black focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all disabled:opacity-40 ${
                                        f.key === "validityDate" ? "text-rose-600" : ""
                                    }`}
                                />
                            </div>
                        ))}
                    </div>
                    {doNotIssue && (
                        <p className="text-[11px] font-medium text-zinc-500 ml-0.5">
                            No balance voucher is issued, so these dates are unused.
                        </p>
                    )}
                </div>

                {/* Late surcharge */}
                <div className="space-y-3">
                    {sectionTitle(
                        <AlertCircle className="h-4 w-4 text-rose-500" />,
                        "Due-Date Late Fee",
                    )}
                    <div className="flex items-center gap-3 bg-zinc-100/50 dark:bg-zinc-900/50 p-1.5 rounded-[18px] border border-zinc-200/50">
                        <button
                            type="button"
                            onClick={() => set({ applyLateFee: true })}
                            className={`flex-1 h-9 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                                value.applyLateFee ? "bg-white dark:bg-zinc-800 text-rose-600 shadow" : "text-zinc-400"
                            }`}
                        >
                            Apply
                        </button>
                        <button
                            type="button"
                            onClick={() => set({ applyLateFee: false })}
                            className={`flex-1 h-9 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                                !value.applyLateFee ? "bg-white dark:bg-zinc-800 text-zinc-500 shadow" : "text-zinc-400"
                            }`}
                        >
                            None
                        </button>
                    </div>
                    {value.applyLateFee && (
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-0.5">
                                Amount (PKR)
                            </label>
                            <input
                                type="number"
                                value={value.lateFeeAmount}
                                onChange={(e) => set({ lateFeeAmount: Number(e.target.value) })}
                                className="w-full h-11 px-4 bg-rose-50/50 dark:bg-rose-950/20 border-2 border-rose-100 dark:border-rose-900/40 rounded-xl text-[13px] font-black text-rose-600"
                            />
                        </div>
                    )}
                </div>

                {/* Waive arrear surcharge */}
                <div className="space-y-3">
                    {sectionTitle(
                        <Info className="h-4 w-4 text-emerald-500" />,
                        "Arrear Late-Payment Surcharge",
                    )}
                    <div className="flex items-center gap-3 bg-zinc-100/50 dark:bg-zinc-900/50 p-1.5 rounded-[18px] border border-zinc-200/50">
                        <button
                            type="button"
                            onClick={() => set({ waiveSurcharge: false })}
                            className={`flex-1 h-9 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                                !value.waiveSurcharge ? "bg-white dark:bg-zinc-800 text-emerald-600 shadow" : "text-zinc-400"
                            }`}
                        >
                            Charge
                        </button>
                        <button
                            type="button"
                            onClick={() => set({ waiveSurcharge: true })}
                            className={`flex-1 h-9 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                                value.waiveSurcharge ? "bg-white dark:bg-zinc-800 text-emerald-600 shadow" : "text-zinc-400"
                            }`}
                        >
                            Waive
                        </button>
                    </div>
                    <p className="text-[11px] font-medium text-zinc-500 ml-0.5">
                        {value.waiveSurcharge
                            ? "Every Rs. 1,000 late-payment surcharge on the arrears is forgiven on this voucher."
                            : "Arrear months keep their Rs. 1,000 late-payment surcharge."}
                    </p>
                </div>

                {showNotifyHoldToggles && (
                    <>
                        <div className="space-y-3">
                            {sectionTitle(
                                <Bell className="h-4 w-4 text-primary" />,
                                "Parent Notification",
                            )}
                            <div
                                className={`flex items-center gap-3 bg-zinc-100/50 dark:bg-zinc-900/50 p-1.5 rounded-[18px] border border-zinc-200/50 ${
                                    value.holdForRelease ? "opacity-40 pointer-events-none" : ""
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => set({ sendNotification: true })}
                                    className={`flex-1 h-9 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                                        value.sendNotification ? "bg-white dark:bg-zinc-800 text-primary shadow" : "text-zinc-400"
                                    }`}
                                >
                                    Notify Now
                                </button>
                                <button
                                    type="button"
                                    onClick={() => set({ sendNotification: false })}
                                    className={`flex-1 h-9 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                                        !value.sendNotification ? "bg-white dark:bg-zinc-800 text-zinc-500 shadow" : "text-zinc-400"
                                    }`}
                                >
                                    Don&apos;t Notify
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {sectionTitle(
                                <Lock className="h-4 w-4 text-amber-500" />,
                                "Hold for Release",
                            )}
                            <div className="flex items-center gap-3 bg-zinc-100/50 dark:bg-zinc-900/50 p-1.5 rounded-[18px] border border-zinc-200/50">
                                <button
                                    type="button"
                                    onClick={() => set({ holdForRelease: false })}
                                    className={`flex-1 h-9 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                                        !value.holdForRelease ? "bg-white dark:bg-zinc-800 text-emerald-600 shadow" : "text-zinc-400"
                                    }`}
                                >
                                    Release Now
                                </button>
                                <button
                                    type="button"
                                    onClick={() => set({ holdForRelease: true })}
                                    className={`flex-1 h-9 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                                        value.holdForRelease ? "bg-white dark:bg-zinc-800 text-amber-600 shadow" : "text-zinc-400"
                                    }`}
                                >
                                    Hold
                                </button>
                            </div>
                            <p className="text-[11px] font-medium text-zinc-500 ml-0.5">
                                {value.holdForRelease
                                    ? "Created in the system but invisible to parents until an admin releases it."
                                    : "Visible to parents immediately after generation."}
                            </p>
                        </div>
                    </>
                )}

                {showReprintFee && (
                    <div className="space-y-3">
                        {sectionTitle(
                            <Printer className="h-4 w-4 text-zinc-500" />,
                            "Reprint Fee",
                        )}
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={value.applyReprintFee}
                                disabled={doNotIssue}
                                onChange={(e) =>
                                    set({
                                        applyReprintFee: e.target.checked,
                                        reprintFeeAmount: value.reprintFeeAmount || 100,
                                    })
                                }
                                className="h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary/20 cursor-pointer"
                            />
                            <span className="text-[11px] font-black text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">
                                Add reprint fee
                            </span>
                        </label>
                        {value.applyReprintFee && !doNotIssue && (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-0.5">
                                    Amount (PKR)
                                </label>
                                <input
                                    type="number"
                                    value={value.reprintFeeAmount}
                                    onChange={(e) => set({ reprintFeeAmount: Number(e.target.value) })}
                                    className="w-40 h-11 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-[13px] font-black text-zinc-700 dark:text-zinc-300"
                                    placeholder="100"
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {children}
        </div>
    );
}
