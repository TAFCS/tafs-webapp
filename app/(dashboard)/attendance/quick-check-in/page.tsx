"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    AlertCircle,
    Building2,
    CalendarOff,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Clock,
    Fingerprint,
    GraduationCap,
    Layers,
    LayoutGrid,
    Loader2,
    LogIn,
    LogOut,
    Search,
    SearchX,
    X,
} from "lucide-react";
import api from "@/lib/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCampuses } from "@/store/slices/campusesSlice";
import type { CampusClass } from "@/store/slices/campusesSlice";
import { useAuthState } from "@/context/AuthContext";
import {
    attendanceService,
    QuickCheckResult,
    QuickCheckState,
    RollRecordStatus,
    ScanDirection,
} from "@/lib/attendance.service";

interface StudentSearchResult {
    cc: number;
    full_name: string;
    gr_number: string | null;
    classes?: { description: string } | null;
    sections?: { description: string } | null;
    campuses?: { campus_name: string } | null;
}

type SegmentOption = {
    id: number;
    code: string;
    name: string;
    display_order: number;
};

export interface QuickCheckFilters {
    campusId: string;
    classId: string;
    sectionId: string;
    segmentId: string;
}

const STATUS_BADGE: Record<RollRecordStatus, string> = {
    PRESENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    ABSENT: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    EXCUSED: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
    LATE: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

/** Scan timestamps are naive Karachi wall-clock stored as UTC — read them back as UTC. */
function formatTime(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
    });
}

