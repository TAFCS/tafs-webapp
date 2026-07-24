"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle,
    History,
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
    HouseMove,
    HouseRebalanceHistoryItem,
    HouseRebalanceHistoryDetail,
    houseBalancerService,
} from "@/lib/house-balancer.service";
import { extractApiErrorMessage } from "@/lib/section-allocation";

type ApplyResultView = {
    title: string;
    subtitle: string;
    moves: HouseMove[];
    moves_count: number;
};

function assignmentChanged(row: HouseAssignmentPreview): boolean {
    return (row.current_house?.id ?? null) !== row.proposed_house.id;
}

function countAssignmentChanges(assignments: HouseAssignmentPreview[]): number {
    return assignments.filter(assignmentChanged).length;
}

function formatHistoryScope(entityId: string, action: string): string {
    if (action === "CAMPUS_REBALANCED") {
        const classMatch = entityId.match(/^campus:(\d+):class:(\d+)$/);
        if (classMatch) return `Campus #${classMatch[1]} · Class #${classMatch[2]}`;
        const campusMatch = entityId.match(/^campus:(\d+)$/);
        if (campusMatch) return `Campus #${campusMatch[1]} (all classes)`;
        return entityId;
    }
    const sectionMatch = entityId.match(/^(\d+):(\d+):(\d+)$/);
    if (sectionMatch) {
        return `Campus #${sectionMatch[1]} · Class #${sectionMatch[2]} · Section #${sectionMatch[3]}`;
    }
    return entityId;
}

