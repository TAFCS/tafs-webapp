"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, Loader2, CheckCircle2 } from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import type { CampusItem } from "@/src/store/slices/campusesSlice";

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={className}>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{label}</label>
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
        <select
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="w-full h-9 px-3 text-[13px] font-medium bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all appearance-none disabled:opacity-50"
        >
            <option value="">{placeholder || "Select"}</option>
            {options.map((o) => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
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
            setTimeout(() => setSaved(false), 3000);
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
        <div className="space-y-6">
            <p className="text-[12px] text-zinc-500 leading-relaxed">
                Current class and section come from the student record (used in the student directory).
                The Admissions tab stores application history only.
            </p>

            <div className="bg-white border border-zinc-100 rounded-2xl p-4 space-y-3">
                <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Current placement</h3>
                <div className="grid grid-cols-2 gap-3 text-[13px]">
                    <div>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Campus</span>
                        <p className="font-semibold text-zinc-800 mt-0.5">{student.campus_name || "—"}</p>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Class</span>
                        <p className="font-semibold text-zinc-800 mt-0.5">{student.class_name || "Not assigned"}</p>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Section</span>
                        <p className="font-semibold text-zinc-800 mt-0.5">{student.section_name || "Not assigned"}</p>
                    </div>
                    {student.class_code && (
                        <div>
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Class code</span>
                            <p className="font-mono text-zinc-600 mt-0.5">{student.class_code}</p>
                        </div>
                    )}
                </div>
            </div>

            {!student.campus_id && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">
                    This student has no campus assigned. Set campus on the Identity tab before assigning class and section.
                </div>
            )}

            <div
                className={`bg-zinc-50 border rounded-2xl p-4 space-y-3 transition-all ${
                    isDirty ? "border-amber-200 ring-1 ring-amber-100" : "border-zinc-100"
                }`}
            >
                <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Edit class &amp; section</h3>
                    {isDirty && !saved && (
                        <span className="text-[9px] font-bold text-amber-600 animate-pulse">Unsaved</span>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-3">
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
                <button
                    onClick={save}
                    disabled={saving || !canSave || (saved && !isDirty)}
                    className={`flex items-center gap-1.5 px-4 h-8 text-[11px] font-bold text-white rounded-xl transition-all ${
                        saved ? "bg-emerald-500" : "bg-primary hover:bg-primary/90 disabled:opacity-50"
                    }`}
                >
                    {saving ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                    ) : saved ? (
                        <CheckCircle2 className="h-3 w-3" />
                    ) : (
                        <Save className="h-3 w-3" />
                    )}
                    {saving ? "Saving..." : saved ? "Saved" : "Save changes"}
                </button>
            </div>
        </div>
    );
}
