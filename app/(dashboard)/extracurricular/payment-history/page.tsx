"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarRange, CircleDot, History, Loader2, RotateCcw, Undo2 } from "lucide-react";
import toast from "react-hot-toast";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { toggleId } from "@/components/filters/filter-params";
import { ecFeesService } from "@/lib/ec-fees.service";
import {
    EC_VOUCHER_STATES,
    EC_VOUCHER_STATE_LABEL,
    ecDate,
    ecErrMsg,
    ecRs,
    type EcDeposit,
    type EcStudentVouchers,
    type EcVoucherDetail,
    type EcVoucherState,
} from "@/lib/ec-fees.types";
import { formatPaymentMethod } from "@/lib/payment-methods";
import { EC_TILES, useExtracurricularAccess } from "@/hooks/use-extracurricular-access";
import { parseList, useUrlSync } from "@/features/extracurricular/url-state";
import { EcPageFallback, EcPageHeader, EcStat } from "@/features/extracurricular/ui";
import { EcStudentPicker, type EcPickedStudent } from "@/features/extracurricular/EcStudentPicker";
import { EcStateBadge, EcVoucherDrawer } from "@/features/extracurricular/EcVoucherBits";
import { EcReverseDialog, EcVoucherActionButtons } from "@/features/extracurricular/EcVoucherActions";

/**
 * TAFSD-605: Extracurricular Fees → Payment History, the EC twin of
 * /payment-history. One student's whole extracurricular story: what was
 * billed, received, waived, still open, lapsed (expired, not reissued) and not
 * yet put on a voucher. Older unpaid vouchers are listed here, never added to
 * a new one.
 */
export default function EcPaymentHistoryPage() {
    return (
        <Suspense fallback={<EcPageFallback />}>
            <EcPaymentHistoryInner />
        </Suspense>
    );
}

