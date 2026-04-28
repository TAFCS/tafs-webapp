"use client";

import { useState, useEffect, useRef, useCallback, KeyboardEvent, useMemo, Suspense } from "react";
import { Search, Loader2, AlertCircle, GraduationCap, ChevronDown, X, RefreshCw, Trash2, Plus, Users2, Settings2, UserSearch, Calendar, LayoutGrid, Info, CreditCard, ArrowRight, Layers } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { fetchClasses } from "@/store/slices/classesSlice";
import { fetchFeeTypes } from "@/store/slices/feeTypesSlice";
import { fetchCampuses } from "@/store/slices/campusesSlice";
import { fetchSections } from "@/store/slices/sectionsSlice";
import toast from "react-hot-toast";
import InstallmentModal from "@/components/modals/InstallmentModal";
import { getCurrentAcademicYear, getAcademicYears, MONTHS, MONTH_TO_NUM } from "@/lib/fee-utils";
import { BulkOperationsDrawer } from "./components/BulkOperationsDrawer";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FeeTypeInfo {
    id: number;
    description: string;
    freq: "MONTHLY" | "ONE_TIME" | null;
    breakup: any;
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
    dbId?: number; // Database ID (student_fees.id)
    feeId: number;
    feeDescription: string;
    freq: "MONTHLY" | "ONE_TIME" | null;
    initialMonth: string; // The original month reference
    month: string;        // The editable period
    target_month: number; // The backing target month (numerical)
    amount: string;
    originalAmount: string; // The original template amount from class-wise schedule
    fee_date?: string;    // Optional exact date (YYYY-MM-DD) for multi-voucher-per-month
    isGroupStart?: boolean;
    groupSize?: number;
    isNew?: boolean;      // True for manually-added rows (not loaded from class schedule/DB)
    bundle_id?: number | null;
    bundle_name?: string | null;
    installment_id?: number | null;
    installment_amount?: string | null;
    installment_fee_type_desc?: string | null;
    installment_fee_type_id?: number | null;
    status?: "NOT_ISSUED" | "ISSUED" | "PARTIALLY_PAID" | "PAID";
    description_prefix?: string | null;
}

const MONTH_ORDER = MONTHS;
const ACADEMIC_YEARS = getAcademicYears(1, 4);

const getPreviousYear = (year: string) => {
    const parts = year.split("-");
    if (parts.length !== 2) return "";
    return `${parseInt(parts[0]) - 1}-${parseInt(parts[1]) - 1}`;
};

function calendarYear(academicYearStart: number, monthNum: number): number {
    return monthNum >= 8 ? academicYearStart : academicYearStart + 1;
}

