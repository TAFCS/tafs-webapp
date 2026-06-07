"use client";
import { useEffect, useMemo, useState } from "react";
import { Save, Loader2, CheckCircle2, Pencil, X, Layers, ChevronDown } from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import type { CampusItem } from "@/src/store/slices/campusesSlice";

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={className}>
            <label className="block text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">{label}</label>
            {children}
        </div>
    );
}

function Select({
    value,
    onChange,
    options,
    placeholder,
    disabled,
}: {
    value: string;
    onChange: (v: string) => void;
    options: { label: string; value: string }[];
    placeholder?: string;
    disabled?: boolean;
}) {
    return (
        <div className="relative flex items-center w-full">
            <select
                value={value ?? ""}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className="w-full h-10 pl-3 pr-10 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all appearance-none disabled:opacity-50"
            >
                <option value="">{placeholder || "Select"}</option>
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
            <div className="absolute right-3.5 pointer-events-none text-zinc-400 dark:text-zinc-650">
                <ChevronDown className="h-4 w-4" />
            </div>
        </div>
    );
}

interface Props {
    student: any;
    classes?: any[];
    sections?: { id: number; description: string }[];
    campuses?: CampusItem[];
    onReload: () => void;
}

export function ClassGradeTab({ student, classes = [], sections = [], campuses = [], onReload }: Props) {
    const [classId, setClassId] = useState(student.class_id != null ? String(student.class_id) : "");
    const [sectionId, setSectionId] = useState(student.section_id != null ? String(student.section_id) : "");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        setClassId(student.class_id != null ? String(student.class_id) : "");
        setSectionId(student.section_id != null ? String(student.section_id) : "");
        setSaved(false);
    }, [student.cc, student.class_id, student.section_id]);

    const campus = useMemo(
        () => campuses.find((c) => c.id === student.campus_id),
        [campuses, student.campus_id]
    );

    const offeredClasses = campus?.offered_classes?.filter((c) => c.is_active !== false) ?? null;

    const classOptions = useMemo(() => {
        const source = offeredClasses?.length
            ? offeredClasses.map((c) => ({
                  id: c.id,
                  description: c.description,
                  class_code: c.class_code,
              }))
            : classes;
        return source.map((c: any) => ({
            label: c.description || c.class_code || String(c.id),
            value: String(c.id),
        }));
    }, [offeredClasses, classes]);

    const sectionOptions = useMemo(() => {
        if (!classId) return [];
        const offered = offeredClasses?.find((c) => String(c.id) === classId);
        if (offered?.sections?.length) {
            return offered.sections
                .filter((s) => s.is_active !== false)
                .map((s) => ({ label: s.description, value: String(s.id) }));
        }
        return sections.map((s) => ({ label: s.description, value: String(s.id) }));
    }, [classId, offeredClasses, sections]);

    const isDirty =
        classId !== (student.class_id != null ? String(student.class_id) : "") ||
        sectionId !== (student.section_id != null ? String(student.section_id) : "");

    const canSave = !!student.campus_id && !!classId && !!sectionId && isDirty;

    const save = async () => {
        if (!student.campus_id) {
            toast.error("Assign a campus before setting class and section.");
            return;
        }
        if (!classId || !sectionId) {
            toast.error("Class and section are required.");
            return;
        }
        setSaving(true);
        try {
            await api.patch(`/v1/staff-editing/students/${student.cc}`, {
                class_id: Number(classId),
                section_id: Number(sectionId),
            });
            setSaved(true);
            toast.success("Class and section updated.");
            setTimeout(() => setSaved(false), 2000);
            setIsEditing(false);
            onReload();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to update class and section.");
        } finally {
            setSaving(false);
        }
    };

    const handleClassChange = (v: string) => {
        setClassId(v);
        setSectionId("");
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Context/Helper Info */}
            <div className="p-4 rounded-3xl border border-indigo-100 bg-indigo-50/30 flex items-start gap-3.5 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="h-10 w-10 rounded-2xl bg-indigo-100/80 flex items-center justify-center text-indigo-600 shrink-0">
                    <Layers className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-none mb-1.5">Placement Information Info</p>
                    <p className="text-[12.5px] font-medium text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        Current class and section come from the student record (used in the student directory).
                        The Admissions tab stores application history only.
                    </p>
                </div>
            </div>

            {/* CLASS & GRADE CARD */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-6 shadow-sm relative transition-all duration-200">
                <div className="absolute top-6 right-6 flex items-center gap-2">
                    {isEditing ? (
                        <div className="flex gap-2">
                            <button 
                                onClick={() => {
                                    setIsEditing(false);
                                    setClassId(student.class_id != null ? String(student.class_id) : "");
                                    setSectionId(student.section_id != null ? String(student.section_id) : "");
                                }} 
                                className="flex items-center justify-center p-2 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                            <button 
                                onClick={save} 
                                disabled={saving || !canSave}
                                className="flex items-center gap-1.5 px-3.5 h-8 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
                            >
                                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                                Save
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setIsEditing(true)}
                            className="p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-600 transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
                        >
                            <Pencil className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <h3 className="text-[16px] font-extrabold text-zinc-900 dark:text-zinc-100 mb-6 tracking-tight">Placement details</h3>

                {isEditing ? (
                    <div className="space-y-6 animate-in fade-in duration-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label="Class">
                                <Select
                                    value={classId}
                                    onChange={handleClassChange}
                                    options={classOptions}
                                    placeholder="Select class"
                                    disabled={!student.campus_id}
                                />
                            </Field>
                            <Field label="Section">
                                <Select
                                    value={sectionId}
                                    onChange={setSectionId}
                                    options={sectionOptions}
                                    placeholder={classId ? "Select section" : "Select class first"}
                                    disabled={!student.campus_id || !classId}
                                />
                            </Field>
                        </div>
                        
                        {!student.campus_id && (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">
                                This student has no campus assigned. Set campus on the Identity tab before assigning class and section.
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 animate-in fade-in duration-200">
                        <div>
                            <p className="text-[11px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest">Campus</p>
                            <p className="font-bold text-[14px] text-zinc-800 dark:text-zinc-200 mt-1">{student.campus_name || "—"}</p>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest">Class</p>
                            <p className="font-bold text-[14px] text-zinc-800 dark:text-zinc-200 mt-1">{student.class_name || "Not assigned"}</p>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest">Section</p>
                            <p className="font-bold text-[14px] text-zinc-800 dark:text-zinc-200 mt-1">{student.section_name || "Not assigned"}</p>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest">Class Code</p>
                            <p className="font-mono text-[14px] text-zinc-700 dark:text-zinc-300 mt-1 uppercase">{student.class_code || "—"}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
