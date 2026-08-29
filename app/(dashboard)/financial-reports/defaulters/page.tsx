"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, Download, Info, LayoutDashboard, Loader2, Search,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthState } from "@/context/AuthContext";
import { serializeIds, toggleId } from "@/components/filters/filter-params";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { ReportFilters, type YesNoFilter } from "../_components/report-filters";
import { ReportPager } from "../_components/report-pager";
import { TotalTile } from "../_components/total-tile";
import { downloadReportFile } from "../_components/download-report";
import { formatRs, type PaginationMeta } from "../_components/report-utils";
import {
  SEVERITY_BANDS, SEVERITY_BY_ID, UNBILLED_CHIP, type SeverityBand,
} from "../_components/severity";
import { MonthStrip, StripLegend, type StripCell } from "./_components/month-strip";
import { SeverityBar, type SeverityDistributionRow } from "./_components/severity-bar";

type View = "students" | "by_class" | "by_campus" | "aging";

const VIEWS: { id: View; label: string }[] = [
  { id: "students", label: "Students" },
  { id: "by_class", label: "By Class" },
  { id: "by_campus", label: "By Campus" },
  { id: "aging", label: "Aging" },
];

const SORTS: { id: string; label: string }[] = [
  { id: "months_behind", label: "Months behind" },
  { id: "arrears_outstanding", label: "Arrears outstanding" },
  { id: "oldest_arrear", label: "Oldest arrear" },
  { id: "arrear_head_count", label: "Arrear heads" },
  { id: "student_name", label: "Student name" },
];

type StudentRow = {
  cc: number;
  gr_number: string | null;
  student_name: string;
  campus: string;
  class_name: string;
  section: string;
  student_status: string;
  months_behind: number;
  months_behind_billed: number;
  months_behind_unbilled: number;
  severity: SeverityBand;
  arrears_outstanding: number;
  arrear_head_count: number;
  oldest_arrear_fee_date: string | null;
  oldest_arrear_month_label: string | null;
  lps_charged: number;
  lps_outstanding: number;
  lps_waived: number;
  lps_projected_next_voucher: number;
  unreleased_voucher_count: number;
  last_payment_date: string | null;
  days_since_last_payment: number | null;
  payments_last_6m: number;
  payments_last_12m: number;
  strip: StripCell[];
  arrear_months_in_window: number;
  arrear_months_outside_window: number;
};

type RollupRow = {
  class_id?: number | null;
  class_name?: string;
  campus_id?: number | null;
  campus?: string;
  in_scope_students: number;
  defaulter_count: number;
  defaulter_rate: number;
  band_counts: Record<SeverityBand, number>;
  months_behind_avg: number;
  months_behind_max: number;
  arrears_outstanding: number;
  arrears_avg: number;
  lps_projected: number;
};

type AgingRow = {
  band: SeverityBand;
  label: string;
  months_behind_label: string;
  student_count: number;
  share_of_defaulters: number;
  share_of_in_scope: number;
  arrears_outstanding: number;
  arrears_avg: number;
  arrears_max: number;
  lps_projected: number;
};

type Totals = {
  in_scope_students: number;
  defaulter_count: number;
  defaulter_rate: number;
  watch_count: number;
  defaulter_band_count: number;
  severe_count: number;
  critical_count: number;
  arrears_outstanding: number;
  arrear_head_count: number;
  months_behind_total: number;
  months_behind_avg: number;
  months_behind_max: number;
  months_behind_unbilled_total: number;
  lps_charged: number;
  lps_outstanding: number;
  lps_waived: number;
  lps_projected_next_voucher: number;
  months_behind_distribution: { mode: number[]; median: number };
};