function initials(name: string | null): string {
    if (!name) return "?";
    return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function apiError(err: unknown, fallback: string): string {
    return (
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
    );
}

function isPunchBlocked(state: QuickCheckState | null): boolean {
    if (!state?.source || state.source === "BIOMETRIC") return false;
    if (state.source === "LEAVE") return true;
    if (state.source === "MANUAL" || state.source === "SYSTEM") {
        return state.status !== "ABSENT";
    }
    return false;
}

// ── Filters ─────────────────────────────────────────────────────────────────

function QuickCheckFilterBar({
    value,
    onChange,
}: {
    value: QuickCheckFilters;
    onChange: (v: QuickCheckFilters) => void;
}) {
    const dispatch = useAppDispatch();
    const { user } = useAuthState();
    const campuses = useAppSelector((s) => s.campuses.items);
    const [segments, setSegments] = useState<SegmentOption[]>([]);

    const campusLocked = user?.campusId != null;

    useEffect(() => {
        dispatch(fetchCampuses());
    }, [dispatch]);

    useEffect(() => {
        api.get("/v1/financial-reports/filter-options")
            .then(({ data }) => {
                const list = (data?.data?.segments ?? []) as SegmentOption[];
                setSegments([...list].sort((a, b) => a.display_order - b.display_order));
            })
            .catch(() => setSegments([]));
    }, []);

    useEffect(() => {
        if (campusLocked && user?.campusId != null && !value.campusId) {
            onChange({ ...value, campusId: String(user.campusId) });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- seed locked campus once
    }, [campusLocked, user?.campusId]);

    const scopedCampuses = useMemo(() => {
        if (campusLocked && user?.campusId != null) {
            return campuses.filter((c) => c.id === user.campusId);
        }
        return campuses;
    }, [campuses, campusLocked, user?.campusId]);

    const availableClasses: CampusClass[] = useMemo(() => {
        const campus = scopedCampuses.find((c) => String(c.id) === value.campusId);
        let list = campus?.offered_classes ?? [];
        if (value.segmentId) {
            const segId = Number(value.segmentId);
            list = list.filter((cls) => cls.segment_id === segId);
        }
        return list;
    }, [scopedCampuses, value.campusId, value.segmentId]);

    const selectedClass = availableClasses.find((c) => String(c.id) === value.classId);
    const availableSections = selectedClass?.sections ?? [];

    const sel =
        "w-full h-10 px-3 appearance-none bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-primary transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

    const lockedCampusName =
        scopedCampuses.find((c) => c.id === user?.campusId)?.campus_name ?? "Your campus";

    return (
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Filters</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative">
                    <label className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 mb-1.5">
                        <Building2 className="h-3 w-3" /> Campus
                    </label>
                    {campusLocked ? (
                        <div className="h-10 flex items-center px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                            {lockedCampusName}
                        </div>
                    ) : (
                        <div className="relative">
                            <select
                                value={value.campusId}
                                onChange={(e) =>
                                    onChange({
                                        campusId: e.target.value,
                                        classId: "",
                                        sectionId: "",
                                        segmentId: value.segmentId,
                                    })
                                }
                                className={sel}
                            >
                                <option value="">All campuses</option>
                                {scopedCampuses.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.campus_name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2.5 top-[calc(50%+0.5rem)] -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                        </div>
                    )}
                </div>

                <div className="relative">
                    <label className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 mb-1.5">
                        <Layers className="h-3 w-3" /> Segment
                    </label>
                    <div className="relative">
                        <select
                            value={value.segmentId}
                            onChange={(e) =>
                                onChange({
                                    ...value,
                                    segmentId: e.target.value,
                                    classId: "",
                                    sectionId: "",
                                })
                            }
                            className={sel}
                        >
                            <option value="">All segments</option>
                            {segments.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-[calc(50%+0.5rem)] -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                    </div>
                </div>

                <div className="relative">
                    <label className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 mb-1.5">
                        <GraduationCap className="h-3 w-3" /> Class
                    </label>
                    <div className="relative">
                        <select
                            value={value.classId}
                            onChange={(e) =>
                                onChange({ ...value, classId: e.target.value, sectionId: "" })
                            }
                            disabled={!value.campusId}
                            className={sel}
                        >
                            <option value="">All classes</option>
                            {availableClasses.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.class_code ? `${c.class_code} — ${c.description}` : c.description}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-[calc(50%+0.5rem)] -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                    </div>
                </div>

                <div className="relative">
                    <label className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 mb-1.5">
                        <LayoutGrid className="h-3 w-3" /> Section
                    </label>
                    <div className="relative">
                        <select
                            value={value.sectionId}
                            onChange={(e) => onChange({ ...value, sectionId: e.target.value })}
                            disabled={!value.classId}
                            className={sel}
                        >
                            <option value="">All sections</option>
                            {availableSections.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.description}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-[calc(50%+0.5rem)] -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Search box ──────────────────────────────────────────────────────────────

function StudentSearch({
    filters,
    onSelect,
    autoFocusKey,
}: {
    filters: QuickCheckFilters;
    onSelect: (student: StudentSearchResult) => void;
    autoFocusKey: number;
}) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<StudentSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const boxRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, [autoFocusKey]);

    useEffect(() => {
        const onClickOutside = (e: MouseEvent) => {
            if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
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
                const params: Record<string, string | number> = { q: query };
                if (filters.campusId) params.campus_id = Number(filters.campusId);
                if (filters.classId) params.class_id = Number(filters.classId);
                if (filters.sectionId) params.section_id = Number(filters.sectionId);
                if (filters.segmentId) params.segment_id = Number(filters.segmentId);
                const { data } = await api.get("/v1/students/search-simple", { params });
                setResults(data?.data ?? []);
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 350);
        return () => clearTimeout(timer);
    }, [query, filters.campusId, filters.classId, filters.sectionId, filters.segmentId]);

    function pick(student: StudentSearchResult) {
        onSelect(student);
        setQuery("");
        setResults([]);
        setOpen(false);
    }

    return (
        <div className="relative w-full" ref={boxRef}>
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-primary transition-colors" />
                <input
                    ref={inputRef}
                    type="text"
                    autoFocus
                    placeholder="Search student by name, GR number, or CC..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query.trim() && setOpen(true)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && results.length > 0) pick(results[0]);
                        if (e.key === "Escape") setOpen(false);
                    }}
                    className="w-full h-14 pl-12 pr-11 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-base bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
                {query && (
                    <button
                        onClick={() => {
                            setQuery("");
                            setResults([]);
                            setOpen(false);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"
                    >
                        <X className="h-4 w-4 text-zinc-400" />
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
                                <SearchX className="h-6 w-6 text-zinc-300" />
                                <p className="text-xs text-zinc-400">No students found for &quot;{query}&quot;</p>
                            </div>
                        ) : (
                            <div className="p-1.5">
                                {results.map((s) => (
                                    <button
                                        key={s.cc}
                                        onClick={() => pick(s)}
                                        className="w-full flex items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-xl transition-colors text-left"
                                    >
                                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                                            {initials(s.full_name)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 truncate">
                                                {s.full_name}
                                            </p>
                                            <p className="text-xs text-zinc-400 truncate">
                                                CC: {s.cc} · GR: {s.gr_number ?? "—"}
                                                {s.classes?.description ? ` · ${s.classes.description}` : ""}
                                                {s.sections?.description ? ` (${s.sections.description})` : ""}
                                                {s.campuses?.campus_name ? ` · ${s.campuses.campus_name}` : ""}
                                            </p>
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

// ── Page ────────────────────────────────────────────────────────────────────

export default function QuickCheckInPage() {
    const { user } = useAuthState();
    const [filters, setFilters] = useState<QuickCheckFilters>({
        campusId: user?.campusId ? String(user.campusId) : "",
        classId: "",
        sectionId: "",
        segmentId: "",
    });
    const [selected, setSelected] = useState<StudentSearchResult | null>(null);
    const [state, setState] = useState<QuickCheckState | null>(null);
    const [loadingState, setLoadingState] = useState(false);
    const [punching, setPunching] = useState<ScanDirection | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [lastResult, setLastResult] = useState<QuickCheckResult | null>(null);
    const [focusKey, setFocusKey] = useState(0);

    const loadState = useCallback(async (cc: number) => {
        setLoadingState(true);
        setError(null);
        try {
            setState(await attendanceService.getQuickCheckState(cc));
        } catch (err) {
            setState(null);
            setError(apiError(err, "Failed to load this student's attendance state."));
        } finally {
            setLoadingState(false);
        }
    }, []);

    useEffect(() => {
        if (selected) loadState(selected.cc);
    }, [selected, loadState]);

    async function punch(direction: ScanDirection) {
        if (!selected) return;
        setPunching(direction);
        setError(null);
        try {
            const result = await attendanceService.quickCheck(selected.cc, direction);
            setLastResult(result);
            await loadState(selected.cc);
            setFocusKey((k) => k + 1);
        } catch (err) {
            setError(apiError(err, "Failed to record the punch."));
            await loadState(selected.cc);
        } finally {
            setPunching(null);
        }
    }

    function clearSelection() {
        setSelected(null);
        setState(null);
        setError(null);
        setFocusKey((k) => k + 1);
    }

    const punchBlocked = isPunchBlocked(state);
    const canCheckIn = state?.next_direction === "IN" && state.is_working_day && !punchBlocked;
    const canCheckOut = state?.next_direction === "OUT" && state.is_working_day && !punchBlocked;
    const busy = punching !== null || loadingState;
    const defaultAbsentCanCheckIn =
        state?.next_direction === "IN" &&
        state.is_working_day &&
        !punchBlocked &&
        state.scan_count === 0 &&
        (!state.status || state.status === "ABSENT");

    return (
        <div className="space-y-6 pb-10 max-w-3xl mx-auto">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 font-outfit flex items-center gap-2">
                    <Clock className="h-7 w-7 text-primary" />
                    Quick Check-In / Check-Out
                </h1>
                <p className="text-sm text-zinc-500 mt-1">
                    Search a student and punch them in or out at the current time. No biometric
                    enrolment required — the punch lands on the same daily attendance record as a
                    device scan, and the family is notified.
                </p>
            </div>

            <QuickCheckFilterBar value={filters} onChange={setFilters} />

            <StudentSearch filters={filters} onSelect={setSelected} autoFocusKey={focusKey} />

            {lastResult && !selected && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <p className="text-sm">
                        <span className="font-semibold">{lastResult.full_name}</span>{" "}
                        {lastResult.direction === "IN" ? "checked in" : "checked out"} at{" "}
                        <span className="font-semibold">{formatTime(lastResult.scan_time)}</span>.
                    </p>
                </div>
            )}

            {error && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-sm">{error}</p>
                </div>
            )}

            {!selected ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-zinc-400">
                    <Search className="w-9 h-9 opacity-30" />
                    <p className="text-sm">Search for a student to begin.</p>
                </div>
            ) : (
                <motion.div
                    key={selected.cc}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] shadow-sm overflow-hidden"
                >
                    <div className="flex items-center gap-4 p-6 border-b border-zinc-100 dark:border-zinc-800">
                        {state?.student.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={state.student.photo_url}
                                alt=""
                                className="w-14 h-14 rounded-full object-cover"
                            />
                        ) : (
                            <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-bold shrink-0">
                                {initials(selected.full_name)}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50 truncate">
                                {state?.student.full_name ?? selected.full_name}
                            </p>
                            <p className="text-xs text-zinc-400">
                                CC: {selected.cc} · GR: {state?.student.gr_number ?? selected.gr_number ?? "—"}
                                {state?.student.class ? ` · ${state.student.class}` : ""}
                                {state?.student.section ? ` (${state.student.section})` : ""}
                            </p>
                        </div>
                        {state?.status && (
                            <span
                                className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[state.status]}`}
                            >
                                {state.status}
                            </span>
                        )}
                        <button
                            onClick={clearSelection}
                            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-400"
                            title="Clear"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {loadingState && !state ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-7 w-7 animate-spin text-primary opacity-50" />
                        </div>
                    ) : (
                        <>
                            {state && !state.is_working_day && (
                                <div className="flex items-start gap-3 m-6 mb-0 p-4 rounded-2xl bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-200">
                                    <CalendarOff className="w-5 h-5 shrink-0 mt-0.5" />
                                    <div className="text-sm">
                                        <p className="font-semibold">
                                            Non-working day — {state.day_description ?? "Holiday"}
                                        </p>
                                        <p className="text-sky-800/80 dark:text-sky-300/80 mt-1">
                                            Attendance cannot be recorded for today.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {punchBlocked && (
                                <div className="flex items-start gap-3 m-6 mb-0 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300 text-sm">
                                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                    <p>
                                        Today&apos;s record was already set by hand from the attendance
                                        dashboard ({state?.status}). Edit it there instead of punching here.
                                    </p>
                                </div>
                            )}

                            {defaultAbsentCanCheckIn && (
                                <div className="flex items-start gap-3 m-6 mb-0 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 text-sm">
                                    <LogIn className="w-5 h-5 shrink-0 mt-0.5" />
                                    <p>
                                        {state?.status === "ABSENT"
                                            ? "Marked absent — checking in now will record their arrival and mark them present."
                                            : "No check-in yet — punching in will mark this student present and notify the family."}
                                    </p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4 p-6">
                                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                        Checked In
                                    </p>
                                    <p className="text-2xl font-black text-zinc-900 dark:text-zinc-50 font-outfit mt-1">
                                        {formatTime(state?.check_in_at ?? null)}
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                        Checked Out
                                    </p>
                                    <p className="text-2xl font-black text-zinc-900 dark:text-zinc-50 font-outfit mt-1">
                                        {formatTime(state?.check_out_at ?? null)}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-6 pb-6">
                                <button
                                    onClick={() => punch("IN")}
                                    disabled={!canCheckIn || busy}
                                    className="flex items-center justify-center gap-2 h-16 rounded-2xl bg-emerald-600 text-white text-base font-bold hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                                >
                                    {punching === "IN" ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <LogIn className="h-5 w-5" />
                                    )}
                                    Check In
                                </button>
                                <button
                                    onClick={() => punch("OUT")}
                                    disabled={!canCheckOut || busy}
                                    className="flex items-center justify-center gap-2 h-16 rounded-2xl bg-rose-600 text-white text-base font-bold hover:bg-rose-700 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                                >
                                    {punching === "OUT" ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <LogOut className="h-5 w-5" />
                                    )}
                                    Check Out
                                </button>
                            </div>

                            {state && state.scans.length > 0 && (
                                <div className="px-6 pb-6">
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
                                        Today&apos;s punches
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {state.scans.map((s) => (
                                            <span
                                                key={s.id}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                                                    s.direction === "IN"
                                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                                                        : "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400"
                                                }`}
                                            >
                                                {s.is_manual ? (
                                                    <Clock className="h-3 w-3" />
                                                ) : (
                                                    <Fingerprint className="h-3 w-3" />
                                                )}
                                                {s.direction ?? "—"} {formatTime(s.scan_time)}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </motion.div>
            )}
        </div>
    );
}
