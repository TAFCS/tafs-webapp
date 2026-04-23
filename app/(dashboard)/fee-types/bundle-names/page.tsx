"use client";

import { useState, useEffect } from "react";
import { Package, Save, Loader2, RefreshCw, AlertCircle, CheckCircle, Plus, Trash2, ChevronLeft } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface BundleNameItem {
    id: number;
    name: string;
    description: string | null;
    is_active: boolean;
}

export default function BundleNamesPage() {
    const [bundleNames, setBundleNames] = useState<BundleNameItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // State for Add Modal
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [newBundleName, setNewBundleName] = useState({
        name: "",
        description: "",
    });

    const fetchBundleNames = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data } = await api.get("/v1/fee-types/bundle-names");
            setBundleNames(Array.isArray(data?.data) ? data.data : []);
        } catch (err: any) {
            console.error("Error fetching bundle names:", err);
            setError("Failed to load bundle names. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchBundleNames();
    }, []);

    const handleToggleActive = async (id: number, currentStatus: boolean) => {
        try {
            await api.patch(`/v1/fee-types/bundle-names/${id}`, { is_active: !currentStatus });
            toast.success(`Bundle name ${!currentStatus ? 'activated' : 'deactivated'}`);
            fetchBundleNames();
        } catch (err: any) {
            toast.error("Failed to update status");
        }
    };

    const handleAddBundleName = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newBundleName.name.trim()) return;
        
        setIsAdding(true);
        try {
            await api.post("/v1/fee-types/bundle-names", {
                ...newBundleName,
                name: newBundleName.name.trim().toUpperCase()
            });
            toast.success("Bundle name added successfully");
            setIsAddModalOpen(false);
            setNewBundleName({ name: "", description: "" });
            fetchBundleNames();
        } catch (err: any) {
            const msg = err.response?.data?.message || "Failed to add bundle name";
            toast.error(msg);
        } finally {
            setIsAdding(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to deactivate this bundle name? It will no longer appear in the dropdown for new bundles.")) return;
        
        try {
            await api.delete(`/v1/fee-types/bundle-names/${id}`);
            toast.success("Bundle name deactivated");
            fetchBundleNames();
        } catch (err: any) {
            toast.error("Failed to deactivate bundle name");
        }
    };

    return (
        <div className="space-y-6 relative max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Link href="/fee-types" className="text-zinc-500 hover:text-primary transition-colors flex items-center gap-1 text-sm font-medium">
                            <ChevronLeft className="h-4 w-4" />
                            Back to Fee Types
                        </Link>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Bundle Fee Names</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1 font-medium">Manage the options available for fee bundling.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="inline-flex items-center justify-center px-6 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add New Name
                    </button>
                    <button
                        onClick={fetchBundleNames}
                        disabled={isLoading}
                        className="p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-32 text-center">
                        <Loader2 className="text-primary/20 h-10 w-10 animate-spin mb-4" />
                        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Loading Dictionary...</h3>
                    </div>
                ) : bundleNames.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-center">
                        <div className="h-16 w-16 rounded-3xl bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center mb-6">
                            <Package className="text-zinc-300 h-8 w-8" />
                        </div>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">No names found</h3>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 font-medium">Add some bundle names to get started.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left whitespace-nowrap">
                            <thead className="text-[10px] text-zinc-400 uppercase tracking-[0.2em] bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800">
                                <tr>
                                    <th className="px-8 py-4 font-black">ID</th>
                                    <th className="px-8 py-4 font-black">Bundle Name</th>
                                    <th className="px-8 py-4 font-black">Description</th>
                                    <th className="px-8 py-4 font-black">Status</th>
                                    <th className="px-8 py-4 font-black text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                                {bundleNames.map((item) => (
                                    <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors">
                                        <td className="px-8 py-5 font-mono text-xs text-zinc-400">
                                            #{item.id}
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{item.name}</span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="text-sm text-zinc-500 font-medium">{item.description || "—"}</span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <button 
                                                onClick={() => handleToggleActive(item.id, item.is_active)}
                                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${
                                                    item.is_active 
                                                    ? "bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100" 
                                                    : "bg-zinc-100 text-zinc-500 border border-zinc-200 hover:bg-zinc-200"
                                                }`}
                                            >
                                                <div className={`h-1.5 w-1.5 rounded-full ${item.is_active ? "bg-emerald-500" : "bg-zinc-400"}`} />
                                                {item.is_active ? "Active" : "Inactive"}
                                            </button>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="p-2 text-zinc-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all active:scale-90"
                                                title="Deactivate"
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

            {/* Add Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-950 rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
                        <form onSubmit={handleAddBundleName}>
                            <div className="px-8 py-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
                                <div>
                                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Add Bundle Name</h2>
                                    <p className="text-xs font-medium text-zinc-500 mt-0.5">Dictionary entry for dropdowns</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors"
                                >
                                    <Trash2 className="h-4 w-4 text-zinc-400 rotate-45" />
                                </button>
                            </div>

                            <div className="p-8 space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-2 ml-1">Display Name</label>
                                    <input
                                        type="text"
                                        required
                                        autoFocus
                                        value={newBundleName.name}
                                        onChange={(e) => setNewBundleName({ ...newBundleName, name: e.target.value.toUpperCase() })}
                                        className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-2xl text-sm font-bold outline-none transition-all uppercase placeholder:normal-case"
                                        placeholder="e.g. SEMI-ANNUAL BUNDLE"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-2 ml-1">Short Description (Optional)</label>
                                    <textarea
                                        value={newBundleName.description}
                                        onChange={(e) => setNewBundleName({ ...newBundleName, description: e.target.value })}
                                        className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-2xl text-sm font-medium outline-none transition-all min-h-[100px]"
                                        placeholder="Briefly describe what this bundle represents..."
                                    />
                                </div>
                            </div>

                            <div className="px-8 py-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="flex-1 h-12 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm font-bold rounded-2xl hover:bg-zinc-100 transition-all active:scale-95"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isAdding}
                                    className="flex-1 h-12 bg-primary text-white text-sm font-bold rounded-2xl hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isAdding ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Save Entry"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
