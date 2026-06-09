"use client";
import { useState, useEffect, useCallback } from "react";
import { X, Loader2, User, BookOpen, GraduationCap, Shield, FileText, RotateCcw, History, ShieldAlert, DoorOpen, Ban, ChevronDown, Layers } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";
import { IdentityTab } from "./IdentityTab";
import { AdmissionsTab } from "./AdmissionsTab";
import { ClassGradeTab } from "./ClassGradeTab";
import type { CampusItem } from "@/src/store/slices/campusesSlice";
import { AcademicTab } from "./AcademicTab";
import { GuardiansTab } from "./GuardiansTab";
import { LifecycleActionModal } from "./LifecycleActionModal";
import { AdmissionOrderTab } from "./AdmissionOrderTab";
import { StudentLogsTab } from "./StudentLogsTab";
import { DangerZoneTab } from "./DangerZoneTab";

const TABS = [
    { id: "identity",   label: "Identity",   icon: User },
    { id: "class_grade", label: "Class Grade", icon: Layers },
    { id: "admissions", label: "Admissions",  icon: BookOpen },
    { id: "academic",   label: "Academic",    icon: GraduationCap },
    { id: "guardians",  label: "Guardians",   icon: Shield },
    { id: "logs",       label: "Logs",        icon: History },
] as const;

type TabId = typeof TABS[number]["id"] | "admission_order" | "danger_zone";

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

    const handleStatusChange = (targetStatus: string) => {
        if (!cc || !student) return;
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
                                <button
                                    onClick={() => setTab("danger_zone")}
                                    className={`flex items-center gap-1.5 px-2.5 h-8 rounded-xl transition-all ${tab === "danger_zone" ? "bg-rose-600 text-white shadow-lg shadow-rose-200" : "text-rose-400 bg-rose-50 hover:bg-rose-100 hover:text-rose-600 border border-rose-100/50"}`}
                                    title="Danger Zone"
                                >
                                    <ShieldAlert className="h-3.5 w-3.5" />
                                    <span className="text-[10px] font-black uppercase tracking-tighter">Danger</span>
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