function todayDateOnly(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DefaultersReportPage() {
  const { user } = useAuthState();
  const canViewAnalytics =
    user?.role === "SUPER_ADMIN" ||
    user?.permissions?.includes("system.analytics.view");
  const campusLocked = user?.campusId != null;

  const [asOfDate, setAsOfDate] = useState(todayDateOnly());
  const [stripMonths, setStripMonths] = useState(12);
  const [minMonthsBehind, setMinMonthsBehind] = useState(1);
  const [severities, setSeverities] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("months_behind");
  const [ccSearch, setCcSearch] = useState("");
  const [view, setView] = useState<View>("students");

  const [campusIds, setCampusIds] = useState<number[]>(
    campusLocked && user?.campusId != null ? [user.campusId] : [],
  );
  const [classIds, setClassIds] = useState<number[]>([]);
  const [sectionIds, setSectionIds] = useState<number[]>([]);
  const [segmentIds, setSegmentIds] = useState<number[]>([]);
  // Defaults to enrolled students, but is clearable — widen it to LEFT /
  // EXPELLED / GRADUATED and this doubles as a recovery list. The backend has no
  // default here on purpose: an empty array and "unset" are indistinguishable
  // over the wire, so a server-side default would make "all statuses"
  // inexpressible.
  const [studentStatuses, setStudentStatuses] = useState<string[]>(["ENROLLED"]);
  const [feeEndowment, setFeeEndowment] = useState<YesNoFilter>("");
  const [isComplementary, setIsComplementary] = useState<YesNoFilter>("");
  const [graduatedFromClassIds, setGraduatedFromClassIds] = useState<number[]>([]);
  const [graduatedYearRange, setGraduatedYearRange] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [items, setItems] = useState<StudentRow[] | RollupRow[] | AgingRow[]>([]);
  const [columns, setColumns] = useState<{ label: string }[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [distribution, setDistribution] = useState<SeverityDistributionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState<"xlsx" | "csv" | null>(null);

  const buildParams = useCallback(() => ({
    as_of_date: asOfDate,
    strip_months: stripMonths,
    min_months_behind: minMonthsBehind,
    severity: serializeIds(severities),
    sort_by: sortBy,
    sort_dir: sortBy === "student_name" || sortBy === "oldest_arrear" ? "asc" : "desc",
    view,
    cc: ccSearch.trim() ? Number(ccSearch.trim()) : undefined,
    campus_id: serializeIds(campusIds),
    class_id: serializeIds(classIds),
    section_id: serializeIds(sectionIds),
    segment_id: serializeIds(segmentIds),
    student_status: serializeIds(studentStatuses),
    is_fee_endowment: feeEndowment || undefined,
    is_complementary: isComplementary || undefined,
    graduated_from_class_id: serializeIds(graduatedFromClassIds),
    graduated_year_range: graduatedYearRange || undefined,
  }), [asOfDate, stripMonths, minMonthsBehind, severities, sortBy, view, ccSearch, campusIds, classIds, sectionIds, segmentIds, studentStatuses, feeEndowment, isComplementary, graduatedFromClassIds, graduatedYearRange]);

  useEffect(() => {
    setPage(1);
  }, [asOfDate, stripMonths, minMonthsBehind, severities, sortBy, view, ccSearch, campusIds, classIds, sectionIds, segmentIds, studentStatuses, feeEndowment, isComplementary, graduatedFromClassIds, graduatedYearRange, pageSize]);

  useEffect(() => {
    if (!canViewAnalytics) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    const fetchRows = async () => {
      setIsLoading(true);
      try {
        const { data } = await api.get("/v1/financial-reports/defaulters", {
          params: { ...buildParams(), page, limit: pageSize },
        });
        if (cancelled) return;
        setItems(data?.data?.items ?? []);
        setColumns(data?.data?.columns ?? []);
        setPagination(data?.data?.pagination ?? null);
        setTotals(data?.data?.totals ?? null);
        setDistribution(data?.data?.severity_distribution ?? []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load defaulters report");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchRows();
    return () => {
      cancelled = true;
    };
  }, [buildParams, canViewAnalytics, page, pageSize]);

  const handleExport = async (format: "xlsx" | "csv") => {
    setIsExporting(format);
    try {
      await downloadReportFile(
        "/v1/financial-reports/defaulters/export",
        { ...buildParams(), format },
        `defaulters-${view}.${format}`,
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to export defaulters report");
    } finally {
      setIsExporting(null);
    }
  };

  if (!canViewAnalytics) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
        <LayoutDashboard className="h-12 w-12 text-zinc-300 mb-4" />
        <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Access Restricted</h2>
        <p className="text-zinc-500 mt-2 max-w-md">
          You do not have permission to view financial reports.
        </p>
      </div>
    );
  }

  const mode = totals?.months_behind_distribution?.mode ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight font-outfit">
            Defaulters Report
          </h1>
          <p className="text-sm font-medium text-zinc-400 mt-1">
            Students carrying arrears across multiple months, ranked by how far behind they are.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleExport("xlsx")}
            disabled={isExporting !== null}
            className="flex items-center gap-1.5 px-3 h-9 text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors disabled:opacity-50"
          >
            {isExporting === "xlsx" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Excel
          </button>
          <button
            type="button"
            onClick={() => handleExport("csv")}
            disabled={isExporting !== null}
            className="flex items-center gap-1.5 px-3 h-9 text-[11px] font-bold text-zinc-600 bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {isExporting === "csv" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            CSV
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-900 w-fit">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            className={`h-9 px-4 rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors ${
              view === v.id
                ? "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 shadow-sm"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[24px] p-5 shadow-sm">
        <ReportFilters
          campusIds={campusIds}
          setCampusIds={setCampusIds}
          classIds={classIds}
          setClassIds={setClassIds}
          sectionIds={sectionIds}
          setSectionIds={setSectionIds}
          segmentIds={segmentIds}
          setSegmentIds={setSegmentIds}
          studentStatuses={studentStatuses}
          setStudentStatuses={setStudentStatuses}
          feeEndowment={feeEndowment}
          setFeeEndowment={setFeeEndowment}
          isComplementary={isComplementary}
          setIsComplementary={setIsComplementary}
          graduatedFromClassIds={graduatedFromClassIds}
          setGraduatedFromClassIds={setGraduatedFromClassIds}
          graduatedYearRange={graduatedYearRange}
          setGraduatedYearRange={setGraduatedYearRange}
          extra={
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] ml-1">
                  As of (exclusive)
                </label>
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] ml-1">
                  Min months behind
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={minMonthsBehind}
                  onChange={(e) => setMinMonthsBehind(Math.max(1, Number(e.target.value) || 1))}
                  className="h-11 w-28 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-primary"
                />
              </div>
              {view === "students" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] ml-1">
                    Strip months
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={stripMonths}
                    onChange={(e) => setStripMonths(Math.min(24, Math.max(1, Number(e.target.value) || 12)))}
                    className="h-11 w-28 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-primary"
                  />
                </div>
              )}
              <div className="min-w-[200px]">
                <FilterDropdown
                  label="Severity"
                  icon={AlertTriangle}
                  value={severities}
                  options={SEVERITY_BANDS.map((b) => ({
                    id: b.id as string,
                    label: `${b.label} (${b.monthsLabel})`,
                  }))}
                  placeholder="All severities"
                  hint="multi"
                  onToggle={(id) => setSeverities(toggleId(severities, id))}
                  onSetValue={setSeverities}
                  onClear={() => setSeverities([])}
                />
              </div>
              {view === "students" && (
                <>
                  <div className="min-w-[200px]">
                    <FilterDropdown
                      label="Sort by"
                      icon={LayoutDashboard}
                      value={[sortBy]}
                      options={SORTS}
                      placeholder="Months behind"
                      onToggle={(id) => setSortBy(id)}
                      onClear={() => setSortBy("months_behind")}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] flex items-center gap-1.5 ml-1">
                      <Search className="h-3 w-3" /> CC
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={ccSearch}
                      onChange={(e) => setCcSearch(e.target.value.replace(/\D/g, ""))}
                      placeholder="Student CC"
                      className="h-11 w-32 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-primary"
                    />
                  </div>
                </>
              )}
            </>
          }
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-7 gap-4">
        <TotalTile
          label="Defaulters"
          value={(totals?.defaulter_count ?? 0).toLocaleString()}
          sub={`${totals?.defaulter_rate ?? 0}% of ${(totals?.in_scope_students ?? 0).toLocaleString()} in scope`}
        />
        <TotalTile label="Watch · 1 month" value={(totals?.watch_count ?? 0).toLocaleString()} />
        <TotalTile label="Defaulter · 2 months" value={(totals?.defaulter_band_count ?? 0).toLocaleString()} accent />
        <TotalTile label="Severe · 3 months" value={(totals?.severe_count ?? 0).toLocaleString()} accent />
        <TotalTile label="Critical · 4+ months" value={(totals?.critical_count ?? 0).toLocaleString()} accent />
        <TotalTile
          label="Arrears outstanding"
          value={formatRs(totals?.arrears_outstanding)}
          sub={`${(totals?.arrear_head_count ?? 0).toLocaleString()} unpaid heads`}
        />
        <TotalTile
          label="LPS on next voucher"
          value={formatRs(totals?.lps_projected_next_voucher)}
          sub={`Rs. 1,000 x ${(totals?.months_behind_total ?? 0).toLocaleString()} arrear months`}
          accent
        />
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[24px] p-5 shadow-sm space-y-4">
        <SeverityBar rows={distribution} />
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800 pt-3">
          <span>Avg <b className="text-zinc-700 dark:text-zinc-200 tabular-nums">{totals?.months_behind_avg ?? 0}</b> months behind</span>
          <span>Worst <b className="text-zinc-700 dark:text-zinc-200 tabular-nums">{totals?.months_behind_max ?? 0}</b> months</span>
          <span>Median <b className="text-zinc-700 dark:text-zinc-200 tabular-nums">{totals?.months_behind_distribution?.median ?? 0}</b></span>
          {mode.length > 0 && (
            <span>Most common <b className="text-zinc-700 dark:text-zinc-200 tabular-nums">{mode.join(", ")}</b> months</span>
          )}
          <span>LPS already charged <b className="text-zinc-700 dark:text-zinc-200 tabular-nums">{formatRs(totals?.lps_charged)}</b>, of which <b className="text-zinc-700 dark:text-zinc-200 tabular-nums">{formatRs(totals?.lps_outstanding)}</b> unpaid</span>
          <span>Waived <b className="text-zinc-700 dark:text-zinc-200 tabular-nums">{formatRs(totals?.lps_waived)}</b></span>
          {(totals?.months_behind_unbilled_total ?? 0) > 0 && (
            <span className="text-violet-600 dark:text-violet-400">
              <b className="tabular-nums">{totals?.months_behind_unbilled_total}</b> arrear months were never billed
            </span>
          )}
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl p-4 text-sm border bg-zinc-50 border-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300">
        <Info className="h-5 w-5 text-zinc-400 flex-shrink-0 mt-0.5" />
        <p>
          A student is <b>one month behind</b> for each distinct month they owe fees for — the same
          count the voucher engine uses to charge Rs. 1,000 late payment surcharge per arrear month,
          so <b>months behind = surcharges on the next voucher</b>. Two or more is the school&apos;s
          escalation threshold. Heads that were never issued still count (the engine counts them),
          but are called out separately, because those mean the office never billed the family.
          These figures are computed from the voucher engine&apos;s own arrears definition and will
          not match the arrears shown on the dashboard or a student&apos;s profile, which use two
          older and mutually inconsistent definitions. See{" "}
          <Link href="/financial-reports/fee-heads" className="font-bold underline underline-offset-2">
            Fee Heads
          </Link>{" "}
          for what was billed and{" "}
          <Link href="/financial-reports/deposits" className="font-bold underline underline-offset-2">
            Deposits
          </Link>{" "}
          for what was collected.
        </p>
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[24px] shadow-sm overflow-hidden">
        {view === "students" && columns.length > 0 && (
          <div className="px-6 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <StripLegend columns={columns} />
          </div>
        )}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400">
                No students are behind on payments for these filters.
              </p>
            </div>
          ) : view === "students" ? (
            <StudentsTable rows={items as StudentRow[]} />
          ) : view === "aging" ? (
            <AgingTable rows={items as AgingRow[]} />
          ) : (
            <RollupTable rows={items as RollupRow[]} isCampus={view === "by_campus"} />
          )}
        </div>
        {pagination && view !== "aging" && (
          <ReportPager
            page={page}
            pageSize={pageSize}
            pagination={pagination}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>
    </div>
  );
}

