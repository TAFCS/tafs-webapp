"use client";
import { useState } from "react";
import { Plus, Trash2, Save, Loader2, CheckCircle2 } from "lucide-react";
import api from "@/lib/api";

function RowSaveBtn({ onSave, isSaving, saved, isDirty }: { onSave: () => void; isSaving: boolean; saved: boolean; isDirty: boolean }) {
    if (!isDirty && !isSaving && !saved) return null;
    return (
        <button 
            onClick={onSave} 
            disabled={isSaving || (saved && !isDirty)} 
            className={`flex items-center gap-1.5 px-3 h-7 text-[11px] font-bold text-white rounded-lg transition-all ${saved ? "bg-emerald-500" : "bg-primary hover:bg-primary/90 disabled:opacity-50"}`}
        >
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : saved ? <CheckCircle2 className="h-3 w-3" /> : <Save className="h-3 w-3" />}
            {isSaving ? "Submitting..." : saved ? "Submitted" : "Save"}
        </button>
    );
}

const EMPTY_ADMISSION = { academic_system: "", requested_grade: "", academic_year: "", application_date: "" };

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={className}>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{label}</label>
            {children}
        </div>
    );
}

function Select({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: { label: string; value: string }[]; placeholder?: string }) {
    return (
        <select
            value={value ?? ""}
            onChange={e => onChange(e.target.value)}
            className="w-full h-9 px-3 text-[13px] font-medium bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all appearance-none"
        >
            <option value="">{placeholder || "Select"}</option>
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    );
}

function Input({ value, onChange, type = "text", placeholder }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
    return (
        <input type={type} value={value ?? ""} 
            onChange={e => onChange(e.target.value.toUpperCase())} 
            placeholder={placeholder}
            className="w-full h-9 px-3 text-[13px] font-medium text-zinc-800 bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all uppercase" />
    );
}

