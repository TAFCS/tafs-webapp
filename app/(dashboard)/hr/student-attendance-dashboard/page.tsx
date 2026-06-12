"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    AlertCircle,
    ArrowDown,
    ArrowUp,
    CalendarCheck,
    ChevronRight,
    CheckCircle2,
    Fingerprint,
    Loader2,
    Search,
    SearchX,
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
import { ScopeBlock, ScopeValue } from "../../studentwise-fees/components/ScopeBlock";
import { SimulateScanModal } from "@/components/attendance/simulate-scan-modal";

function todayIso() {
    return new Date().toISOString().slice(0, 10);
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

export default function StudentAttendanceDashboardPage() {
    const dispatch = useAppDispatch();
    const router = useRouter();
    const { user } = useAuthState();
    const isSuperAdmin = user?.role === "SUPER_ADMIN";

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
        setLoading(true);
        setError(null);
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
            setSummary(summaryData);
            setRows(dashboardData);
        } catch {
            setError("Failed to load attendance dashboard.");
        } finally {
            setLoading(false);
        }
    }, [scope.campusId, scope.classId, scope.sectionId, date]);

    useEffect(() => {
        load();
    }, [load]);

    const sel =
        "h-10 px-3 border rounded-xl text-sm bg-white dark:bg-zinc-950 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary/30";

    return (
        <div className="space-y-8 pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 font-outfit flex items-center gap-2">
                        <CalendarCheck className="h-7 w-7 text-primary" />
                        Student Attendance Dashboard
                    </h1>
                    <p className="text-sm text-zinc-500 mt-1">Daily student clock-in/out overview from biometric devices.</p>
                </div>
                <StudentSearch onSelect={(cc) => router.push(`/hr/student-attendance-dashboard/${cc}`)} />
                {isSuperAdmin && (
                    <button
                        onClick={() => setSimulateOpen(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition-all active:scale-95"
                    >
                        <Fingerprint className="h-4 w-4" />
                        Simulate Fingerprint Scan
                    </button>
                )}
            </div>

            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
                <ScopeBlock
                    value={scope}
                    onChange={setScope}
                    lockCampusId={user?.campusId ?? undefined}
                    allowedClassIds={user?.allowedClassIds}
                    requireClassAndSection={false}
                />
                <div className="flex items-center gap-3">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Date</label>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={sel} />
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            {!scope.campusId ? (
                <p className="text-sm text-zinc-500 text-center py-14">Select a campus to load the attendance dashboard.</p>
            ) : loading && !summary ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
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
                                rows={[{ label: "Present", ...summary.present_summary.present }]}
                            />
                            <SummaryCard
                                title="Not Present Summary"
                                icon={UserX}
                                color="text-rose-600"
                                bg="bg-rose-50 dark:bg-rose-900/10"
                                rows={[
                                    { label: "No Clock In", ...summary.not_present_summary.no_clock_in },
                                    { label: "No Clock Out", ...summary.not_present_summary.no_clock_out },
                                ]}
                            />
                        </motion.div>
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
                                            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                                Student
                                            </th>
                                            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                                Class
                                            </th>
                                            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                                Section
                                            </th>
                                            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                                Clock In
                                            </th>
                                            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                                Clock Out
                                            </th>
                                            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                                Status
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {rows.map((row) => (
                                            <tr
                                                key={row.student.cc}
                                                onClick={() => router.push(`/hr/student-attendance-dashboard/${row.student.cc}`)}
                                                className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
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
                                                    {row.status ? (
                                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[row.status]}`}>
                                                            {row.status}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                                                            —
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {simulateOpen && <SimulateScanModal personType="STUDENT" onClose={() => setSimulateOpen(false)} onDone={load} />}
        </div>
    );
}
