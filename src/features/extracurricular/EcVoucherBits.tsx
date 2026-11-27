"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Download, FileText, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import { ecDownload, ecFeesService } from "@/lib/ec-fees.service";
import { EC_VOUCHER_STATE_LABEL, ecDate, ecErrMsg, ecRs, type EcVoucherDetail, type EcVoucherState } from "@/lib/ec-fees.types";
import { formatPaymentMethod } from "@/lib/payment-methods";

const STATE_STYLE: Record<EcVoucherState, string> = {
    UNPAID: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900",
    PARTIALLY_PAID: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900",
    PAID: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900",
    WAIVED: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-300 dark:border-teal-900",
    EXPIRED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900",
    REISSUED: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800",
};

/** TAFSD-605: an extracurricular voucher's shown state. */
export function EcStateBadge({ state }: { state: EcVoucherState }) {
    return <span className={`inline-flex items-center text-[11px] font-semibold rounded-full px-2 py-0.5 border whitespace-nowrap ${STATE_STYLE[state]}`}>{EC_VOUCHER_STATE_LABEL[state]}</span>;
}

/** Fetch (rendering on first use) and download one challan. */
export function useEcPdfDownload() {
    const [busyId, setBusyId] = useState<number | null>(null);
    const download = async (id: number) => {
        setBusyId(id);
        try {
            const { url, filename } = await ecFeesService.voucherPdf(id);
            await ecDownload(url, filename);
        } catch (err) {
            toast.error(ecErrMsg(err, "Couldn't get the challan"));
        } finally {
            setBusyId(null);
        }
    };
    return { busyId, download };
}

/**
 * TAFSD-605: one extracurricular voucher in a side drawer: lines, payments and
 * the reissue chain. Pages add their own actions through `actions`.
 */
