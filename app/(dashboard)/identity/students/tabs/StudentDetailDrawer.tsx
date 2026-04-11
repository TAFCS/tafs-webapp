"use client";
import { useState, useEffect, useCallback } from "react";
import { X, Loader2, User, BookOpen, GraduationCap, Shield } from "lucide-react";
import api from "@/lib/api";
import { IdentityTab } from "./IdentityTab";
import { AdmissionsTab } from "./AdmissionsTab";
import { AcademicTab } from "./AcademicTab";
import { GuardiansTab } from "./GuardiansTab";

const TABS = [
    { id: "identity",   label: "Identity",   icon: User },
    { id: "admissions", label: "Admissions",  icon: BookOpen },
    { id: "academic",   label: "Academic",    icon: GraduationCap },
    { id: "guardians",  label: "Guardians",   icon: Shield },
] as const;

type TabId = typeof TABS[number]["id"];

interface Props {
    cc: number | null;
    onClose: () => void;
}

export function StudentDetailDrawer({ cc, onClose }: Props) {
    const [student, setStudent] = useState<any>(null);
    const [loading, setLoading] = useState(false);
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
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors">
                        <X className="h-4 w-4 text-zinc-400" />
                    </button>
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
                            {tab === "admissions" && <AdmissionsTab student={student} onReload={reload} />}
                            {tab === "academic"   && <AcademicTab   student={student} onReload={reload} />}
                            {tab === "guardians"  && <GuardiansTab  student={student} onReload={reload} />}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
