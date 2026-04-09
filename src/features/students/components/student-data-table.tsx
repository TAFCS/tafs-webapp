"use client";

import { StudentProfileModal } from "./student-profile-modal";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    Search,
    Filter,
    Columns,
    ChevronDown,
    Eye,
    FileText,
    DollarSign,
    Link as LinkIcon,
    Edit,
    Calendar,
    GraduationCap,
    Phone,
    Users,
    ChevronLeft,
    ChevronRight,
    X,
    MoreHorizontal,
} from "lucide-react";

export type FinancialStatus = "Cleared" | "Overdue" | "Partial";
export type EnrollmentStatus = "SOFT_ADMISSION" | "ENROLLED" | "EXPELLED" | "GRADUATED";

import { StudentListItem } from "../../../store/slices/studentsSlice";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../../../store/store";
import { fetchStudents } from "../../../store/slices/studentsSlice";

interface ColumnDef {
    id: keyof StudentListItem;
    label: string;
    isDefault: boolean;
}

const COLUMNS: ColumnDef[] = [
    { id: "student_full_name", label: "Student Name", isDefault: true },
    { id: "gr_number", label: "G.R. Number", isDefault: true },
    { id: "cc_number", label: "Computer Code", isDefault: true },
    { id: "campus", label: "Campus / Branch", isDefault: true },
    { id: "grade_and_section", label: "Grade & Section", isDefault: true },
    { id: "primary_guardian_name", label: "Primary Guardian Name", isDefault: true },
    { id: "whatsapp_number", label: "WhatsApp Number", isDefault: true },
    { id: "financial_status_badge", label: "Financial Status", isDefault: true },
    { id: "enrollment_status", label: "Enrollment Status", isDefault: true },
    { id: "family_id", label: "Family ID", isDefault: false },
    { id: "household_name", label: "Household Name", isDefault: false },
    { id: "total_outstanding_balance", label: "Outstanding Balance", isDefault: false },
    { id: "advance_credit_balance", label: "Advance Credit", isDefault: false },
    { id: "primary_guardian_cnic", label: "Guardian CNIC", isDefault: false },
    { id: "date_of_admission", label: "Date of Admission", isDefault: false },
    { id: "date_of_birth", label: "Date of Birth", isDefault: false },
    { id: "registration_number", label: "Computer Code", isDefault: false },
    { id: "house_and_color", label: "House & Color", isDefault: false },
    { id: "residential_address", label: "Address", isDefault: false },
    { id: "father_name", label: "Father's Name", isDefault: false },
    { id: "siblings", label: "Siblings", isDefault: false },
];

const COL_TO_CATEGORY_MAP: Record<keyof StudentListItem, string> = {
    id: "core", student_full_name: "core", gr_number: "core", cc_number: "core",
    campus: "core", enrollment_status: "core", financial_status_badge: "core",
    registration_number: "core", house_and_color: "core", gender: "demographic",
    grade_and_section: "academic", class_id: "academic",
    family_id: "family", household_name: "family", residential_address: "family",
    primary_guardian_name: "contact", whatsapp_number: "contact", primary_guardian_cnic: "contact",
    date_of_birth: "demographic", date_of_admission: "core",
    total_outstanding_balance: "core", advance_credit_balance: "core",
    father_name: "contact", siblings: "family",
};

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

// ─── Badge Helpers ──────────────────────────────────────────────────────────

const FINANCIAL_STYLES: Record<string, { cls: string; label: string }> = {
    Cleared: { cls: "bg-emerald-50 text-emerald-700 border border-emerald-200", label: "Cleared" },
    Overdue: { cls: "bg-rose-50    text-rose-700    border border-rose-200", label: "Overdue" },
    Partial: { cls: "bg-amber-50   text-amber-700   border border-amber-200", label: "Partial" },
};

const ENROLLMENT_STYLES: Record<string, { cls: string; label: string }> = {
    ENROLLED: { cls: "bg-emerald-50 text-emerald-700 border border-emerald-200", label: "Enrolled" },
    SOFT_ADMISSION: { cls: "bg-zinc-100 dark:bg-zinc-800   text-zinc-600 dark:text-zinc-400    border border-zinc-200 dark:border-zinc-800", label: "Soft Admission" },
    GRADUATED: { cls: "bg-blue-50    text-blue-700    border border-blue-200", label: "Graduated" },
    EXPELLED: { cls: "bg-rose-50    text-rose-700    border border-rose-200", label: "Expelled" },
};

