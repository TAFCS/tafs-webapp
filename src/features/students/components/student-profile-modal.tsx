import React, { useState, useEffect } from "react";
import { X, User, MapPin, CreditCard, GraduationCap, LayoutGrid, Hash as Tag, Search, RefreshCw, AlertCircle, ChevronRight } from "lucide-react";
import { StudentListItem } from "../../../store/slices/studentsSlice";
import { familiesService, type Family } from "@/lib/families.service";
import { studentsService } from "@/lib/students.service";
import { useDebounce } from "@/hooks/use-debounce";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "../../../store/store";
import { fetchClasses } from "../../../store/slices/classesSlice";

interface StudentProfileModalProps {
    studentId?: number | string | null;
    student?: StudentListItem | null; // For direct display from registration success
    onClose: () => void;
    onUpdate?: (student?: StudentListItem) => void;
    onSelectStudent?: (id: number) => void;
}

export function StudentProfileModal({ studentId, student: initialStudent, onClose, onUpdate, onSelectStudent }: StudentProfileModalProps) {
    const router = useRouter();
    const dispatch = useDispatch<AppDispatch>();
    const { items: classes } = useSelector((state: RootState) => state.classes);
    const [student, setStudent] = useState<StudentListItem | null>(initialStudent || null);

    useEffect(() => {
        if (classes.length === 0) {
            dispatch(fetchClasses());
        }
    }, [dispatch, classes.length]);
    const [isLoading, setIsLoading] = useState(false);
    const [isChangeFamilyOpen, setIsChangeFamilyOpen] = useState(false);
    const [isInitializingFamily, setIsInitializingFamily] = useState(false);

    const handleInitializeFamily = async () => {
        const sid = Number(student?.cc || student?.cc_number || student?.registration_number || 0);
        if (!sid) {
            toast.error("Could not find student ID");
            return;
        }

        setIsInitializingFamily(true);
        try {
            await familiesService.initializeFromStudent(sid);
            toast.success("Household initialized successfully");
            // Await the full refresh before hiding the loader to ensure UI doesn't flicker/stay stale
            await loadStudent();
            onUpdate?.();
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to initialize household");
            console.error(err);
        } finally {
            setIsInitializingFamily(false);
        }
    };

    const loadStudent = async () => {
        const sid = studentId || student?.cc || student?.cc_number || student?.registration_number;
        if (!sid) return;
        setIsLoading(true);
        try {
            const data = await studentsService.getById(Number(sid));
            setStudent(data);
            if (data) {
                onUpdate?.(data);
            }
        } catch (err) {
            toast.error("Failed to load student details");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Clear current student to show loading state when switching profiles
        setStudent(null);
        loadStudent();
    }, [studentId]);

    if (!studentId && !initialStudent) return null;

    if (isLoading && !student) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="bg-white dark:bg-zinc-950 p-8 rounded-2xl shadow-xl flex items-center gap-4">
                    <RefreshCw className="h-6 w-6 animate-spin text-indigo-500" />
                    <p className="font-bold text-zinc-900 dark:text-zinc-100">Loading profile...</p>
                </div>
            </div>
        );
    }

    if (!student) return null;

    const statusStyles: Record<string, string> = {
        Cleared: "bg-emerald-100 text-emerald-800 border-emerald-200",
        Overdue: "bg-rose-100 text-rose-800 border-rose-200",
        Partial: "bg-amber-100 text-amber-800 border-amber-200",
        NO_SCHEDULE: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800",
    };

    const estatusStyles: Record<string, string> = {
        ENROLLED: "bg-emerald-100 text-emerald-800 border-emerald-200",
        SOFT_ADMISSION: "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800",
        GRADUATED: "bg-blue-100 text-blue-800 border-blue-200",
        EXPELLED: "bg-rose-100 text-rose-800 border-rose-200 line-through decoration-rose-400",
    };


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header (Premium Gradient) */}
                <div className="relative h-32 bg-gradient-to-r from-blue-600 to-indigo-700 p-6 flex items-end">


                    <div className="absolute -bottom-12 left-8 h-24 w-24 bg-white dark:bg-zinc-950 rounded-2xl p-1 shadow-lg border border-zinc-100 overflow-hidden">
                        <StudentAvatar
                            url={student.photograph_url}
                            name={student.student_full_name}
                        />
                    </div>
                </div>

                {/* Main Body (Scrollable) */}
                <div className="flex-1 overflow-y-auto w-full">
                    <div className="p-8 pt-16 grid grid-cols-1 lg:grid-cols-3 gap-8">


                        {/* Profile Summary (Left side) */}
                        <div className="flex flex-col gap-6 lg:col-span-1">
                            <div>
                                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight uppercase">{student.student_full_name}</h2>
                                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-1">
                                    {student.gr_number ? `${student.gr_number} GR` : "N/A GR"} • {student.cc_number ? `${student.cc_number} CC` : "N/A CC"}
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-full border ${estatusStyles[student.enrollment_status || ''] || 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800'}`}>
                                    {(student.enrollment_status || 'N/A').replace('_', ' ')} Student
                                </span>
                                <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${statusStyles[student.financial_status_badge || 'Cleared'] || statusStyles.Cleared}`}>
                                    Fee: {student.financial_status_badge === 'NO_SCHEDULE' ? 'No Schedule Set' : (student.financial_status_badge || 'Pending...')}
                                </span>
                                {student.student_flags && student.student_flags.some(f => f.flag.includes('fast_track')) && (
                                    <span className="px-2.5 py-1 text-[10px] font-black uppercase rounded-full bg-amber-100 text-amber-700 border border-amber-200 tracking-widest animate-pulse">
                                        Fast Track Active
                                    </span>
                                )}
                            </div>

                            <div className="w-full h-px bg-zinc-100 dark:bg-zinc-800 my-2"></div>

                            <div className="flex flex-col gap-4">
                                <InfoItem icon={<LayoutGrid />} label="Campus" value={student.campus || "N/A"} />
                                <InfoItem
                                    icon={<GraduationCap className="h-4 w-4" />}
                                    label="Grade & Section"
                                    value={(() => {
                                        if (student.enrollment_status === 'ENROLLED' && student.grade_and_section) return student.grade_and_section;
                                        const val = student.grade_and_section;
                                        if (!val) return "N/A";
                                        const match = classes.find(c => c.class_code === val || c.description === val);
                                        return match ? match.description : val;
                                    })()}
                                />
                                <InfoItem icon={<Tag />} label="House" value={student.house_and_color || "N/A"} />
                            </div>

                            {/* Siblings Section */}
                            <div className="mt-4">
                                <div className="w-full h-px bg-zinc-100 dark:bg-zinc-800 my-4"></div>

                                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-1 flex items-center gap-2">
                                    <User className="h-3 w-3 text-indigo-500" /> Sibling / Family Members
                                </h3>
                                {student.household_name ? (
                                    <div className="mb-3 flex items-start justify-between gap-2">
                                        <div>
                                            <p className="text-[11px] font-bold text-indigo-600 italic">
                                                {student.household_name}&apos;s Family
                                            </p>
                                            <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">
                                                Family ID: {student.family_id || "N/A"}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setIsChangeFamilyOpen(true)}
                                            className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors"
                                        >
                                            <RefreshCw className="h-2.5 w-2.5" />
                                            Change
                                        </button>
                                    </div>
                                ) : (
                                    <div className="mb-3 flex items-center justify-between gap-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 rounded-xl p-3">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 bg-amber-500 rounded-full animate-pulse" />
                                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight">No Household Assigned</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setIsChangeFamilyOpen(true)}
                                                className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-all"
                                            >
                                                Link Existing
                                            </button>
                                            <button
                                                onClick={handleInitializeFamily}
                                                disabled={isInitializingFamily}
                                                className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm flex items-center gap-1.5"
                                            >
                                                {isInitializingFamily ? <RefreshCw className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />}
                                                Create New
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Potential Match Suggestion - Stacked beneath the household div */}
                                {student.potential_family_match && (
                                    <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl animate-in slide-in-from-top-1 duration-300">
                                        <div className="flex items-start gap-2.5">
                                            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <p className="text-[10px] font-black uppercase tracking-tight text-amber-800 dark:text-amber-200 leading-none">Potential Sibling Match</p>
                                                <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-1.5">
                                                    Father linked to <span className="font-bold">{student.potential_family_match.household_name}</span>.
                                                </p>
                                                <button
                                                    onClick={async () => {
                                                        const match = student.potential_family_match;
                                                        if (!match) return;
                                                        try {
                                                            setIsInitializingFamily(true);
                                                            await familiesService.assignChild(match.id, Number(student.cc));
                                                            toast.success("Linked to existing household");
                                                            await loadStudent();
                                                            onUpdate?.();
                                                        } catch (err: any) {
                                                            toast.error(err.response?.data?.message || "Failed to link");
                                                        } finally {
                                                            setIsInitializingFamily(false);
                                                        }
                                                    }}
                                                    disabled={isInitializingFamily}
                                                    className="mt-2.5 w-full py-1.5 text-[9px] font-black uppercase tracking-wider bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-sm"
                                                >
                                                    Link to this Household
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {student.siblings && student.siblings.length > 0 ? (
                                    <div className="space-y-3">
                                        {student.siblings.map((sibling, index) => (
                                            <div
                                                key={sibling.cc || `sib-${index}`}
                                                onClick={() => onSelectStudent?.(sibling.id || (sibling as any).cc)}
                                                className="flex items-center justify-between p-3 bg-indigo-50/50 border border-indigo-100/50 rounded-xl group transition-all hover:bg-indigo-50 hover:border-indigo-200 cursor-pointer"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-lg bg-white dark:bg-zinc-950 flex items-center justify-center text-indigo-500 shadow-sm group-hover:scale-110 transition-transform">
                                                        <User className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 leading-none uppercase group-hover:text-indigo-600 transition-colors">{sibling.full_name}</p>
                                                        {sibling.father_name && (
                                                            <p className="text-[9px] text-indigo-600 font-bold mt-1 uppercase tracking-tight">S/O: {sibling.father_name.toUpperCase()}</p>
                                                        )}
                                                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium mt-1 uppercase tracking-tight">
                                                            {sibling.cc_number} CC • {sibling.gr_number || 'N/A'} GR • {sibling.grade || 'N/A Grade'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-indigo-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 rounded-xl">
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center italic">No other siblings linked to this family yet.</p>
                                    </div>
                                )}
                            </div>


                        </div>

                        {/* Detailed Tabs/Grid (Right side) */}
                        <div className="lg:col-span-2 space-y-8">

                            {/* Personal Info Box */}
                            <div className="bg-zinc-50 dark:bg-zinc-900/50 border rounded-xl p-5">
                                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 border-b pb-2 flex items-center gap-2">
                                    <User className="h-4 w-4 text-primary" /> Personal Information
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 gap-y-6">
                                    <DataPoint label="Date of Birth" value={student.date_of_birth?.toString() || ""} />
                                    <DataPoint label="Computer Code" value={student.registration_number?.toString() || ""} />
                                    <DataPoint label="Primary Guardian" value={student.primary_guardian_name?.toString() || ""} />
                                    <DataPoint label="Father's Name" value={student.father_name?.toString() || ""} />
                                    <DataPoint label="Guardian CNIC" value={student.primary_guardian_cnic?.toString() || ""} />
                                    <DataPoint label="WhatsApp Number" value={student.whatsapp_number?.toString() || ""} />
                                    <DataPoint label="Family / Household ID" value={student.family_id?.toString() || ""} />
                                    <DataPoint label="Household Name" value={student.household_name || ""} />
                                    <DataPoint label="Family Home Phone" value={student.home_phone || ""} />
                                </div>
                            </div>

                            {/* Contact & Address */}
                            <div className="bg-zinc-50 dark:bg-zinc-900/50 border rounded-xl p-5">
                                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 border-b pb-2 flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-emerald-500" /> Location Details
                                </h3>
                                <div className="grid grid-cols-1 gap-4">
                                    <DataPoint label="Residential Address" value={student.residential_address?.toString() || ""} />
                                </div>
                            </div>

                            {/* Financial Summary */}
                            <div className="bg-zinc-50 dark:bg-zinc-900/50 border rounded-xl p-5 relative overflow-hidden">
                                {(() => {
                                    const effectiveClassId = student.class_id ||
                                        classes.find(c =>
                                            c.class_code === student.grade_and_section ||
                                            c.description === student.grade_and_section
                                        )?.id;

                                    if (!effectiveClassId) return null;

                                    return (
                                        <div className="absolute top-4 right-4 z-10">
                                            <button
                                                onClick={() => {
                                                    router.push(`/studentwise-fees?ccNumber=${student.cc_number}&classId=${effectiveClassId}`);
                                                    onClose();
                                                }}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all shadow-sm group"
                                            >
                                                <CreditCard className="h-3 w-3 group-hover:scale-110 transition-transform" />
                                                Setup Fee Schedule
                                            </button>
                                        </div>
                                    );
                                })()}

                                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 border-b pb-2 flex items-center gap-2">
                                    <CreditCard className="h-4 w-4 text-rose-500" /> Financial Overview
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white dark:bg-zinc-950 border rounded-lg p-4">
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Outstanding Balance</p>
                                        <p className={`text-xl font-bold mt-1 ${(student.total_outstanding_balance ?? 0) > 0 ? "text-rose-600" : "text-zinc-900 dark:text-zinc-100"}`}>
                                            Rs. {(student.total_outstanding_balance ?? 0).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="bg-white dark:bg-zinc-950 border rounded-lg p-4">
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Advance Credit</p>
                                        <p className={`text-xl font-bold mt-1 ${(student.advance_credit_balance ?? 0) > 0 ? "text-emerald-600" : "text-zinc-900 dark:text-zinc-100"}`}>
                                            Rs. {(student.advance_credit_balance ?? 0).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>

                        </div>

                    </div>
                </div>

                {/* Consolidated ChangeFamilyModal sits below the main layout */}
                {isChangeFamilyOpen && (
                    <ChangeFamilyModal
                        studentId={Number(student.cc || student.cc_number || student.registration_number || student.id || 0)}
                        studentName={student.student_full_name || student.full_name || ""}
                        currentFamilyId={student.family_id}
                        onClose={() => setIsChangeFamilyOpen(false)}
                        onSuccess={() => {
                            setIsChangeFamilyOpen(false);
                            // Always reload student data on success to keep local state in sync with backend
                            loadStudent();
                            onUpdate?.();
                        }}
                    />
                )}

                {/* Footer Actions */}
                <div className="bg-zinc-50 dark:bg-zinc-900 p-4 border-t flex justify-end items-center gap-3 flex-shrink-0">
                    {!student.family_id ? (
                        <button
                            onClick={handleInitializeFamily}
                            disabled={isInitializingFamily}
                            className="flex items-center gap-2 px-5 h-10 text-[12px] font-bold uppercase tracking-wide rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100 disabled:opacity-50"
                        >
                            {isInitializingFamily ? <RefreshCw className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                            Create New Family & Save
                        </button>
                    ) : (
                        <button
                            onClick={onClose}
                            className="px-5 h-10 text-[13px] font-bold text-zinc-500 hover:text-zinc-800 transition-colors"
                        >
                            Close
                        </button>
                    )}
                    <button
                        onClick={() => {
                            const sid = Number(student.cc || student.cc_number || student.registration_number || 0);
                            router.push(`/identity/students?cc=${sid}`);
                            onClose();
                        }}
                        className="flex items-center justify-center px-6 h-10 bg-primary text-white text-[13px] font-bold rounded-xl hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
                    >
                        Edit Profile
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Sub-Components ───────────────────────────────────────────────────────────
function StudentAvatar({ url, name }: { url?: string | null; name: string }) {
    const [imgError, setImgError] = useState(false);

    // Reset error state when URL changes
    useEffect(() => {
        setImgError(false);
    }, [url]);

    const sanitizedUrl = url?.replace(/([^:])\/\//g, '$1/');
    // Proxy the URL through our backend to bypass potential CORS/access issues for the browser
    const proxiedUrl = sanitizedUrl ? `/api/v1/media/proxy?url=${encodeURIComponent(sanitizedUrl)}` : null;

    return (
        <div className="h-full w-full bg-blue-50 rounded-xl flex items-center justify-center text-blue-500 overflow-hidden relative">
            {proxiedUrl && !imgError ? (
                <img
                    src={proxiedUrl}
                    alt={name}
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                />
            ) : (
                <User className="h-10 w-10" />
            )}
        </div>
    );
}

export interface ChangeFamilyModalProps {
    studentId: number;
    studentName: string;
    currentFamilyId: number | null;
    onClose: () => void;
    onSuccess: () => void;
}

export function ChangeFamilyModal({ studentId, studentName, currentFamilyId, onClose, onSuccess }: ChangeFamilyModalProps) {
    const [searchQ, setSearchQ] = useState("");
    const debouncedSearch = useDebounce(searchQ, 350);
    const [results, setResults] = useState<Family[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedFamily, setSelectedFamily] = useState<Family | null>(null);
    const [isAssigning, setIsAssigning] = useState(false);

    useEffect(() => {
        if (!debouncedSearch || debouncedSearch.length < 2) {
            setResults([]);
            return;
        }

        setIsLoading(true);
        familiesService.list({ search: debouncedSearch, limit: 6 })
            .then(res => setResults(res.data))
            .finally(() => setIsLoading(false));
    }, [debouncedSearch]);

    const handleAssign = async () => {
        if (!selectedFamily) return;
        
        const sid = Number(studentId);
        if (!sid || sid <= 0) {
            toast.error("Invalid student ID. Please try again.");
            console.error("Assign Error: Invalid studentId", studentId);
            return;
        }

        setIsAssigning(true);
        try {
            console.log(`Assigning student ${sid} to family ${selectedFamily.id}`);
            await familiesService.assignChild(selectedFamily.id, sid);
            toast.success("Family updated successfully");
            onSuccess(); 
            onClose();
        } catch (err) {
            toast.error("Failed to update family");
            console.error(err);
        } finally {
            setIsAssigning(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
                    <div>
                        <h3 className="font-bold text-zinc-900 dark:text-zinc-100">Change Family</h3>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Reassigning: {studentName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-200 rounded-full transition-colors">
                        <X className="h-4 w-4 text-zinc-400" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="relative">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isLoading ? 'text-indigo-500 animate-pulse' : 'text-zinc-400'}`} />
                        <input
                            autoFocus
                            type="text"
                            placeholder="Search Household, Sibling CC/GR, or CNIC..."
                            className="w-full pl-9 pr-4 py-2.5 text-sm border-zinc-200 dark:border-zinc-800 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                            value={searchQ}
                            onChange={(e) => setSearchQ(e.target.value)}
                        />
                    </div>

                    <div className="space-y-1 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                        {results.length > 0 ? (
                            results.map(family => (
                                <button
                                    key={family.id}
                                    onClick={() => setSelectedFamily(family)}
                                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between group ${selectedFamily?.id === family.id
                                        ? "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200"
                                        : family.id === currentFamilyId
                                            ? "bg-zinc-50 dark:bg-zinc-900 border-zinc-100 opacity-60 cursor-not-allowed"
                                            : "hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900 border-transparent hover:border-zinc-200 dark:border-zinc-800"
                                        }`}
                                    disabled={family.id === currentFamilyId}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs ${selectedFamily?.id === family.id ? "bg-indigo-500 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                                            }`}>
                                            {family.household_name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 transition-colors">
                                                {family.household_name}
                                            </p>
                                            <div className="flex flex-col gap-0.5 mt-0.5">
                                                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1.5">
                                                    <span className="opacity-70">ID: #{family.id}</span>
                                                    {family.legacy_pid && <span className="px-1 bg-zinc-100 dark:bg-zinc-800 rounded text-[9px]">PID: {family.legacy_pid}</span>}
                                                </p>
                                                {family.primary_guardian && (
                                                    <p className="text-[10px] font-bold text-indigo-600/80 bg-indigo-50/50 px-1.5 py-0.5 rounded-md self-start mt-1">
                                                        {family.primary_guardian.name} {family.primary_guardian.cnic ? `(${family.primary_guardian.cnic})` : ""}
                                                    </p>
                                                )}
                                                {family.students && family.students.length > 0 && (
                                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                                        {family.students.map((s, index) => (
                                                            <span key={s.cc || `stu-${index}`} className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-[9px] font-bold text-zinc-600 dark:text-zinc-400 rounded-md uppercase tracking-tight">
                                                                {s.full_name} ({s.cc})
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {family.id === currentFamilyId && (
                                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">Current</span>
                                    )}
                                    {selectedFamily?.id === family.id && (
                                        <ChevronRight className="h-4 w-4 text-indigo-500" />
                                    )}
                                </button>
                            ))
                        ) : debouncedSearch.length >= 2 && !isLoading ? (
                            <div className="py-8 text-center bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                                <AlertCircle className="h-6 w-6 text-zinc-300 mx-auto mb-2" />
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">No households found</p>
                            </div>
                        ) : (
                            <p className="text-[10px] text-zinc-400 text-center py-4 italic">Type to search for a new family...</p>
                        )}
                    </div>
                </div>

                <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 border-t flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:text-zinc-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        disabled={!selectedFamily || isAssigning}
                        onClick={handleAssign}
                        className="px-6 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-200/50 flex items-center gap-2"
                    >
                        {isAssigning ? (
                            <>
                                <RefreshCw className="h-3 w-3 animate-spin" />
                                Updating...
                            </>
                        ) : (
                            "Confirm Reassign"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                {icon}
            </div>
            <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">{label}</p>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase">{value}</p>
            </div>
        </div>
    );
}

function DataPoint({ label, value }: { label: string, value: string }) {
    return (
        <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-1">{label}</p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase">{value || "N/A"}</p>
        </div>
    );
}