const COLS = ["Select", "Actions", "#", "Fee Type", "Frequency", "Month", "Fee Date", "Adjustments", "Status", "Amount"] as const;
const COL_SELECT = 0;
const COL_ACTIONS = 1;
const COL_NUM = 2;
const COL_FEE_TYPE = 3;
const COL_FREQ = 4;
const COL_MONTH = 5;
const COL_FEE_DATE = 6;
const COL_ADJUSTMENTS = 7;
const COL_STATUS = 8;
const COL_AMOUNT = 9;

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
    // Sequence value logic: Aug=0, Sep=1 ... Dec=4, Jan=5 ... July=11
    const getSeq = (m: number) => (m >= 8 ? m - 8 : m + 4);

    return [...rows].sort((a, b) => {
        // 1. Sort by fee_date (Primary)
        if (a.fee_date && b.fee_date) {
            if (a.fee_date !== b.fee_date) return a.fee_date.localeCompare(b.fee_date);
        } else if (a.fee_date) {
            return -1;
        } else if (b.fee_date) {
            return 1;
        }

        // 2. Fallback: target_month sequence
        const sa = getSeq(a.target_month);
        const sb = getSeq(b.target_month);
        if (sa !== sb) return sa - sb;

        // 3. Fallback: description
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
    const [selectedYear, setSelectedYear] = useState(getCurrentAcademicYear());

    // ─── Helpers ────────────────────────────────────────────────────────────
    const calculateInitialFeeDate = useCallback((month: string, acadYear: string, feeTypeId: number, providedFt?: any) => {
        const ft = providedFt || feeTypes.find(f => f.id === feeTypeId);
        if (!ft) return undefined;

        let b = ft.breakup;
        if (typeof b === "string") {
            try { b = JSON.parse(b); } catch { return undefined; }
        }

        if (!b || typeof b !== "object") return undefined;

        let day = 0;
        if (b.collection_day_by_month) {
            day = b.collection_day_by_month[month] || 0;
        }

        if (day <= 0) return undefined;

        const startYearNum = parseInt(acadYear.split("-")[0]);
        if (isNaN(startYearNum)) return undefined;

        const monthNum = MONTH_TO_NUM[month] || 8;
        const year = monthNum >= 8 ? startYearNum : startYearNum + 1;

        const formatted = `${year}-${monthNum.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
        return formatted;
    }, [feeTypes]);

    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [showBulkDrawer, setShowBulkDrawer] = useState(false);
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

    // Projection / Stats State
    const [projections, setProjections] = useState<{
        prevTuitionTotal: number;
        prevAnnualTotal: number;
        newTuitionMonthly: number;
        newAnnualMonthly: number;
        isLoading: boolean;
    } | null>(null);

    const fetchProjections = useCallback(async (sid: number, year: string) => {
        setProjections(prev => ({ ...(prev || { prevTuitionTotal: 0, prevAnnualTotal: 0, newTuitionMonthly: 0, newAnnualMonthly: 0 }), isLoading: true }));
        try {
            const parts = year.split('-');
            if (parts.length !== 2) return;
            const prevYear = `${parseInt(parts[0]) - 1}-${parseInt(parts[1]) - 1}`;

            const { data } = await api.get(`/v1/student-fees/student/${sid}/schedule`, { params: { academic_year: prevYear } });
            const prevFees = data?.data?.fees || [];

            // Tuition = Fee Type 1
            const tuitionRows = prevFees.filter((f: any) => f.fee_type_id === 1);
            
            // Annual = Fee Type 4 (either primary or through installment tracking)
            const annualRows = prevFees.filter((f: any) => 
                f.fee_type_id === 4 || 
                (f.installment_amount && f.installment_id && f.student_fee_installments?.fee_type_id === 4)
            );

            const tuitionTotal = tuitionRows.reduce((a: number, b: any) => a + parseFloat(b.amount || "0"), 0);
            
            // For annual total, we sum up the installment portions OR the full amount if it was standalone
            const annualTotal = annualRows.reduce((a: number, b: any) => {
                const installmentPart = parseFloat(b.installment_amount || "0");
                const fullAmount = parseFloat(b.amount || "0");
                // If it's a tuition row with annual installment, take just the installment. 
                // If it's a standalone annual row, take the full amount.
                return a + (installmentPart > 0 ? installmentPart : fullAmount);
            }, 0);

            const newTuitionMonthly = (tuitionRows.length > 0 ? tuitionTotal / tuitionRows.length : 0) * 1.10;
            const newAnnualMonthly = (annualTotal * 1.12) / 12;

            setProjections({
                prevTuitionTotal: tuitionTotal,
                prevAnnualTotal: annualTotal,
                newTuitionMonthly: Math.round(newTuitionMonthly),
                newAnnualMonthly: Math.round(newAnnualMonthly),
                isLoading: false
            });
        } catch (err) {
            console.error("Failed to fetch projections", err);
            setProjections(null);
        }
    }, []);

    useEffect(() => {
        if (studentId && selectedYear) {
            fetchProjections(Number(studentId), selectedYear);
        }
    }, [studentId, selectedYear, fetchProjections]);

    const [rows, setRows] = useState<SpreadsheetRow[]>([]);
    const [feeToAmountMap, setFeeToAmountMap] = useState<Record<number, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [isTemplate, setIsTemplate] = useState(false);
    const [isTemplatePending, setIsTemplatePending] = useState(false);
    const [pendingTemplateRows, setPendingTemplateRows] = useState<SpreadsheetRow[]>([]);
    const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);

    const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
    const tbodyRef = useRef<HTMLTableSectionElement>(null);
    const pendingFocusId = useRef<string | null>(null);

    // Bundling States
    const [selectedForBundling, setSelectedForBundling] = useState<string[]>([]);
    const [bundleNameInput, setBundleNameInput] = useState("");
    const [isCreatingBundle, setIsCreatingBundle] = useState(false);
    const [bundleNames, setBundleNames] = useState<{ id: number; name: string }[]>([]);
    const [isInstallmentModalOpen, setIsInstallmentModalOpen] = useState(false);
    const [pendingBundles, setPendingBundles] = useState<{
        bundle_name: string;
        target_month: number;
        academic_year: string;
        fee_keys: string[]; // `${feeId}|${target_month}|${dateStr}`
        member_ids: string[]; // __id
    }[]>([]);

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

    const user = useAppSelector((s) => s.auth.user);

    useEffect(() => {
        if (classes.length === 0) dispatch(fetchClasses());
        if (feeTypes.length === 0) dispatch(fetchFeeTypes());
        if (campuses.length === 0) dispatch(fetchCampuses());
        if (sections.length === 0) dispatch(fetchSections());

        // Fetch bundle names for the dropdown
        api.get("/v1/fee-types/bundle-names?activeOnly=true")
            .then(res => setBundleNames(res.data?.data || []))
            .catch(err => console.error("Failed to fetch bundle names:", err));
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

    const fetchFeeSchedule = useCallback(async (classId: number, campusId: number | "", ccNumber: string, academicYear: string, signal?: AbortSignal, forceApplyTemplate?: boolean) => {
        setIsLoading(true); setLoadError(null); setRows([]); setActiveCell(null); setIsTemplate(false);
        setIsTemplatePending(false); if (!forceApplyTemplate) setPendingTemplateRows([]);
        try {
            // 1. ALWAYS Fetch the class-wide fee template for amount lookups
            const params: any = { class_id: classId };
            if (campusId) params.campus_id = campusId;
            const { data: templateData } = await api.get("/v1/class-fee-schedule/by-class", { params, signal });
            const feeRows: ClassFeeRow[] = Array.isArray(templateData?.data) ? templateData.data : [];

            const lookup: Record<number, string> = {};
            feeRows.forEach(f => { lookup[f.fee_id] = f.amount; });
            setFeeToAmountMap(lookup);

            if (!ccNumber) {
                const expanded = feeRows.flatMap((fee) => {
                    const months = sortMonths(fee.fee_types.breakup ?? []);
                    return months.map((month) => ({
                        __id: Math.random().toString(36).substring(7),
                        feeId: fee.fee_id,
                        feeDescription: fee.fee_types.description,
                        freq: fee.fee_types.freq,
                        initialMonth: month,
                        month,
                        target_month: MONTH_TO_NUM[month] || 8,
                        amount: fee.amount,
                        originalAmount: fee.amount,
                        fee_date: calculateInitialFeeDate(month, academicYear, fee.fee_id, fee.fee_types),
                    }));
                });
                setRows(sortSpreadsheetRows(expanded));
                return;
            }

            // NEW: Use the strict schedule endpoint for selected students
            const numericMatch = ccNumber.match(/\d+$/);
            const studentId = numericMatch ? parseInt(numericMatch[0]) : 0;

            const { data: scheduleRes } = await api.get("/v1/student-fees/schedule", {
                params: {
                    studentId,
                    academicYear,
                    classId,
                    campusId: campusId || undefined,
                },
                signal
            });

            const { fees, is_template } = scheduleRes.data;
            let finalRows: SpreadsheetRow[] = [];

            if (is_template) {
                // Determine previous year suggestions (10% Tuition, 12% Annual Fee)
                let suggestedTuition: number | null = null;
                let suggestedAnnual: number | null = null;

                try {
                    const prevYearStr = getPreviousYear(academicYear);
                    if (prevYearStr && studentId) {
                        const { data: prevData } = await api.get(`/v1/student-fees/student/${studentId}/schedule`, { params: { academic_year: prevYearStr } });
                        const prevFees = prevData?.data?.fees || [];
                        if (prevFees.length > 0) {
                            const tuitionRows = prevFees.filter((f: any) => f.fee_type_id === 1);
                            const annualRows = prevFees.filter((f: any) => f.fee_type_id === 4 || (f.installment_amount && f.installment_id && f.student_fee_installments?.fee_type_id === 4));

                            if (tuitionRows.length > 0) {
                                const tTotal = tuitionRows.reduce((a: number, b: any) => a + parseFloat(b.amount || "0"), 0);
                                suggestedTuition = Math.round((tTotal / 12) * 1.10);
                            }
                            if (annualRows.length > 0) {
                                const aTotal = annualRows.reduce((a: number, b: any) => {
                                    const inst = parseFloat(b.installment_amount || "0");
                                    return a + (inst > 0 ? inst : parseFloat(b.amount || "0"));
                                }, 0);
                                suggestedAnnual = Math.round(aTotal * 1.10); // 10% increase
                            }
                        }
                    }
                } catch (e) { console.error("Suggestion fetch failed", e); }

                // Map from class_fee_schedule template with optional adjusted amounts
                finalRows = (fees as any[]).flatMap((fee) => {
                    const months = sortMonths(fee.fee_types.breakup ?? []);
                    return months.map((month) => {
                        let finalAmount = fee.amount;
                        if (fee.fee_id === 1 && suggestedTuition !== null) {
                            finalAmount = suggestedTuition.toString();
                        } else if (fee.fee_id === 4 && suggestedAnnual !== null) {
                            finalAmount = Math.round(suggestedAnnual / months.length).toString();
                        }

                        return {
                            __id: Math.random().toString(36).substring(7),
                            dbId: undefined,
                            feeId: fee.fee_id,
                            feeDescription: fee.fee_types.description,
                            freq: fee.fee_types.freq,
                            initialMonth: month,
                            month,
                            target_month: MONTH_TO_NUM[month] || 8,
                            amount: finalAmount,
                            originalAmount: fee.amount,
                            fee_date: calculateInitialFeeDate(month, academicYear, fee.fee_id, fee.fee_types),
                        };
                    });
                });
            } else {
                // Map from student_fees (Strict Rule: do not pull template)
                finalRows = (fees as any[]).map((sf) => ({
                    __id: Math.random().toString(36).substring(7),
                    dbId: sf.id,
                    feeId: sf.fee_type_id,
                    feeDescription: sf.fee_types?.description || "Unknown Fee",
                    freq: sf.fee_types?.freq || "MONTHLY",
                    initialMonth: Object.keys(MONTH_TO_NUM).find(k => MONTH_TO_NUM[k] === sf.target_month) || "August",
                    month: Object.keys(MONTH_TO_NUM).find(k => MONTH_TO_NUM[k] === sf.month) || "August",
                    target_month: sf.target_month,
                    amount: sf.amount?.toString() || sf.amount_before_discount?.toString() || "0",
                    originalAmount: sf.amount_before_discount?.toString() || sf.amount?.toString() || "0",
                    fee_date: sf.fee_date ? new Date(sf.fee_date).toISOString().split('T')[0] : undefined,
                    bundle_id: sf.bundle_id,
                    bundle_name: sf.student_fee_bundles?.bundle_name,
                    installment_id: sf.installment_id,
                    installment_amount: sf.installment_amount?.toString(),
                    installment_fee_type_desc: sf.student_fee_installments?.fee_types?.description,
                    installment_fee_type_id: sf.student_fee_installments?.fee_types?.id,
                    // If backend status is NOT_ISSUED but it has voucher_heads, it's effectively ISSUED or in a draft state
                    status: (sf.voucher_heads && sf.voucher_heads.length > 0) ? (sf.status === 'NOT_ISSUED' ? 'ISSUED' : sf.status) : sf.status,
                    description_prefix: sf.description_prefix,
                }));
            }
            if (is_template && !forceApplyTemplate) {
                // Store but do not apply yet (wait for user confirmation)
                setPendingTemplateRows(sortSpreadsheetRows(finalRows));
                setIsTemplatePending(true);
            } else {
                setRows(sortSpreadsheetRows(finalRows));
                setIsTemplatePending(false);
            }
            setIsTemplate(is_template);
        } catch (err: any) {
            if (err.name === "AbortError") return;
            setLoadError(err.response?.data?.message || "Failed to load fee schedule.");
        } finally {
            if (!signal?.aborted) setIsLoading(false);
        }
    }, [sortSpreadsheetRows, calculateInitialFeeDate]);

    useEffect(() => {
        const controller = new AbortController();
        if (selectedClassId !== "") {
            fetchFeeSchedule(Number(selectedClassId), selectedCampusId, studentId, selectedYear, controller.signal);
            setPendingBundles([]);
            setSelectedForBundling([]);
        } else {
            setRows([]);
        }
        return () => controller.abort();
    }, [selectedClassId, selectedCampusId, studentId, selectedYear, fetchFeeSchedule]);

    const handleSelectStudent = async (student: { cc: number; full_name: string; gr_number: string }) => {
        setIsSearching(true);
        try {
            const { data } = await api.get(`/v1/students/${student.cc}`);
            const fullStudent = data?.data;

            if (fullStudent) {
                console.log(`[handleSelectStudent] Loaded profile:`, fullStudent);
                setSelectedCampusId(fullStudent.campus_id || "");
                setSelectedClassId(fullStudent.class_id || "");
                setSelectedSectionId(fullStudent.section_id || "");
                const ccStr = `${fullStudent.cc_number || fullStudent.cc}`;
                setStudentId(ccStr);

                setSkipSearch(true);
                setSearchQuery(`${fullStudent.student_full_name || fullStudent.full_name} (${ccStr})`);

                setShowSearchDropdown(false);
                toast.success(`Loaded profile for ${fullStudent.student_full_name || fullStudent.full_name}`);
            } else {
                toast.error("Student not found.");
                handleClearSearch();
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
        setIsTemplatePending(false);
        setPendingTemplateRows([]);
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
    const handleSave = async () => {
        if (!studentId.trim()) {
            setSaveStatus({ type: "error", message: "Please enter a Computer Code before saving." });
            return;
        }

        // Validate: every row must have a non-negative amount
        const invalidRows = rows.filter(r => !(parseFloat(r.amount || "0") >= 0));
        if (invalidRows.length > 0) {
            const names = invalidRows.map(r => `${r.feeDescription} (${r.month})`).join(", ");
            setSaveStatus({ type: "error", message: `Amount must be 0 or greater for: ${names}` });
            toast.error("Fix invalid amount rows before saving.");
            return;
        }

        setSaveStatus(null);
        setIsSaving(true);
        try {
            const items = rows.map((row) => {
                const monthNum = MONTH_TO_NUM[row.month] || 8;
                return {
                    fee_type_id: row.feeId,
                    month: monthNum,
                    target_month: row.target_month,
                    amount: parseFloat(row.amount || "0"),
                    amount_before_discount: parseFloat(row.originalAmount || row.amount || "0"),
                    academic_year: selectedYear,
                    ...(row.fee_date ? { fee_date: row.fee_date } : {}),
                };
            });

            const numericMatch = studentId.match(/\d+$/);
            const ccValue = numericMatch ? parseInt(numericMatch[0]) : 0;

            // Prepare parallel API calls
            const requests: Promise<any>[] = [
                api.post("/v1/student-fees/bulk", {
                    student_id: ccValue,
                    academic_year: selectedYear,
                    items,
                    bundles: pendingBundles.map(pb => ({
                        bundle_name: pb.bundle_name,
                        target_month: pb.target_month,
                        academic_year: pb.academic_year,
                        fee_keys: pb.fee_keys
                    }))
                })
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
            const msg = `${items.length} records saved for student ${displayId}.`;
            setSaveStatus({ type: "success", message: msg });
            toast.success("Fee schedule saved successfully!");
            setPendingBundles([]);

            // Re-fetch from DB so isNew flags are cleared and rows reflect true
            // persisted state. Without this, a second edit+save on a newly-added
            // row would shift its target_month and create a duplicate.
            if (selectedClassId !== "") {
                await fetchFeeSchedule(Number(selectedClassId), selectedCampusId, studentId, selectedYear);
            }
        } catch (err: any) {
            const msg = err.response?.data?.message || "Failed to save data. Please verify all fields.";
            setSaveStatus({ type: "error", message: msg });
            toast.error(msg);
        } finally { setIsSaving(false); }
    };

    // ── Row Mutators ────────────────────────────────────────────────────
    const isRowLocked = (row?: SpreadsheetRow) =>
        row?.status === "PAID" ||
        row?.status === "PARTIALLY_PAID" ||
        row?.status === "ISSUED";

    const deleteRow = (idx: number) => {
        if (isRowLocked(rows[idx])) {
            toast.error("Cannot delete a row that is paid, partially paid, or has an issued voucher.");
            return;
        }
        setRows((prev) => prev.filter((_, i) => i !== idx));
    };

    const addRow = () => {
        if (feeTypes.length === 0) {
            toast.error("No fee types available. Please set up fee types first.");
            return;
        }

        const firstType = feeTypes[0];
        const feeId = firstType.id;

        // Pick the first month slot (in academic order) not already used as
        // target_month for this fee type — so the new row gets a unique identity.
        const MONTH_NUM_ORDER = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7];
        const usedTargetMonths = new Set(
            rows.filter(r => r.feeId === feeId).map(r => r.target_month)
        );
        const unusedMonthNum = MONTH_NUM_ORDER.find(m => !usedTargetMonths.has(m));

        if (unusedMonthNum === undefined) {
            toast.error(`All 12 month slots for "${firstType.description}" are already used. Delete an existing row first.`);
            return;
        }

        const unusedMonthName = Object.keys(MONTH_TO_NUM).find(k => MONTH_TO_NUM[k] === unusedMonthNum) ?? "August";
        // Default amount to the class schedule amount for this fee type (if known)
        const presetAmount = feeToAmountMap[feeId] || "0";

        const newRow: SpreadsheetRow = {
            __id: Math.random().toString(36).substring(7),
            feeId,
            feeDescription: firstType.description,
            freq: firstType.freq,
            initialMonth: unusedMonthName,
            month: unusedMonthName,
            target_month: unusedMonthNum,
            amount: presetAmount,
            originalAmount: presetAmount,
            // Smart Defaulting: calculate initial fee date but it remains independent
            fee_date: calculateInitialFeeDate(unusedMonthName, selectedYear, feeId),
            isNew: true,
        };
        pendingFocusId.current = newRow.__id;
        setRecentlyAddedId(newRow.__id);
        setRows((prev) => sortSpreadsheetRows([...prev, newRow]));
    };

    const updateRow = (idx: number, field: keyof SpreadsheetRow, val: any) => {
        if (isRowLocked(rows[idx])) {
            // Some updates might be internal or allowed (like UI state), 
            // but here we block all field updates for settled rows.
            toast.error("Cannot modify a paid or partially paid fee head.");
            return;
        }
        pendingFocusId.current = rows[idx].__id;
        setRows((prev) => {
            const next = prev.map((r, i) => {
                if (i !== idx) return r;
                const updated = { ...r, [field]: val };

                if (field === "amount") {
                    // Prevent non-numeric junk
                    const cleaned = val.replace(/[^0-9.]/g, "");
                    if (val !== "" && cleaned === "") return r; // ignore if user typed only letters

                    updated.amount = cleaned;
                }

                if (field === "feeId") {
                    const ft = feeTypes.find(f => f.id === val);
                    if (ft) {
                        updated.feeDescription = ft.description;
                        updated.freq = ft.freq;
                        const preset = feeToAmountMap[val] || "0";
                        updated.amount = preset;
                        updated.originalAmount = preset;
                        // Default fee date only if none set
                        if (!updated.fee_date) {
                            updated.fee_date = calculateInitialFeeDate(updated.month, selectedYear, val);
                        }
                    }
                    // For manually-added rows, pick a fresh unused target_month
                    if (r.isNew) {
                        const usedForNewType = new Set(
                            prev.filter((x, xi) => xi !== idx && x.feeId === val).map(x => x.target_month)
                        );
                        const MONTH_NUM_ORDER = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7];
                        const unusedNum = MONTH_NUM_ORDER.find(m => !usedForNewType.has(m)) ?? 8;
                        const unusedName = Object.keys(MONTH_TO_NUM).find(k => MONTH_TO_NUM[k] === unusedNum) ?? "August";
                        updated.target_month = unusedNum;
                        updated.month = unusedName;
                        updated.initialMonth = unusedName;
                    }
                }

                if (field === "initialMonth") {
                    updated.initialMonth = val;
                    // For identity purposes, initialMonth defines the target_month
                    updated.target_month = MONTH_TO_NUM[val] ?? updated.target_month;
                    // Seamless Independence: Changing the period label (initialMonth) 
                    // DOES NOT force the fee_date to change.
                }

                if (field === "month") {
                    // Changing the billing month DOES NOT move the fee_date.
                    // This allows "May tuition" in "February".
                    if (r.isNew) {
                        updated.target_month = MONTH_TO_NUM[val] ?? updated.target_month;
                        updated.initialMonth = val;
                    }
                }

                return updated;
            });
            return sortSpreadsheetRows(next);
        });
    };

    // ── Bundling Actions ────────────────────────────────────────────────
    const handleToggleSelectForBundling = (rowId: string) => {
        setSelectedForBundling(prev =>
            prev.includes(rowId) ? prev.filter(id => id !== rowId) : [...prev, rowId]
        );
    };

    const handleCreateBundle = async () => {
        if (selectedForBundling.length < 2) {
            toast.error("Select at least 2 fees to bundle.");
            return;
        }
        if (distinctDates.length > 1) {
            toast.error("All selected fees must have the same Fee Date to be bundled.");
            return;
        }

        const selectedRows = rows.filter(r => selectedForBundling.includes(r.__id));
        const firstRow = selectedRows[0];
        const targetMonth = firstRow.target_month;
        const allHaveDbId = selectedRows.every(r => !!r.dbId);

        if (allHaveDbId) {
            // All fees already exist in the DB — create bundle immediately.
            setIsCreatingBundle(true);
            try {
                const numericMatch = studentId.match(/\d+$/);
                const ccValue = numericMatch ? parseInt(numericMatch[0]) : 0;

                // Build per-fee date overrides so the backend can atomically
                // update fee_date + create bundle in a single transaction.
                const feeDateOverrides = selectedRows
                    .filter(r => !!r.fee_date && !!r.dbId)
                    .map(r => ({ id: r.dbId!, fee_date: r.fee_date! }));

                await api.post("/v1/student-fees/bundles", {
                    student_id: ccValue,
                    bundle_name: bundleNameInput.trim(),
                    target_month: targetMonth,
                    academic_year: selectedYear,
                    fee_ids: selectedRows.map(r => r.dbId),
                    fee_date_overrides: feeDateOverrides,
                });

                toast.success(`Bundle "${bundleNameInput}" created!`);
                setBundleNameInput("");
                setSelectedForBundling([]);
                if (selectedClassId !== "") {
                    fetchFeeSchedule(Number(selectedClassId), selectedCampusId, studentId, selectedYear);
                }
            } catch (err: any) {
                toast.error(err.response?.data?.message || "Failed to create bundle.");
            } finally {
                setIsCreatingBundle(false);
            }
        } else {
            // Queue as pending bundle
            const newPending = {
                bundle_name: bundleNameInput.trim(),
                target_month: targetMonth,
                academic_year: selectedYear,
                fee_keys: selectedRows.map(r => `${r.feeId}|${r.target_month}|${r.fee_date || "no-date"}`),
                member_ids: selectedRows.map(r => r.__id)
            };

            setPendingBundles(prev => [...prev, newPending]);
            setBundleNameInput("");
            setSelectedForBundling([]);
            toast.success(`Bundle "${bundleNameInput}" queued. Click "Save Schedule" to persist.`);
        }
    };

    const handleDissolveBundle = async (bundleId: number) => {
        if (!confirm("Are you sure you want to dissolve this bundle? The fees will become individual items again.")) return;

        try {
            await api.delete(`/v1/student-fees/bundles/${bundleId}`);
            toast.success("Bundle dissolved successfully.");
            // Refresh
            if (selectedClassId !== "") {
                fetchFeeSchedule(Number(selectedClassId), selectedCampusId, studentId, selectedYear);
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to dissolve bundle.");
        }
    };

    const grandTotal = rows.reduce((s, r) => s + parseFloat(r.amount || "0"), 0);

    // Auto-detect bundle constraints
    const selectedRowsForBundling = rows.filter(r => selectedForBundling.includes(r.__id));
    const distinctDates = Array.from(new Set(selectedRowsForBundling.map(r => r.fee_date || "none")));

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

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowBulkDrawer(true)}
                        className="group flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm font-bold rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all active:scale-95 shadow-sm"
                    >
                        <LayoutGrid className="h-4 w-4 text-primary" />
                        Bulk Operations
                    </button>


                </div>
            </div>

            {/* Config Bar */}
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] shadow-sm p-4 md:p-6 lg:p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:flex xl:items-end gap-5 animate-in slide-in-from-right-4 duration-300">
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

                    <div className="w-full lg:col-span-2 xl:flex-1">
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

                    <div className="w-full lg:col-span-3 xl:w-80 relative" ref={searchDropdownRef}>
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
                        {studentId.trim() !== "" && (
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsInstallmentModalOpen(true)}
                                    className="inline-flex items-center gap-2 h-11 px-6 bg-zinc-900 dark:bg-zinc-100 hover:opacity-90 text-white dark:text-zinc-900 text-sm font-bold rounded-xl shadow-lg transition-all active:scale-95"
                                >
                                    <CreditCard className="h-4 w-4" />
                                    Create Installment
                                </button>
                                <button onClick={handleSave} disabled={isSaving || !studentId.trim()}
                                    className="inline-flex items-center gap-2 h-11 px-8 bg-primary text-white text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 active:scale-95"
                                >
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Schedule"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Banner Notifications & Disclaimers */}
            <div className="space-y-4">
                {saveStatus && (
                    <div className={`p-4 rounded-2xl border flex items-center gap-4 animate-in slide-in-from-top-4 duration-300 ${saveStatus.type === "success" ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-rose-50 border-rose-100 text-rose-800"}`}>
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs ${saveStatus.type === "success" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}>
                            {saveStatus.type === "success" ? "✓" : "!"}
                        </div>
                        <span className="text-sm font-semibold">{saveStatus.message}</span>
                        <button onClick={() => setSaveStatus(null)} className="ml-auto p-1.5 hover:bg-black/5 rounded-lg transition-colors"><X className="h-4 w-4 opacity-40" /></button>
                    </div>
                )}

                {studentId && !saveStatus && rows.length > 0 && (
                    <div className="p-4 rounded-[20px] border border-amber-100 bg-amber-50/30 flex items-center gap-4 animate-in slide-in-from-top-2 duration-500 shadow-sm border-dashed">
                        <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                            <Info className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-none mb-1">Editing Mode Active</span>
                            <span className="text-[13px] font-bold text-amber-900/70 tracking-tight">
                                Reminder: Any changes to amounts, additions, or deletions must be <span className="text-primary underline underline-offset-4 decoration-primary/30">persisted by clicking "Save Schedule"</span>.
                            </span>
                            {rows.some(r => isRowLocked(r)) && (
                                <div className="mt-2.5 pt-2.5 border-t border-amber-200/50 flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                    <span className="text-[11px] font-bold text-amber-800/60 uppercase tracking-wider">Some rows are locked due to existing vouchers or bundling</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {isTemplate && rows.length > 0 && (
                    <div className="p-4 rounded-[20px] border border-blue-100 bg-blue-50/30 flex items-center gap-4 animate-in slide-in-from-top-2 duration-500 shadow-sm border-dashed">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                            <Info className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">Template Data</span>
                            <span className="text-[13px] font-bold text-blue-900/70 tracking-tight">
                                This schedule is showing the class template. {studentId ? "No individual customizations have been saved for this student yet." : "Select a student to view or customize their fee schedule."}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Error States */}
            {loadError && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">
                    <AlertCircle className="h-5 w-5 text-red-400 shrink-0" /><span>{loadError}</span>
                    <button onClick={() => setLoadError(null)} className="ml-auto p-1 hover:bg-black/5 rounded-lg"><X className="h-4 w-4 opacity-40" /></button>
                </div>
            )}

            {/* Annual Fee & Tuition Projection Stats */}
            {studentId && !projections?.isLoading && projections && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[32px] shadow-sm overflow-hidden p-8 flex flex-col md:flex-row items-center gap-10">
                        <div className="flex-shrink-0 text-center md:text-left">
                            <div className="h-14 w-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 mx-auto md:mx-0">
                                <Plus className="h-7 w-7 text-primary" />
                            </div>
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 italic">Term Increment Projection</h2>
                            <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mt-1">Based on Previous Academic Year</p>
                        </div>

                        <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-6 w-full">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Base Tuition (Avg)</p>
                                <p className="text-xl font-black text-zinc-900 dark:text-zinc-100">PKR {Math.round(projections.prevTuitionTotal / 12 || 0).toLocaleString()}</p>
                                <p className="text-[10px] font-black text-emerald-500 uppercase">+10% Inc. Requested</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Annual Fee (Total)</p>
                                <p className="text-xl font-black text-zinc-900 dark:text-zinc-100">PKR {projections.prevAnnualTotal.toLocaleString()}</p>
                                <p className="text-[10px] font-black text-emerald-500 uppercase">+12% Inc. Requested</p>
                            </div>
                            <div className="h-full w-px bg-zinc-100 dark:bg-zinc-800 hidden lg:block mx-auto" />
                            <div className="space-y-2 col-span-2 lg:col-span-1 bg-zinc-50 dark:bg-zinc-900 p-4 rounded-3xl border border-zinc-100 dark:border-zinc-800">
                                <p className="text-[10px] font-black text-primary uppercase tracking-widest">Proposed Monthly Total</p>
                                <p className="text-2xl font-black text-primary">PKR {(projections.newTuitionMonthly + projections.newAnnualMonthly).toLocaleString()}</p>
                                <p className="text-[10px] font-bold text-zinc-400 leading-tight">
                                    {projections.newTuitionMonthly.toLocaleString()} (Tuition) + {projections.newAnnualMonthly.toLocaleString()} (Annual split)
                                </p>
                            </div>
                        </div>

                        <div className="flex-shrink-0">
                            <button 
                                onClick={() => setIsInstallmentModalOpen(true)}
                                className="h-16 px-8 bg-primary hover:bg-primary/90 text-white text-sm font-black rounded-2xl shadow-2xl shadow-primary/20 transition-all active:scale-95 flex items-center gap-2 group"
                            >
                                <CreditCard className="h-5 w-5 group-hover:rotate-12 transition-transform" />
                                Breakdown Tool
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Table Actions */}
            {rows.length > 0 && (
                <div className="flex items-center justify-between mt-2 mb-4 px-1">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={addRow}
                            className="inline-flex items-center gap-2 px-6 h-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-600 hover:bg-zinc-50 transition-all active:scale-95 shadow-sm"
                        >
                            <Plus className="h-3.5 w-3.5 text-primary" />
                            Add Row
                        </button>
                    </div>
                </div>
            )}

            {/* Main Table */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-40 gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Crunching Data...</p>
                </div>
            ) : rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[28px] gap-4 animate-in fade-in zoom-in-95 duration-500">
                    <div className="p-6 bg-white dark:bg-zinc-800 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-xl shadow-zinc-200/20">
                        {isTemplatePending ? (
                            <GraduationCap className="h-8 w-8 text-blue-500/50" />
                        ) : studentId ? (
                            <Trash2 className="h-8 w-8 text-rose-500/50" />
                        ) : (
                            <GraduationCap className="h-8 w-8 text-zinc-300" />
                        )}
                    </div>

                    <div className="text-center space-y-2 max-w-md px-6">
                        <p className="font-black text-zinc-900 dark:text-zinc-100 tracking-tight text-lg">
                            {isTemplatePending
                                ? "Template Available"
                                : studentId
                                    ? "Individual Schedule Cleared"
                                    : "Workspace Empty"}
                        </p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
                            {isTemplatePending
                                ? `No customized schedule found for this student. Use the standard ${selectedClass?.description || "class"} template or start with manual entry.`
                                : (studentId
                                    ? `You have removed all individual fee heads. Saving now will effectively reset this student to follow the standard ${selectedClass?.description || "class"} fee template.`
                                    : "Select a campus and class to load a template, or search for a student using their computer code to begin customizing.")
                            }
                        </p>
                    </div>

                    {studentId && (
                        <div className="flex gap-3 mt-4">
                            {isTemplatePending ? (
                                <>
                                    <button
                                        onClick={() => { setRows(pendingTemplateRows); setIsTemplatePending(false); toast.success("Template loaded - Click Save to persist."); }}
                                        className="px-8 py-3 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 active:scale-95 flex items-center gap-2"
                                    >
                                        <GraduationCap className="h-4 w-4" /> Load Class Template
                                    </button>
                                    <button
                                        onClick={() => { setIsTemplatePending(false); addRow(); }}
                                        className="px-8 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-black uppercase tracking-widest text-zinc-600 hover:bg-zinc-50 transition-all active:scale-95 flex items-center gap-2"
                                    >
                                        <Plus className="h-4 w-4 text-primary" /> Add New Row
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => fetchFeeSchedule(Number(selectedClassId), selectedCampusId, studentId, selectedYear, undefined, true)}
                                        className="px-6 py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-lg active:scale-95 flex items-center gap-2"
                                    >
                                        <RefreshCw className="h-3.5 w-3.5" />
                                        Restore Template
                                    </button>
                                    <button
                                        onClick={addRow}
                                        className="px-6 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-600 hover:bg-zinc-50 transition-all active:scale-95 flex items-center gap-2"
                                    >
                                        <Plus className="h-3.5 w-3.5 text-primary" />
                                        Add Row
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[24px] shadow-sm overflow-hidden flex flex-col">
                    <div className="overflow-auto max-h-[60vh] custom-scrollbar" onKeyDown={handleTableKeyDown}>
                        <table className="w-full border-collapse table-fixed select-none">
                            <thead className="sticky top-0 z-40 bg-zinc-50 dark:bg-zinc-900/95 backdrop-blur-md">
                                <tr>
                                    <th className="w-10 border-b border-r border-zinc-200 dark:border-zinc-800 px-1 py-3.5 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                        <div className="flex items-center justify-center">
                                            <input
                                                type="checkbox"
                                                checked={rows.length > 0 && rows.every(r => selectedForBundling.includes(r.__id))}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedForBundling(rows.map(r => r.__id));
                                                    else setSelectedForBundling([]);
                                                }}
                                                className="h-3.5 w-3.5 rounded border-zinc-300 text-primary focus:ring-primary/20"
                                            />
                                        </div>
                                    </th>
                                    <th className="w-12 border-b border-r border-zinc-200 dark:border-zinc-800 px-3 py-3.5 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Act</th>
                                    <th className="w-10 border-b border-r border-zinc-200 dark:border-zinc-800 px-1 py-3.5 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">#</th>
                                    <th className="min-w-[180px] border-b border-r border-zinc-200 dark:border-zinc-800 px-5 py-3.5 text-left text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Fee Description</th>
                                    <th className="w-24 md:w-36 border-b border-r border-zinc-200 dark:border-zinc-800 px-5 py-3.5 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Frequency</th>
                                    <th className="w-24 md:w-32 border-b border-r border-zinc-200 dark:border-zinc-800 px-5 py-3.5 text-left text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Month</th>
                                    <th className="w-32 border-b border-r border-zinc-200 dark:border-zinc-800 px-5 py-3.5 text-left text-[10px] font-bold text-primary/70 uppercase tracking-widest">Fee Date</th>
                                    <th className="w-48 border-b border-r border-zinc-200 dark:border-zinc-800 px-5 py-3.5 text-left text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Adjustments</th>
                                    <th className="w-36 border-b border-r border-zinc-200 dark:border-zinc-800 px-5 py-3.5 text-left text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status</th>
                                    <th className="min-w-[120px] border-b border-zinc-200 dark:border-zinc-800 px-5 py-3.5 text-right text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Amount (Rs.)</th>
                                </tr>
                            </thead>
                            <tbody ref={tbodyRef} onMouseDown={() => recentlyAddedId && setRecentlyAddedId(null)}>
                                {rows.map((row, rIdx) => {
                                    const aCell = (c: number) => isCellActive(rIdx, c);
                                    const isLocked = isRowLocked(row);
                                    const isCurrentRowActive = activeCell?.row === rIdx;
                                    const groupSeparator = row.isGroupStart && rIdx > 0 ? "border-t-2 border-zinc-100" : "";
                                    const lockedBg = row.status === "PAID" ? "bg-emerald-50/10 dark:bg-emerald-950/20" : "bg-amber-50/20 dark:bg-amber-950/20";
                                    const isRecentlyAdded = row.__id === recentlyAddedId;
                                    const rowBg = isRecentlyAdded
                                        ? "bg-amber-100/50 dark:bg-amber-900/30 animate-in fade-in zoom-in-95 duration-300 shadow-inner"
                                        : (isLocked ? lockedBg : (isCurrentRowActive ? "bg-primary/[0.04]" : "bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900"));

                                    return (
                                        <tr key={row.__id} className={`${groupSeparator} ${rowBg} transition-all relative ${isRecentlyAdded ? 'ring-2 ring-inset ring-amber-400/50' : ''}`}>
                                            <td data-row={rIdx} data-col={COL_SELECT} className={`border-r border-b border-zinc-100 text-center ${aCell(COL_SELECT) ? "ring-2 ring-inset ring-primary/30 z-10" : ""}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedForBundling.includes(row.__id)}
                                                    onChange={() => handleToggleSelectForBundling(row.__id)}
                                                    className="h-3.5 w-3.5 rounded border-zinc-300 text-primary focus:ring-primary/20 cursor-pointer"
                                                />
                                            </td>
                                            <td data-row={rIdx} data-col={COL_ACTIONS} tabIndex={0} onFocus={() => setActiveCell({ row: rIdx, col: COL_ACTIONS })}
                                                className={`border-r border-b border-zinc-100 text-center ${aCell(COL_ACTIONS) ? "ring-2 ring-inset ring-primary/30 z-10 bg-white dark:bg-zinc-950" : ""}`}
                                            >
                                                <button
                                                    onClick={() => deleteRow(rIdx)}
                                                    disabled={isLocked}
                                                    className={`p-2 rounded-lg transition-all active:scale-90 ${isLocked ? "opacity-20 cursor-not-allowed" : "hover:bg-rose-50 text-zinc-300 hover:text-rose-600"}`}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </td>

                                            <td className="border-r border-b border-zinc-100 text-center font-mono text-[10px] text-zinc-400">{rIdx + 1}</td>
                                            {/* Fee Type Select */}
                                            <td data-row={rIdx} data-col={COL_FEE_TYPE} className={`p-0 border-r border-b border-zinc-100 relative ${aCell(COL_FEE_TYPE) ? "ring-2 ring-inset ring-primary/30 z-10 bg-white dark:bg-zinc-950 shadow-inner" : ""}`}>
                                                <div className="flex flex-col">
                                                    <div className="relative">
                                                        <select
                                                            data-row={rIdx} data-col={COL_FEE_TYPE}
                                                            value={row.feeId}
                                                            disabled={isLocked}
                                                            onChange={(e) => updateRow(rIdx, "feeId", Number(e.target.value))}
                                                            onFocus={() => setActiveCell({ row: rIdx, col: COL_FEE_TYPE })}
                                                            className={`w-full h-10 px-5 appearance-none outline-none bg-transparent font-semibold text-zinc-800 dark:text-zinc-200 text-[13px] ${isLocked ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                                                        >
                                                            {feeTypes.map(ft => (
                                                                <option key={ft.id} value={ft.id}>
                                                                    {ft.id === Number(row.feeId) && row.description_prefix ? `${row.description_prefix} — ` : ""}{ft.description}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        {!isLocked && <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-300 pointer-events-none" />}
                                                    </div>
                                                </div>
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

                                            {/* Month (Editable) */}
                                            <td data-row={rIdx} data-col={COL_MONTH} className={`p-0 border-r border-b border-zinc-100 relative ${aCell(COL_MONTH) ? "ring-2 ring-inset ring-primary/30 z-10 bg-white dark:bg-zinc-950 shadow-inner" : ""}`}>
                                                <select
                                                    data-row={rIdx} data-col={COL_MONTH}
                                                    value={row.initialMonth}
                                                    disabled={isLocked}
                                                    onChange={(e) => updateRow(rIdx, "initialMonth", e.target.value)}
                                                    onFocus={() => setActiveCell({ row: rIdx, col: COL_MONTH })}
                                                    className={`w-full h-10 px-5 appearance-none outline-none bg-transparent font-semibold text-zinc-500 text-[13px] ${isLocked ? "cursor-not-allowed" : "cursor-pointer"}`}
                                                >
                                                    {MONTH_ORDER.map(m => <option key={m} value={m}>{m}</option>)}
                                                </select>
                                                {!isLocked && <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-300 pointer-events-none" />}
                                            </td>
                                            {/* Fee Date (optional, for multi-voucher-per-month) */}
                                            <td data-row={rIdx} data-col={COL_FEE_DATE} className={`p-0 border-r border-b border-zinc-100 relative ${aCell(COL_FEE_DATE) ? "ring-2 ring-inset ring-primary/30 z-10 bg-white dark:bg-zinc-950 shadow-inner" : ""}`}>
                                                <input
                                                    data-row={rIdx} data-col={COL_FEE_DATE}
                                                    type="date"
                                                    value={row.fee_date || ""}
                                                    disabled={isLocked}
                                                    onChange={(e) => updateRow(rIdx, "fee_date", e.target.value || undefined)}
                                                    onFocus={() => setActiveCell({ row: rIdx, col: COL_FEE_DATE })}
                                                    className={`w-full h-10 px-3 outline-none bg-transparent text-[12px] font-mono transition-colors
                                                        ${row.fee_date ? "text-primary font-semibold" : "text-zinc-300"}
                                                        ${isLocked ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                                                />
                                            </td>

                                            <td className={`p-0 border-r border-b border-zinc-100 relative bg-zinc-50/10`}>
                                                <div className="flex flex-col gap-1 px-4 py-2">
                                                    {row.installment_id && row.installment_fee_type_id !== Number(row.feeId) && (
                                                        <div className="flex items-center gap-1.5 p-1.5 bg-indigo-50/50 border border-indigo-100 rounded-lg">
                                                            <CreditCard className="h-2.5 w-2.5 text-indigo-500" />
                                                            <div className="flex flex-col">
                                                                <span className="text-[8px] font-black text-indigo-600 uppercase tracking-tighter">
                                                                    {row.installment_fee_type_desc || "Merged Installment"}
                                                                </span>
                                                                {row.installment_amount && (
                                                                    <span className="text-[9px] font-bold text-indigo-400 font-mono">
                                                                        Added: Rs. {parseInt(row.installment_amount).toLocaleString()}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {row.bundle_id && (
                                                        <div className="flex items-center gap-1.5 p-1.5 bg-primary/5 border border-primary/10 rounded-lg group/bundle">
                                                            <Layers className="h-2.5 w-2.5 text-primary" />
                                                            <span className="text-[8px] font-black text-primary uppercase tracking-tighter truncate max-w-[100px]">
                                                                Bundled: {row.bundle_name || "Pack"}
                                                            </span>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDissolveBundle(row.bundle_id!); }}
                                                                className="opacity-0 group-hover/bundle:opacity-100 p-0 text-zinc-300 hover:text-rose-500 transition-all ml-auto"
                                                                title="Dissolve Bundle"
                                                            >
                                                                <Trash2 className="h-2.5 w-2.5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                    {/* Pending Actions */}
                                                    {pendingBundles.filter(pb => pb.member_ids.includes(row.__id)).map((pb, idx) => (
                                                        <div key={idx} className="flex items-center gap-1.5 p-1.5 bg-rose-500/5 border border-rose-500/10 rounded-lg group/bundle animate-pulse">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                                            <span className="text-[8px] font-black text-rose-600 uppercase tracking-tighter">
                                                                {pb.bundle_name} (Pending)
                                                            </span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setPendingBundles(prev => prev.filter(p => p !== pb));
                                                                }}
                                                                className="opacity-0 group-hover/bundle:opacity-100 text-zinc-300 hover:text-rose-500 transition-all ml-auto"
                                                                title="Remove Pending Bundle"
                                                            >
                                                                <Trash2 className="h-2.5 w-2.5" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {!row.installment_id && !row.bundle_id && pendingBundles.filter(pb => pb.member_ids.includes(row.__id)).length === 0 && (
                                                        <span className="text-[9px] font-bold text-zinc-300 italic">— No Adjustments</span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Status Column */}
                                            <td className={`p-0 border-r border-b border-zinc-100 relative`}>
                                                <div className="flex flex-wrap items-center gap-1 px-4 py-2">
                                                    {row.status === "PAID" && (
                                                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                                                            <span className="h-1 w-1 rounded-full bg-emerald-500" />
                                                            <span className="text-[8px] font-black text-emerald-600 uppercase tracking-tighter text-nowrap">Paid</span>
                                                        </div>
                                                    )}
                                                    {row.status === "PARTIALLY_PAID" && (
                                                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-cyan-500/10 border border-cyan-500/20 rounded-md">
                                                            <span className="h-1 w-1 rounded-full bg-cyan-500" />
                                                            <span className="text-[8px] font-black text-cyan-600 uppercase tracking-tighter text-nowrap">Partial</span>
                                                        </div>
                                                    )}
                                                    {row.status === "ISSUED" && (
                                                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-md">
                                                            <span className="h-1 w-1 rounded-full bg-amber-500" />
                                                            <span className="text-[8px] font-black text-amber-600 uppercase tracking-tighter text-nowrap">Locked</span>
                                                        </div>
                                                    )}
                                                    {(!row.status || row.status === "NOT_ISSUED") && (
                                                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 rounded-md">
                                                            <span className="h-1 w-1 rounded-full bg-zinc-300" />
                                                            <span className="text-[8px] font-black text-zinc-400 uppercase tracking-tighter text-nowrap">Pending</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td data-row={rIdx} data-col={COL_AMOUNT} className={`p-0 border-b border-zinc-100 ${aCell(COL_AMOUNT) ? "ring-2 ring-inset ring-primary/30 z-10 bg-white dark:bg-zinc-950 shadow-inner" : ""}`}>
                                                <div className="relative h-10 flex items-center">
                                                    <span className="pl-5 text-[10px] font-bold text-zinc-300">Rs.</span>
                                                    <input
                                                        data-row={rIdx} data-col={COL_AMOUNT}
                                                        type="number"
                                                        value={row.amount}
                                                        disabled={isLocked}
                                                        onChange={(e) => updateRow(rIdx, "amount", e.target.value)}
                                                        onFocus={() => setActiveCell({ row: rIdx, col: COL_AMOUNT })}
                                                        className={`w-full h-full px-5 text-right font-mono font-medium text-[13px] outline-none bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-200 ${isLocked ? "cursor-not-allowed opacity-70" : ""}`}
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

            {/* Floating Editor Indicator */}
            <div className="fixed bottom-6 left-6 flex items-center gap-4 px-5 py-2.5 bg-zinc-900 text-white rounded-full shadow-2xl z-50">
                <div className="flex items-center gap-2 pr-4 border-r border-white/20">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[9px] font-bold uppercase tracking-widest">Editor Active</span>
                </div>
                <div className="flex items-center gap-4 text-[9px] font-medium text-white/50 uppercase tracking-widest">
                    <span>Arrows/Tab: Move</span>
                    <span>•</span>
                    <span>Enter: Commit</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-black">Save: Persist Changes</span>
                </div>
            </div>

            {/* Floating Bundling Toolbar */}
            {selectedForBundling.length >= 2 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[60] animate-in slide-in-from-bottom-8 duration-500">
                    <div className="h-10 w-10 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                        <Plus className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-1.5 ml-1">
                            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Bundle {selectedForBundling.length} Heads</p>
                            {(user?.role === 'SUPER_ADMIN' || user?.role === 'CAMPUS_ADMIN') && (
                                <Link href="/fee-types/bundle-names" className="text-[9px] font-black text-primary hover:underline uppercase tracking-widest flex items-center gap-1">
                                    <Plus className="h-2 w-2" />
                                    Manage bundle names
                                </Link>
                            )}
                        </div>
                        <div className="flex gap-2">
                             <div className="relative">
                                <select
                                    value={bundleNameInput}
                                    onChange={(e) => setBundleNameInput(e.target.value)}
                                    className="w-64 h-10 pl-4 pr-10 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold focus:outline-none focus:border-primary transition-all appearance-none cursor-pointer"
                                >
                                    <option value="" disabled>Select Bundle Name...</option>
                                    {bundleNames.map(bn => (
                                        <option key={bn.id} value={bn.name}>{bn.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                            </div>
                            {distinctDates.length > 1 ? (
                                <div className="h-10 px-4 flex items-center gap-2 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 animate-pulse">
                                    <AlertCircle className="h-4 w-4" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Date Mismatch</span>
                                </div>
                            ) : (
                                <div className="h-10 px-4 flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                                    <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                                    <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
                                        {distinctDates[0] !== "none" ? (
                                            <span className="text-primary">{distinctDates[0]}</span>
                                        ) : (
                                            "No Date Set"
                                        )}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setSelectedForBundling([]); setBundleNameInput(""); }}
                            className="h-10 px-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl text-xs font-bold hover:bg-zinc-200 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreateBundle}
                            disabled={isCreatingBundle || distinctDates.length > 1}
                            className={`h-10 px-6 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2
                                ${distinctDates.length > 1 ? "bg-zinc-200 text-zinc-400 cursor-not-allowed shadow-none" : "bg-primary text-white hover:bg-primary/90 shadow-primary/20"}`}
                        >
                            {isCreatingBundle ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create Bundle"}
                        </button>
                    </div>
                </div>
            )}
            {/* Bulk Operations Drawer */}
            <BulkOperationsDrawer
                isOpen={showBulkDrawer}
                onClose={() => setShowBulkDrawer(false)}
            />
            {/* Modal */}
            <InstallmentModal
                isOpen={isInstallmentModalOpen}
                onClose={() => setIsInstallmentModalOpen(false)}
                onSuccess={() => fetchFeeSchedule(Number(selectedClassId), selectedCampusId, studentId, selectedYear)}
                studentId={Number(studentId)}
                studentName={searchQuery.split(/\s\(/)[0] || "Student"}
                existingFees={rows}
                academicYear={selectedYear}
            />
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
