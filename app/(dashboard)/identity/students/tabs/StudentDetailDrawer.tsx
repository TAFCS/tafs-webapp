"use client";
import { useState, useEffect, useCallback } from "react";
import { X, Loader2, User, BookOpen, GraduationCap, Shield, FileText, RotateCcw, History, ShieldAlert } from "lucide-react";
import api from "@/lib/api";
import { IdentityTab } from "./IdentityTab";
import { AdmissionsTab } from "./AdmissionsTab";
import { AcademicTab } from "./AcademicTab";
import { GuardiansTab } from "./GuardiansTab";
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

type TabId = typeof TABS[number]["id"];

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
                        {student && isExpelled && (
                            <button
                                onClick={() => {
                                    void handleUnexpel();
                                }}
                                disabled={unexpelling}
                                className="inline-flex items-center gap-1.5 px-3 h-8 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {unexpelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                                {unexpelling ? "Unexpelling..." : "Unexpel Student"}
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            title="Close"
                            aria-label="Close"
                            className="p-2 hover:bg-zinc-100 rounded-xl transition-colors"
                        >
                            <X className="h-4 w-4 text-zinc-400" />
                        </button>
                    </div>
                </div>

                {/* Tab Bar */}
                <div className="flex border-b border-zinc-100 shrink-0 px-4 pt-2 gap-1">
                    {TABS.map(t => {
                        const Icon = t.icon;
                        const active = tab === t.id;
                        return (
                            <button
                                key={t.id}
                                onClick={() => setTab(t.id)}
                                className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-bold rounded-t-xl border-b-2 transition-all ${active ? "border-primary text-primary bg-primary/5" : "border-transparent text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"}`}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {t.label}
                            </button>
                        );
                    })}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
                        </div>
                    ) : !student ? (
                        <div className="flex items-center justify-center h-40 text-zinc-400 text-sm">Student not found</div>
                    ) : (
                        <div className="p-6">
                            {tab === "identity"   && <IdentityTab   student={student} onReload={reload} />}
                            {tab === "admissions" && <AdmissionsTab student={student} onReload={reload} classes={classes} />}
                            {tab === "academic"   && <AcademicTab   student={student} onReload={reload} />}
                            {tab === "guardians"  && <GuardiansTab  student={student} onReload={reload} onSwitchStudent={onSwitchStudent} />}
                            {tab === "logs" && <StudentLogsTab student={student} />}
                            {tab === "admission_order" && <AdmissionOrderTab cc={student.cc} />}
                            {tab === "danger_zone" && <DangerZoneTab student={student} />}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
