"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
    Building2,
    CalendarRange,
    ChevronLeft,
    ChevronRight,
    CircleDot,
    CreditCard,
    Download,
    FileStack,
    GraduationCap,
    Layers,
    Loader2,
    RotateCcw,
    Search,
    Tags,
    Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { toggleId } from "@/components/filters/filter-params";
import { campusesService, type Campus, type CampusClassInfo, type SectionInfo } from "@/lib/campuses.service";
import { ecDownload, ecFeesService, ecSaveBlob } from "@/lib/ec-fees.service";
import {
    EC_VOUCHER_STATES,
    EC_VOUCHER_STATE_LABEL,
    ecDate,
    ecErrMsg,
    ecRs,
    type EcFeeHeadOption,
    type EcVoucherDetail,
    type EcVoucherFilters,
    type EcVoucherList,
    type EcVoucherState,
} from "@/lib/ec-fees.types";
import { getAcademicYears } from "@/lib/fee-utils";
import { EC_TILES, useExtracurricularAccess } from "@/hooks/use-extracurricular-access";
import { useUserScope } from "@/hooks/use-tile-access";
import { parseIds, parseList, useDebounced, useUrlSync } from "@/features/extracurricular/url-state";
import { EcConfirmDialog, EcField, EcPageFallback, EcPageHeader, EcStat, ecInputClass, ecSecondaryButton } from "@/features/extracurricular/ui";
import { EcStateBadge, EcVoucherDrawer, useEcPdfDownload } from "@/features/extracurricular/EcVoucherBits";
import { EcVoucherActionButtons } from "@/features/extracurricular/EcVoucherActions";

const PAGE_SIZE = 50;
const MERGE_MAX = 500;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * TAFSD-605: Extracurricular Fees → Vouchers, the EC twin of /vouchers. Every
 * EC voucher with its derived state (Expired and Reissued are worked out from
 * the dates, never stored). Filters are multi-select and live in the URL; the
 * search is server-side.
 */
export default function EcVouchersPage() {
    return (
        <Suspense fallback={<EcPageFallback />}>
            <EcVouchersInner />
        </Suspense>
    );
}

