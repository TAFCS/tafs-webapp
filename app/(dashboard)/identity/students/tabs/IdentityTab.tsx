"use client";
import { useState } from "react";
import { Save, Loader2, CheckCircle2, GraduationCap } from "lucide-react";
import api from "@/lib/api";
import { PhotoUpload } from "./PhotoUpload";

const isNA = (v: any) => v === "N/A" || v === "021-N/A";

// ── Primitives ──────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{label}</label>
            {children}
        </div>
    );
}

function Input({ value, onChange, type = "text", placeholder, className = "", showNA = false }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string; className?: string; showNA?: boolean }) {
    const isEmail = type === "email";
    return (
        <div className="relative flex items-center w-full">
            <input
                type={type}
                value={isNA(value) ? "N/A" : (value ?? "")}
                onChange={e => onChange(isEmail ? e.target.value.toLowerCase() : e.target.value.toUpperCase())}
                placeholder={placeholder}
                className={`w-full h-9 px-3 text-[13px] font-medium text-zinc-800 bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all ${isEmail ? "" : "uppercase"} ${showNA ? "pr-10" : ""} ${className}`}
            />
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

function PhoneInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
    const handlePhoneChange = (v: string) => {
        if (v === "N/A") return;
        // If user tries to delete prefix, reset it
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
                value={isNA(value) ? "N/A" : (value?.startsWith("+92") ? value : ("+92" + (value || "")))}
                onChange={e => handlePhoneChange(e.target.value)}
                placeholder={placeholder}
                className="w-full h-9 pl-3 pr-10 text-[13px] font-medium text-zinc-800 bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all font-mono"
            />
            <button 
                type="button"
                onClick={() => onChange(isNA(value) ? "+92" : "N/A")}
                className={`absolute right-1.5 px-1.5 py-1 text-[9px] font-black rounded-lg transition-all ${isNA(value) ? "bg-indigo-600 text-white shadow-sm" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}
            >
                N/A
            </button>
        </div>
    );
}

function Textarea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
    return (
        <textarea
            value={value ?? ""}
            onChange={e => onChange(e.target.value.toUpperCase())}
            placeholder={placeholder}
            rows={3}
            className="w-full px-3 py-2 text-[13px] font-medium text-zinc-800 bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all resize-none uppercase"
        />
    );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="flex items-center gap-3 cursor-pointer">
            <div
                onClick={() => onChange(!checked)}
                className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-primary" : "bg-zinc-200"}`}
            >
                <span className={`absolute top-0.5 left-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
            </div>
            <span className="text-[13px] font-medium text-zinc-700 uppercase">{label}</span>
        </label>
    );
}

function SectionSaveBtn({ onSave, isSaving, saved, isDirty }: { onSave: () => void; isSaving: boolean; saved: boolean; isDirty: boolean }) {
    if (!isDirty && !isSaving && !saved) return null;
    return (
        <button
            onClick={onSave}
            disabled={isSaving || saved}
            className={`flex items-center gap-1.5 px-4 h-8 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all shadow-sm ${saved ? "bg-emerald-500 text-white shadow-emerald-200" : "bg-primary text-white shadow-primary/20 hover:bg-primary/90 disabled:opacity-50"}`}
        >
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : saved ? <CheckCircle2 className="h-3 w-3" /> : <Save className="h-3 w-3" />}
            {isSaving ? "Submitting..." : saved ? "Submitted" : "Save Changes"}
        </button>
    );
}

function SectionCard({ title, children, onSave, isSaving, saved, isDirty }: { title: string; children: React.ReactNode; onSave: () => void; isSaving: boolean; saved: boolean; isDirty: boolean }) {
    return (
        <div className={`bg-zinc-50/60 border rounded-2xl p-5 space-y-4 transition-all ${isDirty ? "border-amber-200 ring-1 ring-amber-100" : "border-zinc-100"}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">{title}</h3>
                    {isDirty && <span className="text-[9px] font-black px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-md uppercase animate-pulse">Unsaved</span>}
                </div>
                <SectionSaveBtn onSave={onSave} isSaving={isSaving} saved={saved} isDirty={isDirty} />
            </div>
            <div className="grid grid-cols-2 gap-4 text-zinc-600">{children}</div>
        </div>
    );
}

// ── Identity Tab ─────────────────────────────────────────────────────────────
export function IdentityTab({ student, onReload }: { student: any; onReload: () => void }) {
    const patch = async (payload: Record<string, any>, setSaving: (v: boolean) => void, setSaved: (v: boolean) => void) => {
        setSaving(true);
        try {
            await api.patch(`/v1/staff-editing/students/${student.cc}`, payload);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
            onReload();
        } catch (e) {
            console.error(e);
            alert("Failed to update student identity: " + ((e as any)?.response?.data?.message || "Unknown error"));
        } finally {
            setSaving(false);
        }
    };


    const validateEmail = (email: string) => {
        if (!email) return true;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    // Helper to check if a field has changed
    const isBaseDirty = (current: any, original: any) => {
        return Object.keys(current).some(key => {
            const curVal = current[key];
            const origVal = original[key];
            
            // Special handling for dates
            if (key === "dob") {
                const d1 = curVal ? new Date(curVal).toISOString().split("T")[0] : "";
                const d2 = origVal ? new Date(origVal).toISOString().split("T")[0] : "";
                return d1 !== d2;
            }
            
            // Normalize empty strings vs null for comparison
            return (curVal || "") !== (origVal || "");
        });
    };

    // Section: Personal
    const [personal, setPersonal] = useState({
        full_name: student.full_name || "",
        dob: student.dob ? new Date(student.dob).toISOString().split("T")[0] : "",
        gender: student.gender || "",
        nationality: student.nationality || "",
        religion: student.religion || "",
        identification_marks: student.identification_marks || "",
        admission_age_years: String(student.admission_age_years ?? ""),
        interests: student.interests || "",
        consent_publicity: !!student.consent_publicity,
        physical_impairment: student.physical_impairment || "",
    });
    const [savingPersonal, setSavingPersonal] = useState(false);
    const [savedPersonal, setSavedPersonal] = useState(false);
    const personalIsDirty = isBaseDirty(personal, student);

    // Section: Medical
    const [medical, setMedical] = useState({ medical_info: student.medical_info || "" });
    const [savingMedical, setSavingMedical] = useState(false);
    const [savedMedical, setSavedMedical] = useState(false);
    const medicalIsDirty = (medical.medical_info || "") !== (student.medical_info || "");

    // Section: Contact
    const [contact, setContact] = useState({
        whatsapp_number: student.whatsapp_number || "",
        primary_phone: student.primary_phone || "",
        email: student.email || "",
        country: student.country || "",
        province: student.province || "",
        city: student.city || "",
    });
    const [savingContact, setSavingContact] = useState(false);
    const [savedContact, setSavedContact] = useState(false);
    const contactIsDirty = isBaseDirty(contact, student);

    // Section: Fee Config
    const [feeConfig, setFeeConfig] = useState({
        is_complementary: !!student.is_complementary,
        is_fee_endowment: !!student.is_fee_endowment,
        fee_start_term: student.fee_start_term || "",
    });
    const [savingFeeConfig, setSavingFeeConfig] = useState(false);
    const [savedFeeConfig, setSavedFeeConfig] = useState(false);
    const feeConfigIsDirty = isBaseDirty(feeConfig, student);

    const p = (k: keyof typeof personal) => (v: any) => setPersonal(prev => ({ ...prev, [k]: v }));
    const c = (k: keyof typeof contact) => (v: any) => setContact(prev => ({ ...prev, [k]: v }));
    const f = (k: keyof typeof feeConfig) => (v: any) => setFeeConfig(prev => ({ ...prev, [k]: v }));

    return (
        <div className="space-y-4">
            {student.status === 'GRADUATED' && (
                <div className="p-4 rounded-3xl border border-indigo-100 bg-indigo-50/30 flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="h-12 w-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                        <GraduationCap className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-none mb-1">Graduation Status</p>
                        <p className="text-sm font-bold text-indigo-900/80 leading-tight">
                            {student.graduated_from_class 
                                ? <>This student graduated from <span className="text-indigo-700">{student.graduated_from_class.description}</span>.</>
                                : "This student has graduated from the institution."
                            }
                        </p>
                    </div>
                </div>
            )}

            <SectionCard 
                title="Fee Configuration" 
                isDirty={feeConfigIsDirty}
                isSaving={savingFeeConfig} 
                saved={savedFeeConfig}
                onSave={() => patch(feeConfig, setSavingFeeConfig, setSavedFeeConfig)} 
            >
                <div className="flex flex-col gap-4">
                    <Toggle label="Complementary (Fee Waived)" checked={feeConfig.is_complementary} onChange={f("is_complementary")} />
                    <Toggle label="Fee Endowment" checked={feeConfig.is_fee_endowment} onChange={f("is_fee_endowment")} />
                </div>
                <Field label="Fee Start Term">
                    <Input value={feeConfig.fee_start_term} onChange={f("fee_start_term")} placeholder="e.g. 2024-25" />
                </Field>
            </SectionCard>

            <SectionCard 
                title="Personal Information" 
                isDirty={personalIsDirty}
                isSaving={savingPersonal} 
                saved={savedPersonal}
                onSave={() => patch({ 
                    ...personal, 
                    admission_age_years: personal.admission_age_years ? Number(personal.admission_age_years) : undefined 
                }, setSavingPersonal, setSavedPersonal)} 
            >
                <div className="col-span-2 flex gap-6 pb-2 border-b border-zinc-100 mb-2">
                    <PhotoUpload 
                        cc={student.cc} 
                        type="standard" 
                        currentUrl={student.photograph_url} 
                        label="Candidate Photograph" 
                        onSuccess={onReload} 
                    />
                </div>

                <div className="col-span-2">
                    <Field label="Full Name"><Input value={personal.full_name} onChange={p("full_name")} /></Field>
                </div>
                <Field label="Date of Birth"><Input type="date" value={personal.dob} onChange={p("dob")} /></Field>
                <Field label="Gender">
                    <select value={(personal.gender || "").toUpperCase()} onChange={e => p("gender")(e.target.value.toUpperCase())} className="w-full h-9 px-3 text-[13px] font-medium bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 appearance-none uppercase">
                        <option value="">SELECT</option>
                        <option value="MALE">MALE</option>
                        <option value="FEMALE">FEMALE</option>
                        <option value="OTHER">OTHER</option>
                    </select>
                </Field>
                <Field label="Nationality"><Input value={personal.nationality} onChange={p("nationality")} /></Field>
                <Field label="Religion"><Input value={personal.religion} onChange={p("religion")} /></Field>
                <Field label="Admission Age">
                    <Input 
                        value={personal.admission_age_years} 
                        onChange={v => p("admission_age_years")(v.replace(/\D/g, ""))} 
                        placeholder="Numeric only"
                    />
                </Field>
                <div className="col-span-2">
                    <Field label="Identification Marks"><Input value={personal.identification_marks} onChange={p("identification_marks")} /></Field>
                </div>
                <div className="col-span-2">
                    <Field label="Interests"><Textarea value={personal.interests} onChange={p("interests")} /></Field>
                </div>
                <div className="col-span-2">
                    <Field label="Physical Impairment"><Input value={personal.physical_impairment} onChange={p("physical_impairment")} /></Field>
                </div>
                <div className="col-span-2">
                    <Toggle label="Consent to Publicity" checked={personal.consent_publicity} onChange={p("consent_publicity")} />
                </div>
            </SectionCard>

            <SectionCard 
                title="Medical Information" 
                isDirty={medicalIsDirty}
                isSaving={savingMedical} 
                saved={savedMedical}
                onSave={() => patch(medical, setSavingMedical, setSavedMedical)} 
            >
                <div className="col-span-2">
                    <Field label="Medical Info"><Textarea value={medical.medical_info} onChange={v => setMedical({ medical_info: v })} placeholder="Allergies, conditions, medications..." /></Field>
                </div>
            </SectionCard>

            <SectionCard 
                title="Contact & Address" 
                isDirty={contactIsDirty}
                isSaving={savingContact} 
                saved={savedContact}
                onSave={() => {
                    if (!validateEmail(contact.email)) return alert("Please enter a valid email address");
                    patch(contact, setSavingContact, setSavedContact);
                }} 
            >
                <Field label="WhatsApp"><PhoneInput value={contact.whatsapp_number} onChange={c("whatsapp_number")} /></Field>
                <Field label="Phone"><PhoneInput value={contact.primary_phone} onChange={c("primary_phone")} /></Field>
                <div className="col-span-2">
                    <Field label="Email"><Input type="email" value={contact.email} onChange={c("email")} placeholder="example@domain.com" /></Field>
                </div>
                <Field label="Country">
                    <div className="relative flex items-center">
                        <Input value={contact.country} onChange={c("country")} />
                        <button type="button" onClick={() => c("country")(isNA(contact.country) ? "" : "N/A")} className={`absolute right-1 px-1.5 py-1 text-[9px] font-black rounded-lg ${isNA(contact.country) ? "bg-primary text-white" : "text-zinc-400 hover:bg-zinc-100"}`}>N/A</button>
                    </div>
                </Field>
                <Field label="Province">
                    <div className="relative flex items-center">
                        <Input value={contact.province} onChange={c("province")} />
                        <button type="button" onClick={() => c("province")(isNA(contact.province) ? "" : "N/A")} className={`absolute right-1 px-1.5 py-1 text-[9px] font-black rounded-lg ${isNA(contact.province) ? "bg-primary text-white" : "text-zinc-400 hover:bg-zinc-100"}`}>N/A</button>
                    </div>
                </Field>
                <div className="col-span-2">
                    <Field label="City">
                        <div className="relative flex items-center">
                            <Input value={contact.city} onChange={c("city")} />
                            <button type="button" onClick={() => c("city")(isNA(contact.city) ? "" : "N/A")} className={`absolute right-1 px-1.5 py-1 text-[9px] font-black rounded-lg ${isNA(contact.city) ? "bg-primary text-white" : "text-zinc-400 hover:bg-zinc-100"}`}>N/A</button>
                        </div>
                    </Field>
                </div>
            </SectionCard>
        </div>
    );
}
