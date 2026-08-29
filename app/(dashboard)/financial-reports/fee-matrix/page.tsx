"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2, Calendar, CalendarRange, CheckCircle2, ChevronDown, ChevronUp, Download, FileText,
  Gift, GraduationCap, HeartHandshake, Info, LayoutDashboard, LayoutGrid, Layers,
  Loader2, School, Search, Sigma, X,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthState } from "@/context/AuthContext";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { serializeIds, toggleId } from "@/components/filters/filter-params";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCampuses } from "@/store/slices/campusesSlice";
import { STUDENT_STATUS_OPTIONS, type YesNoFilter } from "../_components/report-filters";
import { ReportPager } from "../_components/report-pager";
import { TotalTile } from "../_components/total-tile";
import { downloadReportFile } from "../_components/download-report";
import { formatRs, generateGraduationYears, type PaginationMeta } from "../_components/report-utils";

const FEE_STATUSES = [
  { id: "NOT_ISSUED", label: "Not issued" },
  { id: "ISSUED", label: "Issued" },
  { id: "PARTIALLY_PAID", label: "Partially paid" },
  { id: "PAID", label: "Paid" },
  { id: "DISCOUNT", label: "Discount" },
] as const;

const STATUS_LEGEND = [
  { status: "NOT_ISSUED", label: "Not issued", dot: "bg-zinc-300 dark:bg-zinc-600", hint: "scheduled but not yet put on a voucher" },
  { status: "ISSUED", label: "Issued", dot: "bg-blue-500", hint: "billed on a voucher, still unpaid" },
  { status: "PAID", label: "Paid", dot: "bg-emerald-500", hint: "fully paid" },
] as const;

const STATUS_LEGEND_SECONDARY = [
  { status: "PARTIALLY_PAID", label: "Partially paid", dot: "bg-amber-500" },
  { status: "DISCOUNT", label: "Discount", dot: "bg-violet-500" },
] as const;

const ALL_STATUS_DOTS = [
  ...STATUS_LEGEND,
  ...STATUS_LEGEND_SECONDARY.map((s) => ({ ...s, hint: s.label.toLowerCase() })),
] as const;

type SegmentOption = {
  id: number;
  code: string;
  name: string;
  display_order: number;
};

type MatrixColumn = {
  year: number;
  month: number;
  label: string;
};

type MatrixHeadCell = {
  id: number;
  fee_type: string;
  amount: number;
  status: string;
};

type MatrixRow = {
  cc: number;
  gr_number: string | null;
  student_name: string;
  campus: string;
  class_name: string;
  section: string;
  cells: MatrixHeadCell[][];
  row_total: number;
};

type MatrixTotals = {
  student_count: number;
  column_totals: number[];
  grand_total: number;
};

type DistributionStats = {
  count: number;
  sum: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  mode: number[];
  variance_population: number;
  variance_sample: number;
  stddev_population: number;
  stddev_sample: number;
};

type FeeTypeStatistics = DistributionStats & {
  fee_type_id: number;
  fee_type: string;
};

type MatrixStatistics = {
  student_totals: DistributionStats;
  fee_amounts: DistributionStats;
  by_fee_type: FeeTypeStatistics[];
  truncated: boolean;
};

type StudentSearchResult = {
  cc: number;
  full_name: string;
  gr_number: string | null;
};

function statusDotClass(status: string): string {
  return ALL_STATUS_DOTS.find((s) => s.status === status)?.dot ?? "bg-zinc-300 dark:bg-zinc-600";
}

function formatMode(mode: number[]): string {
  if (mode.length === 0) return "No repeats";
  const shown = mode.slice(0, 3).map((v) => formatRs(v));
  const extra = mode.length > 3 ? ` +${mode.length - 3} more` : "";
  return shown.join(", ") + extra;
}

function toggleYesNo(current: YesNoFilter, id: string): YesNoFilter {
  const next: YesNoFilter = id === "true" || id === "false" ? id : "";
  return current === next ? "" : next;
}

