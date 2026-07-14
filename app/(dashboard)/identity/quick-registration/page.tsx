"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    User,
    Calendar,
    MapPin,
    Building2,
    Users,
    Plus,
    Trash2,
    Loader2,
    ClipboardPlus,
    Camera,
    ChevronDown,
    ChevronUp,
    FileText,
    AlertCircle,
    CheckCircle2,
    Banknote,
    UserCircle,
    ShieldCheck,
    Hash,
    GraduationCap,
    BookOpen,
    StickyNote,
} from "lucide-react";
import api from "@/lib/api";
import { campusesService, type Campus } from "@/lib/campuses.service";

// ── Types ──────────────────────────────────────────────────────────────────────

interface GuardianInput {
    name: string;
    relation: "Father" | "Mother" | "Guardian";
    cnic: string;
    photoFile: File | null;
    photoPreview: string | null;
}

interface FormErrors {
    full_name?: string;
    date_of_birth?: string;
    deposit_amount?: string;
    admission_level?: string;
    guardians?: { name?: string; cnic?: string }[];
    submit?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatCnic(raw: string): string {
    const digits = raw.replace(/\D/g, "").slice(0, 13);
    let out = digits;
    if (digits.length > 5) out = digits.slice(0, 5) + "-" + digits.slice(5);
    if (digits.length > 12) out = out.slice(0, 13) + "-" + out.slice(13);
    return out;
}

function isCnicValid(v: string): boolean {
    return /^[0-9]{5}-[0-9]{7}-[0-9]$/.test(v.trim());
}

function calcAge(dob: string): number | null {
    if (!dob) return null;
    const d = new Date(dob);
    if (isNaN(d.getTime())) return null;
    const today = new Date();
    let a = today.getFullYear() - d.getFullYear();
    if (today.getMonth() < d.getMonth() || (today.getMonth() === d.getMonth() && today.getDate() < d.getDate())) a--;
    return a;
}

// ── Shared UI ──────────────────────────────────────────────────────────────────

const inputCls =
    "w-full h-10 px-3.5 text-[13px] font-medium text-zinc-800 bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-zinc-400";

function SectionCard({ icon, title, children, rightSlot }: { icon: React.ReactNode; title: string; children: React.ReactNode; rightSlot?: React.ReactNode }) {
    return (
        <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-50 bg-zinc-50/60">
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-white border border-zinc-100 shadow-sm flex items-center justify-center text-zinc-500">
                        {icon}
                    </div>
                    <h2 className="text-[12px] font-black text-zinc-700 uppercase tracking-[0.15em]">{title}</h2>
                </div>
                {rightSlot}
            </div>
            <div className="px-6 py-5">{children}</div>
        </div>
    );
}

function FormField({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                {label}
                {required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
            {error && (
                <p className="text-[11px] font-bold text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {error}
                </p>
            )}
        </div>
    );
}

// ── Page ───────────────────────────────────────────────────────────────────────

const INITIAL_GUARDIAN: GuardianInput = { name: "", relation: "Father", cnic: "", photoFile: null, photoPreview: null };

export default function QuickRegistrationPage() {
    const router = useRouter();

    // ── Candidate Info
    const [fullName, setFullName] = useState("");
    const [dob, setDob] = useState("");
    const [gender, setGender] = useState<"Male" | "Female">("Male");
    const [address, setAddress] = useState("");
    const [selectedCampusId, setSelectedCampusId] = useState<number | "">("");

    // ── Class Applying For
    const [admissionSystem, setAdmissionSystem] = useState<"" | "cambridge" | "secondary" | "alevel">("");
    const [admissionLevel, setAdmissionLevel] = useState("");

    // ── Guardian Info
    const [addGuardian, setAddGuardian] = useState(false);
    const [guardians, setGuardians] = useState<GuardianInput[]>([{ ...INITIAL_GUARDIAN }]);

    // ── Admission Details
    const [depositAmount, setDepositAmount] = useState("");
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const guardianFileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

    // ── Internal Notes
    const [adminNotes, setAdminNotes] = useState("");

    // ── Meta
    const [campuses, setCampuses] = useState<Campus[]>([]);
    const [errors, setErrors] = useState<FormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStep, setSubmitStep] = useState<"" | "creating" | "uploading" | "done">("");
    const [generatedCc, setGeneratedCc] = useState<number | null>(null);

    useEffect(() => {
        campusesService.list().then(setCampuses).catch(() => {});
    }, []);

    const age = calcAge(dob);
    const selectedCampus = campuses.find((c) => c.id === selectedCampusId);

    const offeredClassNames = selectedCampus
        ? (selectedCampus.offered_classes || []).map((c) => c.description.trim().toUpperCase())
        : [];
    const cambridgeClasses = ["Pre-Nursery", "Nursery", "K.G.", "JR-I", "JR-II", "JR-III", "JR-IV", "JR-V", "SR-I", "SR-II", "SR-III", "O-I", "O-II", "O-III"]
        .filter((cls) => !selectedCampusId || offeredClassNames.includes(cls.trim().toUpperCase()));
    const secondaryClasses = ["VI", "VII", "VIII", "IX", "X"]
        .filter((cls) => !selectedCampusId || offeredClassNames.includes(cls.trim().toUpperCase()));
    const aLevelClasses = ["AS Level", "A2 Level"]
        .filter((cls) => !selectedCampusId || offeredClassNames.includes(cls.trim().toUpperCase()));
    const hasCambridge = cambridgeClasses.length > 0;
    const hasSecondary = secondaryClasses.length > 0;
    const hasALevel = aLevelClasses.length > 0;

    useEffect(() => {
        if (!selectedCampusId) return;
        const systemClasses = admissionSystem === "cambridge" ? cambridgeClasses : admissionSystem === "secondary" ? secondaryClasses : admissionSystem === "alevel" ? aLevelClasses : [];
        if (admissionLevel && !systemClasses.includes(admissionLevel)) setAdmissionLevel("");
        if (admissionSystem === "cambridge" && !hasCambridge) setAdmissionSystem("");
        if (admissionSystem === "secondary" && !hasSecondary) setAdmissionSystem("");
        if (admissionSystem === "alevel" && !hasALevel) setAdmissionSystem("");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCampusId]);

    // ── Photo
    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPhotoFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    // ── Guardians
    const updateGuardian = (index: number, patch: Partial<GuardianInput>) =>
        setGuardians((prev) => prev.map((g, i) => (i === index ? { ...g, ...patch } : g)));
    const addGuardianRow = () => setGuardians((prev) => [...prev, { ...INITIAL_GUARDIAN }]);
    const removeGuardianRow = (i: number) => setGuardians((prev) => prev.filter((_, idx) => idx !== i));
    const handleGuardianPhotoChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => updateGuardian(index, { photoPreview: ev.target?.result as string });
        reader.readAsDataURL(file);
        updateGuardian(index, { photoFile: file });
    };

