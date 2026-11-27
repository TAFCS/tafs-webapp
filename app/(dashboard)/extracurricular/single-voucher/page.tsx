"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Download, Info, Loader2, Printer, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import { bankAccountsService, type BankAccount } from "@/lib/bank-accounts.service";
import { ecDownload, ecFeesService } from "@/lib/ec-fees.service";
import { ecAddDays, ecDate, ecErrMsg, ecRs, ecTodayKey, type EcIssuable, type EcVoucherDetail } from "@/lib/ec-fees.types";
import { EC_TILES, useExtracurricularAccess } from "@/hooks/use-extracurricular-access";
import { useUrlSync } from "@/features/extracurricular/url-state";
import { EcField, EcPageFallback, EcPageHeader, ecInputClass, ecPrimaryButton, ecSecondaryButton } from "@/features/extracurricular/ui";
import { EcStudentPicker, type EcPickedStudent } from "@/features/extracurricular/EcStudentPicker";
import { EcStateBadge } from "@/features/extracurricular/EcVoucherBits";

/**
 * TAFSD-605: Extracurricular Fees → Single Voucher, the EC twin of /fee-challan.
 * Picks a student's unissued charges (one academic year) onto one voucher with
 * an issue date and a valid-till date. Older open vouchers are shown beside it
 * and are NOT added: there are no arrears and nothing is voided.
 */
export default function EcSingleVoucherPage() {
    return (
        <Suspense fallback={<EcPageFallback />}>
            <EcSingleVoucherInner />
        </Suspense>
    );
}

