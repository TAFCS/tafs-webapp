"use client";
import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Loader2, CheckCircle2, Pencil, Calendar, BookOpen, Layers, X } from "lucide-react";
import api from "@/lib/api";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">{label}</label>
            {children}
        </div>
    );
}

function Input({ value, onChange, type = "text", placeholder }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
    return (
        <input type={type} value={value ?? ""}
            onChange={e => onChange(type === "date" ? e.target.value : e.target.value.toUpperCase())}
            placeholder={placeholder}
            className="w-full h-10 px-3 text-[13px] font-medium text-zinc-800 bg-white border border-zinc-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all uppercase" />
    );
}

function Select({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: { label: string; value: string }[]; placeholder?: string }) {
    return (
        <select
            value={value ?? ""}
            onChange={e => onChange(e.target.value)}
            className="w-full h-10 px-3 text-[13px] font-medium bg-white border border-zinc-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all appearance-none"
        >
            <option value="">{placeholder || "Select"}</option>
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    );
}

const DISCIPLINES = [
    { label: "Pre-Medical", value: "Pre-Medical" },
    { label: "Pre-Engineering", value: "Pre-Engineering" },
    { label: "Pre-Commerce", value: "Pre-Commerce" },
    { label: "Computer Science", value: "Computer Science" },
    { label: "Humanities", value: "Humanities" },
];

