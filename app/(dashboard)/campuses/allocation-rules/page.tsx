"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    AlertCircle,
    AlertTriangle,
    ArrowLeft,
    ArrowRightLeft,
    Building2,
    CheckCircle,
    GraduationCap,
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
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { toggleId, serializeIds } from "@/components/filters/filter-params";

type DraftRule = {
    student_capacity: string;
    unlimited: boolean;
    gender_mode: SectionGenderMode;
};

type SectionWithContext = OfferedSection & {
    campusId: number;
    classId: number;
    campusName: string;
    className: string;
};

const GENDER_OPTIONS: Array<{ value: SectionGenderMode; label: string }> = [
    { value: "COED", label: "Coed (boys & girls)" },
    { value: "BOYS_ONLY", label: "Boys only" },
    { value: "GIRLS_ONLY", label: "Girls only" },
];

const ENROLLMENT_STATUS_STYLES: Record<string, { cls: string; label: string }> = {
    ENROLLED: {
        cls: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
        label: "Enrolled",
    },
    SOFT_ADMISSION: {
        cls: "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
        label: "Soft Admission",
    },
    QUICK_ADMISSION: {
        cls: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
        label: "Quick Admission",
    },
    UNCONFIRMED: {
        cls: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
        label: "Quick Admission",
    },
    GRADUATED: {
        cls: "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
        label: "Graduated",
    },
    EXPELLED: {
        cls: "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
        label: "Expelled",
    },
    LEFT: {
        cls: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
        label: "Left",
    },
};

