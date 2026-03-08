"use client";

import React, { useState, useEffect } from "react";
import { Building2, Save, Loader2, RefreshCw, AlertCircle, CheckCircle, Plus, Trash2, X, ChevronDown, ChevronRight, GraduationCap, ToggleLeft, ToggleRight, LayoutGrid } from "lucide-react";
import { campusesService, Campus, CampusClassInfo, SectionInfo } from "@/lib/campuses.service";

export default function CampusesPage() {
    const [campuses, setCampuses] = useState<Campus[]>([]);
    const [originalCampuses, setOriginalCampuses] = useState<Campus[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // State for Expandable Rows
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    const [classOptions, setClassOptions] = useState<CampusClassInfo[]>([]);
    const [sectionOptions, setSectionOptions] = useState<SectionInfo[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<Record<number, string>>({});
    const [selectedSectionId, setSelectedSectionId] = useState<Record<string, string>>({}); // key: campusId-classId

    // State for Add Modal
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [isAddingSection, setIsAddingSection] = useState<Record<string, boolean>>({});
    const [newCampus, setNewCampus] = useState({ campus_code: "", campus_name: "" });

    // State for Delete Confirmation
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchCampuses = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [data, cOptions, sOptions] = await Promise.all([
                campusesService.list(),
                campusesService.listAllClasses(),
                campusesService.listAllSections()
            ]);
            setCampuses(data);
            setOriginalCampuses(JSON.parse(JSON.stringify(data)));
            setClassOptions(cOptions);
            setSectionOptions(sOptions);
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

    const toggleRow = (id: number) => {
        const next = new Set(expandedRows);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedRows(next);
    };

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

        // Filter campuses that are completely new (no ID) or have modified basic fields
        const itemsToSave = campuses.map(updated => {
            const original = originalCampuses.find(o => o.id === updated.id);
            const isModified = !original || original.campus_code !== updated.campus_code || original.campus_name !== updated.campus_name;

            if (isModified) {
                return {
                    id: updated.id > 0 ? updated.id : undefined,
                    campus_code: updated.campus_code,
                    campus_name: updated.campus_name
                };
            }
            return null;
        }).filter(Boolean) as any[];

        if (itemsToSave.length === 0) {
            setSuccessMessage("No changes to save.");
            setIsSaving(false);
            return;
        }

        try {
            await campusesService.bulkUpdate({ items: itemsToSave });
            setSuccessMessage(`Successfully saved ${itemsToSave.length} records.`);
            await fetchCampuses();
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

    // --- Class Management Handlers ---

    const handleAddClass = async (campusId: number) => {
        const classId = parseInt(selectedClassId[campusId]);
        if (!classId) return;

        try {
            await campusesService.addClassToCampus(campusId, classId);
            setSuccessMessage("Class added to campus.");
            fetchCampuses();
            setSelectedClassId(prev => ({ ...prev, [campusId]: "" }));
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to add class.");
        }
    };

    const handleToggleClassStatus = async (campusId: number, classId: number, currentStatus: boolean) => {
        try {
            await campusesService.updateCampusClass(campusId, classId, !currentStatus);
            fetchCampuses();
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to toggle status.");
        }
    };

    const handleRemoveClass = async (campusId: number, classId: number) => {
        try {
            await campusesService.removeClassFromCampus(campusId, classId);
            setSuccessMessage("Class removed from campus.");
            fetchCampuses();
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to remove class.");
        }
    };

    // --- Section Management Handlers ---

    const handleAddSection = async (campusId: number, classId: number) => {
        const comboKey = `${campusId}-${classId}`;
        const sectionId = parseInt(selectedSectionId[comboKey]);
        if (!sectionId) return;

        setIsAddingSection(prev => ({ ...prev, [comboKey]: true }));
        try {
            await campusesService.addSectionToCampus(campusId, classId, sectionId);
            setSuccessMessage("Section added.");
            fetchCampuses();
            setSelectedSectionId(prev => ({ ...prev, [comboKey]: "" }));
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to add section.");
        } finally {
            setIsAddingSection(prev => ({ ...prev, [comboKey]: false }));
        }
    };

    const handleToggleSectionStatus = async (campusId: number, classId: number, sectionId: number, currentStatus: boolean) => {
        try {
            await campusesService.updateCampusSection(campusId, classId, sectionId, !currentStatus);
            fetchCampuses();
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to toggle status.");
        }
    };

    const handleRemoveSection = async (campusId: number, classId: number, sectionId: number) => {
        try {
            await campusesService.removeSectionFromCampus(campusId, classId, sectionId);
            setSuccessMessage("Section removed.");
            fetchCampuses();
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to remove section.");
        }
    };

    const hasChanges = JSON.stringify(campuses.map(c => ({ id: c.id, code: c.campus_code, name: c.campus_name }))) !==
        JSON.stringify(originalCampuses.map(c => ({ id: c.id, code: c.campus_code, name: c.campus_name })));

    return (
        <div className="space-y-6 relative pb-20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Campuses</h1>
                    <p className="text-zinc-500 mt-1">Manage school branches, campus codes, and offered classes.</p>
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
                    <div className="flex-1">
                        <p className="font-semibold">Error</p>
                        <p className="text-red-700 mt-0.5">{error}</p>
                    </div>
                    <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                </div>
            )}

            {successMessage && (
                <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-xs animate-in fade-in duration-300">
                    <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="font-semibold">Success</p>
                        <p className="text-emerald-700 mt-0.5">{successMessage}</p>
                    </div>
                    <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-600"><X className="h-4 w-4" /></button>
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
                                    <th className="px-4 py-4 w-40">Actions</th>
                                    <th className="px-6 py-4 w-20">ID</th>
                                    <th className="px-6 py-4 w-40">Code</th>
                                    <th className="px-6 py-4">Campus Name</th>
                                    <th className="px-6 py-4 w-20 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {campuses.map((item) => (
                                    <React.Fragment key={item.id}>
                                        <tr className={`hover:bg-zinc-50/50 transition-colors group ${expandedRows.has(item.id) ? 'bg-zinc-50/30' : ''}`}>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => toggleRow(item.id)}
                                                    className={`px-4 py-2 text-[11px] font-bold rounded-lg border transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${expandedRows.has(item.id)
                                                            ? 'bg-primary border-primary text-white shadow-md shadow-primary/20 scale-105'
                                                            : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 shadow-sm'
                                                        }`}
                                                >
                                                    <GraduationCap className="h-4 w-4" />
                                                    {expandedRows.has(item.id) ? 'Hide Classes' : 'Manage Classes'}
                                                    {expandedRows.has(item.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                                </button>
                                            </td>
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
                                            <td className="px-6 py-3 font-medium text-zinc-900">
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
                                        {expandedRows.has(item.id) && (
                                            <tr className="bg-zinc-50/30">
                                                <td colSpan={5} className="px-10 py-6 border-l-2 border-primary/20 animate-in slide-in-from-top-1 duration-200">
                                                    <div className="flex items-center justify-between mb-6">
                                                        <div className="flex items-center gap-2">
                                                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                                                <GraduationCap className="h-5 w-5" />
                                                            </div>
                                                            <h3 className="font-bold text-zinc-900">Campus Classes</h3>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <select
                                                                className="px-3 py-2 bg-white border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-primary/10 text-xs w-48"
                                                                value={selectedClassId[item.id] || ""}
                                                                onChange={(e) => setSelectedClassId({ ...selectedClassId, [item.id]: e.target.value })}
                                                            >
                                                                <option value="">Select a class to add...</option>
                                                                {classOptions
                                                                    .filter(opt => !item.campus_classes?.some(cc => cc.classes.id === opt.id))
                                                                    .map(opt => (
                                                                        <option key={opt.id} value={opt.id}>
                                                                            {opt.description} ({opt.class_code})
                                                                        </option>
                                                                    ))
                                                                }
                                                            </select>
                                                            <button
                                                                onClick={() => handleAddClass(item.id)}
                                                                className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold hover:bg-zinc-800 active:scale-95 transition-all"
                                                            >
                                                                Add Class
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {!item.campus_classes?.length ? (
                                                        <div className="text-center py-10 bg-white/50 border border-dashed border-zinc-200 rounded-xl">
                                                            <LayoutGrid className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
                                                            <p className="text-zinc-500 text-xs">No classes assigned to this campus yet.</p>
                                                        </div>
                                                    ) : (
                                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                            {item.campus_classes.map((cc) => (
                                                                <div key={cc.id} className="bg-white border border-zinc-200 rounded-xl overflow-hidden hover:shadow-md hover:border-primary/20 transition-all group/card">
                                                                    <div className="flex items-center justify-between p-4 bg-zinc-50/50 border-b border-zinc-100">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className={`p-2 rounded-lg ${cc.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-zinc-100 text-zinc-400'}`}>
                                                                                <LayoutGrid className="h-4 w-4" />
                                                                            </div>
                                                                            <div>
                                                                                <p className="font-bold text-zinc-900 leading-tight">{cc.classes.description}</p>
                                                                                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{cc.classes.class_code} · {cc.classes.academic_system}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-1">
                                                                            <button
                                                                                onClick={() => handleRemoveClass(item.id, cc.classes.id)}
                                                                                className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                                                title="Remove Class"
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </button>
                                                                        </div>
                                                                    </div>

                                                                    <div className="p-4 bg-white">
                                                                        <div className="flex items-center justify-between mb-3 px-1">
                                                                            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Sections</h4>
                                                                            <div className="flex items-center gap-2">
                                                                                <select
                                                                                    className="px-2 py-1 bg-white border border-zinc-200 rounded text-[10px] outline-none w-28 focus:ring-1 focus:ring-primary/20"
                                                                                    value={selectedSectionId[`${item.id}-${cc.classes.id}`] || ""}
                                                                                    onChange={(e) => setSelectedSectionId({ ...selectedSectionId, [`${item.id}-${cc.classes.id}`]: e.target.value })}
                                                                                >
                                                                                    <option value="">Add Section...</option>
                                                                                    {sectionOptions
                                                                                        .filter(opt => !item.campus_sections?.some(cs => cs.class_id === cc.classes.id && cs.section_id === opt.id))
                                                                                        .map(opt => (
                                                                                            <option key={opt.id} value={opt.id}>{opt.description}</option>
                                                                                        ))
                                                                                    }
                                                                                </select>
                                                                                <button
                                                                                    onClick={() => handleAddSection(item.id, cc.classes.id)}
                                                                                    disabled={isAddingSection[`${item.id}-${cc.classes.id}`]}
                                                                                    className="p-1.5 bg-zinc-900 text-white rounded hover:bg-zinc-800 transition-colors disabled:opacity-50"
                                                                                >
                                                                                    {isAddingSection[`${item.id}-${cc.classes.id}`] ? (
                                                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                                                    ) : (
                                                                                        <Plus className="h-3 w-3" />
                                                                                    )}
                                                                                </button>
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex flex-wrap gap-2">
                                                                            {item.campus_sections?.filter(cs => cs.class_id === cc.classes.id).length === 0 ? (
                                                                                <p className="text-[10px] text-zinc-400 italic px-1">No sections assigned.</p>
                                                                            ) : (
                                                                                item.campus_sections?.filter(cs => cs.class_id === cc.classes.id).map(cs => (
                                                                                    <div
                                                                                        key={cs.id}
                                                                                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-all group/section ${cs.is_active ? 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:border-primary/20 hover:bg-white' : 'bg-white border-zinc-100 text-zinc-400 italic'}`}
                                                                                    >
                                                                                        {cs.sections.description}
                                                                                        <div className="flex items-center gap-0.5 ml-1 overflow-hidden w-0 group-hover/section:w-5 transition-all duration-200">
                                                                                            <button
                                                                                                onClick={() => handleRemoveSection(item.id, cc.classes.id, cs.section_id)}
                                                                                                className="p-1 hover:text-rose-500 transition-colors"
                                                                                            >
                                                                                                <X className="h-3.5 w-3.5" />
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                ))
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
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
