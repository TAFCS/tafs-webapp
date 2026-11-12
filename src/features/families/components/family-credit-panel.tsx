"use client";

/**
 * Family credit (TAFSD-421): money a family has paid beyond its vouchers, which
 * a sibling's voucher can use. The balance and ledger come from the backend;
 * nothing is worked out here. Both views stay hidden for anyone who may not see
 * them, because the endpoint refuses and that is the real boundary.
 */

import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { useFamilyCreditAccess } from "@/hooks/use-family-credit-access";

type LedgerEntry = {
    id: number;
    amount: number;
    kind: string;
    student_name: string | null;
    voucher_id: number | null;
    deposit_id: number | null;
    notes: string | null;
    created_by: string | null;
    created_at: string;
};

type Ledger = { family_id: number; balance: number; entries: LedgerEntry[] };

const KIND_LABELS: Record<string, string> = {
    EXCESS_DEPOSIT: "Excess payment kept",
    APPLIED_TO_VOUCHER: "Used on a voucher",
    EXCESS_REVERSED: "Excess payment reversed",
    APPLICATION_REVERSED: "Voucher payment reversed",
    // TAFSD-504: entries made on Finance → Family Credit.
    MANUAL_CREDIT: "Credit added",
    MANUAL_DEBIT: "Credit deducted",
    REFUNDED: "Refunded to family",
    TRANSFER_OUT: "Moved to another family",
    TRANSFER_IN: "Moved in from another family",
    ENTRY_REVERSED: "Entry undone",
};

const formatRs = (value: number) => `Rs. ${Math.abs(value).toLocaleString()}`;

function useFamilyCredit(familyId: number | null | undefined) {
    const [ledger, setLedger] = useState<Ledger | null>(null);

    useEffect(() => {
        if (!familyId) return;
        let cancelled = false;
        api.get(`/v1/vouchers/family-credit/${familyId}`)
            .then(({ data }) => {
                if (!cancelled) setLedger(data?.data ?? null);
            })
            .catch(() => {
                // No access, or the request failed: show nothing rather than a false zero.
            });
        return () => {
            cancelled = true;
        };
    }, [familyId]);

    // Ignore a balance still held from a previously opened family.
    return ledger?.family_id === familyId ? ledger : null;
}

/** Family screen: the balance and every ledger entry, newest first. */
export function FamilyCreditSection({ familyId }: { familyId: number }) {
    const ledger = useFamilyCredit(familyId);
    const familyCredit = useFamilyCreditAccess();
    if (!ledger) return null;

    return (
        <div className="bg-zinc-50 dark:bg-zinc-900/50 shadow-sm rounded-xl p-5">
            <div className="flex items-center justify-between gap-4 mb-4">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-emerald-500" /> Family Credit
                </h3>
                <span className="flex items-center gap-3">
                    {familyCredit.hasTile && (
                        <Link href={`/family-credit?family=${familyId}`} className="text-xs font-semibold text-primary hover:underline">
                            Manage
                        </Link>
                    )}
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                        {formatRs(ledger.balance)} available
                    </span>
                </span>
            </div>
            {ledger.entries.length === 0 ? (
                <p className="text-sm text-zinc-400 italic">No credit recorded for this family.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                                <th className="py-2 pr-4 font-medium">Date</th>
                                <th className="py-2 pr-4 font-medium">What happened</th>
                                <th className="py-2 pr-4 font-medium">Student</th>
                                <th className="py-2 pr-4 font-medium">Voucher</th>
                                <th className="py-2 pr-4 font-medium">By</th>
                                <th className="py-2 font-medium text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ledger.entries.map((entry) => (
                                <tr key={entry.id} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
                                    <td className="py-2 pr-4 whitespace-nowrap text-zinc-500">
                                        {new Date(entry.created_at).toLocaleDateString("en-GB")}
                                    </td>
                                    <td className="py-2 pr-4 text-zinc-900 dark:text-zinc-100">
                                        {KIND_LABELS[entry.kind] ?? entry.kind}
                                    </td>
                                    <td className="py-2 pr-4 text-zinc-500">{entry.student_name ?? "—"}</td>
                                    <td className="py-2 pr-4 text-zinc-500">{entry.voucher_id ? `#${entry.voucher_id}` : "—"}</td>
                                    <td className="py-2 pr-4 text-zinc-500">{entry.created_by ?? "—"}</td>
                                    <td
                                        className={`py-2 text-right font-semibold tabular-nums ${
                                            entry.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-300"
                                        }`}
                                    >
                                        {entry.amount >= 0 ? "+" : "−"}
                                        {formatRs(entry.amount)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

/** Student screen: the balance only, full ledger on the family screen. */
export function FamilyCreditTile({ familyId }: { familyId: number | null | undefined }) {
    const ledger = useFamilyCredit(familyId);
    if (!ledger) return null;

    return (
        <div className="bg-white dark:bg-zinc-950 border rounded-lg p-4 col-span-2">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Family Credit</p>
            <p className={`text-xl font-bold mt-1 ${ledger.balance > 0 ? "text-emerald-600" : "text-zinc-900 dark:text-zinc-100"}`}>
                {formatRs(ledger.balance)}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Shared across this family. Can be used on any sibling&apos;s voucher.
            </p>
        </div>
    );
}
