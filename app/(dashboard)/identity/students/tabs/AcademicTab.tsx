"use client";
import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Loader2, CheckCircle2, GraduationCap, Pencil, BookOpen, Heart, Activity, Languages, Milestone, X } from "lucide-react";
import api from "@/lib/api";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">{label}</label>
            {children}
        </div>
    );
}

function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
    return (
        <input type={type} value={value ?? ""} 
            onChange={e => onChange(e.target.value.toUpperCase())} 
            placeholder={placeholder}
            className="w-full h-10 px-3 text-[13px] font-medium text-zinc-800 bg-white border border-zinc-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all uppercase" />
    );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="flex items-center gap-2 cursor-pointer">
            <div onClick={() => onChange(!checked)} className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-indigo-600" : "bg-zinc-200"}`}>
                <span className={`absolute top-0.5 left-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
            </div>
            <span className="text-[12px] font-bold text-zinc-650 uppercase">{label}</span>
        </label>
    );
}

const getAcademicYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = 2015; y <= currentYear + 15; y++) {
        years.push(`${y}-${y + 1}`);
    }
    return years;
};

export function AcademicTab({ student, onReload }: { student: any; onReload: () => void }) {
    const [studentYear, setStudentYear] = useState(student.academic_year || "");
    const [studentDoa, setStudentDoa] = useState(student.date_of_admission ? new Date(student.date_of_admission).toISOString().split("T")[0] : "");
    const [studentHouseId, setStudentHouseId] = useState<string>(student.house_id != null ? String(student.house_id) : "");
    const [housesList, setHousesList] = useState<Array<{ id: number; house_name: string; house_color: string }>>([]);
    const [savingGeneral, setSavingGeneral] = useState(false);
    const [savedGeneral, setSavedGeneral] = useState(false);
    const [editGeneral, setEditGeneral] = useState(false);

    const houseName = student.house_name || student.houses?.house_name || null;
    const houseColor = student.house_color || student.houses?.house_color || null;

    // Sync state
    useEffect(() => {
        setStudentYear(student.academic_year || "");
        setStudentDoa(student.date_of_admission ? new Date(student.date_of_admission).toISOString().split("T")[0] : "");
        setStudentHouseId(student.house_id != null ? String(student.house_id) : "");
    }, [student]);

    useEffect(() => {
        if (editGeneral && student?.cc && housesList.length === 0) {
            api.get(`/v1/enrollments/${student.cc}/suggestions`)
                .then(res => {
                    const houses = res?.data?.data?.all_houses || res?.data?.all_houses || [];
                    setHousesList(houses);
                })
                .catch(() => {});
        }
    }, [editGeneral, student?.cc, housesList.length]);

    const handleSaveGeneral = async () => {
        setSavingGeneral(true);
        try {
            await api.patch(`/v1/staff-editing/students/${student.cc}`, {
                academic_year: studentYear,
                doa: studentDoa,
                house_id: studentHouseId ? Number(studentHouseId) : null,
            });
            setSavedGeneral(true);
            setTimeout(() => setSavedGeneral(false), 2000);
            setEditGeneral(false);
            onReload();
        } catch {
            alert("Failed to update general information");
        } finally {
            setSavingGeneral(false);
        }
    };

    const isALevel = student.academic_system === "A-Level" || 
                     student.admissions?.some((a: any) => a.academic_system === "A-Level") ||
                     !!student.alevel_details;

    // Previous Schools timeline states
    const [schools, setSchools] = useState<any[]>(student.previous_schools || []);
    const [editSchools, setEditSchools] = useState(false);
    const [newSchool, setNewSchool] = useState<any | null>(null);

    // Activities & Languages states
    const [activities, setActivities] = useState<any[]>(student.activities || []);
    const [editActivities, setEditActivities] = useState(false);
    const [newActivity, setNewActivity] = useState<any | null>(null);

    const [languages, setLanguages] = useState<any[]>(student.languages || []);
    const [editLanguages, setEditLanguages] = useState(false);
    const [newLanguage, setNewLanguage] = useState<any | null>(null);

    useEffect(() => {
        setSchools(student.previous_schools || []);
        setActivities(student.activities || []);
        setLanguages(student.languages || []);
    }, [student]);

    const handleAddSchool = async () => {
        if (!newSchool.school_name) return alert("School name is required");
        try {
            const { data } = await api.post(`/v1/staff-editing/students/${student.cc}/schools`, newSchool);
            setSchools(prev => [...prev, data?.data]);
            setNewSchool(null);
            onReload();
        } catch {
            alert("Failed to add school");
        }
    };

    const handleDeleteSchool = async (id: number) => {
        if (!confirm("Are you sure?")) return;
        try {
            await api.delete(`/v1/staff-editing/schools/${id}`);
            setSchools(prev => prev.filter(s => s.id !== id));
            onReload();
        } catch {
            alert("Failed to delete school");
        }
    };

    const handleAddActivity = async () => {
        if (!newActivity.activity_name) return alert("Activity name is required");
        try {
            const { data } = await api.post(`/v1/staff-editing/students/${student.cc}/activities`, newActivity);
            setActivities(prev => [...prev, data?.data]);
            setNewActivity(null);
            onReload();
        } catch {
            alert("Failed to add activity");
        }
    };

    const handleDeleteActivity = async (id: number) => {
        if (!confirm("Are you sure?")) return;
        try {
            await api.delete(`/v1/staff-editing/activities/${id}`);
            setActivities(prev => prev.filter(a => a.id !== id));
            onReload();
        } catch {
            alert("Failed to delete activity");
        }
    };

    const handleAddLanguage = async () => {
        if (!newLanguage.language_name) return alert("Language name is required");
        try {
            const { data } = await api.post(`/v1/staff-editing/students/${student.cc}/languages`, newLanguage);
            setLanguages(prev => [...prev, data?.data]);
            setNewLanguage(null);
            onReload();
        } catch {
            alert("Failed to add language");
        }
    };

    const handleDeleteLanguage = async (id: number) => {
        if (!confirm("Are you sure?")) return;
        try {
            await api.delete(`/v1/staff-editing/languages/${id}`);
            setLanguages(prev => prev.filter(l => l.id !== id));
            onReload();
        } catch {
            alert("Failed to delete language");
        }
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* 1. GENERAL ACADEMIC INFO */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-6 shadow-sm relative transition-all duration-200">
                <div className="absolute top-6 right-6">
                    {editGeneral ? (
                        <div className="flex gap-2">
                            <button onClick={() => setEditGeneral(false)} className="p-2 text-zinc-400 hover:text-zinc-655"><X className="h-4 w-4" /></button>
                            <button onClick={handleSaveGeneral} className="px-3 h-8 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center gap-1">
                                {savingGeneral ? "..." : <Save className="h-3 w-3" />} Save
                            </button>
                        </div>
                    ) : (
                        <button onClick={() => setEditGeneral(true)} className="p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl text-zinc-400"><Pencil className="h-4 w-4" /></button>
                    )}
                </div>

                <h3 className="text-[16px] font-extrabold text-zinc-950 dark:text-zinc-100 mb-6 tracking-tight flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-indigo-600 shrink-0" />
                    <span>General Academic Info</span>
                </h3>

                {editGeneral ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Field label="Current Academic Year">
                            <select
                                value={studentYear}
                                onChange={e => setStudentYear(e.target.value)}
                                className="w-full h-10 px-3 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all cursor-pointer"
                            >
                                <option value="">Select Academic Year</option>
                                {getAcademicYears().map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="House">
                            <select
                                value={studentHouseId}
                                onChange={e => setStudentHouseId(e.target.value)}
                                className="w-full h-10 px-3 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all cursor-pointer"
                            >
                                <option value="">Select House</option>
                                {housesList.map(h => (
                                    <option key={h.id} value={String(h.id)}>
                                        {h.house_name}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Date of Admission">
                            <input
                                type="date"
                                value={studentDoa}
                                onChange={e => setStudentDoa(e.target.value)}
                                className="w-full h-10 px-3 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-indigo-500 transition-all"
                            />
                        </Field>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <p className="text-[12px] font-bold text-zinc-400 uppercase tracking-tight">Current Academic Year</p>
                            <p className="text-[14px] font-semibold text-zinc-800 dark:text-zinc-200 mt-1">{student.academic_year || "N/A"}</p>
                        </div>
                        <div>
                            <p className="text-[12px] font-bold text-zinc-400 uppercase tracking-tight">House</p>
                            <div className="mt-1 flex items-center gap-2">
                                {houseName ? (
                                    <span className="inline-flex items-center gap-2 text-[14px] font-semibold text-zinc-800 dark:text-zinc-200">
                                        <span
                                            className="h-3 w-3 rounded-full shrink-0 shadow-sm border border-black/10 dark:border-white/10"
                                            style={{ backgroundColor: houseColor || "#94a3b8" }}
                                        />
                                        <span>{houseName}</span>
                                    </span>
                                ) : (
                                    <span className="text-[14px] font-semibold text-zinc-400">N/A</span>
                                )}
                            </div>
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

            {/* 2. EDUCATION TIMELINE (PREVIOUS SCHOOLS) */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-6 shadow-sm relative transition-all duration-200">
                <div className="absolute top-6 right-6">
                    <button onClick={() => setEditSchools(!editSchools)} className="p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl text-zinc-400">
                        {editSchools ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                    </button>
                </div>

                <h3 className="text-[16px] font-extrabold text-zinc-900 dark:text-zinc-100 mb-6 tracking-tight flex items-center gap-2">
                    <Milestone className="h-5 w-5 text-indigo-500 shrink-0" />
                    Education History
                </h3>

                {editSchools && (
                    <div className="bg-zinc-50 dark:bg-zinc-800/40 border rounded-2xl p-4 mb-6 space-y-4">
                        <h4 className="text-[12px] font-bold text-zinc-900 dark:text-zinc-100 uppercase">Add Previous School</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Field label="School Name"><input type="text" value={newSchool?.school_name || ""} onChange={e => setNewSchool((p: any) => ({ ...p, school_name: e.target.value }))} className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-xl outline-none text-[13px] uppercase" /></Field>
                            <Field label="Location"><input type="text" value={newSchool?.location || ""} onChange={e => setNewSchool((p: any) => ({ ...p, location: e.target.value }))} className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-xl outline-none text-[13px] uppercase" /></Field>
                            <Field label="Grade From"><input type="text" value={newSchool?.class_studied_from || ""} onChange={e => setNewSchool((p: any) => ({ ...p, class_studied_from: e.target.value }))} className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-xl outline-none text-[13px] uppercase" /></Field>
                            <Field label="Grade To"><input type="text" value={newSchool?.class_studied_to || ""} onChange={e => setNewSchool((p: any) => ({ ...p, class_studied_to: e.target.value }))} className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-xl outline-none text-[13px] uppercase" /></Field>
                            <div className="col-span-2">
                                <Field label="Reason for Leaving"><input type="text" value={newSchool?.reason_for_leaving || ""} onChange={e => setNewSchool((p: any) => ({ ...p, reason_for_leaving: e.target.value }))} className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-xl outline-none text-[13px] uppercase" /></Field>
                            </div>
                        </div>
                        <button onClick={handleAddSchool} className="px-4 h-9 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-bold">Add School</button>
                    </div>
                )}

                {schools.length > 0 ? (
                    <div className="relative pl-6 border-l border-zinc-100 dark:border-zinc-800 ml-4 space-y-8">
                        {schools.map(s => (
                            <div key={s.id} className="relative group animate-in fade-in duration-300">
                                {/* Chronological timeline dot */}
                                <div className="absolute -left-[31px] top-1.5 h-4 w-4 bg-white dark:bg-zinc-900 border-2 border-indigo-600 rounded-full flex items-center justify-center shrink-0 z-10" />
                                
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <h4 className="text-[14px] font-extrabold text-zinc-800 dark:text-zinc-200 uppercase">{s.school_name}</h4>
                                        <p className="text-[12px] text-zinc-500 font-bold uppercase">{s.location || "Location N/A"}</p>
                                        <p className="text-[11px] text-zinc-400 font-semibold uppercase mt-1">
                                            Grades: {s.class_studied_from || "?"} - {s.class_studied_to || "?"} {s.reason_for_leaving ? `· Reason: ${s.reason_for_leaving}` : ""}
                                        </p>
                                    </div>
                                    {editSchools && (
                                        <button onClick={() => handleDeleteSchool(s.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors border border-transparent hover:border-rose-100">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="italic text-zinc-400 text-center py-6">No previous school history logged.</p>
                )}
            </div>

            {/* 3. ACTIVITIES & LANGUAGES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Activities Card */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-6 shadow-sm relative transition-all duration-200">
                    <div className="absolute top-6 right-6">
                        <button onClick={() => setEditActivities(!editActivities)} className="p-2 hover:bg-zinc-50 rounded-xl text-zinc-400">
                            {editActivities ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                        </button>
                    </div>

                    <h3 className="text-[16px] font-extrabold text-zinc-900 dark:text-zinc-100 mb-6 tracking-tight flex items-center gap-2">
                        <Activity className="h-5 w-5 text-indigo-500 shrink-0" />
                        Activities
                    </h3>

                    {editActivities && (
                        <div className="bg-zinc-50 dark:bg-zinc-800/40 border rounded-2xl p-4 mb-4 space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                <Field label="Activity Name"><input type="text" value={newActivity?.activity_name || ""} onChange={e => setNewActivity((p: any) => ({ ...p, activity_name: e.target.value }))} className="w-full h-8 px-2 text-[12px] bg-white border rounded-lg uppercase" /></Field>
                                <Field label="Grade"><input type="text" value={newActivity?.grade || ""} onChange={e => setNewActivity((p: any) => ({ ...p, grade: e.target.value }))} className="w-full h-8 px-2 text-[12px] bg-white border rounded-lg uppercase" /></Field>
                                <div className="col-span-2">
                                    <Field label="Awards"><input type="text" value={newActivity?.honors_awards || ""} onChange={e => setNewActivity((p: any) => ({ ...p, honors_awards: e.target.value }))} className="w-full h-8 px-2 text-[12px] bg-white border rounded-lg uppercase" /></Field>
                                </div>
                            </div>
                            <button onClick={handleAddActivity} className="px-3 h-8 bg-indigo-600 text-white rounded-lg text-[10px] font-bold">Add</button>
                        </div>
                    )}

                    <div className="space-y-3">
                        {activities.map(a => (
                            <div key={a.id} className="p-3 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800 rounded-xl flex items-center justify-between gap-3">
                                <div>
                                    <h4 className="font-bold text-zinc-800 dark:text-zinc-200 uppercase text-[13px]">{a.activity_name}</h4>
                                    <p className="text-[10px] text-zinc-400 font-bold uppercase mt-0.5">Grade: {a.grade || "N/A"} {a.honors_awards ? `· Award: ${a.honors_awards}` : ""}</p>
                                </div>
                                {editActivities && (
                                    <button onClick={() => handleDeleteActivity(a.id)} className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                        {activities.length === 0 && (
                            <p className="italic text-zinc-400 text-center py-4 text-sm">No extracurricular activities logged.</p>
                        )}
                    </div>
                </div>

                {/* Languages Card */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-6 shadow-sm relative transition-all duration-200">
                    <div className="absolute top-6 right-6">
                        <button onClick={() => setEditLanguages(!editLanguages)} className="p-2 hover:bg-zinc-50 rounded-xl text-zinc-400">
                            {editLanguages ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                        </button>
                    </div>

                    <h3 className="text-[16px] font-extrabold text-zinc-900 dark:text-zinc-100 mb-6 tracking-tight flex items-center gap-2">
                        <Languages className="h-5 w-5 text-indigo-500 shrink-0" />
                        Languages
                    </h3>

                    {editLanguages && (
                        <div className="bg-zinc-50 dark:bg-zinc-800/40 border rounded-2xl p-4 mb-4 space-y-3">
                            <Field label="Language"><input type="text" value={newLanguage?.language_name || ""} onChange={e => setNewLanguage((p: any) => ({ ...p, language_name: e.target.value }))} className="w-full h-8 px-2 text-[12px] bg-white border rounded-lg uppercase" /></Field>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!newLanguage?.can_speak} onChange={e => setNewLanguage((p: any) => ({ ...p, can_speak: e.target.checked }))} /> <span className="text-[11px] font-bold text-zinc-500">Speak</span></label>
                                <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!newLanguage?.can_read} onChange={e => setNewLanguage((p: any) => ({ ...p, can_read: e.target.checked }))} /> <span className="text-[11px] font-bold text-zinc-500">Read</span></label>
                                <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!newLanguage?.can_write} onChange={e => setNewLanguage((p: any) => ({ ...p, can_write: e.target.checked }))} /> <span className="text-[11px] font-bold text-zinc-500">Write</span></label>
                            </div>
                            <button onClick={handleAddLanguage} className="px-3 h-8 bg-indigo-600 text-white rounded-lg text-[10px] font-bold">Add</button>
                        </div>
                    )}

                    <div className="space-y-3">
                        {languages.map(l => (
                            <div key={l.id} className="p-3 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800 rounded-xl flex items-center justify-between gap-3">
                                <div>
                                    <h4 className="font-bold text-zinc-800 dark:text-zinc-200 uppercase text-[13px]">{l.language_name}</h4>
                                    <div className="flex gap-2 mt-1">
                                        {l.can_speak && <span className="text-[9px] bg-indigo-50 border border-indigo-100 text-indigo-600 px-1.5 rounded uppercase font-black">Speak</span>}
                                        {l.can_read && <span className="text-[9px] bg-emerald-50 border border-emerald-100 text-emerald-600 px-1.5 rounded uppercase font-black">Read</span>}
                                        {l.can_write && <span className="text-[9px] bg-purple-50 border border-purple-100 text-purple-600 px-1.5 rounded uppercase font-black">Write</span>}
                                    </div>
                                </div>
                                {editLanguages && (
                                    <button onClick={() => handleDeleteLanguage(l.id)} className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                        {languages.length === 0 && (
                            <p className="italic text-zinc-400 text-center py-4 text-sm">No spoken languages logged.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