export function EcVoucherDrawer({
    voucherId,
    refreshKey,
    onClose,
    onOpenVoucher,
    actions,
    canDownload,
}: {
    voucherId: number | null;
    refreshKey?: number;
    onClose: () => void;
    onOpenVoucher?: (id: number) => void;
    actions?: (v: EcVoucherDetail) => ReactNode;
    canDownload: boolean;
}) {
    const [v, setV] = useState<EcVoucherDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const pdf = useEcPdfDownload();

    useEffect(() => {
        if (voucherId == null) return;
        let cancelled = false;
        setLoading(true);
        ecFeesService
            .voucher(voucherId)
            .then((d) => !cancelled && setV(d))
            .catch((err) => {
                if (!cancelled) {
                    toast.error(ecErrMsg(err, "Couldn't load the voucher"));
                    onClose();
                }
            })
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
        // onClose is stable enough for this purpose; reloading on it would loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [voucherId, refreshKey]);

    useEffect(() => {
        if (voucherId == null) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [voucherId, onClose]);

    if (voucherId == null || typeof document === "undefined") return null;
    const shown = v && v.id === voucherId ? v : null;

    return createPortal(
        <div className="fixed inset-0 z-[55] flex justify-end bg-zinc-950/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <aside role="dialog" aria-modal="true" className="w-full max-w-xl h-full bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col">
                <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-900 flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">Extracurricular voucher</p>
                        <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            {shown?.voucher_number ?? "…"} {shown && <EcStateBadge state={shown.state} />}
                        </h2>
                        {shown && (
                            <p className="text-xs text-zinc-500 mt-0.5">
                                {shown.student.full_name} · C.C. {shown.student.cc}
                                {shown.student.gr_number ? ` · G.R. ${shown.student.gr_number}` : ""} · {shown.class_name}
                                {shown.section_name ? ` ${shown.section_name}` : ""}
                            </p>
                        )}
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className="p-2 -m-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900">
                        <X className="h-5 w-5 text-zinc-400" />
                    </button>
                </div>

                {loading && !shown ? (
                    <div className="flex-1 flex items-center justify-center text-zinc-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                ) : shown ? (
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <Fact label="Issued" value={ecDate(shown.issue_date)} />
                            <Fact label="Valid till" value={ecDate(shown.expiry_date)} danger={shown.state === "EXPIRED"} />
                            <Fact label="Academic year" value={shown.academic_year} />
                            <Fact label="Campus" value={shown.campus_name} />
                        </div>

                        {(shown.reissued_from || shown.reissued_to) && (
                            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-xs text-zinc-600 dark:text-zinc-300 space-y-1">
                                {shown.reissued_from && (
                                    <div className="flex items-center gap-1.5">
                                        Reissued from
                                        <VoucherLink v={shown.reissued_from} onOpen={onOpenVoucher} />
                                    </div>
                                )}
                                {shown.reissued_to && (
                                    <div className="flex items-center gap-1.5">
                                        <ArrowRight className="h-3.5 w-3.5" /> Expired and reissued as
                                        <VoucherLink v={shown.reissued_to} onOpen={onOpenVoucher} />
                                    </div>
                                )}
                            </div>
                        )}

                        {shown.state === "WAIVED" && (
                            <div className="rounded-xl border border-teal-200 dark:border-teal-900 bg-teal-50/60 dark:bg-teal-950/20 px-4 py-3 text-xs text-teal-800 dark:text-teal-300">
                                Waived {shown.waived_at ? `on ${new Date(shown.waived_at).toLocaleDateString("en-GB")}` : ""}
                                {shown.waived_by ? ` by ${shown.waived_by}` : ""}
                                {shown.waive_reason ? `: ${shown.waive_reason}` : ""}
                            </div>
                        )}

                        <section>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 mb-2">Lines (Rs)</h3>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-zinc-500 border-b border-zinc-100 dark:border-zinc-900">
                                        <th className="py-1.5 font-medium">Description</th>
                                        <th className="py-1.5 font-medium text-right">Amount</th>
                                        <th className="py-1.5 font-medium text-right">Received</th>
                                        <th className="py-1.5 font-medium text-right">Left</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {shown.lines.map((l) => (
                                        <tr key={l.id} className="border-b border-zinc-50 dark:border-zinc-900/60">
                                            <td className="py-1.5">{l.description}</td>
                                            <td className="py-1.5 text-right tabular-nums">{l.amount.toLocaleString("en-PK")}</td>
                                            <td className="py-1.5 text-right tabular-nums">{l.amount_paid.toLocaleString("en-PK")}</td>
                                            <td className="py-1.5 text-right tabular-nums">
                                                {l.waived_amount > 0 ? <span className="text-teal-600">waived</span> : l.remaining.toLocaleString("en-PK")}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="font-semibold">
                                        <td className="py-2">Total</td>
                                        <td className="py-2 text-right tabular-nums">{ecRs(shown.total_amount)}</td>
                                        <td className="py-2 text-right tabular-nums">{ecRs(shown.amount_paid)}</td>
                                        <td className="py-2 text-right tabular-nums">{ecRs(shown.balance)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </section>

                        <section>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 mb-2">Payments</h3>
                            {shown.deposits.length === 0 ? (
                                <p className="text-xs text-zinc-400">No payment recorded.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {shown.deposits.map((d) => (
                                        <li key={d.id} className="rounded-xl border border-zinc-100 dark:border-zinc-900 px-3 py-2 flex items-center justify-between gap-3">
                                            <div>
                                                <div className="font-semibold">{ecRs(d.amount)}</div>
                                                <div className="text-xs text-zinc-500">
                                                    Paid {ecDate(d.deposit_date)} · {formatPaymentMethod(d.payment_method)}
                                                    {d.reference_number ? ` · Ref ${d.reference_number}` : ""}
                                                    {d.recorded_by_name ? ` · recorded by ${d.recorded_by_name}` : ""}
                                                </div>
                                            </div>
                                            {d.is_latest && <span className="text-[10px] text-zinc-400">latest</span>}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <div className="flex flex-wrap gap-2">
                            {canDownload && (
                                <button
                                    type="button"
                                    onClick={() => pdf.download(shown.id)}
                                    disabled={pdf.busyId === shown.id}
                                    className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-60"
                                >
                                    {pdf.busyId === shown.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                    {shown.state === "PAID" ? "Paid receipt" : "Challan"}
                                </button>
                            )}
                            {actions?.(shown)}
                        </div>
                    </div>
                ) : null}
            </aside>
        </div>,
        document.body,
    );
}

function Fact({ label, value, danger }: { label: string; value: ReactNode; danger?: boolean }) {
    return (
        <div>
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">{label}</div>
            <div className={`font-semibold ${danger ? "text-rose-600" : "text-zinc-800 dark:text-zinc-100"}`}>{value}</div>
        </div>
    );
}

function VoucherLink({ v, onOpen }: { v: { id: number; voucher_number: string | null }; onOpen?: (id: number) => void }) {
    if (!onOpen) return <span className="font-semibold">{v.voucher_number}</span>;
    return (
        <button type="button" onClick={() => onOpen(v.id)} className="font-semibold text-orange-600 hover:underline inline-flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" /> {v.voucher_number}
        </button>
    );
}