function EcPaymentHistoryInner() {
    const access = useExtracurricularAccess(EC_TILES.paymentHistory);
    const params = useSearchParams();
    const [cc, setCc] = useState<number | null>(Number(params.get("student")) || null);
    const [picked, setPicked] = useState<EcPickedStudent | null>(null);
    const [years, setYears] = useState<string[]>((params.get("years") ?? "").split(",").filter((y) => /^\d{4}-\d{4}$/.test(y)));
    const [states, setStates] = useState<EcVoucherState[]>(parseList(params.get("state"), EC_VOUCHER_STATES));
    useUrlSync({ student: cc ?? undefined, years, state: states });

    const [data, setData] = useState<EcStudentVouchers | null>(null);
    const [loading, setLoading] = useState(false);
    const [openId, setOpenId] = useState<number | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [reversing, setReversing] = useState<{ voucher: EcVoucherDetail; deposit: EcDeposit } | null>(null);

    const load = useCallback(async (studentCc: number) => {
        setLoading(true);
        try {
            const res = await ecFeesService.studentVouchers(studentCc);
            setData(res);
            setPicked((p) =>
                p?.cc === res.student.cc
                    ? p
                    : { cc: res.student.cc, full_name: res.student.full_name, gr_number: res.student.gr_number, class_name: res.student.class_name, section_name: res.student.section_name, campus_name: res.student.campus_name },
            );
        } catch (err) {
            toast.error(ecErrMsg(err, "Couldn't load the payment history"));
            setData(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (cc) void load(cc);
    }, [cc, load]);

    const vouchers = useMemo(() => data?.vouchers ?? [], [data]);
    const yearOptions = useMemo(() => [...new Set(vouchers.map((v) => v.academic_year))].sort().reverse(), [vouchers]);
    // One student's complete set is already here; the filters narrow what is shown.
    const shown = vouchers.filter((v) => (!years.length || years.includes(v.academic_year)) && (!states.length || states.includes(v.state)));
    const payments = useMemo(
        () =>
            shown
                .flatMap((v) => v.deposits.map((d) => ({ voucher: v, deposit: d })))
                .sort((a, b) => b.deposit.deposit_date.localeCompare(a.deposit.deposit_date) || b.deposit.id - a.deposit.id),
        [shown],
    );
    const filtersActive = years.length > 0 || states.length > 0;

    const afterChange = async () => {
        setRefreshKey((k) => k + 1);
        if (cc) await load(cc);
    };

    return (
        <div className="space-y-6 pb-12">
            <EcPageHeader
                icon={History}
                title="Payment History"
                description="Everything one student has been billed for extracurricular heads, and what came of it. Older unpaid vouchers stay listed here; they are never added to a newer voucher."
            />

            <div className="max-w-2xl">
                <EcStudentPicker
                    value={picked}
                    onChange={(s) => {
                        setPicked(s);
                        setCc(s?.cc ?? null);
                        if (!s) setData(null);
                    }}
                />
            </div>

            {cc && loading && !data && (
                <div className="py-10 text-center text-zinc-400">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                </div>
            )}

            {data && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                        <EcStat label="Billed" value={ecRs(data.stats.billed)} />
                        <EcStat label="Received" value={ecRs(data.stats.received)} />
                        <EcStat label="Waived" value={ecRs(data.stats.waived)} />
                        <EcStat label="Open" value={ecRs(data.stats.open_balance)} accent hint="on valid vouchers" />
                        <EcStat label="Lapsed" value={ecRs(data.stats.lapsed_balance)} hint="expired, not reissued" />
                        <EcStat label="Not yet issued" value={ecRs(data.stats.unissued)} />
                    </div>

                    <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
                        <div className="w-full lg:w-56">
                            <FilterDropdown<string> label="Academic year" icon={CalendarRange} value={years} options={yearOptions.map((y) => ({ id: y, label: y }))} placeholder="All years" onToggle={(id) => setYears((p) => toggleId(p, id))} onClear={() => setYears([])} onSetValue={setYears} />
                        </div>
                        <div className="w-full lg:w-56">
                            <FilterDropdown<EcVoucherState> label="State" icon={CircleDot} value={states} options={EC_VOUCHER_STATES.map((s) => ({ id: s, label: EC_VOUCHER_STATE_LABEL[s] }))} placeholder="Any state" onToggle={(id) => setStates((p) => toggleId(p, id))} onClear={() => setStates([])} onSetValue={setStates} />
                        </div>
                        {filtersActive && (
                            <button
                                type="button"
                                onClick={() => {
                                    setYears([]);
                                    setStates([]);
                                }}
                                className="h-11 px-3 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-1"
                            >
                                <RotateCcw className="h-4 w-4" /> Clear filters
                            </button>
                        )}
                    </div>

                    <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
                        <h2 className="px-5 py-4 font-black text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-900">Vouchers</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-900">
                                        <th className="py-2.5 px-4 font-medium">Voucher</th>
                                        <th className="py-2.5 px-2 font-medium">For</th>
                                        <th className="py-2.5 px-2 font-medium">Issued</th>
                                        <th className="py-2.5 px-2 font-medium">Valid till</th>
                                        <th className="py-2.5 px-2 font-medium">State</th>
                                        <th className="py-2.5 px-2 font-medium text-right">Total (Rs)</th>
                                        <th className="py-2.5 px-2 font-medium text-right">Received (Rs)</th>
                                        <th className="py-2.5 px-4 font-medium text-right">Balance (Rs)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {shown.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="py-10 text-center text-zinc-400">
                                                {vouchers.length === 0 ? "No extracurricular vouchers for this student yet." : "No voucher matches these filters."}
                                            </td>
                                        </tr>
                                    ) : (
                                        shown.map((v) => (
                                            <tr key={v.id} className="border-b border-zinc-50 dark:border-zinc-900/60 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
                                                <td className="py-2.5 px-4">
                                                    <button type="button" onClick={() => setOpenId(v.id)} className="font-semibold text-orange-600 hover:underline">
                                                        {v.voucher_number}
                                                    </button>
                                                    <div className="text-[11px] text-zinc-400">{v.academic_year}</div>
                                                </td>
                                                <td className="py-2.5 px-2 text-xs text-zinc-600 dark:text-zinc-300 max-w-xs">{v.lines.map((l) => l.description).join(" · ")}</td>
                                                <td className="py-2.5 px-2 whitespace-nowrap">{ecDate(v.issue_date)}</td>
                                                <td className={`py-2.5 px-2 whitespace-nowrap ${v.state === "EXPIRED" ? "text-rose-600 font-medium" : ""}`}>{ecDate(v.expiry_date)}</td>
                                                <td className="py-2.5 px-2">
                                                    <EcStateBadge state={v.state} />
                                                    {v.reissued_to && <div className="text-[11px] text-zinc-400 mt-0.5">→ {v.reissued_to.voucher_number}</div>}
                                                    {v.reissued_from && <div className="text-[11px] text-zinc-400 mt-0.5">from {v.reissued_from.voucher_number}</div>}
                                                </td>
                                                <td className="py-2.5 px-2 text-right tabular-nums">{v.total_amount.toLocaleString("en-PK")}</td>
                                                <td className="py-2.5 px-2 text-right tabular-nums">{v.amount_paid.toLocaleString("en-PK")}</td>
                                                <td className="py-2.5 px-4 text-right tabular-nums font-semibold">{v.state === "REISSUED" ? <span className="text-zinc-400 font-normal">moved</span> : v.balance.toLocaleString("en-PK")}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
                        <h2 className="px-5 py-4 font-black text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-900">Payments</h2>
                        {payments.length === 0 ? (
                            <p className="py-8 text-center text-sm text-zinc-400">No payment recorded{filtersActive ? " for these vouchers" : ""}.</p>
                        ) : (
                            <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
                                {payments.map(({ voucher, deposit }) => {
                                    const canReverse = access.can("reverse") && deposit.is_latest && voucher.state !== "REISSUED" && voucher.state !== "WAIVED";
                                    return (
                                        <li key={deposit.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <div className="font-semibold">
                                                    {ecRs(deposit.amount)} <span className="font-normal text-zinc-500">on {voucher.voucher_number}</span>
                                                </div>
                                                <div className="text-xs text-zinc-500">
                                                    Paid {ecDate(deposit.deposit_date)} · {formatPaymentMethod(deposit.payment_method)}
                                                    {deposit.reference_number ? ` · Ref ${deposit.reference_number}` : ""}
                                                    {deposit.bank_name ? ` · ${deposit.bank_name}` : ""}
                                                    {deposit.recorded_by_name ? ` · recorded by ${deposit.recorded_by_name}` : ""}
                                                </div>
                                                {deposit.remarks && <div className="text-xs text-zinc-400">{deposit.remarks}</div>}
                                            </div>
                                            {canReverse && (
                                                <button
                                                    type="button"
                                                    onClick={() => setReversing({ voucher, deposit })}
                                                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-semibold border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/30"
                                                >
                                                    <Undo2 className="h-4 w-4" /> Reverse
                                                </button>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>

                    {data.unissued_charges.length > 0 && (
                        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
                            <h2 className="font-black text-zinc-900 dark:text-zinc-100 mb-2">Charged but not yet on a voucher</h2>
                            <ul className="text-sm space-y-1">
                                {data.unissued_charges.map((c) => (
                                    <li key={c.id} className="flex justify-between gap-3">
                                        <span>
                                            {c.fee_head_name} ({c.period_label}) <span className="text-zinc-400">· {c.academic_year}</span>
                                        </span>
                                        <span className="tabular-nums">{ecRs(c.amount)}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </>
            )}

            <EcVoucherDrawer
                voucherId={openId}
                refreshKey={refreshKey}
                onClose={() => setOpenId(null)}
                onOpenVoucher={setOpenId}
                canDownload
                actions={(v) => (
                    <EcVoucherActionButtons
                        voucher={v}
                        onChanged={async (next) => {
                            setOpenId(next.id);
                            await afterChange();
                        }}
                    />
                )}
            />

            {reversing && (
                <EcReverseDialog
                    voucher={reversing.voucher}
                    deposit={reversing.deposit}
                    onClose={() => setReversing(null)}
                    onDone={async () => {
                        setReversing(null);
                        await afterChange();
                    }}
                />
            )}
        </div>
    );
}
