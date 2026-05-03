"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
    Receipt,
    Save,
    Loader2,
    RefreshCw,
    AlertCircle,
    CheckCircle,
    Plus,
    Trash2,
    X,
    ChevronsUpDown,
    ChevronUp,
    ChevronDown,
} from "lucide-react";
import api from "@/lib/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchClasses } from "@/store/slices/classesSlice";
import { fetchFeeTypes } from "@/store/slices/feeTypesSlice";
import { fetchCampuses } from "@/store/slices/campusesSlice";
import { getCurrentAcademicYear, getAcademicYears } from "@/lib/fee-utils";
import toast from "react-hot-toast";

// ─── Local types (schedule rows) ─────────────────────────────────────────────

interface ClassInfo {
    id: number;
    description: string;
    class_code: string;
    academic_system: string;
}

interface CampusInfo {
    id: number;
    campus_code: string;
    campus_name: string;
}

interface FeeTypeInfo {
    id: number;
    description: string;
    freq: string | null;
    priority_order?: number;
}

interface FeeScheduleItem {
    id: number;
    class_id: number;
    fee_id: number;
    amount: string;
    campus_id: number | null;
    classes: ClassInfo;
    fee_types: FeeTypeInfo;
    campuses: CampusInfo | null;
}

// Local-only "new row" — no id yet
interface NewRow {
    _localId: string;
    campus_id: string;
    class_id: string;
    fee_id: string;
    amount: string;
}

type EditableExisting = { type: "existing"; data: FeeScheduleItem; dirty: boolean };
type EditableNew = { type: "new"; data: NewRow };
type EditableRow = EditableExisting | EditableNew;

const ACADEMIC_YEARS = getAcademicYears(2, 2); // Show some past and future years

// ─── Component ──────────────────────────────────────────────────────────────

type SortKey = "id" | "campus_id" | "class_id" | "fee_id" | "amount" | "class" | "fee_type";
type SortDir = "asc" | "desc";

