"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, Download, FileText, Info, LayoutDashboard, Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthState } from "@/context/AuthContext";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { serializeIds, toggleId } from "@/components/filters/filter-params";
import { ReportFilters, type YesNoFilter } from "../_components/report-filters";
import { ReportPager } from "../_components/report-pager";
import { ReportSnapshotsPanel } from "../_components/report-snapshots-panel";
import { downloadReportFile } from "../_components/download-report";
import {
  currentMonthRange,
  formatRs,
  type PaginationMeta,
} from "../_components/report-utils";

const FEE_STATUSES = [
  { id: "NOT_ISSUED", label: "Not issued" },
  { id: "ISSUED", label: "Issued" },
  { id: "PARTIALLY_PAID", label: "Partially paid" },
  { id: "PAID", label: "Paid" },
  { id: "DISCOUNT", label: "Discount" },
] as const;

const VIEW_OPTIONS = [
  { id: "heads", label: "Fee heads" },
  { id: "student", label: "By student" },
  { id: "fee_type", label: "By fee type" },
  { id: "period", label: "By period" },
  { id: "class", label: "By class" },
] as const;

type ReportView = (typeof VIEW_OPTIONS)[number]["id"];

type FeeHeadRow = {
  id: number;
  cc: number;
  gr_number: string | null;
  student_name: string;
  campus: string;
  class_name: string;
  section: string;
  fee_type: string;
  period_label: string;
  fee_date: string | null;
  status: string;
  amount: number;
  amount_paid: number;
  outstanding: number;
};

type FeeHeadTotals = {
  count: number;
  student_count: number;
  billed_count: number;
  to_be_billed_count: number;
  billed: number;
  to_be_billed: number;
  amount: number;
  amount_paid: number;
  outstanding: number;
  reconciles?: boolean;
  billed_plus_to_be_billed?: boolean;
  paid_plus_outstanding?: boolean;
};

type StudentRollupRow = {
  cc: number;
  gr_number: string | null;
  student_name: string;
  campus: string;
  class_name: string;
  section: string;
  head_count: number;
  amount: number;
  amount_paid: number;
  outstanding: number;
};

type FeeTypeRollupRow = {
  fee_type_id: number;
  fee_type: string;
  head_count: number;
  amount: number;
  amount_paid: number;
  outstanding: number;
};

type PeriodRollupRow = {
  target_month: number;
  academic_year: number;
  period_label: string;
  head_count: number;
  amount: number;
  amount_paid: number;
  outstanding: number;
};

type ClassRollupRow = {
  class_id: number | null;
  class_name: string;
  student_count: number;
  head_count: number;
  amount: number;
  amount_paid: number;
  outstanding: number;
};

function statusClass(status: string): string {
  switch (status) {
    case "PAID":
      return "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900";
    case "PARTIALLY_PAID":
      return "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900";
    case "ISSUED":
      return "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900";
    case "DISCOUNT":
      return "bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900";
    default:
      return "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";
  }
}

