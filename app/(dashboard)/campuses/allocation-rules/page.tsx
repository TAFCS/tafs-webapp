"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    AlertCircle,
    AlertTriangle,
    ArrowLeft,
    ArrowRightLeft,
    CheckCircle,
    Loader2,
    RefreshCw,
    Save,
    Search,
    Users,
    X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAppSelector } from "@/store/hooks";
import {
    Campus,
    OfferedSection,
    SectionGenderMode,
    campusesService,
} from "@/lib/campuses.service";
import {
    SectionRosterStudent,
    studentsService,
} from "@/lib/students.service";
import {
    extractApiErrorMessage,
    formatSectionOptionLabel,
    isSectionSelectableForGender,
} from "@/lib/section-allocation";

type DraftRule = {
    student_capacity: string;
    unlimited: boolean;
    gender_mode: SectionGenderMode;
};

const GENDER_OPTIONS: Array<{ value: SectionGenderMode; label: string }> = [
    { value: "COED", label: "Coed (boys & girls)" },
    { value: "BOYS_ONLY", label: "Boys only" },
    { value: "GIRLS_ONLY", label: "Girls only" },
];

function toDraft(section: OfferedSection): DraftRule {
    return {
        student_capacity:
            section.student_capacity == null ? "" : String(section.student_capacity),
        unlimited: section.student_capacity == null,
        gender_mode: section.gender_mode ?? "COED",
    };
}

