"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, Briefcase, ChevronLeft, ChevronRight, Download, LayoutGrid, List, Loader2, Search, X } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCampuses } from "@/store/slices/campusesSlice";
import { useAuthState } from "@/context/AuthContext";
import { hrService, AttendanceLineBase, Department } from "@/lib/hr.service";
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

    const [campusId, setCampusId] = useState(user?.campusId ? String(user.campusId) : "");
    const [departmentIds, setDepartmentIds] = useState<number[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [cycle, setCycle] = useState<CycleKey>(currentCycleKey());
    const [tab, setTab] = useState<"lines" | "matrix">("lines");
    const [lines, setLines] = useState<AttendanceLineBase[]>([]);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedLine, setSelectedLine] = useState<AttendanceLineBase | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
    const [search, setSearch] = useState("");

    const cycleDefault = cycleWindow(cycle);
    // Admin can override the auto-selected cycle dates; null means "use the cycle default".
    const [customStart, setCustomStart] = useState<string | null>(null);
    const [customEnd, setCustomEnd] = useState<string | null>(null);
    const periodStart = customStart ?? cycleDefault.periodStart;
    const periodEnd = customEnd ?? cycleDefault.periodEnd;
    const label = customStart || customEnd ? `${periodStart} – ${periodEnd}` : cycleDefault.label;
    const isCurrentCycle = cycle.year === currentCycleKey().year && cycle.month === currentCycleKey().month;

    const filteredLines = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return lines;
        return lines.filter((line) => {
            const emp = line.employee_profiles;
            const haystack = [
                emp?.full_name,
                emp?.employee_code,
                emp?.job_title,
                line.campus_name,
                String(line.employee_id),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            return haystack.includes(q);
        });
    }, [lines, search]);

    useEffect(() => {
        dispatch(fetchCampuses());
        hrService.listDepartments().then(setDepartments).catch(console.error);
    }, [dispatch]);
    useEffect(() => {
        if (!campusId && user?.campusId) setCampusId(String(user.campusId));
    }, [user?.campusId, campusId]);

    const departmentOptions = useMemo(
        () => departments.map((d) => ({ id: d.id, label: d.name })),
        [departments],
    );

    // A campus is required: without one this fetches (and renders) every
    // employee at every campus for the whole cycle, which is what made the
    // punch matrix unusable.
    const matrixParams = useMemo(
        () => ({
            campus_id: Number(campusId),
            ...(departmentIds.length ? { department_id: serializeIds(departmentIds) } : {}),
            period_start: periodStart,
            period_end: periodEnd,
        }),
        [campusId, departmentIds, periodStart, periodEnd],
    );

    const load = useCallback(async () => {
        if (!campusId) return;
        setLoading(true);
        setError(null);
        try {
            const matrix = await hrService.getAttendanceMatrix(matrixParams);
            setLines(matrix.lines);
        } catch {
            setError("Failed to load attendance data.");
        } finally {
            setLoading(false);
        }
    }, [campusId, matrixParams]);

    useEffect(() => { load(); }, [load]);

    const handleExport = async () => {
        setExporting(true);
        try {
            await hrService.exportAttendanceMatrix(matrixParams);
        } catch {
            setError("Failed to export attendance data.");
        } finally {
            setExporting(false);
        }
    };

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
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name, code, role, campus..."
                            className="h-9 w-64 pl-8 pr-8 border rounded-xl text-sm bg-white dark:bg-zinc-950 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                                aria-label="Clear search"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    <select
                        value={campusId}
                        onChange={(e) => { setCampusId(e.target.value); setDepartmentIds([]); setLines([]); }}
                        disabled={!!user?.campusId}
                        className="h-9 px-3 border rounded-xl text-sm bg-white dark:bg-zinc-950 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                    >
                        <option value="">Select campus...</option>
                        {campuses.map((c) => <option key={c.id} value={c.id}>{c.campus_name}</option>)}
                    </select>
                    <FilterDropdown
                        label="Department"
                        icon={Briefcase}
                        value={departmentIds}
                        options={departmentOptions}
                        placeholder="All departments"
                        onToggle={(id) => setDepartmentIds((prev) => toggleId(prev, id))}
                        onClear={() => setDepartmentIds([])}
                    />
                    <button
                        onClick={handleExport}
                        disabled={exporting || !campusId || lines.length === 0}
                        className="h-9 px-3 flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors disabled:opacity-50"
                    >
                        {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        Excel
                    </button>
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

            {!campusId ? (
                <p className="text-sm text-zinc-500 text-center py-14">Select a campus to load employee attendance.</p>
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

            {selectedLine && (
                <PayrollLineDetailModal
                    campusId={selectedLine.campus_id ?? Number(campusId)}
                    isFinal={false}
                    line={selectedLine}
                    initialDate={selectedDate}
                    onClose={() => { setSelectedLine(null); setSelectedDate(undefined); }}
                    onResolved={load}
                />
            )}
        </div>
    );
}
