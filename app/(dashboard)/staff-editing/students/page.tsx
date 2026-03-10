"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
    Users,
    Loader2,
    RefreshCw,
    AlertCircle,
    CheckCircle,
    Search,
    Filter,
    Building2,
    GraduationCap,
    LayoutGrid,
    Heart
} from "lucide-react";
import api from "@/lib/api";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/store/store";
import { fetchCampuses } from "@/store/slices/campusesSlice";
import { fetchClasses } from "@/store/slices/classesSlice";
import { fetchSections } from "@/store/slices/sectionsSlice";
import { GuardianModal } from "@/components/staff-editing/guardian-modal";

// Custom debounce function to avoid lodash dependency
function debounce(func: Function, wait: number) {
    let timeout: NodeJS.Timeout | null = null;
    return (...args: any[]) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
            func(...args);
        }, wait);
    };
}

function formatNIC(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 13);
    let res = "";
    if (digits.length > 0) res += digits.slice(0, 5);
    if (digits.length > 5) res += "-" + digits.slice(5, 12);
    if (digits.length > 12) res += "-" + digits.slice(12, 13);
    return res;
}

interface StudentItem {
    cc: number;
    gr_number: string | null;
    full_name: string;
    dob: string | null;
    gender: string;
    nationality: string;
    religion: string | null;
    status: string;
    whatsapp_number: string | null;
    whatsapp_country_code: string | null;
    primary_phone: string | null;
    primary_phone_country_code: string | null;
    email: string | null;
    campus_id: number;
    campus_name: string;
    campus_code: string;
    class_id: number | null;
    class_name: string | null;
    class_code: string | null;
    section_id: number | null;
    section_name: string | null;
    house_id: number | null;
    house_name: string | null;
    admission_age_years: number;
    country: string | null;
    province: string | null;
    city: string | null;
    physical_impairment: string | null;
    consent_publicity: boolean;
    identification_marks: string | null;
    medical_info: string | null;
    interests: string | null;
    photograph_url: string | null;
    requested_grade: string;
    academic_system: string;
    academic_year: string;
    father_name: string | null;
    father_cnic: string | null;
    mother_name: string | null;
    mother_cnic: string | null;
}

const STATUS_OPTIONS = [
    "NULL",
    "SOFT_ADMISSION",
    "ENROLLED",
    "EXPELLED",
    "GRADUATED",
    "WITHDRAWN"
];

const GENDER_OPTIONS = ["NULL", "MALE", "FEMALE", "OTHER"];

const NATIONALITY_OPTIONS = ["NULL", "PAKISTANI", "OTHER"];
const RELIGION_OPTIONS = ["NULL", "MUSLIM", "CHRISTIAN", "HINDU", "OTHER"];
const COUNTRY_OPTIONS = ["NULL", "PAKISTAN", "OTHER"];
const PAKISTAN_PROVINCES = ["NULL", "SINDH", "BALOCHISTAN", "PUNJAB", "KPK", "GILGIT BALTISTAN", "OTHER"];

