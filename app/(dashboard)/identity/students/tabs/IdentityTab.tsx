"use client";
import { useState, useEffect } from "react";
import { Save, Loader2, CheckCircle2, GraduationCap, Pencil, Mail, Phone, User, Calendar, MapPin, Heart, Shield, X, Eye } from "lucide-react";
import api from "@/lib/api";
import { PhotoUpload } from "./PhotoUpload";
import { getAcademicYears } from "@/lib/fee-utils";

const ACADEMIC_YEARS = getAcademicYears(1, 4);

const isNA = (v: any) => v === "N/A" || v === "021-N/A" || !v;

const formatCNIC = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 13);
    let out = digits;
    if (digits.length > 5) out = digits.slice(0, 5) + "-" + digits.slice(5);
    if (digits.length > 12) out = out.slice(0, 13) + "-" + out.slice(13);
    return out;
};

const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
    } catch {
        return dateStr;
    }
};

// ── Primitives ──────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">{label}</label>
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
                value={isNA(value) ? "" : (value ?? "")}
                onChange={e => onChange(isEmail ? e.target.value.toLowerCase() : e.target.value.toUpperCase())}
                placeholder={placeholder}
                className={`w-full h-10 px-3 text-[13px] font-medium text-zinc-800 bg-white border border-zinc-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all ${isEmail ? "" : "uppercase"} ${showNA ? "pr-10" : ""} ${className}`}
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
        if (!v.startsWith("+92")) {
            onChange("+92");
            return;
        }
        const rest = v.slice(3).replace(/\D/g, "").slice(0, 10);
        onChange("+92" + rest);
    };

    return (
        <div className="relative flex items-center w-full">
            <input
                type="text"
                value={isNA(value) ? "" : (value?.startsWith("+92") ? value : ("+92" + (value || "")))}
                onChange={e => handlePhoneChange(e.target.value)}
                placeholder={placeholder}
                className="w-full h-10 pl-3 pr-10 text-[13px] font-medium text-zinc-800 bg-white border border-zinc-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-mono"
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
            className="w-full px-3 py-2 text-[13px] font-medium text-zinc-800 bg-white border border-zinc-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all resize-none uppercase"
        />
    );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="flex items-center gap-3 cursor-pointer">
            <div
                onClick={() => onChange(!checked)}
                className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-indigo-600" : "bg-zinc-200"}`}
            >
                <span className={`absolute top-0.5 left-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
            </div>
            <span className="text-[12px] font-bold text-zinc-700 uppercase tracking-tight">{label}</span>
        </label>
    );
}

// ── Identity Tab ─────────────────────────────────────────────────────────────
export function IdentityTab({ student, onReload }: { student: any; onReload: () => void }) {
    const patch = async (payload: Record<string, any>, setSaving: (v: boolean) => void, setSaved: (v: boolean) => void, toggleEdit: () => void) => {
        setSaving(true);
        try {
            await api.patch(`/v1/staff-editing/students/${student.cc}`, payload);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
            toggleEdit();
            onReload();
        } catch (e) {
            console.error(e);
            alert("Failed to update: " + ((e as any)?.response?.data?.message || "Unknown error"));
        } finally {
            setSaving(false);
        }
    };

    const validateEmail = (email: string) => {
        if (!email) return true;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    // States for Edit Toggles
    const [editBasic, setEditBasic] = useState(false);
    const [editAddress, setEditAddress] = useState(false);
    const [editMedical, setEditMedical] = useState(false);
    const [isViewerOpen, setIsViewerOpen] = useState(false);

    // Section: Personal (Basic Info)
    const [personal, setPersonal] = useState({
        full_name: student.full_name || "",
        cnic: student.cnic || "",
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

    // Section: Medical
    const [medical, setMedical] = useState({ medical_info: student.medical_info || "" });
    const [savingMedical, setSavingMedical] = useState(false);
    const [savedMedical, setSavedMedical] = useState(false);

    // Section: Contact & Address
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

    // Section: Fee Config
    const [feeConfig, setFeeConfig] = useState({
        is_complementary: !!student.is_complementary,
        is_fee_endowment: !!student.is_fee_endowment,
        fee_start_term: student.fee_start_term || "",
    });
    const [savingFeeConfig, setSavingFeeConfig] = useState(false);
    const [savedFeeConfig, setSavedFeeConfig] = useState(false);

    // Sync state on prop changes
    useEffect(() => {
        setPersonal({
            full_name: student.full_name || "",
            cnic: student.cnic || "",
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
        setContact({
            whatsapp_number: student.whatsapp_number || "",
            primary_phone: student.primary_phone || "",
            email: student.email || "",
            country: student.country || "",
            province: student.province || "",
            city: student.city || "",
        });
        setMedical({ medical_info: student.medical_info || "" });
        setFeeConfig({
            is_complementary: !!student.is_complementary,
            is_fee_endowment: !!student.is_fee_endowment,
            fee_start_term: student.fee_start_term || "",
        });
    }, [student]);

    const p = (k: keyof typeof personal) => (v: any) => setPersonal(prev => ({ ...prev, [k]: v }));
    const c = (k: keyof typeof contact) => (v: any) => setContact(prev => ({ ...prev, [k]: v }));
    const f = (k: keyof typeof feeConfig) => (v: any) => setFeeConfig(prev => ({ ...prev, [k]: v }));
    
    const primaryGuardian = student.guardians?.find((g: any) => g.is_primary_contact);
    const primaryGuardianCnic = primaryGuardian?.cnic || "N/A";

    const handleSaveBasic = () => {
        // We save personal and main contact details together for Basic Info
        patch({
            ...personal,
            dob: personal.dob || undefined,
            admission_age_years: personal.admission_age_years ? Number(personal.admission_age_years) : undefined,
            primary_phone: contact.primary_phone,
            whatsapp_number: contact.whatsapp_number,
            email: contact.email,
            is_complementary: feeConfig.is_complementary,
            is_fee_endowment: feeConfig.is_fee_endowment,
            fee_start_term: feeConfig.fee_start_term || undefined
        }, setSavingPersonal, setSavedPersonal, () => setEditBasic(false));
    };

    const handleSaveAddress = () => {
        patch({
            country: contact.country,
            province: contact.province,
            city: contact.city,
        }, setSavingContact, setSavedContact, () => setEditAddress(false));
    };

    const handleSaveMedical = () => {
        patch(medical, setSavingMedical, setSavedMedical, () => setEditMedical(false));
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {student.status === 'GRADUATED' && (
                <div className="p-4 rounded-3xl border border-indigo-100 bg-indigo-50/30 flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="h-12 w-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                        <GraduationCap className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-none mb-1">Graduation Status</p>
                        <p className="text-sm font-bold text-indigo-900/80 leading-tight">
                            {student.graduated_from_class?.description
                                ? <>This student graduated from <span className="text-indigo-700 font-black">{student.graduated_from_class.description}</span></>
                                : student.graduated_from_class_id
                                ? <>This student graduated from class ID <span className="text-indigo-700 font-black">{student.graduated_from_class_id}</span></>
                                : <>This student has graduated from the institution</>
                            }
                            {student.graduated_at
                                ? <> on <span className="text-indigo-700 font-black">{new Date(student.graduated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>.</>
                                : "."
                            }
                        </p>
                    </div>
                </div>
            )}

            {/* 1. BASIC INFORMATION CARD */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-6 shadow-sm relative transition-all duration-200">
                <div className="absolute top-6 right-6 flex items-center gap-2">
                    {editBasic ? (
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setEditBasic(false)} 
                                className="flex items-center justify-center p-2 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                            <button 
                                onClick={handleSaveBasic} 
                                disabled={savingPersonal}
                                className="flex items-center gap-1.5 px-3 h-8 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
                            >
                                {savingPersonal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                Save
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setEditBasic(true)}
                            className="p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-600 transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
                        >
                            <Pencil className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <h3 className="text-[16px] font-extrabold text-zinc-900 dark:text-zinc-100 mb-6 tracking-tight">Basic information</h3>

                {editBasic ? (
                    <div className="space-y-6">
                        <div className="flex gap-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                            <PhotoUpload 
                                cc={student.cc} 
                                type="standard" 
                                currentUrl={student.photograph_url} 
                                label="Candidate Photograph" 
                                onSuccess={onReload} 
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label="Full Name"><Input value={personal.full_name} onChange={p("full_name")} /></Field>
                            <Field label="Student CNIC"><Input value={personal.cnic} onChange={v => p("cnic")(formatCNIC(v))} placeholder="xxxxx-xxxxxxx-x" /></Field>
                            <Field label="Primary Guardian CNIC">
                                <div className="w-full h-10 px-3 flex items-center text-[13px] font-medium text-zinc-400 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-xl font-mono">
                                    {primaryGuardianCnic}
                                </div>
                            </Field>
                            <Field label="Date of Birth"><Input type="date" value={personal.dob} onChange={p("dob")} /></Field>
                            <Field label="Gender">
                                <select value={(personal.gender || "").toUpperCase()} onChange={e => p("gender")(e.target.value.toUpperCase())} className="w-full h-10 px-3 text-[13px] font-medium bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 appearance-none uppercase">
                                    <option value="">SELECT</option>
                                    <option value="MALE">MALE</option>
                                    <option value="FEMALE">FEMALE</option>
                                    <option value="OTHER">OTHER</option>
                                </select>
                            </Field>
                            <Field label="Religion"><Input value={personal.religion} onChange={p("religion")} /></Field>
                            <Field label="Nationality"><Input value={personal.nationality} onChange={p("nationality")} /></Field>
                            <Field label="Email Address"><Input type="email" value={contact.email} onChange={c("email")} placeholder="student@example.com" /></Field>
                            <Field label="Primary Phone"><PhoneInput value={contact.primary_phone} onChange={c("primary_phone")} /></Field>
                            <Field label="WhatsApp Number"><PhoneInput value={contact.whatsapp_number} onChange={c("whatsapp_number")} /></Field>
                            <Field label="Admission Age (Years)"><Input value={personal.admission_age_years} onChange={v => p("admission_age_years")(v.replace(/\D/g, ""))} /></Field>
                            <Field label="Identification Marks"><Input value={personal.identification_marks} onChange={p("identification_marks")} /></Field>
                            
                            <div className="col-span-1 md:col-span-2 border-t border-zinc-100 dark:border-zinc-800 pt-4 mt-2 space-y-4">
                                <h4 className="text-[12px] font-bold text-zinc-400 uppercase tracking-widest">Fee & Privacy Configuration</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-3">
                                        <Toggle label="Complementary (Fee Waived)" checked={feeConfig.is_complementary} onChange={f("is_complementary")} />
                                        <Toggle label="Fee Endowment" checked={feeConfig.is_fee_endowment} onChange={f("is_fee_endowment")} />
                                    </div>
                                    <Field label="Fee Start Term">
                                        <select 
                                            value={feeConfig.fee_start_term} 
                                            onChange={e => f("fee_start_term")(e.target.value)}
                                            className="w-full h-10 px-3 text-[13px] font-medium bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 appearance-none uppercase"
                                        >
                                            <option value="">N/A</option>
                                            {ACADEMIC_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </Field>
                                    <div className="col-span-1 md:col-span-2">
                                        <Toggle label="Consent to Publicity" checked={personal.consent_publicity} onChange={p("consent_publicity")} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        {/* Profile Photo & Primary Details Left column */}
                        <div className="flex flex-col items-center md:items-start text-center md:text-left gap-4 w-full md:w-1/3 max-w-[240px] shrink-0">
                            <div className="relative group/avatar h-28 w-28 bg-zinc-50 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden flex items-center justify-center shrink-0">
                                {student.photograph_url ? (
                                    <>
                                        <img 
                                            src={student.photograph_url.replace(/([^:])\/\//g, '$1/')} 
                                            alt={student.full_name} 
                                            className="h-full w-full object-cover" 
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={() => setIsViewerOpen(true)}>
                                            <div className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 hover:scale-105 active:scale-95 transition-all shadow-md">
                                                <Eye className="h-5 w-5" />
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <User className="h-12 w-12 text-zinc-300" />
                                )}
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 leading-tight uppercase">{student.full_name}</h4>
                                <p className="text-[12px] font-mono text-zinc-400">CC {student.cc}</p>
                            </div>

                            <div className="w-full space-y-3 pt-2">
                                <div className="flex flex-col gap-0.5 text-[13px] text-zinc-650 dark:text-zinc-400">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Gender</span>
                                    <span className="font-semibold capitalize">{student.gender || "Gender N/A"}</span>
                                </div>
                                <div className="flex flex-col gap-0.5 text-[13px] text-zinc-650 dark:text-zinc-400 truncate w-full">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Email Address</span>
                                    <span className="font-semibold truncate block" title={student.email}>{student.email || "Email N/A"}</span>
                                </div>
                                <div className="flex flex-col gap-0.5 text-[13px] text-zinc-655 dark:text-zinc-400">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Primary Phone</span>
                                    <span className="font-semibold font-mono">{student.primary_phone || "Phone N/A"}</span>
                                </div>
                                <div className="flex flex-col gap-0.5 text-[13px] text-zinc-655 dark:text-zinc-400">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">WhatsApp</span>
                                    <span className="font-semibold font-mono">{student.whatsapp_number || "WhatsApp N/A"}</span>
                                </div>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="hidden md:block w-px self-stretch bg-zinc-100 dark:bg-zinc-800" />

                        {/* Right column details */}
                        <div className="flex-1 grid grid-cols-2 gap-y-5 gap-x-4 w-full">
                            <div>
                                <p className="text-[12px] font-bold text-zinc-400 uppercase tracking-tight">Place of birth</p>
                                <p className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200 uppercase mt-0.5">{student.city || student.nationality || "N/A"}</p>
                            </div>
                            <div>
                                <p className="text-[12px] font-bold text-zinc-400 uppercase tracking-tight">Birth date</p>
                                <p className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5">{formatDate(student.dob)}</p>
                            </div>
                            <div>
                                <p className="text-[12px] font-bold text-zinc-400 uppercase tracking-tight">Student CNIC</p>
                                <p className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200 font-mono mt-0.5">{student.cnic || "N/A"}</p>
                            </div>
                            <div>
                                <p className="text-[12px] font-bold text-zinc-400 uppercase tracking-tight">Primary Guardian CNIC</p>
                                <p className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200 font-mono mt-0.5">{primaryGuardianCnic}</p>
                            </div>
                            <div>
                                <p className="text-[12px] font-bold text-zinc-400 uppercase tracking-tight">Religion</p>
                                <p className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200 uppercase mt-0.5">{student.religion || "N/A"}</p>
                            </div>
                            <div>
                                <p className="text-[12px] font-bold text-zinc-400 uppercase tracking-tight">Nationality</p>
                                <p className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200 uppercase mt-0.5">{student.nationality || "N/A"}</p>
                            </div>
                            <div>
                                <p className="text-[12px] font-bold text-zinc-400 uppercase tracking-tight">Admission Age</p>
                                <p className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5">{student.admission_age_years ? `${student.admission_age_years} YEARS` : "N/A"}</p>
                            </div>
                            <div>
                                <p className="text-[12px] font-bold text-zinc-400 uppercase tracking-tight">Enrollment status</p>
                                <p className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 uppercase">{student.status || "N/A"}</p>
                            </div>
                            {student.identification_marks && (
                                <div className="col-span-2">
                                    <p className="text-[12px] font-bold text-zinc-400 uppercase tracking-tight">Identification marks</p>
                                    <p className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 uppercase">{student.identification_marks}</p>
                                </div>
                            )}
                            {student.interests && (
                                <div className="col-span-2">
                                    <p className="text-[12px] font-bold text-zinc-400 uppercase tracking-tight">Interests & Hobbies</p>
                                    <p className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 uppercase">{student.interests}</p>
                                </div>
                            )}

                            {/* Fee & Publicity configurations with explicit status */}
                            <div className="col-span-2 border-t border-zinc-100 dark:border-zinc-800 pt-4 mt-2 space-y-3">
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Fee & Privacy Status</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
                                        <span className="text-[12px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-tight">Complementary (Fee Waived)</span>
                                        {student.is_complementary ? (
                                            <span className="px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/30 rounded-md uppercase">ACTIVE</span>
                                        ) : (
                                            <span className="px-2 py-0.5 text-[10px] font-bold text-zinc-400 dark:text-zinc-550 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/50 rounded-md uppercase">NO</span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
                                        <span className="text-[12px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-tight">Fee Endowment</span>
                                        {student.is_fee_endowment ? (
                                            <span className="px-2 py-0.5 text-[10px] font-extrabold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 border border-purple-200/50 dark:border-purple-800/30 rounded-md uppercase">ACTIVE</span>
                                        ) : (
                                            <span className="px-2 py-0.5 text-[10px] font-bold text-zinc-400 dark:text-zinc-550 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/50 rounded-md uppercase">NO</span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
                                        <span className="text-[12px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-tight">Publicity Consent</span>
                                        {student.consent_publicity ? (
                                            <span className="px-2 py-0.5 text-[10px] font-extrabold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200/50 dark:border-indigo-800/30 rounded-md uppercase">GRANTED</span>
                                        ) : (
                                            <span className="px-2 py-0.5 text-[10px] font-bold text-zinc-400 dark:text-zinc-550 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/50 rounded-md uppercase">NO CONSENT</span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
                                        <span className="text-[12px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-tight">Physical Impairment</span>
                                        {student.physical_impairment ? (
                                            <span className="px-2 py-0.5 text-[10px] font-extrabold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/30 rounded-md uppercase">{student.physical_impairment}</span>
                                        ) : (
                                            <span className="px-2 py-0.5 text-[10px] font-bold text-zinc-400 dark:text-zinc-550 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/50 rounded-md uppercase">NONE</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 2. ADDRESS CARD */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-6 shadow-sm relative transition-all duration-200">
                <div className="absolute top-6 right-6 flex items-center gap-2">
                    {editAddress ? (
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setEditAddress(false)} 
                                className="flex items-center justify-center p-2 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                            <button 
                                onClick={handleSaveAddress} 
                                disabled={savingContact}
                                className="flex items-center gap-1.5 px-3 h-8 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
                            >
                                {savingContact ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                Save
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setEditAddress(true)}
                            className="p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-600 transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
                        >
                            <Pencil className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <h3 className="text-[16px] font-extrabold text-zinc-900 dark:text-zinc-100 mb-6 tracking-tight">Address</h3>

                {editAddress ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Field label="Country"><Input value={contact.country} onChange={c("country")} /></Field>
                        <Field label="Province"><Input value={contact.province} onChange={c("province")} /></Field>
                        <Field label="City"><Input value={contact.city} onChange={c("city")} /></Field>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <p className="text-[12px] font-bold text-zinc-400 uppercase tracking-tight">Residential address</p>
                            <p className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200 mt-1 uppercase">
                                {student.residential_address || `${student.city || ""}, ${student.province || ""}, ${student.country || ""}`.replace(/,\s*,/g, ",").trim() || "N/A"}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* 3. MEDICAL INFORMATION CARD */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-6 shadow-sm relative transition-all duration-200">
                <div className="absolute top-6 right-6 flex items-center gap-2">
                    {editMedical ? (
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setEditMedical(false)} 
                                className="flex items-center justify-center p-2 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                            <button 
                                onClick={handleSaveMedical} 
                                disabled={savingMedical}
                                className="flex items-center gap-1.5 px-3 h-8 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
                            >
                                {savingMedical ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                Save
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setEditMedical(true)}
                            className="p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-600 transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
                        >
                            <Pencil className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <h3 className="text-[16px] font-extrabold text-zinc-900 dark:text-zinc-100 mb-6 tracking-tight flex items-center gap-2">
                    <Heart className="h-5 w-5 text-rose-500 shrink-0" />
                    Medical Info
                </h3>

                {editMedical ? (
                    <div className="col-span-2">
                        <Field label="Medical details"><Textarea value={medical.medical_info} onChange={v => setMedical({ medical_info: v })} placeholder="Allergies, conditions, medications..." /></Field>
                    </div>
                ) : (
                    <div className="text-[13px] text-zinc-700 dark:text-zinc-300 font-medium">
                        {student.medical_info ? (
                            <p className="bg-zinc-50 dark:bg-zinc-800/50 p-4 border border-zinc-100 dark:border-zinc-800 rounded-2xl leading-relaxed uppercase">{student.medical_info}</p>
                        ) : (
                            <p className="italic text-zinc-400">No medical conditions or warnings reported.</p>
                        )}
                    </div>
                )}
            </div>

            {isViewerOpen && student.photograph_url && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 cursor-zoom-out" onClick={() => setIsViewerOpen(false)}>
                    <div className="relative max-w-4xl max-h-[90vh] bg-zinc-950 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 flex flex-col" onClick={e => e.stopPropagation()}>
                        <button 
                            onClick={() => setIsViewerOpen(false)}
                            className="absolute top-4 right-4 z-10 p-2 bg-black/60 hover:bg-black/80 text-white rounded-xl transition-all border border-zinc-800"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <img 
                            src={student.photograph_url.replace(/([^:])\/\//g, '$1/')} 
                            alt={student.full_name} 
                            className="max-w-full max-h-[85vh] object-contain rounded-xl cursor-default"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
