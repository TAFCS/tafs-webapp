"use client";

import { StudentProfileModal } from "./student-profile-modal";

import { useState, useEffect } from "react";
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
export type EnrollmentStatus = "Active" | "Pending" | "Archived";

// 1. Data Models
export interface Student {
    id: string;
    fullName: string;
    grNumber: string;
    ccNumber: string;
    campus: string;
    gradeSection: string;
    primaryGuardianName: string;
    whatsappNumber: string;
    financialStatus: FinancialStatus;
    enrollmentStatus: EnrollmentStatus;

    // Toggleable columns
    familyId: string;
    totalOutstandingBalance: number;
    advanceCreditBalance: number;
    primaryGuardianCNIC: string;
    dateOfAdmission: string;
    dateOfBirth: string;
    registrationNumber: string;
    houseColor: string;
    residentialAddress: string;
}

const MOCK_DATA: Student[] = [
    {
        id: "1",
        fullName: "Ali Khan",
        grNumber: "GR-2023-001",
        ccNumber: "CC-84920",
        campus: "North Campus",
        gradeSection: "X-B",
        primaryGuardianName: "Tariq Khan (Father)",
        whatsappNumber: "+92 300 1234567",
        financialStatus: "Cleared",
        enrollmentStatus: "Active",
        familyId: "FAM-101",
        totalOutstandingBalance: 0,
        advanceCreditBalance: 5000,
        primaryGuardianCNIC: "42101-1234567-1",
        dateOfAdmission: "2023-04-01",
        dateOfBirth: "2008-05-14",
        registrationNumber: "REG-9912",
        houseColor: "Jinnah (Blue)",
        residentialAddress: "House 42, Block 4, Clifton"
    },
    {
        id: "2",
        fullName: "Sara Ahmed",
        grNumber: "GR-2024-055",
        ccNumber: "CC-84921",
        campus: "KFC Branch",
        gradeSection: "O-III",
        primaryGuardianName: "Ahmed Raza (Father)",
        whatsappNumber: "+92 333 9876543",
        financialStatus: "Overdue",
        enrollmentStatus: "Active",
        familyId: "FAM-102",
        totalOutstandingBalance: 15000,
        advanceCreditBalance: 0,
        primaryGuardianCNIC: "42101-7654321-3",
        dateOfAdmission: "2024-08-15",
        dateOfBirth: "2009-11-20",
        registrationNumber: "REG-9945",
        houseColor: "Iqbal (Red)",
        residentialAddress: "Apt 5, Sunset Blvd, DHA"
    },
    {
        id: "3",
        fullName: "Zaid Ali",
        grNumber: "GR-2022-110",
        ccNumber: "CC-83011",
        campus: "North Campus",
        gradeSection: "IX-A",
        primaryGuardianName: "Omar Ali (Father)",
        whatsappNumber: "+92 301 5556667",
        financialStatus: "Partial",
        enrollmentStatus: "Active",
        familyId: "FAM-103",
        totalOutstandingBalance: 5000,
        advanceCreditBalance: 0,
        primaryGuardianCNIC: "42101-0000000-5",
        dateOfAdmission: "2022-03-10",
        dateOfBirth: "2010-01-05",
        registrationNumber: "REG-8822",
        houseColor: "Liaquat (Green)",
        residentialAddress: "Street 7, Bahadurabad"
    },
    {
        id: "4",
        fullName: "Ayesha Omer",
        grNumber: "GR-2025-001",
        ccNumber: "CC-85002",
        campus: "KFC Branch",
        gradeSection: "I-A",
        primaryGuardianName: "Omer Saeed (Father)",
        whatsappNumber: "+92 345 1112233",
        financialStatus: "Cleared",
        enrollmentStatus: "Pending",
        familyId: "FAM-103", // Sibling of Zaid
        totalOutstandingBalance: 0,
        advanceCreditBalance: 0,
        primaryGuardianCNIC: "42101-0000000-5",
        dateOfAdmission: "2025-01-10",
        dateOfBirth: "2018-06-12",
        registrationNumber: "REG-9999",
        houseColor: "Liaquat (Green)",
        residentialAddress: "Street 7, Bahadurabad"
    }
];

// Columns Definition
interface ColumnDef {
    id: keyof Student;
    label: string;
    isDefault: boolean;
}

