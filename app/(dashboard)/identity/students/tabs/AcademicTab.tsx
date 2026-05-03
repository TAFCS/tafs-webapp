"use client";
import { useState } from "react";
import { Plus, Trash2, Save, Loader2, CheckCircle2 } from "lucide-react";
import api from "@/lib/api";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{label}</label>
            {children}
        </div>
    );
}

function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
    return (
        <input type={type} value={value ?? ""} 
            onChange={e => onChange(e.target.value.toUpperCase())} 
            placeholder={placeholder}
            className="w-full h-9 px-3 text-[13px] font-medium text-zinc-800 bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all uppercase" />
    );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="flex items-center gap-2 cursor-pointer">
            <div onClick={() => onChange(!checked)} className={`relative h-4 w-8 rounded-full transition-colors ${checked ? "bg-primary" : "bg-zinc-200"}`}>
                <span className={`absolute top-0.5 left-0.5 h-3 w-3 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
            </div>
            <span className="text-[12px] font-medium text-zinc-600">{label}</span>
        </label>
    );
}

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

// ── Activity Row ──────────────────────────────────────────────────
function ActivityRow({ item, studentCc, onSaved, onDeleted }: { item: any; studentCc: number; onSaved: (a: any) => void; onDeleted: () => void }) {
    const [local, setLocal] = useState(item);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [removing, setRemoving] = useState(false);
    const set = (k: string, v: any) => setLocal((p: any) => ({ ...p, [k]: v }));

    const isDirty = (local.activity_name || "") !== (item.activity_name || "") ||
                    (local.grade || "") !== (item.grade || "") ||
                    (local.honors_awards || "") !== (item.honors_awards || "") ||
                    !!local.continue_at_tafs !== !!item.continue_at_tafs;

    const save = async () => {
        setSaving(true);
        try { 
            const { data } = await api.post(`/v1/staff-editing/students/${studentCc}/activities`, local); 
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
            onSaved(data?.data); 
        } finally { setSaving(false); }
    };
    const remove = async () => {
        if (!confirm("Delete this activity?")) return;
        setRemoving(true);
        try { await api.delete(`/v1/staff-editing/activities/${local.id}`); onDeleted(); }
        finally { setRemoving(false); }
    };

    return (
        <div className={`bg-white border rounded-xl p-3 space-y-2 transition-all ${isDirty ? "border-amber-200 shadow-sm" : "border-zinc-100"}`}>
            <div className="grid grid-cols-2 gap-2">
                <Field label="Activity"><Input value={local.activity_name ?? ""} onChange={v => set("activity_name", v)} placeholder="e.g. Football" /></Field>
                <Field label="Grade"><Input value={local.grade ?? ""} onChange={v => set("grade", v)} placeholder="A, B, C..." /></Field>
                <div className="col-span-2"><Field label="Honours / Awards"><Input value={local.honors_awards ?? ""} onChange={v => set("honors_awards", v)} /></Field></div>
                <Toggle label="Continue at TAFS" checked={!!local.continue_at_tafs} onChange={v => set("continue_at_tafs", v)} />
            </div>
            <div className="flex items-center gap-2">
                <RowSaveBtn onSave={save} isSaving={saving} saved={saved} isDirty={isDirty} />
                <button onClick={remove} disabled={saving || removing} className="h-7 w-7 flex items-center justify-center text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                    {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                </button>
            </div>
        </div>
    );
}

// ── Language Row ──────────────────────────────────────────────────
function LanguageRow({ item, studentCc, onSaved, onDeleted }: { item: any; studentCc: number; onSaved: (a: any) => void; onDeleted: () => void }) {
    const [local, setLocal] = useState(item);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [removing, setRemoving] = useState(false);
    const set = (k: string, v: any) => setLocal((p: any) => ({ ...p, [k]: v }));

    const isDirty = (local.language_name || "") !== (item.language_name || "") ||
                    !!local.can_speak !== !!item.can_speak ||
                    !!local.can_read !== !!item.can_read ||
                    !!local.can_write !== !!item.can_write;

    const save = async () => {
        setSaving(true);
        try { 
            const { data } = await api.post(`/v1/staff-editing/students/${studentCc}/languages`, local); 
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
            onSaved(data?.data); 
        } finally { setSaving(false); }
    };
    const remove = async () => {
        if (!confirm("Delete this language?")) return;
        setRemoving(true);
        try { await api.delete(`/v1/staff-editing/languages/${local.id}`); onDeleted(); }
        finally { setRemoving(false); }
    };

    return (
        <div className={`bg-white border rounded-xl p-3 space-y-2 transition-all ${isDirty ? "border-amber-200 shadow-sm" : "border-zinc-100"}`}>
            <Field label="Language"><Input value={local.language_name ?? ""} onChange={v => set("language_name", v)} placeholder="e.g. Urdu" /></Field>
            <div className="flex gap-4">
                <Toggle label="Speak" checked={!!local.can_speak} onChange={v => set("can_speak", v)} />
                <Toggle label="Read"  checked={!!local.can_read}  onChange={v => set("can_read", v)} />
                <Toggle label="Write" checked={!!local.can_write} onChange={v => set("can_write", v)} />
            </div>
            <div className="flex items-center gap-2">
                <RowSaveBtn onSave={save} isSaving={saving} saved={saved} isDirty={isDirty} />
                <button onClick={remove} disabled={saving || removing} className="h-7 w-7 flex items-center justify-center text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                    {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                </button>
            </div>
        </div>
    );
}

// ── School Row ────────────────────────────────────────────────────
function SchoolRow({ item, studentCc, onSaved, onDeleted }: { item: any; studentCc: number; onSaved: (a: any) => void; onDeleted: () => void }) {
    const [local, setLocal] = useState(item);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [removing, setRemoving] = useState(false);
    const set = (k: string, v: any) => setLocal((p: any) => ({ ...p, [k]: v }));

    const isDirty = (local.school_name || "") !== (item.school_name || "") ||
                    (local.location || "") !== (item.location || "") ||
                    (local.reason_for_leaving || "") !== (item.reason_for_leaving || "") ||
                    (local.class_studied_from || "") !== (item.class_studied_from || "") ||
                    (local.class_studied_to || "") !== (item.class_studied_to || "");

    const save = async () => {
        setSaving(true);
        try { 
            const { data } = await api.post(`/v1/staff-editing/students/${studentCc}/schools`, local); 
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
            onSaved(data?.data); 
        } finally { setSaving(false); }
    };
    const remove = async () => {
        if (!confirm("Delete this school?")) return;
        setRemoving(true);
        try { await api.delete(`/v1/staff-editing/schools/${local.id}`); onDeleted(); }
        finally { setRemoving(false); }
    };

    return (
        <div className={`bg-white border rounded-xl p-3 space-y-2 transition-all ${isDirty ? "border-amber-200 shadow-sm" : "border-zinc-100"}`}>
            <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2"><Field label="School Name"><Input value={local.school_name ?? ""} onChange={v => set("school_name", v)} /></Field></div>
                <Field label="Location"><Input value={local.location ?? ""} onChange={v => set("location", v)} /></Field>
                <Field label="Reason for Leaving"><Input value={local.reason_for_leaving ?? ""} onChange={v => set("reason_for_leaving", v)} /></Field>
                <Field label="Grade From"><Input value={local.class_studied_from ?? ""} onChange={v => set("class_studied_from", v)} /></Field>
                <Field label="Grade To"><Input value={local.class_studied_to ?? ""} onChange={v => set("class_studied_to", v)} /></Field>
            </div>
            <div className="flex items-center gap-2">
                <RowSaveBtn onSave={save} isSaving={saving} saved={saved} isDirty={isDirty} />
                <button onClick={remove} disabled={saving || removing} className="h-7 w-7 flex items-center justify-center text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                    {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                </button>
            </div>
        </div>
    );
}

// ── Section Wrappers ──────────────────────────────────────────────
function ActivitiesSection({ studentCc, initial }: { studentCc: number; initial: any[] }) {
    const [items, setItems] = useState<any[]>(initial);
    const [newItem, setNewItem] = useState<any | null>(null);
    const [savingNew, setSavingNew] = useState(false);
    const [savedNew, setSavedNew] = useState(false);
    const set = (k: string, v: any) => setNewItem((p: any) => ({ ...p, [k]: v }));

    const saveNew = async () => {
        if (!newItem.activity_name) return alert("Activity name is required");
        setSavingNew(true);
        try { 
            const { data } = await api.post(`/v1/staff-editing/students/${studentCc}/activities`, newItem); 
            setItems(p => [data?.data, ...p]); 
            setSavedNew(true);
            setTimeout(() => {
                setSavedNew(false);
                setNewItem(null);
            }, 1500);
            setNewItem(null);
        } finally { setSavingNew(false); }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Activities</span>
                <button onClick={() => setNewItem(newItem ? null : { activity_name: "", grade: "", honors_awards: "", continue_at_tafs: true })} className={`flex items-center gap-1 px-2.5 h-7 text-[11px] font-bold rounded-lg transition-all ${newItem ? "bg-zinc-100 text-zinc-500" : "bg-primary/10 text-primary hover:bg-primary/20"}`}>
                    {newItem ? "Cancel" : <><Plus className="h-3 w-3" /> Add</>}
                </button>
            </div>
            {newItem && (
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 space-y-2 shadow-sm">
                    <div className="grid grid-cols-2 gap-2">
                        <Field label="Activity"><Input value={newItem.activity_name} onChange={v => set("activity_name", v)} /></Field>
                        <Field label="Grade"><Input value={newItem.grade} onChange={v => set("grade", v)} /></Field>
                        <div className="col-span-2"><Field label="Honours"><Input value={newItem.honors_awards} onChange={v => set("honors_awards", v)} /></Field></div>
                        <Toggle label="Continue at TAFS" checked={!!newItem.continue_at_tafs} onChange={v => set("continue_at_tafs", v)} />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={saveNew} disabled={savingNew || savedNew} className={`flex items-center gap-1.5 px-4 h-7 text-[11px] font-bold text-white rounded-lg transition-all ${savedNew ? "bg-emerald-500" : "bg-primary hover:bg-primary/90 disabled:opacity-50"}`}>
                            {savingNew ? <Loader2 className="h-3 w-3 animate-spin" /> : savedNew ? <CheckCircle2 className="h-3 w-3" /> : <Save className="h-3 w-3" />}
                            {savingNew ? "Submitting..." : savedNew ? "Submitted" : "Add Activity"}
                        </button>
                    </div>
                </div>
            )}
            {items.map(item => (
                <ActivityRow key={item.id} item={item} studentCc={studentCc}
                    onSaved={u => setItems(p => p.map(x => x.id === u.id ? u : x))}
                    onDeleted={() => setItems(p => p.filter(x => x.id !== item.id))} />
            ))}
            {items.length === 0 && !newItem && <p className="text-zinc-400 text-[12px] text-center py-4">No activities</p>}
        </div>
    );
}

function LanguagesSection({ studentCc, initial }: { studentCc: number; initial: any[] }) {
    const [items, setItems] = useState<any[]>(initial);
    const [newItem, setNewItem] = useState<any | null>(null);
    const [savingNew, setSavingNew] = useState(false);
    const [savedNew, setSavedNew] = useState(false);
    const set = (k: string, v: any) => setNewItem((p: any) => ({ ...p, [k]: v }));

    const saveNew = async () => {
        if (!newItem.language_name) return alert("Language name is required");
        setSavingNew(true);
        try { 
            const { data } = await api.post(`/v1/staff-editing/students/${studentCc}/languages`, newItem); 
            setItems(p => [data?.data, ...p]); 
            setSavedNew(true);
            setTimeout(() => setSavedNew(false), 1500);
            setNewItem(null);
        } finally { setSavingNew(false); }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Languages</span>
                <button onClick={() => setNewItem(newItem ? null : { language_name: "", can_speak: false, can_read: false, can_write: false })} className={`flex items-center gap-1 px-2.5 h-7 text-[11px] font-bold rounded-lg transition-all ${newItem ? "bg-zinc-100 text-zinc-500" : "bg-primary/10 text-primary hover:bg-primary/20"}`}>
                    {newItem ? "Cancel" : <><Plus className="h-3 w-3" /> Add</>}
                </button>
            </div>
            {newItem && (
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 space-y-2 shadow-sm">
                    <Field label="Language"><Input value={newItem.language_name} onChange={v => set("language_name", v)} /></Field>
                    <div className="flex gap-4">
                        <Toggle label="Speak" checked={!!newItem.can_speak} onChange={v => set("can_speak", v)} />
                        <Toggle label="Read"  checked={!!newItem.can_read}  onChange={v => set("can_read", v)} />
                        <Toggle label="Write" checked={!!newItem.can_write} onChange={v => set("can_write", v)} />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={saveNew} disabled={savingNew || savedNew} className={`flex items-center gap-1.5 px-4 h-7 text-[11px] font-bold text-white rounded-lg transition-all ${savedNew ? "bg-emerald-500" : "bg-primary hover:bg-primary/90 disabled:opacity-50"}`}>
                            {savingNew ? <Loader2 className="h-3 w-3 animate-spin" /> : savedNew ? <CheckCircle2 className="h-3 w-3" /> : <Save className="h-3 w-3" />}
                            {savingNew ? "Submitting..." : savedNew ? "Submitted" : "Add Language"}
                        </button>
                    </div>
                </div>
            )}
            {items.map(item => (
                <LanguageRow key={item.id} item={item} studentCc={studentCc}
                    onSaved={u => setItems(p => p.map(x => x.id === u.id ? u : x))}
                    onDeleted={() => setItems(p => p.filter(x => x.id !== item.id))} />
            ))}
            {items.length === 0 && !newItem && <p className="text-zinc-400 text-[12px] text-center py-4">No languages</p>}
        </div>
    );
}

function SchoolsSection({ studentCc, initial }: { studentCc: number; initial: any[] }) {
    const [items, setItems] = useState<any[]>(initial);
    const [newItem, setNewItem] = useState<any | null>(null);
    const [savingNew, setSavingNew] = useState(false);
    const [savedNew, setSavedNew] = useState(false);
    const set = (k: string, v: any) => setNewItem((p: any) => ({ ...p, [k]: v }));

    const saveNew = async () => {
        if (!newItem.school_name) return alert("School name is required");
        setSavingNew(true);
        try { 
            const { data } = await api.post(`/v1/staff-editing/students/${studentCc}/schools`, newItem); 
            setItems(p => [data?.data, ...p]); 
            setSavedNew(true);
            setTimeout(() => setSavedNew(false), 1500);
            setNewItem(null);
        } finally { setSavingNew(false); }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Previous Schools</span>
                <button onClick={() => setNewItem(newItem ? null : { school_name: "", location: "", reason_for_leaving: "", class_studied_from: "", class_studied_to: "" })} className={`flex items-center gap-1 px-2.5 h-7 text-[11px] font-bold rounded-lg transition-all ${newItem ? "bg-zinc-100 text-zinc-500" : "bg-primary/10 text-primary hover:bg-primary/20"}`}>
                    {newItem ? "Cancel" : <><Plus className="h-3 w-3" /> Add</>}
                </button>
            </div>
            {newItem && (
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 space-y-2 shadow-sm">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2"><Field label="School Name"><Input value={newItem.school_name} onChange={v => set("school_name", v)} /></Field></div>
                        <Field label="Location"><Input value={newItem.location} onChange={v => set("location", v)} /></Field>
                        <Field label="Reason"><Input value={newItem.reason_for_leaving} onChange={v => set("reason_for_leaving", v)} /></Field>
                        <Field label="Grade From"><Input value={newItem.class_studied_from} onChange={v => set("class_studied_from", v)} /></Field>
                        <Field label="Grade To"><Input value={newItem.class_studied_to} onChange={v => set("class_studied_to", v)} /></Field>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={saveNew} disabled={savingNew || savedNew} className={`flex items-center gap-1.5 px-4 h-7 text-[11px] font-bold text-white rounded-lg transition-all ${savedNew ? "bg-emerald-500" : "bg-primary hover:bg-primary/90 disabled:opacity-50"}`}>
                            {savingNew ? <Loader2 className="h-3 w-3 animate-spin" /> : savedNew ? <CheckCircle2 className="h-3 w-3" /> : <Save className="h-3 w-3" />}
                            {savingNew ? "Submitting..." : savedNew ? "Submitted" : "Add School"}
                        </button>
                    </div>
                </div>
            )}
            {items.map(item => (
                <SchoolRow key={item.id} item={item} studentCc={studentCc}
                    onSaved={u => setItems(p => p.map(x => x.id === u.id ? u : x))}
                    onDeleted={() => setItems(p => p.filter(x => x.id !== item.id))} />
            ))}
            {items.length === 0 && !newItem && <p className="text-zinc-400 text-[12px] text-center py-4">No previous schools</p>}
        </div>
    );
}

const A_LEVEL_SUBJECTS_GROUP_A = [
    { name: "BIOLOGY", code: "9700" },
    { name: "CHEMISTRY", code: "9701" },
    { name: "PHYSICS", code: "9702" },
    { name: "MATHEMATICS", code: "9709" },
    { name: "URDU", code: "9686" },
    { name: "COMPUTER SCIENCE", code: "9618" },
    { name: "SOCIOLOGY", code: "9699" },
];

const A_LEVEL_SUBJECTS_GROUP_B = [
    { name: "ACCOUNTING", code: "9706" },
    { name: "BUSINESS", code: "9707" },
    { name: "ECONOMICS", code: "9708" },
    { name: "MATHEMATICS", code: "9709" },
    { name: "URDU", code: "9686" },
    { name: "COMPUTER SCIENCE", code: "9618" },
    { name: "SOCIOLOGY", code: "9699" },
];

function ALevelDetailsSection({ studentCc, initial }: { studentCc: number; initial: any }) {
    const [local, setLocal] = useState(initial || {
        preferred_subjects_group_a: [],
        preferred_subjects_group_b: [],
        olevel_result_counts: { "A*": 0, A: 0, B: 0, C: 0, D: 0, E: 0, U: 0 },
        olevel_subjects_details: []
    });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const set = (k: string, v: any) => setLocal((p: any) => ({ ...p, [k]: v }));

    const isDirty = JSON.stringify(local) !== JSON.stringify(initial || {
        preferred_subjects_group_a: [],
        preferred_subjects_group_b: [],
        olevel_result_counts: { "A*": 0, A: 0, B: 0, C: 0, D: 0, E: 0, U: 0 },
        olevel_subjects_details: []
    });

    const save = async () => {
        setSaving(true);
        try {
            await api.post(`/v1/staff-editing/students/${studentCc}/alevel-details`, local);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch {
            alert("Failed to save A-Level details");
        } finally {
            setSaving(false);
        }
    };

    const addSubject = () => {
        set("olevel_subjects_details", [...(local.olevel_subjects_details || []), { subject: "", subjectCode: "", mockGrade: "", caieGrade: "" }]);
    };

    const removeSubject = (index: number) => {
        const next = [...(local.olevel_subjects_details || [])];
        next.splice(index, 1);
        set("olevel_subjects_details", next);
    };

    const updateSubject = (index: number, k: string, v: string) => {
        const next = [...(local.olevel_subjects_details || [])];
        next[index] = { ...next[index], [k]: v };
        set("olevel_subjects_details", next);
    };

    const togglePref = (group: 'preferred_subjects_group_a' | 'preferred_subjects_group_b', code: string) => {
        const current = local[group] || [];
        const next = current.includes(code) 
            ? current.filter((c: string) => c !== code)
            : [...current, code];
        set(group, next);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">A-Level Academic Data</span>
                <RowSaveBtn onSave={save} isSaving={saving} saved={saved} isDirty={isDirty} />
            </div>

            <div className="bg-white border border-zinc-100 rounded-2xl p-4 space-y-6">
                {/* Mock Results */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">O-Level / O3 Mock Results</label>
                        <button onClick={addSubject} className="flex items-center gap-1 px-2 h-6 text-[10px] font-bold text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-all">
                            <Plus className="h-3 w-3" /> Add Subject
                        </button>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {(local.olevel_subjects_details || []).map((sub: any, i: number) => (
                            <div key={i} className="flex gap-2 items-center bg-zinc-50/50 p-2 rounded-xl border border-zinc-100">
                                <div className="flex-[2]">
                                    <Input value={sub.subject} onChange={v => updateSubject(i, "subject", v)} placeholder="Subject" />
                                </div>
                                <div className="flex-1">
                                    <Input value={sub.subjectCode || sub.mockGrade} onChange={v => updateSubject(i, sub.subjectCode !== undefined ? "subjectCode" : "mockGrade", v)} placeholder="Code / Mock" />
                                </div>
                                <div className="flex-1">
                                    <Input value={sub.mockGrade !== undefined && sub.subjectCode !== undefined ? sub.mockGrade : sub.caieGrade} onChange={v => updateSubject(i, sub.mockGrade !== undefined && sub.subjectCode !== undefined ? "mockGrade" : "caieGrade", v)} placeholder="Grade / CAIE" />
                                </div>
                                <button onClick={() => removeSubject(i)} className="text-zinc-300 hover:text-rose-500 transition-colors p-1">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                        {(!local.olevel_subjects_details || local.olevel_subjects_details.length === 0) && (
                            <div className="col-span-full py-4 text-center border border-dashed border-zinc-200 rounded-xl">
                                <p className="text-[11px] text-zinc-400 font-medium italic">No results recorded</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Grade Counts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-50">
                    <div>
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">O-Level Grade Summary</label>
                        <div className="grid grid-cols-4 gap-2">
                            {Object.entries(local.olevel_result_counts || {}).map(([grade, count]) => (
                                <div key={grade}>
                                    <label className="block text-[9px] font-black text-zinc-400 mb-1">{grade}</label>
                                    <input 
                                        type="number" 
                                        value={count as number} 
                                        onChange={e => set("olevel_result_counts", { ...local.olevel_result_counts, [grade]: parseInt(e.target.value) || 0 })}
                                        className="w-full h-8 px-2 text-[12px] font-bold text-zinc-700 bg-white border border-zinc-200 rounded-lg outline-none focus:border-primary transition-all"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Subject Preferences</label>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[9px] font-black text-zinc-400 mb-2">Group A (Compulsory)</label>
                                <div className="flex flex-wrap gap-1">
                                    {A_LEVEL_SUBJECTS_GROUP_A.map((s) => {
                                        const isSelected = (local.preferred_subjects_group_a || []).includes(s.code);
                                        return (
                                            <button 
                                                key={s.code} 
                                                onClick={() => togglePref('preferred_subjects_group_a', s.code)}
                                                className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${isSelected ? "bg-zinc-800 text-white border-zinc-800" : "bg-zinc-100 text-zinc-400 border-zinc-200 hover:border-zinc-300"}`}
                                            >
                                                {s.name} ({s.code})
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[9px] font-black text-zinc-400 mb-2">Group B (Electives)</label>
                                <div className="flex flex-wrap gap-1">
                                    {A_LEVEL_SUBJECTS_GROUP_B.map((s) => {
                                        const isSelected = (local.preferred_subjects_group_b || []).includes(s.code);
                                        return (
                                            <button 
                                                key={s.code} 
                                                onClick={() => togglePref('preferred_subjects_group_b', s.code)}
                                                className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${isSelected ? "bg-indigo-600 text-white border-indigo-600" : "bg-indigo-50/50 text-indigo-400 border-indigo-100 hover:border-indigo-200"}`}
                                            >
                                                {s.name} ({s.code})
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Main Export ───────────────────────────────────────────────────
export function AcademicTab({ student, onReload }: { student: any; onReload: () => void }) {
    const [studentYear, setStudentYear] = useState(student.academic_year || "");
    const [studentDoa, setStudentDoa] = useState(
        student.date_of_admission
            ? new Date(student.date_of_admission).toISOString().split("T")[0]
            : ""
    );
    const [savingGeneral, setSavingGeneral] = useState(false);
    const [savedGeneral, setSavedGeneral] = useState(false);

    const isGeneralDirty =
        studentYear !== (student.academic_year || "") ||
        studentDoa !== (student.date_of_admission
            ? new Date(student.date_of_admission).toISOString().split("T")[0]
            : "");

    const saveGeneral = async () => {
        setSavingGeneral(true);
        try {
            await api.patch(`/v1/staff-editing/students/${student.cc}`, { academic_year: studentYear, doa: studentDoa });
            setSavedGeneral(true);
            setTimeout(() => setSavedGeneral(false), 3000);
            onReload();
        } catch { alert("Failed to update General Information"); }
        finally { setSavingGeneral(false); }
    };

    const isALevel = student.academic_system === "A-Level" || 
                     student.admissions?.some((a: any) => a.academic_system === "A-Level") ||
                     !!student.alevel_details;

    return (
        <div className="space-y-6">
            <div className={`bg-zinc-50 border rounded-2xl p-4 space-y-3 transition-all ${isGeneralDirty ? "border-amber-200 ring-1 ring-amber-100" : "border-zinc-100"}`}>
                <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">General Information</h3>
                    <RowSaveBtn onSave={saveGeneral} isSaving={savingGeneral} saved={savedGeneral} isDirty={isGeneralDirty} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Current Academic Year">
                        <Input value={studentYear} onChange={setStudentYear} placeholder="e.g. 2024-25" />
                    </Field>
                    <Field label="Date of Admission">
                        <Input type="date" value={studentDoa} onChange={setStudentDoa} />
                    </Field>
                </div>
            </div>

            {isALevel && (
                <>
                    <div className="border-t border-zinc-100" />
                    <ALevelDetailsSection studentCc={student.cc} initial={student.alevel_details} />
                </>
            )}

            <div className="border-t border-zinc-100" />
            <ActivitiesSection studentCc={student.cc} initial={student.activities || []} />
            <div className="border-t border-zinc-100" />
            <LanguagesSection studentCc={student.cc} initial={student.languages || []} />
            <div className="border-t border-zinc-100" />
            <SchoolsSection studentCc={student.cc} initial={student.previous_schools || []} />
        </div>
    );
}
