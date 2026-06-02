"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
    Building2, 
    Save, 
    Loader2, 
    RefreshCw, 
    AlertCircle, 
    CheckCircle, 
    ChevronLeft, 
    GraduationCap, 
    LayoutGrid,
    AlertTriangle,
    ArrowRight,
    X
} from "lucide-react";
import toast from "react-hot-toast";
import { campusesService, Campus, SectionInfo } from "@/lib/campuses.service";

export default function CampusSectionSetupPage() {
    const [campuses, setCampuses] = useState<Campus[]>([]);
    const [sections, setSections] = useState<SectionInfo[]>([]);
    
    // Selection States
    const [selectedCampusId, setSelectedCampusId] = useState<number | "">("");
    const [selectedClassId, setSelectedClassId] = useState<number | "">("");
    
    // Checkbox mapping: key is sectionId, value is boolean
    const [checkedSections, setCheckedSections] = useState<Record<number, boolean>>({});
    const [originalCheckedSections, setOriginalCheckedSections] = useState<Record<number, boolean>>({});
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Deletion Modal/Queue State
    const [deletesQueue, setDeletesQueue] = useState<SectionInfo[]>([]);
    const [currentDeleteIndex, setCurrentDeleteIndex] = useState<number | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const loadData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [campusesData, sectionsData] = await Promise.all([
                campusesService.list(),
                campusesService.listAllSections()
            ]);
            setCampuses(campusesData);
            setSections(sectionsData);
        } catch (err: any) {
            console.error("Error loading section setup data:", err);
            setError("Failed to load setup data. Please refresh.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Sync checkboxes when selection changes
    useEffect(() => {
        if (!selectedCampusId || !selectedClassId) {
            setCheckedSections({});
            setOriginalCheckedSections({});
            return;
        }

        const campus = campuses.find(c => c.id === Number(selectedCampusId));
        const offeredClass = campus?.offered_classes?.find(oc => oc.id === Number(selectedClassId));
        
        const checkedMap: Record<number, boolean> = {};
        offeredClass?.sections?.forEach(sec => {
            checkedMap[sec.id] = true;
        });

        setCheckedSections(checkedMap);
        setOriginalCheckedSections({ ...checkedMap });
        setSuccessMessage(null);
        setError(null);
    }, [selectedCampusId, selectedClassId, campuses]);

    const handleCheckboxChange = (sectionId: number, checked: boolean) => {
        setCheckedSections(prev => ({
            ...prev,
            [sectionId]: checked
        }));
    };

    const hasUnsavedChanges = () => {
        if (!selectedCampusId || !selectedClassId) return false;
        return sections.some(sec => {
            const isChecked = !!checkedSections[sec.id];
            const wasChecked = !!originalCheckedSections[sec.id];
            return isChecked !== wasChecked;
        });
    };

    const handleSave = async () => {
        if (!selectedCampusId || !selectedClassId) return;
        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);

        const newlyChecked: number[] = [];
        const newlyUnchecked: number[] = [];

        sections.forEach(sec => {
            const isChecked = !!checkedSections[sec.id];
            const wasChecked = !!originalCheckedSections[sec.id];
            if (isChecked && !wasChecked) {
                newlyChecked.push(sec.id);
            } else if (!isChecked && wasChecked) {
                newlyUnchecked.push(sec.id);
            }
        });

        // Track successes/failures for parallel saves
        let succeeded = 0;
        let failed = 0;
        let lastErrorMsg = "";

        try {
            if (newlyChecked.length > 0) {
                const results = await Promise.allSettled(
                    newlyChecked.map(sectionId => 
                        campusesService.upsertCampusSection(Number(selectedCampusId), Number(selectedClassId), sectionId, true)
                    )
                );
                
                results.forEach((res, index) => {
                    if (res.status === "fulfilled") {
                        succeeded++;
                    } else {
                        failed++;
                        lastErrorMsg = res.reason?.response?.data?.message || res.reason?.message || "Failed to link section";
                    }
                });
            }

            // Handle outcomes of parallel non-delete calls
            if (failed > 0) {
                if (succeeded > 0) {
                    toast.error(`Partial Save: ${succeeded} sections saved, ${failed} failed. Reloading to reflect DB state.`);
                    // Reload data from DB
                    const updatedCampuses = await campusesService.list();
                    setCampuses(updatedCampuses);
                } else {
                    toast.error(`Failed to save changes: ${lastErrorMsg}. Reverting checklist to last saved state.`);
                    setCheckedSections({ ...originalCheckedSections });
                }
                setIsSaving(false);
                return;
            }

            // 2. If there are deletes, queue them up for confirmation sequence
            if (newlyUnchecked.length > 0) {
                const toDeleteSections = sections.filter(sec => newlyUnchecked.includes(sec.id));
                setDeletesQueue(toDeleteSections);
                setCurrentDeleteIndex(0);
                setDeleteError(null);
                setIsSaving(false);
            } else {
                setSuccessMessage("Changes saved successfully.");
                toast.success("Changes saved successfully!");
                const updatedCampuses = await campusesService.list();
                setCampuses(updatedCampuses);
                setIsSaving(false);
            }
        } catch (err: any) {
            console.error("Error saving section changes:", err);
            toast.error("Network failure during save. Reverting checklist.");
            setCheckedSections({ ...originalCheckedSections });
            setIsSaving(false);
        }
    };

    const processDelete = async () => {
        if (currentDeleteIndex === null || !selectedCampusId || !selectedClassId) return;
        const sec = deletesQueue[currentDeleteIndex];
        
        setIsDeleting(true);
        setDeleteError(null);
        try {
            await campusesService.removeSectionFromCampus(Number(selectedCampusId), Number(selectedClassId), sec.id);
            
            // Advance or finish queue
            if (currentDeleteIndex + 1 < deletesQueue.length) {
                setCurrentDeleteIndex(currentDeleteIndex + 1);
            } else {
                // Done with all deletes!
                setDeletesQueue([]);
                setCurrentDeleteIndex(null);
                setSuccessMessage("All changes saved successfully.");
                toast.success("All changes saved successfully!");
                const updatedCampuses = await campusesService.list();
                setCampuses(updatedCampuses);
            }
        } catch (err: any) {
            console.error("Error removing section:", err);
            const errMsg = err.response?.data?.message || `Failed to remove ${sec.description}`;
            setDeleteError(Array.isArray(errMsg) ? errMsg.join("; ") : errMsg);
        } finally {
            setIsDeleting(false);
        }
    };

    const cancelRemainingDeletes = async () => {
        setDeletesQueue([]);
        setCurrentDeleteIndex(null);
        setDeleteError(null);
        
        // Reload data to revert state
        const updatedCampuses = await campusesService.list();
        setCampuses(updatedCampuses);
    };

    const selectedCampus = campuses.find(c => c.id === Number(selectedCampusId));
    const selectedClass = selectedCampus?.offered_classes?.find(oc => oc.id === Number(selectedClassId));
    
    // Classes offered at the selected campus
    const campusClasses = selectedCampus?.offered_classes || [];

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <Link 
                        href="/campuses" 
                        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 transition-colors font-medium"
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Back to Campuses
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Campus–Section Setup</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                        Declare which sections exist per class per campus branch.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={loadData}
                        disabled={isLoading || isSaving}
                        className="inline-flex items-center justify-center h-10 px-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-medium rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    {selectedCampusId && selectedClassId && (
                        <button
                            onClick={handleSave}
                            disabled={isLoading || isSaving || !hasUnsavedChanges()}
                            className="inline-flex items-center justify-center h-10 px-6 bg-primary hover:bg-primary/95 text-white font-bold rounded-xl shadow-md shadow-primary/20 transition-all active:scale-95 disabled:opacity-40 disabled:scale-100"
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
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
                        <p className="flex-1 font-medium">{error}</p>
                        <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600"><X className="h-4 w-4" /></button>
                    </div>
                )}
                {successMessage && (
                    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl p-4 text-sm animate-in fade-in slide-in-from-top-2 duration-300">
                        <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                        <p className="flex-1 font-medium">{successMessage}</p>
                        <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-600"><X className="h-4 w-4" /></button>
                    </div>
                )}
            </div>

            {/* Steps & Main Config Area */}
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm overflow-hidden flex flex-col p-6 space-y-6">
                
                {/* Step 1 & 2 Selection Header */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
                    
                    {/* Step 1: Campus Select */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                            <Building2 className="h-4 w-4 text-primary" />
                            Step 1 — Select Campus
                        </label>
                        <select
                            value={selectedCampusId}
                            onChange={(e) => {
                                setSelectedCampusId(e.target.value ? Number(e.target.value) : "");
                                setSelectedClassId("");
                            }}
                            disabled={isLoading}
                            className="w-full h-11 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm font-semibold transition-all"
                        >
                            <option value="">-- Select a campus branch --</option>
                            {campuses.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.campus_name} ({c.campus_code})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Step 2: Class Select */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                            <GraduationCap className="h-4 w-4 text-secondary" />
                            Step 2 — Select Class
                        </label>
                        <select
                            value={selectedClassId}
                            onChange={(e) => setSelectedClassId(e.target.value ? Number(e.target.value) : "")}
                            disabled={isLoading || !selectedCampusId || campusClasses.length === 0}
                            className="w-full h-11 px-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-secondary/20 text-sm font-semibold transition-all disabled:opacity-55"
                        >
                            {!selectedCampusId ? (
                                <option value="">Select campus first</option>
                            ) : campusClasses.length === 0 ? (
                                <option value="">No classes configured</option>
                            ) : (
                                <>
                                    <option value="">-- Choose Offered Class --</option>
                                    {campusClasses.map(cls => (
                                        <option key={cls.id} value={cls.id}>
                                            {cls.description} ({cls.class_code})
                                        </option>
                                    ))}
                                </>
                            )}
                        </select>
                    </div>
                </div>

                {/* Step 3: Main Assignment Area */}
                <div className="pt-2">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                        <LayoutGrid className="h-4 w-4 text-emerald-600" />
                        Step 3 — Section Assignment
                    </h3>

                    {/* Empty / Error States */}
                    {!selectedCampusId ? (
                        <div className="py-20 text-center flex flex-col items-center justify-center border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-2xl">
                            <Building2 className="h-12 w-12 text-zinc-300 dark:text-zinc-700 mb-3" />
                            <p className="text-zinc-500 dark:text-zinc-400 font-medium">Please select a campus above to begin.</p>
                        </div>
                    ) : campusClasses.length === 0 ? (
                        <div className="py-16 text-center flex flex-col items-center justify-center border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-2xl space-y-4">
                            <GraduationCap className="h-12 w-12 text-zinc-300 dark:text-zinc-700" />
                            <div className="space-y-1">
                                <p className="text-zinc-900 dark:text-zinc-100 font-bold">No classes are configured for this campus yet</p>
                                <p className="text-zinc-500 dark:text-zinc-400 text-xs">Configure classes offered at this campus first before mapping sections.</p>
                            </div>
                            <Link
                                href="/campuses/class-setup"
                                className="inline-flex items-center justify-center px-5 h-10 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl shadow transition-all active:scale-95"
                            >
                                Go to Campus–Class Setup
                                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                            </Link>
                        </div>
                    ) : !selectedClassId ? (
                        <div className="py-20 text-center flex flex-col items-center justify-center border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-2xl">
                            <GraduationCap className="h-12 w-12 text-zinc-300 dark:text-zinc-700 mb-3" />
                            <p className="text-zinc-500 dark:text-zinc-400 font-medium">Select a class above.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Checklist Labeling */}
                            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                                <div>
                                    <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                                        Assign sections to <span className="text-secondary">{selectedClass?.description}</span> at <span className="text-primary">{selectedCampus?.campus_name}</span>
                                    </h4>
                                    <p className="text-xs text-zinc-500 mt-0.5">Toggle checkbox and click Save to store.</p>
                                </div>
                                {hasUnsavedChanges() && (
                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-full animate-pulse">
                                        Unsaved Changes
                                    </span>
                                )}
                            </div>

                            {/* Section Rows */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                                {sections.map(sec => {
                                    const isChecked = !!checkedSections[sec.id];
                                    return (
                                        <label
                                            key={sec.id}
                                            className={`flex items-center gap-3.5 p-4 border border-zinc-100 dark:border-zinc-800 rounded-2xl cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-all ${
                                                isChecked 
                                                ? "bg-emerald-500/5 border-emerald-100 dark:border-emerald-950/30 text-emerald-900 dark:text-emerald-300" 
                                                : "bg-white dark:bg-zinc-950"
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={(e) => handleCheckboxChange(sec.id, e.target.checked)}
                                                className="h-5 w-5 rounded-md border-zinc-300 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer accent-emerald-600"
                                            />
                                            <span className="font-bold text-sm">
                                                Section {sec.description}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Custom Section deletion dialog */}
            {currentDeleteIndex !== null && selectedCampus && selectedClass && deletesQueue[currentDeleteIndex] && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-950/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-zinc-200 dark:border-zinc-800">
                        <div className="p-6">
                            <div className="h-14 w-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-5">
                                <AlertTriangle className="h-7 w-7" />
                            </div>
                            
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
                                Remove {deletesQueue[currentDeleteIndex].description} from {selectedClass.description} at {selectedCampus.campus_name}?
                            </h2>
                            
                            <p className="text-zinc-500 dark:text-zinc-400 mt-3 text-sm leading-relaxed">
                                Students currently in this section will not be moved automatically.
                            </p>

                            {/* Backend 400 Bad Request error inline */}
                            {deleteError && (
                                <div className="mt-4 p-4 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl text-xs font-semibold flex items-start gap-2.5">
                                    <AlertCircle className="h-4 w-4 text-rose-500 flex-shrink-0 mt-0.5" />
                                    <p className="flex-1">{deleteError}</p>
                                </div>
                            )}
                        </div>

                        <div className="p-5 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex gap-3">
                            <button
                                onClick={cancelRemainingDeletes}
                                disabled={isDeleting}
                                className="flex-1 h-11 font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={processDelete}
                                disabled={isDeleting}
                                className="flex-1 h-11 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center disabled:opacity-50"
                            >
                                {isDeleting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    "Confirm Remove"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
