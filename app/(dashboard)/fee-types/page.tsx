"use client";

import { useState, useEffect } from "react";
import { Banknote, Save, Loader2, RefreshCw, AlertCircle, CheckCircle, Plus, Trash2, Package } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";

const ACADEMIC_MONTHS = [
    'August', 'September', 'October', 'November', 'December', 'January',
    'February', 'March', 'April', 'May', 'June', 'July'
];

interface FeeTypeItem {
    id: string | number;
    description: string;
    freq: "MONTHLY" | "ONE_TIME" | "";
    priority_order?: number;
    breakup: string;
    collection_day_by_month: Record<string, string>;
}

type BreakupShape = {
    months: string[];
    collection_day_by_month: Record<string, string>;
};

const parseBreakup = (breakup: unknown): BreakupShape => {
    const result: BreakupShape = { months: [], collection_day_by_month: {} };

    if (Array.isArray(breakup)) {
        result.months = breakup.map((x) => String(x).trim()).filter(Boolean);
        return result;
    }

    if (typeof breakup === "string") {
        result.months = breakup.split(",").map((x) => x.trim()).filter(Boolean);
        return result;
    }

    if (breakup && typeof breakup === "object") {
        const typed = breakup as Record<string, unknown>;
        if (Array.isArray(typed.months)) {
            result.months = typed.months.map((x) => String(x).trim()).filter(Boolean);
        }

        const map = typed.collection_day_by_month ?? typed.collection_date_by_month;
        if (map && typeof map === "object" && !Array.isArray(map)) {
            for (const [key, value] of Object.entries(map as Record<string, unknown>)) {
                if (typeof value === "number" && Number.isInteger(value)) {
                    result.collection_day_by_month[key] = String(value);
                } else if (typeof value === "string" && value.trim()) {
                    const trimmed = value.trim();
                    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                        result.collection_day_by_month[key] = String(Number(trimmed.slice(8, 10)));
                    } else if (/^\d{1,2}$/.test(trimmed)) {
                        result.collection_day_by_month[key] = String(Number(trimmed));
                    }
                }
            }
        }
    }

    return result;
};