function formatEnrollmentStatus(status: string | null | undefined) {
    if (!status) {
        return { cls: ENROLLMENT_STATUS_STYLES.SOFT_ADMISSION.cls, label: "Unknown" };
    }
    return (
        ENROLLMENT_STATUS_STYLES[status]
        ?? {
            cls: ENROLLMENT_STATUS_STYLES.SOFT_ADMISSION.cls,
            label: status.replace(/_/g, " "),
        }
    );
}

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
    const [campusIds, setCampusIds] = useState<number[]>([]);
    const [classIds, setClassIds] = useState<number[]>([]);
    const [drafts, setDrafts] = useState<Record<number, DraftRule>>({});
    const [savingId, setSavingId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [managingSectionKey, setManagingSectionKey] = useState<string | null>(null);
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

    const campusOptions = useMemo(
        () => campuses.map((c) => ({ id: c.id, label: c.campus_name })),
        [campuses],
    );

    const classOptions = useMemo(() => {
        const source = campusIds.length > 0
            ? campuses.filter((c) => campusIds.includes(c.id))
            : campuses;
        const byId = new Map<number, string>();
        source.forEach((campus) => {
            (campus.offered_classes ?? []).forEach((cls) => {
                if (!byId.has(cls.id)) byId.set(cls.id, cls.description);
            });
        });
        return Array.from(byId.entries())
            .map(([id, label]) => ({ id, label }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [campuses, campusIds]);

    const sectionsWithContext = useMemo((): SectionWithContext[] => {
        if (campusIds.length === 0 || classIds.length === 0) return [];
        const rows: SectionWithContext[] = [];
        campuses
            .filter((c) => campusIds.includes(c.id))
            .forEach((campus) => {
                (campus.offered_classes ?? [])
                    .filter((cls) => classIds.includes(cls.id))
                    .forEach((cls) => {
                        cls.sections.forEach((sec) => {
                            rows.push({
                                ...sec,
                                campusId: campus.id,
                                classId: cls.id,
                                campusName: campus.campus_name,
                                className: cls.description,
                            });
                        });
                    });
            });
        return rows;
    }, [campuses, campusIds, classIds]);

    // Stable key for campus+class+section so multi-campus offerings don't collide
    const sectionKey = (s: Pick<SectionWithContext, "campusId" | "classId" | "id">) =>
        `${s.campusId}:${s.classId}:${s.id}`;

    useEffect(() => {
        const validClassIds = new Set(classOptions.map((o) => o.id));
        setClassIds((prev) => {
            const next = prev.filter((id) => validClassIds.has(id));
            return next.length === prev.length ? prev : next;
        });
    }, [classOptions]);

    useEffect(() => {
        const next: Record<number, DraftRule> = {};
        sectionsWithContext.forEach((sec) => {
            next[sec.campus_section_id] = toDraft(sec);
        });
        setDrafts(next);
    }, [sectionsWithContext]);

    useEffect(() => {
        setManagingSectionKey(null);
        setRoster([]);
        setRosterSearch("");
        setDestinationByStudent({});
    }, [campusIds, classIds]);

    if (!canView) {
        return (
            <div className="p-8">
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                    You do not have permission to view section allocation rules.
                </div>
            </div>
        );
    }

    const updateDraft = (campusSectionId: number, patch: Partial<DraftRule>) => {
        setDrafts((prev) => ({
            ...prev,
            [campusSectionId]: { ...prev[campusSectionId], ...patch },
        }));
    };

    const handleSave = async (section: SectionWithContext) => {
        if (!canEdit) {
            toast.error("You do not have permission to update allocation rules.");
            return;
        }

        const draft = drafts[section.campus_section_id];
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

        setSavingId(section.campus_section_id);
        try {
            const updated = await campusesService.upsertCampusSection(
                section.campusId,
                section.classId,
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

    const openRosterManager = async (section: SectionWithContext) => {
        if (campusIds.length === 0 || classIds.length === 0 || !canViewStudents) return;
        setManagingSectionKey(sectionKey(section));
        setRoster([]);
        setRosterSearch("");
        setDestinationByStudent({});
        setIsRosterLoading(true);
        try {
            const students = await studentsService.listSectionRoster({
                campus_id: serializeIds(campusIds),
                class_id: serializeIds(classIds),
                section_id: section.id,
            });
            setRoster(students);
        } catch (err) {
            toast.error(extractApiErrorMessage(err, "Failed to load the section roster."));
            setManagingSectionKey(null);
        } finally {
            setIsRosterLoading(false);
        }
    };

    const moveStudent = async (student: SectionRosterStudent) => {
        const managed = sectionsWithContext.find((s) => sectionKey(s) === managingSectionKey);
        if (!managed) return;

        const destinationSectionId = Number(destinationByStudent[student.cc]);
        if (!destinationSectionId || destinationSectionId === managed.id) {
            toast.error("Select a different destination section.");
            return;
        }

        const studentCampusId = student.campus_id ?? managed.campusId;
        const studentClassId = student.class_id ?? managed.classId;
        if (!studentCampusId || !studentClassId) {
            toast.error("Student campus/class is missing; cannot move.");
            return;
        }

        setMovingStudentId(student.cc);
        try {
            await studentsService.moveToSection(student.cc, {
                campus_id: studentCampusId,
                class_id: studentClassId,
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

    const managedSection = sectionsWithContext.find((s) => sectionKey(s) === managingSectionKey);
    const rosterEnrolledCount = roster.filter(
        (student) => student.enrollment_status === "ENROLLED",
    ).length;
    const filteredRoster = roster.filter((student) => {
        const query = rosterSearch.trim().toLowerCase();
        if (!query) return true;
        return (
            student.student_full_name?.toLowerCase().includes(query)
            || String(student.cc).includes(query)
            || student.gr_number?.toLowerCase().includes(query)
            || student.enrollment_status?.toLowerCase().includes(query)
        );
    });

    const destinationSectionsFor = (student: SectionRosterStudent) => {
        const campusId = student.campus_id ?? managedSection?.campusId;
        const classId = student.class_id ?? managedSection?.classId;
        return sectionsWithContext.filter(
            (section) =>
                section.campusId === campusId
                && section.classId === classId
                && section.id !== managedSection?.id,
        );
    };

    const filterSummary =
        campusIds.length === 0 && classIds.length === 0
            ? null
            : [
                campusIds.length === 1
                    ? campusOptions.find((c) => c.id === campusIds[0])?.label
                    : campusIds.length > 1
                        ? `${campusIds.length} campuses`
                        : null,
                classIds.length === 1
                    ? classOptions.find((c) => c.id === classIds[0])?.label
                    : classIds.length > 1
                        ? `${classIds.length} classes`
                        : null,
            ].filter(Boolean).join(" · ");

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
                <FilterDropdown
                    label="Campus"
                    icon={Building2}
                    value={campusIds}
                    options={campusOptions}
                    placeholder="All Campuses"
                    onToggle={(id) => setCampusIds((prev) => toggleId(prev, id))}
                    onClear={() => setCampusIds([])}
                />

                <FilterDropdown
                    label="Class"
                    icon={GraduationCap}
                    value={classIds}
                    options={classOptions}
                    placeholder="All Classes"
                    onToggle={(id) => setClassIds((prev) => toggleId(prev, id))}
                    onClear={() => setClassIds([])}
                />
            </div>

            {isLoading ? (
                <div className="flex items-center gap-2 text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading offerings…
                </div>
            ) : campusIds.length === 0 || classIds.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
                    Select at least one campus and class to configure section rules.
                </div>
            ) : sectionsWithContext.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
                    No sections are offered for the selected campus/class combination(s). Configure them under Section Setup first.
                </div>
            ) : (
                <div className="space-y-4">
                    {sectionsWithContext.map((section) => {
                        const draft = drafts[section.campus_section_id] ?? toDraft(section);
                        const occupancy =
                            section.student_capacity == null
                                ? `${section.enrolled_count ?? 0} enrolled (unlimited)`
                                : `${section.enrolled_count ?? 0} / ${section.student_capacity}`;
                        const showCampusClass =
                            campusIds.length > 1 || classIds.length > 1;

                        return (
                            <div
                                key={sectionKey(section)}
                                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                            Section {section.description}
                                        </h2>
                                        {showCampusClass && (
                                            <p className="mt-0.5 text-xs font-medium text-slate-400">
                                                {section.campusName} · {section.className}
                                            </p>
                                        )}
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
                                                    updateDraft(section.campus_section_id, {
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
                                                    updateDraft(section.campus_section_id, {
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
                                                updateDraft(section.campus_section_id, {
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
                                            disabled={!canEdit || savingId === section.campus_section_id}
                                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                                        >
                                            {savingId === section.campus_section_id ? (
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
                                            Manage {section.enrolled_count ?? 0} enrolled student(s)
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {managingSectionKey && managedSection && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
                        <div className="flex items-start justify-between border-b border-slate-200 p-5 dark:border-slate-800">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                    Manage Section {managedSection.description} Students
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    {filterSummary || `${managedSection.campusName} · ${managedSection.className}`}
                                    {!isRosterLoading && (
                                        <>
                                            {" · "}
                                            {roster.length} assigned
                                            {" · "}
                                            {rosterEnrolledCount} enrolled
                                        </>
                                    )}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                    Shows students assigned to this section across the selected campus/class filters. Only enrolled students count toward capacity. Move between configured sections; capacity and gender rules are checked by the server.
                                </p>
                            </div>
                            <button
                                onClick={() => setManagingSectionKey(null)}
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
                                    Loading assigned students…
                                </div>
                            ) : filteredRoster.length === 0 ? (
                                <div className="p-12 text-center text-slate-500">
                                    {roster.length === 0
                                        ? "No students are assigned to this section."
                                        : "No students match your search."}
                                </div>
                            ) : (
                                <table className="min-w-full text-sm">
                                    <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950">
                                        <tr>
                                            <th className="px-4 py-3">Student</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3">Gender</th>
                                            <th className="px-4 py-3">Destination section</th>
                                            <th className="px-4 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRoster.map((student) => {
                                            const statusInfo = formatEnrollmentStatus(
                                                student.enrollment_status,
                                            );
                                            const destSections = destinationSectionsFor(student);
                                            return (
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
                                                        {student.campus ? ` · ${student.campus}` : ""}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusInfo.cls}`}
                                                    >
                                                        {statusInfo.label}
                                                    </span>
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
                                                        {destSections.map((section) => {
                                                            const selectable = isSectionSelectableForGender(
                                                                section,
                                                                student.gender,
                                                            );
                                                            return (
                                                                <option
                                                                    key={sectionKey(section)}
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
                                            );
                                        })}
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
