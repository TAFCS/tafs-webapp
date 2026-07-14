"use client";

import React, { useState, useEffect, useRef } from "react";
import {
    X,
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
} from "lucide-react";
import api from "@/lib/api";
import { campusesService, type Campus } from "@/lib/campuses.service";

// ── Types ──────────────────────────────────────────────────────────────────────

interface GuardianInput {
    name: string;
    relation: "Father" | "Mother" | "Guardian";
    cnic: string;
}

interface FormErrors {
    full_name?: string;
    date_of_birth?: string;
    deposit_amount?: string;
    guardians?: { name?: string; cnic?: string }[];
}

// ── CNIC formatter ─────────────────────────────────────────────────────────────

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

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeader({ title, children }: { title: string; children?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between mb-5">
            <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.18em]">{title}</h3>
            {children}
        </div>
    );
}

function FormField({
    label,
    required,
    error,
    children,
}: {
    label: string;
    required?: boolean;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">
                {label}
                {required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
            {error && (
                <p className="mt-1 text-[11px] font-bold text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {error}
                </p>
            )}
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface QuickRegistrationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const INITIAL_GUARDIAN: GuardianInput = { name: "", relation: "Father", cnic: "" };

export function QuickRegistrationModal({ isOpen, onClose }: QuickRegistrationModalProps) {
    // ── Candidate Info
    const [fullName, setFullName] = useState("");
    const [dob, setDob] = useState("");
    const [gender, setGender] = useState<"Male" | "Female">("Male");
    const [address, setAddress] = useState("");
    const [selectedCampusId, setSelectedCampusId] = useState<number | "">("");

    // ── Guardian Info
    const [addGuardian, setAddGuardian] = useState(false);
    const [guardians, setGuardians] = useState<GuardianInput[]>([{ ...INITIAL_GUARDIAN }]);

    // ── Admission Details
    const [depositAmount, setDepositAmount] = useState("");
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Meta
    const [campuses, setCampuses] = useState<Campus[]>([]);
    const [errors, setErrors] = useState<FormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStep, setSubmitStep] = useState<"" | "creating" | "uploading" | "done">("");

    // Lock scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
            return () => { document.body.style.overflow = ""; };
        }
    }, [isOpen]);

    // Load campuses once on mount
    useEffect(() => {
        campusesService.list().then(setCampuses).catch(() => {});
    }, []);

    // Auto-calculate age display
    const age = (() => {
        if (!dob) return null;
        const d = new Date(dob);
        if (isNaN(d.getTime())) return null;
        const today = new Date();
        let a = today.getFullYear() - d.getFullYear();
        if (today.getMonth() < d.getMonth() || (today.getMonth() === d.getMonth() && today.getDate() < d.getDate())) a--;
        return a;
    })();

    // ── Photo
    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPhotoFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    // ── Guardian helpers
    const updateGuardian = (index: number, patch: Partial<GuardianInput>) => {
        setGuardians((prev) => prev.map((g, i) => (i === index ? { ...g, ...patch } : g)));
    };
    const addGuardianRow = () => setGuardians((prev) => [...prev, { ...INITIAL_GUARDIAN }]);
    const removeGuardianRow = (i: number) => setGuardians((prev) => prev.filter((_, idx) => idx !== i));

    // ── Validation
    const validate = (): boolean => {
        const errs: FormErrors = {};
        if (!fullName.trim()) errs.full_name = "Full name is required";
        else if (!/^[a-zA-Z\s]+$/.test(fullName.trim())) errs.full_name = "Only alphabets allowed";
        if (!dob) errs.date_of_birth = "Date of birth is required";
        if (!depositAmount || isNaN(Number(depositAmount)) || Number(depositAmount) < 0)
            errs.deposit_amount = "Enter a valid positive deposit amount";

        if (addGuardian) {
            errs.guardians = guardians.map((g) => {
                const ge: { name?: string; cnic?: string } = {};
                if (!g.name.trim()) ge.name = "Guardian name is required";
                if (g.cnic.trim() && !isCnicValid(g.cnic)) ge.cnic = "Format: 12345-1234567-1";
                return ge;
            });
            if (errs.guardians.every((ge) => !ge.name && !ge.cnic)) delete errs.guardians;
        }

        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    // ── Submit
    const handleSubmit = async () => {
        if (!validate()) return;
        setIsSubmitting(true);
        setSubmitStep("creating");
        try {
            const payload: Record<string, unknown> = {
                full_name: fullName.trim().toUpperCase(),
                date_of_birth: new Date(dob).toISOString(),
                gender,
                deposit_amount: Number(depositAmount),
                ...(address.trim() && { address: address.trim() }),
                ...(selectedCampusId !== "" && { campus_id: Number(selectedCampusId) }),
                ...(addGuardian && guardians.filter((g) => g.name.trim()).length > 0 && {
                    guardians: guardians
                        .filter((g) => g.name.trim())
                        .map((g) => ({
                            name: g.name.trim(),
                            relation: g.relation,
                            ...(g.cnic.trim() && { cnic: g.cnic.trim() }),
                        })),
                }),
            };

            const { data } = await api.post("/v1/unconfirmed-admissions", payload);
            const cc: number = data?.data?.id;

            if (photoFile && cc) {
                setSubmitStep("uploading");
                const fd = new FormData();
                fd.append("file", photoFile);
                await api.post(`/v1/unconfirmed-admissions/${cc}/photo`, fd, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
            }

            setSubmitStep("done");

            // Open deposit slip in new tab
            if (cc) {
                window.open(`/api/v1/unconfirmed-admissions/${cc}/deposit-slip`, "_blank");
            }

            // Reset after brief pause
            setTimeout(() => {
                resetForm();
                onClose();
            }, 1500);
        } catch (err: any) {
            const msg = err?.response?.data?.message || "Submission failed. Please try again.";
            setErrors({ full_name: msg });
            setSubmitStep("");
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFullName(""); setDob(""); setGender("Male"); setAddress("");
        setSelectedCampusId(""); setAddGuardian(false);
        setGuardians([{ ...INITIAL_GUARDIAN }]); setDepositAmount("");
        setPhotoFile(null); setPhotoPreview(null); setErrors({});
        setSubmitStep("");
    };

    if (!isOpen) return null;

    const inputCls = "w-full h-10 px-3 text-[13px] font-medium text-zinc-800 bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-zinc-400";
    const isDone = submitStep === "done";

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity"
                onClick={() => { if (!isSubmitting) onClose(); }}
            />

            {/* Slide-over Panel */}
            <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[520px] bg-white shadow-2xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                            <ClipboardPlus className="h-4.5 w-4.5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-[15px] font-black text-zinc-900 tracking-tight">Quick Registration</h2>
                            <p className="text-[11px] text-zinc-400 font-medium">Unconfirmed admission record</p>
                        </div>
                    </div>
                    <button
                        onClick={() => { if (!isSubmitting) { resetForm(); onClose(); } }}
                        className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">

                    {/* ── Section 1: Candidate Info ── */}
                    <div>
                        <SectionHeader title="Candidate Information" />
                        <div className="space-y-4">
                            <FormField label="Full Name (Block Letters)" required error={errors.full_name}>
                                <input
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value.toUpperCase())}
                                    placeholder="ENTER FULL NAME"
                                    className={inputCls + " uppercase"}
                                />
                            </FormField>

                            <div className="grid grid-cols-2 gap-3">
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
                                    <div className={`${inputCls} flex items-center bg-zinc-50 cursor-default`}>
                                        <span className={`font-black text-[15px] ${age !== null ? "text-zinc-800" : "text-zinc-300"}`}>
                                            {age !== null ? `${age} Yrs` : "—"}
                                        </span>
                                    </div>
                                </FormField>
                            </div>

                            <FormField label="Gender" required>
                                <div className="flex gap-2">
                                    {(["Male", "Female"] as const).map((g) => (
                                        <button
                                            key={g}
                                            type="button"
                                            onClick={() => setGender(g)}
                                            className={`flex-1 h-10 rounded-xl text-[13px] font-bold border transition-all ${
                                                gender === g
                                                    ? "bg-primary text-white border-primary shadow-sm"
                                                    : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
                                            }`}
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            </FormField>

                            <FormField label="Residential Address">
                                <input
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    placeholder="Enter residential address (optional)"
                                    className={inputCls}
                                />
                            </FormField>

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
                        </div>
                    </div>

                    {/* ── Section 2: Guardian Information ── */}
                    <div className="border border-zinc-100 rounded-2xl overflow-hidden">
                        {/* Toggle Header */}
                        <button
                            type="button"
                            onClick={() => setAddGuardian((v) => !v)}
                            className="w-full flex items-center justify-between px-5 py-4 bg-zinc-50 hover:bg-zinc-100 transition-colors"
                        >
                            <div className="flex items-center gap-2.5">
                                <Users className="h-4 w-4 text-zinc-500" />
                                <span className="text-[12px] font-black text-zinc-700 uppercase tracking-wider">Guardian Information</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-zinc-400">{addGuardian ? "Enabled" : "Optional"}</span>
                                {addGuardian ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
                            </div>
                        </button>

                        {addGuardian && (
                            <div className="px-5 py-4 space-y-4">
                                {guardians.map((g, i) => (
                                    <div key={i} className="bg-zinc-50 border border-zinc-100 rounded-xl p-4 space-y-3">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[11px] font-black text-zinc-500 uppercase tracking-wider">Guardian #{i + 1}</span>
                                            {guardians.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeGuardianRow(i)}
                                                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>

                                        <FormField label="Guardian Name" required error={errors.guardians?.[i]?.name}>
                                            <input
                                                value={g.name}
                                                onChange={(e) => updateGuardian(i, { name: e.target.value.toUpperCase() })}
                                                placeholder="GUARDIAN FULL NAME"
                                                className={inputCls + " uppercase"}
                                            />
                                        </FormField>

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

                    {/* ── Section 3: Admission Details & Photo ── */}
                    <div>
                        <SectionHeader title="Admission Details & Photo" />
                        <div className="space-y-4">
                            <FormField label="Deposit Amount (PKR)" required error={errors.deposit_amount}>
                                <input
                                    type="number"
                                    min="0"
                                    value={depositAmount}
                                    onChange={(e) => setDepositAmount(e.target.value)}
                                    placeholder="Enter deposit amount"
                                    className={inputCls}
                                />
                            </FormField>

                            {/* Photo Upload */}
                            <FormField label="Candidate Photo (Optional)">
                                <div className="flex items-center gap-4">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-20 h-20 rounded-xl border-2 border-dashed border-zinc-200 hover:border-primary/50 bg-zinc-50 hover:bg-primary/5 transition-all flex items-center justify-center overflow-hidden shrink-0"
                                    >
                                        {photoPreview ? (
                                            <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <Camera className="h-6 w-6 text-zinc-300" />
                                        )}
                                    </button>
                                    <div>
                                        <p className="text-[12px] font-bold text-zinc-600">
                                            {photoPreview ? "Photo selected" : "Tap to upload photo"}
                                        </p>
                                        <p className="text-[11px] text-zinc-400 mt-0.5">
                                            {photoPreview ? photoFile?.name : "JPG, PNG or WEBP"}
                                        </p>
                                        {photoPreview && (
                                            <button
                                                type="button"
                                                onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                                                className="mt-1.5 text-[11px] font-bold text-red-400 hover:text-red-600 transition-colors"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handlePhotoChange}
                                        className="hidden"
                                    />
                                </div>
                            </FormField>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-zinc-100 bg-white shrink-0">
                    {isDone ? (
                        <div className="flex items-center justify-center gap-2 h-11 bg-emerald-50 border border-emerald-200 rounded-xl">
                            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
                            <span className="text-[13px] font-black text-emerald-700">Saved! Opening deposit slip…</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => { if (!isSubmitting) { resetForm(); onClose(); } }}
                                className="h-11 px-5 text-[13px] font-bold text-zinc-600 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="flex-1 h-11 flex items-center justify-center gap-2 text-[13px] font-black text-white bg-primary rounded-xl hover:bg-primary/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]"
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
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