const COLUMNS: ColumnDef[] = [
    // Default Columns (Highest Priority)
    { id: "fullName", label: "Student Name", isDefault: true },
    { id: "grNumber", label: "G.R. Number", isDefault: true },
    { id: "ccNumber", label: "C.C. Number", isDefault: true },
    { id: "campus", label: "Campus / Branch", isDefault: true },
    { id: "gradeSection", label: "Grade & Section", isDefault: true },
    { id: "primaryGuardianName", label: "Primary Guardian Name", isDefault: true },
    { id: "whatsappNumber", label: "WhatsApp Number", isDefault: true },
    { id: "financialStatus", label: "Financial Status", isDefault: true },
    { id: "enrollmentStatus", label: "Enrollment Status", isDefault: true },

    // Toggleable Columns
    { id: "familyId", label: "Family ID / Household", isDefault: false },
    { id: "totalOutstandingBalance", label: "Total Outstanding Balance", isDefault: false },
    { id: "advanceCreditBalance", label: "Advance Credit Balance", isDefault: false },
    { id: "primaryGuardianCNIC", label: "Primary Guardian CNIC", isDefault: false },
    { id: "dateOfAdmission", label: "Date of Admission", isDefault: false },
    { id: "dateOfBirth", label: "Date of Birth (DOB)", isDefault: false },
    { id: "registrationNumber", label: "Registration Number", isDefault: false },
    { id: "houseColor", label: "House & Color", isDefault: false },
    { id: "residentialAddress", label: "Residential Address", isDefault: false }
];