export function AdmissionsTab({ student, onReload, classes = [] }: { student: any; onReload: () => void; classes?: any[] }) {
    const [admissions, setAdmissions] = useState<any[]>(student.admissions || []);
    const [studentYear, setStudentYear] = useState(student.academic_year || "");
    const [studentDoa, setStudentDoa] = useState(student.date_of_admission ? new Date(student.date_of_admission).toISOString().split("T")[0] : "");
    const [savingYear, setSavingYear] = useState(false);
    const [savedYear, setSavedYear] = useState(false);
    const [editGeneral, setEditGeneral] = useState(false);

    const [newRow, setNewRow] = useState<any | null>(null);
    const [savingNew, setSavingNew] = useState(false);
    const [savedNew, setSavedNew] = useState(false);

    // Edit states for existing admissions
    const [editingAdmissionId, setEditingAdmissionId] = useState<number | null>(null);
    const [editAdmissionState, setEditAdmissionState] = useState<any>({});

    useEffect(() => {
        setAdmissions(student.admissions || []);
        setStudentYear(student.academic_year || "");
        setStudentDoa(student.date_of_admission ? new Date(student.date_of_admission).toISOString().split("T")[0] : "");
    }, [student]);

    const saveStudentYear = async () => {
        setSavingYear(true);
        try {
            await api.patch(`/v1/staff-editing/students/${student.cc}`, { academic_year: studentYear, doa: studentDoa });
            setSavedYear(true);
            setTimeout(() => setSavedYear(false), 2000);
            setEditGeneral(false);
            onReload();
        } catch { 
            alert("Failed to update general information"); 
        } finally { 
            setSavingYear(false); 
        }
    };

    const systems = Array.from(new Set(classes.map(c => c.academic_system))).filter(Boolean).map(s => ({ label: s, value: s }));

    const saveNew = async () => {
        if (!newRow.academic_system || !newRow.academic_year) return alert("Academic System and Academic Year are required");
        setSavingNew(true);
        try {
            const { data } = await api.post(`/v1/staff-editing/students/${student.cc}/admissions`, {
                ...newRow,
                requested_grade: "",
            });
            setAdmissions(prev => [data?.data, ...prev]);
            setSavedNew(true);
            setTimeout(() => {
                setSavedNew(false);
                setNewRow(null);
                onReload();
            }, 1000);
        } catch (e) {
            alert("Failed to add admission record");
        } finally { setSavingNew(false); }
    };

    const handleStartEditAdmission = (adm: any) => {
        setEditingAdmissionId(adm.id);
        setEditAdmissionState({
            academic_system: adm.academic_system || "",
            discipline: adm.discipline || "",
            academic_year: adm.academic_year || "",
            application_date: adm.application_date ? new Date(adm.application_date).toISOString().split("T")[0] : "",
        });
    };

    const handleSaveAdmission = async (id: number) => {
        try {
            const { data } = await api.post(`/v1/staff-editing/students/${student.cc}/admissions`, {
                id,
                ...editAdmissionState,
                requested_grade: "",
            });
            setAdmissions(prev => prev.map(a => a.id === id ? data.data : a));
            setEditingAdmissionId(null);
            onReload();
        } catch {
            alert("Failed to save admission record");
        }
    };

    const handleDeleteAdmission = async (id: number) => {
        if (!confirm("Are you sure you want to delete this admission record?")) return;
        try {
            await api.delete(`/v1/staff-editing/admissions/${id}`);
            setAdmissions(prev => prev.filter(a => a.id !== id));
            onReload();
        } catch {
            alert("Failed to delete record");
        }
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* 1. GENERAL INFORMATION */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-6 shadow-sm relative transition-all duration-200">
                <div className="absolute top-6 right-6">
                    {editGeneral ? (
                        <div className="flex gap-2">
                            <button onClick={() => setEditGeneral(false)} className="p-2 text-zinc-400 hover:text-zinc-600"><X className="h-4 w-4" /></button>
                            <button onClick={saveStudentYear} className="px-3 h-8 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center gap-1">
                                {savingYear ? "..." : <Save className="h-3 w-3" />} Save
                            </button>
                        </div>
                    ) : (
                        <button onClick={() => setEditGeneral(true)} className="p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl text-zinc-400"><Pencil className="h-4 w-4" /></button>
                    )}
                </div>

                <h3 className="text-[16px] font-extrabold text-zinc-900 dark:text-zinc-100 mb-6 tracking-tight flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-indigo-500 shrink-0" />
                    Admission Info
                </h3>

                {editGeneral ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="Current Academic Year"><Input value={studentYear} onChange={setStudentYear} placeholder="e.g. 2024-25" /></Field>
                        <Field label="Date of Admission"><input type="date" value={studentDoa} onChange={e => setStudentDoa(e.target.value)} className="w-full h-10 px-3 text-[13px] font-medium text-zinc-855 bg-white border border-zinc-200 rounded-xl outline-none focus:border-indigo-500" /></Field>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-[12px] font-bold text-zinc-400 uppercase tracking-tight">Current Academic Year</p>
                            <p className="text-[14px] font-semibold text-zinc-800 dark:text-zinc-200 mt-1">{student.academic_year || "N/A"}</p>
                        </div>
                        <div>
                            <p className="text-[12px] font-bold text-zinc-400 uppercase tracking-tight">Date of Admission</p>
                            <p className="text-[14px] font-semibold text-zinc-800 dark:text-zinc-200 mt-1">
                                {student.date_of_admission ? new Date(student.date_of_admission).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "N/A"}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* 2. APPLICATION HISTORY */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-[16px] font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">Application history</h3>
                        <p className="text-[11px] text-zinc-400 font-semibold uppercase mt-1">Previous admission and application records</p>
                    </div>
                    <button
                        onClick={() => setNewRow(newRow ? null : { academic_system: "", academic_year: "", application_date: "", discipline: "" })}
                        className={`flex items-center gap-1.5 px-3 h-8 text-[11px] font-bold rounded-xl transition-all ${newRow ? "bg-zinc-100 text-zinc-500" : "bg-indigo-50 text-indigo-650 hover:bg-indigo-100"}`}
                    >
                        {newRow ? "Cancel" : <><Plus className="h-3.5 w-3.5" /> Add Record</>}
                    </button>
                </div>

                {newRow && (
                    <div className="bg-zinc-50 dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-5 mb-6 space-y-4 animate-in slide-in-from-top-4 duration-300">
                        <h4 className="text-[12px] font-bold text-zinc-900 dark:text-zinc-100 uppercase">New Admission Record</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label="Academic System"><Select value={newRow.academic_system} onChange={v => setNewRow((p: any) => ({ ...p, academic_system: v }))} options={systems} placeholder="Select System" /></Field>
                            <Field label="Discipline"><Select value={newRow.discipline} onChange={v => setNewRow((p: any) => ({ ...p, discipline: v }))} options={DISCIPLINES} placeholder="Select Discipline" /></Field>
                            <Field label="Admission Taken In"><Input value={newRow.academic_year} onChange={v => setNewRow((p: any) => ({ ...p, academic_year: v }))} placeholder="e.g. 2024-25" /></Field>
                            <Field label="Application Date"><input type="date" value={newRow.application_date} onChange={e => setNewRow((p: any) => ({ ...p, application_date: e.target.value }))} className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-xl outline-none text-[13px]" /></Field>
                        </div>
                        <button onClick={saveNew} disabled={savingNew} className="px-4 h-9 bg-indigo-600 text-white rounded-xl text-[11px] font-bold">Add Record</button>
                    </div>
                )}

                <div className="space-y-4">
                    {admissions.map(a => (
                        <div key={a.id} className="p-4 bg-zinc-50 dark:bg-zinc-800/25 border border-zinc-100 dark:border-zinc-800 rounded-2xl relative transition-all duration-200">
                            <div className="absolute top-4 right-4 flex items-center gap-2">
                                {editingAdmissionId === a.id ? (
                                    <div className="flex gap-2">
                                        <button onClick={() => setEditingAdmissionId(null)} className="p-1.5 text-zinc-400"><X className="h-4 w-4" /></button>
                                        <button onClick={() => handleSaveAdmission(a.id)} className="px-2.5 h-7 text-[10px] bg-indigo-600 text-white rounded-lg">Save</button>
                                    </div>
                                ) : (
                                    <>
                                        <button onClick={() => handleStartEditAdmission(a)} className="p-1.5 text-zinc-400 hover:text-zinc-600"><Pencil className="h-4 w-4" /></button>
                                        <button onClick={() => handleDeleteAdmission(a.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                                    </>
                                )}
                            </div>

                            {editingAdmissionId === a.id ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-16">
                                    <Field label="Academic System"><Select value={editAdmissionState.academic_system} onChange={v => setEditAdmissionState((p: any) => ({ ...p, academic_system: v }))} options={systems} placeholder="Select System" /></Field>
                                    <Field label="Discipline"><Select value={editAdmissionState.discipline} onChange={v => setEditAdmissionState((p: any) => ({ ...p, discipline: v }))} options={DISCIPLINES} placeholder="Select Discipline" /></Field>
                                    <Field label="Admission Taken In"><Input value={editAdmissionState.academic_year} onChange={v => setEditAdmissionState((p: any) => ({ ...p, academic_year: v }))} placeholder="e.g. 2024-25" /></Field>
                                    <Field label="Application Date"><input type="date" value={editAdmissionState.application_date} onChange={e => setEditAdmissionState((p: any) => ({ ...p, application_date: e.target.value }))} className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-xl outline-none text-[13px]" /></Field>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight">Academic System</p>
                                        <p className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 uppercase">{a.academic_system || "N/A"}</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight">Discipline</p>
                                        <p className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 uppercase">{a.discipline || "N/A"}</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight">Admission taken in</p>
                                        <p className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 uppercase">{a.academic_year || "N/A"}</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight">Application Date</p>
                                        <p className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5">
                                            {a.application_date ? new Date(a.application_date).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "N/A"}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {admissions.length === 0 && !newRow && (
                        <p className="italic text-zinc-400 text-center py-6">No application history records available.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
