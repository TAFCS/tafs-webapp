"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle,
    Loader2,
    RefreshCw,
    Shuffle,
    Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAppSelector } from "@/store/hooks";
import { Campus, campusesService } from "@/lib/campuses.service";
import {
    HouseBalancerPreview,
    CampusHouseBalancerPreview,
    CampusHouseBalanceGroup,
    HouseInfo,
    HouseAssignmentPreview,
    houseBalancerService,
} from "@/lib/house-balancer.service";
import { extractApiErrorMessage } from "@/lib/section-allocation";

export default function HouseBalancerPage() {
    const user = useAppSelector((s) => s.auth.user);
    const canView = !!user?.permissions?.includes("academic.campuses.view");
    const canEdit = !!user?.permissions?.includes("academic.campuses.edit")
        || user?.role === "SUPER_ADMIN"
        || user?.role === "CAMPUS_ADMIN";

    const [campuses, setCampuses] = useState<Campus[]>([]);
    const [selectedCampusId, setSelectedCampusId] = useState<number | "">("");
    const [selectedClassId, setSelectedClassId] = useState<number | "">("");
    const [selectedSectionId, setSelectedSectionId] = useState<number | "">("");
    const [preview, setPreview] = useState<HouseBalancerPreview | null>(null);
    const [campusPreview, setCampusPreview] =
        useState<CampusHouseBalancerPreview | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [confirmApply, setConfirmApply] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadCampuses = async () => {
        setIsLoading(true);
        setError(null);
        try {
            setCampuses(await campusesService.list());
        } catch (err) {
            console.error(err);
            setError("Failed to load campuses.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (canView) loadCampuses();
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

    const clearPreview = () => {
        setPreview(null);
        setCampusPreview(null);
        setConfirmApply(false);
    };

    const generatePreview = async () => {
        if (!selectedCampusId) {
            toast.error("Select a campus first.");
            return;
        }
        setIsPreviewing(true);
        setError(null);
        try {
            if (!selectedSectionId) {
                const data = await houseBalancerService.previewCampus(
                    Number(selectedCampusId),
                    selectedClassId ? Number(selectedClassId) : undefined,
                );
                setCampusPreview(data);
                setPreview(null);
                toast.success(
                    `Preview ready for ${data.total_students} student(s) across ${data.group_count} class/section group(s)`,
                );
            } else {
                const data = await houseBalancerService.preview({
                    campus_id: Number(selectedCampusId),
                    class_id: Number(selectedClassId),
                    section_id: Number(selectedSectionId),
                });
                setPreview(data);
                setCampusPreview(null);
                toast.success(`Preview ready for ${data.student_count} student(s)`);
            }
            setConfirmApply(false);
        } catch (err: unknown) {
            toast.error(
                extractApiErrorMessage(err, "Failed to generate house preview"),
            );
            clearPreview();
        } finally {
            setIsPreviewing(false);
        }
    };

    const applyAssignments = async () => {
        if ((!preview && !campusPreview) || !canEdit) return;
        setIsApplying(true);
        try {
            if (campusPreview) {
                const result = await houseBalancerService.applyCampus(
                    campusPreview,
                    selectedClassId ? Number(selectedClassId) : undefined,
                );
                toast.success(
                    `Applied house assignments for ${result.total_students} student(s) across ${result.group_count} class/section group(s)`,
                );
            } else if (preview) {
                const result = await houseBalancerService.apply({
                    campus_id: Number(selectedCampusId),
                    class_id: Number(selectedClassId),
                    section_id: Number(selectedSectionId),
                    roster_fingerprint: preview.roster_fingerprint,
                    assignments: preview.assignments.map((a) => ({
                        student_id: a.student_id,
                        house_id: a.proposed_house.id,
                    })),
                });
                toast.success(
                    `Applied house assignments for ${result.student_count} student(s)`,
                );
            }
            clearPreview();
        } catch (err: unknown) {
            const response = (err as {
                response?: { data?: { message?: { code?: string } | string; code?: string } };
            })?.response;
            const payload = response?.data?.message;
            const code =
                (typeof payload === "object" ? payload?.code : undefined) ||
                response?.data?.code;
            if (code === "HOUSE_PREVIEW_STALE") {
                toast.error("Roster changed. Generate a new preview before applying.");
                clearPreview();
            } else {
                toast.error(
                    extractApiErrorMessage(err, "Failed to apply house assignments"),
                );
            }
        } finally {
            setIsApplying(false);
        }
    };

    if (!canView) {
        return (
            <div className="p-8">
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                    You do not have permission to view the house balancer.
                </div>
            </div>
        );
    }

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
                        House Balancer
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Select a campus to balance all class/sections, or choose a class to balance all its sections, or choose a specific section for a targeted shuffle.
                    </p>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-200">Campus</span>
                    <select
                        value={selectedCampusId}
                        onChange={(e) => {
                            setSelectedCampusId(e.target.value ? Number(e.target.value) : "");
                            setSelectedClassId("");
                            setSelectedSectionId("");
                            clearPreview();
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
                        disabled={!selectedCampusId}
                        onChange={(e) => {
                            setSelectedClassId(e.target.value ? Number(e.target.value) : "");
                            setSelectedSectionId("");
                            clearPreview();
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"
                    >
                        <option value="">All classes (campus-wide)</option>
                        {offeredClasses.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.description}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-200">Section</span>
                    <select
                        value={selectedSectionId}
                        disabled={!selectedClassId}
                        onChange={(e) => {
                            setSelectedSectionId(e.target.value ? Number(e.target.value) : "");
                            clearPreview();
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"
                    >
                        <option value="">All sections (class-wide)</option>
                        {sections.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.description}
                                {typeof s.enrolled_count === "number"
                                    ? ` (${s.enrolled_count} enrolled)`
                                    : ""}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div className="flex flex-wrap gap-3">
                <button
                    onClick={generatePreview}
                    disabled={
                        !selectedCampusId ||
                        isPreviewing ||
                        isLoading
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                    {isPreviewing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Shuffle className="h-4 w-4" />
                    )}
                    {preview || campusPreview ? "Refresh Preview" : "Generate Preview"}
                </button>
                {(preview || campusPreview) && canEdit && (
                    <button
                        onClick={() => setConfirmApply(true)}
                        disabled={isApplying}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                        <CheckCircle className="h-4 w-4" />
                        Apply Assignments
                    </button>
                )}
            </div>

            {isLoading ? (
                <div className="flex items-center gap-2 text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading campuses…
                </div>
            ) : null}

            {preview && (
                <div className="space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                            <Users className="h-4 w-4" />
                            <span>
                                {preview.campus.campus_name} · {preview.class.description} · Section{" "}
                                {preview.section.description}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold dark:bg-slate-800">
                                {preview.student_count} students
                            </span>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                            {preview.houses.map((house) => (
                                <div
                                    key={house.id}
                                    className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                                >
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="h-3 w-3 rounded-full"
                                            style={{
                                                backgroundColor: house.house_color || "#94a3b8",
                                            }}
                                        />
                                        <span className="font-medium text-slate-800 dark:text-slate-100">
                                            {house.house_name || `House #${house.id}`}
                                        </span>
                                    </div>
                                    <div className="mt-2 text-xs text-slate-500">
                                        Current: {preview.current_counts[house.id] ?? 0}
                                    </div>
                                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                        Proposed: {preview.proposed_counts[house.id] ?? 0}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">CC</th>
                                        <th className="px-4 py-3 font-medium">Student</th>
                                        <th className="px-4 py-3 font-medium">Current House</th>
                                        <th className="px-4 py-3 font-medium">Proposed House</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.assignments.map((row) => (
                                        <tr
                                            key={row.student_id}
                                            className="border-t border-slate-100 dark:border-slate-800"
                                        >
                                            <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                                                {row.student_cc}
                                            </td>
                                            <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">
                                                {row.student_name}
                                            </td>
                                            <td className="px-4 py-2">
                                                <HouseChip house={row.current_house} />
                                            </td>
                                            <td className="px-4 py-2">
                                                <HouseChip house={row.proposed_house} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {campusPreview && (
                <div className="space-y-4">
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
                        <div className="flex flex-wrap items-center gap-3 text-sm text-indigo-800 dark:text-indigo-200">
                            <Users className="h-4 w-4" />
                            <strong>{campusPreview.campus.campus_name}</strong>
                            <span>
                                {campusPreview.total_students} students across{" "}
                                {campusPreview.group_count} class/section groups
                            </span>
                        </div>
                        <p className="mt-2 text-xs text-indigo-700/80 dark:text-indigo-300/80">
                            Every class/section below is balanced independently. Students
                            are never mixed between classes or sections.
                        </p>
                    </div>

                    {campusPreview.groups.map((group) => (
                        <CampusGroupPreview
                            key={`${group.class.id}:${group.section.id}`}
                            group={group}
                            houses={campusPreview.houses}
                        />
                    ))}
                </div>
            )}

            {confirmApply && (preview || campusPreview) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                            Apply house assignments?
                        </h3>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                            {campusPreview ? (
                                <>
                                    This will update houses for{" "}
                                    <strong>{campusPreview.total_students}</strong> enrolled
                                    student(s) across{" "}
                                    <strong>{campusPreview.group_count}</strong> class/section
                                    groups at {campusPreview.campus.campus_name}.
                                </>
                            ) : preview ? (
                                <>
                                    This will update houses for{" "}
                                    <strong>{preview.student_count}</strong> enrolled student(s)
                                    in {preview.campus.campus_name} /{" "}
                                    {preview.class.description} / Section{" "}
                                    {preview.section.description}.
                                </>
                            ) : null}
                        </p>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setConfirmApply(false)}
                                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium dark:border-slate-700"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={applyAssignments}
                                disabled={isApplying}
                                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            >
                                {isApplying ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="h-4 w-4" />
                                )}
                                Confirm apply
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function CampusGroupPreview({
    group,
    houses,
}: {
    group: CampusHouseBalanceGroup;
    houses: HouseInfo[];
}) {
    return (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-semibold text-slate-900 dark:text-white">
                        {group.class.description} · Section {group.section.description}
                    </h2>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold dark:bg-slate-800">
                        {group.student_count} students
                    </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {houses.map((house) => (
                        <div
                            key={house.id}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
                        >
                            <div className="flex items-center gap-2 font-medium">
                                <span
                                    className="h-2.5 w-2.5 rounded-full"
                                    style={{
                                        backgroundColor: house.house_color || "#94a3b8",
                                    }}
                                />
                                {house.house_name || `House #${house.id}`}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                                {group.current_counts[house.id] ?? 0} →{" "}
                                <strong>{group.proposed_counts[house.id] ?? 0}</strong>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <details className="border-t border-slate-200 dark:border-slate-800">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-indigo-600 hover:bg-slate-50 dark:text-indigo-300 dark:hover:bg-slate-950">
                    View {group.student_count} student assignments
                </summary>
                <AssignmentTable assignments={group.assignments} />
            </details>
        </div>
    );
}

function AssignmentTable({
    assignments,
}: {
    assignments: HouseAssignmentPreview[];
}) {
    return (
        <div className="max-h-96 overflow-auto">
            <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                    <tr>
                        <th className="px-4 py-3 font-medium">CC</th>
                        <th className="px-4 py-3 font-medium">Student</th>
                        <th className="px-4 py-3 font-medium">Current House</th>
                        <th className="px-4 py-3 font-medium">Proposed House</th>
                    </tr>
                </thead>
                <tbody>
                    {assignments.map((row) => (
                        <tr
                            key={row.student_id}
                            className="border-t border-slate-100 dark:border-slate-800"
                        >
                            <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                                {row.student_cc}
                            </td>
                            <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">
                                {row.student_name}
                            </td>
                            <td className="px-4 py-2">
                                <HouseChip house={row.current_house} />
                            </td>
                            <td className="px-4 py-2">
                                <HouseChip house={row.proposed_house} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function HouseChip({
    house,
}: {
    house: { id: number; house_name: string | null; house_color: string | null } | null;
}) {
    if (!house) {
        return <span className="text-slate-400">Unassigned</span>;
    }
    return (
        <span className="inline-flex items-center gap-2">
            <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: house.house_color || "#94a3b8" }}
            />
            {house.house_name || `House #${house.id}`}
        </span>
    );
}