// 2. Main Component
export function StudentDataTable() {
    // State: Columns
    const [visibleColumns, setVisibleColumns] = useState<Set<keyof Student>>(
        new Set(COLUMNS.filter(c => c.isDefault).map(c => c.id))
    );
    const [showColumnToggles, setShowColumnToggles] = useState(false);

    // State: Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [campusFilter, setCampusFilter] = useState<string>("All");
    const [gradeFilter, setGradeFilter] = useState<string>("All"); // Normally an array for multi-select, string for simplicity here
    const [statusFilter, setStatusFilter] = useState<string>("All");

    // Checkboxes for financial
    const [finCleared, setFinCleared] = useState(false);
    const [finOverdue, setFinOverdue] = useState(false);
    const [finAdvancePaid, setFinAdvancePaid] = useState(false); // Map to "Partial" or logic with advanceCreditBalance

    const [onlySiblings, setOnlySiblings] = useState(false);
    const [houseFilter, setHouseFilter] = useState<string>("All");

    const [showFilters, setShowFilters] = useState(false);

    // State: Actions Menu Mapping (Row ID -> Boolean)
    const [openActionRowId, setOpenActionRowId] = useState<string | null>(null);
    const [viewingStudent, setViewingStudent] = useState<Student | null>(null);

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

    const toggleColumn = (colId: keyof Student) => {
        const next = new Set(visibleColumns);
        if (next.has(colId)) {
            next.delete(colId);
        } else {
            next.add(colId);
        }
        setVisibleColumns(next);
    };

    // Derived Logic: Filters
    const filteredData = useMemo(() => {
        return MOCK_DATA.filter(student => {
            // 1. Global Search (Name, GR, CC, Phone)
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matches =
                    student.fullName.toLowerCase().includes(q) ||
                    student.grNumber.toLowerCase().includes(q) ||
                    student.ccNumber.toLowerCase().includes(q) ||
                    student.whatsappNumber.toLowerCase().includes(q);
                if (!matches) return false;
            }

            // 2. Campus
            if (campusFilter !== "All" && student.campus !== campusFilter) return false;

            // 3. Grade
            if (gradeFilter !== "All" && student.gradeSection !== gradeFilter) return false;

            // 4. Status
            if (statusFilter !== "All" && student.enrollmentStatus !== statusFilter) return false;

            // 5. Financial Filters (if ANY checkbox is on, filter logic applies)
            const isFinFilterActive = finCleared || finOverdue || finAdvancePaid;
            if (isFinFilterActive) {
                let matchesFin = false;
                if (finCleared && student.financialStatus === "Cleared") matchesFin = true;
                if (finOverdue && student.financialStatus === "Overdue") matchesFin = true;
                if (finAdvancePaid && student.advanceCreditBalance > 0) matchesFin = true;
                if (!matchesFin) return false;
            }

            // 6. House Filter
            if (houseFilter !== "All" && !student.houseColor.includes(houseFilter)) return false;

            // 7. Sibling Filter (Find if Family ID appears more than once in FULL data, naive approach for mock)
            if (onlySiblings) {
                const sibCount = MOCK_DATA.filter(s => s.familyId === student.familyId).length;
                if (sibCount <= 1) return false;
            }

            return true;
        });
    }, [searchQuery, campusFilter, gradeFilter, statusFilter, finCleared, finOverdue, finAdvancePaid, houseFilter, onlySiblings]);


    // Unique Lists for Dropdowns based on MOCK_DATA
    const campuses = Array.from(new Set(MOCK_DATA.map(s => s.campus)));
    const grades = Array.from(new Set(MOCK_DATA.map(s => s.gradeSection)));
    const houses = ["Jinnah", "Iqbal", "Liaquat", "Sir Syed"];

    return (
        <div className="bg-white border rounded-xl shadow-sm flex flex-col w-full text-sm">

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
                        {(campusFilter !== "All" || statusFilter !== "All" || isFinFilterActive(finCleared, finOverdue, finAdvancePaid) || onlySiblings) && (
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
                <div className="p-4 border-b bg-zinc-50 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Status */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-zinc-600">Enrollment Status</label>
                        <select
                            className="border rounded-md px-3 py-1.5 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="All">All Statuses</option>
                            <option value="Active">Active</option>
                            <option value="Pending">Pending Admission</option>
                            <option value="Archived">Archived / Left</option>
                        </select>
                    </div>

                    {/* Campus */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-zinc-600">Campus</label>
                        <select
                            className="border rounded-md px-3 py-1.5 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={campusFilter}
                            onChange={(e) => setCampusFilter(e.target.value)}
                        >
                            <option value="All">All Campuses</option>
                            {campuses.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    {/* Grade & Section */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-zinc-600">Grade & Section</label>
                        <select
                            className="border rounded-md px-3 py-1.5 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={gradeFilter}
                            onChange={(e) => setGradeFilter(e.target.value)}
                        >
                            <option value="All">All Grades</option>
                            {grades.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>

                    {/* House */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-zinc-600">House</label>
                        <select
                            className="border rounded-md px-3 py-1.5 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={houseFilter}
                            onChange={(e) => setHouseFilter(e.target.value)}
                        >
                            <option value="All">All Houses</option>
                            {houses.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                    </div>

                    {/* Financial Checkboxes */}
                    <div className="flex flex-col gap-2 lg:col-span-2 mt-1">
                        <label className="text-xs font-medium text-zinc-600">Financial Filters</label>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={finOverdue} onChange={e => setFinOverdue(e.target.checked)} className="rounded border-zinc-300 text-red-500 focus:ring-red-500/20" />
                                <span className="text-zinc-700">Defaulters / Overdue</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={finCleared} onChange={e => setFinCleared(e.target.checked)} className="rounded border-zinc-300 text-green-500 focus:ring-green-500/20" />
                                <span className="text-zinc-700">Cleared</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={finAdvancePaid} onChange={e => setFinAdvancePaid(e.target.checked)} className="rounded border-zinc-300 text-blue-500 focus:ring-blue-500/20" />
                                <span className="text-zinc-700">Advance Paid</span>
                            </label>
                        </div>
                    </div>

                    {/* Sibling Toggle */}
                    <div className="flex flex-col gap-2 mt-1">
                        <label className="text-xs font-medium text-zinc-600">Family Filter</label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={onlySiblings} onChange={e => setOnlySiblings(e.target.checked)} className="rounded border-zinc-300 text-primary focus:ring-primary/20" />
                            <span className="text-zinc-700">Has Enrolled Siblings</span>
                        </label>
                    </div>

                </div>
            )}

            {/* Table Area (Scrollable X) */}
            <div className="overflow-x-auto w-full min-h-[400px]">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                        <tr className="bg-zinc-50 border-b text-zinc-500 font-medium text-xs uppercase tracking-wider">
                            {COLUMNS.map(col => {
                                if (!visibleColumns.has(col.id)) return null;
                                return (
                                    <th key={col.id} className="py-3 px-4 first:pl-6">
                                        {col.label}
                                    </th>
                                );
                            })}
                            <th className="py-3 px-4 text-right pr-6 sticky right-0 bg-zinc-50 border-l shadow-[-10px_0_15px_-5px_rgb(0,0,0,0.03)] z-10 w-[80px]">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {filteredData.length === 0 ? (
                            <tr>
                                <td colSpan={visibleColumns.size + 1} className="py-12 text-center text-zinc-500">
                                    No students found matching your filters.
                                </td>
                            </tr>
                        ) : (
                            filteredData.map((student) => (
                                <tr key={student.id} className="hover:bg-zinc-50/50 transition-colors group">
                                    {COLUMNS.map(col => {
                                        if (!visibleColumns.has(col.id)) return null;

                                        // Special Renders based on Column ID
                                        let cellContent: React.ReactNode = student[col.id];

                                        if (col.id === "financialStatus") {
                                            const statusStyles: Record<FinancialStatus, string> = {
                                                Cleared: "bg-emerald-100 text-emerald-800 border-emerald-200",
                                                Overdue: "bg-rose-100 text-rose-800 border-rose-200",
                                                Partial: "bg-amber-100 text-amber-800 border-amber-200",
                                            };
                                            cellContent = (
                                                <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${statusStyles[student.financialStatus]}`}>
                                                    {student.financialStatus}
                                                </span>
                                            );
                                        }

                                        if (col.id === "enrollmentStatus") {
                                            const estatusStyles: Record<EnrollmentStatus, string> = {
                                                Active: "bg-blue-100 text-blue-800 border-blue-200",
                                                Pending: "bg-zinc-100 text-zinc-800 border-zinc-200",
                                                Archived: "bg-zinc-100 text-zinc-500 border-zinc-200 line-through decoration-zinc-400",
                                            };
                                            cellContent = (
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded-md border ${estatusStyles[student.enrollmentStatus]}`}>
                                                    {student.enrollmentStatus}
                                                </span>
                                            );
                                        }

                                        if (col.id === "fullName") {
                                            cellContent = (
                                                <div className="font-semibold text-zinc-900 group-hover:text-primary transition-colors">
                                                    {student.fullName}
                                                </div>
                                            );
                                        }

                                        if (col.id === "totalOutstandingBalance") {
                                            cellContent = <span className={student.totalOutstandingBalance > 0 ? "text-rose-600 font-medium" : ""}>Rs. {student.totalOutstandingBalance.toLocaleString()}</span>;
                                        }
                                        if (col.id === "advanceCreditBalance") {
                                            cellContent = <span className={student.advanceCreditBalance > 0 ? "text-emerald-600 font-medium" : ""}>Rs. {student.advanceCreditBalance.toLocaleString()}</span>;
                                        }

                                        return (
                                            <td key={col.id} className="py-3 px-4 first:pl-6 text-zinc-700">
                                                {cellContent}
                                            </td>
                                        );
                                    })}

                                    {/* Actions Cell (Sticky Right) */}
                                    <td className="py-3 px-4 text-right pr-6 sticky right-0 bg-white group-hover:bg-zinc-50 border-l shadow-[-10px_0_15px_-5px_rgb(0,0,0,0.03)] transition-colors z-10 w-[80px]">

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
            <div className="p-4 border-t bg-zinc-50 rounded-b-xl flex justify-between items-center text-zinc-500">
                <span>Showing {filteredData.length} entries</span>
                <div className="flex gap-2">
                    <button className="px-3 py-1.5 border rounded-lg bg-white hover:bg-zinc-50 transition-colors disabled:opacity-50" disabled>Previous</button>
                    <button className="px-3 py-1.5 border rounded-lg bg-white hover:bg-zinc-50 transition-colors disabled:opacity-50" disabled>Next</button>
                </div>
            </div>

            {/* Modals */}
            <StudentProfileModal student={viewingStudent} onClose={() => setViewingStudent(null)} />

        </div>
    );
}

// Helper for filtering logic above
function isFinFilterActive(cleared: boolean, overdue: boolean, advance: boolean) {
    return cleared || overdue || advance;
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