function EcSingleVoucherInner() {
    const access = useExtracurricularAccess(EC_TILES.singleVoucher);
    const params = useSearchParams();
    const [cc, setCc] = useState<number | null>(Number(params.get("student")) || null);
    const [picked, setPicked] = useState<EcPickedStudent | null>(null);
    useUrlSync({ student: cc ?? undefined });

    const [data, setData] = useState<EcIssuable | null>(null);
    const [loading, setLoading] = useState(false);
    const [year, setYear] = useState<string | null>(null);
    const [selected, setSelected] = useState<number[]>([]);
    const [issueDate, setIssueDate] = useState(ecTodayKey());
    const [expiryDate, setExpiryDate] = useState(ecAddDays(ecTodayKey(), 15));
    const [banks, setBanks] = useState<BankAccount[]>([]);
    const [bankId, setBankId] = useState<number | "">("");
    const [issuing, setIssuing] = useState(false);
    const [issued, setIssued] = useState<EcVoucherDetail | null>(null);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        bankAccountsService
            .getAll()
            .then((all) => {
                const active = all.filter((b) => (b as BankAccount & { is_active?: boolean }).is_active !== false);
                setBanks(active);
                setBankId(active.find((b) => b.is_default)?.id ?? active[0]?.id ?? "");
            })
            .catch(() => setBanks([]));
    }, []);

    const load = useCallback(async (studentCc: number) => {
        setLoading(true);
        try {
            const res = await ecFeesService.issuable(studentCc);
            setData(res);
            setPicked((p) =>
                p?.cc === res.student.cc
                    ? p
                    : {
                          cc: res.student.cc,
                          full_name: res.student.full_name,
                          gr_number: res.student.gr_number,
                          class_name: res.student.class_name,
                          section_name: res.student.section_name,
                          campus_name: res.student.campus_name,
                      },
            );
            const years = [...new Set(res.charges.map((c) => c.academic_year))];
            setYear(years[0] ?? null);
            setSelected([]);
            setExpiryDate((cur) => cur || ecAddDays(ecTodayKey(), res.default_validity_days));
        } catch (err) {
            toast.error(ecErrMsg(err, "Couldn't load the student's charges"));
            setData(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (cc) void load(cc);
    }, [cc, load]);

    const years = useMemo(() => [...new Set((data?.charges ?? []).map((c) => c.academic_year))], [data]);
    const yearCharges = useMemo(() => (data?.charges ?? []).filter((c) => c.academic_year === year), [data, year]);
    const total = yearCharges.filter((c) => selected.includes(c.id)).reduce((n, c) => n + c.amount, 0);
    const today = ecTodayKey();
    const problems = [
        !selected.length && "Pick at least one charge.",
        !/^\d{4}-\d{2}-\d{2}$/.test(issueDate) && "Give the issue date.",
        !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate) && "Give the valid-till date.",
        expiryDate < issueDate && "The valid-till date is before the issue date.",
        expiryDate < today && "The valid-till date has already passed.",
        bankId === "" && "Pick a bank account.",
    ].filter(Boolean) as string[];

    const pickStudent = (s: EcPickedStudent | null) => {
        setPicked(s);
        setCc(s?.cc ?? null);
        setIssued(null);
        if (!s) setData(null);
    };

    const issue = async () => {
        if (!cc || problems.length) {
            toast.error(problems[0] ?? "Pick a student");
            return;
        }
        setIssuing(true);
        try {
            const v = await ecFeesService.issueVoucher({
                student_id: cc,
                charge_ids: selected,
                issue_date: issueDate,
                expiry_date: expiryDate,
                bank_account_id: bankId === "" ? undefined : bankId,
            });
            setIssued(v);
            toast.success(`${v.voucher_number} issued`);
            await load(cc);
        } catch (err) {
            toast.error(ecErrMsg(err, "Couldn't issue the voucher"));
        } finally {
            setIssuing(false);
        }
    };

    const downloadIssued = async () => {
        if (!issued) return;
        setDownloading(true);
        try {
            const { url, filename } = await ecFeesService.voucherPdf(issued.id);
            await ecDownload(url, filename);
        } catch (err) {
            toast.error(ecErrMsg(err, "Couldn't get the challan"));
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="space-y-6 pb-12">
            <EcPageHeader
                icon={Printer}
                title="Single Voucher"
                description="Put a student's unissued extracurricular charges on one voucher. It has an issue date and a valid-till date, no due date and no late fee. Older unpaid vouchers stay as they are and are only listed beside it."
            />

            <Step n={1} title="Student">
                <div className="max-w-2xl">
                    <EcStudentPicker value={picked} onChange={pickStudent} />
                </div>
            </Step>

            {issued && (
                <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/20 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                        <div>
                            <div className="font-black text-zinc-900 dark:text-zinc-100">{issued.voucher_number} issued</div>
                            <div className="text-xs text-zinc-600 dark:text-zinc-300">
                                {ecRs(issued.total_amount)} · valid till {ecDate(issued.expiry_date)} · {issued.lines.length} line{issued.lines.length === 1 ? "" : "s"}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button type="button" className={ecPrimaryButton} onClick={downloadIssued} disabled={downloading}>
                            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download challan
                        </button>
                        <button type="button" className={ecSecondaryButton} onClick={() => setIssued(null)}>
                            <RotateCcw className="h-4 w-4" /> Issue another
                        </button>
                    </div>
                </div>
            )}

            {cc && loading && !data && (
                <div className="py-10 text-center text-zinc-400">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                </div>
            )}

            {cc && data && (
                <>
                    <Step n={2} title="Charges to put on this voucher">
                        {data.charges.length === 0 ? (
                            <p className="text-sm text-zinc-500">
                                Nothing to issue: every charge of this student is already on a voucher. Add charges on Student Charges first.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {years.length > 1 && (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-xs text-zinc-500 mr-1">One academic year per voucher:</span>
                                        {years.map((y) => (
                                            <button
                                                key={y}
                                                type="button"
                                                onClick={() => {
                                                    setYear(y);
                                                    setSelected([]);
                                                }}
                                                className={`h-8 px-3 rounded-lg text-xs font-semibold border ${
                                                    year === y ? "bg-orange-600 border-orange-600 text-white" : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300"
                                                }`}
                                            >
                                                {y}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-900">
                                                <th className="py-2.5 px-4 w-10">
                                                    <input
                                                        type="checkbox"
                                                        aria-label="Pick every charge"
                                                        checked={yearCharges.length > 0 && yearCharges.every((c) => selected.includes(c.id))}
                                                        onChange={(e) => setSelected(e.target.checked ? yearCharges.map((c) => c.id) : [])}
                                                    />
                                                </th>
                                                <th className="py-2.5 px-2 font-medium">Head</th>
                                                <th className="py-2.5 px-2 font-medium">Month</th>
                                                <th className="py-2.5 px-4 font-medium text-right">Amount (Rs)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {yearCharges.map((c) => (
                                                <tr key={c.id} className="border-b border-zinc-50 dark:border-zinc-900/60 last:border-0">
                                                    <td className="py-2 px-4">
                                                        <input
                                                            type="checkbox"
                                                            aria-label={`${c.fee_head_name} ${c.period_label}`}
                                                            checked={selected.includes(c.id)}
                                                            onChange={() => setSelected((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]))}
                                                        />
                                                    </td>
                                                    <td className="py-2 px-2 font-medium">{c.fee_head_name}</td>
                                                    <td className="py-2 px-2 text-zinc-600 dark:text-zinc-300">{c.period_label}</td>
                                                    <td className="py-2 px-4 text-right tabular-nums">{c.amount.toLocaleString("en-PK")}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {data.open_vouchers.length > 0 && (
                            <div className="mt-4 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/10 p-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
                                    <Info className="h-4 w-4" /> Other unpaid extracurricular vouchers: not included in this voucher
                                </div>
                                <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">They stay as they are and are listed on the side of the new challan.</p>
                                <ul className="mt-2 space-y-1 text-sm">
                                    {data.open_vouchers.map((v) => (
                                        <li key={v.id} className="flex flex-wrap items-center gap-2">
                                            <span className="font-semibold">{v.voucher_number}</span>
                                            <EcStateBadge state={v.state} />
                                            <span className="text-zinc-600 dark:text-zinc-300">
                                                balance {ecRs(v.balance)} · valid till {ecDate(v.expiry_date)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </Step>

                    {data.charges.length > 0 && (
                        <Step n={3} title="Dates and bank">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
                                <EcField label="Issue date" htmlFor="ec-issue-date">
                                    <input id="ec-issue-date" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={ecInputClass} />
                                </EcField>
                                <EcField label="Valid till" htmlFor="ec-expiry-date" hint="Payable through this whole day. No late fee.">
                                    <input id="ec-expiry-date" type="date" value={expiryDate} min={issueDate} onChange={(e) => setExpiryDate(e.target.value)} className={ecInputClass} />
                                </EcField>
                                <EcField label="Bank account" htmlFor="ec-bank">
                                    <select id="ec-bank" value={bankId} onChange={(e) => setBankId(e.target.value ? Number(e.target.value) : "")} className={ecInputClass}>
                                        {banks.length === 0 && <option value="">No bank accounts</option>}
                                        {banks.map((b) => (
                                            <option key={b.id} value={b.id}>
                                                {b.bank_name} · {b.account_number}
                                                {b.is_default ? " (default)" : ""}
                                            </option>
                                        ))}
                                    </select>
                                </EcField>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-3 mt-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 px-5 py-4">
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Total payable</div>
                                    <div className="text-2xl font-black text-orange-600">{ecRs(total)}</div>
                                    <div className="text-xs text-zinc-500">
                                        {selected.length} charge{selected.length === 1 ? "" : "s"} · {year}
                                    </div>
                                </div>
                                {access.can("create") ? (
                                    <button type="button" className={ecPrimaryButton} onClick={issue} disabled={issuing || problems.length > 0} title={problems[0]}>
                                        {issuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} Issue voucher
                                    </button>
                                ) : (
                                    <span className="text-xs text-zinc-400">You can see this page but not issue vouchers.</span>
                                )}
                            </div>
                            {problems.length > 0 && selected.length > 0 && <p className="text-xs text-rose-600 mt-2">{problems[0]}</p>}
                        </Step>
                    )}
                </>
            )}
        </div>
    );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5">
            <h2 className="font-black text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-orange-600 text-white text-xs flex items-center justify-center">{n}</span> {title}
            </h2>
            {children}
        </section>
    );
}