export default function ClasswiseFeesSchedulePage() {
    const dispatch = useAppDispatch();

    // ── Redux store ────────────────────────────────────────────────────────
    const classes = useAppSelector((s) => s.classes.items);
    const feeTypes = useAppSelector((s) => s.feeTypes.items);
    const campuses = useAppSelector((s) => s.campuses.items);
    const classesLoading = useAppSelector((s) => s.classes.isLoading);
    const feeTypesLoading = useAppSelector((s) => s.feeTypes.isLoading);

    const [rows, setRows] = useState<EditableRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [sortKey, setSortKey] = useState<SortKey>("id");
    const [sortDir, setSortDir] = useState<SortDir>("asc");
    const [expandedCampuses, setExpandedCampuses] = useState<Record<string, boolean>>({});
    const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});
    const [deleteScheduleId, setDeleteScheduleId] = useState<number | null>(null);
    const [isDeletingSchedule, setIsDeletingSchedule] = useState(false);
    const [selectedYear, setSelectedYear] = useState(getCurrentAcademicYear());
    const [isCopyingHistory, setIsCopyingHistory] = useState(false);
    const [showCopyModal, setShowCopyModal] = useState(false);
    const [copyFromYear, setCopyFromYear] = useState("");

    // ── Fetch schedule + bootstrap store lookups ────────────────────────
    const fetchSchedules = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const { data } = await api.get("/v1/class-fee-schedule", {
                params: { academic_year: selectedYear }
            });
            const items: FeeScheduleItem[] = Array.isArray(data?.data) ? data.data : [];
            setRows(items.map((item) => ({ type: "existing", data: item, dirty: false })));
        } catch (err: any) {
            console.error("Error fetching class fee schedules:", err);
            setError("Failed to load schedules. Please refresh and try again.");
            setRows([]);
        } finally {
            setIsLoading(false);
        }
    }, [selectedYear]);

    useEffect(() => {
        fetchSchedules();
        // Bootstrap store lookups — only fetch if not already cached
        if (classes.length === 0) dispatch(fetchClasses());
        if (feeTypes.length === 0) dispatch(fetchFeeTypes());
        if (campuses.length === 0) dispatch(fetchCampuses());
    }, [fetchSchedules]);

    // ── Helpers ────────────────────────────────────────────────────────────
    const clearFeedback = () => {
        if (successMessage) setSuccessMessage(null);
        if (error) setError(null);
    };

    // ── Handlers — existing rows ───────────────────────────────────────────
    const handleExistingChange = (
        id: number,
        field: "campus_id" | "class_id" | "fee_id" | "amount",
        value: string
    ) => {
        clearFeedback();
        setRows((prev) =>
            prev.map((row) => {
                if (row.type !== "existing" || row.data.id !== id) return row;
                return {
                    ...row,
                    dirty: true,
                    data: { ...row.data, [field]: field === "amount" ? value : Number(value) },
                };
            })
        );
    };

    const handleRemoveExisting = (id: number) => {
        setDeleteScheduleId(id);
    };

    const handleDeleteSchedule = async () => {
        if (deleteScheduleId === null) return;
        setIsDeletingSchedule(true);
        setError(null);
        try {
            await api.delete(`/v1/class-fee-schedule/${deleteScheduleId}`);
            setSuccessMessage("Schedule deleted successfully.");
            setRows((prev) => prev.filter((row) => !(row.type === "existing" && row.data.id === deleteScheduleId)));
            setDeleteScheduleId(null);
        } catch (err: any) {
            console.error("Error deleting schedule:", err);
            setError(err.response?.data?.message || "Failed to delete schedule.");
        } finally {
            setIsDeletingSchedule(false);
        }
    };

    // ── Handlers — new rows ────────────────────────────────────────────────
    const handleAddRow = () => {
        clearFeedback();
        const newRow: EditableNew = {
            type: "new",
            data: { _localId: `new-${Date.now()}`, campus_id: "", class_id: "", fee_id: "", amount: "" },
        };
        setRows((prev) => [newRow, ...prev]);
    };

    const handleNewChange = (
        localId: string,
        field: keyof Omit<NewRow, "_localId">,
        value: string
    ) => {
        clearFeedback();
        setRows((prev) =>
            prev.map((row) => {
                if (row.type !== "new" || row.data._localId !== localId) return row;
                return { ...row, data: { ...row.data, [field]: value } };
            })
        );
    };

    const handleRemoveNew = (localId: string) => {
        setRows((prev) =>
            prev.filter((row) => !(row.type === "new" && row.data._localId === localId))
        );
    };

    // ── Save ───────────────────────────────────────────────────────────────
    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);

        const dirtyExisting = rows.filter(
            (r): r is EditableExisting => r.type === "existing" && r.dirty
        );
        const newRows = rows.filter((r): r is EditableNew => r.type === "new");

        // Validate new rows
        const invalidNew = newRows.filter(
            (r) => !r.data.class_id || !r.data.fee_id || !r.data.amount
        );
        if (invalidNew.length > 0) {
            setError("Please fill in all fields (Class ID, Fee ID, Amount) for new rows.");
            setIsSaving(false);
            return;
        }

        if (dirtyExisting.length === 0 && newRows.length === 0) {
            setSuccessMessage("No changes to save.");
            setIsSaving(false);
            return;
        }

        try {
            let createdCount = 0;
            let updatedCount = 0;

            // 1. Create new records one-by-one (POST)
            for (const row of newRows) {
                await api.post("/v1/class-fee-schedule", {
                    class_id: Number(row.data.class_id),
                    fee_id: Number(row.data.fee_id),
                    amount: Number(row.data.amount),
                    academic_year: selectedYear,
                    ...(row.data.campus_id ? { campus_id: Number(row.data.campus_id) } : {}),
                });
                createdCount++;
            }

            // 2. Bulk-update dirty existing records (PATCH /bulk)
            if (dirtyExisting.length > 0) {
                const payload = {
                    items: dirtyExisting.map((r) => ({
                        id: r.data.id,
                        class_id: Number(r.data.class_id),
                        fee_id: Number(r.data.fee_id),
                        amount: Number(r.data.amount),
                        campus_id: r.data.campus_id !== null ? Number(r.data.campus_id) : undefined,
                    })),
                };
                await api.patch("/v1/class-fee-schedule/bulk", payload);
                updatedCount = dirtyExisting.length;
            }

            const parts: string[] = [];
            if (createdCount) parts.push(`${createdCount} record${createdCount > 1 ? "s" : ""} created`);
            if (updatedCount) parts.push(`${updatedCount} record${updatedCount > 1 ? "s" : ""} updated`);
            setSuccessMessage(`Success — ${parts.join(" and ")}.`);

            // Refetch to get clean server state with related data
            await fetchSchedules();
        } catch (err: any) {
            console.error("Error saving class fee schedules:", err);
            const msg =
                err.response?.data?.message ||
                "Failed to save changes. Please try again.";
            setError(Array.isArray(msg) ? msg.join("; ") : msg);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCopyHistory = async () => {
        if (!copyFromYear) {
            toast.error("Please select a source year.");
            return;
        }
        if (copyFromYear === selectedYear) {
            toast.error("Source and target years must be different.");
            return;
        }

        setIsCopyingHistory(true);
        try {
            const { data } = await api.post("/v1/class-fee-schedule/copy-history", {
                from_year: copyFromYear,
                to_year: selectedYear,
            });
            toast.success(data.message || "History copied successfully.");
            setShowCopyModal(false);
            fetchSchedules();
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to copy history.");
        } finally {
            setIsCopyingHistory(false);
        }
    };

    const hasPendingChanges =
        rows.some((r) => (r.type === "existing" && r.dirty) || r.type === "new");

    // ── Grouping ───────────────────────────────────────────────────────────
    const groupedRows = useMemo(() => {
        const groups: Record<string, Record<string, EditableRow[]>> = {};

        const getKeys = (row: EditableRow) => {
            const campusId = row.type === "existing" ? row.data.campus_id : row.data.campus_id;
            const classId = row.type === "existing" ? row.data.class_id : row.data.class_id;
            return {
                campusKey: campusId ? String(campusId) : "unassigned",
                classKey: classId ? String(classId) : "unassigned",
            };
        };

        const sortedRows = [...rows].sort((a, b) => {
            const getPriority = (r: EditableRow) => {
                const fId = r.type === "existing" ? r.data.fee_id : Number(r.data.fee_id);
                const ft = feeTypes.find(f => f.id === fId);
                return ft?.priority_order ?? 999;
            };
            return getPriority(a) - getPriority(b);
        });

        sortedRows.forEach((row) => {
            const { campusKey, classKey } = getKeys(row);
            if (!groups[campusKey]) groups[campusKey] = {};
            if (!groups[campusKey][classKey]) groups[campusKey][classKey] = [];
            groups[campusKey][classKey].push(row);
        });

        return groups;
    }, [rows]);

    const getCampusName = (campusKey: string) => {
        if (campusKey === "unassigned") return "Global / All Campuses";
        const match = campuses.find((c) => c.id === Number(campusKey));
        return match ? match.campus_name : `Campus ID: ${campusKey} (Unknown)`;
    };

    const getClassName = (classKey: string) => {
        if (classKey === "unassigned") return "Unassigned Class";
        const match = classes.find((c) => c.id === Number(classKey));
        return match ? `${match.description} (${match.class_code})` : `Class ID: ${classKey} (Unknown)`;
    };

    const toggleCampus = (key: string) => {
        setExpandedCampuses(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const toggleClass = (key: string) => {
        setExpandedClasses(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleAddSpecific = (campusId: string, classId: string) => {
        clearFeedback();
        const newRow: EditableNew = {
            type: "new",
            data: {
                _localId: `new-${Date.now()}`,
                campus_id: campusId === "unassigned" ? "" : campusId,
                class_id: classId === "unassigned" ? "" : classId,
                fee_id: "",
                amount: "",
            },
        };
        setRows((prev) => [newRow, ...prev]);
    };

    // ── Render Helpers ─────────────────────────────────────────────────────
    const renderRow = (row: EditableRow) => {
        const isExisting = row.type === "existing";
        const id = isExisting ? row.data.id : row.data._localId;
        const dirty = isExisting ? row.dirty : true;

        const campusId = isExisting ? (row.data.campus_id ?? "") : row.data.campus_id;
        const classId = isExisting ? row.data.class_id : row.data.class_id;
        const feeId = isExisting ? row.data.fee_id : row.data.fee_id;
        const amount = isExisting ? row.data.amount : row.data.amount;

        const handleChange = (field: "campus_id" | "class_id" | "fee_id" | "amount", val: string) => {
            if (isExisting) {
                handleExistingChange(id as number, field, val);
            } else {
                handleNewChange(id as string, field, val);
            }
        };

        const handleRemove = () => {
            if (isExisting) {
                handleRemoveExisting(id as number);
            } else {
                handleRemoveNew(id as string);
            }
        };

        return (
            <tr
                key={`${row.type}-${id}`}
                className={`border-b border-zinc-100 transition-colors ${!isExisting ? "bg-blue-50/40" : dirty ? "bg-amber-50/50" : "hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900/50"
                    }`}
            >
                <td className="px-4 py-3 font-medium text-zinc-400 text-xs w-20">
                    {!isExisting ? (
                        <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide">
                            New
                        </span>
                    ) : (
                        id
                    )}
                </td>

                <td className="px-4 py-3">
                    <select
                        value={campusId}
                        onChange={(e) => handleChange("campus_id", e.target.value)}
                        className="w-full min-w-[140px] px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-primary rounded-lg text-sm outline-none transition-colors"
                    >
                        <option value="">Global / All Campuses</option>
                        {campuses.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.campus_name}
                            </option>
                        ))}
                    </select>
                </td>

                <td className="px-4 py-3">
                    <select
                        value={classId}
                        onChange={(e) => handleChange("class_id", e.target.value)}
                        className="w-full min-w-[140px] px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-primary rounded-lg text-sm outline-none transition-colors"
                    >
                        <option value="" disabled>Select Class</option>
                        {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.description}
                            </option>
                        ))}
                    </select>
                </td>

                <td className="px-4 py-3">
                    <select
                        value={feeId}
                        onChange={(e) => handleChange("fee_id", e.target.value)}
                        className="w-full min-w-[140px] px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-primary rounded-lg text-sm outline-none transition-colors"
                    >
                        <option value="" disabled>Select Fee Type</option>
                        {feeTypes.map((f) => (
                            <option key={f.id} value={f.id}>
                                {f.description}
                            </option>
                        ))}
                    </select>
                </td>

                <td className="px-4 py-3">
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs pointer-events-none">
                            Rs.
                        </span>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => handleChange("amount", e.target.value)}
                            step="0.01"
                            placeholder="0.00"
                            className="w-32 pl-9 pr-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-primary rounded-lg text-sm outline-none transition-colors"
                        />
                    </div>
                </td>

                <td className="px-4 py-3 text-center">
                    <button
                        onClick={handleRemove}
                        className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title={isExisting ? "Remove from view" : "Discard new row"}
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </td>
            </tr>
        );
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                        Classwise Fee
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                        Define and manage fee amounts assigned to each class.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 shadow-sm">
                        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Year:</span>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="bg-transparent text-sm font-medium outline-none border-none focus:ring-0 p-0 pr-6"
                        >
                            {ACADEMIC_YEARS.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={() => {
                            setCopyFromYear("");
                            setShowCopyModal(true);
                        }}
                        className="inline-flex items-center justify-center px-4 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50"
                    >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Copy History
                    </button>

                    <button
                        onClick={handleAddRow}
                        disabled={isSaving}
                        className="inline-flex items-center justify-center px-4 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add New (Unassigned)
                    </button>
                    <button
                        onClick={fetchSchedules}
                        disabled={isLoading || isSaving}
                        className="inline-flex items-center justify-center px-4 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isLoading || isSaving || !hasPendingChanges}
                        className="inline-flex items-center justify-center px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg shadow-sm shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving…
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4 mr-2" />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm animate-in fade-in duration-300">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="font-semibold">Error</p>
                        <p className="text-red-700 mt-0.5">{error}</p>
                    </div>
                    <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {successMessage && (
                <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-sm animate-in fade-in duration-300">
                    <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="font-semibold">Success</p>
                        <p className="text-emerald-700 mt-0.5">{successMessage}</p>
                    </div>
                    <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-600">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {isLoading ? (
                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm flex flex-col items-center justify-center py-20 text-center">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Loader2 className="text-primary h-6 w-6 animate-spin" />
                    </div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Loading schedules…</h3>
                </div>
            ) : rows.length === 0 ? (
                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm flex flex-col items-center justify-center py-20 text-center">
                    <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                        <Receipt className="text-zinc-400 h-6 w-6" />
                    </div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No schedules found</h3>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                        There are currently no fee schedules defined.
                    </p>
                    <button
                        onClick={handleAddRow}
                        className="mt-4 text-primary text-sm font-medium hover:underline"
                    >
                        Create your first schedule
                    </button>
                </div>
            ) : (
                <div className="space-y-8">
                    {Object.entries(groupedRows)
                        .sort(([keyA], [keyB]) => {
                            if (keyA === "unassigned") return -1;
                            if (keyB === "unassigned") return 1;
                            return getCampusName(keyA).localeCompare(getCampusName(keyB));
                        })
                        .map(([campusKey, classesGroup]) => {
                            const isCampusExpanded = expandedCampuses[campusKey] !== false; // Default true
                            return (
                                <div key={`campus-${campusKey}`} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
                                    <button
                                        onClick={() => toggleCampus(campusKey)}
                                        className="w-full bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
                                    >
                                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-violet-500" />
                                            {getCampusName(campusKey)}
                                            <span className="ml-2 text-xs font-medium text-zinc-400">
                                                ({Object.keys(classesGroup).length} Classes)
                                            </span>
                                        </h2>
                                        {isCampusExpanded ? <ChevronUp className="h-5 w-5 text-zinc-400" /> : <ChevronDown className="h-5 w-5 text-zinc-400" />}
                                    </button>

                                    {isCampusExpanded && (
                                        <div className="divide-y divide-zinc-200">
                                            {Object.entries(classesGroup)
                                                .sort(([keyA], [keyB]) => {
                                                    if (keyA === "unassigned") return -1;
                                                    if (keyB === "unassigned") return 1;
                                                    return getClassName(keyA).localeCompare(getClassName(keyB));
                                                })
                                                .map(([classKey, classRows]) => {
                                                    const classFullKey = `${campusKey}-${classKey}`;
                                                    const isClassExpanded = expandedClasses[classFullKey] !== false; // Default true
                                                    return (
                                                        <div key={`class-${classKey}`} className="bg-white dark:bg-zinc-950/50">
                                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 md:px-6 bg-white dark:bg-zinc-950/30">
                                                                <button
                                                                    onClick={() => toggleClass(classFullKey)}
                                                                    className="flex-1 flex items-center gap-2 text-base font-semibold text-zinc-800 dark:text-zinc-200 hover:opacity-70 transition-opacity"
                                                                >
                                                                    {isClassExpanded ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
                                                                    <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                                                                    {getClassName(classKey)}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleAddSpecific(campusKey, classKey)}
                                                                    className="inline-flex items-center justify-center px-3 py-1.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900 hover:border-blue-200 text-blue-600 text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-95"
                                                                >
                                                                    <Plus className="h-3.5 w-3.5 mr-1" />
                                                                    Add Fee
                                                                </button>
                                                            </div>

                                                            {isClassExpanded && (
                                                                <div className="px-6 pb-6 pt-2">
                                                                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-x-auto shadow-sm">
                                                                        <table className="w-full text-sm text-left whitespace-nowrap">
                                                                            <thead className="text-xs uppercase bg-zinc-50 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                                                                                <tr>
                                                                                    <th className="px-4 py-3 font-semibold w-20">ID</th>
                                                                                    <th className="px-4 py-3 font-semibold">Campus</th>
                                                                                    <th className="px-4 py-3 font-semibold">Class</th>
                                                                                    <th className="px-4 py-3 font-semibold">Fee Type</th>
                                                                                    <th className="px-4 py-3 font-semibold">Amount</th>
                                                                                    <th className="px-4 py-3 font-semibold text-center w-16">Act</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {classRows.map(renderRow)}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                </div>
            )}

            {!isLoading && rows.length > 0 && (
                <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded bg-amber-100 border border-amber-200 inline-block" />
                        Modified (unsaved)
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded bg-blue-100 border border-blue-200 inline-block" />
                        New row (pending create)
                    </span>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteScheduleId !== null && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-950/60 backdrop-blur-lg p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300 text-center border border-zinc-200 dark:border-zinc-800">
                        <div className="p-8">
                            <div className="h-16 w-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Trash2 className="h-8 w-8" />
                            </div>
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Delete Schedule?</h2>
                            <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-sm leading-relaxed">
                                This will permanently remove this fee from the class schedule. Students may still have billed vouchers with this amount.
                            </p>
                        </div>
                        <div className="p-6 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 flex gap-3">
                            <button
                                onClick={() => setDeleteScheduleId(null)}
                                className="flex-1 h-12 font-bold text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all font-sans"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteSchedule}
                                disabled={isDeletingSchedule}
                                className="flex-1 h-12 font-bold text-white bg-rose-600 rounded-2xl hover:bg-rose-700 transition-all active:scale-95 shadow-lg shadow-rose-200 dark:shadow-rose-900/20 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isDeletingSchedule ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Copy History Modal */}
            {showCopyModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-950/60 backdrop-blur-lg p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300 border border-zinc-200 dark:border-zinc-800">
                        <div className="p-8">
                            <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <RefreshCw className="h-8 w-8" />
                            </div>
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 text-center">Copy Fee History</h2>
                            <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-sm text-center">
                                Select the academic year you want to copy fee rates FROM. This will overwrite all fees for <strong>{selectedYear}</strong>.
                            </p>

                            <div className="mt-6">
                                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Source Year</label>
                                <select
                                    value={copyFromYear}
                                    onChange={(e) => setCopyFromYear(e.target.value)}
                                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-primary transition-colors text-sm"
                                >
                                    <option value="" disabled>Select Source Year</option>
                                    {ACADEMIC_YEARS.filter(y => y !== selectedYear).map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="p-6 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 flex gap-3">
                            <button
                                onClick={() => setShowCopyModal(false)}
                                className="flex-1 h-12 font-bold text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all font-sans"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCopyHistory}
                                disabled={isCopyingHistory || !copyFromYear}
                                className="flex-1 h-12 font-bold text-white bg-primary rounded-2xl hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isCopyingHistory ? <Loader2 className="h-4 w-4 animate-spin" /> : "Copy Rates"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