const YES_NO_OPTIONS: { id: "true" | "false"; label: string }[] = [
  { id: "true", label: "Yes" },
  { id: "false", label: "No" },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function yearMonthParts(yearMonth: string): { year: number; month: number } {
  const [year, month] = yearMonth.split("-").map(Number);
  return { year, month };
}

function joinYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export default function FeeMatrixReportPage() {
  const { user } = useAuthState();
  const canViewAnalytics =
    user?.role === "SUPER_ADMIN" ||
    user?.permissions?.includes("system.analytics.view");
  const campusLocked = user?.campusId != null;
  const dispatch = useAppDispatch();
  const campuses = useAppSelector((s) => s.campuses.items);
  const campusesLoading = useAppSelector((s) => s.campuses.isLoading);

  const [toMonth, setToMonth] = useState(currentYearMonth());
  const [fromMonth, setFromMonth] = useState(() => addMonths(currentYearMonth(), -11));
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, i) => current - 4 + i);
  }, []);
  const [campusIds, setCampusIds] = useState<number[]>(
    campusLocked && user?.campusId != null ? [user.campusId] : [],
  );
  const [classIds, setClassIds] = useState<number[]>([]);
  const [sectionIds, setSectionIds] = useState<number[]>([]);
  const [segmentIds, setSegmentIds] = useState<number[]>([]);
  const [segments, setSegments] = useState<SegmentOption[]>([]);
  const [studentStatuses, setStudentStatuses] = useState<string[]>([]);
  const [feeEndowment, setFeeEndowment] = useState<YesNoFilter>("");
  const [isComplementary, setIsComplementary] = useState<YesNoFilter>("");
  const [graduatedFromClassIds, setGraduatedFromClassIds] = useState<number[]>([]);
  const [graduatedYearRange, setGraduatedYearRange] = useState("");
  const [statuses, setStatuses] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StudentSearchResult[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCc, setSelectedCc] = useState<number | null>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [columns, setColumns] = useState<MatrixColumn[]>([]);
  const [items, setItems] = useState<MatrixRow[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [totals, setTotals] = useState<MatrixTotals | null>(null);
  const [statistics, setStatistics] = useState<MatrixStatistics | null>(null);
  const [showStats, setShowStats] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState<"xlsx" | "csv" | null>(null);

  useEffect(() => {
    if (campuses.length === 0) dispatch(fetchCampuses());
  }, [campuses.length, dispatch]);

  useEffect(() => {
    api.get("/v1/financial-reports/filter-options")
      .then(({ data }) => {
        const list = (data?.data?.segments ?? []) as SegmentOption[];
        setSegments([...list].sort((a, b) => a.display_order - b.display_order));
      })
      .catch(() => setSegments([]));
  }, []);

  useEffect(() => {
    if (campusLocked && user?.campusId != null) setCampusIds([user.campusId]);
  }, [campusLocked, user?.campusId]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      if (selectedCc != null) setSelectedCc(null);
      return;
    }
    if (searchQuery.includes("CC:")) return;

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/v1/students/search-simple", { params: { q: searchQuery } });
        setSearchResults(data?.data ?? []);
        setShowSearchDropdown(true);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const handleSelectStudent = (s: StudentSearchResult) => {
    setSearchQuery(`${s.full_name} (CC: ${s.cc})`);
    setSelectedCc(s.cc);
    setShowSearchDropdown(false);
  };

  const clearStudent = () => {
    setSearchQuery("");
    setSelectedCc(null);
    setShowSearchDropdown(false);
  };

  const scopedCampuses = useMemo(() => {
    if (campusIds.length === 0) return campuses;
    return campuses.filter((c) => campusIds.includes(c.id));
  }, [campuses, campusIds]);

  const classOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const campus of scopedCampuses) {
      for (const cls of campus.offered_classes ?? []) {
        map.set(cls.id, cls.description);
      }
    }
    return Array.from(map, ([id, label]) => ({ id, label }));
  }, [scopedCampuses]);

  const sectionOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const campus of scopedCampuses) {
      for (const cls of campus.offered_classes ?? []) {
        if (classIds.length > 0 && !classIds.includes(cls.id)) continue;
        for (const section of cls.sections ?? []) {
          map.set(section.id, section.description);
        }
      }
    }
    return Array.from(map, ([id, label]) => ({ id, label }));
  }, [scopedCampuses, classIds]);

  const graduationYears = useMemo(() => generateGraduationYears(), []);

  useEffect(() => {
    if (classOptions.length === 0) return;
    const valid = new Set(classOptions.map((c) => c.id));
    setClassIds((prev) => {
      const next = prev.filter((id) => valid.has(id));
      return next.length !== prev.length ? next : prev;
    });
  }, [classOptions]);

  useEffect(() => {
    if (sectionOptions.length === 0) return;
    const valid = new Set(sectionOptions.map((s) => s.id));
    setSectionIds((prev) => {
      const next = prev.filter((id) => valid.has(id));
      return next.length !== prev.length ? next : prev;
    });
  }, [sectionOptions]);

  const buildParams = useCallback(() => ({
    from_month: fromMonth,
    to_month: toMonth,
    campus_id: serializeIds(campusIds),
    class_id: serializeIds(classIds),
    section_id: serializeIds(sectionIds),
    segment_id: serializeIds(segmentIds),
    cc: selectedCc ?? undefined,
    student_status: serializeIds(studentStatuses),
    is_fee_endowment: feeEndowment || undefined,
    is_complementary: isComplementary || undefined,
    graduated_from_class_id: serializeIds(graduatedFromClassIds),
    graduated_year_range: graduatedYearRange || undefined,
    status: serializeIds(statuses),
  }), [
    fromMonth, toMonth, campusIds, classIds, sectionIds, segmentIds, selectedCc,
    studentStatuses, feeEndowment, isComplementary, graduatedFromClassIds, graduatedYearRange, statuses,
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    fromMonth, toMonth, campusIds, classIds, sectionIds, segmentIds, selectedCc,
    studentStatuses, feeEndowment, isComplementary, graduatedFromClassIds, graduatedYearRange, statuses, pageSize,
  ]);

  const rangeValid = fromMonth <= toMonth;

  useEffect(() => {
    if (!canViewAnalytics) {
      setIsLoading(false);
      return;
    }
    if (!rangeValid) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    const fetchRows = async () => {
      setIsLoading(true);
      try {
        const { data } = await api.get("/v1/financial-reports/fee-matrix", {
          params: { ...buildParams(), page, limit: pageSize },
        });
        if (cancelled) return;
        setColumns(data?.data?.columns ?? []);
        setItems(data?.data?.items ?? []);
        setPagination(data?.data?.pagination ?? null);
        setTotals(data?.data?.totals ?? null);
        setStatistics(data?.data?.statistics ?? null);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load fee matrix report");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchRows();
    return () => {
      cancelled = true;
    };
  }, [buildParams, canViewAnalytics, page, pageSize, rangeValid]);

  const handleExport = async (format: "xlsx" | "csv") => {
    if (!rangeValid) {
      toast.error("From month must be on or before to month");
      return;
    }
    setIsExporting(format);
    try {
      await downloadReportFile(
        "/v1/financial-reports/fee-matrix/export",
        { ...buildParams(), format },
        `fee-matrix-${fromMonth}-to-${toMonth}.${format}`,
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to export fee matrix report");
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

  const lockedCampusName =
    campuses.find((c) => c.id === user?.campusId)?.campus_name || "Your Campus";
  const rangeLabel = columns.length
    ? `${columns[0].label} – ${columns[columns.length - 1].label}`
    : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight font-outfit">
            Fee Matrix
          </h1>
          <p className="text-sm font-medium text-zinc-400 mt-1">
            One row per student, one column per month — heads placed by target month. Discounts are netted in as negative cells; late payment surcharges are excluded.
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

      <div className={`flex items-start gap-3 rounded-2xl p-4 text-sm border ${
        rangeValid
          ? "bg-blue-50 border-blue-100 text-blue-900 dark:bg-blue-950/20 dark:border-blue-900/30 dark:text-blue-200"
          : "bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-200"
      }`}>
        <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
        {rangeValid ? (
          <p>
            Each head is placed by its own target month — resolved to a real calendar month using the term it was written under (Apr-Mar for classes VI-X, Aug-Jul for everyone else), not a fixed assumption. Discount heads appear as negative-amount cells (violet dot, see legend) and net into row/column/grand totals and the statistics below, which cover every student matching the filters, not just the rows on this page.
          </p>
        ) : (
          <p>From month must be on or before to month.</p>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[24px] p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] flex items-center gap-1.5 ml-1">
              <Calendar className="h-3 w-3" /> From month
            </label>
            <div className="flex gap-1.5">
              <select
                value={yearMonthParts(fromMonth).month}
                onChange={(e) => setFromMonth(joinYearMonth(yearMonthParts(fromMonth).year, Number(e.target.value)))}
                className="h-11 px-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-primary"
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i + 1}>{name}</option>
                ))}
              </select>
              <select
                value={yearMonthParts(fromMonth).year}
                onChange={(e) => setFromMonth(joinYearMonth(Number(e.target.value), yearMonthParts(fromMonth).month))}
                className="h-11 px-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-primary"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] flex items-center gap-1.5 ml-1">
              <Calendar className="h-3 w-3" /> To month
            </label>
            <div className="flex gap-1.5">
              <select
                value={yearMonthParts(toMonth).month}
                onChange={(e) => setToMonth(joinYearMonth(yearMonthParts(toMonth).year, Number(e.target.value)))}
                className="h-11 px-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-primary"
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i + 1}>{name}</option>
                ))}
              </select>
              <select
                value={yearMonthParts(toMonth).year}
                onChange={(e) => setToMonth(joinYearMonth(Number(e.target.value), yearMonthParts(toMonth).month))}
                className="h-11 px-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-primary"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {campusLocked ? (
            <div className="flex items-center gap-2 h-11 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm font-bold text-zinc-600 dark:text-zinc-300 min-w-[200px]">
              <Building2 className="h-4 w-4 text-zinc-400" />
              {lockedCampusName}
            </div>
          ) : (
            <div className="min-w-[220px]">
              <FilterDropdown
                label="Campus"
                icon={Building2}
                value={campusIds}
                options={campuses.map((c) => ({ id: c.id, label: c.campus_name }))}
                loading={campusesLoading}
                placeholder="All campuses"
                hint="multi"
                onToggle={(id) => setCampusIds(toggleId(campusIds, id))}
                onSetValue={setCampusIds}
                onClear={() => setCampusIds([])}
              />
            </div>
          )}

          <div className="min-w-[200px]">
            <FilterDropdown
              label="Class"
              icon={GraduationCap}
              value={classIds}
              options={classOptions}
              placeholder="All classes"
              hint="multi"
              onToggle={(id) => setClassIds(toggleId(classIds, id))}
              onSetValue={setClassIds}
              onClear={() => setClassIds([])}
            />
          </div>

          <div className="min-w-[180px]">
            <FilterDropdown
              label="Section"
              icon={LayoutGrid}
              value={sectionIds}
              options={sectionOptions}
              placeholder="All sections"
              hint="multi"
              onToggle={(id) => setSectionIds(toggleId(sectionIds, id))}
              onSetValue={setSectionIds}
              onClear={() => setSectionIds([])}
            />
          </div>

          <div className="min-w-[200px]">
            <FilterDropdown
              label="Segment"
              icon={Layers}
              value={segmentIds}
              options={segments.map((s) => ({ id: s.id, label: s.name, sub: s.code }))}
              placeholder="All segments"
              hint="multi"
              onToggle={(id) => setSegmentIds(toggleId(segmentIds, id))}
              onSetValue={setSegmentIds}
              onClear={() => setSegmentIds([])}
            />
          </div>

          <div className="min-w-[200px]">
            <FilterDropdown
              label="Student status"
              icon={CheckCircle2}
              value={studentStatuses}
              options={[...STUDENT_STATUS_OPTIONS]}
              placeholder="All statuses"
              hint="multi"
              onToggle={(id) => setStudentStatuses(toggleId(studentStatuses, id))}
              onSetValue={setStudentStatuses}
              onClear={() => setStudentStatuses([])}
            />
          </div>

          <div className="min-w-[180px]">
            <FilterDropdown
              label="Fee Endowment"
              icon={Gift}
              value={feeEndowment ? [feeEndowment] : []}
              options={YES_NO_OPTIONS}
              placeholder="All"
              onToggle={(id) => setFeeEndowment(toggleYesNo(feeEndowment, id))}
              onClear={() => setFeeEndowment("")}
            />
          </div>

          <div className="min-w-[180px]">
            <FilterDropdown
              label="Complementary"
              icon={HeartHandshake}
              value={isComplementary ? [isComplementary] : []}
              options={YES_NO_OPTIONS}
              placeholder="All"
              onToggle={(id) => setIsComplementary(toggleYesNo(isComplementary, id))}
              onClear={() => setIsComplementary("")}
            />
          </div>

          <div className="min-w-[200px]">
            <FilterDropdown
              label="Graduated From"
              icon={School}
              value={graduatedFromClassIds}
              options={classOptions}
              placeholder="Any class"
              hint="multi"
              onToggle={(id) => setGraduatedFromClassIds(toggleId(graduatedFromClassIds, id))}
              onSetValue={setGraduatedFromClassIds}
              onClear={() => setGraduatedFromClassIds([])}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] flex items-center gap-1.5 ml-1">
              <CalendarRange className="h-3 w-3" /> Graduation Year
            </label>
            <select
              value={graduatedYearRange}
              onChange={(e) => setGraduatedYearRange(e.target.value)}
              className="h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-primary"
            >
              <option value="">Any Year</option>
              {graduationYears.map((yr) => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>

          <div className="min-w-[200px]">
            <FilterDropdown
              label="Status"
              icon={FileText}
              value={statuses}
              options={FEE_STATUSES.map((s) => ({ id: s.id, label: s.label }))}
              placeholder="All statuses"
              hint="multi"
              onToggle={(id) => setStatuses(toggleId(statuses, id))}
              onSetValue={setStatuses}
              onClear={() => setStatuses([])}
            />
          </div>

          <div className="flex flex-col gap-1.5 relative" ref={searchDropdownRef}>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] flex items-center gap-1.5 ml-1">
              <Search className="h-3 w-3" /> Student
            </label>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search by name, CC, or GR..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-9 pr-9 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/40 transition-all placeholder:text-zinc-400"
              />
              {searchQuery && (
                <button type="button" onClick={clearStudent} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-500 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              )}
              {isSearching && (
                <div className="absolute right-9 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                </div>
              )}
            </div>
            {showSearchDropdown && searchResults.length > 0 && (
              <div className="absolute z-50 top-full mt-1 w-64 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
                <div className="max-h-64 overflow-y-auto p-2">
                  {searchResults.map((s) => (
                    <button
                      key={s.cc}
                      type="button"
                      onClick={() => handleSelectStudent(s)}
                      className="w-full flex items-center justify-between px-3 h-12 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all group"
                    >
                      <div className="flex flex-col items-start text-left">
                        <span className="text-[13px] font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-primary transition-colors">{s.full_name}</span>
                        <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">GR: {s.gr_number || "N/A"}</span>
                      </div>
                      <span className="text-[11px] font-black bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2.5 py-1 rounded-full group-hover:bg-primary group-hover:text-white transition-all">{s.cc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <TotalTile label="Students" value={(totals?.student_count ?? 0).toLocaleString()} />
        <TotalTile label="Grand total" value={formatRs(totals?.grand_total)} accent />
        <TotalTile label="Range" value={rangeLabel || "—"} sub={`${columns.length} month${columns.length === 1 ? "" : "s"}`} />
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[24px] p-4 space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Cell status legend</p>
        <div className="flex flex-col gap-1.5">
          {STATUS_LEGEND.map((s) => (
            <div key={s.status} className="flex items-center gap-2 text-sm">
              <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
              <span className="font-semibold text-zinc-700 dark:text-zinc-200">{s.label}</span>
              <span className="text-zinc-400">— {s.hint}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-zinc-400">
          {STATUS_LEGEND_SECONDARY.map((s, i) => (
            <span key={s.status} className="inline-flex items-center gap-1.5 mr-3">
              <span className={`h-1.5 w-1.5 rounded-full inline-block ${s.dot}`} />
              {s.label.toLowerCase()}
              {i < STATUS_LEGEND_SECONDARY.length - 1 && " and"}
            </span>
          ))}
          are present too, just less common in most filters.
        </p>
      </div>

      {statistics && (
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[24px] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowStats((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-4"
          >
            <span className="flex items-center gap-2 text-sm font-bold text-zinc-700 dark:text-zinc-300">
              <Sigma className="h-4 w-4 text-zinc-400" /> Statistics for the current filters
            </span>
            {showStats ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
          </button>
          {showStats && (
            <div className="px-6 pb-6 space-y-5">
              <p className="text-[11px] text-zinc-400 font-medium">
                Computed across every student and head matching the filters above — not just the rows on this page. Variance and standard deviation are given both ways: population (n) and sample (n-1).
                {statistics.truncated && " The underlying head list was capped for this computation, so these figures may undercount an unusually large filtered set."}
              </p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <DistributionCard title="Student totals (row totals)" stats={statistics.student_totals} />
                <DistributionCard title="Individual fee amounts (all heads)" stats={statistics.fee_amounts} />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-2">Variation by fee type</p>
                <div className="overflow-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800">
                      <tr>
                        {["Fee type", "Count", "Sum", "Mean", "Median", "Mode", "Min", "Max", "Var (pop)", "Var (sample)", "SD (pop)", "SD (sample)"].map((h, i) => (
                          <th key={h} className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 whitespace-nowrap ${i === 0 ? "text-left" : "text-right"}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {statistics.by_fee_type.map((row) => (
                        <tr key={row.fee_type_id} className="border-t border-zinc-100 dark:border-zinc-800">
                          <td className="px-3 py-2 font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">{row.fee_type}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.count.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatRs(row.sum)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatRs(row.mean)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatRs(row.median)}</td>
                          <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatMode(row.mode)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatRs(row.min)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatRs(row.max)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatRs(row.variance_population)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatRs(row.variance_sample)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatRs(row.stddev_population)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatRs(row.stddev_sample)}</td>
                        </tr>
                      ))}
                      {statistics.by_fee_type.length === 0 && (
                        <tr>
                          <td colSpan={12} className="px-3 py-6 text-center text-zinc-400">No heads match these filters.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[24px] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
            {isLoading ? "Loading…" : `${(pagination?.total ?? 0).toLocaleString()} students`}
          </span>
        </div>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Fetching matrix…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-24 text-center text-sm text-zinc-400">No students match these filters.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  {["CC", "GR", "Name", "Campus", "Class", "Section"].map((h) => (
                    <th key={h} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-left whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                  {columns.map((col) => (
                    <th key={`${col.year}-${col.month}`} className="px-3 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-right whitespace-nowrap">
                      {col.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-right whitespace-nowrap">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.cc} className="border-t border-zinc-100 dark:border-zinc-800 align-top">
                    <td className="px-4 py-3 font-bold text-zinc-700 dark:text-zinc-200 whitespace-nowrap">{row.cc}</td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{row.gr_number ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">{row.student_name}</td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{row.campus}</td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{row.class_name}</td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{row.section}</td>
                    {row.cells.map((cell, idx) => (
                      <td key={idx} className="px-3 py-3 text-right min-w-[110px]">
                        {cell.length === 0 ? (
                          <span className="text-zinc-300 dark:text-zinc-700">—</span>
                        ) : (
                          <div className="flex flex-col gap-1 items-end">
                            {cell.map((head) => (
                              <div key={head.id} className="flex items-center gap-1.5 justify-end">
                                <span className="text-[10px] text-zinc-400 truncate max-w-[90px]" title={head.fee_type}>
                                  {head.fee_type}
                                </span>
                                <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${statusDotClass(head.status)}`} />
                                <span className="font-semibold tabular-nums whitespace-nowrap">{formatRs(head.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-bold tabular-nums whitespace-nowrap">{formatRs(row.row_total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
                  <td colSpan={6} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Total (all filtered students)
                  </td>
                  {(totals?.column_totals ?? columns.map(() => 0)).map((value, idx) => (
                    <td key={idx} className="px-3 py-3 text-right font-bold tabular-nums whitespace-nowrap">
                      {formatRs(value)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-black tabular-nums whitespace-nowrap">
                    {formatRs(totals?.grand_total)}
                  </td>
                </tr>
              </tfoot>
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

function DistributionCard({ title, stats }: { title: string; stats: DistributionStats }) {
  const rows: [string, string][] = [
    ["Count", stats.count.toLocaleString()],
    ["Sum", formatRs(stats.sum)],
    ["Mean", formatRs(stats.mean)],
    ["Median", formatRs(stats.median)],
    ["Mode", formatMode(stats.mode)],
    ["Min", formatRs(stats.min)],
    ["Max", formatRs(stats.max)],
    ["Variance (population)", formatRs(stats.variance_population)],
    ["Variance (sample)", formatRs(stats.variance_sample)],
    ["Std deviation (population)", formatRs(stats.stddev_population)],
    ["Std deviation (sample)", formatRs(stats.stddev_sample)],
  ];
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
      <p className="text-[11px] font-black uppercase tracking-widest text-zinc-500 mb-3">{title}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-xs text-zinc-400 font-medium">{label}</dt>
            <dd className="text-xs font-bold text-zinc-800 dark:text-zinc-100 text-right tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

