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
    const [isConfiguring, setIsConfiguring] = useState(false);

    // State for Configuration Panel
    const [configCampusId, setConfigCampusId] = useState<number | null>(null);
    const [classOptions, setClassOptions] = useState<CampusClassInfo[]>([]);
    const [sectionOptions, setSectionOptions] = useState<SectionInfo[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<Record<number, string>>({});
    const [selectedSectionId, setSelectedSectionId] = useState<Record<string, string>>({}); // key: campusId-classId

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

    const handleChange = (id: number, field: keyof Campus, value: string) => {
        setCampuses(prev =>
            prev.map(c =>
                c.id === id ? { ...c, [field]: value } : c
            )
        );
        if (successMessage) setSuccessMessage(null);
    };

    const updateLocalCampus = (updatedCampus: Campus) => {
        setCampuses(prev => prev.map(c => c.id === updatedCampus.id ? updatedCampus : c));
        // Also update original campuses so the "Save Changes" button state is accurate for basic fields
        setOriginalCampuses(prev => prev.map(c => c.id === updatedCampus.id ? JSON.parse(JSON.stringify(updatedCampus)) : c));
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

        setIsConfiguring(true);
        try {
            const updatedCampus = await campusesService.upsertCampusClass(campusId, classId);
            setSuccessMessage("Class added to campus.");
            updateLocalCampus(updatedCampus);
            setSelectedClassId(prev => ({ ...prev, [campusId]: "" }));
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to add class.");
        } finally {
            setIsConfiguring(false);
        }
    };

    const handleRemoveClass = async (campusId: number, classId: number) => {
        setIsConfiguring(true);
        try {
            const updatedCampus = await campusesService.removeClassFromCampus(campusId, classId);
            setSuccessMessage("Class removed from campus.");
            updateLocalCampus(updatedCampus);
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to remove class.");
        } finally {
            setIsConfiguring(false);
        }
    };

    // --- Section Management Handlers ---

    const handleAddSection = async (campusId: number, classId: number) => {
        const comboKey = `${campusId}-${classId}`;
        const sectionId = parseInt(selectedSectionId[comboKey]);
        if (!sectionId) return;

        setIsConfiguring(true);
        try {
            const updatedCampus = await campusesService.upsertCampusSection(campusId, classId, sectionId);
            setSuccessMessage("Section added.");
            updateLocalCampus(updatedCampus);
            setSelectedSectionId(prev => ({ ...prev, [comboKey]: "" }));
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to add section.");
        } finally {
            setIsConfiguring(false);
        }
    };

    const handleRemoveSection = async (campusId: number, classId: number, sectionId: number) => {
        setIsConfiguring(true);
        try {
            const updatedCampus = await campusesService.removeSectionFromCampus(campusId, classId, sectionId);
            setSuccessMessage("Section removed.");
            updateLocalCampus(updatedCampus);
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to remove section.");
        } finally {
            setIsConfiguring(false);
        }
    };

    const hasChanges = JSON.stringify(campuses.map(c => ({ id: c.id, code: c.campus_code, name: c.campus_name }))) !==
        JSON.stringify(originalCampuses.map(c => ({ id: c.id, code: c.campus_code, name: c.campus_name })));

    const activeCampus = campuses.find(c => c.id === configCampusId);

    return (
        <div className="space-y-6 relative pb-20 max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Campus Management</h1>
                    <p className="text-zinc-500 mt-1 flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Configure branches, classes, and academic sections.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={fetchCampuses}
                        disabled={isLoading || isSaving}
                        className="inline-flex items-center justify-center h-10 px-4 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-medium rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="inline-flex items-center justify-center h-10 px-6 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-xl shadow-sm transition-all active:scale-95"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        New Campus
                    </button>
                    {hasChanges && (
                        <button
                            onClick={handleSave}
                            disabled={isLoading || isSaving}
                            className="inline-flex items-center justify-center h-10 px-6 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl shadow-md shadow-primary/20 transition-all active:scale-95"
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            Save Changes
                        </button>
                    )}
                </div>
            </div>

            {/* Notifications */}
            <div className="space-y-3">
                {error && (
                    <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl p-4 text-sm animate-in fade-in slide-in-from-top-2 duration-300">
                        <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0" />
                        <p className="flex-1">{error}</p>
                        <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600"><X className="h-4 w-4" /></button>
                    </div>
                )}
                {successMessage && (
                    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl p-4 text-sm animate-in fade-in slide-in-from-top-2 duration-300">
                        <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                        <p className="flex-1">{successMessage}</p>
                        <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-600"><X className="h-4 w-4" /></button>
                    </div>
                )}
            </div>

            {/* Main Content Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-48 bg-white border border-zinc-200 rounded-3xl animate-pulse shadow-sm" />
                    ))}
                </div>
            ) : campuses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 bg-white border-2 border-dashed border-zinc-200 rounded-3xl text-center">
                    <div className="p-4 bg-zinc-50 rounded-full mb-4">
                        <Building2 className="text-zinc-400 h-12 w-12" />
                    </div>
                    <h3 className="text-xl font-bold text-zinc-900">No Campuses Found</h3>
                    <p className="mt-2 text-zinc-500 max-w-xs">Get started by creating your school's first campus or branch.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {campuses.map((item) => (
                        <div key={item.id} className="group bg-white border border-zinc-200 rounded-3xl shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300 overflow-hidden flex flex-col">
                            <div className="p-6 flex-1">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-3 bg-zinc-100 rounded-2xl group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                        <Building2 className="h-6 w-6" />
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setDeleteId(item.id)}
                                            className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                            title="Delete Campus"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <input
                                        type="text"
                                        value={item.campus_code}
                                        maxLength={10}
                                        onChange={(e) => handleChange(item.id, 'campus_code', e.target.value.toUpperCase())}
                                        className="text-xs font-mono font-bold tracking-widest text-primary/70 bg-transparent border-none p-0 focus:ring-0 uppercase mb-1"
                                        placeholder="CODE"
                                    />
                                    <input
                                        type="text"
                                        value={item.campus_name}
                                        onChange={(e) => handleChange(item.id, 'campus_name', e.target.value)}
                                        className="w-full text-xl font-bold text-zinc-900 bg-transparent border-none p-0 focus:ring-0 block"
                                        placeholder="Campus Name"
                                    />
                                </div>

                                <div className="mt-6 flex items-center gap-4 text-xs font-medium text-zinc-500">
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-50 rounded-full">
                                        <GraduationCap className="h-3.5 w-3.5" />
                                        {item.offered_classes?.length || 0} Classes
                                    </div>
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-50 rounded-full">
                                        <LayoutGrid className="h-3.5 w-3.5" />
                                        {item.offered_classes?.reduce((acc, cc) => acc + (cc.sections?.length || 0), 0) || 0} Sections
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between">
                                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-tighter">ID: #{item.id}</span>
                                <button
                                    onClick={() => setConfigCampusId(item.id)}
                                    className="px-4 py-2 bg-white border border-zinc-200 text-zinc-900 text-xs font-bold rounded-xl hover:border-primary hover:text-primary shadow-sm active:scale-95 transition-all flex items-center gap-2"
                                >
                                    Manage Classes
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Configuration Side Drawer */}
            {configCampusId && activeCampus && (
                <>
                    <div
                        className="fixed inset-0 bg-zinc-950/20 backdrop-blur-sm z-40 animate-in fade-in duration-300"
                        onClick={() => setConfigCampusId(null)}
                    />
                    <div className="fixed inset-y-0 right-0 w-full sm:w-[500px] bg-white shadow-2xl z-50 animate-in slide-in-from-right duration-500 ease-out border-l border-zinc-200 flex flex-col">
                        {/* Drawer Header */}
                        <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                            <div>
                                <h2 className="text-xl font-bold text-zinc-900">{activeCampus.campus_name}</h2>
                                <p className="text-xs text-zinc-500 mt-0.5 font-mono uppercase tracking-widest">Campus Configuration</p>
                            </div>
                            <button
                                onClick={() => setConfigCampusId(null)}
                                className="p-2 hover:bg-zinc-200 rounded-full transition-colors"
                            >
                                <X className="h-5 w-5 text-zinc-500" />
                            </button>
                        </div>

                        {/* Drawer content with internal scroll */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                            {/* Inventory Section */}
                            <section>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="h-1 w-4 bg-primary rounded-full" />
                                    <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Active Classes</h3>
                                </div>

                                {!activeCampus.offered_classes?.length ? (
                                    <div className="text-center py-12 bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-3xl">
                                        <GraduationCap className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
                                        <p className="text-zinc-500 text-sm">No classes assigned yet.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        {activeCampus.offered_classes.map((cc) => (
                                            <div key={cc.id} className="bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:border-primary/30 transition-all shadow-sm group/class">
                                                <div className="p-4 flex items-center justify-between border-b border-zinc-100 bg-zinc-50/30">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-white rounded-xl shadow-sm border border-zinc-100 text-primary">
                                                            <GraduationCap className="h-5 w-5" />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-zinc-900 text-sm leading-tight">{cc.description}</p>
                                                            <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{cc.class_code} · {cc.academic_system}</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemoveClass(activeCampus.id, cc.id)}
                                                        disabled={isConfiguring}
                                                        className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all disabled:opacity-30"
                                                    >
                                                        {isConfiguring ? <Loader2 className="h-4 w-4 animate-spin text-zinc-400" /> : <Trash2 className="h-4 w-4" />}
                                                    </button>
                                                </div>

                                                <div className="p-4 space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Assigned Sections</h4>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2">
                                                        {cc.sections?.map(cs => (
                                                            <div
                                                                key={cs.id}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 hover:bg-white hover:border-primary/30 transition-all group/section"
                                                            >
                                                                {cs.description}
                                                                <button
                                                                    onClick={() => handleRemoveSection(activeCampus.id, cc.id, cs.id)}
                                                                    disabled={isConfiguring}
                                                                    className="text-zinc-400 hover:text-rose-600 transition-colors disabled:opacity-30"
                                                                >
                                                                    {isConfiguring ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                                                                </button>
                                                            </div>
                                                        ))}

                                                        <div className="flex items-center gap-2">
                                                            <select
                                                                className="text-xs bg-white border border-zinc-200 rounded-xl px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary/20 w-32"
                                                                value={selectedSectionId[`${activeCampus.id}-${cc.id}`] || ""}
                                                                onChange={(e) => setSelectedSectionId({ ...selectedSectionId, [`${activeCampus.id}-${cc.id}`]: e.target.value })}
                                                            >
                                                                <option value="">Add...</option>
                                                                {sectionOptions
                                                                    .filter(opt => !cc.sections?.some(cs => cs.id === opt.id))
                                                                    .map(opt => (
                                                                        <option key={opt.id} value={opt.id}>{opt.description}</option>
                                                                    ))
                                                                }
                                                            </select>
                                                            <button
                                                                onClick={() => handleAddSection(activeCampus.id, cc.id)}
                                                                disabled={!selectedSectionId[`${activeCampus.id}-${cc.id}`] || isConfiguring}
                                                                className="p-1.5 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 disabled:opacity-30 transition-all flex items-center justify-center min-w-[32px] min-h-[32px]"
                                                            >
                                                                {isConfiguring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            <div className="h-px bg-zinc-100" />

                            {/* Provisioning Section */}
                            <section>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="h-1 w-4 bg-emerald-500 rounded-full" />
                                    <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Add New Class</h3>
                                </div>

                                <div className="p-6 bg-emerald-50/50 border border-emerald-100 rounded-3xl space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest ml-1">Select Catalog Item</label>
                                        <select
                                            className="w-full h-12 px-4 bg-white border border-emerald-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium"
                                            value={selectedClassId[activeCampus.id] || ""}
                                            onChange={(e) => setSelectedClassId({ ...selectedClassId, [activeCampus.id]: e.target.value })}
                                        >
                                            <option value="">Choose a class from catalog...</option>
                                            {classOptions
                                                .filter(opt => !activeCampus.offered_classes?.some(cc => cc.id === opt.id))
                                                .map(opt => (
                                                    <option key={opt.id} value={opt.id}>
                                                        {opt.description} ({opt.class_code})
                                                    </option>
                                                ))
                                            }
                                        </select>
                                    </div>
                                    <button
                                        onClick={() => handleAddClass(activeCampus.id)}
                                        disabled={!selectedClassId[activeCampus.id] || isConfiguring}
                                        className="w-full h-12 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-800 active:scale-[0.98] transition-all disabled:opacity-50"
                                    >
                                        {isConfiguring ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : (
                                            <>
                                                Provision Class
                                                <Plus className="h-4 w-4" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </section>
                        </div>
                    </div>
                </>
            )}

            {/* Add Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
                        <form onSubmit={handleAddCampus}>
                            <div className="p-8 border-b border-zinc-100">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="h-12 w-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
                                        <Plus className="h-6 w-6" />
                                    </div>
                                    <button type="button" onClick={() => setIsAddModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 transition-colors">
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>
                                <h2 className="text-2xl font-bold text-zinc-900">New Campus</h2>
                                <p className="text-zinc-500 mt-1">Initialize a new school branch in the system.</p>
                            </div>

                            <div className="p-8 bg-zinc-50/30 space-y-6">
                                <div className="grid grid-cols-1 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Campus Code</label>
                                        <input
                                            required
                                            maxLength={10}
                                            value={newCampus.campus_code}
                                            onChange={(e) => setNewCampus({ ...newCampus, campus_code: e.target.value.toUpperCase() })}
                                            className="w-full h-12 px-4 bg-white border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono uppercase focus:border-primary"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Campus Name</label>
                                        <input
                                            required
                                            value={newCampus.campus_name}
                                            onChange={(e) => setNewCampus({ ...newCampus, campus_name: e.target.value })}
                                            className="w-full h-12 px-4 bg-white border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 transition-all focus:border-primary"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="p-8 flex justify-end gap-4 bg-white">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-6 h-12 font-bold text-zinc-500 hover:text-zinc-900 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isAdding}
                                    className="px-8 h-12 bg-zinc-900 text-white font-bold rounded-2xl hover:bg-zinc-800 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isAdding ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create Campus"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteId !== null && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-950/60 backdrop-blur-lg p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300 text-center">
                        <div className="p-8">
                            <div className="h-20 w-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Trash2 className="h-10 w-10" />
                            </div>
                            <h2 className="text-xl font-bold text-zinc-900">Delete Campus?</h2>
                            <p className="text-zinc-500 mt-2 text-sm leading-relaxed">
                                This action is permanent. You cannot delete a campus if it contains active student records.
                            </p>
                        </div>
                        <div className="p-6 bg-zinc-50 flex gap-3">
                            <button
                                onClick={() => setDeleteId(null)}
                                className="flex-1 h-12 font-bold text-zinc-600 bg-white border border-zinc-200 rounded-2xl hover:bg-zinc-50 transition-all"
                            >
                                Nevermind
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="flex-1 h-12 font-bold text-white bg-rose-600 rounded-2xl hover:bg-rose-700 transition-all active:scale-95 shadow-lg shadow-rose-200 disabled:opacity-50"
                            >
                                {isDeleting ? "..." : "Confirm Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
