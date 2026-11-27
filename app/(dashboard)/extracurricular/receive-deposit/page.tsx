"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, FileText, HandCoins, Hash, Loader2, Search, UserCircle } from "lucide-react";
import toast from "react-hot-toast";
import { ecFeesService } from "@/lib/ec-fees.service";
import { ecDate, ecErrMsg, ecRs, type EcStudentVouchers, type EcVoucherDetail, type EcVoucherSearchHit } from "@/lib/ec-fees.types";
import { EC_TILES, useExtracurricularAccess } from "@/hooks/use-extracurricular-access";
import { useDebounced, useUrlSync } from "@/features/extracurricular/url-state";
import { EcField, EcPageFallback, EcPageHeader, ecInputClass } from "@/features/extracurricular/ui";
import { EcStudentPicker, type EcPickedStudent } from "@/features/extracurricular/EcStudentPicker";
import { EcStateBadge, EcVoucherDrawer, useEcPdfDownload } from "@/features/extracurricular/EcVoucherBits";
import { EcDepositModal, EcVoucherActionButtons, ecCanTakePayment } from "@/features/extracurricular/EcVoucherActions";

/**
 * TAFSD-605: Extracurricular Fees → Receive Deposit, the EC twin of
 * /vouchers/deposit. Find a student or a voucher number, then record a full or
 * partial payment, dated the day it was paid. There is no excess and no family
 * credit; an expired voucher takes only a payment dated on or before its
 * valid-till day.
 */
export default function EcReceiveDepositPage() {
    return (
        <Suspense fallback={<EcPageFallback />}>
            <EcReceiveDepositInner />
        </Suspense>
    );
}