function formatWhen(value: string): string {
    try {
        return new Date(value).toLocaleString();
    } catch {
        return value;
    }
}

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
    const [applyResult, setApplyResult] = useState<ApplyResultView | null>(null);
    const [historyItems, setHistoryItems] = useState<HouseRebalanceHistoryItem[]>([]);
    const [historyTotal, setHistoryTotal] = useState(0);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null);
    const [historyDetail, setHistoryDetail] =
        useState<HouseRebalanceHistoryDetail | null>(null);
    const [isLoadingHistoryDetail, setIsLoadingHistoryDetail] = useState(false);
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

    const loadHistory = useCallback(async (campusId: number) => {
        setIsLoadingHistory(true);
        try {
            const data = await houseBalancerService.listHistory(campusId);
            setHistoryItems(data.items);
            setHistoryTotal(data.total);
        } catch (err) {
            console.error(err);
            setHistoryItems([]);
            setHistoryTotal(0);
        } finally {
            setIsLoadingHistory(false);
        }
    }, []);

    useEffect(() => {
        if (canView) loadCampuses();
        else setIsLoading(false);
    }, [canView]);

    useEffect(() => {
        setExpandedHistoryId(null);
        setHistoryDetail(null);
        if (!selectedCampusId) {
            setHistoryItems([]);
            setHistoryTotal(0);
            return;
        }
        void loadHistory(Number(selectedCampusId));
    }, [selectedCampusId, loadHistory]);

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
        setApplyResult(null);
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
                setApplyResult({
                    title: "Applied — house changes",
                    subtitle: `${result.campus.campus_name} · ${result.moves_count} student(s) changed house across ${result.group_count} group(s)`,
                    moves: result.moves ?? [],
                    moves_count: result.moves_count ?? 0,
                });
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
                setApplyResult({
                    title: "Applied — house changes",
                    subtitle: `${result.campus.campus_name} · ${result.class.description} · Section ${result.section.description} · ${result.moves_count} change(s)`,
                    moves: result.moves ?? [],
                    moves_count: result.moves_count ?? 0,
                });
            }
            clearPreview();
            if (selectedCampusId) {
                void loadHistory(Number(selectedCampusId));
            }
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

    const toggleHistoryRow = async (id: number) => {
        if (expandedHistoryId === id) {
            setExpandedHistoryId(null);
            setHistoryDetail(null);
            return;
        }
        setExpandedHistoryId(id);
        setIsLoadingHistoryDetail(true);
        setHistoryDetail(null);
        try {
            setHistoryDetail(await houseBalancerService.getHistory(id));
        } catch (err) {
            toast.error(extractApiErrorMessage(err, "Failed to load rebalance details"));
            setExpandedHistoryId(null);
        } finally {
            setIsLoadingHistoryDetail(false);
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
                            setApplyResult(null);
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
                            setApplyResult(null);
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
                            setApplyResult(null);
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

            {applyResult && (
                <div className="overflow-hidden rounded-xl border border-emerald-200 bg-white dark:border-emerald-900 dark:bg-slate-900">
                    <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/40">
                        <h2 className="font-semibold text-emerald-900 dark:text-emerald-200">
                            {applyResult.title}
                        </h2>
                        <p className="mt-1 text-sm text-emerald-800/80 dark:text-emerald-300/80">
                            {applyResult.subtitle}
                        </p>
                    </div>
                    <MovesTable
                        moves={applyResult.moves}
                        emptyLabel="No students changed house in this rebalance."
                    />
                </div>
            )}

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
                            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                {countAssignmentChanges(preview.assignments)} house changes
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
                        <AssignmentTable assignments={preview.assignments} />
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
                            <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold dark:bg-indigo-950">
                                {campusPreview.groups.reduce(
                                    (total, group) =>
                                        total + countAssignmentChanges(group.assignments),
                                    0,
                                )}{" "}
                                house changes
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

            {selectedCampusId ? (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <History className="h-4 w-4 text-slate-500" />
                            <h2 className="font-semibold text-slate-900 dark:text-white">
                                Rebalance history
                            </h2>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold dark:bg-slate-800">
                                {historyTotal}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => loadHistory(Number(selectedCampusId))}
                            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-300"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Refresh
                        </button>
                    </div>

                    {isLoadingHistory ? (
                        <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
                        </div>
                    ) : historyItems.length === 0 ? (
                        <p className="px-4 py-6 text-sm text-slate-500">
                            No rebalance runs recorded for this campus yet.
                        </p>
                    ) : (
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                            {historyItems.map((item) => {
                                const open = expandedHistoryId === item.id;
                                return (
                                    <li key={item.id}>
                                        <button
                                            type="button"
                                            onClick={() => toggleHistoryRow(item.id)}
                                            className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-950"
                                        >
                                            <div>
                                                <div className="text-sm font-medium text-slate-900 dark:text-white">
                                                    {formatHistoryScope(item.entity_id, item.action)}
                                                </div>
                                                <div className="mt-1 text-xs text-slate-500">
                                                    {formatWhen(item.changed_at)} · {item.changed_by}
                                                    {item.action === "CAMPUS_REBALANCED"
                                                        ? " · Campus-wide"
                                                        : " · Section"}
                                                </div>
                                            </div>
                                            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold dark:bg-slate-800">
                                                {item.moves_count} move{item.moves_count === 1 ? "" : "s"}
                                            </span>
                                        </button>
                                        {open && (
                                            <div className="border-t border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-950/40">
                                                {isLoadingHistoryDetail ? (
                                                    <div className="flex items-center gap-2 px-4 py-4 text-sm text-slate-500">
                                                        <Loader2 className="h-4 w-4 animate-spin" />{" "}
                                                        Loading moves…
                                                    </div>
                                                ) : historyDetail?.id === item.id ? (
                                                    <MovesTable
                                                        moves={historyDetail.moves}
                                                        emptyLabel="No per-student moves stored for this run (older logs may only have a summary)."
                                                    />
                                                ) : null}
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            ) : null}

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
    const changeCount = countAssignmentChanges(group.assignments);
    return (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-semibold text-slate-900 dark:text-white">
                        {group.class.description} · Section {group.section.description}
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold dark:bg-slate-800">
                            {group.student_count} students
                        </span>
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                            {changeCount} house changes
                        </span>
                    </div>
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

            <details
                open={changeCount > 0}
                className="border-t border-slate-200 dark:border-slate-800"
            >
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-indigo-600 hover:bg-slate-50 dark:text-indigo-300 dark:hover:bg-slate-950">
                    View {changeCount} house change{changeCount === 1 ? "" : "s"}
                    {changeCount !== group.student_count
                        ? ` (${group.student_count} students total)`
                        : ""}
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
    const [showAll, setShowAll] = useState(false);
    const changed = useMemo(
        () => assignments.filter(assignmentChanged),
        [assignments],
    );
    const rows = showAll ? assignments : changed;

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {changed.length} house change{changed.length === 1 ? "" : "s"}
                    {showAll ? ` · showing all ${assignments.length}` : ""}
                </div>
                <button
                    type="button"
                    onClick={() => setShowAll((value) => !value)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-300"
                >
                    {showAll ? "Show changes only" : "Show all students"}
                </button>
            </div>
            <div className="max-h-96 overflow-auto">
                {rows.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-slate-500">
                        No house changes in this preview.
                    </p>
                ) : (
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
                            {rows.map((row) => (
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
                )}
            </div>
        </div>
    );
}

function MovesTable({
    moves,
    emptyLabel,
}: {
    moves: HouseMove[];
    emptyLabel: string;
}) {
    if (moves.length === 0) {
        return <p className="px-4 py-6 text-sm text-slate-500">{emptyLabel}</p>;
    }

    return (
        <div className="max-h-96 overflow-auto">
            <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                    <tr>
                        <th className="px-4 py-3 font-medium">CC</th>
                        <th className="px-4 py-3 font-medium">Student</th>
                        <th className="px-4 py-3 font-medium">Old House</th>
                        <th className="px-4 py-3 font-medium">New House</th>
                    </tr>
                </thead>
                <tbody>
                    {moves.map((row) => (
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
                                <HouseChip house={row.old_house} />
                            </td>
                            <td className="px-4 py-2">
                                <HouseChip house={row.new_house} />
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
