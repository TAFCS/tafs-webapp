"use client";

import { StudentProfileModal } from "./student-profile-modal";

import { useState, useMemo, useEffect } from "react";
import {
    Search,
    MoreVertical,
    Filter,
    Columns,
    ChevronDown,
    Eye,
    FileText,
    DollarSign,
    Link as LinkIcon,
    Edit,
    Calendar
} from "lucide-react";

export type FinancialStatus = "Cleared" | "Overdue" | "Partial";
export type EnrollmentStatus = "SOFT_ADMISSION" | "ENROLLED" | "EXPELLED" | "GRADUATED";

// 1. Data Models
import { StudentListItem } from "../../../store/slices/studentsSlice";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../../../store/store";
import { fetchStudents } from "../../../store/slices/studentsSlice";

// Columns Definition
interface ColumnDef {
    id: keyof StudentListItem;
    label: string;
    isDefault: boolean;
}

const COLUMNS: ColumnDef[] = [
    // Default Columns (Highest Priority)
    { id: "student_full_name", label: "Student Name", isDefault: true },
    { id: "gr_number", label: "G.R. Number", isDefault: true },
    { id: "cc_number", label: "C.C. Number", isDefault: true },
    { id: "campus", label: "Campus / Branch", isDefault: true },
    { id: "grade_and_section", label: "Grade & Section", isDefault: true },
    { id: "primary_guardian_name", label: "Primary Guardian Name", isDefault: true },
    { id: "whatsapp_number", label: "WhatsApp Number", isDefault: true },
    { id: "financial_status_badge", label: "Financial Status", isDefault: true },
    { id: "enrollment_status", label: "Enrollment Status", isDefault: true },

    // Toggleable Columns
    { id: "family_id", label: "Family ID", isDefault: false },
    { id: "household_name", label: "Household Name", isDefault: false },
    { id: "total_outstanding_balance", label: "Total Outstanding Balance", isDefault: false },
    { id: "advance_credit_balance", label: "Advance Credit Balance", isDefault: false },
    { id: "primary_guardian_cnic", label: "Primary Guardian CNIC", isDefault: false },
    { id: "date_of_admission", label: "Date of Admission", isDefault: false },
    { id: "date_of_birth", label: "Date of Birth (DOB)", isDefault: false },
    { id: "registration_number", label: "Registration Number", isDefault: false },
    { id: "house_and_color", label: "House & Color", isDefault: false },
    { id: "residential_address", label: "Residential Address", isDefault: false }
];

const COL_TO_CATEGORY_MAP: Record<keyof StudentListItem, string> = {
    id: "core",
    student_full_name: "core",
    gr_number: "core",
    cc_number: "core",
    campus: "core",
    enrollment_status: "core",
    financial_status_badge: "core",
    registration_number: "core",
    house_and_color: "core",

    grade_and_section: "academic",

    family_id: "family",
    household_name: "family",
    residential_address: "family",

    primary_guardian_name: "contact",
    whatsapp_number: "contact",
    primary_guardian_cnic: "contact",

    date_of_birth: "demographic",
    date_of_admission: "core",

    total_outstanding_balance: "core",
    advance_credit_balance: "core"
};

// Custom debounce hook inline
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

