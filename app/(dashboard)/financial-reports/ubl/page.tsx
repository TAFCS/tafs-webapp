"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle, ArrowLeftRight, Download, FileSpreadsheet, Filter, LayoutDashboard, Loader2, Lock, Scale, Search,
  Trash2, Upload, X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuthState } from "@/context/AuthContext";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { serializeIds, toggleId } from "@/components/filters/filter-params";
import { useFinancialReportsAccess } from "@/hooks/use-financial-reports-access";
import {
  UBL_CHANNELS,
  UBL_RECON_STATUSES,
  ublReconciliationService,
  type UblDailyTotal,
  type UblReconRow,
  type UblReconStatus,
  type UblReconTotals,
  type UblSettlementImport,
} from "@/lib/ubl-reconciliation.service";
import { ReportPager } from "../_components/report-pager";
import { TotalTile } from "../_components/total-tile";
import { downloadReportFile, reportExportErrorMessage } from "../_components/download-report";
import { currentMonthRange, formatRs, type PaginationMeta } from "../_components/report-utils";
import { SettlementUploadDialog } from "./_components/settlement-upload-dialog";

const TONE: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/40",
  amber: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/40",
  sky: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-900/40",
  rose: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900/40",
  zinc: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800",
};
const STATUS_META = Object.fromEntries(UBL_RECON_STATUSES.map((s) => [s.value, s])) as Record<
  UblReconStatus,
  (typeof UBL_RECON_STATUSES)[number]
>;
const CHANNEL_LABEL: Record<string, string> = Object.fromEntries(UBL_CHANNELS.map((c) => [c.value, c.label]));
const channelLabel = (c: string | null) => (c ? CHANNEL_LABEL[c] ?? c : "—");

