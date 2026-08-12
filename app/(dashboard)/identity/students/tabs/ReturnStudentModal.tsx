"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X, Loader2, RotateCcw, UserPlus, Hash, Sparkles, ChevronRight,
    ArrowLeft, CalendarClock, CheckCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import {
    extractApiErrorMessage,
    formatSectionOptionLabel,
    isSectionSelectableForGender,
} from "@/lib/section-allocation";

export type ReturnMode = "REINSTATED" | "READMITTED";

interface SectionOption {
    id: number;
    description: string;
    student_capacity?: number | null;
    gender_mode?: string;
    enrolled_count?: number;
    remaining_seats?: number | null;
    is_full?: boolean;
}

interface Suggestions {
    suggested_gr: string;
    suggested_house: number | null;
    suggested_section: number | null;
    min_gr: string | null;
    all_houses: Array<{ id: number; house_name: string; house_color: string }>;
    available_sections: SectionOption[];
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    /** Resolves once the student has been returned; parent reloads. */
    onDone: () => void | Promise<void>;
    cc: number;
    student: any;
    classes?: Array<{ id: number; description: string; class_code?: string }>;
    getGRPrefix: (campusName: string | undefined, academicSystem?: string) => string;
}

const MODE_COPY: Record<ReturnMode, {
    label: string;
    icon: typeof RotateCcw;
    blurb: string;
    accent: string;
    ring: string;
}> = {
    REINSTATED: {
        label: "Reinstate",
        icon: RotateCcw,
        blurb: "Reverse the departure. The student resumes their existing class, section, house and GR. The time away is recorded as a gap in one continuous enrollment.",
        accent: "text-emerald-600",
        ring: "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20",
    },
    READMITTED: {
        label: "Readmit",
        icon: UserPlus,
        blurb: "Treat this as a fresh admission. You will re-assign class, section, house and GR, and a new admission record is created.",
        accent: "text-indigo-600",
        ring: "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20",
    },
};

/** Same window used by the bulk-promotion academic year picker: 2 years back, 3 ahead. */
function generateAcademicYears(): string[] {
    const y = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => `${y - 2 + i}-${y - 1 + i}`);
}

/** "1 year 2 months", "18 days", "less than a day" — mirrors the backend note. */
function formatAway(fromIso: string | null | undefined): string | null {
    if (!fromIso) return null;
    const ms = Date.now() - new Date(fromIso).getTime();
    if (ms < 0) return null;
    if (ms < 86_400_000) return "less than a day";
    const days = Math.floor(ms / 86_400_000);
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    const parts: string[] = [];
    if (years) parts.push(`${years} year${years === 1 ? "" : "s"}`);
    if (months) parts.push(`${months} month${months === 1 ? "" : "s"}`);
    if (!years && !months) parts.push(`${days} day${days === 1 ? "" : "s"}`);
    return parts.join(" ");
}

