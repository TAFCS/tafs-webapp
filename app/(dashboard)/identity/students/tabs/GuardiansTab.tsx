"use client";
import { useState } from "react";
import { Plus, Trash2, Save, Loader2, UserCheck, Phone, CheckCircle2 } from "lucide-react";
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
        <input type={type} value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="w-full h-9 px-3 text-[13px] font-medium text-zinc-800 bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" />
    );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="flex items-center gap-2 cursor-pointer">
            <div onClick={() => onChange(!checked)} className={`relative h-4 w-8 rounded-full transition-colors ${checked ? "bg-primary" : "bg-zinc-200"}`}>
                <span className={`absolute top-0.5 left-0.5 h-3 w-3 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
            </div>
            <span className="text-[11px] font-medium text-zinc-600">{label}</span>
        </label>
    );
}

const RELATIONSHIPS = ["FATHER", "MOTHER", "GUARDIAN", "UNCLE", "AUNT", "GRANDFATHER", "GRANDMOTHER", "SIBLING", "OTHER"];

function GuardianCard({ studentCc, guardian, onSaved, onRemoved }: { studentCc: number; guardian: any; onSaved: (g: any) => void; onRemoved: () => void }) {
    const [local, setLocal] = useState(guardian);
    const [savingInfo, setSavingInfo] = useState(false);
    const [savingRel, setSavingRel] = useState(false);
    const [savedInfo, setSavedInfo] = useState(false);
    const [savedRel, setSavedRel] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const set = (k: string, v: any) => setLocal((p: any) => ({ ...p, [k]: v }));

    const isInfoDirty = (local.full_name || "") !== (guardian.full_name || "") ||
                       (local.cnic || "") !== (guardian.cnic || "") ||
                       (local.primary_phone || "") !== (guardian.primary_phone || "") ||
                       (local.whatsapp_number || "") !== (guardian.whatsapp_number || "") ||
                       (local.occupation || "") !== (guardian.occupation || "") ||
                       (local.email || "") !== (guardian.email || "");

    const isRelDirty = (local.relationship || "") !== (guardian.relationship || "") ||
                       !!local.is_primary_contact !== !!guardian.is_primary_contact ||
                       !!local.is_emergency_contact !== !!guardian.is_emergency_contact;

    const saveGuardianInfo = async () => {
        setSavingInfo(true);
        try {
            const { data } = await api.patch(`/v1/staff-editing/guardians/${guardian.guardian_id}`, {
                full_name: local.full_name,
                cnic: local.cnic,
                primary_phone: local.primary_phone,
                whatsapp_number: local.whatsapp_number,
                occupation: local.occupation,
                email: local.email,
            });
            setSavedInfo(true);
            setTimeout(() => setSavedInfo(false), 3000);
            onSaved(data?.data);
        } catch(e) {
            alert("Failed to update guardian information");
        } finally { setSavingInfo(false); }
    };

    const saveRelationship = async () => {
        setSavingRel(true);
        try {
            const { data } = await api.patch(`/v1/staff-editing/students/${studentCc}/guardians/${guardian.guardian_id}`, {
                relationship: local.relationship,
                is_primary_contact: local.is_primary_contact,
                is_emergency_contact: local.is_emergency_contact,
            });
            setSavedRel(true);
            setTimeout(() => setSavedRel(false), 3000);
            onSaved(data?.data);
        } catch(e) {
            alert("Failed to update relationship");
        } finally { setSavingRel(false); }
    };

    const remove = async () => {
        if (!confirm("Are you sure you want to unlink this guardian?")) return;
        setRemoving(true);
        try {
            await api.delete(`/v1/staff-editing/students/${studentCc}/guardians/${guardian.guardian_id}`);
            onRemoved();
        } catch(e) {
            alert("Failed to unlink guardian");
        } finally { setRemoving(false); }
    };

    const isPrimary = local.is_primary_contact;
    const isEmergency = local.is_emergency_contact;

    return (
        <div className={`border rounded-2xl overflow-hidden transition-all ${isPrimary ? "border-primary/30 bg-primary/5 shadow-sm ring-1 ring-primary/5" : "border-zinc-100 bg-white"}`}>
            {/* Collapsed header */}
            <button className="w-full flex items-center gap-3 px-4 py-3 text-left" onClick={() => setExpanded(e => !e)}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${isPrimary ? "bg-primary text-white" : "bg-zinc-100 text-zinc-500"}`}>
                    {(local.full_name || "?")[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="font-bold text-[13px] text-zinc-900 truncate">{local.full_name || "Unnamed"}</p>
                        {(isInfoDirty || isRelDirty) && <span className="text-[8px] font-black px-1 py-0.5 bg-amber-100 text-amber-600 rounded uppercase">Dirty</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase">{local.relationship}</span>
                        {isPrimary && <span className="text-[9px] font-black px-1.5 py-0.5 bg-primary/10 text-primary rounded-md uppercase">Primary</span>}
                        {isEmergency && <span className="text-[9px] font-black px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-md uppercase">Emergency</span>}
                        {local.primary_phone && <span className="flex items-center gap-1 text-[10px] text-zinc-400"><Phone className="h-2.5 w-2.5" />{local.primary_phone}</span>}
                    </div>
                </div>
                <span className="text-zinc-300 text-xs">{expanded ? "▲" : "▼"}</span>
            </button>

            {expanded && (
                <div className="px-4 pb-4 border-t border-zinc-100 space-y-4 pt-4 bg-white/50">
                    {/* Relationship & Flags */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Relationship & Flags</p>
                            {isRelDirty && !savedRel && <span className="text-[9px] font-bold text-amber-600">Unsaved changes</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <Field label="Relationship">
                                    <select value={local.relationship} onChange={e => set("relationship", e.target.value)}
                                        className="w-full h-9 px-3 text-[13px] font-medium bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 appearance-none">
                                        {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </Field>
                            </div>
                            <Toggle label="Primary Contact" checked={!!local.is_primary_contact} onChange={v => set("is_primary_contact", v)} />
                            <Toggle label="Emergency Contact" checked={!!local.is_emergency_contact} onChange={v => set("is_emergency_contact", v)} />
                        </div>
                        <button 
                            onClick={saveRelationship} 
                            disabled={savingRel || (savedRel && !isRelDirty)} 
                            className={`flex items-center gap-1.5 px-3 h-8 text-[11px] font-bold text-white rounded-xl transition-all ${savedRel ? "bg-emerald-500" : "bg-primary hover:bg-primary/90 disabled:opacity-50"}`}
                        >
                            {savingRel ? <Loader2 className="h-3 w-3 animate-spin" /> : savedRel ? <CheckCircle2 className="h-3 w-3" /> : <Save className="h-3 w-3" />}
                            {savingRel ? "Submitting..." : savedRel ? "Submitted" : "Save Relationship"}
                        </button>
                    </div>

                    <div className="border-t border-zinc-100 pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Personal Information</p>
                            {isInfoDirty && !savedInfo && <span className="text-[9px] font-bold text-amber-600">Unsaved changes</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2"><Field label="Full Name"><Input value={local.full_name ?? ""} onChange={v => set("full_name", v)} /></Field></div>
                            <Field label="CNIC"><Input value={local.cnic ?? ""} onChange={v => set("cnic", v)} placeholder="xxxxx-xxxxxxx-x" /></Field>
                            <Field label="Occupation"><Input value={local.occupation ?? ""} onChange={v => set("occupation", v)} /></Field>
                            <Field label="Phone"><Input value={local.primary_phone ?? ""} onChange={v => set("primary_phone", v)} /></Field>
                            <Field label="WhatsApp"><Input value={local.whatsapp_number ?? ""} onChange={v => set("whatsapp_number", v)} /></Field>
                            <div className="col-span-2"><Field label="Email"><Input type="email" value={local.email ?? ""} onChange={v => set("email", v)} /></Field></div>
                        </div>
                        <div className="flex gap-2 pt-1">
                            <button 
                                onClick={saveGuardianInfo} 
                                disabled={savingInfo || (savedInfo && !isInfoDirty)} 
                                className={`flex items-center gap-1.5 px-4 h-8 text-[11px] font-bold text-white rounded-xl transition-all ${savedInfo ? "bg-emerald-500" : "bg-primary hover:bg-primary/90 disabled:opacity-50"}`}
                            >
                                {savingInfo ? <Loader2 className="h-3 w-3 animate-spin" /> : savedInfo ? <CheckCircle2 className="h-3 w-3" /> : <Save className="h-3 w-3" />}
                                {savingInfo ? "Submitting..." : savedInfo ? "Submitted" : "Save Info"}
                            </button>
                            <button onClick={remove} disabled={removing} className="flex items-center gap-1.5 px-3 h-8 text-[11px] font-bold text-rose-600 bg-rose-50 rounded-xl hover:bg-rose-100 disabled:opacity-50 transition-all">
                                {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Unlink
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const EMPTY_GUARDIAN = { full_name: "", cnic: "", relationship: "GUARDIAN", primary_phone: "", whatsapp_number: "", occupation: "", email: "", is_primary_contact: false, is_emergency_contact: false };

export function GuardiansTab({ student, onReload }: { student: any; onReload: () => void }) {
    const [guardians, setGuardians] = useState<any[]>(student.guardians || []);
    const [adding, setAdding] = useState(false);
    const [newG, setNewG] = useState<any>({ ...EMPTY_GUARDIAN });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const update = (g: any) => setGuardians(prev => prev.map(x => x.guardian_id === g.guardian_id ? { ...x, ...g } : x));
    const remove = (guardianId: number) => setGuardians(prev => prev.filter(x => x.guardian_id !== guardianId));

    const addNew = async () => {
        if (!newG.full_name || !newG.relationship) return alert("Full name and relationship are required");
        setSaving(true);
        try {
            const { data } = await api.post(`/v1/staff-editing/students/${student.cc}/guardians`, newG);
            setGuardians(prev => [...prev, data?.data]);
            setSaved(true);
            setTimeout(() => {
                setSaved(false);
                setAdding(false);
                setNewG({ ...EMPTY_GUARDIAN });
            }, 1500);
        } catch(e) {
            alert("Failed to add new guardian");
        } finally { setSaving(false); }
    };

    const set = (k: string, v: any) => setNewG((p: any) => ({ ...p, [k]: v }));

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Guardians ({guardians.length})</h3>
                <button onClick={() => setAdding(a => !a)} className="flex items-center gap-1 px-3 h-8 text-[11px] font-bold text-primary bg-primary/10 rounded-xl hover:bg-primary/20 transition-all">
                    <Plus className="h-3.5 w-3.5" /> Add Guardian
                </button>
            </div>

            {adding && (
                <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 space-y-3 shadow-sm">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">New Guardian</p>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2"><Field label="Full Name"><Input value={newG.full_name} onChange={v => set("full_name", v)} /></Field></div>
                        <Field label="CNIC"><Input value={newG.cnic} onChange={v => set("cnic", v)} placeholder="xxxxx-xxxxxxx-x" /></Field>
                        <Field label="Relationship">
                            <select value={newG.relationship} onChange={e => set("relationship", e.target.value)} className="w-full h-9 px-3 text-[13px] font-medium bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary appearance-none">
                                {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </Field>
                        <Field label="Phone"><Input value={newG.primary_phone} onChange={v => set("primary_phone", v)} /></Field>
                        <Field label="WhatsApp"><Input value={newG.whatsapp_number} onChange={v => set("whatsapp_number", v)} /></Field>
                        <Field label="Occupation"><Input value={newG.occupation} onChange={v => set("occupation", v)} /></Field>
                        <Field label="Email"><Input type="email" value={newG.email} onChange={v => set("email", v)} /></Field>
                        <Toggle label="Primary Contact" checked={newG.is_primary_contact} onChange={v => set("is_primary_contact", v)} />
                        <Toggle label="Emergency Contact" checked={newG.is_emergency_contact} onChange={v => set("is_emergency_contact", v)} />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={addNew} disabled={saving || saved} className={`flex items-center gap-1.5 px-4 h-8 text-[11px] font-bold text-white rounded-xl transition-all ${saved ? "bg-emerald-500" : "bg-primary hover:bg-primary/90 disabled:opacity-50"}`}>
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : saved ? <CheckCircle2 className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                            {saving ? "Submitting..." : saved ? "Submitted" : "Add Guardian"}
                        </button>
                        <button onClick={() => setAdding(false)} className="px-3 h-8 text-[11px] font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl transition-all">Cancel</button>
                    </div>
                </div>
            )}

            {guardians.map(g => (
                <GuardianCard
                    key={g.guardian_id}
                    studentCc={student.cc}
                    guardian={g}
                    onSaved={update}
                    onRemoved={() => remove(g.guardian_id)}
                />
            ))}

            {guardians.length === 0 && !adding && (
                <div className="py-12 text-center text-zinc-400 text-sm">No guardians linked</div>
            )}
        </div>
    );
}
