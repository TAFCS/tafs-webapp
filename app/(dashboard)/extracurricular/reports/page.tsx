"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
    Banknote,
    Building2,
    CalendarRange,
    ChevronLeft,
    ChevronRight,
    CircleDot,
    Download,
    FileText,
    GraduationCap,
    Layers,
    Loader2,
    RotateCcw,
    Search,
    Tags,
    TriangleAlert,
} from "lucide-react";
import toast from "react-hot-toast";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { toggleId } from "@/components/filters/filter-params";
import { campusesService, type Campus, type CampusClassInfo, type SectionInfo } from "@/lib/campuses.service";
import { ecFeesService, ecSaveBlob } from "@/lib/ec-fees.service";
import {
    EC_VOUCHER_STATE_LABEL,
    ecDate,
    ecErrMsg,
    ecRs,
    type EcFeeHeadOption,
    type EcOutstandingReport,
    type EcOutstandingState,
    type EcPaymentsReport,
    type EcReportFilters,
    type EcSummaryReport,
} from "@/lib/ec-fees.types";
import { MANUAL_PAYMENT_METHODS, formatPaymentMethod } from "@/lib/payment-methods";
import { getAcademicYears } from "@/lib/fee-utils";
import { EC_TILES, useExtracurricularAccess } from "@/hooks/use-extracurricular-access";
import { useUserScope } from "@/hooks/use-tile-access";
import { parseIds, parseList, useDebounced, useUrlSync } from "@/features/extracurricular/url-state";
import { EcField, EcPageFallback, EcPageHeader, EcStat, ecInputClass, ecSecondaryButton } from "@/features/extracurricular/ui";
import { EcStateBadge, EcVoucherDrawer } from "@/features/extracurricular/EcVoucherBits";

type Tab = "summary" | "outstanding" | "payments";
const TABS: { id: Tab; label: string }[] = [
    { id: "summary", label: "Summary by head" },
    { id: "outstanding", label: "Outstanding & lapsed" },
    { id: "payments", label: "Payments" },
];
const OUTSTANDING_STATES: EcOutstandingState[] = ["UNPAID", "PARTIALLY_PAID", "EXPIRED"];
const METHOD_IDS = MANUAL_PAYMENT_METHODS.map((m) => m.value);
const PAGE_SIZE = 50;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * TAFSD-605: Extracurricular Fees → Reports. Built from the extracurricular
 * tables only. Summary checks that every rupee charged is accounted for
 * (received, waived, not issued, outstanding or lapsed). All filters are
 * multi-select and live in the URL; searches run on the server.
 */
export default function EcReportsPage() {
    return (
        <Suspense fallback={<EcPageFallback />}>
            <EcReportsInner />
        </Suspense>
    );
}

