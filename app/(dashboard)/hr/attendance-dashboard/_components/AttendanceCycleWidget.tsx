"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, Briefcase, Building2, ChevronLeft, ChevronRight, Download, Flag, Layers, LayoutGrid, List, Loader2, Search, ShieldAlert, SlidersHorizontal, Tag, X } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCampuses } from "@/store/slices/campusesSlice";
import { useAuthState } from "@/context/AuthContext";
import { useScopedCampusPicker } from "@/hooks/use-scoped-campus-picker";
import { useEmployeeAttendanceCycleAccess } from "@/hooks/use-employee-attendance-cycle-access";
import { hrService, AttendanceLineBase, AttendanceMatrixParams, Department, Segment } from "@/lib/hr.service";
import { segmentsForCampuses } from "@/lib/segments";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { toggleId, serializeIds } from "@/components/filters/filter-params";
import { PayrollMatrixView } from "../../payroll/_components/PayrollMatrixView";
import { PayrollLineDetailModal } from "../../payroll/_components/PayrollLineDetailModal";
import { AttendanceTagBadges } from "../../payroll/_components/AttendanceTagBadges";

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

interface CycleKey { year: number; month: number } // `month` is 1-indexed and names the cycle by the month its 25th falls in — same convention as the backend's GeneratePayrollRunDto.

/** Which fixed payroll cycle (26th–25th) contains today — mirrors currentPayrollPeriodLabel in the backend's payroll-period.util.ts. */
function currentCycleKey(): CycleKey {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth() + 1;
    const d = now.getUTCDate();
    if (d >= 26) return m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 };
    return { year: y, month: m };
}