export default function FeeHeadsReportPage() {
  const { user } = useAuthState();
  const canViewAnalytics =
    user?.role === "SUPER_ADMIN" ||
    user?.permissions?.includes("system.analytics.view");
  const canFinalizeAnalytics =
    user?.role === "SUPER_ADMIN" ||
    user?.permissions?.includes("system.analytics.finalize");
  const month = currentMonthRange();
  const campusLocked = user?.campusId != null;

  const [fromDate, setFromDate] = useState(month.from);
  const [toDate, setToDate] = useState(month.to);
  const [campusIds, setCampusIds] = useState<number[]>(
    campusLocked && user?.campusId != null ? [user.campusId] : [],
  );
  const [classIds, setClassIds] = useState<number[]>([]);
  const [sectionIds, setSectionIds] = useState<number[]>([]);
  const [segmentIds, setSegmentIds] = useState<number[]>([]);
  const [studentStatuses, setStudentStatuses] = useState<string[]>([]);
  const [feeEndowment, setFeeEndowment] = useState<YesNoFilter>("");
  const [isComplementary, setIsComplementary] = useState<YesNoFilter>("");
  const [statuses, setStatuses] = useState<string[]>([]);
  const [view, setView] = useState<ReportView>("heads");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [items, setItems] = useState<FeeHeadRow[]>([]);
  const [studentItems, setStudentItems] = useState<StudentRollupRow[]>([]);
  const [feeTypeItems, setFeeTypeItems] = useState<FeeTypeRollupRow[]>([]);
  const [periodItems, setPeriodItems] = useState<PeriodRollupRow[]>([]);
  const [classItems, setClassItems] = useState<ClassRollupRow[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [totals, setTotals] = useState<FeeHeadTotals | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState<"xlsx" | "csv" | null>(null);

  const buildParams = useCallback(() => ({
    from_date: fromDate,
    to_date: toDate,
    campus_id: serializeIds(campusIds),
    class_id: serializeIds(classIds),
    section_id: serializeIds(sectionIds),
    segment_id: serializeIds(segmentIds),
    student_status: serializeIds(studentStatuses),
    is_fee_endowment: feeEndowment || undefined,
    is_complementary: isComplementary || undefined,
    status: serializeIds(statuses),
    view,
  }), [fromDate, toDate, campusIds, classIds, sectionIds, segmentIds, studentStatuses, feeEndowment, isComplementary, statuses, view]);

  useEffect(() => {
    setPage(1);
  }, [fromDate, toDate, campusIds, classIds, sectionIds, segmentIds, studentStatuses, feeEndowment, isComplementary, statuses, pageSize, view]);

  useEffect(() => {
    if (!canViewAnalytics) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    const fetchRows = async () => {
      setIsLoading(true);
      try {
        const { data } = await api.get("/v1/financial-reports/fee-heads", {
          params: { ...buildParams(), page, limit: pageSize },
        });
        if (cancelled) return;
        const responseItems = data?.data?.items ?? [];
        setItems(view === "heads" ? responseItems : []);
        setStudentItems(view === "student" ? responseItems : []);
        setFeeTypeItems(view === "fee_type" ? responseItems : []);
        setPeriodItems(view === "period" ? responseItems : []);
        setClassItems(view === "class" ? responseItems : []);
        setPagination(data?.data?.pagination ?? null);
        setTotals(data?.data?.totals ?? null);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load fee heads report");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchRows();
    return () => {
      cancelled = true;
    };
  }, [buildParams, canViewAnalytics, page, pageSize, view]);

  const handleExport = async (format: "xlsx" | "csv") => {
    setIsExporting(format);
    try {
      await downloadReportFile(
        "/v1/financial-reports/fee-heads/export",
        { ...buildParams(), format },
        `fee-heads-report.${format}`,
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to export fee heads report");
    } finally {
      setIsExporting(null);
    }
  };

  const viewLabel = VIEW_OPTIONS.find((option) => option.id === view)?.label.toLowerCase() ?? "rows";
  const isEmpty =
    view === "heads" ? items.length === 0
    : view === "student" ? studentItems.length === 0
    : view === "fee_type" ? feeTypeItems.length === 0
    : view === "period" ? periodItems.length === 0
    : classItems.length === 0;

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight font-outfit">
            Fee Heads Report
          </h1>
          <p className="text-sm font-medium text-zinc-400 mt-1">
            Accrual — issued on a voucher vs scheduled but not yet billed. Late payment surcharges are excluded.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 max-w-full">
            {VIEW_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setView(option.id)}
                className={`h-9 px-3 rounded-lg text-[11px] font-black uppercase tracking-widest transition-colors ${
                  view === option.id
                    ? "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 shadow-sm"
                    : "text-zinc-500"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
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
            className="flex items-center gap-1.5 px-3 h-9 text-[11px] font-bold text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            {isExporting === "csv" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            CSV
          </button>
        </div>
      </div>

      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 text-blue-900 rounded-2xl p-4 text-sm dark:bg-blue-950/20 dark:border-blue-900/30 dark:text-blue-200">
        <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p>
          Late payment surcharges are excluded from this report. For LPS figures, see{" "}
          <Link href="/financial-reports/deposits" className="font-bold underline underline-offset-2">
            Deposits Report
          </Link>
          . Date range filters on fee date; use <strong>By period</strong> for month-wise totals by academic period.
        </p>
      </div>

      {totals && totals.reconciles === false && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 text-amber-900 rounded-2xl p-4 text-sm dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-200">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p>
            Totals did not reconcile for the current filters. Billed + to-be-billed should equal total amount, and paid + outstanding should match total.
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[24px] p-5 space-y-2">
        <ReportFilters
          campusIds={campusIds}
          setCampusIds={setCampusIds}
          classIds={classIds}
          setClassIds={setClassIds}
          sectionIds={sectionIds}
          setSectionIds={setSectionIds}
          segmentIds={segmentIds}
          setSegmentIds={setSegmentIds}
          fromDate={fromDate}
          setFromDate={setFromDate}
          toDate={toDate}
          setToDate={setToDate}
          studentStatuses={studentStatuses}
          setStudentStatuses={setStudentStatuses}
          feeEndowment={feeEndowment}
          setFeeEndowment={setFeeEndowment}
          isComplementary={isComplementary}
          setIsComplementary={setIsComplementary}
          extra={
            <div className="min-w-[200px]">
              <FilterDropdown
                label="Status"
                icon={FileText}
                value={statuses}
                options={FEE_STATUSES.map((s) => ({ id: s.id, label: s.label }))}
                placeholder="All statuses"
                hint="multi"
                onToggle={(id) => setStatuses((prev) => toggleId(prev, id))}
                onSetValue={setStatuses}
                onClear={() => setStatuses([])}
              />
            </div>
          }
        />
        <p className="text-[11px] text-zinc-400 font-medium ml-1">
          Not issued heads are scheduled but not yet billed. Graduated students show their graduation class; include <strong>Graduated</strong> in student status to filter them by class.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <TotalTile label="Heads" value={(totals?.count ?? 0).toLocaleString()} />
        <TotalTile label="Students" value={(totals?.student_count ?? 0).toLocaleString()} />
        <TotalTile
          label="To be billed"
          value={formatRs(totals?.to_be_billed)}
          sub={`${(totals?.to_be_billed_count ?? 0).toLocaleString()} not issued`}
        />
        <TotalTile
          label="Billed"
          value={formatRs(totals?.billed)}
          sub={`${(totals?.billed_count ?? 0).toLocaleString()} on a voucher`}
        />
        <TotalTile label="Total" value={formatRs(totals?.amount)} />
        <TotalTile label="Paid" value={formatRs(totals?.amount_paid)} />
        <TotalTile label="Outstanding" value={formatRs(totals?.outstanding)} />
      </div>

      <ReportSnapshotsPanel
        buildParams={buildParams}
        canFinalize={canFinalizeAnalytics}
      />

      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[24px] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
            {isLoading ? "Loading…" : `${(pagination?.total ?? 0).toLocaleString()} ${viewLabel}`}
          </span>
        </div>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
              Fetching report…
            </p>
          </div>
        ) : isEmpty ? (
          <div className="py-24 text-center text-sm text-zinc-400">
            No fee heads in this range.
          </div>
        ) : view === "student" ? (
          <RollupTable
            headers={["CC", "GR", "Name", "Campus", "Class", "Section", "Heads", "Amount", "Paid", "Outstanding"]}
            rightAlignFrom={6}
            rows={studentItems.map((row) => [
              row.cc,
              row.gr_number ?? "—",
              row.student_name,
              row.campus,
              row.class_name,
              row.section,
              row.head_count.toLocaleString(),
              formatRs(row.amount),
              formatRs(row.amount_paid),
              formatRs(row.outstanding),
            ])}
            rowKey={(row) => String(row[0])}
          />
        ) : view === "fee_type" ? (
          <RollupTable
            headers={["Fee type", "Heads", "Amount", "Paid", "Outstanding"]}
            rightAlignFrom={1}
            rows={feeTypeItems.map((row) => [
              row.fee_type,
              row.head_count.toLocaleString(),
              formatRs(row.amount),
              formatRs(row.amount_paid),
              formatRs(row.outstanding),
            ])}
            rowKey={(row) => String(row[0])}
          />
        ) : view === "period" ? (
          <RollupTable
            headers={["Period", "Academic year", "Heads", "Amount", "Paid", "Outstanding"]}
            rightAlignFrom={2}
            rows={periodItems.map((row) => [
              row.period_label,
              row.academic_year,
              row.head_count.toLocaleString(),
              formatRs(row.amount),
              formatRs(row.amount_paid),
              formatRs(row.outstanding),
            ])}
            rowKey={(row) => `${row[0]}-${row[1]}`}
          />
        ) : view === "class" ? (
          <RollupTable
            headers={["Class", "Students", "Heads", "Amount", "Paid", "Outstanding"]}
            rightAlignFrom={1}
            rows={classItems.map((row) => [
              row.class_name,
              row.student_count.toLocaleString(),
              row.head_count.toLocaleString(),
              formatRs(row.amount),
              formatRs(row.amount_paid),
              formatRs(row.outstanding),
            ])}
            rowKey={(row) => String(row[0])}
          />
        ) : (
          <div className="overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  {["CC", "GR", "Name", "Campus", "Class", "Section", "Fee type", "Period", "Fee date", "Status", "Amount", "Paid", "Outstanding"].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 ${["Amount", "Paid", "Outstanding"].includes(h) ? "text-right" : "text-left"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-4 py-3 font-bold text-zinc-700 dark:text-zinc-200">{row.cc}</td>
                    <td className="px-4 py-3 text-zinc-500">{row.gr_number ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">{row.student_name}</td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{row.campus}</td>
                    <td className="px-4 py-3 text-zinc-500">{row.class_name}</td>
                    <td className="px-4 py-3 text-zinc-500">{row.section}</td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-200">{row.fee_type}</td>
                    <td className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-300 whitespace-nowrap">{row.period_label}</td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{row.fee_date ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusClass(row.status)}`}>
                        {row.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatRs(row.amount)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-500">{formatRs(row.amount_paid)}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">{formatRs(row.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <ReportPager
          page={page}
          pageSize={pageSize}
          pagination={pagination}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      </div>
    </div>
  );
}

function RollupTable({
  headers,
  rightAlignFrom,
  rows,
  rowKey,
}: {
  headers: string[];
  rightAlignFrom: number;
  rows: (string | number)[][];
  rowKey: (row: (string | number)[]) => string;
}) {
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
          <tr>
            {headers.map((header, index) => (
              <th
                key={header}
                className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 ${index >= rightAlignFrom ? "text-right" : "text-left"}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-t border-zinc-100 dark:border-zinc-800">
              {row.map((cell, index) => (
                <td
                  key={`${rowKey(row)}-${index}`}
                  className={`px-4 py-3 ${index >= rightAlignFrom ? "text-right tabular-nums" : ""} ${index === 0 ? "font-semibold text-zinc-900 dark:text-zinc-100" : "text-zinc-500"} ${index >= rightAlignFrom - 1 && index >= 2 ? "font-bold" : ""}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TotalTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-[20px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
      <p className="mt-1 text-xl font-black text-zinc-900 dark:text-zinc-50 font-outfit tabular-nums">{value}</p>
      {sub && <p className="text-[11px] font-medium text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}
