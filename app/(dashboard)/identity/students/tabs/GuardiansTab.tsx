"use client";
import { useState, useEffect } from "react";
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

function Input({ value, onChange, placeholder, type = "text", className = "", showNA = false }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string; showNA?: boolean }) {
    const isEmail = type === "email";
    return (
        <div className="relative flex items-center">
            <input type={type} value={value ?? ""} 
                onChange={e => onChange(isEmail ? e.target.value.toLowerCase() : e.target.value.toUpperCase())} 
                placeholder={placeholder}
                className={`w-full h-9 px-3 text-[13px] font-medium text-zinc-800 bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all ${isEmail ? "" : "uppercase"} ${showNA ? "pr-10" : ""} ${className}`} />
            {showNA && (
                <button 
                    type="button"
                    onClick={() => onChange(value === "N/A" ? "" : "N/A")}
                    className={`absolute right-1.5 px-1.5 py-1 text-[9px] font-black rounded-lg transition-all ${value === "N/A" ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}
                >
                    N/A
                </button>
            )}
        </div>
    );
}

function PhoneInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
    const handlePhoneChange = (v: string) => {
        if (v === "N/A") return;
        if (!v.startsWith("+92")) {
            onChange("+92");
            return;
        }
        const rest = v.slice(3).replace(/\D/g, "").slice(0, 10);
        onChange("+92" + rest);
    };

    return (
        <div className="relative flex items-center">
            <input
                type="text"
                value={value === "N/A" ? "N/A" : (value.startsWith("+92") ? value : "+92")}
                onChange={e => handlePhoneChange(e.target.value)}
                placeholder={placeholder}
                className="w-full h-9 pl-3 pr-10 text-[13px] font-medium text-zinc-800 bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-mono"
            />
            <button 
                type="button"
                onClick={() => onChange(value === "N/A" ? "+92" : "N/A")}
                className={`absolute right-1.5 px-1.5 py-1 text-[9px] font-black rounded-lg transition-all ${value === "N/A" ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}
            >
                N/A
            </button>
        </div>
    );
}

const formatCNIC = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 13);
    let out = digits;
    if (digits.length > 5) out = digits.slice(0, 5) + "-" + digits.slice(5);
    if (digits.length > 12) out = out.slice(0, 13) + "-" + out.slice(13);
    return out;
};

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
                       (local.email_address || "") !== (guardian.email_address || "");

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
                email_address: local.email_address,
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
                relationship: local.relationship.toUpperCase(),
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
                                    <select 
                                        value={RELATIONSHIPS.filter(r => r !== "OTHER").includes((local.relationship || "").toUpperCase()) ? (local.relationship || "").toUpperCase() : "OTHER"} 
                                        onChange={e => set("relationship", e.target.value.toUpperCase())}
                                        className="w-full h-9 px-3 text-[13px] font-medium bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 appearance-none uppercase"
                                    >
                                        {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </Field>
                                {(!RELATIONSHIPS.filter(r => r !== "OTHER").includes((local.relationship || "").toUpperCase())) && (
                                    <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <Field label="Specify Relationship">
                                            <Input value={local.relationship === "OTHER" ? "" : local.relationship} onChange={v => set("relationship", v)} placeholder="e.g. DRIVER, TUTOR" showNA />
                                        </Field>
                                    </div>
                                )}
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
                            <div className="col-span-2"><Field label="Full Name"><Input value={local.full_name ?? ""} onChange={v => set("full_name", v)} showNA /></Field></div>
                            <Field label="CNIC"><Input value={local.cnic ?? ""} onChange={v => set("cnic", formatCNIC(v))} placeholder="xxxxx-xxxxxxx-x" /></Field>
                            <Field label="Occupation"><Input value={local.occupation ?? ""} onChange={v => set("occupation", v)} /></Field>
                            <Field label="Phone"><PhoneInput value={local.primary_phone ?? ""} onChange={v => set("primary_phone", v)} /></Field>
                            <Field label="WhatsApp"><PhoneInput value={local.whatsapp_number ?? ""} onChange={v => set("whatsapp_number", v)} /></Field>
                            <div className="col-span-2"><Field label="Email"><Input type="email" value={local.email_address ?? ""} onChange={v => set("email_address", v)} /></Field></div>
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

const EMPTY_GUARDIAN = { 
    full_name: "", cnic: "", relationship: "GUARDIAN", primary_phone: "", whatsapp_number: "", 
    occupation: "", email_address: "", is_primary_contact: false, is_emergency_contact: false,
};

export function GuardiansTab({ student, onReload }: { student: any; onReload: () => void }) {
    const [guardians, setGuardians] = useState<any[]>(student.guardians || []);
    const [adding, setAdding] = useState(false);
    const [newG, setNewG] = useState<any>({ ...EMPTY_GUARDIAN });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Unified Family Address state
    const [familyAddress, setFamilyAddress] = useState<any>({
        house_appt_name: "", area_block: "", city: "", postal_code: "", province: "", country: "", work_phone: ""
    });
    const [savingAddr, setSavingAddr] = useState(false);
    const [savedAddr, setSavedAddr] = useState(false);
    const [isAddrDirty, setIsAddrDirty] = useState(false);

    const update = (g: any) => setGuardians(prev => prev.map(x => x.guardian_id === g.guardian_id ? { ...x, ...g } : x));
    const remove = (guardianId: number) => setGuardians(prev => prev.filter(x => x.guardian_id !== guardianId));

    // Sync with prop updates (e.g. after detail fetch completes)
    useEffect(() => {
        if (student.guardians) {
            setGuardians(student.guardians);
            // Populate family address from first guardian if not set or when student changes
            if (student.guardians.length > 0) {
                const g = student.guardians[0];
                setFamilyAddress({
                    house_appt_name: g.house_appt_name || "",
                    area_block: g.area_block || "",
                    city: g.city || "",
                    postal_code: g.postal_code || "",
                    province: g.province || "",
                    country: g.country || "",
                    work_phone: g.work_phone || ""
                });
                setIsAddrDirty(false);
            }
        }
    }, [student.guardians]);

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
    
    const setAddr = (k: string, v: any) => {
        setFamilyAddress((p: any) => ({ ...p, [k]: v }));
        setIsAddrDirty(true);
    };

    const saveFamilyAddress = async () => {
        setSavingAddr(true);
        try {
            await api.patch(`/v1/staff-editing/students/${student.cc}/family-address`, familyAddress);
            setSavedAddr(true);
            setTimeout(() => setSavedAddr(false), 3000);
            setIsAddrDirty(false);
            
            // Update all local guardians to keep UI in sync
            setGuardians(prev => prev.map(g => ({ ...g, ...familyAddress })));
        } catch(e) {
            alert("Failed to update family address");
        } finally { setSavingAddr(false); }
    };

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
                    <div className="flex gap-4 border-b border-blue-100/50 pb-3 mb-1">
                        <Toggle label="Primary Contact" checked={newG.is_primary_contact} onChange={v => set("is_primary_contact", v)} />
                        <Toggle label="Emergency Contact" checked={newG.is_emergency_contact} onChange={v => set("is_emergency_contact", v)} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2"><Field label="Full Name"><Input value={newG.full_name} onChange={v => set("full_name", v)} showNA /></Field></div>
                        
                        <div className="col-span-1">
                            <Field label="Relationship">
                                <select 
                                    value={RELATIONSHIPS.filter(r => r !== "OTHER").includes((newG.relationship || "").toUpperCase()) ? (newG.relationship || "").toUpperCase() : "OTHER"} 
                                    onChange={e => set("relationship", e.target.value.toUpperCase())}
                                    className="w-full h-9 px-3 text-[13px] font-medium bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary appearance-none uppercase"
                                >
                                    {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </Field>
                            {(!RELATIONSHIPS.filter(r => r !== "OTHER").includes((newG.relationship || "").toUpperCase())) && (
                                <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <Field label="Specify Relationship">
                                        <Input value={newG.relationship === "OTHER" ? "" : newG.relationship} onChange={v => set("relationship", v)} placeholder="e.g. DRIVER, TUTOR" showNA />
                                    </Field>
                                </div>
                            )}
                        </div>

                        <div className={`${newG.is_emergency_contact ? "col-span-1" : "col-span-1"}`}>
                            <Field label="Phone"><PhoneInput value={newG.primary_phone} onChange={v => set("primary_phone", v)} /></Field>
                        </div>

                        {!newG.is_emergency_contact && (
                            <>
                                <Field label="CNIC"><Input value={newG.cnic} onChange={v => set("cnic", formatCNIC(v))} placeholder="xxxxx-xxxxxxx-x" /></Field>
                                <Field label="WhatsApp"><PhoneInput value={newG.whatsapp_number} onChange={v => set("whatsapp_number", v)} /></Field>
                                <Field label="Occupation"><Input value={newG.occupation} onChange={v => set("occupation", v)} /></Field>
                                <Field label="Email"><Input type="email" value={newG.email_address} onChange={v => set("email_address", v)} /></Field>
                            </>
                        )}
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

            {/* Unified Family Address Section */}
            {guardians.length > 0 && (
                <div className="mt-8 pt-6 border-t border-zinc-100 animate-in fade-in slide-in-from-bottom-2 duration-700">
                    <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <h3 className="text-[11px] font-black text-zinc-900 uppercase tracking-widest">Family Mailing Address</h3>
                                <p className="text-[10px] text-zinc-400 font-bold uppercase">This address applies to Father, Mother, and all guardians</p>
                            </div>
                            <button 
                                onClick={saveFamilyAddress}
                                disabled={savingAddr || (savedAddr && !isAddrDirty)}
                                className={`flex items-center gap-2 px-5 h-9 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all shadow-sm ${savedAddr ? "bg-emerald-500 text-white shadow-emerald-200" : "bg-primary text-white shadow-primary/20 hover:bg-primary/90 disabled:opacity-50"}`}
                            >
                                {savingAddr ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : savedAddr ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                                {savingAddr ? "Submitting..." : savedAddr ? "Address Saved" : "Save All Addresses"}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="md:col-span-2 lg:col-span-2">
                                <Field label="House / Apartment Name and No.">
                                    <Input value={familyAddress.house_appt_name} onChange={v => setAddr("house_appt_name", v)} />
                                </Field>
                            </div>
                            <Field label="Area and Block #">
                                <Input value={familyAddress.area_block} onChange={v => setAddr("area_block", v)} />
                            </Field>
                            <Field label="City">
                                <Input value={familyAddress.city} onChange={v => setAddr("city", v)} />
                            </Field>
                            <Field label="Postal Code">
                                <Input value={familyAddress.postal_code} onChange={v => setAddr("postal_code", v)} />
                            </Field>
                            <Field label="Province">
                                <Input value={familyAddress.province} onChange={v => setAddr("province", v)} />
                            </Field>
                            <Field label="Country">
                                <Input value={familyAddress.country} onChange={v => setAddr("country", v)} />
                            </Field>
                            <Field label="Family Home Phone #">
                                <PhoneInput value={familyAddress.work_phone} onChange={v => setAddr("work_phone", v)} />
                            </Field>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
