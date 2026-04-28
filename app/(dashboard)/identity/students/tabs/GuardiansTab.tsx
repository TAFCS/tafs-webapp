"use client";
import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Save, Loader2, UserCheck, Phone, CheckCircle2, Search, Link, X as XIcon, User, RefreshCw, MapPin, Camera, ShieldAlert } from "lucide-react";
import { ChangeFamilyModal } from "@/src/features/students/components/student-profile-modal";
import api from "@/lib/api";
import { PhotoUpload } from "./PhotoUpload";

const isNA = (v: any) => v === "N/A" || v === "021-N/A";

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
            <input type={type} value={isNA(value) ? "N/A" : (value ?? "")}
                onChange={e => onChange(isEmail ? e.target.value.toLowerCase() : e.target.value.toUpperCase())}
                placeholder={placeholder}
                className={`w-full h-9 px-3 text-[13px] font-medium text-zinc-800 bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all ${isEmail ? "" : "uppercase"} ${showNA ? "pr-10" : ""} ${className}`} />
            {showNA && (
                <button
                    type="button"
                    onClick={() => onChange(isNA(value) ? "" : "N/A")}
                    className={`absolute right-1.5 px-1.5 py-1 text-[9px] font-black rounded-lg transition-all ${isNA(value) ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}
                >
                    N/A
                </button>
            )}
        </div>
    );
}

function PhoneInput({ value, onChange, placeholder, className = "" }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
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
        <div className={`relative flex items-center ${className}`}>
            <input
                type="text"
                value={isNA(value) ? "N/A" : (value?.startsWith("+92") ? value : ("+92" + (value || "")))}
                onChange={e => handlePhoneChange(e.target.value)}
                placeholder={placeholder}
                className="w-full h-9 pl-3 pr-10 text-[13px] font-medium text-zinc-800 bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-mono"
            />
            <button
                type="button"
                onClick={() => onChange(isNA(value) ? "+92" : "N/A")}
                className={`absolute right-1.5 px-1.5 py-1 text-[9px] font-black rounded-lg transition-all ${isNA(value) ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}
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
            <span className="text-[11px] font-medium text-zinc-600 uppercase">{label}</span>
        </label>
    );
}

const RELATIONSHIPS = ["FATHER", "MOTHER", "GUARDIAN", "UNCLE", "AUNT", "GRANDFATHER", "GRANDMOTHER", "SIBLING", "OTHER"];

function GuardianCard({ studentCc, guardian, onSaved, onRemoved, onReload }: { studentCc: number; guardian: any; onSaved: (g: any) => void; onRemoved: () => void; onReload: () => void }) {
    const [local, setLocal] = useState(guardian);
    const [savingInfo, setSavingInfo] = useState(false);
    const [savingRel, setSavingRel] = useState(false);
    const [savedInfo, setSavedInfo] = useState(false);
    const [savedRel, setSavedRel] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        setLocal(guardian);
    }, [guardian]);

    const set = (k: string, v: any) => setLocal((p: any) => ({ ...p, [k]: v }));

    const isInfoDirty = (local.full_name || "") !== (guardian.full_name || "") ||
        (local.cnic || "") !== (guardian.cnic || "") ||
        (local.primary_phone || "") !== (guardian.primary_phone || "") ||
        (local.whatsapp_number || "") !== (guardian.whatsapp_number || "") ||
        (local.occupation || "") !== (guardian.occupation || "") ||
        (local.email_address || "") !== (guardian.email_address || "") ||
        JSON.stringify(local.additional_phones || []) !== JSON.stringify(guardian.additional_phones || []);

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
                additional_phones: local.additional_phones || [],
            });
            setSavedInfo(true);
            setTimeout(() => setSavedInfo(false), 3000);
            onSaved(data?.data);
        } catch (e) {
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
        } catch (e) {
            alert("Failed to update relationship");
        } finally { setSavingRel(false); }
    };

    const remove = async () => {
        if (!confirm("Are you sure you want to unlink this guardian?")) return;
        setRemoving(true);
        try {
            await api.delete(`/v1/staff-editing/students/${studentCc}/guardians/${guardian.guardian_id}`);
            onRemoved();
        } catch (e) {
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
                        <p className="font-bold text-[13px] text-zinc-900 truncate uppercase">{local.full_name || "UNNAMED"}</p>
                        {(isInfoDirty || isRelDirty) && <span className="text-[8px] font-black px-1 py-0.5 bg-amber-100 text-amber-600 rounded uppercase">Dirty</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase">{local.relationship}</span>
                        {isPrimary && <span className="text-[9px] font-black px-1.5 py-0.5 bg-primary/10 text-primary rounded-md uppercase">Primary</span>}
                        {isEmergency && <span className="text-[9px] font-black px-1.5 py-0.5 bg-rose-600 text-white rounded-md uppercase">Emergency Contact</span>}
                        {local.cnic && <span className="flex items-center gap-1 text-[10px] text-zinc-500 font-medium bg-zinc-100 px-1.5 py-0.5 rounded-md"><User className="h-2.5 w-2.5" />{local.cnic}</span>}
                        {local.primary_phone && (
                            <span className={`flex items-center gap-1 text-[10px] font-bold ${isEmergency && !(local.additional_phones || []).some((p: any) => p.label?.toUpperCase().includes("EMERGENCY")) ? "text-rose-600" : "text-zinc-400"}`}>
                                <Phone className="h-2.5 w-2.5" />{local.primary_phone}
                            </span>
                        )}
                        {(local.additional_phones || []).filter((p: any) => p.label?.toUpperCase().includes("EMERGENCY")).map((p: any, i: number) => (
                            <span key={i} className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md">
                                <Phone className="h-2.5 w-2.5" />{p.number} ({p.label.replace(/\(EMERGENCY\)/gi, "").trim() || "Work"})
                            </span>
                        ))}
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

                        <div className="pb-2 border-b border-zinc-50 mb-1">
                            <PhotoUpload
                                guardianId={local.id}
                                currentUrl={local.photo_url}
                                label="Profile Picture"
                                onSuccess={onReload}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2"><Field label="Full Name"><Input value={local.full_name ?? ""} onChange={v => set("full_name", v)} showNA /></Field></div>
                            <Field label="CNIC"><Input value={local.cnic ?? ""} onChange={v => set("cnic", formatCNIC(v))} placeholder="xxxxx-xxxxxxx-x" /></Field>
                            <Field label="Occupation"><Input value={local.occupation ?? ""} onChange={v => set("occupation", v)} /></Field>
                            <Field label="Phone"><PhoneInput value={local.primary_phone ?? ""} onChange={v => set("primary_phone", v)} /></Field>
                            <Field label="WhatsApp"><PhoneInput value={local.whatsapp_number ?? ""} onChange={v => set("whatsapp_number", v)} /></Field>
                            <div className="col-span-2"><Field label="Email"><Input type="email" value={local.email_address ?? ""} onChange={v => set("email_address", v)} /></Field></div>
                        </div>

                        {/* Additional Phone Numbers */}
                        <div className="pt-2">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Additional Numbers</p>
                                <button
                                    onClick={() => {
                                        const current = local.additional_phones || [];
                                        if (current.length >= 10) return;
                                        set("additional_phones", [...current, { label: "", number: "+92" }]);
                                    }}
                                    disabled={(local.additional_phones || []).length >= 10}
                                    className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <Plus className="h-3 w-3" /> Add Number
                                </button>
                            </div>
                            <div className="space-y-2">
                                {(local.additional_phones || []).map((ph: any, idx: number) => (
                                    <div key={idx} className="flex gap-2 items-end group animate-in slide-in-from-right-2 duration-200">
                                        <div className="flex-1">
                                            <Input
                                                value={ph.label}
                                                onChange={v => {
                                                    const updated = [...(local.additional_phones || [])];
                                                    updated[idx] = { ...updated[idx], label: v };
                                                    set("additional_phones", updated);
                                                }}
                                                placeholder="LABEL (E.G. OFFICE)"
                                            />
                                        </div>
                                        <div className="flex-[1.5]">
                                            <PhoneInput
                                                value={ph.number}
                                                onChange={v => {
                                                    const updated = [...(local.additional_phones || [])];
                                                    updated[idx] = { ...updated[idx], number: v };
                                                    set("additional_phones", updated);
                                                }}
                                            />
                                        </div>
                                        <button
                                            onClick={() => {
                                                const updated = (local.additional_phones || []).filter((_: any, i: number) => i !== idx);
                                                set("additional_phones", updated);
                                            }}
                                            className="h-9 w-9 flex items-center justify-center text-rose-500 bg-rose-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-100"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                                {(!local.additional_phones || local.additional_phones.length === 0) && (
                                    <p className="text-[10px] text-zinc-400 italic py-2 text-center border border-dashed border-zinc-100 rounded-xl">No additional numbers saved.</p>
                                )}
                            </div>
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
    full_name: "", cnic: "", relationship: "GUARDIAN", primary_phone: "+92", whatsapp_number: "+92",
    occupation: "", email_address: "", is_primary_contact: false, is_emergency_contact: false,
    additional_phones: []
};

export function GuardiansTab({ student, onReload, onSwitchStudent }: { student: any; onReload: () => void; onSwitchStudent?: (cc: number) => void }) {
    const [isFamilyModalOpen, setIsFamilyModalOpen] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempHouseholdName, setTempHouseholdName] = useState("");
    const [isSavingName, setIsSavingName] = useState(false);
    const [guardians, setGuardians] = useState<any[]>(student.guardians || []);
    const [adding, setAdding] = useState(false);
    const [newG, setNewG] = useState<any>({ ...EMPTY_GUARDIAN });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // New Guardian Photo State
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) return alert("Please select an image file");
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
    };

    // Search and Link Existing Guardian
    const [searchCnic, setSearchCnic] = useState("");
    const [searching, setSearching] = useState(false);
    const [foundGuardian, setFoundGuardian] = useState<any>(null);
    const [linking, setLinking] = useState(false);
    const [linkRel, setLinkRel] = useState("GUARDIAN");
    const [isLinkPrimary, setIsLinkPrimary] = useState(false);
    const [isLinkEmergency, setIsLinkEmergency] = useState(false);

    const handleSearch = async () => {
        if (!searchCnic || searchCnic.length < 15) return;
        setSearching(true);
        setFoundGuardian(null);
        try {
            const { data } = await api.get(`/v1/staff-editing/guardians/by-nic/${searchCnic}`);
            if (data?.data) {
                // Check if already linked
                const isLinked = guardians.some(g => g.guardian_id === data.data.id || g.id === data.data.id);
                if (isLinked) {
                    alert("This guardian is already linked to this student.");
                } else {
                    setFoundGuardian(data.data);
                }
            } else {
                alert("No guardian found with this CNIC.");
            }
        } catch (e) {
            alert("Error searching for guardian.");
        } finally { setSearching(false); }
    };

    const handleLink = async () => {
        if (!foundGuardian) return;
        setLinking(true);
        try {
            const { data } = await api.post(`/v1/staff-editing/students/${student.cc}/guardians/link-existing`, {
                guardian_id: foundGuardian.id,
                relationship: linkRel,
                is_primary_contact: isLinkPrimary,
                is_emergency_contact: isLinkEmergency
            });
            setGuardians(prev => [...prev, data?.data]);
            setFoundGuardian(null);
            setSearchCnic("");
            onReload();
        } catch (e) {
            alert("Failed to link guardian.");
        } finally { setLinking(false); }
    };

    // Unified Family Address state
    const [familyAddress, setFamilyAddress] = useState<any>({
        house_appt_name: "", area_block: "", city: "", postal_code: "", province: "", country: "", work_phone: ""
    });
    const [savingAddr, setSavingAddr] = useState(false);
    const [savedAddr, setSavedAddr] = useState(false);
    const [isAddrDirty, setIsAddrDirty] = useState(false);
    const [syncToHousehold, setSyncToHousehold] = useState(false);

    // Calculate Data Quality Score (Household Health)
    const calculateHealthScore = () => {
        let score = 0;
        const isFather = (rel: string) => (rel || "").trim().toUpperCase().includes("FATHER");
        const isMother = (rel: string) => (rel || "").trim().toUpperCase().includes("MOTHER");

        const f = student.guardians?.find((g: any) => isFather(g.relationship));
        const m = student.guardians?.find((g: any) => isMother(g.relationship));
        const has = (v: any) => v && v !== "N/A" && v !== "NOT PROVIDED" && v.toString().trim() !== "";

        // Father (35%): Name(15), CNIC(10), Phone(10)
        if (has(f?.full_name)) score += 15;
        if (has(f?.cnic)) score += 10;
        if (has(f?.primary_phone)) score += 10;

        // Mother (35%): Name(15), CNIC(10), Phone(10)
        if (has(m?.full_name)) score += 15;
        if (has(m?.cnic)) score += 10;
        if (has(m?.primary_phone)) score += 10;

        // Address (30%): House(10), Area(10), City/Postal(10)
        if (has(familyAddress.house_appt_name)) score += 10;
        if (has(familyAddress.area_block)) score += 10;
        if (has(familyAddress.city) || has(familyAddress.postal_code)) score += 10;

        return Math.min(score, 100);
    };

    const healthScore = calculateHealthScore();

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
                    work_phone: student.home_phone || g.work_phone || ""
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
            const guardianId = data?.data?.guardian_id || data?.data?.id;

            // Upload Photo if exists
            if (photoFile && guardianId) {
                const formData = new FormData();
                formData.append("file", photoFile);
                await api.post(`/v1/media/guardian/${guardianId}/photo`, formData, {
                    headers: { "Content-Type": "multipart/form-data" }
                });
            }

            setGuardians(prev => [...prev, data?.data]);
            setSaved(true);
            setTimeout(() => {
                setSaved(false);
                setAdding(false);
                setNewG({ ...EMPTY_GUARDIAN });
                setPhotoFile(null);
                setPhotoPreview(null);
            }, 1500);
        } catch (e) {
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
            await api.patch(`/v1/staff-editing/students/${student.cc}/family-address`, {
                ...familyAddress,
                bulk_sync: syncToHousehold
            });
            setSavedAddr(true);
            setTimeout(() => setSavedAddr(false), 3000);
            setIsAddrDirty(false);

            // Update all local guardians to keep UI in sync
            setGuardians(prev => prev.map(g => ({ ...g, ...familyAddress })));

            if (syncToHousehold) {
                // If bulk sync was performed, reload to get latest for everyone
                setTimeout(onReload, 1000);
            }
        } catch (e) {
            alert("Failed to update family address");
        } finally {
            setSavingAddr(false);
        }
    };

    const [isInitializingFamily, setIsInitializingFamily] = useState(false);
    const handleCreateFamily = async () => {
        setIsInitializingFamily(true);
        try {
            await api.post(`/v1/families/from-student/${student.cc}`);
            onReload();
        } catch (e) {
            console.error(e);
            alert("Failed to initialize family.");
        } finally {
            setIsInitializingFamily(false);
        }
    };

    const handleUpdateHouseholdName = async () => {
        const familyId = student.family_id || student.families?.id;
        if (!familyId) return;
        if (!tempHouseholdName.trim()) return alert("Household name cannot be empty");

        setIsSavingName(true);
        try {
            await api.patch(`/v1/families/${familyId}`, { household_name: tempHouseholdName.toUpperCase() });
            setIsEditingName(false);
            onReload();
        } catch (e) {
            console.error(e);
            alert("Failed to update household name");
        } finally {
            setIsSavingName(false);
        }
    };

    const emergencyContacts = guardians.filter(g => g.is_emergency_contact);

    return (
        <div className="space-y-8 pb-8">
            {/* Section: Family / Household */}
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                        <User className="h-3.5 w-3.5" /> Family / Household Connection
                    </h3>
                </div>

                <div className="flex items-center justify-between gap-4 p-5 bg-white border border-indigo-100/50 rounded-2xl shadow-sm">
                    {(student.families || student.family_id || student.household_name) ? (
                        <div className="flex-1 min-w-0 flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                    {isEditingName ? (
                                        <div className="flex items-center gap-2 flex-1">
                                            <input
                                                autoFocus
                                                value={tempHouseholdName}
                                                onChange={e => setTempHouseholdName(e.target.value)}
                                                onKeyDown={e => e.key === "Enter" && handleUpdateHouseholdName()}
                                                className="flex-1 h-8 px-2 text-[13px] font-bold text-zinc-900 bg-zinc-50 border border-indigo-200 rounded-lg outline-none focus:ring-2 focus:ring-primary/10 uppercase"
                                                placeholder="ENTER HOUSEHOLD NAME..."
                                            />
                                            <button
                                                onClick={handleUpdateHouseholdName}
                                                disabled={isSavingName}
                                                className="px-3 h-8 text-[10px] font-black uppercase bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all"
                                            >
                                                {isSavingName ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                                            </button>
                                            <button
                                                onClick={() => setIsEditingName(false)}
                                                className="px-3 h-8 text-[10px] font-black uppercase bg-zinc-100 text-zinc-500 rounded-lg hover:bg-zinc-200 transition-all"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <div
                                            className="group flex items-center gap-2 cursor-pointer"
                                            onClick={() => {
                                                setTempHouseholdName(student.families?.household_name || student.household_name || "");
                                                setIsEditingName(true);
                                            }}
                                        >
                                            <p className="text-[14px] font-bold text-zinc-900 uppercase truncate">
                                                {student.families?.household_name || student.household_name || "Assigned Family"}
                                            </p>
                                            <button className="p-1 opacity-0 group-hover:opacity-100 bg-indigo-50 text-indigo-600 rounded-md transition-all">
                                                <Save className="h-3 w-3" />
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-100 rounded-lg">
                                        <div className="h-1.5 w-16 bg-zinc-200 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-1000 ${healthScore > 80 ? "bg-emerald-500" : healthScore > 50 ? "bg-amber-500" : "bg-rose-500"}`}
                                                style={{ width: `${healthScore}%` }}
                                            />
                                        </div>
                                        <span className="text-[9px] font-black text-zinc-500">{healthScore}%</span>
                                    </div>
                                </div>

                                <p className="text-[11px] text-indigo-600 font-bold tracking-tight">
                                    Family ID: #{student.family_id || student.families?.id} {student.families?.legacy_pid ? `· PID ${student.families.legacy_pid}` : ""}
                                </p>

                                {/* Sibling Navigation */}
                                {student.siblings && student.siblings.length > 0 && (
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Siblings:</span>
                                        {student.siblings.map((sib: any) => (
                                            <button
                                                key={sib.cc}
                                                onClick={() => onSwitchStudent?.(sib.cc)}
                                                className="group relative flex items-center gap-2 p-1 pr-3 bg-zinc-50 border border-zinc-100 rounded-full hover:bg-white hover:border-indigo-200 hover:shadow-sm transition-all active:scale-95"
                                            >
                                                <div className="h-5 w-5 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden border border-indigo-200 shadow-sm">
                                                    {sib.photograph_url ? (
                                                        <img src={sib.photograph_url} alt="" className="h-full w-full object-cover" />
                                                    ) : (
                                                        <User className="h-3 w-3 text-indigo-400" />
                                                    )}
                                                </div>
                                                <span className="text-[10px] font-bold text-zinc-500 group-hover:text-indigo-600 truncate max-w-[80px] uppercase">
                                                    {sib.full_name.split(' ')[0]}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => setIsFamilyModalOpen(true)}
                                className="flex items-center gap-1.5 h-8 px-3 text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all active:scale-95 shrink-0"
                            >
                                <RefreshCw className="h-3 w-3" />
                                Change
                            </button>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)] animate-pulse" />
                                <div>
                                    <p className="text-[13px] font-black text-zinc-500 uppercase tracking-tight">No Household Assigned</p>
                                    <p className="text-[10px] text-zinc-400 font-medium">Link an existing family or create a new one.</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsFamilyModalOpen(true)}
                                    className="h-9 px-4 text-[11px] font-black uppercase tracking-wider rounded-xl bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-all active:scale-95"
                                >
                                    Link Existing
                                </button>
                                <button
                                    onClick={handleCreateFamily}
                                    disabled={isInitializingFamily}
                                    className="flex items-center gap-2 h-9 px-4 text-[11px] font-black uppercase tracking-wider rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 active:scale-95 disabled:opacity-50"
                                >
                                    {isInitializingFamily ? (
                                        <RefreshCw className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <MapPin className="h-3 w-3" />
                                    )}
                                    Create New
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {isFamilyModalOpen && (
                    <ChangeFamilyModal
                        studentId={student.cc}
                        studentName={student.full_name}
                        currentFamilyId={student.family_id}
                        onClose={() => setIsFamilyModalOpen(false)}
                        onSuccess={() => {
                            setIsFamilyModalOpen(false);
                            onReload();
                        }}
                    />
                )}
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Guardians ({guardians.length})</h3>
                    <button onClick={() => setAdding(a => !a)} className="flex items-center gap-1 px-3 h-8 text-[11px] font-bold text-primary bg-primary/10 rounded-xl hover:bg-primary/20 transition-all">
                        <Plus className="h-3.5 w-3.5" /> Add Guardian
                    </button>
                </div>

                {/* CNIC Search Section */}
                <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="flex-1 relative">
                            <Input
                                value={searchCnic}
                                onChange={v => setSearchCnic(formatCNIC(v))}
                                placeholder="SEARCH BY CNIC (xxxxx-xxxxxxx-x)"
                                className="pl-9"
                            />
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                        </div>
                        <button
                            onClick={handleSearch}
                            disabled={searching || searchCnic.length < 15}
                            className="px-4 h-9 bg-zinc-900 text-white text-[11px] font-bold rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-all"
                        >
                            {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "SEARCH"}
                        </button>
                    </div>

                    {foundGuardian && (
                        <div className="mt-4 bg-white border border-emerald-100 rounded-xl p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-emerald-50">
                                <div>
                                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Guardian Found</p>
                                    <h4 className="font-bold text-zinc-900 uppercase">{foundGuardian.full_name}</h4>
                                    <p className="text-[10px] font-bold text-zinc-400 mt-0.5">{foundGuardian.cnic}</p>
                                </div>
                                <button onClick={() => setFoundGuardian(null)} className="p-1 hover:bg-zinc-100 rounded-lg text-zinc-400">
                                    <XIcon className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <Field label="Relationship">
                                    <select
                                        value={linkRel}
                                        onChange={e => setLinkRel(e.target.value)}
                                        className="w-full h-9 px-3 text-[13px] font-medium bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary appearance-none uppercase"
                                    >
                                        {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </Field>
                                <div className="flex flex-col gap-2 justify-center">
                                    <Toggle label="Primary" checked={isLinkPrimary} onChange={setIsLinkPrimary} />
                                    <Toggle label="Emergency" checked={isLinkEmergency} onChange={setIsLinkEmergency} />
                                </div>
                            </div>

                            <button
                                onClick={handleLink}
                                disabled={linking}
                                className="w-full h-9 bg-emerald-600 text-white text-[11px] font-bold rounded-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                            >
                                {linking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link className="h-3.5 w-3.5" />}
                                LINK TO THIS STUDENT
                            </button>
                        </div>
                    )}
                </div>

                {adding && (
                    <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 space-y-3 shadow-sm">
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">New Guardian</p>

                        <div className="flex flex-col md:flex-row gap-6">
                            {/* Photo Picker */}
                            <div className="shrink-0">
                                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Profile Picture</label>
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="relative group w-32 h-40 bg-white rounded-2xl border-2 border-dashed border-blue-200 flex flex-col items-center justify-center overflow-hidden transition-all hover:border-primary/50 cursor-pointer shadow-sm"
                                >
                                    {photoPreview ? (
                                        <>
                                            <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <Camera className="h-6 w-6 text-white" />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 text-blue-300 group-hover:text-primary transition-colors">
                                            <Camera className="h-8 w-8" />
                                            <span className="text-[10px] font-black uppercase">Upload</span>
                                        </div>
                                    )}
                                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handlePhotoSelect} />
                                </div>
                            </div>

                            {/* Form Fields */}
                            <div className="flex-1 space-y-5">
                                <div className="flex gap-6 pb-2 border-b border-blue-100/30">
                                    <Toggle label="Primary Contact" checked={newG.is_primary_contact} onChange={v => set("is_primary_contact", v)} />
                                    <Toggle label="Emergency Contact" checked={newG.is_emergency_contact} onChange={v => set("is_emergency_contact", v)} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <Field label="Full Name"><Input value={newG.full_name || ""} onChange={v => set("full_name", v)} showNA /></Field>
                                    </div>

                                    <Field label="CNIC">
                                        <Input value={newG.cnic || ""} onChange={v => set("cnic", formatCNIC(v))} placeholder="xxxxx-xxxxxxx-x" />
                                    </Field>

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
                                        <div className="md:col-span-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <Field label="Specify Relationship">
                                                <Input value={newG.relationship === "OTHER" ? "" : newG.relationship} onChange={v => set("relationship", v)} placeholder="e.g. DRIVER, TUTOR" showNA />
                                            </Field>
                                        </div>
                                    )}

                                    <Field label="Phone">
                                        <PhoneInput value={newG.primary_phone || ""} onChange={v => set("primary_phone", v)} />
                                    </Field>

                                    <Field label="WhatsApp">
                                        <PhoneInput value={newG.whatsapp_number || ""} onChange={v => set("whatsapp_number", v)} />
                                    </Field>

                                    <Field label="Occupation">
                                        <Input value={newG.occupation || ""} onChange={v => set("occupation", v)} />
                                    </Field>

                                    <Field label="Email">
                                        <Input type="email" value={newG.email_address || ""} onChange={v => set("email_address", v)} />
                                    </Field>
                                </div>
                            </div>
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
                        onReload={onReload}
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
                                <div className="flex items-center justify-between pt-2">
                                    <div className="flex items-center gap-4">
                                        <Toggle
                                            label="Apply to all household members"
                                            checked={syncToHousehold}
                                            onChange={setSyncToHousehold}
                                        />
                                        {syncToHousehold && (
                                            <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded uppercase animate-pulse">
                                                Bulk Sync Enabled
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={saveFamilyAddress}
                                        disabled={savingAddr || (!isAddrDirty && !savedAddr)}
                                        className={`flex items-center gap-1.5 px-6 h-9 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all shadow-lg ${savedAddr ? "bg-emerald-500 text-white shadow-emerald-200" : "bg-primary text-white shadow-primary/20 hover:bg-primary/90 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100"}`}
                                    >
                                        {savingAddr ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : savedAddr ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                                        {savingAddr ? "Submitting..." : savedAddr ? "Submitted" : "Save All Addresses"}
                                    </button>
                                </div>
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
        </div>
    );
}