function StatusBadge({ status }: { status: UblReconStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[11px] font-bold whitespace-nowrap ${TONE[meta?.tone ?? "zinc"]}`}>
      {meta?.label ?? status}
    </span>
  );
}

const money = (n: number | null | undefined) => (n == null ? "—" : formatRs(n));
const signed = (n: number) => (n === 0 ? "—" : `${n > 0 ? "+" : "−"}${formatRs(Math.abs(n))}`);
const listParam = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);

function UblCollectionsContent() {
  const { user } = useAuthState();
  const access = useFinancialReportsAccess();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canViewAnalytics = user?.role === "SUPER_ADMIN" || user?.permissions?.includes("system.analytics.view");
  const canManage = access.can("ubl.settlements.manage");
  const month = currentMonthRange();

  // Filters round-trip through the URL so a filtered view can be shared.
  const [fromDate, setFromDate] = useState(searchParams.get("from") ?? month.from);
  const [toDate, setToDate] = useState(searchParams.get("to") ?? month.to);
  const [statuses, setStatuses] = useState<string[]>(listParam(searchParams.get("status")));
  const [channels, setChannels] = useState<string[]>(listParam(searchParams.get("channel")));
  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "");
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [items, setItems] = useState<UblReconRow[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [totals, setTotals] = useState<UblReconTotals | null>(null);
  const [daily, setDaily] = useState<UblDailyTotal[]>([]);
  const [imports, setImports] = useState<UblSettlementImport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [forbidden, setForbidden] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("from", fromDate);
    params.set("to", toDate);
    if (statuses.length) params.set("status", statuses.join(","));
    if (channels.length) params.set("channel", channels.join(","));
    if (q) params.set("q", q);
    const next = `${pathname}?${params.toString()}`;
    if (next !== `${pathname}?${searchParams.toString()}`) router.replace(next, { scroll: false });
  }, [fromDate, toDate, statuses, channels, q, pathname, router, searchParams]);

  const buildParams = useCallback(() => ({
    from_date: fromDate,
    to_date: toDate,
    status: serializeIds(statuses),
    channel: serializeIds(channels),
    q: q || undefined,
  }), [fromDate, toDate, statuses, channels, q]);

  useEffect(() => {
    setPage(1);
  }, [fromDate, toDate, statuses, channels, q, pageSize]);

  useEffect(() => {
    if (!canViewAnalytics || !fromDate || !toDate) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const data = await ublReconciliationService.reconciliation({ ...buildParams(), page, limit: pageSize });
        if (cancelled) return;
        setItems(data?.items ?? []);
        setPagination(data?.pagination ?? null);
        setTotals(data?.totals ?? null);
        setDaily(data?.daily ?? []);
        setForbidden(null);
      } catch (err) {
        if (cancelled) return;
        const res = (err as { response?: { status?: number; data?: { message?: string } } })?.response;
        if (res?.status === 403) setForbidden(res.data?.message ?? "You don't have access to this report.");
        else toast.error(res?.data?.message ?? "Failed to load UBL collections");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [buildParams, canViewAnalytics, fromDate, toDate, page, pageSize, reloadKey]);

  useEffect(() => {
    if (!canViewAnalytics) return;
    ublReconciliationService.listSettlements().then(setImports).catch(() => setImports([]));
  }, [canViewAnalytics, reloadKey]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await downloadReportFile(
        "/v1/financial-reports/ubl/reconciliation/export",
        buildParams(),
        `ubl-reconciliation-${fromDate}-to-${toDate}.xlsx`,
      );
    } catch (err) {
      toast.error(await reportExportErrorMessage(err, "Failed to export the reconciliation"));
    } finally {
      setIsExporting(false);
    }
  };

  const removeImport = async (imp: UblSettlementImport) => {
    if (!window.confirm(`Remove the upload "${imp.file_name}" (${imp.row_count} lines)? Its lines stop counting as settled.`)) return;
    try {
      await ublReconciliationService.deleteSettlement(imp.id);
      toast.success("Upload removed");
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Could not remove the upload");
    }
  };

  const hasFilters = statuses.length > 0 || channels.length > 0 || q !== "";
  const clearFilters = () => {
    setStatuses([]);
    setChannels([]);
    setSearchInput("");
    setQ("");
  };
  const statusOptions = useMemo(
    () => [
      { id: "EXCEPTIONS", label: "Needs a look (all exceptions)" },
      ...UBL_RECON_STATUSES.map((s) => ({ id: s.value as string, label: s.label, sub: totals ? `${totals.status_counts[s.value] ?? 0}` : undefined })),
    ],
    [totals],
  );

  if (!canViewAnalytics) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
        <LayoutDashboard className="h-12 w-12 text-zinc-300 mb-4" />
        <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Access Restricted</h2>
        <p className="text-zinc-500 mt-2 max-w-md">You do not have permission to view financial reports.</p>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <Lock className="h-8 w-8 text-zinc-300 dark:text-zinc-700" />
        <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{forbidden}</p>
      </div>
    );
  }

  const differenceOff = (totals?.difference ?? 0) !== 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight font-outfit">UBL Collections</h1>
          <p className="text-sm font-medium text-zinc-400 mt-1">
            Every payment UBL posted to TAFS, matched against the settlement statements UBL sends.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button
              type="button"
              onClick={() => setUploading(true)}
              className="flex items-center gap-1.5 px-3 h-9 text-[11px] font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload settlement
            </button>
          )}
          {access.can("export") && (
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 h-9 text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors disabled:opacity-50"
            >
              {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Excel
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[24px] p-5">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">To</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-primary"
            />
          </label>
          <div className="min-w-[220px]">
            <FilterDropdown<string>
              label="Status"
              icon={Filter}
              value={statuses}
              options={statusOptions}
              placeholder="All statuses"
              hint="multi"
              onToggle={(id) => setStatuses((prev) => toggleId(prev, id))}
              onSetValue={setStatuses}
              onClear={() => setStatuses([])}
            />
          </div>
          <div className="min-w-[200px]">
            <FilterDropdown<string>
              label="Channel"
              icon={ArrowLeftRight}
              value={channels}
              options={UBL_CHANNELS.map((c) => ({ id: c.value as string, label: c.label }))}
              placeholder="All channels"
              hint="multi"
              onToggle={(id) => setChannels((prev) => toggleId(prev, id))}
              onSetValue={setChannels}
              onClear={() => setChannels([])}
            />
          </div>
          <label className="flex flex-col gap-1 flex-1 min-w-[240px]">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Search</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Transaction id, CC, student, voucher or receipt"
                className="h-11 w-full pl-9 pr-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-primary"
              />
            </div>
          </label>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 h-11 px-3 rounded-xl text-[11px] font-bold text-zinc-600 bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 hover:bg-zinc-200"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
        <TotalTile
          label="Booked at TAFS"
          value={formatRs(totals?.tafs_booked)}
          sub={`${(totals?.tafs_count ?? 0).toLocaleString()} payments, what UBL should settle`}
        />
        <TotalTile
          label="Settled by UBL"
          value={formatRs(totals?.ubl_amount)}
          sub={`${(totals?.ubl_count ?? 0).toLocaleString()} settlement lines`}
        />
        <TotalTile
          label="Difference (UBL − TAFS)"
          value={signed(totals?.difference ?? 0)}
          sub={differenceOff ? "Open the exceptions below" : "Settled in full"}
          accent={differenceOff}
        />
        <TotalTile
          label="Needs a look"
          value={(totals?.exceptions ?? 0).toLocaleString()}
          sub="Transactions that don't match"
          accent={(totals?.exceptions ?? 0) > 0}
        />
        <TotalTile
          label="1Bill charges"
          value={formatRs(totals?.tafs_channel_fee)}
          sub="Paid by parents, kept by 1Bill"
        />
        <TotalTile
          label="Reversed at TAFS"
          value={formatRs(totals?.reversed_booked)}
          sub={`${(totals?.reversed_count ?? 0).toLocaleString()} payments, not expected from UBL`}
        />
      </div>

      {totals && (
        <div className="flex flex-wrap gap-2">
          {UBL_RECON_STATUSES.map((s) => {
            const n = totals.status_counts[s.value] ?? 0;
            const on = statuses.includes(s.value);
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => setStatuses((prev) => toggleId(prev, s.value))}
                className={`flex items-center gap-2 px-3 h-8 rounded-xl border text-[11px] font-bold transition-opacity ${TONE[s.tone]} ${
                  n === 0 && !on ? "opacity-40" : ""
                } ${on ? "ring-2 ring-offset-1 ring-zinc-400 dark:ring-offset-zinc-950" : ""}`}
              >
                {s.label}
                <span className="tabular-nums">{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {imports.length === 0 && !isLoading && (
        <div className="flex items-start gap-3 rounded-2xl p-4 text-sm border bg-sky-50 border-sky-100 text-sky-900 dark:bg-sky-950/20 dark:border-sky-900/30 dark:text-sky-200">
          <FileSpreadsheet className="h-5 w-5 text-sky-500 flex-shrink-0 mt-0.5" />
          <p>
            No UBL settlement has been uploaded yet, so every payment shows as not settled.
            {canManage ? " Use Upload settlement with the statement UBL sends." : " Ask whoever handles the UBL account to upload UBL's statement."}
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[24px] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4">
          <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
            {isLoading ? "Loading…" : `${(pagination?.total ?? 0).toLocaleString()} transactions`}
          </span>
          <span className="text-[11px] font-medium text-zinc-400">
            Matched on UBL&apos;s transaction id. TAFS expects the fee amount; 1Bill keeps its own charge.
          </span>
        </div>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Matching UBL payments…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-24 text-center text-sm text-zinc-400">
            {q || hasFilters ? "No transaction matches these filters." : "No UBL payments or settlement lines in this range."}
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  {["Status", "Date", "UBL transaction id", "Channel", "CC", "Student", "Voucher", "Receipt", "Booked", "UBL settled", "Difference"].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 ${["Booked", "UBL settled", "Difference"].includes(h) ? "text-right" : "text-left"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.transaction_id} className="border-t border-zinc-100 dark:border-zinc-800 align-top">
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                      {row.note && <span className="block mt-1 text-[11px] text-zinc-500">{row.note}</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{row.date ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-700 dark:text-zinc-200">{row.transaction_id}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                      {channelLabel(row.channel)}
                      {row.payment_method && <span className="block text-[11px] text-zinc-400">{row.payment_method.replace(/_/g, " ").toLowerCase()}</span>}
                    </td>
                    <td className="px-4 py-3 font-bold text-zinc-700 dark:text-zinc-200">{row.cc ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                      {row.student_name ?? "—"}
                      {row.campus && <span className="block text-[11px] text-zinc-400">{row.campus}</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{row.voucher_number ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-500">
                      {row.deposit_id ?? "—"}
                      {row.deposit_reversed && <span className="block text-[11px] font-semibold text-rose-600">reversed</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold">
                      {money(row.tafs_booked)}
                      {(row.channel_fee ?? 0) > 0 && (
                        <span className="block text-[11px] font-medium text-zinc-400">+{formatRs(row.channel_fee)} 1Bill charge</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {money(row.ubl_amount)}
                      {row.ubl_settlement_date && <span className="block text-[11px] text-zinc-400">settled {row.ubl_settlement_date}</span>}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums font-bold ${row.difference === 0 ? "text-zinc-400" : "text-amber-600"}`}>
                      {signed(row.difference)}
                    </td>
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[24px] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
            <Scale className="h-4 w-4 text-zinc-400" />
            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Daily totals by channel</span>
          </div>
          {daily.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-400">Nothing in this range.</div>
          ) : (
            <div className="overflow-auto max-h-[420px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    {["Date", "Channel", "TAFS", "UBL", "Difference"].map((h) => (
                      <th key={h} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 ${["TAFS", "UBL", "Difference"].includes(h) ? "text-right" : "text-left"}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {daily.map((d) => (
                    <tr key={`${d.date}-${d.channel}`} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="px-4 py-2 text-zinc-500 whitespace-nowrap">{d.date}</td>
                      <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300">{channelLabel(d.channel)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatRs(d.tafs_amount)} <span className="text-[11px] text-zinc-400">({d.tafs_count})</span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatRs(d.ubl_amount)} <span className="text-[11px] text-zinc-400">({d.ubl_count})</span>
                      </td>
                      <td className={`px-4 py-2 text-right tabular-nums font-bold ${d.difference === 0 ? "text-zinc-400" : "text-amber-600"}`}>
                        {signed(d.difference)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="px-6 py-3 text-[11px] text-zinc-400 border-t border-zinc-100 dark:border-zinc-800">
            Each side is dated on its own day, so a payment taken late in the evening and settled the next day shows on both days.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[24px] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-zinc-400" />
            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Settlement uploads</span>
          </div>
          {imports.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-400">None yet.</div>
          ) : (
            <div className="overflow-auto max-h-[420px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    {["File", "Covers", "Lines", "Amount", "Uploaded", ""].map((h) => (
                      <th key={h} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 ${["Lines", "Amount"].includes(h) ? "text-right" : "text-left"}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {imports.map((imp) => (
                    <tr key={imp.id} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="px-4 py-2 text-zinc-700 dark:text-zinc-200 max-w-[180px] truncate" title={imp.file_name}>{imp.file_name}</td>
                      <td className="px-4 py-2 text-zinc-500 whitespace-nowrap">
                        {imp.first_date ? (imp.first_date === imp.last_date ? imp.first_date : `${imp.first_date} – ${imp.last_date}`) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{imp.row_count.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatRs(imp.total_amount)}</td>
                      <td className="px-4 py-2 text-zinc-500 whitespace-nowrap">
                        {new Date(imp.uploaded_at).toLocaleDateString()}
                        <span className="block text-[11px] text-zinc-400">{imp.uploaded_by}</span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => removeImport(imp)}
                            title="Remove this upload"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {(totals?.status_counts?.NOT_AT_TAFS ?? 0) + (totals?.status_counts?.REVERSED_BUT_SETTLED ?? 0) > 0 && (
        <div className="flex items-start gap-3 rounded-2xl p-4 text-sm border bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-200">
          <AlertTriangle className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5" />
          <p>
            UBL settled money that TAFS has not booked against any student. Find the payer from UBL&apos;s transaction id
            before recording it, so it isn&apos;t credited twice.
          </p>
        </div>
      )}

      {uploading && (
        <SettlementUploadDialog
          onClose={() => setUploading(false)}
          onImported={() => setReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

export default function UblCollectionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
        </div>
      }
    >
      <UblCollectionsContent />
    </Suspense>
  );
}
