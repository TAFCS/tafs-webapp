"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import api from "@/lib/api";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ClassInfo {
    id: number;
    description: string;
    class_code: string;
    academic_system: string;
}

interface FeeTypeInfo {
    id: number;
    description: string;
    freq: string | null;
}

interface FeeScheduleItem {
    id: number;
    class_id: number;
    fee_id: number;
    amount: string; // Decimal comes as string from API
    classes: ClassInfo;
    fee_types: FeeTypeInfo;
}

// Local-only "new row" — no id yet
interface NewRow {
    _localId: string; // temp key
    class_id: string;
    fee_id: string;
    amount: string;
}

type EditableExisting = { type: "existing"; data: FeeScheduleItem; dirty: boolean };
type EditableNew = { type: "new"; data: NewRow };
type EditableRow = EditableExisting | EditableNew;

// ─── Component ──────────────────────────────────────────────────────────────

export default function ClasswiseFeesSchedulePage() {
    const [rows, setRows] = useState<EditableRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // ── Fetch ──────────────────────────────────────────────────────────────
    const fetchSchedules = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const { data } = await api.get("/v1/class-fee-schedule");
            const items: FeeScheduleItem[] = Array.isArray(data?.data) ? data.data : [];
            setRows(items.map((item) => ({ type: "existing", data: item, dirty: false })));
        } catch (err: any) {
            console.error("Error fetching class fee schedules:", err);
            setError("Failed to load schedules. Please refresh and try again.");
            setRows([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSchedules();
    }, [fetchSchedules]);

    // ── Helpers ────────────────────────────────────────────────────────────
    const clearFeedback = () => {
        if (successMessage) setSuccessMessage(null);
        if (error) setError(null);
    };

    // ── Handlers — existing rows ───────────────────────────────────────────
    const handleExistingChange = (
        id: number,
        field: "class_id" | "fee_id" | "amount",
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
        // Soft-remove from UI — no DELETE endpoint currently, so just remove locally
        clearFeedback();
        setRows((prev) => prev.filter((row) => !(row.type === "existing" && row.data.id === id)));
    };

    // ── Handlers — new rows ────────────────────────────────────────────────
    const handleAddRow = () => {
        clearFeedback();
        const newRow: EditableNew = {
            type: "new",
            data: { _localId: `new-${Date.now()}`, class_id: "", fee_id: "", amount: "" },
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

    const hasPendingChanges =
        rows.some((r) => (r.type === "existing" && r.dirty) || r.type === "new");

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                        Classwise Fee Schedule
                    </h1>
                    <p className="text-zinc-500 mt-1">
                        Define and manage fee amounts assigned to each class.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleAddRow}
                        disabled={isSaving}
                        className="inline-flex items-center justify-center px-4 py-2 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-sm font-medium rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add New
                    </button>
                    <button
                        onClick={fetchSchedules}
                        disabled={isLoading || isSaving}
                        className="inline-flex items-center justify-center px-4 py-2 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-sm font-medium rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50"
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

            {/* Error Banner */}
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

            {/* Success Banner */}
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

            {/* Table */}
            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                            <Loader2 className="text-primary h-6 w-6 animate-spin" />
                        </div>
                        <h3 className="text-sm font-medium text-zinc-900">Loading schedules…</h3>
                    </div>
                ) : rows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
                            <Receipt className="text-zinc-400 h-6 w-6" />
                        </div>
                        <h3 className="text-sm font-medium text-zinc-900">No schedules found</h3>
                        <p className="mt-1 text-sm text-zinc-500">
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
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left whitespace-nowrap">
                            <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 border-b border-zinc-200">
                                <tr>
                                    <th className="px-6 py-4 font-semibold w-20">ID</th>
                                    <th className="px-6 py-4 font-semibold">Class ID</th>
                                    <th className="px-6 py-4 font-semibold">Fee ID</th>
                                    <th className="px-6 py-4 font-semibold">Amount</th>
                                    <th className="px-6 py-4 font-semibold">Class</th>
                                    <th className="px-6 py-4 font-semibold">Fee Type</th>
                                    <th className="px-6 py-4 font-semibold w-16 text-center">
                                        Del
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => {
                                    if (row.type === "existing") {
                                        const item = row.data;
                                        return (
                                            <tr
                                                key={`existing-${item.id}`}
                                                className={`border-b border-zinc-100 transition-colors ${row.dirty
                                                    ? "bg-amber-50/50"
                                                    : "hover:bg-zinc-50/50"
                                                    }`}
                                            >
                                                <td className="px-6 py-3 font-medium text-zinc-400 text-xs">
                                                    {item.id}
                                                </td>
                                                <td className="px-6 py-3">
                                                    <input
                                                        type="number"
                                                        value={item.class_id}
                                                        onChange={(e) =>
                                                            handleExistingChange(item.id, "class_id", e.target.value)
                                                        }
                                                        className="w-24 px-3 py-1.5 bg-white border border-zinc-200 focus:border-primary rounded-lg text-sm outline-none transition-colors"
                                                    />
                                                </td>
                                                <td className="px-6 py-3">
                                                    <input
                                                        type="number"
                                                        value={item.fee_id}
                                                        onChange={(e) =>
                                                            handleExistingChange(item.id, "fee_id", e.target.value)
                                                        }
                                                        className="w-24 px-3 py-1.5 bg-white border border-zinc-200 focus:border-primary rounded-lg text-sm outline-none transition-colors"
                                                    />
                                                </td>
                                                <td className="px-6 py-3">
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs pointer-events-none">
                                                            Rs.
                                                        </span>
                                                        <input
                                                            type="number"
                                                            value={item.amount}
                                                            onChange={(e) =>
                                                                handleExistingChange(item.id, "amount", e.target.value)
                                                            }
                                                            step="0.01"
                                                            className="w-36 pl-9 pr-3 py-1.5 bg-white border border-zinc-200 focus:border-primary rounded-lg text-sm outline-none transition-colors"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3 text-zinc-600">
                                                    <span className="bg-zinc-100 text-zinc-700 text-xs font-medium px-2 py-0.5 rounded-full">
                                                        {item.classes?.description ?? "—"}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 text-zinc-600">
                                                    <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
                                                        {item.fee_types?.description ?? "—"}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 text-center">
                                                    <button
                                                        onClick={() => handleRemoveExisting(item.id)}
                                                        className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Remove from view"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    }

                                    // New row
                                    const nr = row.data;
                                    return (
                                        <tr
                                            key={`new-${nr._localId}`}
                                            className="border-b border-blue-100 bg-blue-50/40 transition-colors"
                                        >
                                            <td className="px-6 py-3">
                                                <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide">
                                                    New
                                                </span>
                                            </td>
                                            <td className="px-6 py-3">
                                                <input
                                                    type="number"
                                                    value={nr.class_id}
                                                    onChange={(e) =>
                                                        handleNewChange(nr._localId, "class_id", e.target.value)
                                                    }
                                                    placeholder="Class ID"
                                                    className="w-24 px-3 py-1.5 bg-white border border-blue-200 focus:border-primary rounded-lg text-sm outline-none transition-colors"
                                                />
                                            </td>
                                            <td className="px-6 py-3">
                                                <input
                                                    type="number"
                                                    value={nr.fee_id}
                                                    onChange={(e) =>
                                                        handleNewChange(nr._localId, "fee_id", e.target.value)
                                                    }
                                                    placeholder="Fee ID"
                                                    className="w-24 px-3 py-1.5 bg-white border border-blue-200 focus:border-primary rounded-lg text-sm outline-none transition-colors"
                                                />
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs pointer-events-none">
                                                        Rs.
                                                    </span>
                                                    <input
                                                        type="number"
                                                        value={nr.amount}
                                                        onChange={(e) =>
                                                            handleNewChange(nr._localId, "amount", e.target.value)
                                                        }
                                                        placeholder="0.00"
                                                        step="0.01"
                                                        className="w-36 pl-9 pr-3 py-1.5 bg-white border border-blue-200 focus:border-primary rounded-lg text-sm outline-none transition-colors"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-zinc-400 text-xs italic">
                                                — auto-filled on save
                                            </td>
                                            <td className="px-6 py-3 text-zinc-400 text-xs italic">
                                                — auto-filled on save
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <button
                                                    onClick={() => handleRemoveNew(nr._localId)}
                                                    className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Discard new row"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Legend */}
            {!isLoading && rows.length > 0 && (
                <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
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
        </div>
    );
}