// Each row is its own component so useState is legal
function AdmissionRow({ admission, studentCc, classes, onSaved, onDeleted }: { admission: any; studentCc: number; classes: any[]; onSaved: (a: any) => void; onDeleted: () => void }) {
    const [local, setLocal] = useState(admission);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [removing, setRemoving] = useState(false);

    const isDirty = (local.academic_system || "") !== (admission.academic_system || "") ||
                    (local.requested_grade || "") !== (admission.requested_grade || "") ||
                    (local.academic_year || "") !== (admission.academic_year || "") ||
                    (local.application_date ? new Date(local.application_date).toISOString().split("T")[0] : "") !== 
                    (admission.application_date ? new Date(admission.application_date).toISOString().split("T")[0] : "");

    const systems = Array.from(new Set(classes.map(c => c.academic_system))).filter(Boolean).map(s => ({ label: s, value: s }));
    const gradeOptions = classes.map(c => ({ label: c.description, value: c.description }));

    const set = (k: string, v: string) => setLocal((p: any) => ({ ...p, [k]: v }));

    const save = async () => {
        setSaving(true);
        try {
            const { data } = await api.post(`/v1/staff-editing/students/${studentCc}/admissions`, local);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
            onSaved(data?.data);
        } catch(e) {
            alert("Failed to save admission record");
        } finally { setSaving(false); }
    };

    const remove = async () => {
        if (!confirm("Are you sure you want to delete this admission record?")) return;
        setRemoving(true);
        try { 
            await api.delete(`/v1/staff-editing/admissions/${local.id}`); 
            onDeleted(); 
        } catch(e) {
            alert("Failed to delete record");
        } finally { setRemoving(false); }
    };

    return (
        <div className={`bg-white border rounded-2xl p-4 space-y-3 transition-all ${isDirty ? "border-amber-200 shadow-sm" : "border-zinc-100"}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">RECORD #{admission.id}</span>
                    {isDirty && !saved && <span className="text-[9px] font-bold text-amber-600 animate-pulse">Unsaved</span>}
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Academic System"><Select value={local.academic_system ?? ""} onChange={v => set("academic_system", v)} options={systems} placeholder="Select System" /></Field>
                <Field label="Grade"><Select value={local.requested_grade ?? ""} onChange={v => set("requested_grade", v)} options={gradeOptions} placeholder="Select Grade" /></Field>
                <Field label="Admission Taken In"><Input value={local.academic_year ?? ""} onChange={v => set("academic_year", v)} placeholder="e.g. 2024-25" /></Field>
                <Field label="Application Date"><Input type="date" value={local.application_date ? new Date(local.application_date).toISOString().split("T")[0] : ""} onChange={v => set("application_date", v)} /></Field>
            </div>
            <div className="flex gap-2 pt-1">
                <button 
                    onClick={save} 
                    disabled={saving || (saved && !isDirty)} 
                    className={`flex items-center gap-1.5 px-3 h-8 text-[11px] font-bold text-white rounded-xl transition-all ${saved ? "bg-emerald-500" : "bg-primary hover:bg-primary/90 disabled:opacity-50"}`}
                >
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : saved ? <CheckCircle2 className="h-3 w-3" /> : <Save className="h-3 w-3" />}
                    {saving ? "Submitting..." : saved ? "Submitted" : "Save Changes"}
                </button>
                <button onClick={remove} disabled={saving || removing} className="flex items-center gap-1.5 px-3 h-8 text-[11px] font-bold text-rose-600 bg-rose-50 rounded-xl hover:bg-rose-100 disabled:opacity-50 transition-all">
                    {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                </button>
            </div>
        </div>
    );
}

export function AdmissionsTab({ student, onReload, classes = [] }: { student: any; onReload: () => void; classes?: any[] }) {
    const [admissions, setAdmissions] = useState<any[]>(student.admissions || []);
    const [studentYear, setStudentYear] = useState(student.academic_year || "");
    const [savingYear, setSavingYear] = useState(false);
    const [savedYear, setSavedYear] = useState(false);

    const saveStudentYear = async () => {
        setSavingYear(true);
        try {
            await api.patch(`/v1/staff-editing/students/${student.cc}`, { academic_year: studentYear });
            setSavedYear(true);
            setTimeout(() => setSavedYear(false), 3000);
            onReload();
        } catch { alert("Failed to update Academic Year"); }
        finally { setSavingYear(false); }
    };

    const systems = Array.from(new Set(classes.map(c => c.academic_system))).filter(Boolean).map(s => ({ label: s, value: s }));
    const gradeOptions = classes.map(c => ({ label: c.description, value: c.description }));
    const [newRow, setNewRow] = useState<any | null>(null);
    const [savingNew, setSavingNew] = useState(false);
    const [savedNew, setSavedNew] = useState(false);

    const saveNew = async () => {
        if (!newRow.requested_grade || !newRow.academic_year) return alert("Grade and Academic Year are required");
        setSavingNew(true);
        try {
            const { data } = await api.post(`/v1/staff-editing/students/${student.cc}/admissions`, newRow);
            setAdmissions(prev => [data?.data, ...prev]);
            setSavedNew(true);
            setTimeout(() => {
                setSavedNew(false);
                setNewRow(null);
                onReload();
            }, 1000);
        } catch(e) {
            alert("Failed to add admission record");
        } finally { setSavingNew(false); }
    };

    const set = (k: string, v: string) => setNewRow((p: any) => ({ ...p, [k]: v }));

    return (
        <div className="space-y-6">
            <div className={`bg-zinc-50 border rounded-2xl p-4 space-y-3 transition-all ${studentYear !== (student.academic_year || "") ? "border-amber-200 ring-1 ring-amber-100" : "border-zinc-100"}`}>
                <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">General Information</h3>
                    <RowSaveBtn onSave={saveStudentYear} isSaving={savingYear} saved={savedYear} isDirty={studentYear !== (student.academic_year || "")} />
                </div>
                <Field label="Current Academic Year">
                    <Input value={studentYear} onChange={setStudentYear} placeholder="e.g. 2024-25" />
                </Field>
            </div>

            <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Admission Records</h3>
                <button 
                    onClick={() => setNewRow(newRow ? null : { ...EMPTY_ADMISSION })} 
                    className={`flex items-center gap-1.5 px-3 h-8 text-[11px] font-bold rounded-xl transition-all ${newRow ? "bg-zinc-100 text-zinc-500" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
                >
                    {newRow ? "Cancel" : <><Plus className="h-3.5 w-3.5" /> Add New</>}
                </button>
            </div>

            {newRow && (
                <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 space-y-3 shadow-sm">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">New Admission Record</p>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Academic System"><Select value={newRow.academic_system} onChange={v => set("academic_system", v)} options={systems} placeholder="Select System" /></Field>
                        <Field label="Grade"><Select value={newRow.requested_grade} onChange={v => set("requested_grade", v)} options={gradeOptions} placeholder="Select Grade" /></Field>
                        <Field label="Admission Taken In"><Input value={newRow.academic_year} onChange={v => set("academic_year", v)} placeholder="e.g. 2024-25" /></Field>
                        <Field label="Application Date"><Input type="date" value={newRow.application_date} onChange={v => set("application_date", v)} /></Field>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={saveNew} 
                            disabled={savingNew || savedNew} 
                            className={`flex items-center gap-1.5 px-4 h-8 text-[11px] font-bold text-white rounded-xl transition-all ${savedNew ? "bg-emerald-500" : "bg-primary hover:bg-primary/90 disabled:opacity-50 shadow-sm shadow-primary/20"}`}
                        >
                            {savingNew ? <Loader2 className="h-3 w-3 animate-spin" /> : savedNew ? <CheckCircle2 className="h-3 w-3" /> : <Save className="h-3 w-3" />}
                            {savingNew ? "Submitting..." : savedNew ? "Submitted" : "Add Record"}
                        </button>
                    </div>
                </div>
            )}

            {admissions.map(a => (
                <AdmissionRow
                    key={a.id}
                    admission={a}
                    studentCc={student.cc}
                    classes={classes}
                    onSaved={updated => setAdmissions(prev => prev.map(x => x.id === updated.id ? updated : x))}
                    onDeleted={() => setAdmissions(prev => prev.filter(x => x.id !== a.id))}
                />
            ))}

            {admissions.length === 0 && !newRow && (
                <div className="py-12 text-center text-zinc-400 text-sm">No admission records</div>
            )}
            </div>
        </div>
    );
}
