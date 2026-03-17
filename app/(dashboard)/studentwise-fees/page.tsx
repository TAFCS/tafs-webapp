"use client";

import { useState, useEffect, useRef, useCallback, KeyboardEvent, useMemo, Suspense } from "react";
import { Search, Loader2, AlertCircle, GraduationCap, ChevronDown, X, RefreshCw, Trash2, Plus, Users2, Settings2, UserSearch } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { fetchClasses } from "@/store/slices/classesSlice";
import { fetchFeeTypes } from "@/store/slices/feeTypesSlice";
import { fetchCampuses } from "@/store/slices/campusesSlice";
import { fetchSections } from "@/store/slices/sectionsSlice";
import toast from "react-hot-toast";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FeeTypeInfo {
    id: number;
    description: string;
    freq: "MONTHLY" | "ONE_TIME" | null;
    breakup: string[] | null;
    priority_order?: number;
}

interface ClassFeeRow {
    id: number;
    class_id: number;
    fee_id: number;
    amount: string;
    fee_types: FeeTypeInfo;
}

interface SpreadsheetRow {
    __id: string; // Internal tracking for stable IDs
    feeId: number;
    feeDescription: string;
    freq: "MONTHLY" | "ONE_TIME" | null;
    initialMonth: string; // The original month reference
    month: string;        // The editable period
    amount: string;
    // UI state
    isGroupStart?: boolean;
    groupSize?: number;
}

const MONTH_ORDER = [
    "August", "September", "October", "November", "December",
    "January", "February", "March", "April", "May", "June", "July",
];

const MONTH_TO_NUM: Record<string, number> = {
    August: 8, September: 9, October: 10, November: 11, December: 12,
    January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7,
};

const ACADEMIC_YEARS = ["2024-2025", "2025-2026", "2026-2027", "2027-2028"];

function calendarYear(academicYearStart: number, monthNum: number): number {
    return monthNum >= 8 ? academicYearStart : academicYearStart + 1;
}

const COLS = ["Actions", "#", "Fee Type", "Frequency", "Month", "Period", "Amount"] as const;
const COL_ACTIONS = 0;
const COL_NUM = 1;
const COL_FEE_TYPE = 2;
const COL_FREQ = 3;
const COL_MONTH_READONLY = 4;
const COL_PERIOD = 5;
const COL_AMOUNT = 6;

function sortMonths(months: unknown): string[] {
    let arr = months;
    if (arr && typeof arr === "object" && !Array.isArray(arr) && Array.isArray((arr as Record<string, unknown>).months)) {
        arr = (arr as Record<string, unknown>).months;
    }
    if (typeof arr === "string") {
        try { arr = JSON.parse(arr); } catch { return []; }
    }
    if (!Array.isArray(arr)) return [];
    return [...arr].sort((a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b));
}

function sortSpreadsheetRows(rows: SpreadsheetRow[]): SpreadsheetRow[] {
    return [...rows].sort((a, b) => {
        const ai = MONTH_ORDER.indexOf(a.month);
        const bi = MONTH_ORDER.indexOf(b.month);
        const va = ai === -1 ? 99 : ai;
        const vb = bi === -1 ? 99 : bi;
        if (va !== vb) return va - vb;
        // Secondary sort by description
        return a.feeDescription.localeCompare(b.feeDescription);
    }).map((r, i, arr) => ({
        ...r,
        isGroupStart: i === 0 || r.initialMonth !== arr[i - 1].initialMonth
    }));
}

// ─── Component ───────────────────────────────────────────────────────────────

