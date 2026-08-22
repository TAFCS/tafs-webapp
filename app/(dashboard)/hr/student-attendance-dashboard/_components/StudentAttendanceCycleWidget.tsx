"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, ArrowDown, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, LayoutGrid, List, Loader2, Search, X } from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { fetchCampuses } from "@/store/slices/campusesSlice";
import { useAuthState } from "@/context/AuthContext";
import { attendanceService, StudentAttendanceLine } from "@/lib/attendance.service";
import { StudentPunchMatrixView } from "./StudentPunchMatrixView";
import { StudentLineDetailModal } from "./StudentLineDetailModal";
import { StudentLineTags } from "./StudentLineTags";
import { ScopeBlock, ScopeValue } from "../../../studentwise-fees/components/ScopeBlock";

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

interface CycleKey { year: number; month: number }

/** Same fixed 26th–25th cycle convention as the staff attendance-by-cycle widget, kept purely for a consistent, familiar date-range picker — students aren't on payroll. */
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

// ── Sorting ───────────────────────────────────────────────────────────────────

type SortKey = "class" | "gr" | "name" | "present" | "absent" | "excused" | "late" | "unresolved";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: "class",      label: "Class & Section" },
    { value: "gr",         label: "GR Number" },
    { value: "name",       label: "Name" },
    { value: "present",    label: "Present Days" },
    { value: "absent",     label: "Absent Days" },
    { value: "excused",    label: "Excused Days" },
    { value: "late",       label: "Late Days" },
    { value: "unresolved", label: "Unresolved Days" },
];

/** Identity sorts read best A→Z; day-count sorts are wanted highest-first. */
const TEXT_KEYS = new Set<SortKey>(["class", "gr", "name"]);
const DESC_BY_DEFAULT = new Set<SortKey>(["present", "absent", "excused", "late", "unresolved"]);

// GR numbers are mostly numeric strings ("3066") with a few alphanumeric ones
// ("TEST-001") mixed in, so a numeric-aware collator is what keeps 2 before 10
// instead of the lexicographic "10" < "2".
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/**
 * Students with nothing in the sorted-on field (no GR yet, no section) sink to
 * the bottom in both directions — flipping the sort shouldn't dredge up a block
 * of blanks above the real data.
 */
function blankRank(a: string | null, b: string | null): number | null {
    const av = a?.trim() ?? "";
    const bv = b?.trim() ?? "";
    if (av && bv) return null;
    if (!av && !bv) return 0;
    return av ? -1 : 1;
}

function textValue(line: StudentAttendanceLine, key: SortKey): string | null {
    const stu = line.student;
    if (key === "gr") return stu.gr_number;
    if (key === "name") return stu.full_name;
    return [stu.class, stu.section].filter(Boolean).join(" ") || null;
}

function countValue(line: StudentAttendanceLine, key: SortKey): number {
    switch (key) {
        case "present":    return line.present_days;
        case "absent":     return line.absent_days;
        case "excused":    return line.excused_days;
        case "late":       return line.late_days;
        case "unresolved": return line.unresolved_days;
        default:           return 0;
    }
}

function sortLines(lines: StudentAttendanceLine[], key: SortKey, asc: boolean): StudentAttendanceLine[] {
    const dir = asc ? 1 : -1;
    return [...lines].sort((a, b) => {
        let cmp = 0;
        if (TEXT_KEYS.has(key)) {
            const av = textValue(a, key);
            const bv = textValue(b, key);
            const blank = blankRank(av, bv);
            // Applied before the direction flip, so blanks stay at the bottom.
            if (blank !== null) { if (blank !== 0) return blank; }
            else cmp = dir * collator.compare(av as string, bv as string);
        } else {
            cmp = dir * (countValue(a, key) - countValue(b, key));
        }
        // Equal keys still group by name, so the order never looks arbitrary.
        return cmp || collator.compare(a.student.full_name ?? "", b.student.full_name ?? "");
    });
}

interface SortControl {
    sortKey: SortKey;
    sortAsc: boolean;
    onSort: (key: SortKey) => void;
}

