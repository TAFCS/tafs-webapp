"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarRange, CheckCircle2, Eye, FilePlus2, FileStack, Loader2, Tags, TriangleAlert } from "lucide-react";
import toast from "react-hot-toast";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { toggleId } from "@/components/filters/filter-params";
import { bankAccountsService, type BankAccount } from "@/lib/bank-accounts.service";
import { ecDownload, ecFeesService } from "@/lib/ec-fees.service";
import {
    EC_MONTHS,
    ecAddDays,
    ecErrMsg,
    ecRs,
    ecTodayKey,
    type EcBulkIssueFilters,
    type EcBulkIssuePreview,
    type EcBulkIssueResult,
    type EcFeeHeadOption,
} from "@/lib/ec-fees.types";
import { getAcademicYears, getCurrentAcademicYear } from "@/lib/fee-utils";
import { EC_TILES, useExtracurricularAccess } from "@/hooks/use-extracurricular-access";
import { parseIds, useUrlSync } from "@/features/extracurricular/url-state";
import { EcField, EcPageFallback, EcPageHeader, ecInputClass, ecPrimaryButton, ecSecondaryButton } from "@/features/extracurricular/ui";
import { EcBulkTargetPicker, emptyTarget, targetToApi, type EcTargetState } from "@/features/extracurricular/EcBulkTargetPicker";

const ISSUE_CHUNK = 50;
const PREPARE_CHUNK = 20;
const MERGE_MAX = 500;

/**
 * TAFSD-605: Extracurricular Fees → Bulk Voucher, the EC twin of /bulk-voucher.
 * One voucher per student per academic year for the chosen heads and months
 * (pick one month for monthly vouchers). Older vouchers are never touched.
 * Issued in chunks of 50 students, one call after another, so a long run
 * shows progress and a retry only issues what is still unissued.
 */
export default function EcBulkVoucherPage() {
    return (
        <Suspense fallback={<EcPageFallback />}>
            <EcBulkVoucherInner />
        </Suspense>
    );
}

