"use client";

import React, { useState, useEffect } from "react";
import { X, TrendingUp, AlertCircle, RefreshCw, ChevronRight } from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "../../../store/store";
import { fetchClasses } from "../../../store/slices/classesSlice";
import toast from "react-hot-toast";

interface BulkPromoteModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function BulkPromoteModal({ isOpen, onClose }: BulkPromoteModalProps) {
    const dispatch = useDispatch<AppDispatch>();
    const { items: classes, isLoading, error } = useSelector((state: RootState) => state.classes);
    const [selectedClassId, setSelectedClassId] = useState<string>("");

    useEffect(() => {
        if (isOpen && classes.length === 0) {
            dispatch(fetchClasses());
        }
    }, [isOpen, dispatch, classes.length]);

    if (!isOpen) return null;

    const handlePromote = () => {
        if (!selectedClassId) {
            toast.error("Please select a class to promote from.");
            return;
        }
        // Promotion logic will be integrated later
        toast.success("Promotion process initiated (Backend integration coming soon).");
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="px-6 py-4 border-b flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-zinc-900 dark:text-zinc-100">Bulk Promote Students</h3>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">Student Management</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors"
                    >
                        <X className="h-4 w-4 text-zinc-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-tight">
                            Promoting From Class
                        </label>
                        <div className="relative">
                            <select
                                value={selectedClassId}
                                onChange={(e) => setSelectedClassId(e.target.value)}
                                disabled={isLoading}
                                className="w-full pl-4 pr-10 py-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none disabled:opacity-50"
                            >
                                <option value="">Select a class...</option>
                                {classes.map((cls) => (
                                    <option key={cls.id} value={cls.id}>
                                        {cls.description} ({cls.class_code})
                                    </option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                                {isLoading ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                    <ChevronRight className="h-4 w-4 rotate-90" />
                                )}
                            </div>
                        </div>
                        {error && (
                            <p className="text-xs text-rose-500 font-medium mt-1">
                                {error}
                            </p>
                        )}
                    </div>

                    {/* Disclaimer */}
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl flex gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-tight mb-1">Disclaimer</p>
                            <p className="text-xs text-amber-700/80 dark:text-amber-500/80 leading-relaxed font-medium">
                                All students currently enrolled in the selected class will be promoted to the next corresponding class in the academic sequence. This action will update their academic records and fee structures accordingly.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 border-t flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:text-zinc-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handlePromote}
                        disabled={!selectedClassId || isLoading}
                        className="px-6 py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-primary/20 flex items-center gap-2"
                    >
                        Proceed to Promote
                    </button>
                </div>
            </div>
        </div>
    );
}