// 2. Main Component
export function StudentDataTable() {
    const dispatch = useDispatch<AppDispatch>();
    const { items, meta, isLoading, error } = useSelector((state: RootState) => state.students);

    // State: Fetching
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    // State: Columns
    const [visibleColumns, setVisibleColumns] = useState<Set<keyof StudentListItem>>(
        new Set(COLUMNS.filter(c => c.isDefault).map(c => c.id))
    );
    const [showColumnToggles, setShowColumnToggles] = useState(false);

    const activeCategories = useMemo(() => {
        const cats = new Set<string>();
        visibleColumns.forEach(col => {
            const cat = COL_TO_CATEGORY_MAP[col];
            if (cat) cats.add(cat);
        });
        return Array.from(cats).join(",");
    }, [visibleColumns]);

    // State: Filters
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearchQuery = useDebounce(searchQuery, 400);

    const [campusIdFilter, setCampusIdFilter] = useState<number | "All">("All");
    const [statusFilter, setStatusFilter] = useState<EnrollmentStatus | "All">("All");
    const [gradeFilter, setGradeFilter] = useState<string>("All");
    const [sectionFilter, setSectionFilter] = useState<string>("All");
    const [houseFilter, setHouseFilter] = useState<string>("All");
    const [financialFilters, setFinancialFilters] = useState<string[]>([]);
    const [hasSiblingsOnly, setHasSiblingsOnly] = useState(false);

    // Checkboxes for financial (removed logic for brevity because backend handles status)

    const [showFilters, setShowFilters] = useState(false);

    // State: Actions Menu Mapping (Row ID -> Boolean)
    const [openActionRowId, setOpenActionRowId] = useState<number | null>(null);
    const [viewingStudent, setViewingStudent] = useState<StudentListItem | null>(null);

    // Redux Fetch Effect
    useEffect(() => {
        dispatch(fetchStudents({
            page,
            limit,
            search: debouncedSearchQuery || undefined,
            campus_id: campusIdFilter !== "All" ? campusIdFilter : undefined,
            status: statusFilter !== "All" ? statusFilter : undefined,
            fields: activeCategories || undefined,
            grade: gradeFilter !== "All" ? gradeFilter : undefined,
            section: sectionFilter !== "All" ? sectionFilter : undefined,
            house: houseFilter !== "All" ? houseFilter : undefined,
            financial_status: financialFilters.length > 0 ? financialFilters : undefined,
            has_siblings: hasSiblingsOnly || undefined
        }));
    }, [dispatch, page, limit, debouncedSearchQuery, campusIdFilter, statusFilter, activeCategories, gradeFilter, sectionFilter, houseFilter, financialFilters, hasSiblingsOnly]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Element;
            if (target && typeof target.closest === 'function') {
                if (!target.closest('.action-menu-container')) {
                    setOpenActionRowId(null);
                }
                if (!target.closest('.columns-menu-container')) {
                    setShowColumnToggles(false);
                }
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const campuses: { id: number; name: string; code: string }[] = [
        { id: 1, name: "Gulistan-e-Johar Campus", code: "JHR" },
        { id: 2, name: "Kaneez Fatima Campus", code: "KNF" },
        { id: 3, name: "North Nazimabad Campus", code: "NNZ" }
    ];

    const toggleColumn = (colId: keyof StudentListItem) => {
        const next = new Set(visibleColumns);
        if (next.has(colId)) {
            next.delete(colId);
        } else {
            next.add(colId);
        }
        setVisibleColumns(next);
    };


    return (
        <div className="bg-white border rounded-xl shadow-sm flex flex-col w-full h-full text-base">

            {/* Top Toolbar */}
            <div className="p-4 border-b flex flex-col gap-4 lg:flex-row lg:items-center justify-between bg-zinc-50/50 rounded-t-xl">

                {/* Search Bar */}
                <div className="relative w-full lg:max-w-md flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                        type="text"
                        placeholder="Search Name, G.R., C.C. or Phone..."
                        className="w-full pl-9 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Toolbar Actions */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-zinc-100 transition-colors ${showFilters ? 'bg-zinc-100 border-zinc-300' : 'bg-white'}`}
                    >
                        <Filter className="h-4 w-4" />
                        <span className="font-medium">Filters</span>
                        {(campusIdFilter !== "All" || statusFilter !== "All" || gradeFilter !== "All" || sectionFilter !== "All" || houseFilter !== "All" || financialFilters.length > 0 || hasSiblingsOnly) && (
                            <span className="w-2 h-2 rounded-full bg-blue-500 ml-1"></span>
                        )}
                    </button>

                    <div className="relative columns-menu-container">
                        <button
                            onClick={() => setShowColumnToggles(!showColumnToggles)}
                            className="flex items-center gap-2 px-3 py-2 border bg-white rounded-lg hover:bg-zinc-100 transition-colors"
                        >
                            <Columns className="h-4 w-4" />
                            <span className="font-medium hidden sm:inline-block">Columns</span>
                            <ChevronDown className="h-3 w-3 opacity-50" />
                        </button>

                        {/* Dropdown for Columns */}
                        {showColumnToggles && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-white border rounded-lg shadow-xl z-50 p-2 max-h-96 overflow-y-auto">
                                <div className="text-xs font-semibold text-zinc-500 px-2 py-1 uppercase tracking-wider mb-1">Toggle Columns</div>
                                {COLUMNS.map((col) => (
                                    <label key={col.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-50 rounded cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="rounded border-zinc-300 text-primary focus:ring-primary h-4 w-4"
                                            checked={visibleColumns.has(col.id)}
                                            onChange={() => toggleColumn(col.id)}
                                            disabled={col.isDefault && visibleColumns.has(col.id) && visibleColumns.size === 1} // Prevent hiding everything
                                        />
                                        <span className="text-zinc-700">{col.label}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* Advanced Filters Panel */}
            {showFilters && (
                <div className="p-4 border-b bg-zinc-50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6 items-end">
                    {/* Status */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-zinc-500 uppercase">Enrollment Status</label>
                        <select
                            className="border rounded-md px-3 py-1.5 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm shadow-sm"
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value as EnrollmentStatus | "All");
                                setPage(1);
                            }}
                        >
                            <option value="All">All Statuses</option>
                            <option value="SOFT_ADMISSION">Soft Admission</option>
                            <option value="ENROLLED">Enrolled</option>
                            <option value="EXPELLED">Expelled</option>
                            <option value="GRADUATED">Graduated</option>
                        </select>
                    </div>

                    {/* Campus */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-zinc-500 uppercase">Campus / Branch</label>
                        <select
                            className="border rounded-md px-3 py-1.5 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm shadow-sm"
                            value={campusIdFilter}
                            onChange={(e) => {
                                const val = e.target.value;
                                setCampusIdFilter(val === "All" ? "All" : Number(val));
                                setPage(1);
                            }}
                        >
                            <option value="All">All Campuses</option>
                            {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    {/* Grade & Section */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-zinc-500 uppercase">Grade</label>
                        <select
                            className="border rounded-md px-3 py-1.5 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm shadow-sm"
                            value={gradeFilter}
                            onChange={(e) => { setGradeFilter(e.target.value); setPage(1); }}
                        >
                            <option value="All">All Grades</option>
                            <optgroup label="Cambridge System">
                                {["pre-nursery", "nursery", "Kindergarden", "junior-1", "junior-2", "junior-3", "jr-4", "jr-5", "senior-1", "snr-2", "snr-3", "O1", "o2", "03"].map(g => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </optgroup>
                            <optgroup label="Secondary System">
                                {["6", "7", "8", "9", "10"].map(g => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </optgroup>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-zinc-500 uppercase">Section</label>
                        <select
                            className="border rounded-md px-3 py-1.5 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm shadow-sm"
                            value={sectionFilter}
                            onChange={(e) => { setSectionFilter(e.target.value); setPage(1); }}
                        >
                            <option value="All">All Sections</option>
                            {["A", "B", "C", "D", "E", "O-I", "O-II", "AS", "A2"].map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    {/* House Filter */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-zinc-500 uppercase">House</label>
                        <select
                            className="border rounded-md px-3 py-1.5 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm shadow-sm"
                            value={houseFilter}
                            onChange={(e) => { setHouseFilter(e.target.value); setPage(1); }}
                        >
                            <option value="All">All Houses</option>
                            {["Jinnah", "Iqbal", "Liaquat", "Sir Syed"].map(h => (
                                <option key={h} value={h}>{h}</option>
                            ))}
                        </select>
                    </div>

                    {/* Financial Checkboxes */}
                    <div className="flex flex-col gap-2 p-2 bg-white border rounded-lg shadow-sm">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">Financial Filters</label>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {[
                                { id: "Overdue", label: "Defaulters" },
                                { id: "Cleared", label: "Cleared" },
                                { id: "Partial", label: "Partial" }
                            ].map(f => (
                                <label key={f.id} className="flex items-center gap-1.5 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        className="rounded border-zinc-300 text-primary w-3.5 h-3.5"
                                        checked={financialFilters.includes(f.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) setFinancialFilters([...financialFilters, f.id]);
                                            else setFinancialFilters(financialFilters.filter(x => x !== f.id));
                                            setPage(1);
                                        }}
                                    />
                                    <span className="text-xs text-zinc-600 group-hover:text-zinc-900 transition-colors">{f.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Sibling Toggle */}
                    <div className="flex items-center gap-2 p-2 px-3 bg-white border rounded-lg shadow-sm h-[38px]">
                        <input
                            type="checkbox"
                            id="siblingsOnly"
                            className="rounded border-zinc-300 text-primary w-4 h-4"
                            checked={hasSiblingsOnly}
                            onChange={(e) => { setHasSiblingsOnly(e.target.checked); setPage(1); }}
                        />
                        <label htmlFor="siblingsOnly" className="text-xs font-semibold text-zinc-700 cursor-pointer select-none">Siblings Only</label>
                    </div>
                </div>
            )}

            {/* Table Area (Scrollable X and Y) */}
            <div className="flex-1 overflow-auto w-full min-h-0">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                        <tr className="bg-zinc-50 border-b text-zinc-500 font-medium text-sm uppercase tracking-wider">
                            {COLUMNS.map(col => {
                                if (!visibleColumns.has(col.id)) return null;
                                return (
                                    <th key={col.id} className="py-4 px-3 first:pl-4">
                                        {col.label}
                                    </th>
                                );
                            })}
                            <th className="py-4 px-3 text-right pr-4 sticky right-0 bg-zinc-50 border-l shadow-[-10px_0_15px_-5px_rgb(0,0,0,0.03)] z-10 w-[80px]">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {isLoading ? (
                            <tr>
                                <td colSpan={visibleColumns.size + 1} className="py-12 text-center text-zinc-500">
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                                        Loading records...
                                    </div>
                                </td>
                            </tr>
                        ) : error ? (
                            <tr>
                                <td colSpan={visibleColumns.size + 1} className="py-12 text-center text-red-500">
                                    {error}
                                </td>
                            </tr>
                        ) : items.length === 0 ? (
                            <tr>
                                <td colSpan={visibleColumns.size + 1} className="py-12 text-center text-zinc-500">
                                    No students found matching your filters.
                                </td>
                            </tr>
                        ) : (
                            items.map((student) => (
                                <tr key={student.id} className="hover:bg-zinc-50/50 transition-colors group">
                                    {COLUMNS.map(col => {
                                        if (!visibleColumns.has(col.id)) return null;

                                        // Special Renders based on Column ID
                                        let cellContent: React.ReactNode = student[col.id];

                                        if (col.id === "financial_status_badge") {
                                            const statusStyles: Record<string, string> = {
                                                Cleared: "bg-emerald-100 text-emerald-800 border-emerald-200",
                                                Overdue: "bg-rose-100 text-rose-800 border-rose-200",
                                                Partial: "bg-amber-100 text-amber-800 border-amber-200",
                                            };
                                            const statusText = typeof cellContent === 'string' && statusStyles[cellContent] ? cellContent : "Cleared";
                                            cellContent = (
                                                <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${statusStyles[statusText] || statusStyles.Cleared}`}>
                                                    {statusText}
                                                </span>
                                            );
                                        }

                                        if (col.id === "enrollment_status") {
                                            const statusStr = String(student.enrollment_status || '');
                                            const estatusStyles: Record<string, string> = {
                                                ENROLLED: "bg-emerald-100 text-emerald-800 border-emerald-200",
                                                SOFT_ADMISSION: "bg-zinc-100 text-zinc-800 border-zinc-200",
                                                GRADUATED: "bg-blue-100 text-blue-800 border-blue-200",
                                                EXPELLED: "bg-rose-100 text-rose-800 border-rose-200 line-through decoration-rose-400",
                                            };
                                            cellContent = (
                                                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border ${estatusStyles[statusStr] || 'bg-zinc-100 text-zinc-800 border-zinc-200'}`}>
                                                    {(statusStr || 'N/A').replace('_', ' ')}
                                                </span>
                                            );
                                        }

                                        if (col.id === "student_full_name") {
                                            cellContent = (
                                                <div className="font-semibold text-zinc-900 group-hover:text-primary transition-colors">
                                                    {student.student_full_name}
                                                </div>
                                            );
                                        }

                                        if (col.id === "total_outstanding_balance") {
                                            cellContent = <span className={(student.total_outstanding_balance ?? 0) > 0 ? "text-rose-600 font-medium" : ""}>Rs. {(student.total_outstanding_balance ?? 0).toLocaleString()}</span>;
                                        }
                                        if (col.id === "advance_credit_balance") {
                                            cellContent = <span className={(student.advance_credit_balance ?? 0) > 0 ? "text-emerald-600 font-medium" : ""}>Rs. {(student.advance_credit_balance ?? 0).toLocaleString()}</span>;
                                        }

                                        return (
                                            <td key={col.id} className="py-4 px-3 first:pl-4 text-zinc-700">
                                                {cellContent}
                                            </td>
                                        );
                                    })}

                                    {/* Actions Cell (Sticky Right) */}
                                    <td className={`py-4 px-3 text-right pr-4 sticky right-0 bg-white group-hover:bg-zinc-50 border-l shadow-[-10px_0_15px_-5px_rgb(0,0,0,0.03)] transition-colors w-[80px] ${openActionRowId === student.id ? 'z-30' : 'z-10'}`}>

                                        <div className="relative inline-block text-left action-menu-container">
                                            <button
                                                onClick={() => setOpenActionRowId(openActionRowId === student.id ? null : student.id)}
                                                className="p-1.5 rounded-md hover:bg-zinc-200 text-zinc-500 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                aria-haspopup="true"
                                            >
                                                <MoreVertical className="h-4 w-4" />
                                            </button>

                                            {/* Action Menu Popup */}
                                            {openActionRowId === student.id && (
                                                <div className="absolute right-0 top-8 mt-1 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none z-50 overflow-hidden divide-y divide-zinc-100 flex flex-col">

                                                    <div className="py-1">
                                                        <ActionItem
                                                            icon={<Eye />}
                                                            label="View Full Profile"
                                                            onClick={() => {
                                                                // @ts-ignore
                                                                setViewingStudent(student);
                                                                setOpenActionRowId(null);
                                                            }}
                                                        />
                                                    </div>

                                                    <div className="py-1">
                                                        <ActionItem icon={<FileText />} label="Generate Instant Challan" />
                                                        <ActionItem icon={<DollarSign />} label="Receive Payment" color="text-emerald-600" />
                                                    </div>

                                                    <div className="py-1">
                                                        <ActionItem icon={<Edit />} label="Edit Details" />
                                                        <ActionItem icon={<Calendar />} label="Edit Fee Schedule" />
                                                        <ActionItem icon={<LinkIcon />} label="Edit Sibling Link" />
                                                    </div>

                                                </div>
                                            )}
                                        </div>

                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination / Footer Area */}
            {meta && (
                <div className="p-4 border-t bg-zinc-50 rounded-b-xl flex justify-between items-center text-zinc-500">
                    <span>Showing {(meta.page - 1) * meta.limit + 1} to {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} entries</span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage(p => p - 1)}
                            disabled={!meta.hasPrev || isLoading}
                            className="px-3 py-1.5 border rounded-lg bg-white hover:bg-zinc-50 text-zinc-700 transition-colors disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <span className="px-3 py-1.5 text-sm font-medium">Page {meta.page} of {meta.pages}</span>
                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={!meta.hasNext || isLoading}
                            className="px-3 py-1.5 border rounded-lg bg-white hover:bg-zinc-50 text-zinc-700 transition-colors disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* Modals */}
            <StudentProfileModal student={viewingStudent as any} onClose={() => setViewingStudent(null)} />

        </div>
    );
}


// Reusable Dropdown Action Item
function ActionItem({ icon, label, color = "text-zinc-700", onClick }: { icon: React.ReactNode, label: string, color?: string, onClick?: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`flex w-full items-center gap-2 px-4 py-2 text-xs font-medium hover:bg-zinc-100 ${color} transition-colors`}
            role="menuitem"
        >
            <span className="h-4 w-4 opacity-70">{icon}</span>
            {label}
        </button>
    );
}
