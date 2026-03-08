"use client";

import { useState, useEffect } from "react";
import { BookOpen, Save, Loader2, RefreshCw, AlertCircle, CheckCircle, Plus, Trash2, X } from "lucide-react";
import api from "@/lib/api";

interface ClassItem {
    id: string | number;
    description: string;
    class_code: string;
    academic_system: string;
    // adding index signature to allow access by dynamic keys
    [key: string]: any;
}

export default function ClassesPage() {
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [originalClasses, setOriginalClasses] = useState<ClassItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // State for Add Modal (using a simple inline form approach if modal isn't preferred, or we can just build a dialogue overlay)
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [newClass, setNewClass] = useState({ description: "", class_code: "", academic_system: "" });

    // State for Delete Confirmation
    const [deleteId, setDeleteId] = useState<string | number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchClasses = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data } = await api.get("/v1/classes");

            const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];

            const mappedItems = items.map((item: any) => ({
                id: item.id || Math.random().toString(36).substring(7),
                description: item.description || item.class_name || item.name || "",
                class_code: item.class_code || "",
                academic_system: item.academic_system || "",
                ...item
            }));

            setClasses(mappedItems);
            setOriginalClasses(JSON.parse(JSON.stringify(mappedItems)));
        } catch (err: any) {
            console.error("Error fetching data:", err);
            setError("Failed to load data. Please try again.");
            setClasses([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchClasses();
    }, []);

    const handleFieldChange = (id: string | number, field: keyof ClassItem, newValue: string) => {
        setClasses(prev =>
            prev.map(c =>
                c.id === id ? { ...c, [field]: newValue } : c
            )
        );
        if (successMessage) setSuccessMessage(null);
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);

        const modifiedClasses = classes.filter(updatedClass => {
            const original = originalClasses.find(o => o.id === updatedClass.id);
            return original && (
                original.description !== updatedClass.description ||
                original.class_code !== updatedClass.class_code ||
                original.academic_system !== updatedClass.academic_system
            );
        });

        if (modifiedClasses.length === 0) {
            setSuccessMessage("No changes to save.");
            setIsSaving(false);
            return;
        }

        try {
            const payload = modifiedClasses.map(c => ({
                id: c.id,
                description: c.description,
                class_code: c.class_code,
                academic_system: c.academic_system
            }));

            await api.patch("/v1/classes/bulk", { items: payload });

            setSuccessMessage(`Successfully updated ${modifiedClasses.length} records.`);
            setOriginalClasses(JSON.parse(JSON.stringify(classes)));
        } catch (err: any) {
            console.error("Error saving data:", err);
            const errMsg = err.response?.data?.message || err.response?.data?.error || "Failed to save changes. Please try again.";
            setError(Array.isArray(errMsg) ? errMsg.join("; ") : errMsg);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddClass = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsAdding(true);
        setError(null);
        setSuccessMessage(null);

        try {
            // Attempting to post to /v1/classes (or /classes if the api adds the prefix)
            await api.post("/v1/classes", newClass);
            setSuccessMessage("Class added successfully.");
            setIsAddModalOpen(false);
            setNewClass({ description: "", class_code: "", academic_system: "" });
            fetchClasses(); // Refresh list to get the actual ID
        } catch (err: any) {
            console.error("Error adding class:", err);
            const errMsg = err.response?.data?.message || err.response?.data?.error || "Failed to add class.";
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
            await api.delete(`/v1/classes/${deleteId}`);
            setSuccessMessage("Class deleted successfully.");
            setDeleteId(null);
            fetchClasses();
        } catch (err: any) {
            console.error("Error deleting class:", err);
            const errMsg = err.response?.data?.message || err.response?.data?.error || "Failed to delete class.";
            setError(Array.isArray(errMsg) ? errMsg.join("; ") : errMsg);
        } finally {
            setIsDeleting(false);
        }
    };

    const hasChanges = JSON.stringify(classes) !== JSON.stringify(originalClasses);

    return (
        <div className="space-y-6 relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Classes</h1>
                    <p className="text-zinc-500 mt-1">Manage academic classes and grade levels.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="inline-flex items-center justify-center px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium rounded-lg shadow-sm transition-all active:scale-95"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Class
                    </button>
                    <button
                        onClick={fetchClasses}
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
                ) : classes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
                            <BookOpen className="text-zinc-400 h-6 w-6" />
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
                                    <th className="px-6 py-4 font-semibold">Class Code</th>
                                    <th className="px-6 py-4 font-semibold">Academic System</th>
                                    <th className="px-6 py-4 font-semibold w-24 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {classes.map((item) => (
                                    <tr key={item.id} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                                        <td className="px-6 py-3 font-medium text-zinc-500">
                                            {item.id}
                                        </td>
                                        <td className="px-6 py-3 min-w-[200px]">
                                            <input
                                                type="text"
                                                value={item.description || ""}
                                                onChange={(e) => handleFieldChange(item.id, "description", e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-zinc-200 focus:border-primary rounded-lg text-sm outline-none transition-colors"
                                                placeholder="Description..."
                                            />
                                        </td>
                                        <td className="px-6 py-3 min-w-[150px]">
                                            <input
                                                type="text"
                                                value={item.class_code || ""}
                                                onChange={(e) => handleFieldChange(item.id, "class_code", e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-zinc-200 focus:border-primary rounded-lg text-sm outline-none transition-colors uppercase"
                                                placeholder="Code (e.g. IX)"
                                            />
                                        </td>
                                        <td className="px-6 py-3 min-w-[200px]">
                                            <input
                                                type="text"
                                                value={item.academic_system || ""}
                                                onChange={(e) => handleFieldChange(item.id, "academic_system", e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-zinc-200 focus:border-primary rounded-lg text-sm outline-none transition-colors"
                                                placeholder="System (e.g. Secondary)"
                                            />
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <button
                                                onClick={() => setDeleteId(item.id)}
                                                className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all active:scale-90"
                                                title="Delete Class"
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

            {/* Add Class Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                        <form onSubmit={handleAddClass}>
                            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                                <h2 className="text-lg font-semibold text-zinc-900">Add New Class</h2>
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
                                        value={newClass.description}
                                        onChange={(e) => setNewClass({ ...newClass, description: e.target.value })}
                                        className="w-full px-4 py-2 bg-white border border-zinc-300 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-sm outline-none transition-all"
                                        placeholder="e.g. Grade 1"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1">Class Code</label>
                                        <input
                                            type="text"
                                            required
                                            value={newClass.class_code}
                                            onChange={(e) => setNewClass({ ...newClass, class_code: e.target.value })}
                                            className="w-full px-4 py-2 bg-white border border-zinc-300 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-sm outline-none transition-all uppercase"
                                            placeholder="e.g. GR1"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 mb-1">Academic System</label>
                                        <input
                                            type="text"
                                            required
                                            value={newClass.academic_system}
                                            onChange={(e) => setNewClass({ ...newClass, academic_system: e.target.value })}
                                            className="w-full px-4 py-2 bg-white border border-zinc-300 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-sm outline-none transition-all"
                                            placeholder="e.g. Primary"
                                        />
                                    </div>
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
                                    {isAdding ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding...</> : 'Add Class'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteId !== null && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 text-center">
                            <div className="h-14 w-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trash2 className="h-7 w-7" />
                            </div>
                            <h2 className="text-lg font-bold text-zinc-900">Delete Class?</h2>
                            <p className="text-zinc-500 mt-2">
                                This action cannot be undone. The system will prevent deletion if students or sections are still assigned to this class.
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