function EcReceiveDepositInner() {
    const access = useExtracurricularAccess(EC_TILES.receiveDeposit);
    const params = useSearchParams();
    const [mode, setMode] = useState<"student" | "voucher">(params.get("by") === "voucher" ? "voucher" : "student");
    const [cc, setCc] = useState<number | null>(Number(params.get("student")) || null);
    const [picked, setPicked] = useState<EcPickedStudent | null>(null);
    const [highlight, setHighlight] = useState<number | null>(Number(params.get("voucher")) || null);
    useUrlSync({ by: mode === "voucher" ? "voucher" : undefined, student: cc ?? undefined, voucher: highlight ?? undefined });

    const [data, setData] = useState<EcStudentVouchers | null>(null);
    const [loading, setLoading] = useState(false);
    const [paying, setPaying] = useState<EcVoucherDetail | null>(null);
    const [openId, setOpenId] = useState<number | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const pdf = useEcPdfDownload();

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
            toast.error(ecErrMsg(err, "Couldn't load the student's vouchers"));
            setData(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (cc) void load(cc);
    }, [cc, load]);

    const pickStudent = (s: EcPickedStudent | null) => {
        setPicked(s);
        setCc(s?.cc ?? null);
        setHighlight(null);
        if (!s) setData(null);
    };

    const vouchers = data?.vouchers ?? [];
    const payable = vouchers.filter(ecCanTakePayment);
    const others = vouchers.filter((v) => !ecCanTakePayment(v));
    const afterChange = async () => {
        setRefreshKey((k) => k + 1);
        if (cc) await load(cc);
    };

    return (
        <div className="space-y-6 pb-12">
            <EcPageHeader
                icon={HandCoins}
                title="Receive Deposit"
                description="Record money received against an extracurricular voucher, in full or in part, dated the day it was paid. These vouchers take no excess and are never paid from family credit or 1Bill."
            />

            <div className="flex gap-1.5" role="tablist" aria-label="Find by">
                {(
                    [
                        ["student", "By student", UserCircle],
                        ["voucher", "By voucher number", Hash],
                    ] as const
                ).map(([m, label, Icon]) => (
                    <button
                        key={m}
                        type="button"
                        role="tab"
                        aria-selected={mode === m}
                        onClick={() => setMode(m)}
                        className={`h-9 px-3.5 rounded-xl text-sm font-semibold border inline-flex items-center gap-1.5 ${
                            mode === m ? "bg-orange-600 border-orange-600 text-white" : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300"
                        }`}
                    >
                        <Icon className="h-4 w-4" /> {label}
                    </button>
                ))}
            </div>

            <div className="max-w-2xl">
                {mode === "student" ? (
                    <EcStudentPicker value={picked} onChange={pickStudent} />
                ) : (
                    <VoucherFinder
                        onPick={(hit) => {
                            setHighlight(hit.id);
                            setCc(hit.student_id);
                            setPicked(null);
                        }}
                    />
                )}
            </div>

            {cc && loading && !data && (
                <div className="py-10 text-center text-zinc-400">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                </div>
            )}

            {data && (
                <div className="space-y-6">
                    {mode === "voucher" && picked && (
                        <p className="text-sm text-zinc-600 dark:text-zinc-300">
                            {picked.full_name} · C.C. {picked.cc}
                            {picked.class_name ? ` · ${picked.class_name}` : ""}
                        </p>
                    )}
                    <section className="space-y-3">
                        <h2 className="font-black text-zinc-900 dark:text-zinc-100">Can take a payment</h2>
                        {payable.length === 0 ? (
                            <p className="text-sm text-zinc-500 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 px-4 py-6 text-center">
                                Nothing is open for this student. Issue a voucher on Single Voucher, or reissue an expired one.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                {payable.map((v) => (
                                    <VoucherCard key={v.id} v={v} highlighted={v.id === highlight} onOpen={() => setOpenId(v.id)} onDownload={() => pdf.download(v.id)} downloading={pdf.busyId === v.id}>
                                        {access.can("record") && (
                                            <button
                                                type="button"
                                                onClick={() => setPaying(v)}
                                                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-semibold bg-orange-600 text-white hover:bg-orange-700"
                                            >
                                                <HandCoins className="h-4 w-4" /> Record payment
                                            </button>
                                        )}
                                    </VoucherCard>
                                ))}
                            </div>
                        )}
                    </section>
                    {others.length > 0 && (
                        <section className="space-y-3">
                            <h2 className="font-black text-zinc-900 dark:text-zinc-100">Other vouchers</h2>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                {others.map((v) => (
                                    <VoucherCard key={v.id} v={v} highlighted={v.id === highlight} onOpen={() => setOpenId(v.id)} onDownload={() => pdf.download(v.id)} downloading={pdf.busyId === v.id}>
                                        <span className="text-xs text-zinc-500">
                                            {v.state === "REISSUED" && v.reissued_to
                                                ? `Reissued as ${v.reissued_to.voucher_number}: record payments there.`
                                                : v.state === "PAID"
                                                  ? "Paid in full."
                                                  : v.state === "WAIVED"
                                                    ? "Waived."
                                                    : ""}
                                        </span>
                                    </VoucherCard>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            )}

            {paying && (
                <EcDepositModal
                    voucher={paying}
                    onClose={() => setPaying(null)}
                    onDone={async (v) => {
                        setPaying(null);
                        setHighlight(v.id);
                        await afterChange();
                    }}
                />
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
        </div>
    );
}

function VoucherCard({
    v,
    highlighted,
    onOpen,
    onDownload,
    downloading,
    children,
}: {
    v: EcVoucherDetail;
    highlighted: boolean;
    onOpen: () => void;
    onDownload: () => void;
    downloading: boolean;
    children?: React.ReactNode;
}) {
    return (
        <div className={`rounded-2xl border bg-white dark:bg-zinc-950 p-4 space-y-3 ${highlighted ? "border-orange-400 ring-2 ring-orange-500/20" : "border-zinc-200 dark:border-zinc-800"}`}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <button type="button" onClick={onOpen} className="font-black text-zinc-900 dark:text-zinc-100 hover:text-orange-600 inline-flex items-center gap-1.5">
                        <FileText className="h-4 w-4 text-orange-500" /> {v.voucher_number}
                    </button>
                    <div className="text-xs text-zinc-500">
                        {v.academic_year} · issued {ecDate(v.issue_date)} · valid till{" "}
                        <span className={v.state === "EXPIRED" ? "text-rose-600 font-semibold" : ""}>{ecDate(v.expiry_date)}</span>
                    </div>
                </div>
                <EcStateBadge state={v.state} />
            </div>
            <div className="text-xs text-zinc-600 dark:text-zinc-300">{v.lines.map((l) => l.description).join(" · ")}</div>
            <div className="flex items-end justify-between gap-3">
                <div className="text-sm">
                    <span className="text-zinc-500">Total {ecRs(v.total_amount)} · received {ecRs(v.amount_paid)} · </span>
                    <span className="font-black text-orange-600">balance {ecRs(v.balance)}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={onDownload} disabled={downloading} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900" aria-label={`Download ${v.voucher_number}`}>
                        {downloading ? <Loader2 className="h-4 w-4 animate-spin text-zinc-400" /> : <Download className="h-4 w-4 text-zinc-500" />}
                    </button>
                    {children}
                </div>
            </div>
            {v.state === "EXPIRED" && (
                <p className="text-[11px] text-rose-600">Expired: only a payment made on or before {ecDate(v.expiry_date)} can be recorded. Otherwise reissue it.</p>
            )}
        </div>
    );
}

/** Find a voucher by number or student through the server (search-simple). */
function VoucherFinder({ onPick }: { onPick: (hit: EcVoucherSearchHit) => void }) {
    const [text, setText] = useState("");
    const q = useDebounced(text, 300);
    const [hits, setHits] = useState<EcVoucherSearchHit[]>([]);
    const [loading, setLoading] = useState(false);
    const reqId = useRef(0);

    useEffect(() => {
        if (!q.trim()) return;
        const id = ++reqId.current;
        ecFeesService
            .searchVouchers(q)
            .then((r) => id === reqId.current && setHits(r))
            .catch(() => id === reqId.current && setHits([]))
            .finally(() => id === reqId.current && setLoading(false));
    }, [q]);

    const typing = text.trim() !== q.trim();
    return (
        <EcField label="Voucher number" htmlFor="ec-find-voucher">
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input
                    id="ec-find-voucher"
                    value={text}
                    onChange={(e) => {
                        setText(e.target.value);
                        if (e.target.value.trim()) setLoading(true);
                    }}
                    placeholder="e.g. EC1126000042, or a student's name or C.C."
                    autoComplete="off"
                    className={`${ecInputClass} pl-11`}
                />
            </div>
            {text.trim() && (
                <div className="mt-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 max-h-72 overflow-y-auto">
                    {typing || loading ? (
                        <div className="px-4 py-3 text-sm text-zinc-400">Searching…</div>
                    ) : hits.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-zinc-400">No extracurricular voucher matches “{q.trim()}”.</div>
                    ) : (
                        hits.map((h) => (
                            <button
                                key={h.id}
                                type="button"
                                onClick={() => {
                                    onPick(h);
                                    setText("");
                                }}
                                className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-900 last:border-0 flex items-center justify-between gap-3"
                            >
                                <div>
                                    <div className="text-sm font-semibold">{h.voucher_number}</div>
                                    <div className="text-xs text-zinc-500">
                                        {h.full_name} · C.C. {h.student_id} · {h.class_name} · balance {ecRs(h.balance)}
                                    </div>
                                </div>
                                <EcStateBadge state={h.state} />
                            </button>
                        ))
                    )}
                </div>
            )}
        </EcField>
    );
}
