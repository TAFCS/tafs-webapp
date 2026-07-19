"use client";
import { useEffect, useMemo, useState } from "react";
import { Save, Loader2, CheckCircle2, Pencil, X, Layers, ChevronDown, ArrowRightLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";
import toast from "react-hot-toast";
import type { CampusItem } from "@/src/store/slices/campusesSlice";
import {
    extractApiErrorMessage,
    formatSectionOptionLabel,
    isSectionSelectableForGender,
} from "@/lib/section-allocation";

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
    options: { label: string; value: string; disabled?: boolean }[];
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
                    <option key={o.value} value={o.value} disabled={o.disabled}>
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

    const [transferOpen, setTransferOpen] = useState(false);
    const [transferCampusId, setTransferCampusId] = useState("");
    const [transferring, setTransferring] = useState(false);

    const isSoftAdmission = (student.status || "").toUpperCase() === "SOFT_ADMISSION";

    const handleTransferCampus = async () => {
        if (!transferCampusId) {
            toast.error("Please select a campus.");
            return;
        }
        setTransferring(true);
        try {
            await api.patch(`/v1/staff-editing/students/${student.cc}`, {
                campus_id: Number(transferCampusId),
                class_id: null,
                section_id: null,
            });
            toast.success("Campus transferred. Class has been cleared — please reassign.");
            setTransferOpen(false);
            setTransferCampusId("");
            onReload();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Failed to transfer campus.");
        } finally {
            setTransferring(false);
        }
    };

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
                .map((s: any) => ({
                    label: formatSectionOptionLabel(s, { studentGender: student.gender }),
                    value: String(s.id),
                    disabled: !isSectionSelectableForGender(s, student.gender),
                }));
        }
        return sections.map((s) => ({ label: s.description, value: String(s.id), disabled: false }));
    }, [classId, offeredClasses, sections, student.gender]);

    const isDirty =
        classId !== (student.class_id != null ? String(student.class_id) : "") ||
        sectionId !== (student.section_id != null ? String(student.section_id) : "");

    const sectionRequired = !isSoftAdmission;
    const canSave = !!student.campus_id && !!classId && (!sectionRequired || !!sectionId) && isDirty;

    const save = async () => {
        if (!student.campus_id) {
            toast.error("Assign a campus before setting class and section.");
            return;
        }
        if (!classId) {
            toast.error("Class is required.");
            return;
        }
        if (sectionRequired && !sectionId) {
            toast.error("Section is required.");
            return;
        }
        setSaving(true);
        try {
            await api.patch(`/v1/staff-editing/students/${student.cc}`, {
                class_id: Number(classId),
                ...(sectionId ? { section_id: Number(sectionId) } : {}),
            });
            setSaved(true);
            toast.success(sectionId ? "Class and section updated." : "Class updated.");
            setTimeout(() => setSaved(false), 2000);
            setIsEditing(false);
            onReload();
        } catch (err: any) {
            toast.error(extractApiErrorMessage(err, "Failed to update class and section."));
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
                            <Field label={isSoftAdmission ? "Section (assigned at enrollment)" : "Section"}>
                                <Select
                                    value={sectionId}
                                    onChange={setSectionId}
                                    options={sectionOptions}
                                    placeholder={classId ? (isSoftAdmission ? "Optional — set at enrollment" : "Select section") : "Select class first"}
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
                            {isSoftAdmission && (
                                <button
                                    onClick={() => {
                                        setTransferCampusId(student.campus_id ? String(student.campus_id) : "");
                                        setTransferOpen(true);
                                    }}
                                    className="mt-2 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-800 transition-colors"
                                >
                                    <ArrowRightLeft className="h-3 w-3" />
                                    Transfer Campus
                                </button>
                            )}
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

            {/* Transfer Campus Modal */}
            <AnimatePresence>
                {transferOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setTransferOpen(false)}
                            className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
                        >
                            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-indigo-50/50 dark:bg-indigo-950/20">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600">
                                        <ArrowRightLeft className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-[15px] font-black text-zinc-900 dark:text-zinc-100 leading-tight">Transfer Campus</h3>
                                        <p className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">Soft Admission only</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setTransferOpen(false)}
                                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-zinc-600"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="p-6 space-y-5">
                                <div className="rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10 px-4 py-3 text-[12px] text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
                                    This will change the campus and clear the current class assignment. You will need to reassign the class from the Class Grade tab.
                                </div>

                                <div>
                                    <label className="block text-[11px] font-black text-zinc-400 uppercase tracking-wider mb-2">New Campus</label>
                                    <Select
                                        value={transferCampusId}
                                        onChange={setTransferCampusId}
                                        options={campuses.map((c) => ({ label: c.campus_name, value: String(c.id) }))}
                                        placeholder="Select campus"
                                    />
                                </div>

                                <div className="flex gap-3 pt-1">
                                    <button
                                        onClick={() => setTransferOpen(false)}
                                        className="flex-1 px-4 py-3 rounded-2xl font-bold text-[13px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleTransferCampus}
                                        disabled={transferring || !transferCampusId || transferCampusId === String(student.campus_id)}
                                        className="flex-[2] px-4 py-3 rounded-2xl font-black text-[13px] text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                                    >
                                        {transferring ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                                        Confirm Transfer
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
