"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, ChevronLeft, ChevronRight, LayoutGrid, List, Loader2 } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCampuses } from "@/store/slices/campusesSlice";
import { useAuthState } from "@/context/AuthContext";
import { hrService, AttendanceLineBase } from "@/lib/hr.service";
import { PayrollMatrixView } from "../../hr/payroll/_components/PayrollMatrixView";
import { PayrollLineDetailModal } from "../../hr/payroll/_components/PayrollLineDetailModal";

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
        return <p className="text-sm text-zinc-500 text-center py-14">No employees found for this campus.</p>;
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
                                                <p className="text-[11px] text-zinc-400 font-mono">{emp?.employee_code ?? "—"}</p>
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
    const [cycle, setCycle] = useState<CycleKey>(currentCycleKey());
    const [tab, setTab] = useState<"lines" | "matrix">("lines");
    const [lines, setLines] = useState<AttendanceLineBase[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedLine, setSelectedLine] = useState<AttendanceLineBase | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);

    const { periodStart, periodEnd, label } = cycleWindow(cycle);
    const isCurrentCycle = cycle.year === currentCycleKey().year && cycle.month === currentCycleKey().month;

    useEffect(() => { dispatch(fetchCampuses()); }, [dispatch]);
    useEffect(() => {
        if (!campusId && user?.campusId) setCampusId(String(user.campusId));
    }, [user?.campusId, campusId]);

    const load = useCallback(async () => {
        if (!campusId) return;
        setLoading(true);
        setError(null);
        try {
            const matrix = await hrService.getAttendanceMatrix({
                campus_id: Number(campusId),
                period_start: periodStart,
                period_end: periodEnd,
            });
            setLines(matrix.lines);
        } catch {
            setError("Failed to load attendance data.");
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [campusId, periodStart, periodEnd]);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{label}</h2>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCycle((c) => shiftCycle(c, -1))}
                            className="h-7 w-7 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                            aria-label="Previous cycle"
                        >
                            <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                            onClick={() => setCycle((c) => shiftCycle(c, 1))}
                            disabled={isCurrentCycle}
                            className="h-7 w-7 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Next cycle"
                        >
                            <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
                <select
                    value={campusId}
                    onChange={(e) => setCampusId(e.target.value)}
                    disabled={!!user?.campusId}
                    className="h-9 px-3 border rounded-xl text-sm bg-white dark:bg-zinc-950 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                >
                    <option value="">Select campus...</option>
                    {campuses.map((c) => <option key={c.id} value={c.id}>{c.campus_name}</option>)}
                </select>
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
                <p className="text-sm text-zinc-500 text-center py-14">Select a campus to load attendance data.</p>
            ) : loading && lines.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
                </div>
            ) : tab === "lines" ? (
                <EmployeeLinesTable
                    lines={lines}
                    onOpenLine={(line) => { setSelectedLine(line); setSelectedDate(undefined); }}
                />
            ) : (
                <PayrollMatrixView
                    periodStart={periodStart}
                    periodEnd={periodEnd}
                    lines={lines}
                    onOpenLine={(line, date) => { setSelectedLine(line); setSelectedDate(date); }}
                />
            )}

            {selectedLine && (
                <PayrollLineDetailModal
                    campusId={Number(campusId)}
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
