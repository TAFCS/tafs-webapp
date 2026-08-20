"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
    AlertCircle,
    ArrowDown,
    ArrowUp,
    Building2,
    CalendarCheck,
    CalendarOff,
    CheckCircle2,
    CheckSquare,
    ChevronRight,
    Clock,
    Edit3,
    Fingerprint,
    Loader2,
    Pencil,
    RotateCcw,
    Save,
    Search,
    SearchX,
    Sparkles,
    UserX,
    X,
} from "lucide-react";
import api from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { fetchCampuses } from "@/store/slices/campusesSlice";
import { useAuthState } from "@/context/AuthContext";
import {
    attendanceService,
    RollRecordStatus,
    StudentAttendanceSummary,
    StudentDashboardRow,
} from "@/lib/attendance.service";
import { ScopeBlock, ScopeValue } from "../../../studentwise-fees/components/ScopeBlock";
import { SimulateScanModal } from "@/components/attendance/simulate-scan-modal";

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

function formatMarkDateLabel(iso: string): string {
    if (iso === todayIso()) return "Today";
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function isPastOrToday(iso: string): boolean {
    return iso <= todayIso();
}

const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 },
};

const STATUS_BADGE: Record<RollRecordStatus, string> = {
    PRESENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    ABSENT: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    EXCUSED: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
    LATE: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

function formatTime(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

function initials(name: string | null): string {
    if (!name) return "?";
    return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

interface SummaryCardProps {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
    rows: { label: string; count: number; delta: number }[];
}

function SummaryCard({ title, icon: Icon, color, bg, rows }: SummaryCardProps) {
    return (
        <motion.div
            variants={item}
            className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-6 shadow-sm"
        >
            <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{title}</h3>
                <div className={`p-2.5 rounded-2xl ${bg} ${color}`}>
                    <Icon className="h-5 w-5" />
                </div>
            </div>
            <div className="space-y-3">
                {rows.map((r) => (
                    <div key={r.label} className="flex items-center justify-between">
                        <span className="text-sm text-zinc-500 dark:text-zinc-400">{r.label}</span>
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-black text-zinc-900 dark:text-zinc-50 font-outfit">{r.count}</span>
                            {r.delta !== 0 && (
                                <span
                                    className={`flex items-center text-[11px] font-bold ${
                                        r.delta > 0 ? "text-emerald-500" : "text-rose-500"
                                    }`}
                                >
                                    {r.delta > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                                    {Math.abs(r.delta)}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}

interface StudentSearchResult {
    cc: number;
    full_name: string;
    gr_number: string | null;
}

function StudentSearch({ onSelect }: { onSelect: (cc: number) => void }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<StudentSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            setOpen(false);
            return;
        }
        const timer = setTimeout(async () => {
            setLoading(true);
            setOpen(true);
            try {
                const { data } = await api.get("/v1/students/search-simple", { params: { q: query } });
                setResults(data?.data ?? []);
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [query]);

    return (
        <div className="relative w-full md:w-80" ref={searchRef}>
            <div className="relative group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-primary transition-colors" />
                <input
                    type="text"
                    placeholder="Search student by name, GR, or CC..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query.trim() && setOpen(true)}
                    className="w-full h-10 pl-10 pr-9 border rounded-xl text-sm bg-white dark:bg-zinc-950 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                {query && (
                    <button
                        onClick={() => {
                            setQuery("");
                            setResults([]);
                            setOpen(false);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"
                    >
                        <X className="h-3.5 w-3.5 text-zinc-400" />
                    </button>
                )}
            </div>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.98 }}
                        className="absolute top-full mt-2 w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 overflow-hidden"
                    >
                        {loading ? (
                            <div className="p-6 flex items-center justify-center gap-2 text-zinc-400 text-sm">
                                <Loader2 className="h-4 w-4 animate-spin" /> Searching...
                            </div>
                        ) : results.length === 0 ? (
                            <div className="p-6 flex flex-col items-center justify-center text-center gap-1.5">
                                <SearchX className="h-6 w-6 text-zinc-200" />
                                <p className="text-xs text-zinc-400">No students found for &quot;{query}&quot;</p>
                            </div>
                        ) : (
                            <div className="p-1.5">
                                {results.map((s) => (
                                    <button
                                        key={s.cc}
                                        onClick={() => {
                                            onSelect(s.cc);
                                            setOpen(false);
                                            setQuery("");
                                        }}
                                        className="w-full flex items-center gap-3 p-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-xl transition-colors text-left"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                                            {initials(s.full_name)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200 truncate">{s.full_name}</p>
                                            <p className="text-xs text-zinc-400">CC: {s.cc} · GR: {s.gr_number ?? "—"}</p>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-zinc-300" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

interface StudentAttendanceBoardProps {
    /** Shows the page-level "Student Attendance Dashboard" heading + search/actions. Off when embedded elsewhere (e.g. the main attendance module dashboard), which already has its own module header. */
    showHeader?: boolean;
}

export function StudentAttendanceBoard({ showHeader = true }: StudentAttendanceBoardProps) {
    const dispatch = useAppDispatch();
    const router = useRouter();
    const { user } = useAuthState();
    const isSuperAdmin = user?.role === "SUPER_ADMIN";
    const canMark =
        isSuperAdmin || !!user?.permissions?.includes("attendance.student.rollcall.mark");

    const [scope, setScope] = useState<ScopeValue>({
        campusId: user?.campusId ? String(user.campusId) : "",
        classId: "",
        sectionId: "",
    });
    const [date, setDate] = useState(todayIso());
    const [summary, setSummary] = useState<StudentAttendanceSummary | null>(null);
    const [rows, setRows] = useState<StudentDashboardRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [simulateOpen, setSimulateOpen] = useState(false);
    const [isMarkMode, setIsMarkMode] = useState(false);
    const [draftMarks, setDraftMarks] = useState<Partial<Record<number, RollRecordStatus>>>({});
    const [markSaving, setMarkSaving] = useState(false);
    const [markError, setMarkError] = useState<string | null>(null);
    const [markSuccess, setMarkSuccess] = useState<string | null>(null);
    const canMarkDate = isPastOrToday(date);
    const markDateLabel = formatMarkDateLabel(date);
    const loadSeqRef = useRef(0);

    const seedDraftMarks = useCallback((dashboardData: StudentDashboardRow[]) => {
        const next: Partial<Record<number, RollRecordStatus>> = {};
        for (const r of dashboardData) {
            if (r.status) next[r.student.cc] = r.status;
        }
        return next;
    }, []);

    useEffect(() => {
        dispatch(fetchCampuses());
    }, [dispatch]);

    useEffect(() => {
        if (!scope.campusId && user?.campusId) {
            setScope((s) => ({ ...s, campusId: String(user.campusId) }));
        }
    }, [user?.campusId, scope.campusId]);

    const load = useCallback(async () => {
        if (!scope.campusId || !date) return;
        const seq = ++loadSeqRef.current;
        setLoading(true);
        setError(null);
        // Drop previous scope's numbers immediately so filters don't look "stuck"
        // while a slower campus-wide request is still in flight.
        setSummary(null);
        setRows([]);
        try {
            const params = {
                date,
                campus_id: Number(scope.campusId),
                ...(scope.classId ? { class_id: Number(scope.classId) } : {}),
                ...(scope.sectionId ? { section_id: Number(scope.sectionId) } : {}),
            };
            const [summaryData, dashboardData] = await Promise.all([
                attendanceService.getStudentSummary(params),
                attendanceService.getStudentDashboard(params),
            ]);
            if (seq !== loadSeqRef.current) return;
            setSummary(summaryData);
            setRows(dashboardData);
            setDraftMarks(seedDraftMarks(dashboardData));
        } catch {
            if (seq !== loadSeqRef.current) return;
            setError("Failed to load attendance dashboard.");
        } finally {
            if (seq === loadSeqRef.current) setLoading(false);
        }
    }, [scope.campusId, scope.classId, scope.sectionId, date, seedDraftMarks]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (!canMarkDate) setIsMarkMode(false);
        setMarkError(null);
        setMarkSuccess(null);
    }, [canMarkDate, scope.campusId, scope.classId, scope.sectionId, date]);

    const applyStatusToAll = (status: RollRecordStatus) => {
        setDraftMarks(() => {
            const next: Partial<Record<number, RollRecordStatus>> = {};
            for (const r of rows) {
                const rowOffDay = r.is_working_day === false;
                next[r.student.cc] = rowOffDay && status !== "EXCUSED" ? "EXCUSED" : status;
            }
            return next;
        });
    };

    // Only students whose draft status differs from the loaded row (or was newly set).
    // Save must work after marking a few students — not only when the whole roster is filled.
    const dirtyRecords = rows.filter((r) => {
        const draft = draftMarks[r.student.cc];
        if (draft == null) return false;
        return draft !== (r.status ?? null);
    });

    const canSaveDraft =
        isMarkMode &&
        canMarkDate &&
        dirtyRecords.length > 0 &&
        !markSaving;

    const handleSaveMarks = async () => {
        if (!scope.campusId || dirtyRecords.length === 0) return;
        setMarkSaving(true);
        setMarkError(null);
        setMarkSuccess(null);
        try {
            const records = dirtyRecords.map((r) => ({
                student_cc: r.student.cc,
                status: draftMarks[r.student.cc] as RollRecordStatus,
            }));
            const result = await attendanceService.bulkMarkStudentsDaily({
                date,
                campus_id: Number(scope.campusId),
                records,
            });
            setIsMarkMode(false);
            setMarkSuccess(`Attendance saved for ${result.saved_count} students.`);
            await load();
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setMarkError(msg || "Failed to save attendance.");
        } finally {
            setMarkSaving(false);
        }
    };

    const sel =
        "h-10 px-3 border rounded-xl text-sm bg-white dark:bg-zinc-950 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary/30";

    const offDayRows = rows.filter((r) => r.is_working_day === false || r.status === "EXCUSED");
    const offDayLabel =
        offDayRows[0]?.day_description ??
        offDayRows[0]?.day_type ??
        "Holiday / day off";

    return (
        <div className="space-y-8 pb-16">
            {showHeader && (
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-2">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 font-outfit flex items-center gap-2">
                                <CalendarCheck className="h-8 w-8 text-primary" />
                                Student Attendance Dashboard
                            </h1>
                            {canMark && canMarkDate && (
                                isMarkMode ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-violet-100 text-violet-700 dark:bg-violet-950/80 dark:text-violet-300 border border-violet-300 dark:border-violet-800 animate-pulse">
                                        <Edit3 className="w-3.5 h-3.5" />
                                        Marking Mode Active
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                        <CheckSquare className="w-3.5 h-3.5 text-zinc-400" />
                                        View Mode
                                    </span>
                                )
                            )}
                        </div>
                        <p className="text-sm text-zinc-500 mt-1">
                            Daily student clock-in/out overview from biometric devices & manual register.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <StudentSearch onSelect={(cc) => router.push(`/hr/student-attendance-dashboard/${cc}`)} />

                        {canMark && canMarkDate && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (isMarkMode) {
                                        setIsMarkMode(false);
                                    } else {
                                        setIsMarkMode(true);
                                        setMarkError(null);
                                        setMarkSuccess(null);
                                        setDraftMarks(seedDraftMarks(rows));
                                    }
                                }}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 whitespace-nowrap ${
                                    isMarkMode
                                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200"
                                        : "bg-gradient-to-r from-primary via-indigo-600 to-violet-600 text-white shadow-primary/25 hover:shadow-lg hover:shadow-primary/35 hover:scale-[1.02]"
                                }`}
                            >
                                {isMarkMode ? (
                                    <>
                                        <X className="h-4 w-4" /> Exit Marking
                                    </>
                                ) : (
                                    <>
                                        <Edit3 className="h-4 w-4" /> Mark Attendance
                                    </>
                                )}
                            </button>
                        )}

                        <div className="flex items-center gap-2">
                            <Link
                                href="/hr/student-attendance-dashboard/cycle"
                                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all active:scale-95 whitespace-nowrap"
                            >
                                <CalendarCheck className="h-4 w-4" />
                                By Cycle
                            </Link>
                            <Link
                                href="/attendance/quick-check-in"
                                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all active:scale-95 whitespace-nowrap"
                            >
                                <Clock className="h-4 w-4" />
                                Quick Check-In
                            </Link>
                            {isSuperAdmin && (
                                <button
                                    onClick={() => setSimulateOpen(true)}
                                    className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all active:scale-95 whitespace-nowrap"
                                >
                                    <Fingerprint className="h-4 w-4 text-primary" />
                                    Simulate Scan
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
                <ScopeBlock
                    value={scope}
                    onChange={setScope}
                    lockCampusId={user?.campusId ?? undefined}
                    allowedClassIds={user?.allowedClassIds}
                    requireClassAndSection={false}
                />
                <div className="flex items-center justify-between gap-3 pt-1 border-t border-zinc-100 dark:border-zinc-900">
                    <div className="flex items-center gap-3">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Date</label>
                        <input
                            type="date"
                            value={date}
                            max={todayIso()}
                            onChange={(e) => setDate(e.target.value)}
                            className={sel}
                        />
                    </div>

                    {!showHeader && canMark && canMarkDate && (
                        <button
                            type="button"
                            onClick={() => {
                                setIsMarkMode(!isMarkMode);
                                setMarkError(null);
                                setMarkSuccess(null);
                                setDraftMarks(seedDraftMarks(rows));
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 whitespace-nowrap ${
                                isMarkMode
                                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                                    : "bg-primary text-white hover:opacity-90 shadow-md shadow-primary/20"
                            }`}
                        >
                            <Edit3 className="h-4 w-4" />
                            {isMarkMode ? "Exit Marking" : "Mark Attendance"}
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-sm">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    {error}
                </div>
            )}

            {markSuccess && !isMarkMode && (
                <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-sm">
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
                    {markSuccess}
                </div>
            )}

            {offDayRows.length > 0 && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-200">
                    <CalendarOff className="w-5 h-5 shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <p className="font-semibold">Non-working day — {offDayLabel}</p>
                        <p className="text-sky-800/80 dark:text-sky-300/80 mt-1">
                            Students are auto-marked EXCUSED. Biometric clock-ins are suppressed for this date.
                        </p>
                    </div>
                </div>
            )}

            {!scope.campusId ? (
                <div className="bg-white dark:bg-zinc-950 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-4 my-4 shadow-sm">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                        <Building2 className="w-7 h-7" />
                    </div>
                    <div className="max-w-md">
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Select a Campus to View & Mark Attendance</h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                            Choose your campus from the scope filters above to load student records, view summary statistics, and mark daily attendance.
                        </p>
                    </div>
                </div>
            ) : loading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-zinc-400">
                    <Loader2 className="h-9 w-9 animate-spin text-primary opacity-60" />
                    <p className="text-sm font-medium">
                        Loading
                        {scope.classId ? " filtered" : " campus"} attendance records…
                    </p>
                </div>
            ) : (
                <>
                    {summary && (
                        <motion.div
                            variants={container}
                            initial="hidden"
                            animate="show"
                            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                            key={`${scope.campusId}-${scope.classId}-${scope.sectionId}-${date}`}
                        >
                            <SummaryCard
                                title="Present Summary"
                                icon={CheckCircle2}
                                color="text-emerald-600"
                                bg="bg-emerald-50 dark:bg-emerald-900/10"
                                rows={[
                                    { label: "Present", ...summary.present_summary.present },
                                    ...(summary.present_summary.late
                                        ? [{ label: "Late", ...summary.present_summary.late }]
                                        : []),
                                ]}
                            />
                            <SummaryCard
                                title="Not Present Summary"
                                icon={UserX}
                                color="text-rose-600"
                                bg="bg-rose-50 dark:bg-rose-900/10"
                                rows={[
                                    ...(summary.not_present_summary.absent
                                        ? [{ label: "Absent", ...summary.not_present_summary.absent }]
                                        : []),
                                    ...(summary.not_present_summary.excused
                                        ? [{ label: "Excused", ...summary.not_present_summary.excused }]
                                        : []),
                                    { label: "No Clock In", ...summary.not_present_summary.no_clock_in },
                                    { label: "No Clock Out", ...summary.not_present_summary.no_clock_out },
                                ]}
                            />
                        </motion.div>
                    )}

                    {/* Prominent Attendance Marking Banner / Toolbar */}
                    {canMark && canMarkDate && (
                        !isMarkMode ? (
                            <div className="bg-gradient-to-r from-indigo-500/10 via-violet-500/5 to-transparent border border-indigo-200 dark:border-indigo-900/60 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                                <div className="flex items-start gap-3.5">
                                    <div className="p-3 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20 shrink-0 mt-0.5">
                                        <Pencil className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                            Manual Attendance Marking
                                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                                {markDateLabel}
                                            </span>
                                        </h3>
                                        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
                                            Record or edit attendance for <strong className="text-indigo-600 dark:text-indigo-400 font-semibold">{markDateLabel}</strong>. Press <strong className="text-indigo-600 dark:text-indigo-400 font-semibold">Start Marking Attendance</strong> to enable quick status buttons.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsMarkMode(true);
                                        setMarkError(null);
                                        setMarkSuccess(null);
                                        setDraftMarks(seedDraftMarks(rows));
                                    }}
                                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-600/25 hover:shadow-indigo-600/35 transition-all active:scale-95 whitespace-nowrap"
                                >
                                    <Edit3 className="h-4 w-4" />
                                    Start Marking Attendance
                                </button>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-zinc-950 border-2 border-violet-400/40 dark:border-violet-600/40 rounded-2xl p-5 shadow-lg space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                                            <CheckSquare className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                                                    Attendance Marking Mode Active
                                                </h3>
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                                                    {rows.length} Students
                                                </span>
                                            </div>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                                Use quick apply buttons below for batch marking, or select individual student statuses in the table.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsMarkMode(false);
                                            setMarkError(null);
                                            setMarkSuccess(null);
                                            setDraftMarks(seedDraftMarks(rows));
                                        }}
                                        className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors flex items-center justify-center gap-1.5"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                        Exit Marking Mode
                                    </button>
                                </div>

                                {markError && (
                                    <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        {markError}
                                    </div>
                                )}
                                {markSuccess && (
                                    <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-sm">
                                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                                        {markSuccess}
                                    </div>
                                )}

                                <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mr-1">
                                            Quick Apply All:
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => applyStatusToAll("PRESENT")}
                                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
                                        >
                                            <CheckCircle2 className="h-3.5 w-3.5" /> Present
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => applyStatusToAll("LATE")}
                                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
                                        >
                                            <Clock className="h-3.5 w-3.5" /> Late
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => applyStatusToAll("ABSENT")}
                                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
                                        >
                                            <UserX className="h-3.5 w-3.5" /> Absent
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => applyStatusToAll("EXCUSED")}
                                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
                                        >
                                            <CalendarOff className="h-3.5 w-3.5" /> Excused
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-2 ml-auto">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDraftMarks(seedDraftMarks(rows));
                                                setMarkError(null);
                                                setMarkSuccess(null);
                                            }}
                                            className="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors flex items-center gap-1.5"
                                        >
                                            <RotateCcw className="h-3.5 w-3.5" /> Reset
                                        </button>
                                        <button
                                            type="button"
                                            disabled={!canSaveDraft}
                                            onClick={handleSaveMarks}
                                            title={
                                                canSaveDraft
                                                    ? `Save ${dirtyRecords.length} change${dirtyRecords.length === 1 ? "" : "s"}`
                                                    : "Mark at least one student (P / L / A / E) to enable Save"
                                            }
                                            className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 active:scale-95"
                                        >
                                            {markSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                            {markSaving
                                                ? "Saving..."
                                                : dirtyRecords.length > 0
                                                    ? `Save Attendance (${dirtyRecords.length})`
                                                    : "Save Attendance"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    )}

                    <div className="rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950 shadow-sm">
                        {rows.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-16 text-zinc-400">
                                <CalendarCheck className="w-8 h-8 opacity-30" />
                                <p className="text-sm">No students found for this scope.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                                            <th className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                                Student
                                            </th>
                                            <th className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                                Class
                                            </th>
                                            <th className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                                Section
                                            </th>
                                            <th className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                                Clock In
                                            </th>
                                            <th className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                                Clock Out
                                            </th>
                                            <th className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                                {canMark && isMarkMode ? (
                                                    <span className="flex items-center gap-1.5 text-violet-700 dark:text-violet-300 font-bold">
                                                        <Edit3 className="h-3.5 w-3.5" />
                                                        Status (Click P / L / A / E to mark)
                                                    </span>
                                                ) : (
                                                    "Status"
                                                )}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {rows.map((row) => {
                                            const isOffDay = row.is_working_day === false;
                                            const draftStatus = draftMarks[row.student.cc] ?? row.status;
                                            const draftAllowed = (s: RollRecordStatus) =>
                                                !isOffDay || s === "EXCUSED";
                                            return (
                                            <tr
                                                key={row.student.cc}
                                                onClick={() => {
                                                    if (isMarkMode) return;
                                                    router.push(`/hr/student-attendance-dashboard/${row.student.cc}`);
                                                }}
                                                className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${isMarkMode ? "" : "cursor-pointer"} ${isOffDay ? "bg-sky-50/50 dark:bg-sky-900/10" : ""}`}
                                            >
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        {row.student.photo_url ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                src={row.student.photo_url}
                                                                alt=""
                                                                className="w-8 h-8 rounded-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                                                {initials(row.student.full_name)}
                                                            </div>
                                                        )}
                                                        <div>
                                                            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                                                                {row.student.full_name}
                                                            </p>
                                                            <p className="text-xs text-zinc-400">{row.student.gr_number ?? "—"}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">{row.student.class ?? "—"}</td>
                                                <td className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">{row.student.section ?? "—"}</td>
                                                <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{formatTime(row.check_in_at)}</td>
                                                <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{formatTime(row.check_out_at)}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        {draftStatus ? (
                                                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_BADGE[draftStatus]}`}>
                                                                {draftStatus}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                                                                Unmarked
                                                            </span>
                                                        )}

                                                        {canMark && isMarkMode && (
                                                            <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                                                {(["PRESENT", "LATE", "ABSENT", "EXCUSED"] as RollRecordStatus[]).map((s) => {
                                                                    const active = draftStatus === s;
                                                                    const titleMap: Record<RollRecordStatus, string> = {
                                                                        PRESENT: "Mark as Present",
                                                                        LATE: "Mark as Late",
                                                                        ABSENT: "Mark as Absent",
                                                                        EXCUSED: "Mark as Excused",
                                                                    };
                                                                    const activeBg: Record<RollRecordStatus, string> = {
                                                                        PRESENT: "bg-emerald-600 text-white border-emerald-600 shadow-sm",
                                                                        LATE: "bg-amber-600 text-white border-amber-600 shadow-sm",
                                                                        ABSENT: "bg-rose-600 text-white border-rose-600 shadow-sm",
                                                                        EXCUSED: "bg-sky-600 text-white border-sky-600 shadow-sm",
                                                                    };
                                                                    const hoverBorder: Record<RollRecordStatus, string> = {
                                                                        PRESENT: "hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400",
                                                                        LATE: "hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400",
                                                                        ABSENT: "hover:border-rose-500 hover:text-rose-600 dark:hover:text-rose-400",
                                                                        EXCUSED: "hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-400",
                                                                    };

                                                                    return (
                                                                        <button
                                                                            key={s}
                                                                            type="button"
                                                                            title={titleMap[s]}
                                                                            disabled={!draftAllowed(s)}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (!draftAllowed(s)) return;
                                                                                setDraftMarks((prev) => ({
                                                                                    ...prev,
                                                                                    [row.student.cc]: s,
                                                                                }));
                                                                            }}
                                                                            className={`w-7 h-7 rounded-lg text-xs font-black transition-all border flex items-center justify-center ${
                                                                                !draftAllowed(s)
                                                                                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 border-transparent cursor-not-allowed"
                                                                                    : active
                                                                                        ? activeBg[s]
                                                                                        : `bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 ${hoverBorder[s]}`
                                                                            }`}
                                                                        >
                                                                            {s === "PRESENT" ? "P" : s === "LATE" ? "L" : s === "ABSENT" ? "A" : "E"}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Sticky Floating Save Bar when scrolling in Mark Mode */}
            {canMark && canMarkDate && isMarkMode && rows.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-zinc-900/95 text-white dark:bg-zinc-100 dark:text-zinc-900 px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-md border border-zinc-800 dark:border-zinc-200 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs font-bold">Marking Mode ({rows.length} students)</span>
                    </div>
                    <div className="h-4 w-px bg-zinc-700 dark:bg-zinc-300" />
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setDraftMarks(seedDraftMarks(rows));
                                setMarkError(null);
                                setMarkSuccess(null);
                            }}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors flex items-center gap-1 text-zinc-300 dark:text-zinc-700"
                        >
                            <RotateCcw className="h-3 w-3" /> Reset
                        </button>
                        <button
                            type="button"
                            disabled={!canSaveDraft}
                            onClick={handleSaveMarks}
                            title={
                                canSaveDraft
                                    ? `Save ${dirtyRecords.length} change${dirtyRecords.length === 1 ? "" : "s"}`
                                    : "Mark at least one student (P / L / A / E) to enable Save"
                            }
                            className="px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-bold shadow-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 active:scale-95"
                        >
                            {markSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                            {markSaving
                                ? "Saving..."
                                : dirtyRecords.length > 0
                                    ? `Save (${dirtyRecords.length})`
                                    : "Save Attendance"}
                        </button>
                    </div>
                </div>
            )}

            {simulateOpen && <SimulateScanModal personType="STUDENT" onClose={() => setSimulateOpen(false)} onDone={load} />}
        </div>
    );
}