    // ── Validation
    const validate = (): boolean => {
        const errs: FormErrors = {};
        if (!fullName.trim()) errs.full_name = "Full name is required";
        else if (!/^[a-zA-Z\s]+$/.test(fullName.trim())) errs.full_name = "Only alphabets allowed";
        if (!dob) errs.date_of_birth = "Date of birth is required";
        if (!depositAmount || isNaN(Number(depositAmount)) || Number(depositAmount) < 0)
            errs.deposit_amount = "Enter a valid positive deposit amount";
        if (!admissionSystem || !admissionLevel) errs.admission_level = "Select the class the candidate is applying for";

        if (addGuardian) {
            const gErrs = guardians.map((g) => {
                const ge: { name?: string; cnic?: string } = {};
                if (!g.name.trim()) ge.name = "Name is required";
                if (g.cnic.trim() && !isCnicValid(g.cnic)) ge.cnic = "Format: 12345-1234567-1";
                return ge;
            });
            if (gErrs.some((ge) => ge.name || ge.cnic)) errs.guardians = gErrs;
        }

        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    // ── Submit
    const handleSubmit = async () => {
        if (!validate()) return;
        setIsSubmitting(true);
        setSubmitStep("creating");
        setErrors({});
        try {
            const filteredGuardians = guardians.filter((g) => g.name.trim());
            const academicSystemLabel = admissionSystem === "cambridge" ? "Cambridge" : admissionSystem === "alevel" ? "A-Level" : "Secondary";
            const payload: Record<string, unknown> = {
                full_name: fullName.trim().toUpperCase(),
                date_of_birth: new Date(dob).toISOString(),
                gender,
                deposit_amount: Number(depositAmount),
                academic_system: academicSystemLabel,
                requested_grade: admissionLevel,
                ...(address.trim() && { address: address.trim() }),
                ...(selectedCampusId !== "" && { campus_id: Number(selectedCampusId) }),
                ...(adminNotes.trim() && { admin_notes: adminNotes.trim() }),
                ...(addGuardian && filteredGuardians.length > 0 && {
                    guardians: filteredGuardians.map((g) => ({
                        name: g.name.trim(),
                        relation: g.relation,
                        ...(g.cnic.trim() && { cnic: g.cnic.trim() }),
                    })),
                }),
            };

            const { data } = await api.post("/v1/unconfirmed-admissions", payload);
            const cc: number = data?.data?.id;
            setGeneratedCc(cc);

            if (photoFile && cc) {
                setSubmitStep("uploading");
                const fd = new FormData();
                fd.append("file", photoFile);
                await api.post(`/v1/unconfirmed-admissions/${cc}/photo`, fd, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
            }

            if (addGuardian && cc) {
                const guardiansWithPhotos = filteredGuardians
                    .map((g, i) => ({ g, i }))
                    .filter(({ g }) => g.photoFile);
                if (guardiansWithPhotos.length > 0) {
                    setSubmitStep("uploading");
                    for (const { g, i } of guardiansWithPhotos) {
                        const fd = new FormData();
                        fd.append("file", g.photoFile as File);
                        await api.post(`/v1/unconfirmed-admissions/${cc}/guardian-photo/${i}`, fd, {
                            headers: { "Content-Type": "multipart/form-data" },
                        });
                    }
                }
            }

            setSubmitStep("done");
            if (cc) {
                window.open(`/api/v1/unconfirmed-admissions/${cc}/deposit-slip`, "_blank");
            }
        } catch (err: any) {
            const msg = err?.response?.data?.message || "Submission failed. Please try again.";
            setErrors({ submit: msg });
            setSubmitStep("");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReset = () => {
        setFullName(""); setDob(""); setGender("Male"); setAddress("");
        setSelectedCampusId(""); setAddGuardian(false);
        setAdmissionSystem(""); setAdmissionLevel(""); setAdminNotes("");
        setGuardians([{ ...INITIAL_GUARDIAN }]); guardianFileInputRefs.current = {}; setDepositAmount("");
        setPhotoFile(null); setPhotoPreview(null); setErrors({});
        setSubmitStep(""); setGeneratedCc(null);
    };

    const isDone = submitStep === "done";

    return (
        <div className="space-y-6">
            {/* ── Page Header ── */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <Link
                        href="/identity/students"
                        className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all"
                    >
                        <ArrowLeft className="h-4.5 w-4.5" />
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                            <ClipboardPlus className="h-4.5 w-4.5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-[22px] font-black tracking-tight text-zinc-900">Quick Registration</h1>
                            <p className="text-[13px] text-zinc-500 mt-0.5">Create an unconfirmed admission record &amp; generate a deposit slip.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Two-column Layout ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

                {/* ── Left: Form ── */}
                <div className="lg:col-span-2 space-y-5">

                    {/* Section 1: Candidate Info */}
                    <SectionCard icon={<User className="h-3.5 w-3.5" />} title="Candidate Information">
                        <div className="space-y-4">
                            <FormField label="Candidate Photo (Optional)">
                                <div className="flex items-start gap-5">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-24 h-24 rounded-2xl border-2 border-dashed border-zinc-200 hover:border-primary/50 bg-zinc-50 hover:bg-primary/5 transition-all flex items-center justify-center overflow-hidden shrink-0"
                                    >
                                        {photoPreview ? (
                                            <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <Camera className="h-7 w-7 text-zinc-300" />
                                        )}
                                    </button>
                                    <div className="pt-1">
                                        <p className="text-[13px] font-bold text-zinc-700">
                                            {photoPreview ? "Photo selected" : "Upload candidate photograph"}
                                        </p>
                                        <p className="text-[12px] text-zinc-400 mt-1">
                                            {photoPreview ? photoFile?.name : "Click the box to select a JPG, PNG or WEBP"}
                                        </p>
                                        {photoPreview && (
                                            <button
                                                type="button"
                                                onClick={() => { setPhotoFile(null); setPhotoPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                                                className="mt-2 text-[11px] font-bold text-red-400 hover:text-red-600 transition-colors"
                                            >
                                                Remove photo
                                            </button>
                                        )}
                                    </div>
                                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                                </div>
                            </FormField>

                            <FormField label="Full Name (Block Letters)" required error={errors.full_name}>
                                <input
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value.toUpperCase())}
                                    placeholder="ENTER CANDIDATE FULL NAME"
                                    className={inputCls + " uppercase font-semibold tracking-wide"}
                                />
                            </FormField>

                            <div className="grid grid-cols-2 gap-4">
                                <FormField label="Date of Birth" required error={errors.date_of_birth}>
                                    <input
                                        type="date"
                                        value={dob}
                                        max={new Date().toISOString().split("T")[0]}
                                        onChange={(e) => setDob(e.target.value)}
                                        className={inputCls}
                                    />
                                </FormField>
                                <FormField label="Age at Registration">
                                    <div className={`${inputCls} flex items-center bg-zinc-50 cursor-default select-none`}>
                                        <span className={`font-black text-[17px] ${age !== null ? "text-primary" : "text-zinc-300"}`}>
                                            {age !== null ? `${age} Yrs` : "—"}
                                        </span>
                                    </div>
                                </FormField>
                            </div>

                            <FormField label="Gender" required>
                                <div className="grid grid-cols-2 gap-2">
                                    {(["Male", "Female"] as const).map((g) => (
                                        <button
                                            key={g}
                                            type="button"
                                            onClick={() => setGender(g)}
                                            className={`h-10 rounded-xl text-[13px] font-bold border-2 transition-all ${
                                                gender === g
                                                    ? "bg-primary text-white border-primary shadow-sm"
                                                    : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300"
                                            }`}
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            </FormField>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField label="Campus">
                                    <select
                                        value={selectedCampusId}
                                        onChange={(e) => setSelectedCampusId(e.target.value === "" ? "" : Number(e.target.value))}
                                        className={inputCls}
                                    >
                                        <option value="">Select campus (optional)</option>
                                        {campuses.map((c) => (
                                            <option key={c.id} value={c.id}>{c.campus_name}</option>
                                        ))}
                                    </select>
                                </FormField>
                                <FormField label="Residential Address">
                                    <input
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value.toUpperCase())}
                                        placeholder="OPTIONAL"
                                        className={inputCls + " uppercase"}
                                    />
                                </FormField>
                            </div>
                        </div>
                    </SectionCard>

                    {/* Section 2: Class Applying For */}
                    <SectionCard icon={<GraduationCap className="h-3.5 w-3.5" />} title="Class Applying For">
                        <div className="space-y-4">
                            <FormField label="Academic System" required error={errors.admission_level}>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {([
                                        { key: "cambridge" as const, label: "Cambridge O'Level", icon: <GraduationCap className="h-3.5 w-3.5" />, enabled: hasCambridge },
                                        { key: "secondary" as const, label: "Secondary", icon: <BookOpen className="h-3.5 w-3.5" />, enabled: hasSecondary },
                                        { key: "alevel" as const, label: "A'Level", icon: <ShieldCheck className="h-3.5 w-3.5" />, enabled: hasALevel },
                                    ]).map((sys) => (
                                        <button
                                            key={sys.key}
                                            type="button"
                                            disabled={!sys.enabled}
                                            onClick={() => { setAdmissionSystem(sys.key); setAdmissionLevel(""); }}
                                            className={`h-10 rounded-xl text-[12px] font-bold border-2 transition-all flex items-center justify-center gap-1.5 ${
                                                admissionSystem === sys.key
                                                    ? "bg-primary text-white border-primary shadow-sm"
                                                    : sys.enabled
                                                        ? "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300"
                                                        : "bg-zinc-50 text-zinc-300 border-zinc-100 cursor-not-allowed"
                                            }`}
                                        >
                                            {sys.icon}
                                            {sys.label}
                                        </button>
                                    ))}
                                </div>
                            </FormField>

                            {admissionSystem && (
                                <FormField label="Grade / Level" required>
                                    <div className="flex flex-wrap gap-2">
                                        {(admissionSystem === "cambridge" ? cambridgeClasses : admissionSystem === "secondary" ? secondaryClasses : aLevelClasses).map((cls) => (
                                            <button
                                                key={cls}
                                                type="button"
                                                onClick={() => setAdmissionLevel(cls)}
                                                className={`px-3.5 h-8 rounded-lg text-[12px] font-bold border-2 transition-all ${
                                                    admissionLevel === cls
                                                        ? "bg-primary text-white border-primary shadow-sm"
                                                        : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300"
                                                }`}
                                            >
                                                {cls}
                                            </button>
                                        ))}
                                    </div>
                                </FormField>
                            )}

                            {!selectedCampusId && (
                                <p className="text-[11px] text-zinc-400 font-medium">Select a campus above to narrow the grade list to classes it offers.</p>
                            )}
                        </div>
                    </SectionCard>

                    {/* Section 3: Guardian Info */}
                    <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setAddGuardian((v) => !v)}
                            className="w-full flex items-center justify-between px-6 py-4 border-b border-zinc-50 bg-zinc-50/60 hover:bg-zinc-100/70 transition-colors"
                        >
                            <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-white border border-zinc-100 shadow-sm flex items-center justify-center">
                                    <Users className="h-3.5 w-3.5 text-zinc-500" />
                                </div>
                                <h2 className="text-[12px] font-black text-zinc-700 uppercase tracking-[0.15em]">Guardian Information</h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${addGuardian ? "bg-primary/10 text-primary" : "bg-zinc-100 text-zinc-400"}`}>
                                    {addGuardian ? "Enabled" : "Optional — click to add"}
                                </span>
                                {addGuardian ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
                            </div>
                        </button>

                        {addGuardian && (
                            <div className="px-6 py-5 space-y-4">
                                {guardians.map((g, i) => (
                                    <div key={i} className="bg-zinc-50 border border-zinc-100 rounded-xl p-5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-black text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                                                <ShieldCheck className="h-3.5 w-3.5" />
                                                Guardian #{i + 1}
                                            </span>
                                            {guardians.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeGuardianRow(i)}
                                                    className="flex items-center gap-1 text-[11px] font-bold text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-all"
                                                >
                                                    <Trash2 className="h-3 w-3" /> Remove
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex items-start gap-4">
                                            <button
                                                type="button"
                                                onClick={() => guardianFileInputRefs.current[i]?.click()}
                                                className="w-16 h-16 rounded-xl border-2 border-dashed border-zinc-200 hover:border-primary/50 bg-white hover:bg-primary/5 transition-all flex items-center justify-center overflow-hidden shrink-0"
                                                title="Attach guardian photo"
                                            >
                                                {g.photoPreview ? (
                                                    <img src={g.photoPreview} alt="Guardian preview" className="w-full h-full object-cover" />
                                                ) : (
                                                    <Camera className="h-5 w-5 text-zinc-300" />
                                                )}
                                            </button>
                                            <input
                                                ref={(el) => { guardianFileInputRefs.current[i] = el; }}
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => handleGuardianPhotoChange(i, e)}
                                                className="hidden"
                                            />
                                            <div className="flex-1 space-y-4">
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                    <div className="sm:col-span-2">
                                                        <FormField label="Full Name" required error={errors.guardians?.[i]?.name}>
                                                            <input
                                                                value={g.name}
                                                                onChange={(e) => updateGuardian(i, { name: e.target.value.toUpperCase() })}
                                                                placeholder="GUARDIAN FULL NAME"
                                                                className={inputCls + " uppercase"}
                                                            />
                                                        </FormField>
                                                    </div>
                                                    <FormField label="Relation">
                                                        <select
                                                            value={g.relation}
                                                            onChange={(e) => updateGuardian(i, { relation: e.target.value as GuardianInput["relation"] })}
                                                            className={inputCls}
                                                        >
                                                            <option value="Father">Father</option>
                                                            <option value="Mother">Mother</option>
                                                            <option value="Guardian">Other / Guardian</option>
                                                        </select>
                                                    </FormField>
                                                </div>

                                                <FormField label="CNIC (optional)" error={errors.guardians?.[i]?.cnic}>
                                                    <input
                                                        value={g.cnic}
                                                        onChange={(e) => updateGuardian(i, { cnic: formatCnic(e.target.value) })}
                                                        placeholder="42101-1234567-1"
                                                        maxLength={15}
                                                        className={`${inputCls} font-mono`}
                                                    />
                                                </FormField>
                                            </div>
                                        </div>
                                        {g.photoPreview && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    updateGuardian(i, { photoFile: null, photoPreview: null });
                                                    const el = guardianFileInputRefs.current[i];
                                                    if (el) el.value = "";
                                                }}
                                                className="text-[11px] font-bold text-red-400 hover:text-red-600 transition-colors"
                                            >
                                                Remove photo
                                            </button>
                                        )}
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    onClick={addGuardianRow}
                                    className="flex items-center gap-1.5 text-[12px] font-bold text-primary hover:text-primary/80 transition-colors py-1"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Add Another Guardian
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Section 4: Admission Details */}
                    <SectionCard icon={<Banknote className="h-3.5 w-3.5" />} title="Admission Details">
                        <div className="space-y-5">
                            <FormField label="Deposit Amount (PKR)" required error={errors.deposit_amount}>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[12px] font-black text-zinc-400">PKR</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={depositAmount}
                                        onChange={(e) => setDepositAmount(e.target.value)}
                                        placeholder="0"
                                        className={inputCls + " pl-11"}
                                    />
                                </div>
                            </FormField>
                        </div>
                    </SectionCard>

                    {/* Section 5: Internal Notes */}
                    <SectionCard icon={<StickyNote className="h-3.5 w-3.5" />} title="Internal Notes">
                        <FormField label="Note for the back office (not shown to the family)">
                            <textarea
                                value={adminNotes}
                                onChange={(e) => setAdminNotes(e.target.value.toUpperCase())}
                                placeholder="OPTIONAL — E.G. SIBLING DISCOUNT PROMISED, PAID IN CASH, SPECIAL CIRCUMSTANCE, ETC."
                                rows={3}
                                className={inputCls + " h-auto py-2.5 resize-none uppercase"}
                            />
                        </FormField>
                    </SectionCard>

                    {/* Submit error */}
                    {errors.submit && (
                        <div className="flex items-center gap-2.5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                            <p className="text-[13px] font-bold text-red-600">{errors.submit}</p>
                        </div>
                    )}
                </div>

                {/* ── Right: Summary + Actions ── */}
                <div className="space-y-4 lg:sticky lg:top-6">
                    {/* Summary Card */}
                    <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-zinc-50 bg-zinc-50/60">
                            <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.18em]">Record Preview</h3>
                        </div>
                        <div className="px-5 py-5 space-y-4">
                            {/* Photo preview */}
                            <div className="flex items-center gap-3">
                                <div className="w-14 h-14 rounded-xl bg-zinc-100 border border-zinc-200 overflow-hidden flex items-center justify-center shrink-0">
                                    {photoPreview ? (
                                        <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <UserCircle className="h-7 w-7 text-zinc-300" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[14px] font-black text-zinc-900 truncate">
                                        {fullName || <span className="text-zinc-300">Full name</span>}
                                    </p>
                                    <p className="text-[12px] text-zinc-400 font-medium mt-0.5">
                                        {age !== null ? `${age} yrs · ` : ""}{gender}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2.5">
                                <SummaryRow icon={<Calendar className="h-3.5 w-3.5" />} label="DOB">
                                    {dob ? new Date(dob).toLocaleDateString("en-GB") : "—"}
                                </SummaryRow>
                                <SummaryRow icon={<Building2 className="h-3.5 w-3.5" />} label="Campus">
                                    {selectedCampus?.campus_name ?? "—"}
                                </SummaryRow>
                                <SummaryRow icon={<GraduationCap className="h-3.5 w-3.5" />} label="Class Applying For">
                                    {admissionLevel || "—"}
                                </SummaryRow>
                                <SummaryRow icon={<MapPin className="h-3.5 w-3.5" />} label="Address">
                                    <span className="truncate">{address || "—"}</span>
                                </SummaryRow>
                                <SummaryRow icon={<Banknote className="h-3.5 w-3.5" />} label="Deposit">
                                    {depositAmount ? `PKR ${Number(depositAmount).toLocaleString()}` : "—"}
                                </SummaryRow>
                                {addGuardian && guardians.filter((g) => g.name.trim()).length > 0 && (
                                    <SummaryRow icon={<Users className="h-3.5 w-3.5" />} label="Guardians">
                                        {guardians.filter((g) => g.name.trim()).map((g) => g.relation).join(", ")}
                                    </SummaryRow>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    {isDone ? (
                        <div className="space-y-3">
                            <div className="flex items-center justify-center gap-2 px-4 py-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                <div>
                                    <p className="text-[13px] font-black text-emerald-700">Record saved!</p>
                                    {generatedCc && (
                                        <p className="text-[11px] text-emerald-600 font-bold">
                                            CC #{generatedCc} · Deposit slip opened
                                        </p>
                                    )}
                                </div>
                            </div>
                            {generatedCc && (
                                <button
                                    type="button"
                                    onClick={() => window.open(`/api/v1/unconfirmed-admissions/${generatedCc}/deposit-slip`, "_blank")}
                                    className="w-full h-10 flex items-center justify-center gap-2 text-[12px] font-bold text-primary border border-primary/20 bg-primary/5 rounded-xl hover:bg-primary/10 transition-all"
                                >
                                    <FileText className="h-3.5 w-3.5" />
                                    Re-open Deposit Slip
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleReset}
                                className="w-full h-10 flex items-center justify-center gap-2 text-[12px] font-bold text-zinc-600 border border-zinc-200 bg-white rounded-xl hover:bg-zinc-50 transition-all"
                            >
                                <ClipboardPlus className="h-3.5 w-3.5" />
                                Register Another Student
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="w-full h-12 flex items-center justify-center gap-2 text-[14px] font-black text-white bg-primary rounded-2xl hover:bg-primary/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] shadow-sm shadow-primary/20"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {submitStep === "uploading" ? "Uploading photo…" : "Saving record…"}
                                </>
                            ) : (
                                <>
                                    <FileText className="h-4 w-4" />
                                    Submit &amp; Generate Deposit Slip
                                </>
                            )}
                        </button>
                    )}

                    <Link
                        href="/identity/students"
                        className="block w-full h-10 flex items-center justify-center gap-2 text-[12px] font-bold text-zinc-500 hover:text-zinc-700 transition-colors"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to Student Directory
                    </Link>
                </div>
            </div>
        </div>
    );
}

// ── Summary Row helper ─────────────────────────────────────────────────────────

function SummaryRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-2.5">
            <div className="text-zinc-300 mt-0.5 shrink-0">{icon}</div>
            <div className="min-w-0 flex-1">
                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">{label}</span>
                <span className="text-[12px] font-bold text-zinc-700 block truncate">{children}</span>
            </div>
        </div>
    );
}
