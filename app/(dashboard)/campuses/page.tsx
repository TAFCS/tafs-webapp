"use client";

import { useState, useEffect } from "react";
import { Building2, Save, Loader2, RefreshCw, AlertCircle, CheckCircle, Plus, Trash2, X } from "lucide-react";
import { campusesService, Campus } from "@/lib/campuses.service";

export default function CampusesPage() {
    const [campuses, setCampuses] = useState<Campus[]>([]);
    const [originalCampuses, setOriginalCampuses] = useState<Campus[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // State for Add Modal
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [newCampus, setNewCampus] = useState({ campus_code: "", campus_name: "" });

    // State for Delete Confirmation
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchCampuses = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await campusesService.list();
            setCampuses(data);
            setOriginalCampuses(JSON.parse(JSON.stringify(data)));
        } catch (err: any) {
            console.error("Error fetching data:", err);
            setError("Failed to load data. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCampuses();
    }, []);

    const handleChange = (id: number, field: keyof Campus, value: string) => {
        setCampuses(prev =>
            prev.map(c =>
                c.id === id ? { ...c, [field]: value } : c
            )
        );
        if (successMessage) setSuccessMessage(null);
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);

        const modifiedCampuses = campuses.filter(updated => {
            const original = originalCampuses.find(o => o.id === updated.id);
            return original && (original.campus_code !== updated.campus_code || original.campus_name !== updated.campus_name);
        });

        if (modifiedCampuses.length === 0) {
            setSuccessMessage("No changes to save.");
            setIsSaving(false);
            return;
        }

        try {
            await campusesService.bulkUpdate({
                items: modifiedCampuses.map(c => ({
                    id: c.id,
                    campus_code: c.campus_code,
                    campus_name: c.campus_name
                }))
            });

            setSuccessMessage(`Successfully updated ${modifiedCampuses.length} records.`);
            setOriginalCampuses(JSON.parse(JSON.stringify(campuses)));
        } catch (err: any) {
            console.error("Error saving data:", err);
            const errMsg = err.response?.data?.message || "Failed to save changes.";
            setError(Array.isArray(errMsg) ? errMsg.join("; ") : errMsg);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddCampus = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsAdding(true);
        setError(null);
        try {
            await campusesService.create(newCampus);
            setSuccessMessage("Campus added successfully.");
            setIsAddModalOpen(false);
            setNewCampus({ campus_code: "", campus_name: "" });
            fetchCampuses();
        } catch (err: any) {
            const errMsg = err.response?.data?.message || "Failed to add campus.";
            setError(Array.isArray(errMsg) ? errMsg.join("; ") : errMsg);
        } finally {
            setIsAdding(false);
        }
    };

    const handleDelete = async () => {
        if (deleteId === null) return;
        setIsDeleting(true);
        setError(null);
        try {
            await campusesService.delete(deleteId);
            setSuccessMessage("Campus deleted successfully.");
            setDeleteId(null);
            fetchCampuses();
        } catch (err: any) {
            const errMsg = err.response?.data?.message || "Failed to delete campus.";
            setError(Array.isArray(errMsg) ? errMsg.join("; ") : errMsg);
        } finally {
            setIsDeleting(false);
        }
    };

    const hasChanges = JSON.stringify(campuses) !== JSON.stringify(originalCampuses);

    return (
        <div className="space-y-6 relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Campuses</h1>
                    <p className="text-zinc-500 mt-1">Manage school branches and campus codes.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="inline-flex items-center justify-center px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-medium rounded-lg shadow-sm transition-all active:scale-95"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Campus
                    </button>
                    <button
                        onClick={fetchCampuses}
                        disabled={isLoading || isSaving}
                        className="inline-flex items-center justify-center px-4 py-2 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-medium rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isLoading || isSaving || !hasChanges}
                        className="inline-flex items-center justify-center px-4 py-2 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg shadow-sm shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-xs animate-in fade-in duration-300">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold">Error</p>
                        <p className="text-red-700 mt-0.5">{error}</p>
                    </div>
                </div>
            )}

            {successMessage && (
                <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-xs animate-in fade-in duration-300">
                    <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold">Success</p>
                        <p className="text-emerald-700 mt-0.5">{successMessage}</p>
                    </div>
                </div>
            )}

            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden text-sm">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <Loader2 className="text-primary h-8 w-8 animate-spin mb-4" />
                        <h3 className="font-medium text-zinc-900">Loading campuses...</h3>
                    </div>
                ) : campuses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <Building2 className="text-zinc-400 h-10 w-10 mb-4" />
                        <h3 className="font-medium text-zinc-900">No campuses found</h3>
                        <p className="mt-1 text-zinc-500">Add a new campus to get started.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left whitespace-nowrap">
                            <thead className="text-[11px] text-zinc-500 uppercase bg-zinc-50 border-b border-zinc-200 font-bold tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 w-20">ID</th>
                                    <th className="px-6 py-4 w-40">Code</th>
                                    <th className="px-6 py-4">Campus Name</th>
                                    <th className="px-6 py-4 w-20 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {campuses.map((item) => (
                                    <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors group">
                                        <td className="px-6 py-3 font-mono text-zinc-400">
                                            #{item.id}
                                        </td>
                                        <td className="px-6 py-3">
                                            <input
                                                type="text"
                                                value={item.campus_code}
                                                maxLength={10}
                                                onChange={(e) => handleChange(item.id, 'campus_code', e.target.value.toUpperCase())}
                                                className="w-full px-3 py-1.5 bg-white border border-zinc-200 focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-lg outline-none transition-all uppercase font-medium"
                                            />
                                        </td>
                                        <td className="px-6 py-3">
                                            <input
                                                type="text"
                                                value={item.campus_name}
                                                onChange={(e) => handleChange(item.id, 'campus_name', e.target.value)}
                                                className="w-full px-3 py-1.5 bg-white border border-zinc-200 focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-lg outline-none transition-all font-medium text-zinc-900"
                                            />
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <button
                                                onClick={() => setDeleteId(item.id)}
                                                className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all active:scale-90"
                                                title="Delete Campus"
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <form onSubmit={handleAddCampus}>
                            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                                <h2 className="text-lg font-semibold text-zinc-900">Add New Campus</h2>
                                <button type="button" onClick={() => setIsAddModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 transition-colors">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block font-medium text-zinc-700 mb-1.5">Campus Code</label>
                                    <input
                                        type="text"
                                        required
                                        maxLength={10}
                                        value={newCampus.campus_code}
                                        onChange={(e) => setNewCampus({ ...newCampus, campus_code: e.target.value.toUpperCase() })}
                                        className="w-full px-4 py-2 border border-zinc-200 focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl outline-none transition-all uppercase"
                                        placeholder="e.g. GSH"
                                    />
                                </div>
                                <div>
                                    <label className="block font-medium text-zinc-700 mb-1.5">Campus Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={newCampus.campus_name}
                                        onChange={(e) => setNewCampus({ ...newCampus, campus_name: e.target.value })}
                                        className="w-full px-4 py-2 border border-zinc-200 focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl outline-none transition-all"
                                        placeholder="e.g. Gulshan Campus"
                                    />
                                </div>
                            </div>
                            <div className="px-6 py-4 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50/50">
                                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 font-medium text-zinc-600 hover:text-zinc-900 transition-colors">Cancel</button>
                                <button
                                    type="submit"
                                    disabled={isAdding}
                                    className="px-6 py-2 bg-zinc-900 text-white font-medium rounded-xl hover:bg-zinc-800 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isAdding ? "Adding..." : "Add Campus"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {deleteId !== null && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 text-center">
                            <div className="h-14 w-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trash2 className="h-7 w-7" />
                            </div>
                            <h2 className="text-lg font-bold text-zinc-900">Delete Campus?</h2>
                            <p className="text-zinc-500 mt-2">
                                This action cannot be undone. The system will prevent deletion if students or users are still assigned to this campus.
                            </p>
                        </div>
                        <div className="px-6 py-4 bg-zinc-50 flex gap-3">
                            <button
                                onClick={() => setDeleteId(null)}
                                className="flex-1 py-2.5 font-medium text-zinc-600 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-all"
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
