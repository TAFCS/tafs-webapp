"use client";

import { useState, useEffect } from "react";
import { Banknote, Save, Loader2, RefreshCw, AlertCircle, CheckCircle, Plus } from "lucide-react";
import api from "@/lib/api";

interface FeeTypeItem {
    id: string | number;
    description: string;
    freq: "MONTHLY" | "ONE_TIME" | "";
    // adding index signature to allow access by dynamic keys
    [key: string]: any;
}

export default function FeeTypesPage() {
    const [feeTypes, setFeeTypes] = useState<FeeTypeItem[]>([]);
    const [originalFeeTypes, setOriginalFeeTypes] = useState<FeeTypeItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // State for Add Modal
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [newFeeType, setNewFeeType] = useState({ description: "", freq: "MONTHLY", breakup: "" });

    const fetchFeeTypes = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data } = await api.get("/v1/fee-types");

            // Extract the array, defaulting to an empty array if data.data is undefined
            const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];

            // Map the items to ensure they at least have id, description, freq
            const mappedItems = items.map((item: any) => ({
                id: item.id || Math.random().toString(36).substring(7),
                description: item.description || item.name || "",
                freq: item.freq || "MONTHLY",
                // Handle the array from backend, converting to comma separated string for easy editing
                breakup: Array.isArray(item.breakup) ? item.breakup.join(", ") : "",
                ...item
            }));

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
                original.breakup !== updatedItem.breakup
            );
        });

        if (modifiedFeeTypes.length === 0) {
            setSuccessMessage("No changes to save.");
            setIsSaving(false);
            return;
        }

        try {
            const payload = modifiedFeeTypes.map(item => ({
                id: item.id,
                description: item.description,
                freq: item.freq,
                // Split string by commas, trim whitespace, and filter out empties to reconstruct an array
                breakup: item.breakup ? item.breakup.split(',').map((s: string) => s.trim()).filter(Boolean) : null
            }));

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

        try {
            await api.post("/v1/fee-types", {
                ...newFeeType,
                // Add breakup parsing for new item
                breakup: newFeeType.breakup ? newFeeType.breakup.split(',').map((s: string) => s.trim()).filter(Boolean) : null
            });
            setSuccessMessage("Fee type added successfully.");
            setIsAddModalOpen(false);
            setNewFeeType({ description: "", freq: "MONTHLY", breakup: "" });
            fetchFeeTypes(); // Refresh list to get the actual database ID
        } catch (err: any) {
            console.error("Error adding fee type:", err);
            const errMsg = err.response?.data?.message || err.response?.data?.error || "Failed to add fee type.";
            setError(Array.isArray(errMsg) ? errMsg.join("; ") : errMsg);
        } finally {
            setIsAdding(false);
        }
    };

    const hasChanges = JSON.stringify(feeTypes) !== JSON.stringify(originalFeeTypes);

    return (
        <div className="space-y-6 relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Fee Types</h1>
                    <p className="text-zinc-500 mt-1">Manage the specific types and frequencies of fees.</p>
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
                        className="inline-flex items-center justify-center px-4 py-2 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-sm font-medium rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
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

            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                            <Loader2 className="text-primary h-6 w-6 animate-spin" />
                        </div>
                        <h3 className="text-sm font-medium text-zinc-900">Loading data...</h3>
                    </div>
                ) : feeTypes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
                            <Banknote className="text-zinc-400 h-6 w-6" />
                        </div>
                        <h3 className="text-sm font-medium text-zinc-900">No data found</h3>
                        <p className="mt-1 text-sm text-zinc-500">There are currently no records to display.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left whitespace-nowrap">
                            <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 border-b border-zinc-200">
                                <tr>
                                    <th className="px-6 py-4 font-semibold w-24">ID</th>
                                    <th className="px-6 py-4 font-semibold">Description</th>
                                    <th className="px-6 py-4 font-semibold w-64">Breakup (Months)</th>
                                    <th className="px-6 py-4 font-semibold w-48">Frequency</th>
                                </tr>
                            </thead>
                            <tbody>
                                {feeTypes.map((item) => (
                                    <tr key={item.id} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                                        <td className="px-6 py-3 font-medium text-zinc-500">
                                            {item.id}
                                        </td>
                                        <td className="px-6 py-3">
                                            <input
                                                type="text"
                                                value={item.description || ""}
                                                onChange={(e) => handleFieldChange(item.id, "description", e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-zinc-200 focus:border-primary rounded-lg text-sm outline-none transition-colors"
                                                placeholder="Enter fee description..."
                                            />
                                        </td>
                                        <td className="px-6 py-3">
                                            <input
                                                type="text"
                                                value={item.breakup || ""}
                                                onChange={(e) => handleFieldChange(item.id, "breakup", e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-zinc-200 focus:border-primary rounded-lg text-sm outline-none transition-colors"
                                                placeholder="e.g. August, September"
                                            />
                                        </td>
                                        <td className="px-6 py-3">
                                            <select
                                                value={item.freq || "MONTHLY"}
                                                onChange={(e) => handleFieldChange(item.id, "freq", e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-zinc-200 focus:border-primary rounded-lg text-sm outline-none transition-colors"
                                            >
                                                <option value="MONTHLY">Monthly</option>
                                                <option value="ONE_TIME">One Time</option>
                                            </select>
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
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                        <form onSubmit={handleAddFeeType}>
                            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                                <h2 className="text-lg font-semibold text-zinc-900">Add New Fee Type</h2>
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="text-zinc-400 hover:text-zinc-600 p-1"
                                >
                                    <span className="sr-only">Close</span>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Description</label>
                                    <input
                                        type="text"
                                        required
                                        value={newFeeType.description}
                                        onChange={(e) => setNewFeeType({ ...newFeeType, description: e.target.value })}
                                        className="w-full px-4 py-2 bg-white border border-zinc-300 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-sm outline-none transition-all"
                                        placeholder="e.g. Tuition Fee"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 mb-1">Frequency</label>
                                    <select
                                        required
                                        value={newFeeType.freq}
                                        onChange={(e) => setNewFeeType({ ...newFeeType, freq: e.target.value })}
                                        className="w-full px-4 py-2 bg-white border border-zinc-300 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-sm outline-none transition-all"
                                    >
                                        <option value="MONTHLY">Monthly</option>
                                        <option value="ONE_TIME">One Time</option>
                                    </select>
                                </div>
                            </div>

                            <div className="px-6 py-4 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-zinc-700 hover:text-zinc-900 transition-colors"
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
        </div>
    );
}