function StudentwiseFeeEditor() {
    const dispatch = useAppDispatch();
    const searchParams = useSearchParams();
    const router = useRouter();

    const classes = useAppSelector((s) => s.classes.items);
    const classesLoading = useAppSelector((s) => s.classes.isLoading);
    const feeTypes = useAppSelector((s) => s.feeTypes.items);
    const feeTypesLoading = useAppSelector((s) => s.feeTypes.isLoading);
    const campuses = useAppSelector((s) => s.campuses.items);
    const campusesLoading = useAppSelector((s) => s.campuses.isLoading);
    const sections = useAppSelector((s) => s.sections.items);
    const sectionsLoading = useAppSelector((s) => s.sections.isLoading);

    const [selectedCampusId, setSelectedCampusId] = useState<number | "">("");
    const [selectedClassId, setSelectedClassId] = useState<number | "">("");
    const [selectedSectionId, setSelectedSectionId] = useState<number | "">("");
    const [selectedYear, setSelectedYear] = useState("2024-2025");

    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [skipSearch, setSkipSearch] = useState(false);
    const [searchResults, setSearchResults] = useState<{ cc: number; full_name: string; gr_number: string }[]>([]);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const searchDropdownRef = useRef<HTMLDivElement>(null);

    const [classSearch, setClassSearch] = useState("");
    const [showClassDropdown, setShowClassDropdown] = useState(false);
    const classDropdownRef = useRef<HTMLDivElement>(null);

    const [campusSearch, setCampusSearch] = useState("");
    const [showCampusDropdown, setShowCampusDropdown] = useState(false);
    const campusDropdownRef = useRef<HTMLDivElement>(null);

    const [sectionSearch, setSectionSearch] = useState("");
    const [showSectionDropdown, setShowSectionDropdown] = useState(false);
    const sectionDropdownRef = useRef<HTMLDivElement>(null);

    const [studentId, setStudentId] = useState("");

    const [rows, setRows] = useState<SpreadsheetRow[]>([]);
    const [feeToAmountMap, setFeeToAmountMap] = useState<Record<number, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

    const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
    const tbodyRef = useRef<HTMLTableSectionElement>(null);
    const pendingFocusId = useRef<string | null>(null);

    // Track rows to see if we need to fix focus after a sort
    useEffect(() => {
        if (pendingFocusId.current) {
            const newIdx = rows.findIndex(r => r.__id === pendingFocusId.current);
            if (newIdx !== -1 && activeCell?.row !== newIdx) {
                setActiveCell(prev => prev ? { ...prev, row: newIdx } : null);
            }
            pendingFocusId.current = null;
        }
    }, [rows, activeCell]);

    useEffect(() => {
        if (classes.length === 0) dispatch(fetchClasses());
        if (feeTypes.length === 0) dispatch(fetchFeeTypes());
        if (campuses.length === 0) dispatch(fetchCampuses());
        if (sections.length === 0) dispatch(fetchSections());
    }, [classes.length, feeTypes.length, campuses.length, sections.length, dispatch]);

    // Read params from URL
    useEffect(() => {
        const cc = searchParams.get("ccNumber");
        const cid = searchParams.get("classId");

        if (cc) {
            setStudentId(cc);
            // Auto-load student profile if CC exists
            const fetchProfile = async () => {
                try {
                    const numericMatch = cc.match(/\d+$/);
                    const ccKey = numericMatch ? numericMatch[0] : cc;
                    const { data } = await api.get(`/v1/students/${ccKey}`);
                    const fullStudent = data?.data;
                    if (fullStudent) {
                        if (fullStudent.campus_id) setSelectedCampusId(fullStudent.campus_id);
                        if (fullStudent.class_id) setSelectedClassId(fullStudent.class_id);
                        if (fullStudent.section_id) setSelectedSectionId(fullStudent.section_id);
                        setSkipSearch(true);
                        setSearchQuery(`${fullStudent.student_full_name || fullStudent.full_name} (${fullStudent.cc_number || fullStudent.cc})`);
                    }
                } catch (e) {
                    console.error("Auto-filling student profile failed:", e);
                }
            };
            fetchProfile();
        }

        if (cid && cid !== "null" && cid !== "undefined" && !isNaN(Number(cid))) {
            setSelectedClassId(Number(cid));
        }
    }, [searchParams]);

    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (classDropdownRef.current && !classDropdownRef.current.contains(e.target as Node)) setShowClassDropdown(false);
            if (campusDropdownRef.current && !campusDropdownRef.current.contains(e.target as Node)) setShowCampusDropdown(false);
            if (sectionDropdownRef.current && !sectionDropdownRef.current.contains(e.target as Node)) setShowSectionDropdown(false);
            if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target as Node)) setShowSearchDropdown(false);
        };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    // Search effect
    useEffect(() => {
        if (skipSearch) {
            setSkipSearch(false);
            return;
        }

        if (!searchQuery.trim()) {
            setSearchResults([]);
            setShowSearchDropdown(false);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const { data } = await api.get(`/v1/students/search-simple?q=${searchQuery}`);
                setSearchResults(data?.data || []);
                setShowSearchDropdown(true);
            } catch (err) {
                console.error("Search failed:", err);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const fetchFeeSchedule = useCallback(async (classId: number, campusId: number | "", ccNumber: string, academicYear: string) => {
        setIsLoading(true); setLoadError(null); setRows([]); setActiveCell(null);
        try {
            // 1. Fetch Class Schedule
            const params: any = { class_id: classId };
            if (campusId) params.campus_id = campusId;

            const { data } = await api.get("/v1/class-fee-schedule/by-class", { params });
            const feeRows: ClassFeeRow[] = Array.isArray(data?.data) ? data.data : [];

            // Build designated amount lookup
            const lookup: Record<number, string> = {};
            feeRows.forEach(f => { lookup[f.fee_id] = f.amount; });
            setFeeToAmountMap(lookup);

            const sorted = [...feeRows].sort((a, b) => {
                if ((a.fee_types.priority_order ?? 0) !== (b.fee_types.priority_order ?? 0)) {
                    return (a.fee_types.priority_order ?? 0) - (b.fee_types.priority_order ?? 0);
                }
                const order = (f: ClassFeeRow) => f.fee_types.freq === "ONE_TIME" ? 0 : 1;
                return order(a) - order(b);
            });

            // 2. Expand rows
            const expanded = sorted.flatMap((fee) => {
                const months = sortMonths(fee.fee_types.breakup ?? []);
                return months.map((month) => ({
                    __id: Math.random().toString(36).substring(7),
                    feeId: fee.fee_id,
                    feeDescription: fee.fee_types.description,
                    freq: fee.fee_types.freq,
                    initialMonth: month,
                    month,
                    amount: fee.amount,
                }));
            });

            // 3. Apply global sort by month
            let finalRows = sortSpreadsheetRows(expanded);

            // 4. Fetch Student-specific overrides if Computer Code provided
            if (ccNumber) {
                try {
                    const numericMatch = ccNumber.match(/\d+$/);
                    const ccKey = numericMatch ? numericMatch[0] : ccNumber;
                    const studentRes = await api.get(`/v1/student-fees/by-student/${ccKey}`);
                    const studentFees = studentRes.data?.data || [];

                    // Merge student overrides into the expanded rows
                    finalRows = finalRows.map(row => {
                        const monthNum = MONTH_TO_NUM[row.month];
                        const override = Array.isArray(studentFees) ? studentFees.find((sf: any) => 
                            sf.fee_type_id === row.feeId && 
                            sf.month === monthNum &&
                            sf.academic_year === academicYear
                        ) : null;
                        return override ? { ...row, amount: override.amount_before_discount?.toString() || override.amount?.toString() } : row;
                    });
                } catch (e) {
                    console.error("No student overrides found or error fetching them.", e);
                }
            }

            setRows(sortSpreadsheetRows(finalRows));
        } catch (err: any) {
            setLoadError(err.response?.data?.message || "Failed to load fee schedule.");
        } finally { setIsLoading(false); }
    }, []);

    useEffect(() => {
        if (selectedClassId !== "") {
            fetchFeeSchedule(Number(selectedClassId), selectedCampusId, studentId, selectedYear);
        } else {
            setRows([]);
        }
    }, [selectedClassId, selectedCampusId, studentId, selectedYear, fetchFeeSchedule]);

    const handleSelectStudent = async (student: { cc: number; full_name: string; gr_number: string }) => {
        setIsSearching(true);
        try {
            const { data } = await api.get(`/v1/students/${student.cc}`);
            const fullStudent = data?.data;

            if (fullStudent) {
                if (fullStudent.campus_id) setSelectedCampusId(fullStudent.campus_id);
                if (fullStudent.class_id) setSelectedClassId(fullStudent.class_id);
                if (fullStudent.section_id) setSelectedSectionId(fullStudent.section_id);
                setStudentId(`${fullStudent.cc_number || fullStudent.cc}`);

                setSkipSearch(true);
                setSearchQuery(`${fullStudent.student_full_name || fullStudent.full_name} (${fullStudent.cc_number || fullStudent.cc})`);

                setShowSearchDropdown(false);
                toast.success(`Loaded profile for ${fullStudent.student_full_name || fullStudent.full_name}`);
            } else {
                toast.error("Student not found.");
            }
        } catch (e) {
            toast.error("Failed to load student details.");
        } finally {
            setIsSearching(false);
        }
    };

    const handleClearSearch = () => {
        setSearchQuery("");
        setStudentId("");
        setSelectedCampusId("");
        setSelectedClassId("");
        setSelectedSectionId("");
        setRows([]);
        setSearchResults([]);
        setShowSearchDropdown(false);
        setLoadError(null);
        setSaveStatus(null);
    };

    // ── Keyboard navigation ───────────────────────────────────────────────
    const totalRows = rows.length;
    const totalCols = COLS.length;

    const navigate = useCallback((dr: number, dc: number) => {
        setActiveCell((prev) => {
            const r = prev ? Math.max(0, Math.min(totalRows - 1, prev.row + dr)) : 0;
            const c = prev ? Math.max(0, Math.min(totalCols - 1, prev.col + dc)) : COL_AMOUNT;
            return { row: r, col: c };
        });
    }, [totalRows, totalCols]);

    const handleTableKeyDown = useCallback((e: KeyboardEvent<HTMLElement>) => {
        if (!activeCell) return;

        const isInput = (e.target as HTMLElement).tagName === "INPUT";

        if (isInput) {
            if (e.key === "ArrowUp") { e.preventDefault(); navigate(-1, 0); }
            if (e.key === "ArrowDown") { e.preventDefault(); navigate(1, 0); }
            if (e.key === "Enter") { e.preventDefault(); navigate(1, 0); }
            if (e.key === "Tab") { e.preventDefault(); e.shiftKey ? navigate(0, -1) : navigate(0, 1); }
        } else {
            if (e.key === "ArrowUp") { e.preventDefault(); navigate(-1, 0); }
            if (e.key === "ArrowDown") { e.preventDefault(); navigate(1, 0); }
            if (e.key === "ArrowLeft") { e.preventDefault(); navigate(0, -1); }
            if (e.key === "ArrowRight") { e.preventDefault(); navigate(0, 1); }
            if (e.key === "Tab") { e.preventDefault(); e.shiftKey ? navigate(0, -1) : navigate(0, 1); }
            if (e.key === "Enter") { e.preventDefault(); navigate(0, 1); }
        }
    }, [activeCell, navigate]);

    useEffect(() => {
        if (!activeCell || !tbodyRef.current) return;
        const selector = `[data-row="${activeCell.row}"][data-col="${activeCell.col}"]`;
        const el = tbodyRef.current.querySelector<HTMLElement>(selector);
        if (el) {
            // Find the most appropriate element to focus:
            // 1. If the element itself is an input or select, use it.
            // 2. Otherwise, look for an input or select inside it.
            // 3. Fallback to the element itself if it has a tabIndex.
            const target = (el.tagName === "INPUT" || el.tagName === "SELECT")
                ? el
                : (el.querySelector<HTMLElement>("input, select") || (el.hasAttribute("tabindex") ? el : el));

            if (target && typeof target.focus === "function") {
                target.focus({ preventScroll: false });
            }
            el.scrollIntoView({ block: "nearest" });
        }
    }, [activeCell]);

    // ── Saving ──────────────────────────────────────────────────────────
    const today = new Date();
    const academicYearStart = today.getMonth() >= 7 ? today.getFullYear() : today.getFullYear() - 1;

    const handleSave = async () => {
        if (!studentId.trim()) {
            setSaveStatus({ type: "error", message: "Please enter a Computer Code before saving." });
            return;
        }
        if (rows.length === 0) return;

        setSaveStatus(null);
        setIsSaving(true);
        try {
            const items = rows.map((row) => {
                const monthNum = MONTH_TO_NUM[row.month] || 8;
                return {
                    fee_type_id: row.feeId,
                    month: monthNum,
                    amount: parseFloat(row.amount || "0"),
                    academic_year: selectedYear,
                };
            });

            const numericMatch = studentId.match(/\d+$/);
            const ccValue = numericMatch ? parseInt(numericMatch[0]) : 0;

            // Prepare parallel API calls
            const requests: Promise<any>[] = [
                api.post("/v1/fees/student", { cc: ccValue, items })
            ];

            // If Campus/Class/Section are fully selected, also sync the Campus Config
            if (selectedCampusId && selectedClassId && selectedSectionId) {
                requests.push(
                    api.put(`/v1/campuses/${selectedCampusId}/classes/${selectedClassId}/sections/${selectedSectionId}`, {
                        is_active: true
                    })
                );
            }

            await Promise.all(requests);

            const displayId = studentId.replace(/^CC-/, "");
            const msg = `${items.length} records saved for student ${displayId}. Campus configuration synced.`;
            setSaveStatus({ type: "success", message: msg });
            toast.success("Student records and campus configuration saved!");
        } catch (err: any) {
            const msg = err.response?.data?.message || "Failed to save data. Please verify all fields.";
            setSaveStatus({ type: "error", message: msg });
            toast.error(msg);
        } finally { setIsSaving(false); }
    };

    // ── Row Mutators ────────────────────────────────────────────────────
    const deleteRow = (idx: number) => {
        setRows((prev) => prev.filter((_, i) => i !== idx));
    };

    const addRow = () => {
        const firstType = feeTypes[0];
        const newRow: SpreadsheetRow = {
            __id: Math.random().toString(36).substring(7),
            feeId: firstType?.id || 0,
            feeDescription: firstType?.description || "",
            freq: firstType?.freq || "MONTHLY",
            initialMonth: "August",
            month: "August",
            amount: "0",
        };
        pendingFocusId.current = newRow.__id;
        setRows((prev) => sortSpreadsheetRows([...prev, newRow]));
    };

    const updateRow = (idx: number, field: keyof SpreadsheetRow, val: any) => {
        pendingFocusId.current = rows[idx].__id;
        setRows((prev) => {
            const next = prev.map((r, i) => {
                if (i !== idx) return r;
                const updated = { ...r, [field]: val };

                if (field === "feeId") {
                    const ft = feeTypes.find(f => f.id === val);
                    if (ft) {
                        updated.feeDescription = ft.description;
                        updated.freq = ft.freq;
                        if (feeToAmountMap[val]) {
                            updated.amount = feeToAmountMap[val];
                        }
                    }
                }
                return updated;
            });
            return sortSpreadsheetRows(next);
        });
    };

    const grandTotal = rows.reduce((s, r) => s + parseFloat(r.amount || "0"), 0);

    const selectedClass = classes.find((c) => c.id === Number(selectedClassId));
    const filteredClasses = classes.filter((c) =>
        c.description.toLowerCase().includes(classSearch.toLowerCase()) ||
        c.class_code.toLowerCase().includes(classSearch.toLowerCase())
    );

    const selectedCampus = campuses.find((c) => c.id === Number(selectedCampusId));
    const filteredCampuses = campuses.filter((c) =>
        c.campus_name.toLowerCase().includes(campusSearch.toLowerCase()) ||
        c.campus_code.toLowerCase().includes(campusSearch.toLowerCase())
    );

    const selectedSection = sections.find((s) => s.id === Number(selectedSectionId));
    const filteredSections = sections.filter((s) =>
        s.description.toLowerCase().includes(sectionSearch.toLowerCase())
    );

    const isCellActive = (r: number, c: number) => activeCell?.row === r && activeCell?.col === c;

    return (
        <div className="space-y-6 pb-20">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Student Fees</h1>
                        <p className="text-zinc-500 dark:text-zinc-400 mt-0.5 text-sm italic font-medium">Customize individual fee schedules.</p>
                    </div>

                    <div className="flex bg-zinc-100 dark:bg-zinc-800 px-4 py-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-inner translate-y-0.5">
                        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                            <Settings2 className="h-4 w-4" /> Individual Schedule Mode
                        </span>
                    </div>
                </div>

                {rows.length > 0 && (
                    <button onClick={addRow} className="group flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-semibold rounded-xl hover:bg-zinc-800 transition-all active:scale-95">
                        <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
                        New Row
                    </button>
                )}
            </div>

            {/* Config Bar */}
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] shadow-sm p-6">
                <div className="flex flex-col xl:flex-row xl:items-end gap-5 animate-in slide-in-from-right-4 duration-300">
                    {/* Academic Year Select */}
                    <div className="w-full xl:w-48">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.1em] block mb-1.5 ml-1">Academic Year</label>
                        <div className="relative">
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                                className="w-full h-11 px-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold text-primary appearance-none outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer shadow-sm"
                            >
                                {ACADEMIC_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                        </div>
                    </div>

                    {/* Campus Select */}
                    <div className="w-full xl:w-64">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.1em] block mb-1.5 ml-1">Campus</label>
                        <div className="relative" ref={campusDropdownRef}>
                            <button type="button" disabled
                                className="w-full h-11 flex items-center justify-between px-5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm transition-all cursor-not-allowed opacity-70"
                            >
                                <span className={selectedCampus ? "text-zinc-800 dark:text-zinc-200 font-semibold" : "text-zinc-400"}>
                                    {selectedCampus ? selectedCampus.campus_name : "Select Campus..."}
                                </span>
                                <ChevronDown className="h-4 w-4 text-zinc-300" />
                            </button>
                            {showCampusDropdown && (
                                <div className="absolute z-50 top-full mt-2 w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="p-3 border-b border-zinc-100 bg-zinc-50 dark:bg-zinc-900/50">
                                        <div className="relative">
                                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                            <input autoFocus type="text" placeholder="Filter campuses..." value={campusSearch} onChange={(e) => setCampusSearch(e.target.value)}
                                                className="w-full pl-10 pr-4 h-9 text-sm bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:border-primary"
                                            />
                                        </div>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto p-1">
                                        {campusesLoading ? <div className="p-4 text-xs text-zinc-400 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />Loading...</div>
                                            : filteredCampuses.map((c) => (
                                                <button key={c.id} type="button" onClick={() => { setSelectedCampusId(c.id); setShowCampusDropdown(false); }}
                                                    className={`w-full flex items-center px-4 h-10 text-sm rounded-lg ${selectedCampusId === c.id ? "bg-primary text-white font-semibold" : "hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800"}`}
                                                >
                                                    {c.campus_name}
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.1em] block mb-1.5 ml-1">Class / Grade</label>
                        <div className="relative" ref={classDropdownRef}>
                            <button type="button" disabled
                                className="w-full h-11 flex items-center justify-between px-5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm transition-all cursor-not-allowed opacity-70"
                            >
                                <span className={selectedClass ? "text-zinc-800 dark:text-zinc-200 font-semibold" : "text-zinc-400"}>
                                    {selectedClass ? `${selectedClass.description}` : "Choose a class..."}
                                </span>
                                <div className="flex items-center gap-2">
                                    {selectedClass && <span className="text-[10px] font-bold px-2 py-0.5 bg-zinc-200 text-zinc-600 dark:text-zinc-400 rounded-md">{selectedClass.class_code}</span>}
                                    <ChevronDown className="h-4 w-4 text-zinc-300" />
                                </div>
                            </button>
                            {showClassDropdown && (
                                <div className="absolute z-50 top-full mt-2 w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="p-3 border-b border-zinc-100 bg-zinc-50 dark:bg-zinc-900/50">
                                        <div className="relative">
                                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                            <input autoFocus type="text" placeholder="Filter classes..." value={classSearch} onChange={(e) => setClassSearch(e.target.value)}
                                                className="w-full pl-10 pr-4 h-9 text-sm bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:border-primary"
                                            />
                                        </div>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto p-1 space-y-1">
                                        {classesLoading ? <div className="p-6 text-sm text-zinc-400 text-center flex items-center justify-center gap-3"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>
                                            : filteredClasses.length === 0 ? <div className="p-6 text-sm text-zinc-400 text-center">No results</div>
                                                : filteredClasses.map((c) => (
                                                    <button key={c.id} type="button" onClick={() => { setSelectedClassId(c.id); setShowClassDropdown(false); }}
                                                        className={`w-full flex items-center justify-between px-4 h-10 text-sm rounded-lg transition-all ${selectedClassId === c.id ? "bg-primary text-white font-semibold" : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800"}`}
                                                    >
                                                        <span>{c.description}</span>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${selectedClassId === c.id ? "bg-white dark:bg-zinc-950/20" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"}`}>{c.class_code}</span>
                                                    </button>
                                                ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Section Select */}
                    <div className="w-full xl:w-40">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.1em] block mb-1.5 ml-1">Section</label>
                        <div className="relative" ref={sectionDropdownRef}>
                            <button type="button" disabled
                                className="w-full h-11 flex items-center justify-between px-5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm transition-all cursor-not-allowed opacity-70"
                            >
                                <span className={selectedSection ? "text-zinc-800 dark:text-zinc-200 font-semibold" : "text-zinc-400"}>
                                    {selectedSection ? selectedSection.description : "Section..."}
                                </span>
                                <ChevronDown className="h-4 w-4 text-zinc-300" />
                            </button>
                            {showSectionDropdown && (
                                <div className="absolute z-50 top-full mt-2 w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="max-h-64 overflow-y-auto p-1">
                                        {sectionsLoading ? <div className="p-4 text-xs text-zinc-400 text-center">Loading...</div>
                                            : filteredSections.map((s) => (
                                                <button key={s.id} type="button" onClick={() => { setSelectedSectionId(s.id); setShowSectionDropdown(false); }}
                                                    className={`w-full flex items-center px-4 h-10 text-sm rounded-lg ${selectedSectionId === s.id ? "bg-primary text-white font-semibold" : "hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800"}`}
                                                >
                                                    {s.description}
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="w-full xl:w-80 relative" ref={searchDropdownRef}>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.1em] block mb-1.5 ml-1">Search Computer Code</label>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="e.g. 1234"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-11 pl-11 pr-24 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 font-bold transition-all shadow-sm"
                            />
                            {searchQuery && (
                                <button
                                    onClick={handleClearSearch}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-600 transition-colors"
                                    title="Clear search"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                            {isSearching && (
                                <div className="absolute right-12 top-1/2 -translate-y-1/2">
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                </div>
                            )}
                        </div>

                        {showSearchDropdown && searchResults.length > 0 && (
                            <div className="absolute z-50 top-full mt-2 w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                <div className="max-h-80 overflow-y-auto p-2">
                                    {searchResults.map((s) => (
                                        <button
                                            key={s.cc}
                                            type="button"
                                            onClick={() => handleSelectStudent(s)}
                                            className="w-full flex items-center justify-between px-4 h-14 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900 transition-all border border-transparent hover:border-zinc-100 group"
                                        >
                                            <div className="flex flex-col items-start text-left">
                                                <span className="text-[13px] font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-primary transition-colors">{s.full_name}</span>
                                                <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">GR: {s.gr_number || "N/A"}</span>
                                            </div>
                                            <span className="text-[11px] font-black bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-3 py-1 rounded-full group-hover:bg-primary group-hover:text-white transition-all">{s.cc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3">
                        {selectedClassId !== "" && (
                            <button onClick={() => fetchFeeSchedule(Number(selectedClassId), selectedCampusId, studentId, selectedYear)} disabled={isLoading} title="Refresh/Reload"
                                className="inline-flex items-center gap-2 h-11 px-4 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm font-medium text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900 transition-all shadow-sm disabled:opacity-50"
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Refresh
                            </button>
                        )}
                        {rows.length > 0 && (
                            <button onClick={handleSave} disabled={isSaving || !studentId.trim()}
                                className="inline-flex items-center gap-2 h-11 px-8 bg-primary text-white text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 active:scale-95"
                            >
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Schedule"}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Banner Notifications */}
            {saveStatus && (
                <div className={`p-4 rounded-2xl border flex items-center gap-4 animate-in slide-in-from-top-4 duration-300 ${saveStatus.type === "success" ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-rose-50 border-rose-100 text-rose-800"}`}>
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs ${saveStatus.type === "success" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}>
                        {saveStatus.type === "success" ? "✓" : "!"}
                    </div>
                    <span className="text-sm font-semibold">{saveStatus.message}</span>
                    <button onClick={() => setSaveStatus(null)} className="ml-auto p-1.5 hover:bg-black/5 rounded-lg transition-colors"><X className="h-4 w-4 opacity-40" /></button>
                </div>
            )}

            {/* Error States */}
            {loadError && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">
                    <AlertCircle className="h-5 w-5 text-red-400 shrink-0" /><span>{loadError}</span>
                    <button onClick={() => setLoadError(null)} className="ml-auto p-1 hover:bg-black/5 rounded-lg"><X className="h-4 w-4 opacity-40" /></button>
                </div>
            )}

            {/* Main Table */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-40 gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Crunching Data...</p>
                </div>
            ) : rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-40 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[28px] gap-6 opacity-60">
                    <div className="p-7 bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-800 shadow-sm"><GraduationCap className="h-10 w-10 text-zinc-400" /></div>
                    <div className="text-center space-y-1">
                        <p className="font-bold text-zinc-900 dark:text-zinc-100">Workspace Empty</p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">Pick a template or add a row to begin.</p>
                    </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[24px] shadow-sm overflow-hidden flex flex-col">
                    <div className="overflow-auto max-h-[60vh] custom-scrollbar" onKeyDown={handleTableKeyDown}>
                        <table className="w-full border-collapse table-fixed select-none">
                            <thead className="sticky top-0 z-40 bg-zinc-50 dark:bg-zinc-900/95 backdrop-blur-md">
                                <tr>
                                    <th className="w-12 border-b border-r border-zinc-200 dark:border-zinc-800 px-3 py-3.5 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Act</th>
                                    <th className="w-10 border-b border-r border-zinc-200 dark:border-zinc-800 px-1 py-3.5 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">#</th>
                                    <th className="w-[30%] border-b border-r border-zinc-200 dark:border-zinc-800 px-5 py-3.5 text-left text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Fee Description</th>
                                    <th className="w-36 border-b border-r border-zinc-200 dark:border-zinc-800 px-5 py-3.5 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Frequency</th>
                                    <th className="w-32 border-b border-r border-zinc-200 dark:border-zinc-800 px-5 py-3.5 text-left text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Month</th>
                                    <th className="w-40 border-b border-r border-zinc-200 dark:border-zinc-800 px-5 py-3.5 text-left text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Month / Period</th>
                                    <th className="border-b border-zinc-200 dark:border-zinc-800 px-5 py-3.5 text-right text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Amount (Rs.)</th>
                                </tr>
                            </thead>
                            <tbody ref={tbodyRef}>
                                {rows.map((row, rIdx) => {
                                    const aCell = (c: number) => isCellActive(rIdx, c);
                                    const isCurrentRowActive = activeCell?.row === rIdx;
                                    const groupSeparator = row.isGroupStart && rIdx > 0 ? "border-t-2 border-zinc-100" : "";

                                    return (
                                        <tr key={rIdx} className={`${groupSeparator} ${isCurrentRowActive ? "bg-primary/[0.02]" : "bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900/40"} transition-colors relative`}>
                                            <td data-row={rIdx} data-col={COL_ACTIONS} tabIndex={0} onFocus={() => setActiveCell({ row: rIdx, col: COL_ACTIONS })}
                                                className={`border-r border-b border-zinc-100 text-center ${aCell(COL_ACTIONS) ? "ring-2 ring-inset ring-primary/30 z-10 bg-white dark:bg-zinc-950" : ""}`}
                                            >
                                                <button onClick={() => deleteRow(rIdx)} className="p-2 rounded-lg hover:bg-rose-50 text-zinc-300 hover:text-rose-600 transition-all active:scale-90">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </td>

                                            <td className="border-r border-b border-zinc-100 text-center font-mono text-[10px] text-zinc-400">{rIdx + 1}</td>

                                            {/* Fee Type Select */}
                                            <td data-row={rIdx} data-col={COL_FEE_TYPE} className={`p-0 border-r border-b border-zinc-100 relative ${aCell(COL_FEE_TYPE) ? "ring-2 ring-inset ring-primary/30 z-10 bg-white dark:bg-zinc-950 shadow-inner" : ""}`}>
                                                <select
                                                    data-row={rIdx} data-col={COL_FEE_TYPE}
                                                    value={row.feeId}
                                                    onChange={(e) => updateRow(rIdx, "feeId", Number(e.target.value))}
                                                    onFocus={() => setActiveCell({ row: rIdx, col: COL_FEE_TYPE })}
                                                    className="w-full h-10 px-5 appearance-none outline-none bg-transparent font-semibold text-zinc-800 dark:text-zinc-200 text-[13px] cursor-pointer"
                                                >
                                                    {feeTypes.map(ft => <option key={ft.id} value={ft.id}>{ft.description}</option>)}
                                                </select>
                                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-300 pointer-events-none" />
                                            </td>

                                            {/* Frequency (Read-only) */}
                                            <td data-row={rIdx} data-col={COL_FREQ} tabIndex={0} onFocus={() => setActiveCell({ row: rIdx, col: COL_FREQ })}
                                                className={`p-0 border-r border-b border-zinc-100 relative ${aCell(COL_FREQ) ? "ring-2 ring-inset ring-primary/30 z-10 bg-white dark:bg-zinc-950 shadow-inner" : ""}`}
                                            >
                                                <div className="relative h-10 w-full px-5 flex items-center justify-center">
                                                    <span className={`z-10 font-bold text-[10px] uppercase tracking-wider ${row.freq === "MONTHLY" ? "text-blue-600" : "text-amber-600"}`}>
                                                        {row.freq || "MONTHLY"}
                                                    </span>
                                                    <div className={`absolute inset-x-4 inset-y-2 rounded-md ${row.freq === "MONTHLY" ? "bg-blue-50" : "bg-amber-50"}`} />
                                                </div>
                                            </td>

                                            {/* Month (Read-only) */}
                                            <td data-row={rIdx} data-col={COL_MONTH_READONLY} tabIndex={0} onFocus={() => setActiveCell({ row: rIdx, col: COL_MONTH_READONLY })}
                                                className={`p-0 border-r border-b border-zinc-100 relative ${aCell(COL_MONTH_READONLY) ? "ring-2 ring-inset ring-primary/30 z-10 bg-white dark:bg-zinc-950 shadow-inner" : ""}`}
                                            >
                                                <div className="h-10 px-5 flex items-center">
                                                    <span className="text-[13px] font-semibold text-zinc-500">
                                                        {row.initialMonth}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Period Select */}
                                            <td data-row={rIdx} data-col={COL_PERIOD} className={`p-0 border-r border-b border-zinc-100 relative ${aCell(COL_PERIOD) ? "ring-2 ring-inset ring-primary/30 z-10 bg-white dark:bg-zinc-950 shadow-inner" : ""}`}>
                                                <select
                                                    data-row={rIdx} data-col={COL_PERIOD}
                                                    value={row.month}
                                                    onChange={(e) => updateRow(rIdx, "month", e.target.value)}
                                                    onFocus={() => setActiveCell({ row: rIdx, col: COL_PERIOD })}
                                                    className="w-full h-10 px-5 appearance-none outline-none bg-transparent font-medium text-zinc-600 dark:text-zinc-400 text-[13px] cursor-pointer"
                                                >
                                                    {MONTH_ORDER.map(m => <option key={m} value={m}>{m}</option>)}
                                                    <option value="—">—</option>
                                                </select>
                                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-300 pointer-events-none" />
                                            </td>

                                            {/* Amount Input */}
                                            <td data-row={rIdx} data-col={COL_AMOUNT} className={`p-0 border-b border-zinc-100 ${aCell(COL_AMOUNT) ? "ring-2 ring-inset ring-primary/30 z-10 bg-white dark:bg-zinc-950 shadow-inner" : ""}`}>
                                                <div className="relative h-10 flex items-center">
                                                    <span className="pl-5 text-[10px] font-bold text-zinc-300">Rs.</span>
                                                    <input
                                                        data-row={rIdx} data-col={COL_AMOUNT}
                                                        type="number"
                                                        value={row.amount}
                                                        onChange={(e) => updateRow(rIdx, "amount", e.target.value)}
                                                        onFocus={() => setActiveCell({ row: rIdx, col: COL_AMOUNT })}
                                                        className="w-full h-full px-5 text-right font-mono font-medium text-[13px] outline-none bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-200"
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Stats Summary */}
                    <div className="bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 px-6 py-5 flex items-center justify-between">
                        <div className="flex gap-8">
                            <div>
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Records</p>
                                <p className="text-lg font-bold text-zinc-700 dark:text-zinc-300">{rows.length} <span className="text-xs font-medium text-zinc-400 ml-1">items</span></p>
                            </div>
                            <div className="w-px h-8 bg-zinc-200 mt-2" />
                            <div>
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Student</p>
                                <p className="text-lg font-bold text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]">{studentId || "—"}</p>
                            </div>
                        </div>

                        <div className="text-right">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Total Annual Charges</p>
                            <div className="flex items-baseline gap-2 justify-end">
                                <span className="text-zinc-300 font-mono text-sm">PKR</span>
                                <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight tabular-nums">
                                    {grandTotal.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 px-5 py-2.5 bg-zinc-900 text-white rounded-full shadow-2xl z-50">
                <div className="flex items-center gap-2 pr-4 border-r border-white/20">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[9px] font-bold uppercase tracking-widest">Editor Active</span>
                </div>
                <div className="flex items-center gap-4 text-[9px] font-medium text-white/50 uppercase tracking-widest">
                    <span>Arrows/Tab: Move</span>
                    <span>•</span>
                    <span>Enter: Commit Change</span>
                </div>
            </div>
        </div>
    );
}

export default function StudentwiseFeePage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center py-40 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Initializing...</p>
            </div>
        }>
            <StudentwiseFeeEditor />
        </Suspense>
    );
}