export default function SectionAllocationRulesPage() {
    const user = useAppSelector((s) => s.auth.user);
    const canView = !!user?.permissions?.includes("academic.campuses.view");
    const canEdit = !!user?.permissions?.includes("academic.campuses.edit")
        || !!user?.permissions?.includes("academic.campuses.update")
        || user?.role === "SUPER_ADMIN"
        || user?.role === "CAMPUS_ADMIN";
    const canViewStudents = !!user?.permissions?.includes("students.directory.view")
        || user?.role === "SUPER_ADMIN"
        || user?.role === "CAMPUS_ADMIN";
    const canMoveStudents = !!user?.permissions?.includes("students.directory.edit")
        || user?.role === "SUPER_ADMIN"
        || user?.role === "CAMPUS_ADMIN";

    const [campuses, setCampuses] = useState<Campus[]>([]);
    const [selectedCampusId, setSelectedCampusId] = useState<number | "">("");
    const [selectedClassId, setSelectedClassId] = useState<number | "">("");
    const [drafts, setDrafts] = useState<Record<number, DraftRule>>({});
    const [savingId, setSavingId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [managingSectionId, setManagingSectionId] = useState<number | null>(null);
    const [roster, setRoster] = useState<SectionRosterStudent[]>([]);
    const [isRosterLoading, setIsRosterLoading] = useState(false);
    const [rosterSearch, setRosterSearch] = useState("");
    const [destinationByStudent, setDestinationByStudent] = useState<Record<number, string>>({});
    const [movingStudentId, setMovingStudentId] = useState<number | null>(null);

    const loadData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await campusesService.list();
            setCampuses(data);
        } catch (err) {
            console.error(err);
            setError("Failed to load campus offerings.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (canView) loadData();
        else setIsLoading(false);
    }, [canView]);

    const selectedCampus = useMemo(
        () => campuses.find((c) => c.id === Number(selectedCampusId)),
        [campuses, selectedCampusId],
    );

    const offeredClasses = selectedCampus?.offered_classes ?? [];

    const selectedClass = useMemo(
        () => offeredClasses.find((c) => c.id === Number(selectedClassId)),
        [offeredClasses, selectedClassId],
    );

    const sections = selectedClass?.sections ?? [];

    useEffect(() => {
        const next: Record<number, DraftRule> = {};
        sections.forEach((sec) => {
            next[sec.id] = toDraft(sec);
        });
        setDrafts(next);
    }, [selectedCampusId, selectedClassId, campuses]);

    useEffect(() => {
        setManagingSectionId(null);
        setRoster([]);
        setRosterSearch("");
        setDestinationByStudent({});
    }, [selectedCampusId, selectedClassId]);

    if (!canView) {
        return (
            <div className="p-8">
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                    You do not have permission to view section allocation rules.
                </div>
            </div>
        );
    }

    const updateDraft = (sectionId: number, patch: Partial<DraftRule>) => {
        setDrafts((prev) => ({
            ...prev,
            [sectionId]: { ...prev[sectionId], ...patch },
        }));
    };

    const handleSave = async (section: OfferedSection) => {
        if (!selectedCampusId || !selectedClassId) return;
        if (!canEdit) {
            toast.error("You do not have permission to update allocation rules.");
            return;
        }

        const draft = drafts[section.id];
        if (!draft) return;

        let capacity: number | null = null;
        if (!draft.unlimited) {
            const parsed = Number(draft.student_capacity);
            if (!Number.isInteger(parsed) || parsed < 1) {
                toast.error("Capacity must be a positive whole number, or Unlimited.");
                return;
            }
            capacity = parsed;
        }

        setSavingId(section.id);
        try {
            const updated = await campusesService.upsertCampusSection(
                Number(selectedCampusId),
                Number(selectedClassId),
                section.id,
                {
                    is_active: true,
                    student_capacity: capacity,
                    gender_mode: draft.gender_mode,
                },
            );
            setCampuses((prev) =>
                prev.map((c) => (c.id === updated.id ? updated : c)),
            );
            toast.success(`Saved rules for section ${section.description}`);
        } catch (err: any) {
            const message =
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                "Failed to save allocation rules";
            toast.error(typeof message === "string" ? message : "Failed to save allocation rules");
        } finally {
            setSavingId(null);
        }
    };

    const refreshCampusData = async () => {
        const data = await campusesService.list();
        setCampuses(data);
    };

    const openRosterManager = async (section: OfferedSection) => {
        if (!selectedCampusId || !selectedClassId || !canViewStudents) return;
        setManagingSectionId(section.id);
        setRoster([]);
        setRosterSearch("");
        setDestinationByStudent({});
        setIsRosterLoading(true);
        try {
            const students = await studentsService.listSectionRoster({
                campus_id: Number(selectedCampusId),
                class_id: Number(selectedClassId),
                section_id: section.id,
            });
            setRoster(students);
        } catch (err) {
            toast.error(extractApiErrorMessage(err, "Failed to load the section roster."));
            setManagingSectionId(null);
        } finally {
            setIsRosterLoading(false);
        }
    };

    const moveStudent = async (student: SectionRosterStudent) => {
        if (!selectedCampusId || !selectedClassId || !managingSectionId) return;
        const destinationSectionId = Number(destinationByStudent[student.cc]);
        if (!destinationSectionId || destinationSectionId === managingSectionId) {
            toast.error("Select a different destination section.");
            return;
        }

        setMovingStudentId(student.cc);
        try {
            await studentsService.moveToSection(student.cc, {
                campus_id: Number(selectedCampusId),
                class_id: Number(selectedClassId),
                section_id: destinationSectionId,
            });
            setRoster((current) => current.filter((item) => item.cc !== student.cc));
            setDestinationByStudent((current) => {
                const next = { ...current };
                delete next[student.cc];
                return next;
            });
            await refreshCampusData();
            toast.success(`${student.student_full_name} moved successfully.`);
        } catch (err) {
            toast.error(extractApiErrorMessage(err, "Failed to move student."));
        } finally {
            setMovingStudentId(null);
        }
    };

    const managedSection = sections.find((section) => section.id === managingSectionId);
    const filteredRoster = roster.filter((student) => {
        const query = rosterSearch.trim().toLowerCase();
        if (!query) return true;
        return (
            student.student_full_name?.toLowerCase().includes(query)
            || String(student.cc).includes(query)
            || student.gr_number?.toLowerCase().includes(query)
        );
    });

    return (
        <div className="p-6 md:p-8 space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <Link
                        href="/campuses"
                        className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to Campuses
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Section Allocation Rules
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Configure student capacity and gender mode for each campus + class + section offering.
                    </p>
                </div>
                <button
                    onClick={loadData}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    Refresh
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-200">Campus</span>
                    <select
                        value={selectedCampusId}
                        onChange={(e) => {
                            setSelectedCampusId(e.target.value ? Number(e.target.value) : "");
                            setSelectedClassId("");
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                    >
                        <option value="">Select campus</option>
                        {campuses.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.campus_name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-200">Class</span>
                    <select
                        value={selectedClassId}
                        onChange={(e) =>
                            setSelectedClassId(e.target.value ? Number(e.target.value) : "")
                        }
                        disabled={!selectedCampusId}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"
                    >
                        <option value="">Select class</option>
                        {offeredClasses.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.description}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            {isLoading ? (
                <div className="flex items-center gap-2 text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading offerings…
                </div>
            ) : !selectedCampusId || !selectedClassId ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
                    Select a campus and class to configure section rules.
                </div>
            ) : sections.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
                    No sections are offered for this campus/class. Configure them under Section Setup first.
                </div>
            ) : (
                <div className="space-y-4">
                    {sections.map((section) => {
                        const draft = drafts[section.id] ?? toDraft(section);
                        const occupancy =
                            section.student_capacity == null
                                ? `${section.enrolled_count ?? 0} enrolled (unlimited)`
                                : `${section.enrolled_count ?? 0} / ${section.student_capacity}`;

                        return (
                            <div
                                key={section.id}
                                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                            Section {section.description}
                                        </h2>
                                        <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                                            <Users className="h-4 w-4" />
                                            {occupancy}
                                            {section.is_full ? (
                                                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                                                    Full
                                                </span>
                                            ) : null}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            Boys: {section.male_count ?? 0} · Girls: {section.female_count ?? 0} · Unknown: {section.unknown_count ?? 0}
                                        </p>
                                    </div>
                                    {(section.capacity_conflict_count ?? 0) > 0 ||
                                    (section.gender_conflict_count ?? 0) > 0 ? (
                                        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                            <div>
                                                {(section.capacity_conflict_count ?? 0) > 0 && (
                                                    <div>
                                                        Over capacity by {section.capacity_conflict_count} student(s)
                                                    </div>
                                                )}
                                                {(section.gender_conflict_count ?? 0) > 0 && (
                                                    <div>
                                                        {section.gender_conflict_count} gender conflict(s) already enrolled
                                                    </div>
                                                )}
                                                <div className="text-xs opacity-80">
                                                    Existing students are not moved automatically.
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
                                            <CheckCircle className="h-4 w-4" /> No current conflicts
                                        </div>
                                    )}
                                </div>

                                <div className="mt-4 grid gap-4 md:grid-cols-3">
                                    <label className="space-y-1 text-sm md:col-span-1">
                                        <span className="font-medium text-slate-700 dark:text-slate-200">
                                            Capacity
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min={1}
                                                disabled={draft.unlimited || !canEdit}
                                                value={draft.unlimited ? "" : draft.student_capacity}
                                                onChange={(e) =>
                                                    updateDraft(section.id, {
                                                        student_capacity: e.target.value,
                                                        unlimited: false,
                                                    })
                                                }
                                                placeholder="e.g. 30"
                                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950"
                                            />
                                        </div>
                                        <label className="mt-2 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                            <input
                                                type="checkbox"
                                                checked={draft.unlimited}
                                                disabled={!canEdit}
                                                onChange={(e) =>
                                                    updateDraft(section.id, {
                                                        unlimited: e.target.checked,
                                                        student_capacity: e.target.checked
                                                            ? ""
                                                            : draft.student_capacity || "30",
                                                    })
                                                }
                                            />
                                            Unlimited
                                        </label>
                                    </label>

                                    <label className="space-y-1 text-sm md:col-span-1">
                                        <span className="font-medium text-slate-700 dark:text-slate-200">
                                            Gender mode
                                        </span>
                                        <select
                                            value={draft.gender_mode}
                                            disabled={!canEdit}
                                            onChange={(e) =>
                                                updateDraft(section.id, {
                                                    gender_mode: e.target.value as SectionGenderMode,
                                                })
                                            }
                                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950"
                                        >
                                            {GENDER_OPTIONS.map((opt) => (
                                                <option key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <div className="flex items-end">
                                        <button
                                            onClick={() => handleSave(section)}
                                            disabled={!canEdit || savingId === section.id}
                                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                                        >
                                            {savingId === section.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Save className="h-4 w-4" />
                                            )}
                                            Save rules
                                        </button>
                                    </div>
                                </div>

                                {canViewStudents && (
                                    <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                                        <button
                                            onClick={() => openRosterManager(section)}
                                            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950"
                                        >
                                            <Users className="h-4 w-4" />
                                            Manage {section.enrolled_count ?? 0} allocated student(s)
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {managingSectionId && managedSection && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
                        <div className="flex items-start justify-between border-b border-slate-200 p-5 dark:border-slate-800">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                    Manage Section {managedSection.description} Students
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    {selectedCampus?.campus_name} · {selectedClass?.description} · {roster.length} enrolled student(s)
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                    Move existing students to another configured section. Capacity and gender rules are checked by the server.
                                </p>
                            </div>
                            <button
                                onClick={() => setManagingSectionId(null)}
                                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                                aria-label="Close roster manager"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    value={rosterSearch}
                                    onChange={(event) => setRosterSearch(event.target.value)}
                                    placeholder="Search by student name, CC, or GR number"
                                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                                />
                            </div>
                        </div>

                        <div className="overflow-auto">
                            {isRosterLoading ? (
                                <div className="flex items-center justify-center gap-2 p-12 text-slate-500">
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Loading allocated students…
                                </div>
                            ) : filteredRoster.length === 0 ? (
                                <div className="p-12 text-center text-slate-500">
                                    {roster.length === 0
                                        ? "No enrolled students are allocated to this section."
                                        : "No students match your search."}
                                </div>
                            ) : (
                                <table className="min-w-full text-sm">
                                    <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950">
                                        <tr>
                                            <th className="px-4 py-3">Student</th>
                                            <th className="px-4 py-3">Gender</th>
                                            <th className="px-4 py-3">Destination section</th>
                                            <th className="px-4 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRoster.map((student) => (
                                            <tr
                                                key={student.cc}
                                                className="border-t border-slate-100 dark:border-slate-800"
                                            >
                                                <td className="px-4 py-3">
                                                    <div className="font-semibold text-slate-900 dark:text-white">
                                                        {student.student_full_name}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        CC {student.cc}
                                                        {student.gr_number ? ` · GR ${student.gr_number}` : ""}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                    {student.gender || "Unknown"}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <select
                                                        value={destinationByStudent[student.cc] ?? ""}
                                                        onChange={(event) =>
                                                            setDestinationByStudent((current) => ({
                                                                ...current,
                                                                [student.cc]: event.target.value,
                                                            }))
                                                        }
                                                        disabled={!canMoveStudents || movingStudentId === student.cc}
                                                        className="w-full min-w-52 rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950"
                                                    >
                                                        <option value="">Select destination</option>
                                                        {sections
                                                            .filter((section) => section.id !== managingSectionId)
                                                            .map((section) => {
                                                                const selectable = isSectionSelectableForGender(
                                                                    section,
                                                                    student.gender,
                                                                );
                                                                return (
                                                                    <option
                                                                        key={section.id}
                                                                        value={section.id}
                                                                        disabled={!selectable}
                                                                    >
                                                                        {formatSectionOptionLabel(section, {
                                                                            studentGender: student.gender,
                                                                        })}
                                                                    </option>
                                                                );
                                                            })}
                                                    </select>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        onClick={() => moveStudent(student)}
                                                        disabled={
                                                            !canMoveStudents
                                                            || movingStudentId === student.cc
                                                            || !destinationByStudent[student.cc]
                                                        }
                                                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                                                    >
                                                        {movingStudentId === student.cc ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <ArrowRightLeft className="h-4 w-4" />
                                                        )}
                                                        Move
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {!canMoveStudents && (
                            <div className="border-t border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                                You can view this roster, but moving students requires the Student Directory edit permission.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