export default function StudentsSpreadsheetPage() {
    const dispatch = useDispatch<AppDispatch>();

    // Redux selectors
    const { items: campuses } = useSelector((state: RootState) => state.campuses);
    const { items: classes } = useSelector((state: RootState) => state.classes);
    const { items: sections } = useSelector((state: RootState) => state.sections);

    // Filter states
    const [selectedCampus, setSelectedCampus] = useState<string>("");
    const [selectedClass, setSelectedClass] = useState<string>("");
    const [selectedSection, setSelectedSection] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState("");

    // Modal state
    const [isGuardianModalOpen, setIsGuardianModalOpen] = useState(false);
    const [selectedStudentForGuardians, setSelectedStudentForGuardians] = useState<{ id: number, name: string } | null>(null);

    // Data states
    const [students, setStudents] = useState<StudentItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [patchingStatus, setPatchingStatus] = useState<Record<number, 'idle' | 'loading' | 'success' | 'error'>>({});

    // Pagination refs
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const cursorRef = useRef<number | null>(null);  // last cc seen; null = first page
    const hasMoreRef = useRef(false);
    const isFetchingMoreRef = useRef(false);

    // Filter value refs — keep in sync so stable callbacks always read the latest values
    const selectedCampusRef = useRef(selectedCampus);
    const selectedClassRef = useRef(selectedClass);
    const selectedSectionRef = useRef(selectedSection);
    const searchTermRef = useRef(searchTerm);

    // Column resizing state
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
        status: 60,
        cc: 80,
        full_name: 240,
        gr_number: 120,
        father_name: 200,
        father_cnic: 150,
        mother_name: 200,
        mother_cnic: 150,
        status_field: 160,
        gender: 120,
        nationality: 140,
        religion: 140,
        email: 220,
        primary_phone: 180,
        whatsapp_number: 180,
        country: 140,
        province: 140,
        city: 140,
        identification_marks: 200,
        medical_info: 200,
        interests: 200,
        admission_age_years: 140,
        physical_impairment: 200,
        guardians: 120
    });

    const [isResizing, setIsResizing] = useState<string | null>(null);

    useEffect(() => {
        dispatch(fetchCampuses());
        dispatch(fetchClasses());
        dispatch(fetchSections());
    }, [dispatch]);

    // Initial load / filter reset — always reloads from the beginning
    const loadStudents = useCallback(async () => {
        cursorRef.current = null;
        hasMoreRef.current = false;
        isFetchingMoreRef.current = false;
        setHasMore(false);
        setIsFetchingMore(false);
        setIsLoading(true);
        setStudents([]);
        setError(null);
        try {
            const { data } = await api.get("/v1/staff-editing/students", {
                params: {
                    limit: 50,
                    campus_id: selectedCampusRef.current || undefined,
                    class_id: selectedClassRef.current || undefined,
                    section_id: selectedSectionRef.current || undefined,
                    search: searchTermRef.current || undefined,
                },
            });
            const items: StudentItem[] = data?.data?.items || [];
            const more: boolean = data?.data?.hasMore ?? items.length === 50;
            const nextCursor: number | null = data?.data?.nextCursor ?? null;
            setStudents(items);
            hasMoreRef.current = more;
            cursorRef.current = nextCursor;
            setHasMore(more);
        } catch (err: any) {
            console.error("Error fetching students:", err);
            setError("Failed to load students. Please try again.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Append next batch — triggered by scroll threshold
    const loadMore = useCallback(async () => {
        if (isFetchingMoreRef.current || !hasMoreRef.current) return;
        isFetchingMoreRef.current = true;
        setIsFetchingMore(true);
        try {
            const { data } = await api.get("/v1/staff-editing/students", {
                params: {
                    cursor: cursorRef.current ?? undefined,
                    limit: 50,
                    campus_id: selectedCampusRef.current || undefined,
                    class_id: selectedClassRef.current || undefined,
                    section_id: selectedSectionRef.current || undefined,
                    search: searchTermRef.current || undefined,
                },
            });
            const items: StudentItem[] = data?.data?.items || [];
            const more: boolean = data?.data?.hasMore ?? items.length === 50;
            const nextCursor: number | null = data?.data?.nextCursor ?? null;
            setStudents(prev => [...prev, ...items]);
            hasMoreRef.current = more;
            cursorRef.current = nextCursor;
            setHasMore(more);
        } catch {
            // Silent — don't disrupt the existing view on a load-more failure
        } finally {
            isFetchingMoreRef.current = false;
            setIsFetchingMore(false);
        }
    }, []);

    const openGuardianModal = (id: number, name: string) => {
        setSelectedStudentForGuardians({ id, name });
        setIsGuardianModalOpen(true);
    };

    // Keep filter refs current so stable callbacks always use latest values
    useEffect(() => { selectedCampusRef.current = selectedCampus; }, [selectedCampus]);
    useEffect(() => { selectedClassRef.current = selectedClass; }, [selectedClass]);
    useEffect(() => { selectedSectionRef.current = selectedSection; }, [selectedSection]);

    // Reload from page 1 whenever a filter dropdown changes
    useEffect(() => {
        loadStudents();
    }, [selectedCampus, selectedClass, selectedSection, loadStudents]);

    // Debounced patch function
    const debouncedPatch = useMemo(
        () => debounce(async (id: number, field: string, value: any) => {
            setPatchingStatus(prev => ({ ...prev, [id]: 'loading' }));
            try {
                await api.patch(`/v1/staff-editing/students/${id}`, { [field]: value });
                setPatchingStatus(prev => ({ ...prev, [id]: 'success' }));

                // Clear success status after 2 seconds
                setTimeout(() => {
                    setPatchingStatus(prev => {
                        const next = { ...prev };
                        if (next[id] === 'success') next[id] = 'idle';
                        return next;
                    });
                }, 2000);
            } catch (err) {
                console.error(`Error patching student ${id}:`, err);
                setPatchingStatus(prev => ({ ...prev, [id]: 'error' }));
            }
        }, 1000),
        []
    );

    const handleCellEdit = async (id: number, field: keyof StudentItem, value: any) => {
        // Transform "NULL" to null
        let transformedValue = value === "NULL" ? null : value;

        // Transform text values to ALL CAPS (except email)
        if (typeof transformedValue === 'string' && field !== 'email') {
            transformedValue = transformedValue.toUpperCase();
        }

        // Apply NIC formatting
        if (field === 'father_cnic' || field === 'mother_cnic') {
            transformedValue = formatNIC(transformedValue || "");
        }

        // Optimistic update
        setStudents(prev => prev.map(s => s.cc === id ? { ...s, [field]: transformedValue } : s));

        // Trigger debounced patch
        debouncedPatch(id, field, transformedValue);

        // Autofill Name by NIC lookup
        if ((field === 'father_cnic' || field === 'mother_cnic') && transformedValue?.length === 15) {
            try {
                const { data } = await api.get(`/v1/staff-editing/guardians/by-nic/${transformedValue}`);
                if (data?.data?.full_name) {
                    const nameField = field === 'father_cnic' ? 'father_name' : 'mother_name';
                    const nameValue = data.data.full_name.toUpperCase();

                    // Update frontend state
                    setStudents(prev => prev.map(s => s.cc === id ? { ...s, [nameField]: nameValue } : s));

                    // Trigger patch for the name field as well
                    debouncedPatch(id, nameField, nameValue);
                }
            } catch (err) {
                console.error("Error fetching guardian by NIC:", err);
            }
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        searchTermRef.current = searchTerm;
        loadStudents();
    };

    // Resizing logic
    const startResizing = (column: string, e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(column);

        const startX = e.pageX;
        const startWidth = columnWidths[column];

        const onMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = Math.max(50, startWidth + (moveEvent.pageX - startX));
            setColumnWidths(prev => ({ ...prev, [column]: newWidth }));
        };

        const onMouseUp = () => {
            setIsResizing(null);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] space-y-4 p-4 lg:p-6 bg-zinc-50 dark:bg-zinc-900/50 -mx-4 md:-mx-6 lg:-mx-8 max-w-none w-[calc(100%+2rem)] md:w-[calc(100%+3rem)] lg:w-[calc(100%+4rem)] overflow-hidden">
            {/* Header & Filters */}
            <div className="flex flex-col gap-4 bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm mx-4 md:mx-6 lg:mx-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-zinc-900 flex items-center justify-center text-white shadow-lg shadow-zinc-200 text-center">
                            <Users className="h-5 w-5 mx-auto" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Student Directory Expansion</h1>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Full-width spreadsheet with resizable columns</p>
                        </div>
                    </div>

                    <button
                        onClick={loadStudents}
                        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 rounded-lg transition-colors text-zinc-500 dark:text-zinc-400"
                        title="Refresh data"
                    >
                        <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Campus Selector */}
                    <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
                            <Building2 className="h-4 w-4" />
                        </div>
                        <select
                            value={selectedCampus}
                            onChange={(e) => setSelectedCampus(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none transition-all appearance-none font-medium"
                        >
                            <option value="">All Campuses</option>
                            {campuses.map(campus => (
                                <option key={campus.id} value={campus.id}>{campus.campus_name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Class Selector */}
                    <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
                            <GraduationCap className="h-4 w-4" />
                        </div>
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none transition-all appearance-none font-medium"
                        >
                            <option value="">All Classes</option>
                            {classes.map(cls => (
                                <option key={cls.id} value={cls.id}>{cls.description}</option>
                            ))}
                        </select>
                    </div>

                    {/* Section Selector */}
                    <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
                            <LayoutGrid className="h-4 w-4" />
                        </div>
                        <select
                            value={selectedSection}
                            onChange={(e) => setSelectedSection(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none transition-all appearance-none font-medium"
                        >
                            <option value="">All Sections</option>
                            {sections.map(sec => (
                                <option key={sec.id} value={sec.id}>{sec.description}</option>
                            ))}
                        </select>
                    </div>

                    {/* Search */}
                    <form onSubmit={handleSearch} className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
                            <Search className="h-4 w-4" />
                        </div>
                        <input
                            type="text"
                            placeholder="SEARCH STUDENTS..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none transition-all font-medium"
                        />
                    </form>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-100 text-red-600 rounded-xl p-4 text-sm animate-in fade-in slide-in-from-top-2 mx-4 md:mx-6 lg:mx-8">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <p className="font-medium">{error}</p>
                </div>
            )}

            {/* Main Spreadsheet Content */}
            <div className="flex-1 bg-white dark:bg-zinc-950 border-y md:border border-zinc-200 dark:border-zinc-800 md:rounded-2xl shadow-sm overflow-hidden flex flex-col mx-0 md:mx-6 lg:mx-8">
                {isLoading && students.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                        <div className="relative h-12 w-12">
                            <div className="absolute inset-0 rounded-full border-4 border-zinc-100"></div>
                            <div className="absolute inset-0 rounded-full border-4 border-zinc-900 border-t-transparent animate-spin"></div>
                        </div>
                        <div className="text-center">
                            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Loading Student Database</h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Fetching records from secure server...</p>
                        </div>
                    </div>
                ) : !students || students.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                        <div className="h-16 w-16 rounded-2xl bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-zinc-300 mx-auto">
                            <Users className="h-8 w-8" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">No students found</h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">Try adjusting your filters or search term to find what you're looking for.</p>
                        </div>
                        <button
                            onClick={() => {
                                setSelectedCampus("");
                                setSelectedClass("");
                                setSelectedSection("");
                                setSearchTerm("");
                            }}
                            className="text-sm font-bold text-zinc-900 dark:text-zinc-100 hover:underline mx-auto block"
                        >
                            Clear all filters
                        </button>
                    </div>
                ) : (
                    <div
                        ref={scrollContainerRef}
                        className="flex-1 overflow-auto"
                        onScroll={(e) => {
                            const el = e.currentTarget;
                            if (el.scrollHeight - el.scrollTop - el.clientHeight < 600) loadMore();
                        }}
                    >
                        <table className="w-full text-sm text-left border-separate border-spacing-0 table-fixed">
                            <thead className="sticky top-0 z-30 bg-zinc-50 dark:bg-zinc-900">
                                <tr>
                                    {[
                                        { key: 'status', label: 'St', resizable: true, sticky: true, left: 0 },
                                        { key: 'cc', label: 'CC', resizable: true, sticky: true, left: columnWidths.status },
                                        { key: 'full_name', label: 'Full Name', resizable: true, sticky: true, left: columnWidths.status + columnWidths.cc },
                                        { key: 'gr_number', label: 'GR Number', resizable: true },
                                        { key: 'father_cnic', label: 'Father CNIC', resizable: true },
                                        { key: 'father_name', label: 'Father Name', resizable: true },
                                        { key: 'mother_cnic', label: 'Mother CNIC', resizable: true },
                                        { key: 'mother_name', label: 'Mother Name', resizable: true },
                                        { key: 'status_field', label: 'Status', resizable: true },
                                        { key: 'gender', label: 'Gender', resizable: true },
                                        { key: 'nationality', label: 'Nationality', resizable: true },
                                        { key: 'religion', label: 'Religion', resizable: true },
                                        { key: 'email', label: 'Email', resizable: true },
                                        { key: 'primary_phone', label: 'Phone', resizable: true },
                                        { key: 'whatsapp_number', label: 'WhatsApp', resizable: true },
                                        { key: 'country', label: 'Country of Birth', resizable: true },
                                        { key: 'province', label: 'Province of Birth', resizable: true },
                                        { key: 'city', label: 'City of Birth', resizable: true },
                                        { key: 'identification_marks', label: 'ID Marks', resizable: true },
                                        { key: 'medical_info', label: 'Medical Info', resizable: true },
                                        { key: 'interests', label: 'Interests', resizable: true },
                                        { key: 'admission_age_years', label: 'Adm Age', resizable: true },
                                        { key: 'physical_impairment', label: 'Impairs', resizable: true },
                                        { key: 'guardians', label: 'Guardians', resizable: true }
                                    ].map((col) => (
                                        <th
                                            key={col.key}
                                            style={{
                                                width: columnWidths[col.key],
                                                left: col.sticky ? col.left : undefined,
                                                zIndex: col.sticky ? 40 : undefined
                                            }}
                                            className={`${col.sticky ? 'sticky z-40 bg-zinc-50 dark:bg-zinc-900' : 'relative'} p-3 font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[10px] border-b border-r border-zinc-200 dark:border-zinc-800 group truncate`}
                                        >
                                            {col.label}
                                            {col.resizable && (
                                                <div
                                                    onMouseDown={(e) => startResizing(col.key, e)}
                                                    className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary transition-colors z-50 ${isResizing === col.key ? 'bg-primary' : 'bg-transparent'}`}
                                                />
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {students.map((student) => (
                                    <tr key={student.cc} className="hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900 transition-colors group">
                                        <td
                                            style={{ left: 0 }}
                                            className="sticky left-0 z-10 bg-white dark:bg-zinc-950 group-hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900 p-3 text-center border-r border-zinc-100"
                                        >
                                            {patchingStatus[student.cc] === 'loading' && (
                                                <Loader2 className="h-4 w-4 animate-spin text-zinc-400 mx-auto" />
                                            )}
                                            {patchingStatus[student.cc] === 'success' && (
                                                <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto animate-in zoom-in" />
                                            )}
                                            {patchingStatus[student.cc] === 'error' && (
                                                <AlertCircle className="h-4 w-4 text-red-500 mx-auto animate-in shake-1" />
                                            )}
                                            {(!patchingStatus[student.cc] || patchingStatus[student.cc] === 'idle') && (
                                                <div className="h-1.5 w-1.5 rounded-full bg-zinc-200 mx-auto" />
                                            )}
                                        </td>
                                        <td
                                            style={{ left: columnWidths.status }}
                                            className="sticky z-10 bg-zinc-50 dark:bg-zinc-900/80 group-hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 p-3 font-mono text-zinc-400 text-xs border-r border-zinc-100"
                                        >
                                            {student.cc}
                                        </td>
                                        <td
                                            style={{ left: columnWidths.status + columnWidths.cc }}
                                            className="sticky z-10 bg-white dark:bg-zinc-950 group-hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900 p-1 border-r border-zinc-100"
                                        >
                                            <input
                                                type="text"
                                                value={student.full_name || ""}
                                                onChange={(e) => handleCellEdit(student.cc, "full_name", e.target.value)}
                                                className="w-full px-2 py-1.5 bg-transparent focus:bg-white dark:bg-zinc-950 outline-none focus:ring-1 focus:ring-inset focus:ring-zinc-900 border-none rounded-md transition-all font-medium truncate"
                                            />
                                        </td>
                                        <td className="p-1 border-r border-zinc-100">
                                            <input
                                                type="text"
                                                value={student.gr_number || ""}
                                                onChange={(e) => handleCellEdit(student.cc, "gr_number", e.target.value)}
                                                className="w-full px-2 py-1.5 bg-transparent focus:bg-white dark:bg-zinc-950 outline-none focus:ring-1 focus:ring-inset focus:ring-zinc-900 border-none rounded-md transition-all sm:text-zinc-600 dark:text-zinc-400 truncate"
                                                placeholder="N/A"
                                            />
                                        </td>
                                        {/* Father CNIC */}
                                        <td className="p-1 border-r border-zinc-100">
                                            <input
                                                type="text"
                                                value={student.father_cnic || ""}
                                                onChange={(e) => handleCellEdit(student.cc, "father_cnic", e.target.value)}
                                                className="w-full px-2 py-1.5 bg-transparent focus:bg-white dark:bg-zinc-950 outline-none focus:ring-1 focus:ring-inset focus:ring-zinc-900 border-none rounded-md transition-all text-zinc-600 dark:text-zinc-400 truncate"
                                                placeholder="N/A"
                                            />
                                        </td>
                                        {/* Father Name */}
                                        <td className="p-1 border-r border-zinc-100">
                                            <input
                                                type="text"
                                                value={student.father_name || ""}
                                                onChange={(e) => handleCellEdit(student.cc, "father_name", e.target.value)}
                                                className="w-full px-2 py-1.5 bg-transparent focus:bg-white dark:bg-zinc-950 outline-none focus:ring-1 focus:ring-inset focus:ring-zinc-900 border-none rounded-md transition-all font-medium truncate"
                                                placeholder="N/A"
                                            />
                                        </td>
                                        {/* Mother CNIC */}
                                        <td className="p-1 border-r border-zinc-100">
                                            <input
                                                type="text"
                                                value={student.mother_cnic || ""}
                                                onChange={(e) => handleCellEdit(student.cc, "mother_cnic", e.target.value)}
                                                className="w-full px-2 py-1.5 bg-transparent focus:bg-white dark:bg-zinc-950 outline-none focus:ring-1 focus:ring-inset focus:ring-zinc-900 border-none rounded-md transition-all text-zinc-600 dark:text-zinc-400 truncate"
                                                placeholder="N/A"
                                            />
                                        </td>
                                        {/* Mother Name */}
                                        <td className="p-1 border-r border-zinc-100">
                                            <input
                                                type="text"
                                                value={student.mother_name || ""}
                                                onChange={(e) => handleCellEdit(student.cc, "mother_name", e.target.value)}
                                                className="w-full px-2 py-1.5 bg-transparent focus:bg-white dark:bg-zinc-950 outline-none focus:ring-1 focus:ring-inset focus:ring-zinc-900 border-none rounded-md transition-all font-medium truncate"
                                                placeholder="N/A"
                                            />
                                        </td>
                                        <td className="p-1 border-r border-zinc-100">
                                            <select
                                                value={student.status || "NULL"}
                                                onChange={(e) => handleCellEdit(student.cc, "status", e.target.value)}
                                                className="w-full px-2 py-1.5 bg-transparent focus:bg-white dark:bg-zinc-950 outline-none focus:ring-1 focus:ring-inset focus:ring-zinc-900 border-none rounded-md transition-all appearance-none cursor-pointer truncate"
                                            >
                                                {STATUS_OPTIONS.map(opt => (
                                                    <option key={opt} value={opt}>{opt === "NULL" ? "NULL" : opt.replace('_', ' ')}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="p-1 border-r border-zinc-100">
                                            <select
                                                value={student.gender || "NULL"}
                                                onChange={(e) => handleCellEdit(student.cc, "gender", e.target.value)}
                                                className="w-full px-2 py-1.5 bg-transparent focus:bg-white dark:bg-zinc-950 outline-none focus:ring-1 focus:ring-inset focus:ring-zinc-900 border-none rounded-md transition-all appearance-none cursor-pointer"
                                            >
                                                {GENDER_OPTIONS.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="p-1 border-r border-zinc-100">
                                            {(!NATIONALITY_OPTIONS.includes(student.nationality || "NULL") && student.nationality !== null) ? (
                                                <input
                                                    type="text"
                                                    value={student.nationality || ""}
                                                    onChange={(e) => handleCellEdit(student.cc, "nationality", e.target.value)}
                                                    onBlur={(e) => {
                                                        if (e.target.value === "") handleCellEdit(student.cc, "nationality", null);
                                                    }}
                                                    autoFocus
                                                    className="w-full px-2 py-1.5 bg-white dark:bg-zinc-950 outline-none ring-1 ring-inset ring-zinc-900 border-none rounded-md transition-all truncate"
                                                />
                                            ) : (
                                                <select
                                                    value={student.nationality === null ? "NULL" : (NATIONALITY_OPTIONS.includes(student.nationality) ? student.nationality : "OTHER")}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val === "OTHER") {
                                                            handleCellEdit(student.cc, "nationality", " "); // Space to trigger input mode
                                                        } else {
                                                            handleCellEdit(student.cc, "nationality", val);
                                                        }
                                                    }}
                                                    className="w-full px-2 py-1.5 bg-transparent focus:bg-white dark:bg-zinc-950 outline-none focus:ring-1 focus:ring-inset focus:ring-zinc-900 border-none rounded-md transition-all appearance-none cursor-pointer truncate"
                                                >
                                                    {NATIONALITY_OPTIONS.map(opt => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </td>
                                        <td className="p-1 border-r border-zinc-100">
                                            {(!RELIGION_OPTIONS.includes(student.religion || "NULL") && student.religion !== null) ? (
                                                <input
                                                    type="text"
                                                    value={student.religion || ""}
                                                    onChange={(e) => handleCellEdit(student.cc, "religion", e.target.value)}
                                                    onBlur={(e) => {
                                                        if (e.target.value === "") handleCellEdit(student.cc, "religion", null);
                                                    }}
                                                    autoFocus
                                                    className="w-full px-2 py-1.5 bg-white dark:bg-zinc-950 outline-none ring-1 ring-inset ring-zinc-900 border-none rounded-md transition-all truncate"
                                                />
                                            ) : (
                                                <select
                                                    value={student.religion === null ? "NULL" : (RELIGION_OPTIONS.includes(student.religion) ? student.religion : "OTHER")}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val === "OTHER") {
                                                            handleCellEdit(student.cc, "religion", " ");
                                                        } else {
                                                            handleCellEdit(student.cc, "religion", val);
                                                        }
                                                    }}
                                                    className="w-full px-2 py-1.5 bg-transparent focus:bg-white dark:bg-zinc-950 outline-none focus:ring-1 focus:ring-inset focus:ring-zinc-900 border-none rounded-md transition-all appearance-none cursor-pointer truncate"
                                                >
                                                    {RELIGION_OPTIONS.map(opt => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </td>
                                        <td className="p-1 border-r border-zinc-100">
                                            <input
                                                type="email"
                                                value={student.email || ""}
                                                onChange={(e) => handleCellEdit(student.cc, "email", e.target.value)}
                                                className="w-full px-2 py-1.5 bg-transparent focus:bg-white dark:bg-zinc-950 outline-none focus:ring-1 focus:ring-inset focus:ring-zinc-900 border-none rounded-md transition-all sm:text-zinc-500 dark:text-zinc-400 truncate"
                                                placeholder="email@example.com"
                                            />
                                        </td>
                                        <td className="p-1 border-r border-zinc-100">
                                            <div className="flex border border-zinc-200 dark:border-zinc-800 rounded-md focus-within:ring-1 focus-within:ring-zinc-900 overflow-hidden">
                                                <input
                                                    type="text"
                                                    value={student.primary_phone_country_code || ""}
                                                    onChange={(e) => handleCellEdit(student.cc, "primary_phone_country_code", e.target.value)}
                                                    placeholder="+92"
                                                    className="w-12 flex-shrink-0 px-1.5 py-1.5 bg-zinc-50 dark:bg-zinc-900 border-0 text-zinc-500 dark:text-zinc-400 text-xs outline-none truncate"
                                                />
                                                <input
                                                    type="text"
                                                    value={student.primary_phone || ""}
                                                    onChange={(e) => handleCellEdit(student.cc, "primary_phone", e.target.value)}
                                                    className="flex-1 min-w-0 px-2 py-1.5 bg-transparent border-0 outline-none focus:bg-white dark:bg-zinc-950 transition-all truncate"
                                                    placeholder="Phone"
                                                />
                                            </div>
                                        </td>
                                        <td className="p-1 border-r border-zinc-100">
                                            <div className="flex border border-zinc-200 dark:border-zinc-800 rounded-md focus-within:ring-1 focus-within:ring-zinc-900 overflow-hidden">
                                                <input
                                                    type="text"
                                                    value={student.whatsapp_country_code || ""}
                                                    onChange={(e) => handleCellEdit(student.cc, "whatsapp_country_code", e.target.value)}
                                                    placeholder="+92"
                                                    className="w-12 flex-shrink-0 px-1.5 py-1.5 bg-zinc-50 dark:bg-zinc-900 border-0 text-zinc-500 dark:text-zinc-400 text-xs outline-none truncate"
                                                />
                                                <input
                                                    type="text"
                                                    value={student.whatsapp_number || ""}
                                                    onChange={(e) => handleCellEdit(student.cc, "whatsapp_number", e.target.value)}
                                                    className="flex-1 min-w-0 px-2 py-1.5 bg-transparent border-0 outline-none focus:bg-white dark:bg-zinc-950 transition-all truncate"
                                                    placeholder="WhatsApp"
                                                />
                                            </div>
                                        </td>
                                        <td className="p-1 border-r border-zinc-100">
                                            {(!COUNTRY_OPTIONS.includes(student.country || "NULL") && student.country !== null) ? (
                                                <input
                                                    type="text"
                                                    value={student.country || ""}
                                                    onChange={(e) => handleCellEdit(student.cc, "country", e.target.value)}
                                                    onBlur={(e) => {
                                                        if (e.target.value === "") handleCellEdit(student.cc, "country", null);
                                                    }}
                                                    autoFocus
                                                    className="w-full px-2 py-1.5 bg-white dark:bg-zinc-950 outline-none ring-1 ring-inset ring-zinc-900 border-none rounded-md transition-all truncate"
                                                />
                                            ) : (
                                                <select
                                                    value={student.country === null ? "NULL" : (COUNTRY_OPTIONS.includes(student.country) ? student.country : "OTHER")}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val === "OTHER") {
                                                            handleCellEdit(student.cc, "country", " ");
                                                        } else {
                                                            handleCellEdit(student.cc, "country", val);
                                                        }
                                                    }}
                                                    className="w-full px-2 py-1.5 bg-transparent focus:bg-white dark:bg-zinc-950 outline-none focus:ring-1 focus:ring-inset focus:ring-zinc-900 border-none rounded-md transition-all appearance-none cursor-pointer truncate"
                                                >
                                                    {COUNTRY_OPTIONS.map(opt => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </td>
                                        <td className="p-1 border-r border-zinc-100">
                                            {student.country === "PAKISTAN" ? (
                                                (!PAKISTAN_PROVINCES.includes(student.province || "NULL") && student.province !== null) ? (
                                                    <input
                                                        type="text"
                                                        value={student.province || ""}
                                                        onChange={(e) => handleCellEdit(student.cc, "province", e.target.value)}
                                                        onBlur={(e) => {
                                                            if (e.target.value === "") handleCellEdit(student.cc, "province", null);
                                                        }}
                                                        autoFocus
                                                        className="w-full px-2 py-1.5 bg-white dark:bg-zinc-950 outline-none ring-1 ring-inset ring-zinc-900 border-none rounded-md transition-all truncate"
                                                    />
                                                ) : (
                                                    <select
                                                        value={student.province === null ? "NULL" : (PAKISTAN_PROVINCES.includes(student.province) ? student.province : "OTHER")}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            if (val === "OTHER") {
                                                                handleCellEdit(student.cc, "province", " ");
                                                            } else {
                                                                handleCellEdit(student.cc, "province", val);
                                                            }
                                                        }}
                                                        className="w-full px-2 py-1.5 bg-transparent focus:bg-white dark:bg-zinc-950 outline-none focus:ring-1 focus:ring-inset focus:ring-zinc-900 border-none rounded-md transition-all appearance-none cursor-pointer truncate"
                                                    >
                                                        {PAKISTAN_PROVINCES.map(opt => (
                                                            <option key={opt} value={opt}>{opt}</option>
                                                        ))}
                                                    </select>
                                                )
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={student.province || ""}
                                                    onChange={(e) => handleCellEdit(student.cc, "province", e.target.value)}
                                                    className="w-full px-2 py-1.5 bg-transparent focus:bg-white dark:bg-zinc-950 outline-none focus:ring-1 focus:ring-inset focus:ring-zinc-900 border-none rounded-md transition-all truncate"
                                                    placeholder="Province of Birth"
                                                />
                                            )}
                                        </td>
                                        <td className="p-1 border-r border-zinc-100">
                                            <input
                                                type="text"
                                                value={student.city || ""}
                                                onChange={(e) => handleCellEdit(student.cc, "city", e.target.value)}
                                                className="w-full px-2 py-1.5 bg-transparent focus:bg-white dark:bg-zinc-950 outline-none focus:ring-1 focus:ring-inset focus:ring-zinc-900 border-none rounded-md transition-all truncate"
                                                placeholder="City of Birth"
                                            />
                                        </td>
                                        <td className="p-1 border-r border-zinc-100">
                                            <input
                                                type="text"
                                                value={student.identification_marks || ""}
                                                onChange={(e) => handleCellEdit(student.cc, "identification_marks", e.target.value)}
                                                className="w-full px-2 py-1.5 bg-transparent focus:bg-white dark:bg-zinc-950 outline-none focus:ring-1 focus:ring-inset focus:ring-zinc-900 border-none rounded-md transition-all truncate"
                                                placeholder="ID Marks"
                                            />
                                        </td>
                                        <td className="p-1 border-r border-zinc-100">
                                            <input
                                                type="text"
                                                value={student.medical_info || ""}
                                                onChange={(e) => handleCellEdit(student.cc, "medical_info", e.target.value)}
                                                className="w-full px-2 py-1.5 bg-transparent focus:bg-white dark:bg-zinc-950 outline-none focus:ring-1 focus:ring-inset focus:ring-zinc-900 border-none rounded-md transition-all truncate"
                                                placeholder="Medical Info"
                                            />
                                        </td>
                                        <td className="p-1 border-r border-zinc-100">
                                            <input
                                                type="text"
                                                value={student.interests || ""}
                                                onChange={(e) => handleCellEdit(student.cc, "interests", e.target.value)}
                                                className="w-full px-2 py-1.5 bg-transparent focus:bg-white dark:bg-zinc-950 outline-none focus:ring-1 focus:ring-inset focus:ring-zinc-900 border-none rounded-md transition-all truncate"
                                                placeholder="Interests"
                                            />
                                        </td>
                                        <td className="p-1 border-r border-zinc-100">
                                            <input
                                                type="number"
                                                value={student.admission_age_years || ""}
                                                onChange={(e) => handleCellEdit(student.cc, "admission_age_years", e.target.value ? parseInt(e.target.value) : null)}
                                                className="w-full px-2 py-1.5 bg-transparent focus:bg-white dark:bg-zinc-950 outline-none focus:ring-1 focus:ring-inset focus:ring-zinc-900 border-none rounded-md transition-all truncate"
                                                placeholder="Age"
                                            />
                                        </td>
                                        <td className="p-1 border-r border-zinc-100">
                                            <input
                                                type="text"
                                                value={student.physical_impairment || ""}
                                                onChange={(e) => handleCellEdit(student.cc, "physical_impairment", e.target.value)}
                                                className="w-full px-2 py-1.5 bg-transparent focus:bg-white dark:bg-zinc-950 outline-none focus:ring-1 focus:ring-inset focus:ring-zinc-900 border-none rounded-md transition-all truncate"
                                                placeholder="Impairments"
                                            />
                                        </td>
                                        <td className="p-1 border-r border-zinc-100 text-center">
                                            <button
                                                onClick={() => openGuardianModal(student.cc, student.full_name)}
                                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:text-zinc-100 rounded-lg text-[10px] font-bold transition-all border border-zinc-200 dark:border-zinc-800 shadow-sm whitespace-nowrap active:scale-95"
                                            >
                                                <Heart className="h-3 w-3 text-emerald-500 fill-emerald-500/10" />
                                                Manage
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {isFetchingMore && (
                            <div className="flex items-center justify-center gap-2 py-5 text-zinc-400">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-[11px] font-bold uppercase tracking-widest">Loading more…</span>
                            </div>
                        )}
                        {!hasMore && students.length > 0 && !isLoading && (
                            <div className="flex items-center justify-center py-4">
                                <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">— End of records —</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Footer / Stats */}
                <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center sm:mx-0">
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Live Sync Active
                        </span>
                        <span className="h-4 w-px bg-zinc-200"></span>
                        <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                            {students.length} Records Loaded{hasMore ? " · scroll for more" : ""}
                        </span>
                    </div>
                    <div className="text-[10px] font-medium text-zinc-400 italic">
                        All changes are automatically saved as you type.
                    </div>
                </div>
            </div>

            {/* Modal */}
            <GuardianModal
                isOpen={isGuardianModalOpen}
                onClose={() => setIsGuardianModalOpen(false)}
                studentId={selectedStudentForGuardians?.id || 0}
                studentName={selectedStudentForGuardians?.name || ""}
            />
        </div>
    );
}