function EcVouchersInner() {
    const access = useExtracurricularAccess(EC_TILES.vouchers);
    const userScope = useUserScope();
    const params = useSearchParams();
    const yearOptions = useMemo(() => getAcademicYears(3, 2).reverse(), []);

    const [search, setSearch] = useState(params.get("q") ?? "");
    const [campusIds, setCampusIds] = useState<number[]>(parseIds(params.get("campus")));
    const [classIds, setClassIds] = useState<number[]>(parseIds(params.get("class")));
    const [sectionIds, setSectionIds] = useState<number[]>(parseIds(params.get("section")));
    const [headIds, setHeadIds] = useState<number[]>(parseIds(params.get("heads")));
    const [states, setStates] = useState<EcVoucherState[]>(parseList(params.get("state"), EC_VOUCHER_STATES));
    const [years, setYears] = useState<string[]>((params.get("years") ?? "").split(",").filter((y) => /^\d{4}-\d{4}$/.test(y)));
    const [issueFrom, setIssueFrom] = useState(params.get("issued_from") ?? "");
    const [issueTo, setIssueTo] = useState(params.get("issued_to") ?? "");
    const [expiryFrom, setExpiryFrom] = useState(params.get("valid_from") ?? "");
    const [expiryTo, setExpiryTo] = useState(params.get("valid_to") ?? "");
    const [page, setPage] = useState(Number(params.get("page")) || 1);
    const [openId, setOpenId] = useState<number | null>(Number(params.get("voucher")) || null);
    // Set by the Bulk Voucher page: "the vouchers of this run".
    const [runId, setRunId] = useState(params.get("run") ?? "");
    const q = useDebounced(search);

    useUrlSync({
        q: q.trim(),
        campus: campusIds,
        class: classIds,
        section: sectionIds,
        heads: headIds,
        state: states,
        years,
        issued_from: issueFrom,
        issued_to: issueTo,
        valid_from: expiryFrom,
        valid_to: expiryTo,
        page: page > 1 ? page : undefined,
        voucher: openId ?? undefined,
        run: runId,
    });

    const [campuses, setCampuses] = useState<Campus[]>([]);
    const [classes, setClasses] = useState<CampusClassInfo[]>([]);
    const [sections, setSections] = useState<SectionInfo[]>([]);
    const [heads, setHeads] = useState<EcFeeHeadOption[]>([]);
    const [list, setList] = useState<EcVoucherList | null>(null);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<number[]>([]);
    const [merging, setMerging] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [deleting, setDeleting] = useState<{ id: number; number: string | null } | null>(null);
    const [busyDelete, setBusyDelete] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const pdf = useEcPdfDownload();
    const reqId = useRef(0);

    useEffect(() => {
        campusesService.list().then(setCampuses).catch(() => setCampuses([]));
        campusesService.listAllClasses().then(setClasses).catch(() => setClasses([]));
        campusesService.listAllSections().then(setSections).catch(() => setSections([]));
        ecFeesService.feeHeadOptions().then(setHeads).catch(() => setHeads([]));
    }, []);

    const filters: EcVoucherFilters = useMemo(
        () => ({
            q,
            campus_ids: campusIds,
            class_ids: classIds,
            section_ids: sectionIds,
            fee_head_ids: headIds,
            states,
            academic_years: years,
            issue_from: DATE.test(issueFrom) ? issueFrom : undefined,
            issue_to: DATE.test(issueTo) ? issueTo : undefined,
            expiry_from: DATE.test(expiryFrom) ? expiryFrom : undefined,
            expiry_to: DATE.test(expiryTo) ? expiryTo : undefined,
            bulk_run_id: runId || undefined,
        }),
        [q, campusIds, classIds, sectionIds, headIds, states, years, issueFrom, issueTo, expiryFrom, expiryTo, runId],
    );

    const load = useCallback(async () => {
        const id = ++reqId.current;
        setLoading(true);
        try {
            const data = await ecFeesService.listVouchers(filters, page, PAGE_SIZE);
            if (id === reqId.current) setList(data);
        } catch (err) {
            if (id === reqId.current) toast.error(ecErrMsg(err, "Couldn't load the vouchers"));
        } finally {
            if (id === reqId.current) setLoading(false);
        }
    }, [filters, page]);

    useEffect(() => {
        void load();
    }, [load]);

    // A new search or filter starts again from page 1 with nothing selected.
    const firstRender = useRef(true);
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        setPage(1);
        setSelected([]);
    }, [filters]);

    const filtersActive =
        !!search.trim() ||
        campusIds.length + classIds.length + sectionIds.length + headIds.length + states.length + years.length > 0 ||
        !!(issueFrom || issueTo || expiryFrom || expiryTo || runId);
    const clearFilters = () => {
        setSearch("");
        setRunId("");
        setCampusIds([]);
        setClassIds([]);
        setSectionIds([]);
        setHeadIds([]);
        setStates([]);
        setYears([]);
        setIssueFrom("");
        setIssueTo("");
        setExpiryFrom("");
        setExpiryTo("");
    };

    const items = list?.items ?? [];
    const allOnPage = items.length > 0 && items.every((v) => selected.includes(v.id));

    const mergeSelected = async () => {
        if (!selected.length) return;
        if (selected.length > MERGE_MAX) {
            toast.error(`Pick at most ${MERGE_MAX} vouchers for one merged PDF`);
            return;
        }
        setMerging(true);
        const t = toast.loading(`Preparing ${selected.length} challan${selected.length === 1 ? "" : "s"}…`);
        try {
            const res = await ecFeesService.mergedPdf(selected);
            await ecDownload(res.url, res.filename);
            toast.success(`${res.count} challan${res.count === 1 ? "" : "s"} in one PDF`, { id: t });
        } catch (err) {
            toast.error(ecErrMsg(err, "Couldn't merge the challans"), { id: t });
        } finally {
            setMerging(false);
        }
    };

    const doExport = async () => {
        setExporting(true);
        try {
            ecSaveBlob(await ecFeesService.exportVouchers(filters), `extracurricular-vouchers-${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (err) {
            toast.error(ecErrMsg(err, "Export failed"));
        } finally {
            setExporting(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleting) return;
        setBusyDelete(true);
        try {
            await ecFeesService.deleteVoucher(deleting.id);
            toast.success(`${deleting.number} deleted; its charges are unissued again`);
            setDeleting(null);
            setOpenId(null);
            setSelected((p) => p.filter((x) => x !== deleting.id));
            await load();
        } catch (err) {
            toast.error(ecErrMsg(err, "Couldn't delete the voucher"));
        } finally {
            setBusyDelete(false);
        }
    };

    const campusOptions = userScope.filterOptions("campuses", campuses, (c) => c.id).map((c) => ({ id: c.id, label: c.campus_name }));
    const typing = search.trim() !== q.trim();

    return (
        <div className="space-y-6 pb-12">
            <EcPageHeader
                icon={CreditCard}
                title="Vouchers"
                description="Every extracurricular voucher. Expired and Reissued are worked out from the dates; a new voucher never changes an older one."
                actions={
                    <>
                        {access.can("download") && (
                            <button type="button" className={ecSecondaryButton} onClick={mergeSelected} disabled={!selected.length || merging}>
                                {merging ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileStack className="h-4 w-4" />} Merged PDF ({selected.length})
                            </button>
                        )}
                        {access.can("export") && (
                            <button type="button" className={ecSecondaryButton} onClick={doExport} disabled={exporting}>
                                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export
                            </button>
                        )}
                    </>
                }
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <EcStat label="Vouchers" value={list ? list.summary.count.toLocaleString() : "—"} hint={filtersActive ? "with these filters" : undefined} />
                <EcStat label="Billed" value={list ? ecRs(list.summary.total_amount) : "—"} />
                <EcStat label="Received" value={list ? ecRs(list.summary.amount_paid) : "—"} />
                <EcStat label="Balance" value={list ? ecRs(list.summary.balance) : "—"} accent />
            </div>

            <div className="space-y-3">
                <EcField label="Search" htmlFor="ec-voucher-search">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <input
                            id="ec-voucher-search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Voucher number (with or without EC), or a student's name, C.C., G.R. or phone"
                            className={`${ecInputClass} pl-11`}
                        />
                    </div>
                </EcField>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                    <FilterDropdown label="Campus" icon={Building2} value={campusIds} options={campusOptions} placeholder="All campuses" onToggle={(id) => setCampusIds((p) => toggleId(p, id))} onClear={() => setCampusIds([])} onSetValue={setCampusIds} />
                    <FilterDropdown label="Class" icon={GraduationCap} value={classIds} options={classes.map((c) => ({ id: c.id, label: c.description }))} placeholder="All classes" onToggle={(id) => setClassIds((p) => toggleId(p, id))} onClear={() => setClassIds([])} onSetValue={setClassIds} />
                    <FilterDropdown label="Section" icon={Layers} value={sectionIds} options={sections.map((s) => ({ id: s.id, label: s.description }))} placeholder="All sections" onToggle={(id) => setSectionIds((p) => toggleId(p, id))} onClear={() => setSectionIds([])} onSetValue={setSectionIds} />
                    <FilterDropdown label="Heads" icon={Tags} value={headIds} options={heads.map((h) => ({ id: h.id, label: h.name }))} placeholder="All heads" onToggle={(id) => setHeadIds((p) => toggleId(p, id))} onClear={() => setHeadIds([])} onSetValue={setHeadIds} />
                    <FilterDropdown<EcVoucherState> label="State" icon={CircleDot} value={states} options={EC_VOUCHER_STATES.map((s) => ({ id: s, label: EC_VOUCHER_STATE_LABEL[s] }))} placeholder="Any state" onToggle={(id) => setStates((p) => toggleId(p, id))} onClear={() => setStates([])} onSetValue={setStates} />
                    <FilterDropdown<string> label="Academic year" icon={CalendarRange} value={years} options={yearOptions.map((y) => ({ id: y, label: y }))} placeholder="All years" onToggle={(id) => setYears((p) => toggleId(p, id))} onClear={() => setYears([])} onSetValue={setYears} />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                    <EcField label="Issued from" htmlFor="ec-issued-from">
                        <input id="ec-issued-from" type="date" value={issueFrom} onChange={(e) => setIssueFrom(e.target.value)} className={ecInputClass} />
                    </EcField>
                    <EcField label="Issued to" htmlFor="ec-issued-to">
                        <input id="ec-issued-to" type="date" value={issueTo} onChange={(e) => setIssueTo(e.target.value)} className={ecInputClass} />
                    </EcField>
                    <EcField label="Valid till from" htmlFor="ec-valid-from">
                        <input id="ec-valid-from" type="date" value={expiryFrom} onChange={(e) => setExpiryFrom(e.target.value)} className={ecInputClass} />
                    </EcField>
                    <EcField label="Valid till to" htmlFor="ec-valid-to">
                        <input id="ec-valid-to" type="date" value={expiryTo} onChange={(e) => setExpiryTo(e.target.value)} className={ecInputClass} />
                    </EcField>
                </div>
                {runId && (
                    <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30 px-3 py-1 text-xs text-orange-700 dark:text-orange-300">
                        Showing one bulk run only
                        <button type="button" onClick={() => setRunId("")} className="font-semibold hover:underline">
                            Show all
                        </button>
                    </div>
                )}
                {filtersActive && (
                    <button type="button" onClick={clearFilters} className="h-9 px-1 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-1">
                        <RotateCcw className="h-4 w-4" /> Clear filters
                    </button>
                )}
            </div>

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                                <th className="py-3 px-4 w-10">
                                    <input
                                        type="checkbox"
                                        aria-label="Pick every voucher on this page"
                                        checked={allOnPage}
                                        onChange={(e) =>
                                            setSelected((p) => (e.target.checked ? [...new Set([...p, ...items.map((v) => v.id)])] : p.filter((id) => !items.some((v) => v.id === id))))
                                        }
                                    />
                                </th>
                                <th className="py-3 px-2 font-medium">Voucher</th>
                                <th className="py-3 px-2 font-medium">Student</th>
                                <th className="py-3 px-2 font-medium">Class</th>
                                <th className="py-3 px-2 font-medium">Issued</th>
                                <th className="py-3 px-2 font-medium">Valid till</th>
                                <th className="py-3 px-2 font-medium">State</th>
                                <th className="py-3 px-2 font-medium text-right">Total (Rs)</th>
                                <th className="py-3 px-2 font-medium text-right">Balance (Rs)</th>
                                <th className="py-3 px-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && !list ? (
                                <tr>
                                    <td colSpan={10} className="py-16 text-center text-zinc-400">
                                        <Loader2 className="h-5 w-5 animate-spin inline" />
                                    </td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-16 text-center text-zinc-400 text-sm">
                                        {typing || loading ? "Searching…" : filtersActive ? "No voucher matches these filters." : "No extracurricular vouchers yet."}
                                    </td>
                                </tr>
                            ) : (
                                items.map((v) => (
                                    <tr key={v.id} className={`border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 ${loading ? "opacity-60" : ""}`}>
                                        <td className="py-3 px-4">
                                            <input type="checkbox" aria-label={`Pick ${v.voucher_number}`} checked={selected.includes(v.id)} onChange={() => setSelected((p) => toggleId(p, v.id))} />
                                        </td>
                                        <td className="py-3 px-2">
                                            <button type="button" onClick={() => setOpenId(v.id)} className="font-semibold text-orange-600 hover:underline">
                                                {v.voucher_number}
                                            </button>
                                            <div className="text-[11px] text-zinc-400">{v.academic_year}</div>
                                        </td>
                                        <td className="py-3 px-2">
                                            <div className="font-medium text-zinc-900 dark:text-zinc-100">{v.student.full_name}</div>
                                            <div className="text-[11px] text-zinc-400">
                                                C.C. {v.student.cc}
                                                {v.student.gr_number ? ` · G.R. ${v.student.gr_number}` : ""}
                                            </div>
                                        </td>
                                        <td className="py-3 px-2 text-zinc-600 dark:text-zinc-300">
                                            {v.class_name}
                                            {v.section_name ? ` ${v.section_name}` : ""}
                                            <div className="text-[11px] text-zinc-400">{v.campus_name}</div>
                                        </td>
                                        <td className="py-3 px-2 text-zinc-600 dark:text-zinc-300 whitespace-nowrap">{ecDate(v.issue_date)}</td>
                                        <td className={`py-3 px-2 whitespace-nowrap ${v.state === "EXPIRED" ? "text-rose-600 font-medium" : "text-zinc-600 dark:text-zinc-300"}`}>{ecDate(v.expiry_date)}</td>
                                        <td className="py-3 px-2">
                                            <EcStateBadge state={v.state} />
                                            {v.reissued_to && <div className="text-[11px] text-zinc-400 mt-0.5">→ {v.reissued_to.voucher_number}</div>}
                                        </td>
                                        <td className="py-3 px-2 text-right tabular-nums">{v.total_amount.toLocaleString("en-PK")}</td>
                                        <td className="py-3 px-2 text-right tabular-nums font-semibold">{v.balance.toLocaleString("en-PK")}</td>
                                        <td className="py-3 px-4">
                                            <div className="flex justify-end gap-1">
                                                {access.can("download") && (
                                                    <button type="button" onClick={() => pdf.download(v.id)} disabled={pdf.busyId === v.id} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900" aria-label={`Download ${v.voucher_number}`}>
                                                        {pdf.busyId === v.id ? <Loader2 className="h-4 w-4 animate-spin text-zinc-400" /> : <Download className="h-4 w-4 text-zinc-500" />}
                                                    </button>
                                                )}
                                                {access.can("delete") && v.deposits_count === 0 && v.state !== "WAIVED" && !v.reissued_to && (
                                                    <button type="button" onClick={() => setDeleting({ id: v.id, number: v.voucher_number })} className="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30" aria-label={`Delete ${v.voucher_number}`}>
                                                        <Trash2 className="h-4 w-4 text-rose-500" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {list && list.meta.pages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100 dark:border-zinc-900 text-sm">
                        <span className="text-zinc-500">
                            Page {list.meta.page} of {list.meta.pages} · {list.meta.total.toLocaleString()} vouchers
                        </span>
                        <div className="flex gap-1">
                            <button type="button" className={ecSecondaryButton} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                                <ChevronLeft className="h-4 w-4" /> Previous
                            </button>
                            <button type="button" className={ecSecondaryButton} disabled={page >= list.meta.pages} onClick={() => setPage((p) => p + 1)}>
                                Next <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <EcVoucherDrawer
                voucherId={openId}
                refreshKey={refreshKey}
                onClose={() => setOpenId(null)}
                onOpenVoucher={setOpenId}
                canDownload={access.can("download")}
                actions={(v: EcVoucherDetail) => (
                    <>
                        <EcVoucherActionButtons
                            voucher={v}
                            onChanged={(next) => {
                                setOpenId(next.id);
                                setRefreshKey((k) => k + 1);
                                void load();
                            }}
                        />
                        {access.can("delete") && v.deposits.length === 0 && v.state !== "WAIVED" && !v.reissued_to && (
                            <button
                                type="button"
                                onClick={() => setDeleting({ id: v.id, number: v.voucher_number })}
                                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/30"
                            >
                                <Trash2 className="h-4 w-4" /> Delete
                            </button>
                        )}
                    </>
                )}
            />

            <EcConfirmDialog
                open={!!deleting}
                title={`Delete ${deleting?.number ?? "voucher"}?`}
                danger
                busy={busyDelete}
                confirmLabel="Delete voucher"
                onClose={() => setDeleting(null)}
                onConfirm={() => {
                    void confirmDelete().then(() => setRefreshKey((k) => k + 1));
                }}
                body={
                    <>
                        <p>Use this to fix a voucher issued by mistake. Its charges go back to unissued and can be put on a new voucher.</p>
                        <p>A voucher with a payment can&apos;t be deleted; reverse the payment first.</p>
                    </>
                }
            />
        </div>
    );
}