function EcReportsInner() {
    const access = useExtracurricularAccess(EC_TILES.reports);
    const userScope = useUserScope();
    const params = useSearchParams();
    const yearOptions = useMemo(() => getAcademicYears(3, 2).reverse(), []);

    const [tab, setTab] = useState<Tab>((["summary", "outstanding", "payments"] as const).find((t) => t === params.get("tab")) ?? "summary");
    const [campusIds, setCampusIds] = useState<number[]>(parseIds(params.get("campus")));
    const [classIds, setClassIds] = useState<number[]>(parseIds(params.get("class")));
    const [sectionIds, setSectionIds] = useState<number[]>(parseIds(params.get("section")));
    const [headIds, setHeadIds] = useState<number[]>(parseIds(params.get("heads")));
    const [years, setYears] = useState<string[]>((params.get("years") ?? "").split(",").filter((y) => /^\d{4}-\d{4}$/.test(y)));
    const [states, setStates] = useState<EcOutstandingState[]>(parseList(params.get("state"), OUTSTANDING_STATES));
    const [methods, setMethods] = useState<string[]>(parseList(params.get("method"), METHOD_IDS));
    const [dateFrom, setDateFrom] = useState(params.get("from") ?? "");
    const [dateTo, setDateTo] = useState(params.get("to") ?? "");
    const [search, setSearch] = useState(params.get("q") ?? "");
    const [page, setPage] = useState(Number(params.get("page")) || 1);
    const q = useDebounced(search);
    useUrlSync({
        tab: tab === "summary" ? undefined : tab,
        campus: campusIds,
        class: classIds,
        section: sectionIds,
        heads: headIds,
        years,
        state: states,
        method: methods,
        from: dateFrom,
        to: dateTo,
        q: q.trim(),
        page: page > 1 ? page : undefined,
    });

    const [campuses, setCampuses] = useState<Campus[]>([]);
    const [classes, setClasses] = useState<CampusClassInfo[]>([]);
    const [sections, setSections] = useState<SectionInfo[]>([]);
    const [heads, setHeads] = useState<EcFeeHeadOption[]>([]);
    const [summary, setSummary] = useState<EcSummaryReport | null>(null);
    const [outstanding, setOutstanding] = useState<EcOutstandingReport | null>(null);
    const [payments, setPayments] = useState<EcPaymentsReport | null>(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [openId, setOpenId] = useState<number | null>(null);
    const reqId = useRef(0);

    useEffect(() => {
        campusesService.list().then(setCampuses).catch(() => setCampuses([]));
        campusesService.listAllClasses().then(setClasses).catch(() => setClasses([]));
        campusesService.listAllSections().then(setSections).catch(() => setSections([]));
        ecFeesService.feeHeadOptions().then(setHeads).catch(() => setHeads([]));
    }, []);

    const base: EcReportFilters = useMemo(
        () => ({ campus_ids: campusIds, class_ids: classIds, section_ids: sectionIds, fee_head_ids: headIds, academic_years: years }),
        [campusIds, classIds, sectionIds, headIds, years],
    );
    const outstandingFilters = useMemo(() => ({ ...base, q, states }), [base, q, states]);
    const paymentFilters = useMemo(
        () => ({ ...base, q, payment_methods: methods, date_from: DATE.test(dateFrom) ? dateFrom : undefined, date_to: DATE.test(dateTo) ? dateTo : undefined }),
        [base, q, methods, dateFrom, dateTo],
    );

    const load = useCallback(async () => {
        const id = ++reqId.current;
        setLoading(true);
        try {
            if (tab === "summary") {
                const r = await ecFeesService.reportSummary(base);
                if (id === reqId.current) setSummary(r);
            } else if (tab === "outstanding") {
                const r = await ecFeesService.reportOutstanding(outstandingFilters, page, PAGE_SIZE);
                if (id === reqId.current) setOutstanding(r);
            } else {
                const r = await ecFeesService.reportPayments(paymentFilters, page, PAGE_SIZE);
                if (id === reqId.current) setPayments(r);
            }
        } catch (err) {
            if (id === reqId.current) toast.error(ecErrMsg(err, "Couldn't load the report"));
        } finally {
            if (id === reqId.current) setLoading(false);
        }
    }, [tab, base, outstandingFilters, paymentFilters, page]);

    useEffect(() => {
        void load();
    }, [load]);

    // A new tab, filter or search starts again from page 1.
    const firstRender = useRef(true);
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        setPage(1);
    }, [tab, base, q, states, methods, dateFrom, dateTo]);

    const filtersActive =
        campusIds.length + classIds.length + sectionIds.length + headIds.length + years.length + states.length + methods.length > 0 || !!(search.trim() || dateFrom || dateTo);
    const clearFilters = () => {
        setCampusIds([]);
        setClassIds([]);
        setSectionIds([]);
        setHeadIds([]);
        setYears([]);
        setStates([]);
        setMethods([]);
        setDateFrom("");
        setDateTo("");
        setSearch("");
    };

    const doExport = async () => {
        setExporting(true);
        try {
            const filters = tab === "summary" ? base : tab === "outstanding" ? outstandingFilters : paymentFilters;
            ecSaveBlob(await ecFeesService.exportReport(tab, filters as Record<string, unknown>), `extracurricular-${tab}-${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (err) {
            toast.error(ecErrMsg(err, "Export failed"));
        } finally {
            setExporting(false);
        }
    };

    const campusOptions = userScope.filterOptions("campuses", campuses, (c) => c.id).map((c) => ({ id: c.id, label: c.campus_name }));
    const meta = tab === "outstanding" ? outstanding?.meta : tab === "payments" ? payments?.meta : undefined;
    const typing = search.trim() !== q.trim();

    return (
        <div className="space-y-6 pb-12">
            <EcPageHeader
                icon={FileText}
                title="Reports"
                description="Extracurricular money only; the academic financial reports never include it. The summary accounts for every rupee charged: received, waived, not yet issued, outstanding on a valid voucher, or lapsed on an expired one."
                actions={
                    access.can("export") && (
                        <button type="button" className={ecSecondaryButton} onClick={doExport} disabled={exporting}>
                            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export
                        </button>
                    )
                }
            />

            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Report">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.id}
                        onClick={() => setTab(t.id)}
                        className={`h-9 px-3.5 rounded-xl text-sm font-semibold border ${tab === t.id ? "bg-orange-600 border-orange-600 text-white" : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300"}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="space-y-3">
                {tab !== "summary" && (
                    <EcField label="Search" htmlFor="ec-report-search">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                            <input
                                id="ec-report-search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={tab === "payments" ? "A student, a voucher number or a payment reference" : "A student or a voucher number"}
                                className={`${ecInputClass} pl-11`}
                            />
                        </div>
                    </EcField>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                    <FilterDropdown label="Campus" icon={Building2} value={campusIds} options={campusOptions} placeholder="All campuses" onToggle={(id) => setCampusIds((p) => toggleId(p, id))} onClear={() => setCampusIds([])} onSetValue={setCampusIds} />
                    <FilterDropdown label="Class" icon={GraduationCap} value={classIds} options={classes.map((c) => ({ id: c.id, label: c.description }))} placeholder="All classes" onToggle={(id) => setClassIds((p) => toggleId(p, id))} onClear={() => setClassIds([])} onSetValue={setClassIds} />
                    <FilterDropdown label="Section" icon={Layers} value={sectionIds} options={sections.map((s) => ({ id: s.id, label: s.description }))} placeholder="All sections" onToggle={(id) => setSectionIds((p) => toggleId(p, id))} onClear={() => setSectionIds([])} onSetValue={setSectionIds} />
                    <FilterDropdown label="Heads" icon={Tags} value={headIds} options={heads.map((h) => ({ id: h.id, label: h.name }))} placeholder="All heads" onToggle={(id) => setHeadIds((p) => toggleId(p, id))} onClear={() => setHeadIds([])} onSetValue={setHeadIds} />
                    <FilterDropdown<string> label="Academic year" icon={CalendarRange} value={years} options={yearOptions.map((y) => ({ id: y, label: y }))} placeholder="All years" onToggle={(id) => setYears((p) => toggleId(p, id))} onClear={() => setYears([])} onSetValue={setYears} />
                    {tab === "outstanding" && (
                        <FilterDropdown<EcOutstandingState> label="State" icon={CircleDot} value={states} options={OUTSTANDING_STATES.map((s) => ({ id: s, label: EC_VOUCHER_STATE_LABEL[s] }))} placeholder="Open and lapsed" onToggle={(id) => setStates((p) => toggleId(p, id))} onClear={() => setStates([])} onSetValue={setStates} />
                    )}
                    {tab === "payments" && (
                        <FilterDropdown<string> label="Method" icon={Banknote} value={methods} options={MANUAL_PAYMENT_METHODS.map((m) => ({ id: m.value, label: m.label }))} placeholder="Every method" onToggle={(id) => setMethods((p) => toggleId(p, id))} onClear={() => setMethods([])} onSetValue={setMethods} />
                    )}
                </div>
                {tab === "payments" && (
                    <div className="grid grid-cols-2 gap-3 max-w-md">
                        <EcField label="Paid from" htmlFor="ec-pay-from">
                            <input id="ec-pay-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={ecInputClass} />
                        </EcField>
                        <EcField label="Paid to" htmlFor="ec-pay-to">
                            <input id="ec-pay-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={ecInputClass} />
                        </EcField>
                    </div>
                )}
                {filtersActive && (
                    <button type="button" onClick={clearFilters} className="h-9 px-1 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-1">
                        <RotateCcw className="h-4 w-4" /> Clear filters
                    </button>
                )}
            </div>

            {loading && ((tab === "summary" && !summary) || (tab === "outstanding" && !outstanding) || (tab === "payments" && !payments)) ? (
                <div className="py-16 text-center text-zinc-400">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                </div>
            ) : tab === "summary" && summary ? (
                <SummaryTab report={summary} loading={loading} />
            ) : tab === "outstanding" && outstanding ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 max-w-xl">
                        <EcStat label="Open (valid vouchers)" value={ecRs(outstanding.summary.open_balance)} hint={`${outstanding.summary.open_count} voucher(s)`} accent />
                        <EcStat label="Lapsed (expired)" value={ecRs(outstanding.summary.lapsed_balance)} hint={`${outstanding.summary.lapsed_count} voucher(s)`} />
                    </div>
                    <ReportTable
                        loading={loading}
                        empty={typing || loading ? "Searching…" : filtersActive ? "No voucher matches these filters." : "Nothing is outstanding."}
                        head={["Voucher", "Student", "Class", "Valid till", "State", "Total (Rs)", "Received (Rs)", "Balance (Rs)"]}
                        rows={outstanding.items.map((v) => [
                            <button key="v" type="button" onClick={() => setOpenId(v.id)} className="font-semibold text-orange-600 hover:underline">
                                {v.voucher_number}
                            </button>,
                            <span key="s">
                                {v.student.full_name}
                                <span className="block text-[11px] text-zinc-400">C.C. {v.student.cc}</span>
                            </span>,
                            `${v.class_name}${v.section_name ? ` ${v.section_name}` : ""}`,
                            ecDate(v.expiry_date),
                            <EcStateBadge key="b" state={v.state} />,
                            v.total_amount.toLocaleString("en-PK"),
                            v.amount_paid.toLocaleString("en-PK"),
                            <strong key="bal">{v.balance.toLocaleString("en-PK")}</strong>,
                        ])}
                        numeric={[5, 6, 7]}
                    />
                </div>
            ) : tab === "payments" && payments ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        <EcStat label="Received" value={ecRs(payments.summary.amount)} hint={`${payments.summary.count} payment(s)`} accent />
                        <Breakdown title="By method" rows={payments.summary.by_method.map((m) => ({ label: formatPaymentMethod(m.payment_method), amount: m.amount }))} />
                        <Breakdown title="By head" rows={payments.summary.by_head.map((h) => ({ label: h.name, amount: h.amount }))} />
                    </div>
                    <ReportTable
                        loading={loading}
                        empty={typing || loading ? "Searching…" : filtersActive ? "No payment matches these filters." : "No payment recorded yet."}
                        head={["Paid on", "Student", "Voucher", "Method", "Reference", "Recorded by", "Amount (Rs)"]}
                        rows={payments.items.map((p) => [
                            ecDate(p.deposit_date),
                            <span key="s">
                                {p.student.full_name}
                                <span className="block text-[11px] text-zinc-400">
                                    C.C. {p.student.cc} · {p.class_name}
                                    {p.section_name ? ` ${p.section_name}` : ""}
                                </span>
                            </span>,
                            <button key="v" type="button" onClick={() => setOpenId(p.voucher.id)} className="font-semibold text-orange-600 hover:underline">
                                {p.voucher.voucher_number}
                            </button>,
                            formatPaymentMethod(p.payment_method),
                            p.reference_number ?? "—",
                            p.recorded_by_name ?? "—",
                            <strong key="a">{p.amount.toLocaleString("en-PK")}</strong>,
                        ])}
                        numeric={[6]}
                    />
                </div>
            ) : null}

            {meta && meta.pages > 1 && (
                <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">
                        Page {meta.page} of {meta.pages} · {meta.total.toLocaleString()} rows
                    </span>
                    <div className="flex gap-1">
                        <button type="button" className={ecSecondaryButton} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                            <ChevronLeft className="h-4 w-4" /> Previous
                        </button>
                        <button type="button" className={ecSecondaryButton} disabled={page >= meta.pages} onClick={() => setPage((p) => p + 1)}>
                            Next <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            <EcVoucherDrawer voucherId={openId} onClose={() => setOpenId(null)} onOpenVoucher={setOpenId} canDownload={false} />
        </div>
    );
}

function SummaryTab({ report, loading }: { report: EcSummaryReport; loading: boolean }) {
    const t = report.totals;
    const unbalanced = !t.balanced || report.rows.some((r) => !r.balanced);
    return (
        <div className={`space-y-4 ${loading ? "opacity-60" : ""}`}>
            {unbalanced && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
                    <TriangleAlert className="h-4 w-4" /> These figures don&apos;t add up. Please report it: charged should equal received + waived + not issued + outstanding + lapsed.
                </div>
            )}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                <EcStat label="Charged" value={ecRs(t.charged)} />
                <EcStat label="Received" value={ecRs(t.received)} accent />
                <EcStat label="Waived" value={ecRs(t.waived)} />
                <EcStat label="Not yet issued" value={ecRs(t.not_issued)} />
                <EcStat label="Outstanding" value={ecRs(t.outstanding)} hint="on valid vouchers" />
                <EcStat label="Lapsed" value={ecRs(t.lapsed)} hint="expired, not reissued" />
            </div>
            <ReportTable
                loading={false}
                empty="No extracurricular charges match these filters."
                head={["Head", "Students", "Charged (Rs)", "Received (Rs)", "Waived (Rs)", "Not issued (Rs)", "Outstanding (Rs)", "Lapsed (Rs)"]}
                rows={[
                    ...report.rows.map((r) => [
                        <span key="n" className="font-semibold">
                            {r.name}
                            {!r.balanced && <TriangleAlert className="h-3.5 w-3.5 text-amber-500 inline ml-1" />}
                        </span>,
                        r.students.toLocaleString(),
                        r.charged.toLocaleString("en-PK"),
                        r.received.toLocaleString("en-PK"),
                        r.waived.toLocaleString("en-PK"),
                        r.not_issued.toLocaleString("en-PK"),
                        r.outstanding.toLocaleString("en-PK"),
                        r.lapsed.toLocaleString("en-PK"),
                    ]),
                    ...(report.rows.length
                        ? [
                              [
                                  <strong key="t">Total</strong>,
                                  "",
                                  <strong key="c">{t.charged.toLocaleString("en-PK")}</strong>,
                                  <strong key="r">{t.received.toLocaleString("en-PK")}</strong>,
                                  <strong key="w">{t.waived.toLocaleString("en-PK")}</strong>,
                                  <strong key="ni">{t.not_issued.toLocaleString("en-PK")}</strong>,
                                  <strong key="o">{t.outstanding.toLocaleString("en-PK")}</strong>,
                                  <strong key="l">{t.lapsed.toLocaleString("en-PK")}</strong>,
                              ],
                          ]
                        : []),
                ]}
                numeric={[1, 2, 3, 4, 5, 6, 7]}
            />
        </div>
    );
}

function Breakdown({ title, rows }: { title: string; rows: { label: string; amount: number }[] }) {
    return (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-5 py-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 mb-1">{title}</div>
            {rows.length === 0 ? (
                <div className="text-sm text-zinc-400">—</div>
            ) : (
                <ul className="text-sm space-y-0.5">
                    {rows.map((r) => (
                        <li key={r.label} className="flex justify-between gap-3">
                            <span className="text-zinc-600 dark:text-zinc-300">{r.label}</span>
                            <span className="tabular-nums font-semibold">{ecRs(r.amount)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function ReportTable({ head, rows, numeric, empty, loading }: { head: string[]; rows: React.ReactNode[][]; numeric: number[]; empty: string; loading: boolean }) {
    return (
        <div className={`rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden ${loading ? "opacity-60" : ""}`}>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-900">
                            {head.map((h, i) => (
                                <th key={h} className={`py-2.5 px-4 font-medium ${numeric.includes(i) ? "text-right" : ""}`}>
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={head.length} className="py-12 text-center text-zinc-400">
                                    {empty}
                                </td>
                            </tr>
                        ) : (
                            rows.map((r, i) => (
                                <tr key={i} className="border-b border-zinc-50 dark:border-zinc-900/60 last:border-0">
                                    {r.map((c, j) => (
                                        <td key={j} className={`py-2.5 px-4 ${numeric.includes(j) ? "text-right tabular-nums" : ""}`}>
                                            {c}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