function shiftCycle({ year, month }: CycleKey, delta: number): CycleKey {
    const idx = year * 12 + (month - 1) + delta;
    return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

/**
 * Fixed school payroll cycle window for a given cycle key — mirrors
 * computePayrollWindow in the backend's payroll-period.util.ts. Bounded at
 * today when the cycle hasn't finished yet, since future days have no
 * attendance.
 */
function cycleWindow({ year, month }: CycleKey): { periodStart: string; periodEnd: string; label: string } {
    const start = new Date(Date.UTC(year, month - 2, 26));
    const end = new Date(Date.UTC(year, month - 1, 25));
    const todayIso = new Date().toISOString().slice(0, 10);
    const endIso = end.toISOString().slice(0, 10);

    return {
        periodStart: start.toISOString().slice(0, 10),
        periodEnd: endIso > todayIso ? todayIso : endIso,
        label: `${start.getUTCDate()} ${MONTHS[start.getUTCMonth()].slice(0, 3)} – ${end.getUTCDate()} ${MONTHS[end.getUTCMonth()].slice(0, 3)} ${end.getUTCFullYear()}`,
    };
}

/**
 * Client-side flags over the loaded lines — these come from computed
 * attendance, not employee fields, so the backend can't filter on them.
 * Selecting several matches employees with any of them.
 */
const FLAG_OPTIONS: { id: string; label: string; test: (line: AttendanceLineBase) => boolean }[] = [
    { id: "unresolved", label: "Has unresolved days", test: (l) => l.unresolved_days > 0 },
    { id: "absent", label: "Has absences / unpaid", test: (l) => l.absent_days + (l.unpaid_leave_days ?? 0) > 0 },
    { id: "late", label: "Came late", test: (l) => l.total_late_minutes > 0 },
    { id: "no_punches", label: "Mapped, no punches", test: (l) => l.is_mapped && !l.has_punches },
    { id: "unmapped", label: "Not mapped to device", test: (l) => !l.is_mapped },
    { id: "no_salary", label: "No salary set", test: (l) => !l.has_salary },
];

const FILTER_LABEL_CLASS = "text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] flex items-center gap-1.5 ml-1";

function initials(name: string | null): string {
    if (!name) return "?";
    return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function EmployeeLinesTable({ lines, onOpenLine }: { lines: AttendanceLineBase[]; onOpenLine: (line: AttendanceLineBase) => void }) {
    if (lines.length === 0) {
        return <p className="text-sm text-zinc-500 text-center py-14">No employees found.</p>;
    }

    return (
        <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                            <th className="px-5 py-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Employee</th>
                            <th className="px-4 py-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest text-center">Present</th>
                            <th className="px-4 py-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest text-center">Absent / Unpaid</th>
                            <th className="px-4 py-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest text-center">Unresolved</th>
                            <th className="px-4 py-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest text-center">Late (min)</th>
                            <th className="px-5 py-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest text-center">Break (min)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {lines.map((line) => {
                            const emp = line.employee_profiles;
                            const name = emp?.full_name ?? `Employee #${line.employee_id}`;
                            const hasIssue = line.unresolved_days > 0;

                            return (
                                <tr
                                    key={line.employee_id}
                                    onClick={() => onOpenLine(line)}
                                    className={`cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 transition-colors ${hasIssue ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}
                                >
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-3">
                                            {emp?.photo_url ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={emp.photo_url.replace(/([^:])\/\//g, "$1/")} alt={name} className="h-8 w-8 rounded-lg object-cover bg-zinc-100" />
                                            ) : (
                                                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                                    {initials(name)}
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-sm font-semibold text-zinc-900 dark:text-white leading-tight">{name}</p>
                                                <p className="text-[11px] text-zinc-400 font-mono">
                                                    {emp?.employee_code ?? "—"}
                                                    {line.campus_name && <span className="ml-1.5 text-zinc-300 dark:text-zinc-600">· {line.campus_name}</span>}
                                                </p>
                                                <AttendanceTagBadges line={line} className="mt-1" />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-zinc-600 dark:text-zinc-300">{line.present_days}</td>
                                    <td className="px-4 py-3 text-center text-sm">
                                        {(line.absent_days + (line.unpaid_leave_days ?? 0)) > 0 ? (
                                            <span className="font-semibold text-rose-600">
                                                {line.absent_days + (line.unpaid_leave_days ?? 0)}
                                                {(line.unpaid_leave_days ?? 0) > 0 && (
                                                    <span className="text-[10px] font-normal text-zinc-400 ml-1">({line.unpaid_leave_days} unpaid)</span>
                                                )}
                                            </span>
                                        ) : (
                                            <span className="text-zinc-300 dark:text-zinc-600">0</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm">
                                        {hasIssue ? (
                                            <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                                                <AlertTriangle className="h-3 w-3" /> {line.unresolved_days}
                                            </span>
                                        ) : (
                                            <span className="text-zinc-300 dark:text-zinc-600">0</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm">
                                        {line.total_late_minutes > 0 ? <span className="font-semibold text-amber-600">{line.total_late_minutes}</span> : <span className="text-zinc-300 dark:text-zinc-600">0</span>}
                                    </td>
                                    <td className="px-5 py-3 text-center text-sm text-zinc-600 dark:text-zinc-300">{line.total_break_minutes}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export function AttendanceCycleWidget() {
    const dispatch = useAppDispatch();
    const campuses = useAppSelector((s) => s.campuses.items);
    const { user } = useAuthState();
    const access = useEmployeeAttendanceCycleAccess();
    const canView = access.can("view");
    const canExport = access.can("export");
    const canMark = access.can("mark");
    const { options: scopedCampuses, isLocked: campusLocked, lockedCampus } = useScopedCampusPicker(campuses);

    // Empty means every campus in the caller's scope — the backend resolves it.
    const [campusIds, setCampusIds] = useState<number[]>([]);
    const [departmentIds, setDepartmentIds] = useState<number[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [staffCategoryIds, setStaffCategoryIds] = useState<number[]>([]);
    const [segmentIds, setSegmentIds] = useState<number[]>([]);
    const [segments, setSegments] = useState<Segment[]>([]);
    const [flagIds, setFlagIds] = useState<string[]>([]);
    const [cycle, setCycle] = useState<CycleKey>(currentCycleKey());
    const [tab, setTab] = useState<"lines" | "matrix">("lines");
    const [lines, setLines] = useState<AttendanceLineBase[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedLine, setSelectedLine] = useState<AttendanceLineBase | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
    const [search, setSearch] = useState("");
    // Search runs server-side, so wait for typing to settle before refetching.
    const [debouncedSearch, setDebouncedSearch] = useState("");
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
        return () => clearTimeout(t);
    }, [search]);

    const cycleDefault = cycleWindow(cycle);
    // Admin can override the auto-selected cycle dates; null means "use the cycle default".
    const [customStart, setCustomStart] = useState<string | null>(null);
    const [customEnd, setCustomEnd] = useState<string | null>(null);
    const periodStart = customStart ?? cycleDefault.periodStart;
    const periodEnd = customEnd ?? cycleDefault.periodEnd;
    const label = customStart || customEnd ? `${periodStart} – ${periodEnd}` : cycleDefault.label;
    const isCurrentCycle = cycle.year === currentCycleKey().year && cycle.month === currentCycleKey().month;

    const filteredLines = useMemo(() => {
        const activeFlags = FLAG_OPTIONS.filter((f) => flagIds.includes(f.id));
        if (activeFlags.length === 0) return lines;
        return lines.filter((line) => activeFlags.some((f) => f.test(line)));
    }, [lines, flagIds]);

    useEffect(() => {
        dispatch(fetchCampuses());
        hrService.listDepartments().then(setDepartments).catch(console.error);
        hrService.listSegments().then(setSegments).catch(console.error);
    }, [dispatch]);

    const campusOptions = useMemo(
        () => scopedCampuses.map((c) => ({ id: c.id, label: c.campus_name })),
        [scopedCampuses],
    );

    const departmentOptions = useMemo(
        () => departments.map((d) => ({ id: d.id, label: d.name })),
        [departments],
    );

    // Narrowed to the picked departments so the list stays relevant.
    const staffCategoryOptions = useMemo(
        () => departments
            .filter((d) => departmentIds.length === 0 || departmentIds.includes(d.id))
            .flatMap((d) => (d.staff_categories ?? []).map((c) => ({ id: c.id, label: c.name, sub: d.name }))),
        [departments, departmentIds],
    );

    // Narrowed to segments the picked campuses (or the locked one) actually run.
    const segmentOptions = useMemo(
        () => segmentsForCampuses(segments, lockedCampus ? [lockedCampus.id] : campusIds)
            .sort((a, b) => a.display_order - b.display_order)
            .map((s) => ({ id: s.id, label: s.name })),
        [segments, campusIds, lockedCampus],
    );

    const flagOptions = useMemo(() => FLAG_OPTIONS.map(({ id, label }) => ({ id, label })), []);

    // Drop picked categories that no longer belong to a picked department.
    useEffect(() => {
        setStaffCategoryIds((prev) => {
            const valid = new Set(staffCategoryOptions.map((o) => o.id));
            const next = prev.filter((id) => valid.has(id));
            return next.length === prev.length ? prev : next;
        });
    }, [staffCategoryOptions]);

    // Same for segments no picked campus runs.
    useEffect(() => {
        setSegmentIds((prev) => {
            const valid = new Set(segmentOptions.map((o) => o.id));
            const next = prev.filter((id) => valid.has(id));
            return next.length === prev.length ? prev : next;
        });
    }, [segmentOptions]);

    const activeFilterCount =
        (debouncedSearch ? 1 : 0) +
        (campusIds.length ? 1 : 0) +
        (departmentIds.length ? 1 : 0) +
        (staffCategoryIds.length ? 1 : 0) +
        (segmentIds.length ? 1 : 0) +
        (flagIds.length ? 1 : 0);

    // Nothing loads until at least one filter is applied — the unfiltered
    // view is every employee in scope for the whole cycle.
    const hasFilters = activeFilterCount > 0;

    const clearFilters = () => {
        setSearch("");
        setDebouncedSearch("");
        setCampusIds([]);
        setDepartmentIds([]);
        setStaffCategoryIds([]);
        setSegmentIds([]);
        setFlagIds([]);
    };

    const PAGE_SIZE = 50;

    // Filter params without pagination — changes here reset the page to 1.
    const filterParams = useMemo<AttendanceMatrixParams>(
        () => ({
            ...(campusIds.length ? { campus_id: serializeIds(campusIds) } : {}),
            ...(departmentIds.length ? { department_id: serializeIds(departmentIds) } : {}),
            ...(staffCategoryIds.length ? { staff_category_id: serializeIds(staffCategoryIds) } : {}),
            ...(segmentIds.length ? { segment_id: serializeIds(segmentIds) } : {}),
            ...(debouncedSearch ? { search: debouncedSearch } : {}),
            period_start: periodStart,
            period_end: periodEnd,
        }),
        [campusIds, departmentIds, staffCategoryIds, segmentIds, debouncedSearch, periodStart, periodEnd],
    );

    // Reset to page 1 whenever any filter changes.
    const prevFilterParams = useRef(filterParams);
    useEffect(() => {
        if (prevFilterParams.current !== filterParams) {
            prevFilterParams.current = filterParams;
            setPage(1);
        }
    }, [filterParams]);

    const matrixParams = useMemo<AttendanceMatrixParams>(
        () => ({ ...filterParams, page, limit: PAGE_SIZE }),
        [filterParams, page],
    );

    const load = useCallback(async () => {
        if (!canView) return;
        if (!hasFilters) { setLines([]); setTotal(0); setError(null); return; }
        setLoading(true);
        setError(null);
        try {
            const matrix = await hrService.getAttendanceMatrix(matrixParams);
            setLines(matrix.lines);
            // Fall back to lines.length when talking to an older backend that
            // doesn't return total yet. This means pagination won't appear until
            // the backend is restarted, but at least the app doesn't break.
            setTotal(matrix.total ?? matrix.lines.length);
        } catch {
            setError("Failed to load attendance data.");
        } finally {
            setLoading(false);
        }
    }, [canView, hasFilters, matrixParams]);

    useEffect(() => { load(); }, [load]);

    const handleExport = async () => {
        if (!canExport || exporting || !hasFilters || total === 0) return;
        setExporting(true);
        try {
            await hrService.exportAttendanceMatrix(filterParams);
        } catch {
            setError("Failed to export attendance data.");
        } finally {
            setExporting(false);
        }
    };

    if (access.hasTile && !canView && !access.staleSession) {
        return (
            <div className="p-12 text-center bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl m-4 md:m-8">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center mb-4">
                    <ShieldAlert className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Permission Denied</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
                    You have access to the Employee Attendance by Cycle tile, but viewing cycle attendance has been restricted by your administrator.
                </p>
            </div>
        );
    }

    if (!access.hasTile && user && user.role !== "SUPER_ADMIN") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="p-4 bg-red-50 text-red-500 rounded-full">
                    <ShieldAlert className="h-12 w-12" />
                </div>
                <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100">Access Denied</h2>
                <p className="text-zinc-500 max-w-xs text-center text-sm font-medium">
                    You do not have permission to view employee attendance by cycle.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{label}</h2>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => { setCustomStart(null); setCustomEnd(null); setCycle((c) => shiftCycle(c, -1)); }}
                            className="h-7 w-7 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                            aria-label="Previous cycle"
                        >
                            <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                            onClick={() => { setCustomStart(null); setCustomEnd(null); setCycle((c) => shiftCycle(c, 1)); }}
                            disabled={isCurrentCycle && !customStart && !customEnd}
                            className="h-7 w-7 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Next cycle"
                        >
                            <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    <div className="flex items-center gap-1.5 ml-1">
                        <input
                            type="date"
                            value={periodStart}
                            max={periodEnd}
                            onChange={(e) => setCustomStart(e.target.value)}
                            className="h-8 px-2 border rounded-lg text-xs bg-white dark:bg-zinc-950 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary/30"
                            aria-label="Period start date"
                        />
                        <span className="text-zinc-400 text-xs">to</span>
                        <input
                            type="date"
                            value={periodEnd}
                            min={periodStart}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            className="h-8 px-2 border rounded-lg text-xs bg-white dark:bg-zinc-950 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary/30"
                            aria-label="Period end date"
                        />
                    </div>
                </div>
                {canExport && (
                    <button
                        onClick={handleExport}
                        disabled={exporting || !hasFilters || total === 0}
                        title="Flags only narrow the on-screen view; the export includes every employee matching the other filters."
                        className="h-9 px-3 flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors disabled:opacity-50"
                    >
                        {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        Excel
                    </button>
                )}
            </div>

            <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <SlidersHorizontal className="h-4 w-4 text-zinc-500" />
                        <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-200">Filters</h3>
                        {activeFilterCount > 0 && (
                            <span className="h-5 min-w-5 px-1.5 flex items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                                {activeFilterCount}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {hasFilters && !loading && total > 0 && (
                            <span className="text-xs text-zinc-400 font-medium">
                                {flagIds.length > 0
                                    ? `${filteredLines.length} match on page ${page} · ${total} total`
                                    : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
                            </span>
                        )}
                        {activeFilterCount > 0 && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                            >
                                Clear all
                            </button>
                        )}
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                        type="text"
                        placeholder="Search by name, code, CNIC, or role..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-10 pl-10 pr-9 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                            aria-label="Clear search"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {campusLocked ? (
                        <div className="flex flex-col gap-1.5">
                            <label className={FILTER_LABEL_CLASS}><Building2 className="h-3 w-3" /> Campus</label>
                            <div className="h-11 flex items-center px-4 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-900 font-semibold text-zinc-700 dark:text-zinc-200">
                                {lockedCampus!.campus_name}
                            </div>
                        </div>
                    ) : (
                        <FilterDropdown
                            label="Campus"
                            icon={Building2}
                            value={campusIds}
                            options={campusOptions}
                            placeholder="All campuses"
                            onToggle={(id) => setCampusIds((prev) => toggleId(prev, id))}
                            onClear={() => setCampusIds([])}
                            onSetValue={setCampusIds}
                        />
                    )}
                    <FilterDropdown
                        label="Department"
                        icon={Briefcase}
                        value={departmentIds}
                        options={departmentOptions}
                        placeholder="All departments"
                        onToggle={(id) => setDepartmentIds((prev) => toggleId(prev, id))}
                        onClear={() => setDepartmentIds([])}
                    />
                    <FilterDropdown
                        label="Staff Category"
                        icon={Tag}
                        value={staffCategoryIds}
                        options={staffCategoryOptions}
                        placeholder="All categories"
                        onToggle={(id) => setStaffCategoryIds((prev) => toggleId(prev, id))}
                        onClear={() => setStaffCategoryIds([])}
                    />
                    <FilterDropdown
                        label="Segment"
                        icon={Layers}
                        value={segmentIds}
                        options={segmentOptions}
                        placeholder="All segments"
                        onToggle={(id) => setSegmentIds((prev) => toggleId(prev, id))}
                        onClear={() => setSegmentIds([])}
                    />
                    <FilterDropdown<string>
                        label="Flags"
                        icon={Flag}
                        value={flagIds}
                        options={flagOptions}
                        placeholder="Any"
                        onToggle={(id) => setFlagIds((prev) => toggleId(prev, id))}
                        onClear={() => setFlagIds([])}
                    />
                </div>
            </div>

            <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl w-fit">
                <button
                    onClick={() => setTab("lines")}
                    className={`flex items-center gap-1.5 h-8 px-4 rounded-xl text-sm font-semibold transition-all ${
                        tab === "lines"
                            ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm"
                            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700"
                    }`}
                >
                    <List className="h-3.5 w-3.5" /> Employee Lines
                </button>
                <button
                    onClick={() => setTab("matrix")}
                    className={`flex items-center gap-1.5 h-8 px-4 rounded-xl text-sm font-semibold transition-all ${
                        tab === "matrix"
                            ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm"
                            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700"
                    }`}
                >
                    <LayoutGrid className="h-3.5 w-3.5" /> Punch Card Matrix
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />{error}
                </div>
            )}

            {!hasFilters ? (
                <p className="text-sm text-zinc-500 text-center py-14">Search or apply a filter to load employee attendance.</p>
            ) : loading && lines.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
                </div>
            ) : tab === "lines" ? (
                <EmployeeLinesTable
                    lines={filteredLines}
                    onOpenLine={(line) => { setSelectedLine(line); setSelectedDate(undefined); }}
                />
            ) : (
                <PayrollMatrixView
                    periodStart={periodStart}
                    periodEnd={periodEnd}
                    lines={filteredLines}
                    onOpenLine={(line, date) => { setSelectedLine(line); setSelectedDate(date); }}
                />
            )}

            {hasFilters && lines.length > 0 && (() => {
                const totalPages = total > 0 ? Math.ceil(total / PAGE_SIZE) : null;
                // If backend doesn't know total yet, infer last page from a partial response.
                const isLastPage = lines.length < PAGE_SIZE || (totalPages !== null && page >= totalPages);
                return (
                    <div className="flex items-center justify-between gap-3 pt-1">
                        <span className="text-xs text-zinc-400">
                            {totalPages !== null
                                ? `Page ${page} of ${totalPages}`
                                : `Page ${page}`}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1 || loading}
                                className="h-8 w-8 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                aria-label="Previous page"
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </button>
                            {totalPages !== null
                                ? Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                                    .reduce<(number | "…")[]>((acc, p, i, arr) => {
                                        if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                                        acc.push(p);
                                        return acc;
                                    }, [])
                                    .map((p, i) =>
                                        p === "…" ? (
                                            <span key={`ellipsis-${i}`} className="px-1 text-xs text-zinc-400">…</span>
                                        ) : (
                                            <button
                                                key={p}
                                                onClick={() => setPage(p as number)}
                                                disabled={loading}
                                                className={`h-8 min-w-8 px-2 rounded-lg text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                                                    p === page
                                                        ? "bg-primary text-white"
                                                        : "border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                                                }`}
                                            >
                                                {p}
                                            </button>
                                        ),
                                    )
                                : (
                                    <button
                                        disabled
                                        className="h-8 min-w-8 px-2 rounded-lg text-xs font-semibold bg-primary text-white"
                                    >
                                        {page}
                                    </button>
                                )}
                            <button
                                onClick={() => setPage((p) => p + 1)}
                                disabled={isLastPage || loading}
                                className="h-8 w-8 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                aria-label="Next page"
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                );
            })()}

            {selectedLine && (
                <PayrollLineDetailModal
                    campusId={selectedLine.campus_id!}
                    isFinal={false}
                    line={selectedLine}
                    initialDate={selectedDate}
                    canResolve={canMark}
                    onClose={() => { setSelectedLine(null); setSelectedDate(undefined); }}
                    onResolved={load}
                />
            )}
        </div>
    );
}

