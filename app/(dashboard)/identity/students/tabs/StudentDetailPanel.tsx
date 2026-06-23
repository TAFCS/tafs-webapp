"use client";
import { useState, useEffect, useCallback } from "react";
import { X, Loader2, User, BookOpen, GraduationCap, Shield, FileText, RotateCcw, History, ShieldAlert, DoorOpen, Ban, ChevronDown, Layers, Hash, Sparkles, UserCheck, CheckCircle, Printer, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { IdentityTab } from "./IdentityTab";
import { AdmissionsTab } from "./AdmissionsTab";
import { ClassGradeTab } from "./ClassGradeTab";
import type { CampusItem } from "@/src/store/slices/campusesSlice";
import { AcademicTab } from "./AcademicTab";
import { GuardiansTab } from "./GuardiansTab";
import { LifecycleActionModal } from "./LifecycleActionModal";
import { AdmissionOrderTab } from "./AdmissionOrderTab";
import { TransferOrderTab } from "./TransferOrderTab";
import { StudentLogsTab } from "./StudentLogsTab";
import { DangerZoneTab } from "./DangerZoneTab";

interface Suggestions {
    suggested_gr: string;
    suggested_house: number | null;
    suggested_section: number | null;
    min_gr: string | null;
    all_houses: Array<{ id: number; house_name: string; house_color: string }>;
    available_sections: Array<{ id: number; description: string }>;
    alevel_analysis?: {
        subjects: Array<{ name: string; code: string }>;
        scienceCount: number;
        commerceCount: number;
    } | null;
}

const getGRPrefix = (campusName: string | undefined, academicSystem?: string) => {
    const isALevel = academicSystem?.toLowerCase().replace(/[^a-z]/g, '') === 'alevel';
    if (isALevel) return "A-";
    if (!campusName) return "";
    const name = campusName.toUpperCase();
    if (name.includes("KANEEZ FATIMA")) return "KF-A";
    if (name.includes("NORTH NAZIMABAD")) return "A-N";
    return "";
};

const TABS = [
    { id: "identity",   label: "Identity",   icon: User },
    { id: "class_grade", label: "Class Grade", icon: Layers },
    { id: "admissions", label: "Admissions",  icon: BookOpen },
    { id: "academic",   label: "Academic",    icon: GraduationCap },
    { id: "guardians",  label: "Guardians",   icon: Shield },
    { id: "logs",       label: "Logs",        icon: History },
] as const;

type TabId = typeof TABS[number]["id"] | "admission_order" | "transfer_order" | "danger_zone";

interface Props {
    cc: number | null;
    onClose: () => void;
    onSwitchStudent?: (cc: number) => void;
    classes?: any[];
    sections?: { id: number; description: string }[];
    campuses?: CampusItem[];
    onUpdated?: () => void;
}

export function StudentDetailPanel({ cc, onClose, onSwitchStudent, classes = [], sections = [], campuses = [], onUpdated }: Props) {
    const [student, setStudent] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [lifecycleModal, setLifecycleModal] = useState<{ open: boolean; targetStatus: string; label: string }>({
        open: false,
        targetStatus: '',
        label: '',
    });
    const [tab, setTab] = useState<TabId>("identity");

    // Enrollment modal state (shown when changing status to ENROLLED)
    const [enrollModal, setEnrollModal] = useState(false);
    const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
    const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
    const [finalGr, setFinalGr] = useState("");
    const [finalHouseId, setFinalHouseId] = useState<number | "">("");
    const [finalSectionId, setFinalSectionId] = useState<number | "">("");
    const [isEnrolling, setIsEnrolling] = useState(false);
    const [showEnrollSuccess, setShowEnrollSuccess] = useState(false);
    const [enrolledReport, setEnrolledReport] = useState<any>(null);

    const reload = useCallback(async (refreshBackground = false) => {
        if (!cc) return;
        setLoading(true);
        try {
            const { data } = await api.get(`/v1/staff-editing/students/${cc}`);
            setStudent(data?.data || null);
            if (refreshBackground) onUpdated?.();
        } catch { setStudent(null); }
        finally { setLoading(false); }
    }, [cc, onUpdated]);

    useEffect(() => {
        setStudent(null);
        setTab("identity");
        reload();
    }, [cc, reload]);

    const isSoft = (student?.status || "").toUpperCase() === "SOFT_ADMISSION";

    // Statuses that need a reason modal before applying
    const NEEDS_MODAL = new Set(['GRADUATED', 'EXPELLED', 'LEFT']);

    // GR prefix enforcement for enrollment modal
    useEffect(() => {
        if (!enrollModal || !student) return;
        const prefix = getGRPrefix(
            student.campuses?.campus_name,
            student.student_admissions?.[0]?.academic_system
        );
        if (prefix && finalGr && !finalGr.startsWith(prefix)) {
            setFinalGr(prefix + finalGr.replace(prefix, ""));
        }
    }, [enrollModal, student, finalGr]);

    const handleStartEnroll = async () => {
        if (!cc) return;
        setEnrollModal(true);
        setIsFetchingSuggestions(true);
        setSuggestions(null);
        try {
            const { data } = await api.get(`/v1/enrollments/${cc}/suggestions`);
            const res = data.data || data;
            setSuggestions(res);
            setFinalGr(res.suggested_gr);
            setFinalHouseId(res.suggested_house || "");
            setFinalSectionId(res.suggested_section || "");
        } catch {
            toast.error("Failed to fetch enrollment suggestions");
            setEnrollModal(false);
        } finally {
            setIsFetchingSuggestions(false);
        }
    };

    const handleEnrollSectionChange = async (sectionId: number | "") => {
        if (!cc) return;
        setFinalSectionId(sectionId);
        try {
            const { data } = await api.get(`/v1/enrollments/${cc}/suggestions`, {
                params: { section_id: sectionId || undefined },
            });
            const res = data.data || data;
            setSuggestions(res);
            if (res.suggested_house) setFinalHouseId(res.suggested_house);
        } catch {
            // silent – suggestions are advisory
        }
    };

    const handleConfirmEnroll = async () => {
        if (!cc || !finalGr || !finalHouseId) {
            toast.error("Please provide GR number and House");
            return;
        }
        setIsEnrolling(true);
        try {
            const { data } = await api.post(`/v1/enrollments/${cc}/enroll`, {
                gr_number: finalGr,
                house_id: Number(finalHouseId),
                section_id: finalSectionId ? Number(finalSectionId) : undefined,
            });
            const res = data.data || data;
            setEnrolledReport(res);
            setEnrollModal(false);
            setShowEnrollSuccess(true);
            await reload();
            onUpdated?.();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Enrollment failed. Please try again.");
        } finally {
            setIsEnrolling(false);
        }
    };

    const handleStatusChange = (targetStatus: string) => {
        if (!cc || !student) return;
        if (targetStatus === 'ENROLLED') {
            handleStartEnroll();
            return;
        }
        if (NEEDS_MODAL.has(targetStatus)) {
            const labelMap: Record<string, string> = {
                GRADUATED: 'Graduate',
                EXPELLED: 'Expel',
                LEFT: 'Mark as Left',
            };
            setLifecycleModal({ open: true, targetStatus, label: labelMap[targetStatus] || targetStatus });
        } else {
            applyStatusChange(targetStatus, undefined);
        }
    };

    const applyStatusChange = async (targetStatus: string, reason: string | undefined) => {
        if (!cc) return;
        setActionLoading(targetStatus);
        try {
            await api.patch(`/v1/students/${cc}/status`, {
                status: targetStatus,
                reason: reason?.trim() || undefined,
            });
            await reload();
            onUpdated?.();
            setLifecycleModal(prev => ({ ...prev, open: false }));
        } catch (error: any) {
            const message = error?.response?.data?.message || `Failed to change student status.`;
            window.alert(message);
            throw error;
        } finally {
            setActionLoading(null);
        }
    };

    const confirmLifecycleAction = async (reason: string) => {
        await applyStatusChange(lifecycleModal.targetStatus, reason);
    };

    if (!cc) return null;

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div 
                className="w-full max-w-6xl h-[88vh] bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
                    <div>
                        {student ? (
                            <>
                                <h2 className="text-[18px] font-black text-zinc-900 dark:text-zinc-100 tracking-tight">{student.full_name}</h2>
                                <p className="text-[11px] text-zinc-400 font-mono mt-0.5">CC {student.cc} {student.gr_number ? `· GR ${student.gr_number}` : ""}{student.section_name ? ` · Sec ${student.section_name}` : ""}</p>
                            </>
                        ) : (
                            <div className="space-y-1.5">
                                <div className="h-4 w-40 bg-zinc-100 rounded animate-pulse" />
                                <div className="h-3 w-24 bg-zinc-100 rounded animate-pulse" />
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {student && (
                            <div className="flex items-center bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-xl p-0.5 mr-2">
                                {!isSoft && (
                                    <>
                                        <button
                                            onClick={() => setTab("admission_order")}
                                            className={`flex items-center gap-1.5 px-2.5 h-8 rounded-xl transition-all ${tab === "admission_order" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-indigo-400 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-600 border border-indigo-100/50"}`}
                                            title="Admission Order"
                                        >
                                            <FileText className="h-3.5 w-3.5" />
                                            <span className="text-[10px] font-black uppercase tracking-tighter whitespace-nowrap">Admission Order</span>
                                        </button>
                                        <div className="w-[1px] h-3 bg-zinc-200 mx-0.5" />
                                    </>
                                )}
                                {(student.has_transfer || (student.admissions && student.admissions.length > 1)) && (
                                    <>
                                        <button
                                            onClick={() => setTab("transfer_order")}
                                            className={`flex items-center gap-1.5 px-2.5 h-8 rounded-xl transition-all ${tab === "transfer_order" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100" : "text-emerald-400 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-600 border border-emerald-100/50"}`}
                                            title="Transfer Order"
                                        >
                                            <FileText className="h-3.5 w-3.5" />
                                            <span className="text-[10px] font-black uppercase tracking-tighter whitespace-nowrap">Transfer Order</span>
                                        </button>
                                        <div className="w-[1px] h-3 bg-zinc-200 mx-0.5" />
                                    </>
                                )}
                                <button
                                    onClick={() => setTab("danger_zone")}
                                    className={`flex items-center gap-1.5 px-2.5 h-8 rounded-xl transition-all ${tab === "danger_zone" ? "bg-rose-600 text-white shadow-lg shadow-rose-200" : "text-rose-400 bg-rose-50 hover:bg-rose-100 hover:text-rose-600 border border-rose-100/50"}`}
                                    title="Deletion Zone"
                                >
                                    <ShieldAlert className="h-3.5 w-3.5" />
                                    <span className="text-[10px] font-black uppercase tracking-tighter">Deletion</span>
                                </button>
                            </div>
                        )}
                        {student && (
                            <div className="relative group mr-2">
                                <StatusDropdown
                                    status={student.status}
                                    loading={!!actionLoading}
                                    onAction={handleStatusChange}
                                />
                            </div>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-zinc-600"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div className="flex items-center px-6 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 overflow-x-auto">
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex items-center gap-2 px-4 py-3.5 text-[13px] font-bold transition-all border-b-2 -mb-[1px] ${tab === t.id ? "border-indigo-600 text-indigo-600" : "border-transparent text-zinc-400 hover:text-zinc-600"}`}
                        >
                            <t.icon className="h-4 w-4" />
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto bg-zinc-50/50 dark:bg-zinc-950/20">
                    <div className="p-6">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
                                <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest mt-4">Initializing Data Matrix...</p>
                            </div>
                        ) : student ? (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                {tab === "identity" && <IdentityTab student={student} onReload={() => reload(true)} />}
                                {tab === "class_grade" && (
                                    <ClassGradeTab
                                        student={student}
                                        classes={classes}
                                        sections={sections}
                                        campuses={campuses}
                                        onReload={() => reload(true)}
                                    />
                                )}
                                {tab === "admissions" && <AdmissionsTab student={student} onReload={() => reload(true)} classes={classes} />}
                                {tab === "academic" && <AcademicTab student={student} onReload={() => reload(true)} />}
                                {tab === "guardians" && <GuardiansTab student={student} onReload={() => reload(true)} onSwitchStudent={onSwitchStudent} />}
                                {tab === "admission_order" && <AdmissionOrderTab cc={student.cc} />}
                                {tab === "transfer_order" && <TransferOrderTab cc={student.cc} />}
                                {tab === "logs" && <StudentLogsTab studentId={student.cc} />}
                                {tab === "danger_zone" && <DangerZoneTab student={student} />}
                            </div>
                        ) : (
                            <div className="text-center py-20">
                                <p className="text-zinc-400">Unable to load student profile.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Enrollment Suggestion Modal */}
            <AnimatePresence>
                {enrollModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setEnrollModal(false)}
                            className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.95 }}
                            className="relative w-full max-w-lg bg-white dark:bg-zinc-950 rounded-[40px] shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
                            onClick={e => e.stopPropagation()}
                        >
                            <button
                                onClick={() => setEnrollModal(false)}
                                className="absolute top-6 right-6 p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-all"
                            >
                                <X className="h-6 w-6" />
                            </button>

                            {isFetchingSuggestions ? (
                                <div className="p-20 flex flex-col items-center justify-center">
                                    <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                                    <p className="text-zinc-500 font-bold">Computing Suggestions...</p>
                                </div>
                            ) : (
                                <div className="p-10">
                                    <div className="mb-8">
                                        <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">Finalize Enrollment</h2>
                                        <p className="text-zinc-500 dark:text-zinc-400 font-medium">For {student?.full_name}</p>

                                        {suggestions?.alevel_analysis && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                className="mt-6 bg-zinc-50/50 dark:bg-zinc-900/30 rounded-[30px] border border-zinc-200/50 dark:border-zinc-800/50 overflow-hidden"
                                            >
                                                <div className="p-5 flex flex-col md:flex-row gap-6">
                                                    <div className="flex-1 space-y-3">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <BookOpen className="h-3.5 w-3.5 text-primary" />
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Subject Selection</span>
                                                        </div>
                                                        <div className="grid grid-cols-1 gap-2">
                                                            {suggestions.alevel_analysis.subjects.map(sub => {
                                                                const isScience = ['9700', '9701', '9702', '9618'].includes(sub.code);
                                                                const isCommerce = ['9706', '9707', '9708'].includes(sub.code);
                                                                return (
                                                                    <div key={sub.code} className="flex items-center justify-between px-3 py-2 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-900 shadow-sm">
                                                                        <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">{sub.name}</span>
                                                                        {isScience && <span className="text-[8px] font-black px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-md">SCIENCE</span>}
                                                                        {isCommerce && <span className="text-[8px] font-black px-1.5 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-500 rounded-md">COMMERCE</span>}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                    <div className="w-full md:w-32 flex flex-col justify-center items-center text-center p-4 bg-primary/5 rounded-2xl border border-primary/10">
                                                        <div className="text-[24px] font-black text-primary leading-none mb-1">
                                                            {suggestions.alevel_analysis.scienceCount}:{suggestions.alevel_analysis.commerceCount}
                                                        </div>
                                                        <div className="text-[9px] font-black text-zinc-400 uppercase tracking-tighter mb-3">Majority Split</div>
                                                        <div className="h-px w-full bg-primary/10 mb-3" />
                                                        <div className={`text-[10px] font-black uppercase tracking-widest ${suggestions.alevel_analysis.scienceCount > suggestions.alevel_analysis.commerceCount ? 'text-blue-500' : 'text-green-500'}`}>
                                                            {suggestions.alevel_analysis.scienceCount > suggestions.alevel_analysis.commerceCount ? 'SCIENCE' : 'COMMERCE'}
                                                        </div>
                                                        <div className="text-[8px] font-bold text-zinc-400">Wins Rule</div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </div>

                                    <div className="space-y-6">
                                        {/* GR Number */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between ml-1">
                                                <label className="text-xs font-black uppercase tracking-wider text-zinc-500">Assigned GR Number</label>
                                                <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-full">Recommended</span>
                                            </div>
                                            <div className="relative">
                                                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                                                <input
                                                    type="text"
                                                    value={finalGr}
                                                    onChange={(e) => {
                                                        const val = e.target.value.toUpperCase();
                                                        const prefix = getGRPrefix(
                                                            student?.campuses?.campus_name,
                                                            student?.student_admissions?.[0]?.academic_system
                                                        );
                                                        if (prefix && val !== "" && !val.startsWith(prefix)) return;
                                                        setFinalGr(val);
                                                    }}
                                                    className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-black text-lg text-primary uppercase"
                                                />
                                            </div>
                                            {suggestions?.min_gr && (
                                                <p className="text-[10px] text-zinc-400 font-bold ml-1 italic">
                                                    Minimum GR for this campus is <span className="text-zinc-500">{suggestions.min_gr}</span>. Sequence integrity is enforced.
                                                </p>
                                            )}
                                        </div>

                                        {/* Section */}
                                        <div className="space-y-2 text-left">
                                            <div className="flex items-center justify-between ml-1">
                                                <label className="text-xs font-black uppercase tracking-wider text-zinc-500">Assign Section</label>
                                                {student?.student_admissions?.[0]?.academic_system?.toLowerCase().replace(/[^a-z]/g, '') === 'alevel' ? (
                                                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-100 dark:border-amber-900/30">Discipline Rule</span>
                                                ) : (
                                                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded-full">Step 1</span>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <select
                                                    value={finalSectionId}
                                                    onChange={(e) => handleEnrollSectionChange(e.target.value === "" ? "" : Number(e.target.value))}
                                                    className="w-full px-4 py-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-black text-zinc-700 dark:text-zinc-300 appearance-none cursor-pointer"
                                                >
                                                    <option value="">Unassigned</option>
                                                    {suggestions?.available_sections.map(section => (
                                                        <option key={section.id} value={section.id}>
                                                            {section.description} {suggestions?.suggested_section === section.id ? '(Recommended)' : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                                                    <ChevronRight className="h-5 w-5 rotate-90" />
                                                </div>
                                            </div>
                                            {student?.student_admissions?.[0]?.academic_system?.toLowerCase().replace(/[^a-z]/g, '') === 'alevel' && student?.student_admissions?.[0]?.discipline && (
                                                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold ml-1 italic flex items-center gap-1">
                                                    <Sparkles className="h-3 w-3" />
                                                    Section {student.student_admissions[0].discipline.toLowerCase() === 'science' ? 'A' : 'C'} is assigned for {student.student_admissions[0].discipline} students.
                                                </p>
                                            )}
                                        </div>

                                        {/* House */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between ml-1">
                                                <label className="text-xs font-black uppercase tracking-wider text-zinc-500">Assigned House</label>
                                                <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-full">Step 2: {finalSectionId ? 'Balanced by Section' : 'Balanced by Class'}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                {suggestions?.all_houses.map(house => (
                                                    <button
                                                        key={house.id}
                                                        onClick={() => setFinalHouseId(house.id)}
                                                        className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left relative ${finalHouseId === house.id ? 'border-primary bg-primary/5 text-primary' : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700'}`}
                                                    >
                                                        <div className="w-4 h-4 rounded-full shadow-sm flex-shrink-0" style={{ backgroundColor: house.house_color.toLowerCase() }} />
                                                        <div>
                                                            <div className="text-xs font-black leading-none mb-1">{house.house_name}</div>
                                                            <div className="text-[10px] opacity-70 font-bold uppercase">{house.house_color}</div>
                                                        </div>
                                                        {suggestions?.suggested_house === house.id && (
                                                            <div className="absolute top-2 right-2 text-[8px] font-black text-primary uppercase tracking-widest bg-primary/10 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                                                <Sparkles className="h-2 w-2 text-amber-500" />
                                                                REC.
                                                            </div>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleConfirmEnroll}
                                        disabled={isEnrolling}
                                        className="w-full mt-10 py-5 bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white rounded-3xl font-black text-base shadow-xl shadow-zinc-200 dark:shadow-none hover:translate-y-[-2px] active:translate-y-[0px] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isEnrolling ? <Loader2 className="h-6 w-6 animate-spin" /> : <UserCheck className="h-6 w-6" />}
                                        CONFIRM ENROLLMENT
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Enrollment Success Modal */}
            <AnimatePresence>
                {showEnrollSuccess && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-primary/20 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="relative w-full max-w-sm bg-white dark:bg-zinc-950 rounded-[50px] shadow-2xl border-4 border-primary p-12 text-center"
                        >
                            <div className="h-24 w-24 bg-primary rounded-full flex items-center justify-center text-white mx-auto mb-8 shadow-xl shadow-primary/30">
                                <CheckCircle className="h-12 w-12" />
                            </div>
                            <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight mb-2">ENROLLED!</h2>
                            <p className="text-zinc-500 font-bold mb-8">Registration Complete for {enrolledReport?.full_name}</p>
                            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-[30px] p-6 space-y-4 mb-8 border border-zinc-100 dark:border-zinc-800">
                                <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider">
                                    <span className="text-zinc-400">GR Number</span>
                                    <span className="text-zinc-900 dark:text-zinc-100">{enrolledReport?.gr_number}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider">
                                    <span className="text-zinc-400">House</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: enrolledReport?.houses?.house_color?.toLowerCase() }} />
                                        <span className="text-zinc-900 dark:text-zinc-100">{enrolledReport?.houses?.house_name}</span>
                                    </div>
                                </div>
                                {enrolledReport?.sections && (
                                    <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider">
                                        <span className="text-zinc-400">Section</span>
                                        <span className="text-zinc-900 dark:text-zinc-100">{enrolledReport?.sections?.description}</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => window.location.href = `/enrollments/admission-order/${enrolledReport?.cc}`}
                                    className="w-full py-4 bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white rounded-2xl font-black text-sm tracking-widest shadow-lg hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                                >
                                    <Printer className="h-4 w-4" />
                                    PRINT ADMISSION ORDER
                                </button>
                                <button
                                    onClick={() => setShowEnrollSuccess(false)}
                                    className="w-full py-4 bg-primary text-white rounded-2xl font-black text-sm tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform"
                                >
                                    CONTINUE
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <LifecycleActionModal
                isOpen={lifecycleModal.open}
                onClose={() => setLifecycleModal(prev => ({ ...prev, open: false }))}
                onConfirm={confirmLifecycleAction}
                action={lifecycleModal.targetStatus === 'GRADUATED' ? 'graduate' : lifecycleModal.targetStatus === 'EXPELLED' ? 'expel' : 'left'}
                studentName={student?.full_name || ""}
            />
        </div>
    );
}

function StatusDropdown({ status, onAction, loading }: { status: string; onAction: (targetStatus: string) => void; loading: boolean }) {
    const [isOpen, setIsOpen] = useState(false);
    const normalizedStatus = (status || "").toUpperCase();

    const statuses = [
        { id: 'ENROLLED',       label: 'Enrolled',        icon: User,          color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', hover: 'hover:bg-emerald-100/50' },
        { id: 'SOFT_ADMISSION', label: 'Soft Admission',  icon: User,          color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-100',    hover: 'hover:bg-blue-100/50' },
        { id: 'GRADUATED',      label: 'Graduate',        icon: GraduationCap, color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-100',  hover: 'hover:bg-violet-100/50' },
        { id: 'LEFT',           label: 'Mark as Left',    icon: DoorOpen,      color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100',   hover: 'hover:bg-amber-100/50' },
        { id: 'EXPELLED',       label: 'Expel',           icon: Ban,           color: 'text-rose-600',    bg: 'bg-rose-50',    border: 'border-rose-100',    hover: 'hover:bg-rose-100/50' },
    ];

    const currentId = normalizedStatus === 'ACTIVE' ? 'ENROLLED' : normalizedStatus;
    const current = statuses.find(x => x.id === currentId) || statuses[0];

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={loading}
                className={`flex items-center gap-2 px-3 h-8 rounded-xl border transition-all ${current.bg} ${current.border} ${current.color} hover:shadow-sm active:scale-95 disabled:opacity-50`}
            >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <current.icon className="h-3.5 w-3.5" />}
                <span className="text-[11px] font-black uppercase tracking-tight">{current.label}</span>
                <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, y: 4, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 4, scale: 0.95 }}
                            className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-zinc-100 py-1.5 z-20 overflow-hidden"
                        >
                            <div className="px-3 py-1.5 mb-1 border-b border-zinc-50">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Change Status</span>
                            </div>
                            {statuses.map((item) => {
                                const isCurrent = item.id === currentId;
                                return (
                                    <button
                                        key={item.id}
                                        disabled={isCurrent || loading}
                                        onClick={() => {
                                            setIsOpen(false);
                                            if (!isCurrent) onAction(item.id);
                                        }}
                                        className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${isCurrent ? "bg-zinc-50 opacity-50 cursor-default" : `${item.hover} group`}`}
                                    >
                                        <div className={`p-1.5 rounded-lg border ${item.bg} ${item.border} ${item.color}`}>
                                            <item.icon className="h-3.5 w-3.5" />
                                        </div>
                                        <div className="flex flex-col text-left">
                                            <span className={`text-[12px] font-bold ${isCurrent ? "text-zinc-400" : "text-zinc-700"}`}>
                                                {item.label}
                                            </span>
                                            {isCurrent && <span className="text-[9px] text-zinc-400 italic font-medium">Current Status</span>}
                                        </div>
                                    </button>
                                );
                            })}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