export default function FeeTypesPage() {
    const [feeTypes, setFeeTypes] = useState<FeeTypeItem[]>([]);
    const [originalFeeTypes, setOriginalFeeTypes] = useState<FeeTypeItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // State for Add Modal
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [newFeeType, setNewFeeType] = useState({
        description: "",
        freq: "MONTHLY",
        breakup: ACADEMIC_MONTHS.join(", "),
        collection_day_by_month: {} as Record<string, string>,
        priority_order: 0,
    });

    const fetchFeeTypes = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data } = await api.get("/v1/fee-types");

            // Extract the array, defaulting to an empty array if data.data is undefined
            const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];

            // Map the items to ensure they at least have id, description, freq
            const mappedItems = items.map((item: any) => {
                const normalizedBreakup = parseBreakup(item.breakup);

                return {
                    ...item,
                    id: item.id || Math.random().toString(36).substring(7),
                    description: item.description || item.name || "",
                    freq: item.freq || "MONTHLY",
                    priority_order: item.priority_order || 0,
                    breakup: normalizedBreakup.months.join(", "),
                    collection_day_by_month: normalizedBreakup.collection_day_by_month,
                };
            });

            setFeeTypes(mappedItems);
            setOriginalFeeTypes(JSON.parse(JSON.stringify(mappedItems)));
        } catch (err: any) {
            console.error("Error fetching data:", err);
            setError("Failed to load data. Please try again.");
            setFeeTypes([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchFeeTypes();
    }, []);

    const handleFieldChange = (id: string | number, field: keyof FeeTypeItem, newValue: string) => {
        setFeeTypes(prev =>
            prev.map(item =>
                item.id === id ? { ...item, [field]: newValue } : item
            )
        );
        // Clear success message when user starts making changes again
        if (successMessage) setSuccessMessage(null);
    };

    const setMonthsForItem = (id: string | number, months: string[]) => {
        setFeeTypes((prev) =>
            prev.map((item) => {
                if (item.id !== id) return item;
                const nextDateMap: Record<string, string> = {};
                const currentMonths = getMonths(item.breakup || "");
                const sharedMonthlyDay =
                    item.freq === "MONTHLY"
                        ? getSharedCollectionDay(currentMonths, item.collection_day_by_month || {})
                        : "";

                for (const month of months) {
                    if (item.freq === "MONTHLY" && sharedMonthlyDay) {
                        nextDateMap[month] = sharedMonthlyDay;
                    } else if (item.collection_day_by_month?.[month]) {
                        nextDateMap[month] = item.collection_day_by_month[month];
                    }
                }
                return {
                    ...item,
                    breakup: months.join(", "),
                    collection_day_by_month: nextDateMap,
                };
            }),
        );
        if (successMessage) setSuccessMessage(null);
    };

    const setCollectionDayForItem = (id: string | number, month: string, dayValue: string) => {
        const normalizedDay = normalizeDayInput(dayValue);
        if (normalizedDay === null) {
            return;
        }

        setFeeTypes((prev) =>
            prev.map((item) =>
                item.id === id
                    ? {
                        ...item,
                        collection_day_by_month: {
                            ...(item.collection_day_by_month || {}),
                            [month]: normalizedDay,
                        },
                    }
                    : item,
            ),
        );
        if (successMessage) setSuccessMessage(null);
    };

    const setCollectionDayForNewFeeType = (month: string, dayValue: string) => {
        const normalizedDay = normalizeDayInput(dayValue);
        if (normalizedDay === null) {
            return;
        }

        setNewFeeType((prev) => ({
            ...prev,
            collection_day_by_month: {
                ...prev.collection_day_by_month,
                [month]: normalizedDay,
            },
        }));
    };

    const setSharedCollectionDayForItem = (id: string | number, dayValue: string) => {
        const normalizedDay = normalizeDayInput(dayValue);
        if (normalizedDay === null) {
            return;
        }

        setFeeTypes((prev) =>
            prev.map((item) => {
                if (item.id !== id) return item;

                const months = getMonths(item.breakup || "");
                const nextMap: Record<string, string> = {};
                if (normalizedDay) {
                    for (const month of months) {
                        nextMap[month] = normalizedDay;
                    }
                }

                return {
                    ...item,
                    collection_day_by_month: nextMap,
                };
            }),
        );
        if (successMessage) setSuccessMessage(null);
    };

    const setSharedCollectionDayForNewFeeType = (dayValue: string) => {
        const normalizedDay = normalizeDayInput(dayValue);
        if (normalizedDay === null) {
            return;
        }

        setNewFeeType((prev) => {
            const months = getMonths(prev.breakup || "");
            const nextMap: Record<string, string> = {};
            if (normalizedDay) {
                for (const month of months) {
                    nextMap[month] = normalizedDay;
                }
            }

            return {
                ...prev,
                collection_day_by_month: nextMap,
            };
        });
    };

    const getSharedCollectionDay = (months: string[], dayMap: Record<string, string>): string => {
        if (months.length === 0) {
            return "";
        }
        const dayValues = months.map((m) => dayMap?.[m]).filter(Boolean);
        if (dayValues.length === 0) {
            return "";
        }
        const unique = Array.from(new Set(dayValues));
        return unique.length === 1 ? unique[0] : "";
    };

    const normalizeDayInput = (rawValue: string): string | null => {
        const digitsOnly = rawValue.replace(/\D/g, '');

        if (!digitsOnly) {
            return '';
        }

        const day = Number(digitsOnly);
        if (!Number.isInteger(day) || day < 1 || day > 31) {
            return null;
        }

        return String(day);
    };

    const getMonths = (breakupValue: string): string[] =>
        breakupValue.split(",").map((s) => s.trim()).filter(Boolean);

    const validateMonthsAndDays = (
        months: string[],
        dayMap: Record<string, string>,
        label: string,
        freq: FeeTypeItem["freq"] | "MONTHLY" | "ONE_TIME",
    ): string | null => {
        if (months.length === 0) {
            return `${label}: at least one month is required.`;
        }

        if (freq === "MONTHLY") {
            const sharedDay = getSharedCollectionDay(months, dayMap);
            if (!sharedDay) {
                return `${label}: monthly fees require one shared collection day for all selected months.`;
            }
        }

        for (const month of months) {
            const dayVal = dayMap?.[month];
            if (!dayVal) {
                return `${label}: collection day is required for ${month}.`;
            }
            const dayNum = Number(dayVal);
            if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 31) {
                return `${label}: invalid day for ${month}. Use 1-31.`;
            }
        }

        return null;
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);

        // Find only the rows that were actually modified
        const modifiedFeeTypes = feeTypes.filter(updatedItem => {
            const original = originalFeeTypes.find(o => o.id === updatedItem.id);
            return original && (
                original.description !== updatedItem.description ||
                original.freq !== updatedItem.freq ||
                original.breakup !== updatedItem.breakup ||
                JSON.stringify(original.collection_day_by_month || {}) !== JSON.stringify(updatedItem.collection_day_by_month || {}) ||
                original.priority_order !== updatedItem.priority_order
            );
        });

        if (modifiedFeeTypes.length === 0) {
            setSuccessMessage("No changes to save.");
            setIsSaving(false);
            return;
        }

        for (const item of modifiedFeeTypes) {
            const months = getMonths(item.breakup || "");
            const validationError = validateMonthsAndDays(
                months,
                item.collection_day_by_month || {},
                `Fee type #${item.id}`,
                item.freq || "MONTHLY",
            );
            if (validationError) {
                setError(validationError);
                setIsSaving(false);
                return;
            }
        }

        try {
            const payload = modifiedFeeTypes.map(item => {
                const months = getMonths(item.breakup || "");
                const dayMap: Record<string, number> = {};
                for (const month of months) {
                    const value = item.collection_day_by_month?.[month];
                    if (value) {
                        dayMap[month] = Number(value);
                    }
                }

                return {
                    id: item.id,
                    description: item.description,
                    freq: item.freq,
                    priority_order: parseInt(String(item.priority_order || 0)),
                    breakup: {
                        months,
                        collection_day_by_month: dayMap,
                    },
                };
            });

            await api.patch("/v1/fee-types/bulk", { items: payload });

            setSuccessMessage(`Successfully updated ${modifiedFeeTypes.length} records.`);
            setOriginalFeeTypes(JSON.parse(JSON.stringify(feeTypes)));
        } catch (err: any) {
            console.error("Error saving data:", err);
            const errMsg = err.response?.data?.message || err.response?.data?.error || "Failed to save changes. Please try again.";
            setError(Array.isArray(errMsg) ? errMsg.join("; ") : errMsg);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddFeeType = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsAdding(true);
        setError(null);
        setSuccessMessage(null);

        const months = getMonths(newFeeType.breakup || "");
        const validationError = validateMonthsAndDays(
            months,
            newFeeType.collection_day_by_month || {},
            'New fee type',
            newFeeType.freq as "MONTHLY" | "ONE_TIME",
        );
        if (validationError) {
            setError(validationError);
            setIsAdding(false);
            return;
        }

        try {
            const dayMap: Record<string, number> = {};
            for (const month of months) {
                const value = newFeeType.collection_day_by_month?.[month];
                if (value) {
                    dayMap[month] = Number(value);
                }
            }

            await api.post("/v1/fee-types", {
                ...newFeeType,
                priority_order: parseInt(String(newFeeType.priority_order || 0)),
                breakup: {
                    months,
                    collection_day_by_month: dayMap,
                },
            });
            setSuccessMessage("Fee type added successfully.");
            setIsAddModalOpen(false);
            setNewFeeType({
                description: "",
                freq: "MONTHLY",
                breakup: "",
                collection_day_by_month: {},
                priority_order: 0,
            });
            fetchFeeTypes(); // Refresh list to get the actual database ID
        } catch (err: any) {
            console.error("Error adding fee type:", err);
            const errMsg = err.response?.data?.message || err.response?.data?.error || "Failed to add fee type.";
            setError(Array.isArray(errMsg) ? errMsg.join("; ") : errMsg);
        } finally {
            setIsAdding(false);
        }
    };

    const handleDelete = async () => {
        if (deleteId === null) return;
        setIsDeleting(true);
        setError(null);
        setSuccessMessage(null);

        try {
            await api.delete(`/v1/fee-types/${deleteId}`);
            setSuccessMessage("Fee type deleted successfully.");
            setDeleteId(null);
            fetchFeeTypes();
        } catch (err: any) {
            console.error("Error deleting fee type:", err);
            const errMsg = err.response?.data?.message || err.response?.data?.error || "Failed to delete fee type. It might be in use.";
            setError(Array.isArray(errMsg) ? errMsg.join("; ") : errMsg);
        } finally {
            setIsDeleting(false);
        }
    };

    const hasChanges = JSON.stringify(feeTypes) !== JSON.stringify(originalFeeTypes);

    return (
        <div className="space-y-6 relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Fee Types</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">Manage the specific types and frequencies of fees.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="inline-flex items-center justify-center px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium rounded-lg shadow-sm transition-all active:scale-95"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Fee Type
                    </button>
                    <button
                        onClick={fetchFeeTypes}
                        disabled={isLoading || isSaving}
                        className="inline-flex items-center justify-center px-4 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <Link
                        href="/fee-types/bundle-names"
                        className="inline-flex items-center justify-center px-4 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-lg shadow-sm transition-all active:scale-95"
                    >
                        <Package className="h-4 w-4 mr-2" />
                        Bundle Names
                    </Link>
                    <button
                        onClick={handleSave}
                        disabled={isLoading || isSaving || !hasChanges}
                        className="inline-flex items-center justify-center px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg shadow-sm shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                        ) : (
                            <><Save className="h-4 w-4 mr-2" /> Save Changes</>
                        )}
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm animate-in fade-in duration-300">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold">Error</p>
                        <p className="text-red-700 mt-0.5">{error}</p>
                    </div>
                </div>
            )}

            {successMessage && (
                <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-sm animate-in fade-in duration-300">
                    <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold">Success</p>
                        <p className="text-emerald-700 mt-0.5">{successMessage}</p>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                            <Loader2 className="text-primary h-6 w-6 animate-spin" />
                        </div>
                        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Loading data...</h3>
                    </div>
                ) : feeTypes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                            <Banknote className="text-zinc-400 h-6 w-6" />
                        </div>
                        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No data found</h3>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">There are currently no records to display.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left whitespace-nowrap">
                            <thead className="text-xs text-zinc-500 dark:text-zinc-400 uppercase bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                                <tr>
                                    <th className="px-6 py-4 font-semibold w-24">ID</th>
                                    <th className="px-6 py-4 font-semibold">Description</th>
                                    <th className="px-6 py-4 font-semibold w-24">Priority</th>
                                    <th className="px-6 py-4 font-semibold w-64">Breakup (Months)</th>
                                    <th className="px-6 py-4 font-semibold w-72">Collection Day</th>
                                    <th className="px-6 py-4 font-semibold w-48">Frequency</th>
                                    <th className="px-6 py-4 font-semibold w-24 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {feeTypes.map((item) => (
                                    <tr key={item.id} className="border-b border-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900/50 transition-colors">
                                        <td className="px-6 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                                            {item.id}
                                        </td>
                                        <td className="px-6 py-3">
                                            <input
                                                type="text"
                                                value={item.description || ""}
                                                onChange={(e) => handleFieldChange(item.id, "description", e.target.value)}
                                                className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-primary rounded-lg text-sm outline-none transition-colors"
                                                placeholder="Enter fee description..."
                                            />
                                        </td>
                                        <td className="px-6 py-3">
                                            <input
                                                type="number"
                                                value={item.priority_order ?? 0}
                                                onChange={(e) => handleFieldChange(item.id, "priority_order", e.target.value)}
                                                title="Priority Order"
                                                className="w-20 px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-primary rounded-lg text-sm outline-none transition-colors"
                                            />
                                        </td>
                                        <td className="px-6 py-3">
                                            {(() => {
                                                const currentBreakups = getMonths(item.breakup || "");
                                                if (item.freq === "ONE_TIME") {
                                                    return (
                                                        <select
                                                            value={currentBreakups[0] || ""}
                                                            onChange={(e) => setMonthsForItem(item.id, e.target.value ? [e.target.value] : [])}
                                                            title="Breakup Month"
                                                            className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-primary rounded-lg text-sm outline-none transition-colors"
                                                        >
                                                            <option value="">Select Month...</option>
                                                            {ACADEMIC_MONTHS.map((month) => (
                                                                <option key={month} value={month}>{month}</option>
                                                            ))}
                                                        </select>
                                                    );
                                                }

                                                return (
                                                    <div className="flex flex-wrap gap-1 max-w-[240px]">
                                                        {ACADEMIC_MONTHS.map((month) => {
                                                            const isSelected = currentBreakups.includes(month);
                                                            return (
                                                                <button
                                                                    key={month}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newBreakups = isSelected
                                                                            ? currentBreakups.filter((m: string) => m !== month)
                                                                            : [...currentBreakups, month];
                                                                        setMonthsForItem(item.id, newBreakups);
                                                                    }}
                                                                    className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${isSelected ? 'bg-zinc-800 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200'
                                                                        }`}
                                                                    title={month}
                                                                >
                                                                    {month.substring(0, 3)}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-6 py-3">
                                            {item.freq === "ONE_TIME" ? (
                                                (() => {
                                                    const months = getMonths(item.breakup || "");
                                                    const month = months[0];
                                                    if (!month) {
                                                        return <span className="text-xs text-zinc-400">Select a month first</span>;
                                                    }
                                                    return (
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={31}
                                                            value={item.collection_day_by_month?.[month] || ""}
                                                            onChange={(e) => setCollectionDayForItem(item.id, month, e.target.value)}
                                                            title={`Collection Day ${month}`}
                                                            placeholder="DD"
                                                            className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-primary rounded-lg text-sm outline-none transition-colors"
                                                        />
                                                    );
                                                })()
                                            ) : (
                                                <div className="space-y-2 min-w-[240px]">
                                                    {getMonths(item.breakup || "").length === 0 ? (
                                                        <span className="text-xs text-zinc-400">Select month(s) first</span>
                                                    ) : (
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={31}
                                                            value={getSharedCollectionDay(getMonths(item.breakup || ""), item.collection_day_by_month || {})}
                                                            onChange={(e) => setSharedCollectionDayForItem(item.id, e.target.value)}
                                                            title="Shared Collection Day"
                                                            placeholder="DD"
                                                            className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-primary rounded-lg text-sm outline-none transition-colors"
                                                        />
                                                    )}
                                                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Applied to all selected months</p>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-3">
                                            <select
                                                value={item.freq || "MONTHLY"}
                                                onChange={(e) => handleFieldChange(item.id, "freq", e.target.value)}
                                                title="Frequency"
                                                className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-primary rounded-lg text-sm outline-none transition-colors"
                                            >
                                                <option value="MONTHLY">Monthly</option>
                                                <option value="ONE_TIME">One Time</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <button
                                                onClick={() => setDeleteId(item.id)}
                                                className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all active:scale-90"
                                                title="Delete Fee Type"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add Fee Type Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                        <form onSubmit={handleAddFeeType}>
                            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
                                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Add New Fee Type</h2>
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-400 p-1"
                                >
                                    <span className="sr-only">Close</span>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Description</label>
                                    <input
                                        type="text"
                                        required
                                        value={newFeeType.description}
                                        onChange={(e) => setNewFeeType({ ...newFeeType, description: e.target.value })}
                                        className="w-full px-4 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-sm outline-none transition-all"
                                        placeholder="e.g. Tuition Fee"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Frequency</label>
                                    <select
                                        required
                                        value={newFeeType.freq}
                                        title="New Fee Type Frequency"
                                        onChange={(e) => {
                                            const nextFreq = e.target.value;
                                            const nextMonths = nextFreq === "MONTHLY" ? ACADEMIC_MONTHS : ["August"];
                                            const nextDateMap: Record<string, string> = {};
                                            const sharedCurrentDay = getSharedCollectionDay(
                                                getMonths(newFeeType.breakup || ""),
                                                newFeeType.collection_day_by_month || {},
                                            );
                                            for (const month of nextMonths) {
                                                if (nextFreq === "MONTHLY" && sharedCurrentDay) {
                                                    nextDateMap[month] = sharedCurrentDay;
                                                } else if (newFeeType.collection_day_by_month?.[month]) {
                                                    nextDateMap[month] = newFeeType.collection_day_by_month[month];
                                                }
                                            }
                                            setNewFeeType({
                                                ...newFeeType,
                                                freq: nextFreq,
                                                breakup: nextMonths.join(", "),
                                                collection_day_by_month: nextDateMap,
                                            });
                                        }}
                                        className="w-full px-4 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-sm outline-none transition-all"
                                    >
                                        <option value="MONTHLY">Monthly</option>
                                        <option value="ONE_TIME">One Time</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Priority Order</label>
                                    <input
                                        type="number"
                                        required
                                        value={newFeeType.priority_order}
                                        onChange={(e) => setNewFeeType({ ...newFeeType, priority_order: parseInt(e.target.value) || 0 })}
                                        className="w-full px-4 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-sm outline-none transition-all"
                                        placeholder="Order (e.g. 1, 2, 3)"
                                    />
                                </div>
                                <div className="pt-2">
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Breakup (Applicable Months)</label>
                                    {newFeeType.freq === "ONE_TIME" ? (
                                        <select
                                            value={newFeeType.breakup}
                                            title="New Fee Type Breakup Month"
                                            onChange={(e) => {
                                                const selectedMonth = e.target.value;
                                                const nextDateMap: Record<string, string> = {};
                                                if (selectedMonth && newFeeType.collection_day_by_month?.[selectedMonth]) {
                                                    nextDateMap[selectedMonth] = newFeeType.collection_day_by_month[selectedMonth];
                                                }
                                                setNewFeeType({
                                                    ...newFeeType,
                                                    breakup: selectedMonth,
                                                    collection_day_by_month: nextDateMap,
                                                });
                                            }}
                                            className="w-full px-4 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-sm outline-none transition-all"
                                        >
                                            <option value="">Select Month</option>
                                            {ACADEMIC_MONTHS.map(month => (
                                                <option key={month} value={month}>{month}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="flex flex-wrap gap-2 pt-1 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-900/50">
                                            {ACADEMIC_MONTHS.map((month) => {
                                                const currentBreakups = Array.isArray(newFeeType.breakup)
                                                    ? newFeeType.breakup
                                                    : typeof newFeeType.breakup === 'string'
                                                        ? newFeeType.breakup.split(',').map((s: string) => s.trim()).filter(Boolean)
                                                        : [];
                                                const isSelected = currentBreakups.includes(month);
                                                return (
                                                    <div
                                                        key={month}
                                                        onClick={() => {
                                                            const newBreakups = isSelected
                                                                ? currentBreakups.filter((m: string) => m !== month)
                                                                : [...currentBreakups, month];
                                                            const nextDateMap: Record<string, string> = {};
                                                            const sharedCurrentDay = getSharedCollectionDay(
                                                                currentBreakups,
                                                                newFeeType.collection_day_by_month || {},
                                                            );
                                                            for (const selectedMonth of newBreakups) {
                                                                if (newFeeType.freq === "MONTHLY" && sharedCurrentDay) {
                                                                    nextDateMap[selectedMonth] = sharedCurrentDay;
                                                                } else if (newFeeType.collection_day_by_month?.[selectedMonth]) {
                                                                    nextDateMap[selectedMonth] = newFeeType.collection_day_by_month[selectedMonth];
                                                                }
                                                            }
                                                            setNewFeeType({
                                                                ...newFeeType,
                                                                breakup: newBreakups.join(", "),
                                                                collection_day_by_month: nextDateMap,
                                                            });
                                                        }}
                                                        className={`px-3 py-1.5 text-xs font-medium rounded-full cursor-pointer transition-colors border select-none ${isSelected ? 'bg-zinc-800 border-zinc-800 text-white' : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900'
                                                            }`}
                                                    >
                                                        {month}
                                                    </div>
                                                );
                                            })}
                                            <div className="w-full flex gap-3 pt-2 mt-1 border-t border-zinc-200 dark:border-zinc-800">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const sharedCurrentDay = getSharedCollectionDay(
                                                            getMonths(newFeeType.breakup || ""),
                                                            newFeeType.collection_day_by_month || {},
                                                        );
                                                        const nextMap: Record<string, string> = {};
                                                        if (sharedCurrentDay) {
                                                            for (const month of ACADEMIC_MONTHS) {
                                                                nextMap[month] = sharedCurrentDay;
                                                            }
                                                        }
                                                        setNewFeeType({
                                                            ...newFeeType,
                                                            breakup: ACADEMIC_MONTHS.join(", "),
                                                            collection_day_by_month: nextMap,
                                                        });
                                                    }}
                                                    className="text-xs text-primary hover:text-primary/80 font-medium"
                                                >
                                                    Select All
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setNewFeeType({ ...newFeeType, breakup: "", collection_day_by_month: {} })}
                                                    className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:text-zinc-300 font-medium"
                                                >
                                                    Clear All
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-2">
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Collection Day (Required Per Month)</label>
                                    <div className="space-y-2 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-900/50">
                                        {getMonths(newFeeType.breakup).length === 0 ? (
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Select month(s) first.</p>
                                        ) : newFeeType.freq === "MONTHLY" ? (
                                            <div className="space-y-2">
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={31}
                                                    value={getSharedCollectionDay(getMonths(newFeeType.breakup), newFeeType.collection_day_by_month || {})}
                                                    onChange={(e) => setSharedCollectionDayForNewFeeType(e.target.value)}
                                                    title="New Fee Type Shared Collection Day"
                                                    placeholder="DD"
                                                    className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-sm outline-none transition-all"
                                                />
                                                <p className="text-xs text-zinc-500 dark:text-zinc-400">Applied to all selected months</p>
                                            </div>
                                        ) : (
                                            getMonths(newFeeType.breakup).map((month) => (
                                                <div key={`new-${month}`} className="flex items-center gap-3">
                                                    <span className="w-20 text-xs font-medium text-zinc-600 dark:text-zinc-300">{month}</span>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={31}
                                                        value={newFeeType.collection_day_by_month?.[month] || ""}
                                                        onChange={(e) => setCollectionDayForNewFeeType(month, e.target.value)}
                                                        title={`New Fee Type Collection Day ${month}`}
                                                        placeholder="DD"
                                                        className="flex-1 px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-sm outline-none transition-all"
                                                    />
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 py-4 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50 dark:bg-zinc-900/50">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:text-zinc-100 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isAdding}
                                    className="inline-flex items-center justify-center px-6 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-xl shadow-sm shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isAdding ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding...</> : 'Add Fee Type'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteId !== null && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-sm">
                    <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 text-center">
                            <div className="h-14 w-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trash2 className="h-7 w-7" />
                            </div>
                            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Delete Fee Type?</h2>
                            <p className="text-zinc-500 dark:text-zinc-400 mt-2">
                                This action cannot be undone. All associated student fees and class schedules for this fee type will be removed.
                            </p>
                        </div>
                        <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 flex gap-3">
                            <button
                                onClick={() => setDeleteId(null)}
                                className="flex-1 py-2.5 font-medium text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="flex-1 py-2.5 font-medium text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-all active:scale-95 shadow-sm shadow-rose-200 disabled:opacity-50"
                            >
                                {isDeleting ? "Deleting..." : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