export function ReturnStudentModal({
    isOpen, onClose, onDone, cc, student, classes = [], getGRPrefix,
}: Props) {
    const [step, setStep] = useState<"choice" | "placement">("choice");
    const [mode, setMode] = useState<ReturnMode | null>(null);
    const [reason, setReason] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [gr, setGr] = useState("");
    const [classId, setClassId] = useState<number | "">("");
    const [sectionId, setSectionId] = useState<number | "">("");
    const [houseId, setHouseId] = useState<number | "">("");
    const [academicYear, setAcademicYear] = useState("");

    // Include the student's prior year even if it falls outside the generated
    // 2-back/3-ahead window, so an old value never disappears from the list.
    const academicYearOptions = useMemo(() => {
        const generated = generateAcademicYears();
        const priorYear = student?.academic_year;
        if (priorYear && !generated.includes(priorYear)) {
            return [priorYear, ...generated].sort();
        }
        return generated;
    }, [student?.academic_year]);

    const [awayFrom, setAwayFrom] = useState<string | null>(null);

    const departureStatus = String(student?.status || "").toUpperCase();
    // Graduation parks the class in graduated_from_class_id.
    const priorClassId: number | null =
        student?.class_id ?? student?.graduated_from_class_id ?? null;
    const awayText = formatAway(awayFrom);
    // The detail endpoint flattens these; keep the nested reads as a fallback.
    const campusName: string | undefined =
        student?.campus_name ?? student?.campuses?.campus_name ?? undefined;
    const academicSystem: string | undefined =
        student?.academic_system ??
        student?.admissions?.[0]?.academic_system ??
        student?.student_admissions?.[0]?.academic_system ??
        undefined;

    // The student's currently-open progression period was opened by the
    // departure, so its start is the moment they left.
    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        api
            .get(`/v1/students/${cc}/progression`)
            .then((res) => {
                if (cancelled) return;
                const rows: Array<{ valid_to: string | null; valid_from: string }> = res?.data?.data ?? [];
                setAwayFrom(rows.find((r) => r.valid_to == null)?.valid_from ?? null);
            })
            .catch(() => { if (!cancelled) setAwayFrom(null); });
        return () => { cancelled = true; };
    }, [isOpen, cc]);

    useEffect(() => {
        if (!isOpen) return;
        setStep("choice");
        setMode(null);
        setReason("");
        setSuggestions(null);
        setGr("");
        setClassId(priorClassId ?? "");
        setSectionId(student?.section_id ?? "");
        setHouseId(student?.house_id ?? "");
        setAcademicYear(student?.academic_year || "");
    }, [isOpen, cc]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadSuggestions = useCallback(async (opts?: { classId?: number | ""; sectionId?: number | "" }) => {
        setLoadingSuggestions(true);
        try {
            const { data } = await api.get(`/v1/enrollments/${cc}/suggestions`, {
                params: {
                    class_id: (opts?.classId ?? classId) || undefined,
                    section_id: (opts?.sectionId ?? sectionId) || undefined,
                },
            });
            const res: Suggestions = data.data || data;
            setSuggestions(res);
            return res;
        } catch {
            toast.error("Failed to fetch placement suggestions");
            return null;
        } finally {
            setLoadingSuggestions(false);
        }
    }, [cc, classId, sectionId]);

    const goToPlacement = async () => {
        setStep("placement");
        const res = await loadSuggestions();
        if (!res) return;
        // Seed only what the operator has not already chosen.
        setGr((prev) => prev || res.suggested_gr || student?.gr_number || "");
        setSectionId((prev) => (prev === "" ? res.suggested_section ?? "" : prev));
        setHouseId((prev) => (prev === "" ? res.suggested_house ?? "" : prev));
    };

    const handleClassChange = async (next: number | "") => {
        setClassId(next);
        // Sections and house balance are class-scoped, so both must be re-derived.
        setSectionId("");
        const res = await loadSuggestions({ classId: next, sectionId: "" });
        if (res) {
            setSectionId(res.suggested_section ?? "");
            setHouseId(res.suggested_house ?? "");
        }
    };

    const handleSectionChange = async (next: number | "") => {
        setSectionId(next);
        const res = await loadSuggestions({ sectionId: next });
        if (res?.suggested_house) setHouseId(res.suggested_house);
    };

    const handleGrChange = (raw: string) => {
        const val = raw.toUpperCase();
        const prefix = getGRPrefix(campusName, academicSystem);
        if (prefix && val !== "" && !val.startsWith(prefix)) return;
        setGr(val);
    };

    const submit = async (submitMode: ReturnMode) => {
        if (!reason.trim()) {
            toast.error("Please record a reason — it is shown in the progression history.");
            return;
        }
        if (submitMode === "READMITTED") {
            if (!gr.trim()) { toast.error("A GR number is required to readmit"); return; }
            if (!houseId) { toast.error("A house is required to readmit"); return; }
        }
        setSubmitting(true);
        try {
            await api.post(`/v1/students/${cc}/return`, {
                mode: submitMode,
                reason: reason.trim(),
                ...(submitMode === "READMITTED"
                    ? {
                        gr_number: gr.trim(),
                        class_id: classId || undefined,
                        section_id: sectionId || undefined,
                        house_id: Number(houseId),
                        academic_year: academicYear.trim() || undefined,
                    }
                    : {}),
            });
            toast.success(
                submitMode === "READMITTED" ? "Student readmitted" : "Student reinstated",
            );
            await onDone();
            onClose();
        } catch (error: any) {
            toast.error(extractApiErrorMessage(error, "Failed to return student. Please try again."));
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const isALevel = academicSystem?.toLowerCase().replace(/[^a-z]/g, "") === "alevel";

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-zinc-950/50 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    className="relative w-full max-w-2xl max-h-[88vh] overflow-y-auto bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800"
                >
                    {/* Header */}
                    <div className="sticky top-0 z-10 flex items-start justify-between gap-4 p-6 bg-white/90 dark:bg-zinc-950/90 backdrop-blur border-b border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center gap-4">
                            {step === "placement" && (
                                <button
                                    onClick={() => setStep("choice")}
                                    className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                                    title="Back"
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </button>
                            )}
                            <div>
                                <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight leading-tight">
                                    {step === "choice" ? "Return Student" : "Readmission Placement"}
                                </h3>
                                <p className="text-sm font-medium text-zinc-500">
                                    {student?.full_name} · currently <span className="font-bold">{departureStatus}</span>
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        {awayText && (
                            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-orange-50 dark:bg-orange-900/15 border border-orange-200 dark:border-orange-900/40">
                                <CalendarClock className="h-4 w-4 text-orange-500 shrink-0" />
                                <p className="text-[13px] font-semibold text-orange-800 dark:text-orange-300">
                                    Away for {awayText}. This period will be shown in Academic Progression.
                                </p>
                            </div>
                        )}

                        {step === "choice" && (
                            <>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {(Object.keys(MODE_COPY) as ReturnMode[]).map((key) => {
                                        const copy = MODE_COPY[key];
                                        const Icon = copy.icon;
                                        const selected = mode === key;
                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => setMode(key)}
                                                className={`text-left p-5 rounded-2xl border-2 transition-all ${
                                                    selected
                                                        ? copy.ring
                                                        : "border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <Icon className={`h-6 w-6 ${copy.accent}`} />
                                                    {selected && <CheckCircle className={`h-5 w-5 ${copy.accent}`} />}
                                                </div>
                                                <div className="text-base font-black text-zinc-900 dark:text-zinc-100 mb-1.5">
                                                    {copy.label}
                                                </div>
                                                <p className="text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                                                    {copy.blurb}
                                                </p>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 ml-1">
                                        Reason
                                    </label>
                                    <textarea
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        placeholder="Why is this student returning? Shown in the progression history."
                                        className="w-full h-28 p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800 focus:border-zinc-300 transition-all outline-none resize-none text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="flex-1 px-6 py-3.5 rounded-2xl font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all active:scale-95"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!mode || submitting}
                                        onClick={() => {
                                            if (mode === "READMITTED") { void goToPlacement(); return; }
                                            if (mode === "REINSTATED") { void submit("REINSTATED"); }
                                        }}
                                        className="flex-[2] px-6 py-3.5 rounded-2xl font-bold text-white bg-zinc-900 dark:bg-white dark:text-zinc-900 shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        {submitting ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : mode === "READMITTED" ? (
                                            <>Continue to placement <ChevronRight className="h-4 w-4" /></>
                                        ) : (
                                            <>Confirm Reinstatement</>
                                        )}
                                    </button>
                                </div>
                            </>
                        )}

                        {step === "placement" && (
                            <>
                                {loadingSuggestions && !suggestions ? (
                                    <div className="py-16 flex flex-col items-center justify-center">
                                        <Loader2 className="h-8 w-8 text-zinc-400 animate-spin mb-3" />
                                        <p className="text-zinc-500 font-bold text-sm">Computing suggestions…</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 p-4">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                                                Placement at departure
                                            </div>
                                            <p className="text-[13px] font-semibold text-zinc-600 dark:text-zinc-400">
                                                {student?.class_name || student?.graduated_from_class?.description || "—"}
                                                {student?.section_name ? ` · Section ${student.section_name}` : ""}
                                                {student?.gr_number ? ` · GR ${student.gr_number}` : ""}
                                                {student?.academic_year ? ` · ${student.academic_year}` : ""}
                                            </p>
                                        </div>

                                        {/* Class */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-wider text-zinc-500 ml-1">
                                                Class
                                            </label>
                                            <select
                                                value={classId}
                                                onChange={(e) => void handleClassChange(e.target.value === "" ? "" : Number(e.target.value))}
                                                className="w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-200 transition-all font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer"
                                            >
                                                <option value="">Unassigned</option>
                                                {classes.map((c) => (
                                                    <option key={c.id} value={c.id}>{c.description}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* GR */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between ml-1">
                                                <label className="text-xs font-black uppercase tracking-wider text-zinc-500">GR Number</label>
                                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">Recommended</span>
                                            </div>
                                            <div className="relative">
                                                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                                                <input
                                                    type="text"
                                                    value={gr}
                                                    onChange={(e) => handleGrChange(e.target.value)}
                                                    className="w-full pl-12 pr-4 py-3.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-200 transition-all font-black text-lg text-indigo-600 uppercase"
                                                />
                                            </div>
                                            {suggestions?.min_gr && (
                                                <p className="text-[10px] text-zinc-400 font-bold ml-1 italic">
                                                    Minimum GR for this campus is <span className="text-zinc-500">{suggestions.min_gr}</span>. Sequence integrity is enforced.
                                                </p>
                                            )}
                                            {student?.gr_number && gr && gr !== student.gr_number && (
                                                <p className="text-[10px] text-amber-600 font-bold ml-1 italic">
                                                    Changing from previous GR {student.gr_number}.
                                                </p>
                                            )}
                                        </div>

                                        {/* Section */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between ml-1">
                                                <label className="text-xs font-black uppercase tracking-wider text-zinc-500">Section</label>
                                                {isALevel && (
                                                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-100 dark:border-amber-900/30">Discipline Rule</span>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <select
                                                    value={sectionId}
                                                    onChange={(e) => void handleSectionChange(e.target.value === "" ? "" : Number(e.target.value))}
                                                    className="w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-200 transition-all font-bold text-zinc-700 dark:text-zinc-300 appearance-none cursor-pointer"
                                                >
                                                    <option value="">Unassigned</option>
                                                    {suggestions?.available_sections.map((section) => (
                                                        <option
                                                            key={section.id}
                                                            value={section.id}
                                                            disabled={!isSectionSelectableForGender(section, student?.gender)}
                                                        >
                                                            {formatSectionOptionLabel(section, {
                                                                recommendedId: suggestions?.suggested_section,
                                                                studentGender: student?.gender,
                                                            })}
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                                                    <ChevronRight className="h-5 w-5 rotate-90" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* House */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between ml-1">
                                                <label className="text-xs font-black uppercase tracking-wider text-zinc-500">House</label>
                                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">
                                                    {sectionId ? "Balanced by Section" : "Balanced by Class"}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                {suggestions?.all_houses.map((house) => (
                                                    <button
                                                        key={house.id}
                                                        type="button"
                                                        onClick={() => setHouseId(house.id)}
                                                        className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left relative ${
                                                            houseId === house.id
                                                                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600"
                                                                : "border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700"
                                                        }`}
                                                    >
                                                        <div
                                                            className="w-4 h-4 rounded-full shadow-sm flex-shrink-0"
                                                            style={{ backgroundColor: house.house_color?.toLowerCase() }}
                                                        />
                                                        <div>
                                                            <div className="text-xs font-black leading-none mb-1">{house.house_name}</div>
                                                            <div className="text-[10px] opacity-70 font-bold uppercase">{house.house_color}</div>
                                                        </div>
                                                        {suggestions?.suggested_house === house.id && (
                                                            <div className="absolute top-2 right-2 text-[8px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                                                <Sparkles className="h-2 w-2 text-amber-500" />
                                                                REC.
                                                            </div>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Academic year */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-wider text-zinc-500 ml-1">
                                                Academic Year
                                            </label>
                                            <div className="relative">
                                                <select
                                                    value={academicYear}
                                                    onChange={(e) => setAcademicYear(e.target.value)}
                                                    className="w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-200 transition-all font-bold text-zinc-700 dark:text-zinc-300 appearance-none cursor-pointer"
                                                >
                                                    <option value="">Unassigned</option>
                                                    {academicYearOptions.map((yr) => (
                                                        <option key={yr} value={yr}>{yr}</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                                                    <ChevronRight className="h-5 w-5 rotate-90" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-3 pt-2">
                                            <button
                                                type="button"
                                                onClick={() => setStep("choice")}
                                                className="flex-1 px-6 py-3.5 rounded-2xl font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all active:scale-95"
                                            >
                                                Back
                                            </button>
                                            <button
                                                type="button"
                                                disabled={submitting || loadingSuggestions}
                                                onClick={() => void submit("READMITTED")}
                                                className="flex-[2] px-6 py-3.5 rounded-2xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
                                                Confirm Readmission
                                            </button>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
