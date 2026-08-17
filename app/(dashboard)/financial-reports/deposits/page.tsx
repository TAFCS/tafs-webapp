"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, Banknote, Download, Landmark, LayoutDashboard, Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthState } from "@/context/AuthContext";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { serializeIds, toggleId } from "@/components/filters/filter-params";
import { PAYMENT_METHODS, formatPaymentMethod } from "@/lib/payment-methods";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchBanks } from "@/store/slices/banksSlice";
import { ReportFilters, type YesNoFilter } from "../_components/report-filters";
import { ReportPager } from "../_components/report-pager";
import { downloadReportFile } from "../_components/download-report";
import {
  currentMonthRange,
  formatRs,
  type PaginationMeta,
} from "../_components/report-utils";

type DepositRow = {
  id: number;
  deposit_date: string;
  cc: number;
  gr_number: string | null;
  student_name: string;
  campus: string;
  class_name: string;
  section: string;
  payment_method: string | null;
  bank_name: string | null;
  reference_number: string | null;
  total_amount: number;
  fee_heads: number;
  late_fee: number;
  surcharge: number;
  lps_total: number;
};

type DepositTotals = {
  count: number;
  total_amount: number;
  by_type: { FEE_HEAD: number; LATE_FEE: number; SURCHARGE: number };
  lps_total: number;
  allocations_total: number;
  reconciles: boolean;
};

export default function DepositsReportPage() {
  const { user } = useAuthState();
  const canViewAnalytics =
    user?.role === "SUPER_ADMIN" ||
    user?.permissions?.includes("system.analytics.view");
  const month = currentMonthRange();
  const campusLocked = user?.campusId != null;
  const dispatch = useAppDispatch();
  const banks = useAppSelector((s) => s.banks.items);

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
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [bankNames, setBankNames] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [items, setItems] = useState<DepositRow[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [totals, setTotals] = useState<DepositTotals | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState<"xlsx" | "csv" | null>(null);

  useEffect(() => {
    if (banks.length === 0) dispatch(fetchBanks());
  }, [banks.length, dispatch]);

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
    payment_method: serializeIds(paymentMethods),
    bank_name: serializeIds(bankNames),
  }), [fromDate, toDate, campusIds, classIds, sectionIds, segmentIds, studentStatuses, feeEndowment, isComplementary, paymentMethods, bankNames]);

  useEffect(() => {
    setPage(1);
  }, [fromDate, toDate, campusIds, classIds, sectionIds, segmentIds, studentStatuses, feeEndowment, isComplementary, paymentMethods, bankNames, pageSize]);

  useEffect(() => {
    if (!canViewAnalytics) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    const fetchRows = async () => {
      setIsLoading(true);
      try {
        const { data } = await api.get("/v1/financial-reports/deposits", {
          params: { ...buildParams(), page, limit: pageSize },
        });
        if (cancelled) return;
        setItems(data?.data?.items ?? []);
        setPagination(data?.data?.pagination ?? null);
        setTotals(data?.data?.totals ?? null);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load deposits report");
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
        "/v1/financial-reports/deposits/export",
        { ...buildParams(), format },
        `deposits-report.${format}`,
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to export deposits report");
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

  const bankOptions = Array.from(
    new Map(banks.map((b) => [b.bank_name, b.bank_name])).values(),
  ).map((name) => ({ id: name, label: name }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight font-outfit">
            Deposits Report
          </h1>
          <p className="text-sm font-medium text-zinc-400 mt-1">
            Cash — what was actually banked, including late fees and arrear surcharges.
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
            className="flex items-center gap-1.5 px-3 h-9 text-[11px] font-bold text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            {isExporting === "csv" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            CSV
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[24px] p-5">
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
            <>
              <div className="min-w-[200px]">
                <FilterDropdown
                  label="Payment method"
                  icon={Banknote}
                  value={paymentMethods}
                  options={PAYMENT_METHODS.map((m) => ({ id: m.value, label: m.label }))}
                  placeholder="All methods"
                  hint="multi"
                  onToggle={(id) => setPaymentMethods((prev) => toggleId(prev, id))}
                  onSetValue={setPaymentMethods}
                  onClear={() => setPaymentMethods([])}
                />
              </div>
              <div className="min-w-[200px]">
                <FilterDropdown
                  label="Bank"
                  icon={Landmark}
                  value={bankNames}
                  options={bankOptions}
                  placeholder="All banks"
                  hint="multi"
                  onToggle={(id) => setBankNames((prev) => toggleId(prev, id))}
                  onSetValue={setBankNames}
                  onClear={() => setBankNames([])}
                />
              </div>
            </>
          }
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <TotalTile label="Cash banked" value={formatRs(totals?.total_amount)} sub={`${(totals?.count ?? 0).toLocaleString()} deposits`} />
        <TotalTile label="Fee heads" value={formatRs(totals?.by_type?.FEE_HEAD)} />
        <TotalTile label="Late fee" value={formatRs(totals?.by_type?.LATE_FEE)} />
        <TotalTile label="Arrear surcharge" value={formatRs(totals?.by_type?.SURCHARGE)} />
        <TotalTile
          label="LPS (late fee + surcharge)"
          value={formatRs(totals?.lps_total)}
          accent
        />
      </div>

      <div
        className={`flex items-start gap-3 rounded-2xl p-4 text-sm border ${
          totals && !totals.reconciles
            ? "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-200"
            : "bg-zinc-50 border-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300"
        }`}
      >
        {totals && !totals.reconciles ? (
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
        ) : (
          <Banknote className="h-5 w-5 text-zinc-400 flex-shrink-0 mt-0.5" />
        )}
        <p>
          Cash banked {formatRs(totals?.total_amount)} vs allocations {formatRs(totals?.allocations_total)}
          {totals && !totals.reconciles
            ? " — these do not match. This is a data bug, not rounding: report it."
            : " — reconciled."}
        </p>
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[24px] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
            {isLoading ? "Loading…" : `${(pagination?.total ?? 0).toLocaleString()} deposits`}
          </span>
        </div>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Fetching deposits…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-24 text-center text-sm text-zinc-400">No deposits in this range.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  {["ID", "Date", "CC", "GR", "Name", "Campus", "Class", "Section", "Method", "Bank", "Reference", "Total", "Fee heads", "Late fee", "Surcharge"].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 ${["Total", "Fee heads", "Late fee", "Surcharge"].includes(h) ? "text-right" : "text-left"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-4 py-3 font-bold text-zinc-700 dark:text-zinc-200">{row.id}</td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{row.deposit_date.slice(0, 10)}</td>
                    <td className="px-4 py-3 font-bold text-zinc-700 dark:text-zinc-200">{row.cc}</td>
                    <td className="px-4 py-3 text-zinc-500">{row.gr_number ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">{row.student_name}</td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{row.campus}</td>
                    <td className="px-4 py-3 text-zinc-500">{row.class_name}</td>
                    <td className="px-4 py-3 text-zinc-500">{row.section}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300 whitespace-nowrap">{formatPaymentMethod(row.payment_method ?? "")}</td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{row.bank_name ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-500">{row.reference_number ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">{formatRs(row.total_amount)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-500">{formatRs(row.fee_heads)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-500">{formatRs(row.late_fee)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-500">{formatRs(row.surcharge)}</td>
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

function TotalTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-[20px] border p-4 ${
      accent
        ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20"
        : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
    }`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
      <p className="mt-1 text-xl font-black text-zinc-900 dark:text-zinc-50 font-outfit tabular-nums">{value}</p>
      {sub && <p className="text-[11px] font-medium text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}
