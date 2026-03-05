"use client";

import { useState, useEffect } from "react";
import { Receipt, Save, Loader2, RefreshCw, AlertCircle, CheckCircle, Plus, Trash2 } from "lucide-react";
import api from "@/lib/api";

interface FeeScheduleItem {
    id: number | string;
    class_id: number | string;
    fee_id: number | string;
    amount: number | string;
    [key: string]: any;
}

export default function ClasswiseFeesSchedulePage() {
    const [schedules, setSchedules] = useState<FeeScheduleItem[]>([]);
    const [originalSchedules, setOriginalSchedules] = useState<FeeScheduleItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const fetchSchedules = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // For now, using mock data as requested (no backend touch)
            // In a real scenario, this would be api.get("/v1/class-fee-schedule")
            const response = await api.get("/v1/class-fee-schedule").catch(() => ({ data: { data: [] } }));

            const items = Array.isArray(response.data?.data) ? response.data.data : [];

            // If empty, provide some sample data for the user to see
            const displayItems = items.length > 0 ? items : [
                { id: 1, class_id: 1, fee_id: 1, amount: "5000.00" },
                { id: 2, class_id: 1, fee_id: 2, amount: "1200.00" },
                { id: 3, class_id: 2, fee_id: 1, amount: "5500.00" },
            ];

            setSchedules(displayItems);
            setOriginalSchedules(JSON.parse(JSON.stringify(displayItems)));
        } catch (err: any) {
            console.error("Error fetching data:", err);
            setError("Failed to load data. Please try again.");
            setSchedules([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSchedules();
    }, []);

    const handleChange = (id: number | string, field: keyof FeeScheduleItem, value: any) => {
        setSchedules(prev =>
            prev.map(item =>
                item.id === id ? { ...item, [field]: value } : item
            )
        );
        if (successMessage) setSuccessMessage(null);
    };

    const handleAddRow = () => {
        const newId = `new-${Date.now()}`;
        const newItem: FeeScheduleItem = {
            id: newId,
            class_id: "",
            fee_id: "",
            amount: "0.00"
        };
        setSchedules(prev => [...prev, newItem]);
    };

    const handleDeleteRow = (id: number | string) => {
        setSchedules(prev => prev.filter(item => item.id !== id));
        if (successMessage) setSuccessMessage(null);
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);

        // Logic for identifying changed/new/deleted items would go here
        // Since we're not touching backend yet, we'll just simulate success
        try {
            await new Promise(resolve => setTimeout(resolve, 800)); // Simulate API call

            setSuccessMessage("Changes saved locally (Backend integration pending).");
            setOriginalSchedules(JSON.parse(JSON.stringify(schedules)));
        } catch (err: any) {
            setError("Failed to save changes.");
        } finally {
            setIsSaving(false);
        }
    };

    const hasChanges = JSON.stringify(schedules) !== JSON.stringify(originalSchedules);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Classwise Fee Schedule</h1>
                    <p className="text-zinc-500 mt-1">Define and manage fee amounts for different classes.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleAddRow}
                        className="inline-flex items-center justify-center px-4 py-2 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-sm font-medium rounded-lg shadow-sm transition-all active:scale-95"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add New
                    </button>
                    <button
                        onClick={fetchSchedules}
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
                        <h3 className="text-sm font-medium text-zinc-900">Loading schedules...</h3>
                    </div>
                ) : schedules.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
                            <Receipt className="text-zinc-400 h-6 w-6" />
                        </div>
                        <h3 className="text-sm font-medium text-zinc-900">No schedules found</h3>
                        <p className="mt-1 text-sm text-zinc-500">There are currently no fee schedules defined.</p>
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
                                    <th className="px-6 py-4 font-semibold w-24">ID</th>
                                    <th className="px-6 py-4 font-semibold">Class ID</th>
                                    <th className="px-6 py-4 font-semibold">Fee ID</th>
                                    <th className="px-6 py-4 font-semibold">Amount</th>
                                    <th className="px-6 py-4 font-semibold w-20 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {schedules.map((item) => (
                                    <tr key={item.id} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                                        <td className="px-6 py-3 font-medium text-zinc-500">
                                            {typeof item.id === 'string' && item.id.startsWith('new-') ? (
                                                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium italic">New</span>
                                            ) : (
                                                item.id
                                            )}
                                        </td>
                                        <td className="px-6 py-3">
                                            <input
                                                type="number"
                                                value={item.class_id}
                                                onChange={(e) => handleChange(item.id, "class_id", e.target.value)}
                                                className="w-full max-w-[120px] px-3 py-2 bg-white border border-zinc-200 focus:border-primary rounded-lg text-sm outline-none transition-colors"
                                                placeholder="Class ID"
                                            />
                                        </td>
                                        <td className="px-6 py-3">
                                            <input
                                                type="number"
                                                value={item.fee_id}
                                                onChange={(e) => handleChange(item.id, "fee_id", e.target.value)}
                                                className="w-full max-w-[120px] px-3 py-2 bg-white border border-zinc-200 focus:border-primary rounded-lg text-sm outline-none transition-colors"
                                                placeholder="Fee ID"
                                            />
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="relative max-w-[160px]">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">Rs.</span>
                                                <input
                                                    type="number"
                                                    value={item.amount}
                                                    onChange={(e) => handleChange(item.id, "amount", e.target.value)}
                                                    className="w-full pl-10 pr-3 py-2 bg-white border border-zinc-200 focus:border-primary rounded-lg text-sm outline-none transition-colors"
                                                    placeholder="0.00"
                                                    step="0.01"
                                                />
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            <button
                                                onClick={() => handleDeleteRow(item.id)}
                                                className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete Row"
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

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-sm text-blue-800">
                <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0" />
                <div>
                    <p className="font-medium">Information</p>
                    <p className="text-blue-700/80 mt-0.5">
                        This page is currently working with mock data and local state. Backend integration for class and fee lookups will be implemented in the next phase.
                    </p>
                </div>
            </div>
        </div>
    );
}