function SortTh({ k, label, className = "", sortKey, sortAsc, onSort }: { k: SortKey; label: string; className?: string } & SortControl) {
    return (
        <th
            onClick={() => onSort(k)}
            className={`py-3 text-xs font-bold uppercase tracking-widest cursor-pointer select-none transition-colors ${
                sortKey === k ? "text-zinc-700 dark:text-zinc-200" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            } ${className}`}
        >
            <span className="inline-flex items-center gap-1">
                {label}
                {sortKey === k
                    ? (sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
                    : <ChevronDown className="h-3 w-3 opacity-25" />}
            </span>
        </th>
    );
}

function StudentLinesTable({ lines, onOpenLine, ...sort }: { lines: StudentAttendanceLine[]; onOpenLine: (line: StudentAttendanceLine) => void } & SortControl) {
    if (lines.length === 0) {
        return <p className="text-sm text-zinc-500 text-center py-14">No students found.</p>;
    }

    return (
        <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                            <SortTh k="name"       label="Student"    className="px-5 text-left"   {...sort} />
                            <SortTh k="present"    label="Present"    className="px-4 text-center" {...sort} />
                            <SortTh k="absent"     label="Absent"     className="px-4 text-center" {...sort} />
                            <SortTh k="excused"    label="Excused"    className="px-4 text-center" {...sort} />
                            <SortTh k="unresolved" label="Unresolved" className="px-5 text-center" {...sort} />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {lines.map((line) => {
                            const stu = line.student;
                            const name = stu.full_name ?? `Student #${line.student_cc}`;
                            const hasIssue = line.unresolved_days > 0;

                            return (
                                <tr
                                    key={line.student_cc}
                                    onClick={() => onOpenLine(line)}
                                    className={`cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 transition-colors ${hasIssue ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}
                                >
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-3">
                                            {stu.photo_url ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={stu.photo_url} alt={name} className="h-8 w-8 rounded-lg object-cover bg-zinc-100" />
                                            ) : (
                                                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                                    {initials(name)}
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-sm font-semibold text-zinc-900 dark:text-white leading-tight">{name}</p>
                                                <p className="text-[11px] text-zinc-400 font-mono">
                                                    {stu.gr_number ?? "—"}
                                                    {(stu.class || stu.section) && (
                                                        <span className="ml-1.5 text-zinc-300 dark:text-zinc-600">
                                                            · {[stu.class, stu.section].filter(Boolean).join(" ")}
                                                        </span>
                                                    )}
                                                    {line.campus_name && <span className="ml-1.5 text-zinc-300 dark:text-zinc-600">· {line.campus_name}</span>}
                                                </p>
                                                <StudentLineTags line={line} className="mt-1" />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-zinc-600 dark:text-zinc-300">{line.present_days}</td>
                                    <td className="px-4 py-3 text-center text-sm">
                                        {line.absent_days > 0 ? (
                                            <span className="font-semibold text-rose-600">{line.absent_days}</span>
                                        ) : (
                                            <span className="text-zinc-300 dark:text-zinc-600">0</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm">
                                        {line.excused_days > 0 ? (
                                            <span className="font-semibold text-sky-600">{line.excused_days}</span>
                                        ) : (
                                            <span className="text-zinc-300 dark:text-zinc-600">0</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3 text-center text-sm">
                                        {hasIssue ? (
                                            <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                                                <AlertTriangle className="h-3 w-3" /> {line.unresolved_days}
                                            </span>
                                        ) : (
                                            <span className="text-zinc-300 dark:text-zinc-600">0</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export function StudentAttendanceCycleWidget() {
    const dispatch = useAppDispatch();
    const { user } = useAuthState();

    const [scope, setScope] = useState<ScopeValue>({
        campusId: user?.campusId ? String(user.campusId) : "",
        classId: "",
        sectionId: "",
    });
    const [cycle, setCycle] = useState<CycleKey>(currentCycleKey());
    const [tab, setTab] = useState<"lines" | "matrix">("lines");
    const [lines, setLines] = useState<StudentAttendanceLine[]>([]);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [selectedLine, setSelectedLine] = useState<StudentAttendanceLine | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
    // Matches the order the backend already returns rows in, so the default view is unchanged.
    const [sortKey, setSortKey] = useState<SortKey>("class");
    const [sortAsc, setSortAsc] = useState(true);

    const cycleDefault = cycleWindow(cycle);
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
            const stu = line.student;
            const haystack = [stu.full_name, stu.gr_number, stu.class, stu.section, line.campus_name, String(line.student_cc)]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            return haystack.includes(q);
        });
    }, [lines, search]);

    // One order for both tabs — switching between lines and matrix keeps the
    // same students in the same places.
    const visibleLines = useMemo(() => sortLines(filteredLines, sortKey, sortAsc), [filteredLines, sortKey, sortAsc]);

    // Picking a new key starts in the direction that key reads best; picking
    // the one already active (or clicking its column header) flips it.
    const changeSort = useCallback((key: SortKey) => {
        if (key === sortKey) { setSortAsc((v) => !v); return; }
        setSortKey(key);
        setSortAsc(!DESC_BY_DEFAULT.has(key));
    }, [sortKey]);

    useEffect(() => { dispatch(fetchCampuses()); }, [dispatch]);
    useEffect(() => {
        if (!scope.campusId && user?.campusId) setScope((s) => ({ ...s, campusId: String(user.campusId) }));
    }, [user?.campusId, scope.campusId]);

    // Campus + class are both required: a whole campus is 1000+ students, and
    // the punch matrix renders a cell per student per day.
    const load = useCallback(async () => {
        if (!scope.campusId || !scope.classId) return;
        setLoading(true);
        setError(null);
        try {
            const matrix = await attendanceService.getStudentAttendanceMatrix({
                campus_id: Number(scope.campusId),
                ...(scope.classId ? { class_id: Number(scope.classId) } : {}),
                ...(scope.sectionId ? { section_id: Number(scope.sectionId) } : {}),
                period_start: periodStart,
                period_end: periodEnd,
            });
            setLines(matrix.lines);
            // Re-point an open modal at the refetched line so its summary
            // counts and day list reflect the save that triggered this reload.
            setSelectedLine((cur) => (cur ? matrix.lines.find((l) => l.student_cc === cur.student_cc) ?? cur : cur));
        } catch {
            setError("Failed to load student attendance data.");
        } finally {
            setLoading(false);
        }
    }, [scope.campusId, scope.classId, scope.sectionId, periodStart, periodEnd]);

    useEffect(() => { load(); }, [load]);

    const handleExport = async () => {
        setExporting(true);
        try {
            await attendanceService.exportStudentAttendanceMatrix({
                campus_id: scope.campusId ? Number(scope.campusId) : undefined,
                ...(scope.classId ? { class_id: Number(scope.classId) } : {}),
                ...(scope.sectionId ? { section_id: Number(scope.sectionId) } : {}),
                period_start: periodStart,
                period_end: periodEnd,
            });
        } catch {
            setError("Failed to export student attendance data.");
        } finally {
            setExporting(false);
        }
    };

    const openLine = (line: StudentAttendanceLine, date?: string) => {
        setSelectedLine(line);
        setSelectedDate(date);
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
                            placeholder="Search by name, GR, class..."
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
                    <button
                        onClick={handleExport}
                        disabled={exporting || !scope.classId || lines.length === 0}
                        className="h-9 px-3 flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors disabled:opacity-50"
                    >
                        {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        Excel
                    </button>
                </div>
            </div>

            <ScopeBlock
                value={scope}
                onChange={(next) => { setScope(next); setLines([]); }}
                lockCampusId={user?.campusId ?? undefined}
                allowedClassIds={user?.allowedClassIds}
                requireClass
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl w-fit">
                    <button
                        onClick={() => setTab("lines")}
                        className={`flex items-center gap-1.5 h-8 px-4 rounded-xl text-sm font-semibold transition-all ${
                            tab === "lines"
                                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm"
                                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700"
                        }`}
                    >
                        <List className="h-3.5 w-3.5" /> Student Lines
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

                {/* Applies to both tabs */}
                <div className="flex items-center gap-1.5">
                    <label htmlFor="student-attendance-sort" className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide">
                        Sort by
                    </label>
                    <select
                        id="student-attendance-sort"
                        value={sortKey}
                        onChange={(e) => changeSort(e.target.value as SortKey)}
                        className="h-9 px-2.5 border rounded-xl text-sm bg-white dark:bg-zinc-950 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                        {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <button
                        onClick={() => setSortAsc((v) => !v)}
                        className="h-9 w-9 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                        aria-label={sortAsc ? "Sorted ascending — switch to descending" : "Sorted descending — switch to ascending"}
                        title={sortAsc ? "Ascending" : "Descending"}
                    >
                        {sortAsc ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />{error}
                </div>
            )}

            {!scope.campusId || !scope.classId ? (
                <p className="text-sm text-zinc-500 text-center py-14">Select a campus and class to load student attendance.</p>
            ) : loading && lines.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
                </div>
            ) : tab === "lines" ? (
                <StudentLinesTable
                    lines={visibleLines}
                    onOpenLine={(line) => openLine(line)}
                    sortKey={sortKey}
                    sortAsc={sortAsc}
                    onSort={changeSort}
                />
            ) : (
                <StudentPunchMatrixView
                    periodStart={periodStart}
                    periodEnd={periodEnd}
                    lines={visibleLines}
                    onOpenLine={(line, date) => openLine(line, date)}
                />
            )}

            {selectedLine && (
                <StudentLineDetailModal
                    campusId={selectedLine.campus_id ?? Number(scope.campusId)}
                    line={selectedLine}
                    initialDate={selectedDate}
                    onClose={() => { setSelectedLine(null); setSelectedDate(undefined); }}
                    onResolved={load}
                />
            )}
        </div>
    );
}
