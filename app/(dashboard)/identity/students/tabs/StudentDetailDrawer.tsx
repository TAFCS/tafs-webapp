"use client";
import { useState, useEffect, useCallback } from "react";
import { X, Loader2, User, BookOpen, GraduationCap, Shield, FileText, RotateCcw, History, ShieldAlert, DoorOpen, Ban, ChevronDown, GraduationCap as GraduateIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";
import { IdentityTab } from "./IdentityTab";
import { AdmissionsTab } from "./AdmissionsTab";
import { AcademicTab } from "./AcademicTab";
import { GuardiansTab } from "./GuardiansTab";
import { LifecycleActionModal } from "./LifecycleActionModal";
import { AdmissionOrderTab } from "./AdmissionOrderTab";
import { StudentLogsTab } from "./StudentLogsTab";
import { DangerZoneTab } from "./DangerZoneTab";

const TABS = [
    { id: "identity",   label: "Identity",   icon: User },
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
    onUpdated?: () => void;
}

export function StudentDetailDrawer({ cc, onClose, onSwitchStudent, classes = [], onUpdated }: Props) {
    const [student, setStudent] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [lifecycleModal, setLifecycleModal] = useState<{ open: boolean; action: 'graduate' | 'expel' | 'left' }>({
        open: false,
        action: 'graduate'
    });
    const [unexpelling, setUnexpelling] = useState(false);
    const [tab, setTab] = useState<TabId>("identity");

    const reload = useCallback(async () => {
        if (!cc) return;
        setLoading(true);
        try {
            const { data } = await api.get(`/v1/staff-editing/students/${cc}`);
            setStudent(data?.data || null);
        } catch { setStudent(null); }
        finally { setLoading(false); }
    }, [cc]);

    useEffect(() => {
        setStudent(null);
        setTab("identity");
        reload();
    }, [cc, reload]);

    const isExpelled = (student?.status || "").toUpperCase() === "EXPELLED";

    const handleLifecycleAction = (action: 'graduate' | 'expel' | 'left') => {
        setLifecycleModal({ open: true, action });
    };

    const confirmLifecycleAction = async (reason: string) => {
        const { action } = lifecycleModal;
        if (!cc || !student) return;

        setActionLoading(action);
        try {
            await api.post('/v1/students/promotion/single', {
                student_id: cc,
                from: { class_id: student.class_id },
                [action]: true,
                reason: reason.trim() || undefined
            });
            await reload();
            onUpdated?.();
            setLifecycleModal(prev => ({ ...prev, open: false }));
        } catch (error: any) {
            const message = error?.response?.data?.message || `Failed to ${action} student.`;
            window.alert(message);
            throw error; // Re-throw for modal loading state
        } finally {
            setActionLoading(null);
        }
    };

    const handleUnexpel = async () => {
        if (!cc || !student) return;

        const confirmed = window.confirm(`Unexpel ${student.full_name || `student #${cc}`}?`);
        if (!confirmed) return;

        setUnexpelling(true);
        try {
            await api.patch(`/v1/students/${cc}/unexpel`);
            await reload();
            onUpdated?.();
        } catch (error: any) {
            const message = error?.response?.data?.message || "Failed to unexpel student.";
            window.alert(message);
        } finally {
            setUnexpelling(false);
        }
    };

    const isOpen = !!cc;

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                onClick={onClose}
            />

            {/* Drawer */}
            <div className={`fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
                    <div>
                        {student ? (
                            <>
                                <h2 className="text-[16px] font-black text-zinc-900 tracking-tight">{student.full_name}</h2>
                                <p className="text-[11px] text-zinc-400 font-mono mt-0.5">CC {student.cc} {student.gr_number ? `· GR ${student.gr_number}` : ""}</p>
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
                            <div className="flex items-center bg-zinc-50 border border-zinc-100 rounded-xl p-0.5 mr-2">
                                <button 
                                    onClick={() => setTab("admission_order" as any)}
                                    className={`flex items-center gap-1.5 px-2.5 h-8 rounded-xl transition-all ${tab === "admission_order" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-indigo-400 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-600 border border-indigo-100/50"}`}
                                    title="Admission Order"
                                >
                                    <FileText className="h-3.5 w-3.5" />
                                    <span className="text-[10px] font-black uppercase tracking-tighter whitespace-nowrap">Admission Order</span>
                                </button>
                                <div className="w-[1px] h-3 bg-zinc-200 mx-0.5" />
                                <button 
                                    onClick={() => setTab("danger_zone" as any)}
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
                                    loading={!!actionLoading || unexpelling}
                                    onAction={(action) => {
                                        if (action === 'unexpel') handleUnexpel();
                                        else handleLifecycleAction(action as any);
                                    }}
                                />
                            </div>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-400 hover:text-zinc-600"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div className="flex items-center px-6 border-b border-zinc-100 bg-white/50 backdrop-blur-xl shrink-0">
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex items-center gap-2 px-4 py-3 text-[13px] font-bold transition-all border-b-2 -mb-[1px] ${tab === t.id ? "border-indigo-600 text-indigo-600" : "border-transparent text-zinc-400 hover:text-zinc-600"}`}
                        >
                            <t.icon className="h-4 w-4" />
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto bg-zinc-50/30">
                    <div className="max-w-3xl mx-auto p-6">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
                                <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest mt-4">Initializing Data Matrix...</p>
                            </div>
                        ) : student ? (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                {tab === "identity" && <IdentityTab student={student} onReload={reload} />}
                                {tab === "admissions" && <AdmissionsTab student={student} onReload={reload} classes={classes} />}
                                {tab === "academic" && <AcademicTab student={student} onReload={reload} />}
                                {tab === "guardians" && <GuardiansTab student={student} onReload={reload} />}
                                {tab === "admission_order" && <AdmissionOrderTab cc={student.cc} />}
                                {tab === "logs" && <StudentLogsTab student={student} />}
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
                action={lifecycleModal.action}
                studentName={student?.full_name || ""}
            />
        </>
    );
}

function StatusDropdown({ status, onAction, loading }: { status: string; onAction: (a: string) => void; loading: boolean }) {
    const [isOpen, setIsOpen] = useState(false);
    
    const normalizedStatus = (status || "ENROLLED").toUpperCase();
    const isActive = normalizedStatus === 'ENROLLED' || normalizedStatus === 'ACTIVE';

    const statuses = [
        { id: 'ENROLLED', label: 'Enrolled', icon: User, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', hover: 'hover:bg-emerald-100/50' },
        { id: 'GRADUATED', label: 'Graduate', icon: GraduationCap, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100', hover: 'hover:bg-violet-100/50', action: 'graduate' },
        { id: 'LEFT', label: 'Mark as Left', icon: DoorOpen, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', hover: 'hover:bg-amber-100/50', action: 'left' },
        { id: 'EXPELLED', label: 'Expel', icon: Ban, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', hover: 'hover:bg-rose-100/50', action: 'expel' },
    ];

    const currentId = isActive ? 'ENROLLED' : normalizedStatus;
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
                            className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-zinc-100 py-1.5 z-20 overflow-hidden"
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
                                            if (item.id === 'ENROLLED') {
                                                if (normalizedStatus === 'EXPELLED') onAction('unexpel');
                                            } else if (item.action) {
                                                onAction(item.action);
                                            }
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