const TH = "px-3 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400 whitespace-nowrap";
const TD = "px-3 py-3 text-sm text-zinc-700 dark:text-zinc-200 whitespace-nowrap";

function StudentsTable({ rows }: { rows: StudentRow[] }) {
  return (
    <table className="w-full">
      <thead className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-100 dark:border-zinc-800">
        <tr>
          <th className={TH}>Student</th>
          <th className={TH}>Class</th>
          <th className={TH}>Behind</th>
          <th className={TH}>Payment history</th>
          <th className={TH}>Oldest arrear</th>
          <th className={`${TH} text-right`}>Arrears</th>
          <th className={`${TH} text-right`}>LPS unpaid</th>
          <th className={`${TH} text-right`}>LPS next</th>
          <th className={TH}>Last payment</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {rows.map((row) => {
          const spec = SEVERITY_BY_ID[row.severity];
          return (
            <tr key={row.cc} className={spec?.row ?? ""}>
              <td className={TD}>
                <p className="font-bold text-zinc-900 dark:text-zinc-50">{row.student_name}</p>
                <p className="text-[11px] text-zinc-400">
                  CC {row.cc}
                  {row.gr_number ? ` · GR ${row.gr_number}` : ""} · {row.campus}
                </p>
              </td>
              <td className={TD}>
                <p className="font-semibold">{row.class_name || "—"}</p>
                <p className="text-[11px] text-zinc-400">
                  {row.section || "—"}
                  {row.student_status !== "ENROLLED" ? ` · ${row.student_status}` : ""}
                </p>
              </td>
              <td className={TD}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-black tabular-nums ${spec?.chip ?? ""}`}>
                    {row.months_behind} mo
                  </span>
                  {row.months_behind_unbilled > 0 && (
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${UNBILLED_CHIP}`}
                      title="These arrear months were never issued on a voucher — the family was never billed for them."
                    >
                      {row.months_behind_unbilled} never billed
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {spec?.label} · {row.arrear_head_count} head{row.arrear_head_count === 1 ? "" : "s"}
                </p>
              </td>
              <td className={TD}>
                <MonthStrip cells={row.strip} />
                {row.arrear_months_outside_window > 0 && (
                  <p
                    className="text-[10px] font-bold text-zinc-400 mt-1"
                    title="Fees billed on one date can carry target months beyond this window — those arrear months cannot be drawn here."
                  >
                    +{row.arrear_months_outside_window} outside this window
                  </p>
                )}
              </td>
              <td className={TD}>
                <p className="font-semibold">{row.oldest_arrear_month_label ?? "—"}</p>
                <p className="text-[11px] text-zinc-400">{row.oldest_arrear_fee_date ?? ""}</p>
              </td>
              <td className={`${TD} text-right font-bold tabular-nums`}>
                {formatRs(row.arrears_outstanding)}
              </td>
              <td className={`${TD} text-right tabular-nums`}>
                {formatRs(row.lps_outstanding)}
                {row.unreleased_voucher_count > 0 && (
                  <p
                    className="text-[10px] font-bold text-amber-600 dark:text-amber-400"
                    title="Vouchers billed but never released to the parent — they have not seen this charge."
                  >
                    {row.unreleased_voucher_count} unreleased
                  </p>
                )}
              </td>
              <td className={`${TD} text-right tabular-nums font-bold text-red-600 dark:text-red-400`}>
                {formatRs(row.lps_projected_next_voucher)}
              </td>
              <td className={TD}>
                {row.last_payment_date ? (
                  <>
                    <p className="font-semibold">{row.last_payment_date.slice(0, 10)}</p>
                    <p className="text-[11px] text-zinc-400">
                      {row.days_since_last_payment} days ago · {row.payments_last_12m} in 12mo
                    </p>
                  </>
                ) : (
                  <span className="text-[11px] font-black uppercase tracking-widest text-red-500">
                    Never paid
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function BandBar({ counts, total }: { counts: Record<SeverityBand, number>; total: number }) {
  if (!total) return null;
  return (
    <div className="flex h-2 w-32 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
      {SEVERITY_BANDS.map((b) =>
        counts[b.id] ? (
          <div
            key={b.id}
            className={b.bar}
            style={{ width: `${(counts[b.id] / total) * 100}%` }}
            title={`${b.label}: ${counts[b.id]}`}
          />
        ) : null,
      )}
    </div>
  );
}

function RollupTable({ rows, isCampus }: { rows: RollupRow[]; isCampus: boolean }) {
  return (
    <table className="w-full">
      <thead className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-100 dark:border-zinc-800">
        <tr>
          <th className={TH}>{isCampus ? "Campus" : "Class"}</th>
          <th className={`${TH} text-right`}>Defaulters</th>
          <th className={`${TH} text-right`}>Rate</th>
          <th className={TH}>Severity mix</th>
          <th className={`${TH} text-right`}>Avg behind</th>
          <th className={`${TH} text-right`}>Worst</th>
          <th className={`${TH} text-right`}>Arrears</th>
          <th className={`${TH} text-right`}>Avg arrears</th>
          <th className={`${TH} text-right`}>LPS next</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {rows.map((row) => (
          <tr key={`${row.campus_id ?? row.class_id}-${row.campus ?? row.class_name}`}>
            <td className={`${TD} font-bold text-zinc-900 dark:text-zinc-50`}>
              {isCampus ? row.campus : row.class_name}
            </td>
            <td className={`${TD} text-right tabular-nums font-bold`}>
              {row.defaulter_count.toLocaleString()}
              <span className="text-zinc-400 font-medium"> / {row.in_scope_students.toLocaleString()}</span>
            </td>
            <td className={`${TD} text-right tabular-nums font-bold`}>{row.defaulter_rate}%</td>
            <td className={TD}>
              <BandBar counts={row.band_counts} total={row.defaulter_count} />
            </td>
            <td className={`${TD} text-right tabular-nums`}>{row.months_behind_avg}</td>
            <td className={`${TD} text-right tabular-nums`}>{row.months_behind_max}</td>
            <td className={`${TD} text-right tabular-nums font-bold`}>{formatRs(row.arrears_outstanding)}</td>
            <td className={`${TD} text-right tabular-nums`}>{formatRs(row.arrears_avg)}</td>
            <td className={`${TD} text-right tabular-nums text-red-600 dark:text-red-400`}>
              {formatRs(row.lps_projected)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AgingTable({ rows }: { rows: AgingRow[] }) {
  return (
    <table className="w-full">
      <thead className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-100 dark:border-zinc-800">
        <tr>
          <th className={TH}>Band</th>
          <th className={`${TH} text-right`}>Students</th>
          <th className={`${TH} text-right`}>% of defaulters</th>
          <th className={`${TH} text-right`}>% of all students</th>
          <th className={`${TH} text-right`}>Arrears</th>
          <th className={`${TH} text-right`}>Avg</th>
          <th className={`${TH} text-right`}>Worst</th>
          <th className={`${TH} text-right`}>LPS next</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {rows.map((row) => {
          const spec = SEVERITY_BY_ID[row.band];
          return (
            <tr key={row.band} className={spec?.row ?? ""}>
              <td className={TD}>
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-black ${spec?.chip ?? ""}`}>
                  {row.label}
                </span>
                <span className="ml-2 text-[11px] font-bold text-zinc-400 tabular-nums">
                  {row.months_behind_label} month{row.months_behind_label === "1" ? "" : "s"}
                </span>
              </td>
              <td className={`${TD} text-right tabular-nums font-bold`}>{row.student_count.toLocaleString()}</td>
              <td className={`${TD} text-right tabular-nums`}>{row.share_of_defaulters}%</td>
              <td className={`${TD} text-right tabular-nums`}>{row.share_of_in_scope}%</td>
              <td className={`${TD} text-right tabular-nums font-bold`}>{formatRs(row.arrears_outstanding)}</td>
              <td className={`${TD} text-right tabular-nums`}>{formatRs(row.arrears_avg)}</td>
              <td className={`${TD} text-right tabular-nums`}>{formatRs(row.arrears_max)}</td>
              <td className={`${TD} text-right tabular-nums text-red-600 dark:text-red-400`}>
                {formatRs(row.lps_projected)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