const CAMPUS_CODES: Record<string, string> = {
    "Gulistan-e-Johar Campus": "JHR",
    "Kaneez Fatima Campus": "KNF",
    "North Nazimabad Campus": "NNZ",
};

const campuses = [
    { id: 1, name: "Gulistan-e-Johar Campus" },
    { id: 2, name: "Kaneez Fatima Campus" },
    { id: 3, name: "North Nazimabad Campus" },
];

// ─── Main Component ──────────────────────────────────────────────────────────

export function StudentDataTable() {
    const router = useRouter();
    const dispatch = useDispatch<AppDispatch>();
    const { items, meta, isLoading, error } = useSelector((state: RootState) => state.students);

    const [page, setPage] = useState(1);
    const [limit] = useState(15);
    const [viewingStudentId, setViewingStudentId] = useState<number | null>(null);
    const [openActionRowId, setOpenActionRowId] = useState<number | null>(null);

    const [visibleColumns, setVisibleColumns] = useState<Set<keyof StudentListItem>>(
        new Set(COLUMNS.filter(c => c.isDefault).map(c => c.id))
    );
    const [showColumnToggles, setShowColumnToggles] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearch = useDebounce(searchQuery, 400);

    const [campusIdFilter, setCampusIdFilter] = useState<number | "All">("All");
    const [statusFilter, setStatusFilter] = useState<EnrollmentStatus | "All">("All");
    const [gradeFilter, setGradeFilter] = useState("All");
    const [sectionFilter, setSectionFilter] = useState("All");
    const [houseFilter, setHouseFilter] = useState("All");
    const [financialFilters, setFinancialFilters] = useState<string[]>([]);
    const [hasSiblingsOnly, setHasSiblingsOnly] = useState(false);

    const viewingStudent = useMemo(
        () => items.find(s => s.id === viewingStudentId) || null,
        [items, viewingStudentId]
    );

    const activeCategories = useMemo(() => {
        const cats = new Set<string>();
        visibleColumns.forEach(col => { const c = COL_TO_CATEGORY_MAP[col]; if (c) cats.add(c); });
        if (viewingStudentId) { cats.add("family"); cats.add("contact"); cats.add("demographic"); cats.add("academic"); }
        return Array.from(cats).join(",");
    }, [visibleColumns, viewingStudentId]);

    const hasActiveFilters = campusIdFilter !== "All" || statusFilter !== "All" || gradeFilter !== "All"
        || sectionFilter !== "All" || houseFilter !== "All" || financialFilters.length > 0 || hasSiblingsOnly;

    useEffect(() => {
        dispatch(fetchStudents({
            page, limit,
            search: debouncedSearch || undefined,
            campus_id: campusIdFilter !== "All" ? campusIdFilter : undefined,
            status: statusFilter !== "All" ? statusFilter : undefined,
            fields: activeCategories || undefined,
            grade: gradeFilter !== "All" ? gradeFilter : undefined,
            section: sectionFilter !== "All" ? sectionFilter : undefined,
            house: houseFilter !== "All" ? houseFilter : undefined,
            financial_status: financialFilters.length > 0 ? financialFilters : undefined,
            has_siblings: hasSiblingsOnly || undefined,
        }));
    }, [dispatch, page, limit, debouncedSearch, campusIdFilter, statusFilter, activeCategories, gradeFilter, sectionFilter, houseFilter, financialFilters, hasSiblingsOnly]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const t = e.target as Element;
            if (t?.closest) {
                if (!t.closest(".action-menu-container")) setOpenActionRowId(null);
                if (!t.closest(".columns-menu-container")) setShowColumnToggles(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const resetFilters = () => {
        setCampusIdFilter("All"); setStatusFilter("All"); setGradeFilter("All");
        setSectionFilter("All"); setHouseFilter("All"); setFinancialFilters([]); setHasSiblingsOnly(false);
        setPage(1);
    };

    const toggleColumn = (colId: keyof StudentListItem) => {
        const next = new Set(visibleColumns);
        if (next.has(colId)) next.delete(colId); else next.add(colId);
        setVisibleColumns(next);
    };

    const buildFetchParams = () => ({
        page, limit,
        search: debouncedSearch || undefined,
        campus_id: campusIdFilter !== "All" ? campusIdFilter : undefined,
        status: statusFilter !== "All" ? statusFilter : undefined,
        fields: activeCategories || undefined,
        grade: gradeFilter !== "All" ? gradeFilter : undefined,
        section: sectionFilter !== "All" ? sectionFilter : undefined,
        house: houseFilter !== "All" ? houseFilter : undefined,
        financial_status: financialFilters.length > 0 ? financialFilters : undefined,
        has_siblings: hasSiblingsOnly || undefined,
    });

    // ─── Render ────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col gap-4 w-full">

            {/* ── Toolbar ─────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">

                {/* Search */}
                <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search name, G.R., Computer Code or phone…"
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                        className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:text-zinc-400">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {/* Right buttons */}
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all shadow-sm ${showFilters || hasActiveFilters
                            ? "bg-primary text-white border-primary shadow-primary/20"
                            : "bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900"}`}
                    >
                        <Filter className="h-4 w-4" />
                        Filters
                        {hasActiveFilters && <span className="h-1.5 w-1.5 rounded-full bg-white dark:bg-zinc-950/70" />}
                    </button>

                    <div className="relative columns-menu-container">
                        <button
                            onClick={() => setShowColumnToggles(!showColumnToggles)}
                            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900 transition-all shadow-sm"
                        >
                            <Columns className="h-4 w-4" />
                            <span className="hidden sm:inline">Columns</span>
                            <ChevronDown className="h-3 w-3 opacity-50" />
                        </button>

                        {showColumnToggles && (
                            <div className="absolute right-0 top-full mt-2 w-60 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 p-2 max-h-96 overflow-y-auto">
                                <div className="text-[10px] font-semibold text-zinc-400 px-2 py-1 uppercase tracking-widest mb-1">
                                    Toggle Columns
                                </div>
                                {COLUMNS.map(col => (
                                    <label key={col.id} className="flex items-center gap-2.5 px-2 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900 rounded-lg cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="rounded border-zinc-300 dark:border-zinc-700 text-primary focus:ring-primary h-3.5 w-3.5"
                                            checked={visibleColumns.has(col.id)}
                                            onChange={() => toggleColumn(col.id)}
                                        />
                                        <span className="text-sm text-zinc-700 dark:text-zinc-300">{col.label}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Filter Panel ────────────────────────────────────────── */}
            {showFilters && (
                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Active Filters</span>
                        {hasActiveFilters && (
                            <button onClick={resetFilters} className="text-xs text-primary hover:underline font-medium">
                                Clear all
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">

                        <FilterSelect label="Status" value={statusFilter} onChange={v => { setStatusFilter(v as any); setPage(1); }}>
                            <option value="All">All Statuses</option>
                            <option value="SOFT_ADMISSION">Soft Admission</option>
                            <option value="ENROLLED">Enrolled</option>
                            <option value="EXPELLED">Expelled</option>
                            <option value="GRADUATED">Graduated</option>
                        </FilterSelect>

                        <FilterSelect label="Campus" value={String(campusIdFilter)} onChange={v => { setCampusIdFilter(v === "All" ? "All" : Number(v)); setPage(1); }}>
                            <option value="All">All Campuses</option>
                            {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </FilterSelect>

                        <FilterSelect label="Grade" value={gradeFilter} onChange={v => { setGradeFilter(v); setPage(1); }}>
                            <option value="All">All Grades</option>
                            <optgroup label="Cambridge GCE O' Level">
                                {["Pre-Nursery", "Nursery", "K.G.", "JR-I", "JR-II", "JR-III", "JR-IV", "JR-V", "SR-I", "SR-II", "SR-III", "O-I", "O-II", "O-III"].map(g => <option key={g} value={g}>{g}</option>)}
                            </optgroup>
                            <optgroup label="Secondary System">
                                {["VI", "VII", "VIII", "IX", "X"].map(g => <option key={g} value={g}>{g}</option>)}
                            </optgroup>
                        </FilterSelect>

                        <FilterSelect label="Section" value={sectionFilter} onChange={v => { setSectionFilter(v); setPage(1); }}>
                            <option value="All">All Sections</option>
                            {["A", "B", "C", "D", "E", "O-I", "O-II", "AS", "A2"].map(s => <option key={s} value={s}>{s}</option>)}
                        </FilterSelect>

                        <FilterSelect label="House" value={houseFilter} onChange={v => { setHouseFilter(v); setPage(1); }}>
                            <option value="All">All Houses</option>
                            {["Jinnah", "Iqbal", "Liaquat", "Sir Syed"].map(h => <option key={h} value={h}>{h}</option>)}
                        </FilterSelect>

                        {/* Financial checkboxes */}
                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Financial</span>
                            <div className="flex flex-col gap-1.5 pt-0.5">
                                {[{ id: "Overdue", label: "Defaulters" }, { id: "Cleared", label: "Cleared" }, { id: "Partial", label: "Partial" }].map(f => (
                                    <label key={f.id} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="rounded border-zinc-300 dark:border-zinc-700 text-primary h-3.5 w-3.5"
                                            checked={financialFilters.includes(f.id)}
                                            onChange={e => {
                                                if (e.target.checked) setFinancialFilters([...financialFilters, f.id]);
                                                else setFinancialFilters(financialFilters.filter(x => x !== f.id));
                                                setPage(1);
                                            }}
                                        />
                                        <span className="text-sm text-zinc-700 dark:text-zinc-300">{f.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Siblings */}
                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Other</span>
                            <label className="flex items-center gap-2 cursor-pointer pt-0.5">
                                <input
                                    type="checkbox"
                                    className="rounded border-zinc-300 dark:border-zinc-700 text-primary h-3.5 w-3.5"
                                    checked={hasSiblingsOnly}
                                    onChange={e => { setHasSiblingsOnly(e.target.checked); setPage(1); }}
                                />
                                <span className="text-sm text-zinc-700 dark:text-zinc-300">Siblings only</span>
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Table Card ──────────────────────────────────────────── */}
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">

                {/* Loading */}
                {isLoading && (
                    <div className="flex flex-col items-center justify-center py-24 gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading students…</p>
                    </div>
                )}

                {/* Error */}
                {!isLoading && error && (
                    <div className="flex flex-col items-center justify-center py-20 gap-2 text-rose-600">
                        <p className="font-medium">Failed to load</p>
                        <p className="text-sm text-rose-400">{error}</p>
                    </div>
                )}

                {/* Empty */}
                {!isLoading && !error && items.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 gap-3 text-zinc-500 dark:text-zinc-400">
                        <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                            <GraduationCap className="h-6 w-6 text-zinc-400" />
                        </div>
                        <div className="text-center">
                            <p className="font-medium text-zinc-700 dark:text-zinc-300">No students found</p>
                            <p className="text-sm text-zinc-400 mt-0.5">Try adjusting your search or filters</p>
                        </div>
                        {hasActiveFilters && (
                            <button onClick={resetFilters} className="text-sm text-primary hover:underline font-medium">
                                Clear filters
                            </button>
                        )}
                    </div>
                )}

                {/* Table */}
                {!isLoading && !error && items.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead>
                                <tr className="border-b border-zinc-100 bg-zinc-50 dark:bg-zinc-900/80">
                                    <th className="px-5 py-3.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">
                                        Student
                                    </th>
                                    {visibleColumns.has("grade_and_section") && (
                                        <th className="px-5 py-3.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">Grade</th>
                                    )}
                                    {visibleColumns.has("campus") && (
                                        <th className="px-5 py-3.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">Campus</th>
                                    )}
                                    {visibleColumns.has("primary_guardian_name") && (
                                        <th className="px-5 py-3.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">Guardian</th>
                                    )}
                                    {visibleColumns.has("financial_status_badge") && (
                                        <th className="px-5 py-3.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">Finance</th>
                                    )}
                                    {visibleColumns.has("enrollment_status") && (
                                        <th className="px-5 py-3.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">Status</th>
                                    )}
                                    {/* Extra optional visible columns */}
                                    {COLUMNS.filter(c => !["student_full_name", "gr_number", "cc_number", "campus", "grade_and_section", "primary_guardian_name", "whatsapp_number", "financial_status_badge", "enrollment_status"].includes(c.id) && visibleColumns.has(c.id)).map(c => (
                                        <th key={c.id} className="px-5 py-3.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">{c.label}</th>
                                    ))}
                                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider sticky right-0 bg-zinc-50 dark:bg-zinc-900/80 border-l border-zinc-100 w-16">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {items.map(student => {
                                    const financialInfo = FINANCIAL_STYLES[student.financial_status_badge ?? "Cleared"] ?? FINANCIAL_STYLES.Cleared;
                                    const enrollmentInfo = ENROLLMENT_STYLES[student.enrollment_status ?? ""] ?? ENROLLMENT_STYLES.SOFT_ADMISSION;

                                    return (
                                        <tr key={student.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900/60 transition-colors group">

                                            {/* Student core cell */}
                                            <td className="px-5 py-4 min-w-[200px]">
                                                <div className="flex flex-col gap-0.5">
                                                    <button
                                                        onClick={() => setViewingStudentId(student.id)}
                                                        className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-primary transition-colors text-left leading-tight"
                                                    >
                                                        {student.student_full_name}
                                                    </button>
                                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                        {student.gr_number && (
                                                            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">GR: {student.gr_number}</span>
                                                        )}
                                                        {student.cc_number && (
                                                            <>
                                                                <span className="w-0.5 h-0.5 rounded-full bg-zinc-300 inline-block" />
                                                                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">CC: {student.cc_number}</span>
                                                            </>
                                                        )}
                                                        {student.siblings && student.siblings.length > 0 && (
                                                            <>
                                                                <span className="w-0.5 h-0.5 rounded-full bg-zinc-300 inline-block" />
                                                                <span className="inline-flex items-center gap-1 text-[11px] text-indigo-600 font-medium">
                                                                    <Users className="h-3 w-3" />
                                                                    {student.siblings.length} sibling{student.siblings.length > 1 ? "s" : ""}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Grade & Section */}
                                            {visibleColumns.has("grade_and_section") && (
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                                                        {student.grade_and_section ?? <span className="text-zinc-300">—</span>}
                                                    </span>
                                                </td>
                                            )}

                                            {/* Campus */}
                                            {visibleColumns.has("campus") && (
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2.5 py-1 rounded-full">
                                                        {CAMPUS_CODES[student.campus ?? ""] ?? student.campus ?? "—"}
                                                    </span>
                                                </td>
                                            )}

                                            {/* Guardian */}
                                            {visibleColumns.has("primary_guardian_name") && (
                                                <td className="px-5 py-4 min-w-[160px]">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-sm text-zinc-800 dark:text-zinc-200">{student.primary_guardian_name ?? <span className="text-zinc-300">—</span>}</span>
                                                        {visibleColumns.has("whatsapp_number") && student.whatsapp_number && (
                                                            <span className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                                                                <Phone className="h-3 w-3" />
                                                                {student.whatsapp_number}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            )}

                                            {/* Financial Status */}
                                            {visibleColumns.has("financial_status_badge") && (
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${financialInfo.cls}`}>
                                                        {financialInfo.label}
                                                    </span>
                                                </td>
                                            )}

                                            {/* Enrollment Status */}
                                            {visibleColumns.has("enrollment_status") && (
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${enrollmentInfo.cls}`}>
                                                        {enrollmentInfo.label}
                                                    </span>
                                                </td>
                                            )}

                                            {/* Extra optional columns */}
                                            {COLUMNS.filter(c => !["student_full_name", "gr_number", "cc_number", "campus", "grade_and_section", "primary_guardian_name", "whatsapp_number", "financial_status_badge", "enrollment_status"].includes(c.id) && visibleColumns.has(c.id)).map(c => {
                                                let value: React.ReactNode = String(student[c.id] ?? "—");
                                                if (c.id === "total_outstanding_balance")
                                                    value = <span className={(student.total_outstanding_balance ?? 0) > 0 ? "text-rose-600 font-medium" : ""}>Rs. {(student.total_outstanding_balance ?? 0).toLocaleString()}</span>;
                                                if (c.id === "advance_credit_balance")
                                                    value = <span className={(student.advance_credit_balance ?? 0) > 0 ? "text-emerald-600 font-medium" : ""}>Rs. {(student.advance_credit_balance ?? 0).toLocaleString()}</span>;
                                                if (c.id === "siblings") {
                                                    const count = student.siblings?.length ?? 0;
                                                    value = count > 0 ? `${count} sibling${count > 1 ? "s" : ""}` : "None";
                                                }
                                                return (
                                                    <td key={c.id} className="px-5 py-4 text-sm text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                                                        {value}
                                                    </td>
                                                );
                                            })}

                                            {/* Actions */}
                                            <td className={`px-5 py-4 text-right sticky right-0 bg-white dark:bg-zinc-950 group-hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900 border-l border-zinc-100 transition-colors ${openActionRowId === student.id ? "z-30" : "z-10"}`}>
                                                <div className="relative inline-block action-menu-container">
                                                    <button
                                                        onClick={() => setOpenActionRowId(openActionRowId === student.id ? null : student.id)}
                                                        className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 transition-colors"
                                                    >
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </button>

                                                    {openActionRowId === student.id && (
                                                        <div className="absolute right-0 top-9 w-52 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-zinc-100 py-1">
                                                            <div className="py-1">
                                                                <ActionItem icon={<Eye />} label="View Profile" onClick={() => { setViewingStudentId(student.id); setOpenActionRowId(null); }} />
                                                            </div>
                                                            <div className="py-1">
                                                                <ActionItem icon={<FileText />} label="Instant Challan" />
                                                                <ActionItem icon={<DollarSign />} label="Receive Payment" color="text-emerald-600" />
                                                            </div>
                                                            <div className="py-1">
                                                                <ActionItem
                                                                    icon={<Edit />}
                                                                    label="Edit Details"
                                                                    onClick={() => router.push(`/staff-editing/students?search=${student.cc_number}`)}
                                                                />
                                                                <ActionItem icon={<Calendar />} label="Edit Fee Schedule" />
                                                                <ActionItem icon={<LinkIcon />} label="Edit Sibling Link" />
                                                            </div>
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

                {/* ── Pagination ──────────────────────────────────────── */}
                {meta && !isLoading && (
                    <div className="border-t border-zinc-100 px-5 py-3.5 flex items-center justify-between gap-4 bg-zinc-50 dark:bg-zinc-900/50">
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            Showing <span className="font-semibold text-zinc-700 dark:text-zinc-300">{(meta.page - 1) * meta.limit + 1}</span>–<span className="font-semibold text-zinc-700 dark:text-zinc-300">{Math.min(meta.page * meta.limit, meta.total)}</span> of <span className="font-semibold text-zinc-700 dark:text-zinc-300">{meta.total}</span> students
                        </span>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setPage(p => p - 1)}
                                disabled={!meta.hasPrev}
                                className="h-8 w-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 px-2">
                                {meta.page} / {meta.pages}
                            </span>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={!meta.hasNext}
                                className="h-8 w-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Profile Modal */}
            <StudentProfileModal
                studentId={viewingStudentId}
                onClose={() => setViewingStudentId(null)}
                onUpdate={() => dispatch(fetchStudents(buildFetchParams()))}
            />
        </div>
    );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function FilterSelect({ label, value, onChange, children }: {
    label: string; value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{label}</label>
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className="border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 bg-white dark:bg-zinc-950 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            >
                {children}
            </select>
        </div>
    );
}

function ActionItem({ icon, label, color = "text-zinc-700 dark:text-zinc-300", onClick }: {
    icon: React.ReactNode; label: string; color?: string; onClick?: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex w-full items-center gap-2.5 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900 ${color} transition-colors`}
            role="menuitem"
        >
            <span className="h-4 w-4 opacity-60 shrink-0">{icon}</span>
            {label}
        </button>
    );
}
