"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    AlertCircle,
    ArrowDown,
    ArrowUp,
    CalendarCheck,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Coffee,
    Fingerprint,
    Loader2,
    UserX,
    X,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCampuses } from "@/store/slices/campusesSlice";
import { useAuthState } from "@/context/AuthContext";
import { hrService, Department } from "@/lib/hr.service";
import {
    attendanceService,
    StaffAttendanceSummary,
    StaffAttendanceStatus,
    StaffDashboardRow,
} from "@/lib/attendance.service";
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

const STATUS_LABEL: Record<StaffAttendanceStatus, string> = {
    PRESENT:      "Present",
    LATE:         "Late",
    ABSENT:       "Absent",
    HALF_DAY:     "Half Day",
    EXCUSED:      "Excused",
    SICK_LEAVE:   "Sick Leave",
    CASUAL_LEAVE: "Casual Leave",
    ANNUAL_LEAVE: "Annual Leave",
    UNPAID_LEAVE: "Unpaid Leave",
};

const STATUS_BADGE: Record<StaffAttendanceStatus, string> = {
    PRESENT:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    LATE:         "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    ABSENT:       "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    HALF_DAY:     "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    EXCUSED:      "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
    SICK_LEAVE:   "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    CASUAL_LEAVE: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
    ANNUAL_LEAVE: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    UNPAID_LEAVE: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

type SortKey = "name" | "status" | "check_in" | "check_out";

const STATUS_SORT_ORDER: Record<string, number> = {
    "null": 0, ABSENT: 1, LATE: 2, HALF_DAY: 3, PRESENT: 4, EXCUSED: 5, SICK_LEAVE: 6, CASUAL_LEAVE: 7, ANNUAL_LEAVE: 8, UNPAID_LEAVE: 9,
};

function formatTime(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

function formatOvertime(minutes: number | null): string {
    if (!minutes || minutes <= 0) return "—";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h === 0 ? `${m}m` : `${h}h ${m}m`;
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
                                <span className={`flex items-center text-[11px] font-bold ${r.delta > 0 ? "text-emerald-500" : "text-rose-500"}`}>
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

const BULK_STATUSES: { value: StaffAttendanceStatus; label: string }[] = [
    { value: "PRESENT", label: "Present" },
    { value: "LATE", label: "Late" },
    { value: "HALF_DAY", label: "Half Day" },
    { value: "ABSENT", label: "Absent" },
    { value: "EXCUSED", label: "Excused" },
];

export default function AttendanceDashboardPage() {
    const dispatch = useAppDispatch();
    const router = useRouter();
    const campuses = useAppSelector((s) => s.campuses.items);
    const { user } = useAuthState();
    const isSuperAdmin = user?.role === "SUPER_ADMIN";

    const [campusId, setCampusId] = useState(user?.campusId ? String(user.campusId) : "");
    const [deptId, setDeptId] = useState("");
    const [date, setDate] = useState(todayIso());
    const [departments, setDepartments] = useState<Department[]>([]);
    const [summary, setSummary] = useState<StaffAttendanceSummary | null>(null);
    const [rows, setRows] = useState<StaffDashboardRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [simulateOpen, setSimulateOpen] = useState(false);

    // Sort
    const [sortKey, setSortKey] = useState<SortKey>("name");
    const [sortAsc, setSortAsc] = useState(true);

    // Bulk selection
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [bulkClockOut, setBulkClockOut] = useState("");
    const [bulking, setBulking] = useState(false);
    const [bulkError, setBulkError] = useState<string | null>(null);

    useEffect(() => {
        dispatch(fetchCampuses());
        hrService.listDepartments().then(setDepartments).catch(console.error);
    }, [dispatch]);

    useEffect(() => {
        if (!campusId && user?.campusId) setCampusId(String(user.campusId));
    }, [user?.campusId, campusId]);

    const load = useCallback(async () => {
        if (!campusId || !date) return;
        setLoading(true);
        setError(null);
        setSelected(new Set());
        try {
            const params = {
                date,
                campus_id: Number(campusId),
                ...(deptId ? { department_id: Number(deptId) } : {}),
            };
            const [summaryData, dashboardData] = await Promise.all([
                attendanceService.getStaffSummary(params),
                attendanceService.getStaffDashboard(params),
            ]);
            setSummary(summaryData);
            setRows(dashboardData);
        } catch {
            setError("Failed to load attendance dashboard.");
        } finally {
            setLoading(false);
        }
    }, [campusId, date, deptId]);

    useEffect(() => { load(); }, [load]);

    // ── Sort ──────────────────────────────────────────────────────────────────

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortAsc((a) => !a);
        else { setSortKey(key); setSortAsc(true); }
    };

    const sorted = [...rows].sort((a, b) => {
        let cmp = 0;
        if (sortKey === "name") cmp = (a.employee.full_name ?? "").localeCompare(b.employee.full_name ?? "");
        else if (sortKey === "status") cmp = (STATUS_SORT_ORDER[String(a.status)] ?? 0) - (STATUS_SORT_ORDER[String(b.status)] ?? 0);
        else if (sortKey === "check_in") cmp = (a.check_in_at ?? "").localeCompare(b.check_in_at ?? "");
        else if (sortKey === "check_out") cmp = (a.check_out_at ?? "").localeCompare(b.check_out_at ?? "");
        return sortAsc ? cmp : -cmp;
    });

    // ── Selection ─────────────────────────────────────────────────────────────

    const allIds = sorted.map((r) => r.employee.id);
    const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

    const toggleAll = () => {
        if (allSelected) setSelected(new Set());
        else setSelected(new Set(allIds));
    };

    const toggleOne = (id: number) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const selectedRows = sorted.filter((r) => selected.has(r.employee.id));
    const anyUnresolved = selectedRows.some((r) => r.check_in_at && !r.check_out_at);

    // ── Bulk actions ──────────────────────────────────────────────────────────

    const applyBulk = async (status: StaffAttendanceStatus) => {
        if (!campusId) return;
        setBulking(true); setBulkError(null);
        try {
            await attendanceService.bulkMarkStaff({
                date, campus_id: Number(campusId),
                records: selectedRows.map((r) => ({ employee_id: r.employee.id, status })),
            });
            setSelected(new Set()); await load();
        } catch { setBulkError("Bulk update failed. Try again."); }
        finally { setBulking(false); }
    };

    const applyClockOut = async () => {
        if (!bulkClockOut || !campusId) return;
        setBulking(true); setBulkError(null);
        try {
            await attendanceService.bulkMarkStaff({
                date, campus_id: Number(campusId),
                records: selectedRows
                    .filter((r) => r.check_in_at)
                    .map((r) => ({ employee_id: r.employee.id, status: r.status ?? "PRESENT", check_out_time: bulkClockOut })),
            });
            setSelected(new Set()); setBulkClockOut(""); await load();
        } catch { setBulkError("Bulk clock-out failed. Try again."); }
        finally { setBulking(false); }
    };

    const sel = "h-10 px-3 border rounded-xl text-sm bg-white dark:bg-zinc-950 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary/30";

    function SortIcon({ k }: { k: SortKey }) {
        if (sortKey !== k) return <ChevronDown className="h-3 w-3 opacity-30" />;
        return sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
    }

    function SortTh({ k, label }: { k: SortKey; label: string }) {
        return (
            <th
                className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer select-none hover:text-zinc-700 dark:hover:text-zinc-200"
                onClick={() => toggleSort(k)}
            >
                <span className="inline-flex items-center gap-1">{label} <SortIcon k={k} /></span>
            </th>
        );
    }

    return (
        <div className="space-y-8 pb-24">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 font-outfit flex items-center gap-2">
                        <CalendarCheck className="h-7 w-7 text-primary" />
                        Attendance Dashboard
                    </h1>
                    <p className="text-sm text-zinc-500 mt-1">Daily staff clock-in/out overview from biometric devices.</p>
                </div>
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

            <div className="flex flex-wrap items-center gap-3">
                <select value={campusId} onChange={(e) => { setCampusId(e.target.value); setDeptId(""); }} disabled={!!user?.campusId} className={`${sel} disabled:opacity-60`}>
                    <option value="">Select campus...</option>
                    {campuses.map((c) => <option key={c.id} value={c.id}>{c.campus_name}</option>)}
                </select>
                <select value={deptId} onChange={(e) => setDeptId(e.target.value)} disabled={!campusId} className={`${sel} disabled:opacity-40`}>
                    <option value="">All departments</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={sel} />
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />{error}
                </div>
            )}

            {!campusId ? (
                <p className="text-sm text-zinc-500 text-center py-14">Select a campus to load the attendance dashboard.</p>
            ) : loading && !summary ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
                </div>
            ) : (
                <>
                    {summary && (
                        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-3 gap-6" key={`${campusId}-${deptId}-${date}`}>
                            <SummaryCard
                                title="Present Summary" icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-900/10"
                                rows={[{ label: "On Time", ...summary.present_summary.on_time }, { label: "Late", ...summary.present_summary.late }, { label: "Early", ...summary.present_summary.early }]}
                            />
                            <SummaryCard
                                title="Not Present Summary" icon={UserX} color="text-rose-600" bg="bg-rose-50 dark:bg-rose-900/10"
                                rows={[{ label: "Absent", ...summary.not_present_summary.absent }, { label: "No Clock In", ...summary.not_present_summary.no_clock_in }, { label: "No Clock Out", ...summary.not_present_summary.no_clock_out }, { label: "Invalid", ...summary.not_present_summary.invalid }]}
                            />
                            <SummaryCard
                                title="Away Summary" icon={Coffee} color="text-amber-600" bg="bg-amber-50 dark:bg-amber-900/10"
                                rows={[{ label: "Day Off", ...summary.away_summary.day_off }, { label: "Time Off", ...summary.away_summary.time_off }]}
                            />
                        </motion.div>
                    )}

                    <div className="rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950 shadow-sm">
                        {rows.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-16 text-zinc-400">
                                <CalendarCheck className="w-8 h-8 opacity-30" />
                                <p className="text-sm">No staff found for this campus{deptId ? " and department" : ""}.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                                            <th className="px-4 py-2.5 w-10">
                                                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded border-zinc-300 dark:border-zinc-600 accent-primary cursor-pointer" />
                                            </th>
                                            <SortTh k="name" label="Employee" />
                                            <SortTh k="check_in" label="Clock In" />
                                            <SortTh k="check_out" label="Clock Out" />
                                            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Overtime</th>
                                            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Location</th>
                                            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Note</th>
                                            <SortTh k="status" label="Status" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {sorted.map((row) => {
                                            const isSelected = selected.has(row.employee.id);
                                            const missingOut = !!(row.check_in_at && !row.check_out_at);
                                            return (
                                                <tr
                                                    key={row.employee.id}
                                                    className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${isSelected ? "bg-primary/5 dark:bg-primary/10" : ""} ${missingOut ? "border-l-2 border-amber-400" : ""}`}
                                                >
                                                    <td className="px-4 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                                                        <input type="checkbox" checked={isSelected} onChange={() => toggleOne(row.employee.id)} className="rounded border-zinc-300 dark:border-zinc-600 accent-primary cursor-pointer" />
                                                    </td>
                                                    <td className="px-4 py-3 cursor-pointer" onClick={() => router.push(`/hr/attendance-dashboard/${row.employee.id}`)}>
                                                        <div className="flex items-center gap-3">
                                                            {row.employee.photo_url ? (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img src={row.employee.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                                                            ) : (
                                                                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                                                    {initials(row.employee.full_name)}
                                                                </div>
                                                            )}
                                                            <div>
                                                                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{row.employee.full_name ?? "Unnamed"}</p>
                                                                <p className="text-xs text-zinc-400">{row.employee.job_title ?? "—"}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{formatTime(row.check_in_at)}</td>
                                                    <td className="px-4 py-3 text-sm">
                                                        {missingOut
                                                            ? <span className="text-amber-600 dark:text-amber-400 font-semibold">Missing ⚠</span>
                                                            : <span className="text-zinc-600 dark:text-zinc-300">{formatTime(row.check_out_at)}</span>}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{formatOvertime(row.overtime_minutes)}</td>
                                                    <td className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">{row.location ?? "—"}</td>
                                                    <td className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">{row.note ?? "—"}</td>
                                                    <td className="px-4 py-3">
                                                        {row.status
                                                            ? <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[row.status]}`}>{STATUS_LABEL[row.status]}</span>
                                                            : <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">—</span>}
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

            {/* Floating bulk action panel */}
            {selected.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
                    <div className="bg-zinc-900 dark:bg-zinc-800 text-white rounded-2xl shadow-2xl border border-zinc-700 px-5 py-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-zinc-200">
                                {selected.size} employee{selected.size !== 1 ? "s" : ""} selected
                            </span>
                            <button onClick={() => { setSelected(new Set()); setBulkClockOut(""); setBulkError(null); }}>
                                <X className="h-4 w-4 text-zinc-400 hover:text-white transition-colors" />
                            </button>
                        </div>
                        {bulkError && <p className="text-xs text-rose-400">{bulkError}</p>}
                        <div className="flex flex-wrap gap-2">
                            {BULK_STATUSES.map((s) => (
                                <button key={s.value} disabled={bulking} onClick={() => applyBulk(s.value)}
                                    className="h-8 px-3 rounded-xl text-xs font-semibold bg-zinc-700 hover:bg-zinc-600 text-zinc-100 transition-colors disabled:opacity-50">
                                    Mark {s.label}
                                </button>
                            ))}
                        </div>
                        {anyUnresolved && (
                            <div className="flex items-center gap-2 pt-1 border-t border-zinc-700">
                                <span className="text-xs text-amber-400 shrink-0">Set clock-out:</span>
                                <input
                                    type="time" value={bulkClockOut} onChange={(e) => setBulkClockOut(e.target.value)}
                                    className="h-8 px-2 rounded-lg text-xs bg-zinc-700 border border-zinc-600 text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                                <button disabled={bulking || !bulkClockOut} onClick={applyClockOut}
                                    className="h-8 px-3 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-white transition-colors disabled:opacity-50 shrink-0 flex items-center gap-1">
                                    {bulking ? <Loader2 className="h-3 w-3 animate-spin" /> : "Apply Clock-Out"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {simulateOpen && <SimulateScanModal onClose={() => setSimulateOpen(false)} onDone={load} />}
        </div>
    );
}
