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
    Search,
    AlertTriangle,
    X
} from "lucide-react";
import toast from "react-hot-toast";
import { campusesService, Campus, CampusClassInfo } from "@/lib/campuses.service";

export default function CampusClassSetupPage() {
    const [campuses, setCampuses] = useState<Campus[]>([]);
    const [classes, setClasses] = useState<CampusClassInfo[]>([]);
    const [selectedCampusId, setSelectedCampusId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    
    // Checkbox states: key is classId
    const [checkedClasses, setCheckedClasses] = useState<Record<number, boolean>>({});
    const [originalCheckedClasses, setOriginalCheckedClasses] = useState<Record<number, boolean>>({});
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    
    // Deletion Modal / Confirm State
    const [deletesQueue, setDeletesQueue] = useState<CampusClassInfo[]>([]);
    const [currentDeleteIndex, setCurrentDeleteIndex] = useState<number | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const loadData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [campusesData, classesData] = await Promise.all([
                campusesService.list(),
                campusesService.listAllClasses()
            ]);
            setCampuses(campusesData);
            setClasses(classesData);
            
            // Auto-select first campus if available and none selected
            if (campusesData.length > 0 && selectedCampusId === null) {
                selectCampus(campusesData[0].id, campusesData);
            } else if (selectedCampusId !== null) {
                selectCampus(selectedCampusId, campusesData);
            }
        } catch (err: any) {
            console.error("Error loading setup data:", err);
            setError("Failed to load setup data. Please refresh.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const selectCampus = (campusId: number, currentCampuses = campuses) => {
        const campus = currentCampuses.find(c => c.id === campusId);
        if (!campus) return;
        
        setSelectedCampusId(campusId);
        
        // Build initial checked classes map
        const checkedMap: Record<number, boolean> = {};
        campus.offered_classes?.forEach(oc => {
            checkedMap[oc.id] = true;
        });
        
        setCheckedClasses(checkedMap);
        setOriginalCheckedClasses({ ...checkedMap });
        setSuccessMessage(null);
        setError(null);
    };

    const handleCheckboxChange = (classId: number, checked: boolean) => {
        setCheckedClasses(prev => ({
            ...prev,
            [classId]: checked
        }));
    };

    const hasUnsavedChanges = () => {
        return classes.some(cls => {
            const isChecked = !!checkedClasses[cls.id];
            const wasChecked = !!originalCheckedClasses[cls.id];
            return isChecked !== wasChecked;
        });
    };

    const handleSave = async () => {
        if (!selectedCampusId) return;
        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);

        const newlyChecked: number[] = [];
        const newlyUnchecked: number[] = [];

        classes.forEach(cls => {
            const isChecked = !!checkedClasses[cls.id];
            const wasChecked = !!originalCheckedClasses[cls.id];
            if (isChecked && !wasChecked) {
                newlyChecked.push(cls.id);
            } else if (!isChecked && wasChecked) {
                newlyUnchecked.push(cls.id);
            }
        });

        // Track successes/failures for parallel saves
        let succeeded = 0;
        let failed = 0;
        let lastErrorMsg = "";

        try {
            if (newlyChecked.length > 0) {
                const results = await Promise.allSettled(
                    newlyChecked.map(classId => 
                        campusesService.upsertCampusClass(selectedCampusId, classId, true)
                    )
                );
                
                results.forEach((res, index) => {
                    if (res.status === "fulfilled") {
                        succeeded++;
                    } else {
                        failed++;
                        lastErrorMsg = res.reason?.response?.data?.message || res.reason?.message || "Failed to link class";
                    }
                });
            }

            // Handle outcomes of parallel non-delete calls
            if (failed > 0) {
                if (succeeded > 0) {
                    toast.error(`Partial Save: ${succeeded} classes saved, ${failed} failed. Reloading to reflect DB state.`);
                    await loadData();
                } else {
                    toast.error(`Failed to save changes: ${lastErrorMsg}. Reverting checklist to last saved state.`);
                    setCheckedClasses({ ...originalCheckedClasses });
                }
                setIsSaving(false);
                return;
            }

            // 2. If there are deletes, queue them up for confirmation sequence
            if (newlyUnchecked.length > 0) {
                const toDeleteClasses = classes.filter(cls => newlyUnchecked.includes(cls.id));
                setDeletesQueue(toDeleteClasses);
                setCurrentDeleteIndex(0);
                setDeleteError(null);
                setIsSaving(false);
            } else {
                setSuccessMessage("Changes saved successfully.");
                toast.success("Changes saved successfully!");
                await loadData();
                setIsSaving(false);
            }
        } catch (err: any) {
            console.error("Error saving changes:", err);
            toast.error("Network failure during save. Reverting checklist.");
            setCheckedClasses({ ...originalCheckedClasses });
            setIsSaving(false);
        }
    };

    const processDelete = async () => {
        if (currentDeleteIndex === null || !selectedCampusId) return;
        const cls = deletesQueue[currentDeleteIndex];
        
        setIsDeleting(true);
        setDeleteError(null);
        try {
            await campusesService.removeClassFromCampus(selectedCampusId, cls.id);
            
            // Advance or finish queue
            if (currentDeleteIndex + 1 < deletesQueue.length) {
                setCurrentDeleteIndex(currentDeleteIndex + 1);
            } else {
                // Done with all deletes!
                setDeletesQueue([]);
                setCurrentDeleteIndex(null);
                setSuccessMessage("All changes saved successfully.");
                toast.success("All changes saved successfully!");
                await loadData();
            }
        } catch (err: any) {
            console.error("Error deleting campus class:", err);
            const errMsg = err.response?.data?.message || `Failed to remove ${cls.description}`;
            setDeleteError(Array.isArray(errMsg) ? errMsg.join("; ") : errMsg);
        } finally {
            setIsDeleting(false);
        }
    };

    const cancelRemainingDeletes = async () => {
        setDeletesQueue([]);
        setCurrentDeleteIndex(null);
        setDeleteError(null);
        await loadData(); // Reload to sync UI state
    };

    const selectedCampus = campuses.find(c => c.id === selectedCampusId);
    const filteredCampuses = campuses.filter(c => 
        c.campus_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.campus_code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20">
            {/* Header / Breadcrumb */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <Link 
                        href="/campuses" 
                        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 transition-colors font-medium"
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Back to Campuses
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Campus–Class Setup</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                        Declare which classes are offered at each campus branch.
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
                    {selectedCampusId && (
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

            {/* Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left Panel: Campus List (4 Cols) */}
                <div className="lg:col-span-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm flex flex-col">
                    <div className="p-5 border-b border-zinc-100 dark:border-zinc-800">
                        <h2 className="font-bold text-zinc-900 dark:text-zinc-100 text-base mb-3 flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-primary" />
                            Select Campus
                        </h2>
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="Search campus..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-10 pl-10 pr-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none text-sm transition-all focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-zinc-400"
                            />
                        </div>
                    </div>

                    <div className="max-h-[500px] overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 custom-scrollbar">
                        {isLoading ? (
                            [1, 2, 3].map(i => (
                                <div key={i} className="p-5 animate-pulse flex items-center justify-between">
                                    <div className="space-y-2">
                                        <div className="h-4 w-32 bg-zinc-100 dark:bg-zinc-800 rounded" />
                                        <div className="h-3 w-16 bg-zinc-100 dark:bg-zinc-800 rounded" />
                                    </div>
                                    <div className="h-5 w-12 bg-zinc-100 dark:bg-zinc-800 rounded-full" />
                                </div>
                            ))
                        ) : filteredCampuses.length === 0 ? (
                            <div className="p-8 text-center text-zinc-400 text-sm">
                                No campuses found
                            </div>
                        ) : (
                            filteredCampuses.map(campus => {
                                const isSelected = campus.id === selectedCampusId;
                                const offeredCount = campus.offered_classes?.length || 0;
                                return (
                                    <button
                                        key={campus.id}
                                        onClick={() => selectCampus(campus.id)}
                                        className={`w-full text-left p-4 transition-all flex items-center justify-between group ${
                                            isSelected 
                                            ? "bg-zinc-50 dark:bg-zinc-900 border-l-4 border-primary" 
                                            : "hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 border-l-4 border-transparent"
                                        }`}
                                    >
                                        <div>
                                            <p className={`font-bold text-sm leading-tight transition-colors ${
                                                isSelected ? "text-primary" : "text-zinc-900 dark:text-zinc-100"
                                            }`}>
                                                {campus.campus_name}
                                            </p>
                                            <p className="text-[11px] font-mono text-zinc-400 mt-1 uppercase tracking-wider">
                                                {campus.campus_code}
                                            </p>
                                        </div>
                                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors ${
                                            isSelected 
                                            ? "bg-primary/10 text-primary" 
                                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700"
                                        }`}>
                                            {offeredCount} Class{offeredCount !== 1 && 'es'}
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right Panel: Class Checklist (8 Cols) */}
                <div className="lg:col-span-8 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm flex flex-col">
                    <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/10 flex items-center justify-between">
                        <div>
                            <h2 className="font-bold text-zinc-950 dark:text-zinc-50 text-base leading-tight">
                                {selectedCampus ? `Classes offered at ${selectedCampus.campus_name}` : "Classes Selection"}
                            </h2>
                            {selectedCampus && (
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                    Check a class to offer it at this branch. Uncheck to remove it.
                                </p>
                            )}
                        </div>
                        {hasUnsavedChanges() && (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-full animate-pulse border border-amber-100 dark:border-amber-900/30">
                                Unsaved Changes
                            </span>
                        )}
                    </div>

                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[560px] overflow-y-auto custom-scrollbar">
                        {isLoading ? (
                            [1, 2, 3, 4].map(i => (
                                <div key={i} className="p-5 animate-pulse flex items-center gap-4">
                                    <div className="h-5 w-5 bg-zinc-100 dark:bg-zinc-800 rounded" />
                                    <div className="space-y-2 flex-1">
                                        <div className="h-4 w-48 bg-zinc-100 dark:bg-zinc-800 rounded" />
                                        <div className="h-3 w-24 bg-zinc-100 dark:bg-zinc-800 rounded" />
                                    </div>
                                </div>
                            ))
                        ) : !selectedCampusId ? (
                            <div className="p-16 text-center text-zinc-400 text-sm">
                                Please select a campus from the left column to configure offered classes.
                            </div>
                        ) : (
                            classes.map(cls => {
                                const isChecked = !!checkedClasses[cls.id];
                                const originalOffered = selectedCampus?.offered_classes?.find(oc => oc.id === cls.id);
                                const isInactive = originalOffered && originalOffered.is_active === false;

                                return (
                                    <label
                                        key={cls.id}
                                        className={`flex items-center gap-4 p-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 cursor-pointer transition-colors ${
                                            isChecked ? "bg-primary/5 dark:bg-primary/5" : ""
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={(e) => handleCheckboxChange(cls.id, e.target.checked)}
                                            className="h-5 w-5 rounded-md border-zinc-300 text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer accent-primary"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                                                    {cls.description}
                                                </p>
                                                <span className="text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded font-bold uppercase">
                                                    {cls.class_code}
                                                </span>
                                                <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded font-semibold uppercase">
                                                    {cls.academic_system}
                                                </span>
                                                {isChecked && isInactive && (
                                                    <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-400 line-through px-2 py-0.5 rounded font-bold">
                                                        Inactive
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </label>
                                );
                            })
                        )}
                    </div>
                </div>

            </div>

            {/* Deletion Dialog (Confirmation Queue) */}
            {currentDeleteIndex !== null && selectedCampus && deletesQueue[currentDeleteIndex] && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-950/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-zinc-200 dark:border-zinc-800">
                        <div className="p-6">
                            <div className="h-14 w-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-5">
                                <AlertTriangle className="h-7 w-7" />
                            </div>
                            
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
                                Remove {deletesQueue[currentDeleteIndex].description} from {selectedCampus.campus_name}?
                            </h2>
                            
                            <p className="text-zinc-500 dark:text-zinc-400 mt-3 text-sm leading-relaxed">
                                This will also remove all sections configured for this class at this campus. 
                                Students currently assigned to this class here will not be moved — you will need to reassign them separately.
                            </p>

                            {/* Backend 400 Bad Request / error message block inside modal */}
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