function EcBulkVoucherInner() {
    const access = useExtracurricularAccess(EC_TILES.bulkVoucher);
    const params = useSearchParams();
    const yearOptions = useMemo(() => getAcademicYears(1, 2).reverse(), []);

    const [target, setTarget] = useState<EcTargetState>({
        ...emptyTarget,
        campusIds: parseIds(params.get("campus")),
        classIds: parseIds(params.get("class")),
        sectionIds: parseIds(params.get("section")),
    });
    const [headIds, setHeadIds] = useState<number[]>(parseIds(params.get("heads")));
    const [months, setMonths] = useState<number[]>(parseIds(params.get("months")).filter((m) => m <= 12));
    const [years, setYears] = useState<string[]>(() => {
        const fromUrl = (params.get("years") ?? "").split(",").filter((y) => /^\d{4}-\d{4}$/.test(y));
        return fromUrl.length ? fromUrl : [getCurrentAcademicYear()];
    });
    useUrlSync({ campus: target.campusIds, class: target.classIds, section: target.sectionIds, heads: headIds, months, years });

    const [heads, setHeads] = useState<EcFeeHeadOption[]>([]);
    const [banks, setBanks] = useState<BankAccount[]>([]);
    const [bankId, setBankId] = useState<number | "">("");
    const [issueDate, setIssueDate] = useState(ecTodayKey());
    const [expiryDate, setExpiryDate] = useState(ecAddDays(ecTodayKey(), 15));
    const [preview, setPreview] = useState<EcBulkIssuePreview | null>(null);
    const [previewing, setPreviewing] = useState(false);
    const [run, setRun] = useState<{ id: string; done: number; total: number; results: EcBulkIssueResult[]; finished: boolean } | null>(null);
    const [printing, setPrinting] = useState<{ done: number; total: number } | null>(null);
    const stopRef = useRef(false);

    useEffect(() => {
        ecFeesService.feeHeadOptions().then(setHeads).catch(() => setHeads([]));
        bankAccountsService
            .getAll()
            .then((all) => {
                const active = all.filter((b) => (b as BankAccount & { is_active?: boolean }).is_active !== false);
                setBanks(active);
                setBankId(active.find((b) => b.is_default)?.id ?? active[0]?.id ?? "");
            })
            .catch(() => setBanks([]));
    }, []);

    const filters: EcBulkIssueFilters | null = useMemo(() => {
        const t = targetToApi(target);
        return t ? { ...t, fee_head_ids: headIds, months, academic_years: years } : null;
    }, [target, headIds, months, years]);
    // Any change to the selection makes the preview stale (React's "previous value in state" pattern).
    const filtersKey = JSON.stringify(filters);
    const [previewedKey, setPreviewedKey] = useState(filtersKey);
    if (previewedKey !== filtersKey) {
        setPreviewedKey(filtersKey);
        setPreview(null);
    }

    const runPreview = async () => {
        if (!filters) {
            toast.error("Pick the students: by campus, class, section or C.C.");
            return;
        }
        setPreviewing(true);
        try {
            setPreview(await ecFeesService.bulkIssuePreview(filters));
            setRun(null);
        } catch (err) {
            toast.error(ecErrMsg(err, "Couldn't preview"));
        } finally {
            setPreviewing(false);
        }
    };

    const dateProblem =
        !/^\d{4}-\d{2}-\d{2}$/.test(issueDate) || !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)
            ? "Give both dates."
            : expiryDate < issueDate
              ? "The valid-till date is before the issue date."
              : expiryDate < ecTodayKey()
                ? "The valid-till date has already passed."
                : bankId === ""
                  ? "Pick a bank account."
                  : null;

    const issueAll = async () => {
        if (!filters || !preview || dateProblem) return;
        const ids = preview.eligible_student_ids;
        const id = `ec-${crypto.randomUUID().slice(0, 30)}`;
        stopRef.current = false;
        setRun({ id, done: 0, total: ids.length, results: [], finished: false });
        for (let i = 0; i < ids.length; i += ISSUE_CHUNK) {
            if (stopRef.current) break;
            const chunk = ids.slice(i, i + ISSUE_CHUNK);
            try {
                const res = await ecFeesService.bulkIssueChunk(filters, chunk, {
                    run_id: id,
                    issue_date: issueDate,
                    expiry_date: expiryDate,
                    bank_account_id: bankId === "" ? undefined : bankId,
                });
                setRun((r) => (r ? { ...r, done: r.done + chunk.length, results: [...r.results, ...res.results] } : r));
            } catch (err) {
                const reason = ecErrMsg(err, "The request failed");
                setRun((r) => (r ? { ...r, done: r.done + chunk.length, results: [...r.results, ...chunk.map((cc) => ({ cc, status: "FAILED" as const, reason }))] } : r));
            }
        }
        setRun((r) => (r ? { ...r, finished: true } : r));
        setPreview(null);
    };

    const issuedIds = (run?.results ?? []).filter((r): r is Extract<EcBulkIssueResult, { status: "ISSUED" }> => r.status === "ISSUED").map((r) => r.voucher_id);
    const failed = (run?.results ?? []).filter((r) => r.status === "FAILED");
    const skipped = (run?.results ?? []).filter((r) => r.status === "SKIPPED");

    const printAll = async () => {
        if (!issuedIds.length) return;
        setPrinting({ done: 0, total: issuedIds.length });
        try {
            for (let i = 0; i < issuedIds.length; i += PREPARE_CHUNK) {
                await ecFeesService.preparePdfs(issuedIds.slice(i, i + PREPARE_CHUNK));
                setPrinting({ done: Math.min(i + PREPARE_CHUNK, issuedIds.length), total: issuedIds.length });
            }
            for (let i = 0; i < issuedIds.length; i += MERGE_MAX) {
                const merged = await ecFeesService.mergedPdf(issuedIds.slice(i, i + MERGE_MAX));
                await ecDownload(merged.url, merged.filename);
            }
            toast.success("Challans downloaded");
        } catch (err) {
            toast.error(ecErrMsg(err, "Couldn't prepare the challans"));
        } finally {
            setPrinting(null);
        }
    };

    const busy = !!run && !run.finished;
    return (
        <div className="space-y-6 pb-12">
            <EcPageHeader
                icon={FilePlus2}
                title="Bulk Voucher"
                description="Issue extracurricular vouchers to many students at once: one voucher per student per academic year, holding their unissued charges for the heads and months you pick. Older vouchers stay as they are."
            />

            <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-5">
                <h2 className="font-black text-zinc-900 dark:text-zinc-100">1. Students and charges</h2>
                <EcField label="Students">
                    <EcBulkTargetPicker value={target} onChange={setTarget} />
                </EcField>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
                    <FilterDropdown label="Heads" icon={Tags} value={headIds} options={heads.map((h) => ({ id: h.id, label: h.name }))} placeholder="All heads" onToggle={(id) => setHeadIds((p) => toggleId(p, id))} onClear={() => setHeadIds([])} onSetValue={setHeadIds} />
                    <FilterDropdown<string> label="Academic years" icon={CalendarRange} value={years} options={yearOptions.map((y) => ({ id: y, label: y }))} placeholder="All years" onToggle={(id) => setYears((p) => toggleId(p, id))} onClear={() => setYears([])} onSetValue={setYears} />
                </div>
                <EcField label="Months" hint="None picked means every month. Pick one month for monthly vouchers.">
                    <div className="flex flex-wrap gap-1.5">
                        {EC_MONTHS.map((m) => {
                            const on = months.includes(m.num);
                            return (
                                <button
                                    key={m.num}
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() => setMonths((p) => toggleId(p, m.num))}
                                    className={`h-8 px-3 rounded-lg text-xs font-semibold border ${on ? "bg-orange-600 border-orange-600 text-white" : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300"}`}
                                >
                                    {m.short}
                                </button>
                            );
                        })}
                    </div>
                </EcField>
                <button type="button" className={ecSecondaryButton} onClick={runPreview} disabled={previewing || busy}>
                    {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Preview
                </button>
            </section>

            {preview && (
                <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-4">
                    <h2 className="font-black text-zinc-900 dark:text-zinc-100">2. Preview</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <Fact label="Students matched" value={preview.students_matched.toLocaleString()} />
                        <Fact label="With charges to issue" value={preview.students_with_charges.toLocaleString()} />
                        <Fact label="Vouchers to issue" value={preview.vouchers_to_issue.toLocaleString()} />
                        <Fact label="Total" value={ecRs(preview.total_amount)} />
                    </div>
                    {preview.students_without_charges > 0 && <p className="text-xs text-zinc-500">{preview.students_without_charges} matched student(s) have nothing unissued for these heads and months.</p>}
                    <div className="max-h-80 overflow-auto rounded-xl border border-zinc-100 dark:border-zinc-900">
                        <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900">
                                <tr className="text-left text-zinc-500">
                                    <th className="py-2 px-3 font-medium">Student</th>
                                    <th className="py-2 px-3 font-medium">Class</th>
                                    <th className="py-2 px-3 font-medium">Year</th>
                                    <th className="py-2 px-3 font-medium">Charges</th>
                                    <th className="py-2 px-3 font-medium text-right">Total (Rs)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {preview.rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-6 text-center text-zinc-400">
                                            Nothing to issue for this selection.
                                        </td>
                                    </tr>
                                ) : (
                                    preview.rows.map((r) => (
                                        <tr key={`${r.cc}-${r.academic_year}`} className="border-t border-zinc-100 dark:border-zinc-900">
                                            <td className="py-2 px-3">
                                                <div className="font-medium">{r.full_name}</div>
                                                <div className="text-[11px] text-zinc-400">C.C. {r.cc}</div>
                                            </td>
                                            <td className="py-2 px-3">{[r.class_name, r.section_name].filter(Boolean).join(" ")}</td>
                                            <td className="py-2 px-3">{r.academic_year}</td>
                                            <td className="py-2 px-3">{r.description}</td>
                                            <td className="py-2 px-3 text-right tabular-nums">{r.total.toLocaleString("en-PK")}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        {preview.rows_truncated && <div className="px-3 py-2 text-[11px] text-zinc-400">Showing the first 300. All of them are issued.</div>}
                    </div>

                    {preview.vouchers_to_issue > 0 && (
                        <>
                            <h2 className="font-black text-zinc-900 dark:text-zinc-100 pt-2">3. Dates and bank</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
                                <EcField label="Issue date" htmlFor="ec-bulk-issue">
                                    <input id="ec-bulk-issue" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={ecInputClass} />
                                </EcField>
                                <EcField label="Valid till" htmlFor="ec-bulk-expiry" hint="Payable through this whole day. No late fee.">
                                    <input id="ec-bulk-expiry" type="date" value={expiryDate} min={issueDate} onChange={(e) => setExpiryDate(e.target.value)} className={ecInputClass} />
                                </EcField>
                                <EcField label="Bank account" htmlFor="ec-bulk-bank">
                                    <select id="ec-bulk-bank" value={bankId} onChange={(e) => setBankId(e.target.value ? Number(e.target.value) : "")} className={ecInputClass}>
                                        {banks.map((b) => (
                                            <option key={b.id} value={b.id}>
                                                {b.bank_name} · {b.account_number}
                                                {b.is_default ? " (default)" : ""}
                                            </option>
                                        ))}
                                    </select>
                                </EcField>
                            </div>
                            {dateProblem && <p className="text-xs text-rose-600">{dateProblem}</p>}
                            {access.can("create") ? (
                                <button type="button" className={ecPrimaryButton} onClick={issueAll} disabled={busy || !!dateProblem}>
                                    <FilePlus2 className="h-4 w-4" /> Issue {preview.vouchers_to_issue} voucher{preview.vouchers_to_issue === 1 ? "" : "s"}
                                </button>
                            ) : (
                                <p className="text-xs text-zinc-400">You can preview but not issue vouchers.</p>
                            )}
                        </>
                    )}
                </section>
            )}

            {run && (
                <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            {run.finished ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Loader2 className="h-5 w-5 animate-spin text-orange-500" />}
                            {run.finished ? "Done" : "Issuing…"}
                        </h2>
                        {!run.finished && (
                            <button type="button" className={ecSecondaryButton} onClick={() => (stopRef.current = true)}>
                                Stop after this chunk
                            </button>
                        )}
                    </div>
                    <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
                        <div className="h-full bg-orange-500 transition-all" style={{ width: `${run.total ? Math.round((run.done / run.total) * 100) : 100}%` }} />
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">
                        {run.done} of {run.total} students · {issuedIds.length} issued · {skipped.length} skipped · {failed.length} failed
                    </p>
                    {failed.length > 0 && (
                        <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/20 p-3 text-xs space-y-1">
                            <div className="font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                                <TriangleAlert className="h-4 w-4" /> Failed (run the preview again to retry; already issued students are skipped)
                            </div>
                            {failed.slice(0, 50).map((f, i) => (
                                <div key={`${f.cc}-${i}`}>
                                    C.C. {f.cc}: {"reason" in f ? f.reason : ""}
                                </div>
                            ))}
                        </div>
                    )}
                    {run.finished && issuedIds.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            <button type="button" className={ecPrimaryButton} onClick={printAll} disabled={!!printing}>
                                {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileStack className="h-4 w-4" />}
                                {printing ? `Preparing ${printing.done}/${printing.total}…` : `Download ${issuedIds.length} challan${issuedIds.length === 1 ? "" : "s"}`}
                            </button>
                            <Link href={`/extracurricular/vouchers?run=${encodeURIComponent(run.id)}`} className={ecSecondaryButton}>
                                Open these vouchers
                            </Link>
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">{label}</div>
            <div className="text-base font-black text-zinc-900 dark:text-zinc-100">{value}</div>
        </div>
    );
}
