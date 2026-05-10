"use client";

import { useState, useEffect } from "react";
import { Tag, Plus, Pencil, Power, PowerOff, Loader2, AlertCircle, CheckCircle, X } from "lucide-react";
import api from "@/lib/api";

interface DiscountPreset {
    id: number;
    title: string;
    description: string | null;
    is_active: boolean;
    created_at: string;
}

export default function DiscountPresetsPage() {
    const [presets, setPresets] = useState<DiscountPreset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPreset, setEditingPreset] = useState<DiscountPreset | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [form, setForm] = useState({ title: "", description: "", is_active: true });

    const fetchPresets = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data } = await api.get("/v1/discount-presets");
            setPresets(Array.isArray(data?.data) ? data.data : []);
        } catch {
            setError("Failed to load discount presets");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchPresets(); }, []);

    const openCreate = () => {
        setEditingPreset(null);
        setForm({ title: "", description: "", is_active: true });
        setIsModalOpen(true);
    };

    const openEdit = (preset: DiscountPreset) => {
        setEditingPreset(preset);
        setForm({ title: preset.title, description: preset.description ?? "", is_active: preset.is_active });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.title.trim()) { setError("Title is required"); return; }
        setIsSaving(true);
        setError(null);
        try {
            if (editingPreset) {
                await api.patch(`/v1/discount-presets/${editingPreset.id}`, form);
                setSuccess("Discount preset updated");
            } else {
                await api.post("/v1/discount-presets", form);
                setSuccess("Discount preset created");
            }
            setIsModalOpen(false);
            await fetchPresets();
        } catch {
            setError("Failed to save discount preset");
        } finally {
            setIsSaving(false);
        }
    };

    const toggleActive = async (preset: DiscountPreset) => {
        setError(null);
        try {
            await api.patch(`/v1/discount-presets/${preset.id}`, { is_active: !preset.is_active });
            setSuccess(`Preset ${preset.is_active ? "deactivated" : "activated"}`);
            await fetchPresets();
        } catch {
            setError("Failed to update preset status");
        }
    };

    useEffect(() => {
        if (success) { const t = setTimeout(() => setSuccess(null), 3000); return () => clearTimeout(t); }
    }, [success]);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                            <Tag className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Discount Presets</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Manage reusable discount labels for student fee schedules
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Preset
                    </button>
                </div>

                {/* Alerts */}
                {error && (
                    <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {error}
                    </div>
                )}
                {success && (
                    <div className="flex items-center gap-2 p-3 mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        {success}
                    </div>
                )}

                {/* Table */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                        </div>
                    ) : presets.length === 0 ? (
                        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                            <Tag className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            <p className="text-sm">No discount presets yet. Add one above.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Title</th>
                                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Description</th>
                                    <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Status</th>
                                    <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {presets.map((preset) => (
                                    <tr key={preset.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                            {preset.title}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                            {preset.description ?? <span className="italic opacity-50">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                                preset.is_active
                                                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                                    : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                                            }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${preset.is_active ? "bg-green-500" : "bg-gray-400"}`} />
                                                {preset.is_active ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openEdit(preset)}
                                                    className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                                    title="Edit"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => toggleActive(preset)}
                                                    className={`p-1.5 rounded-lg transition-colors ${
                                                        preset.is_active
                                                            ? "text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                            : "text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                                                    }`}
                                                    title={preset.is_active ? "Deactivate" : "Activate"}
                                                >
                                                    {preset.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Info note */}
                <p className="mt-4 text-xs text-gray-400 dark:text-gray-600">
                    Only active presets appear in discount dropdowns. Deactivating a preset does not affect existing discount rows.
                </p>
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
                            <h2 className="font-semibold text-gray-900 dark:text-white">
                                {editingPreset ? "Edit Discount Preset" : "New Discount Preset"}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                <X className="w-4 h-4 text-gray-500" />
                            </button>
                        </div>

                        <div className="px-5 py-4 space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    Title <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                                    placeholder="e.g. Supreme Court COVID-19 Discount"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 uppercase"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    Description
                                </label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="Optional — explains when/why this discount applies"
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                />
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.is_active}
                                    onChange={(e) => setForm(f => ({ ...f, is_active: e.target.checked }))}
                                    className="w-4 h-4 rounded accent-purple-600"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">Active (visible in discount dropdowns)</span>
                            </label>
                        </div>

                        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-800">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                                {editingPreset ? "Save Changes" : "Create Preset"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
