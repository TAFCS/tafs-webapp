"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, GraduationCap, DoorOpen, Ban, Loader2, AlertTriangle } from "lucide-react";

interface LifecycleActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => Promise<void>;
    action: "graduate" | "expel" | "left";
    studentName: string;
}

const actionConfig = {
    graduate: {
        title: "Graduate Student",
        verb: "Graduate",
        icon: GraduationCap,
        color: "violet",
        bg: "bg-violet-50",
        text: "text-violet-600",
        border: "border-violet-200",
        btn: "bg-violet-600 hover:bg-violet-700",
        description: "This will mark the student as graduated. They will no longer appear in active enrollment lists."
    },
    expel: {
        title: "Expel Student",
        verb: "Expel",
        icon: Ban,
        color: "rose",
        bg: "bg-rose-50",
        text: "text-rose-600",
        border: "border-rose-200",
        btn: "bg-rose-600 hover:bg-rose-700",
        description: "This is a permanent action. The student will be removed from classes due to disciplinary or other reasons."
    },
    left: {
        title: "Mark as Left",
        verb: "Mark as Left",
        icon: DoorOpen,
        color: "amber",
        bg: "bg-amber-50",
        text: "text-amber-600",
        border: "border-amber-200",
        btn: "bg-amber-600 hover:bg-amber-700",
        description: "Use this if the student has withdrawn from the school (e.g. transfer, family moving)."
    }
};

export function LifecycleActionModal({ isOpen, onClose, onConfirm, action, studentName }: LifecycleActionModalProps) {
    const [reason, setReason] = useState("");
    const [loading, setLoading] = useState(false);
    
    const config = actionConfig[action];
    const Icon = config.icon;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onConfirm(reason);
            onClose();
            setReason("");
        } catch (error) {
            // Error handled by parent
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden"
                    >
                        {/* Header */}
                        <div className={`p-6 ${config.bg} border-b ${config.border} flex items-start justify-between`}>
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-2xl bg-white shadow-sm ${config.text}`}>
                                    <Icon className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-zinc-900 leading-tight">
                                        {config.title}
                                    </h3>
                                    <p className={`text-sm font-medium ${config.text} opacity-80`}>
                                        {studentName}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/50 rounded-xl transition-colors text-zinc-400 hover:text-zinc-600"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4 flex gap-3">
                                <AlertTriangle className="h-5 w-5 text-zinc-400 shrink-0 mt-0.5" />
                                <p className="text-sm text-zinc-600 leading-relaxed">
                                    {config.description}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-zinc-700 ml-1">
                                    Reason for {config.verb}
                                </label>
                                <textarea
                                    autoFocus
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Enter a brief explanation..."
                                    className="w-full h-32 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-zinc-100 focus:border-zinc-300 transition-all outline-none resize-none text-zinc-800 placeholder:text-zinc-400"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-6 py-3.5 rounded-2xl font-bold text-zinc-600 hover:bg-zinc-100 transition-all active:scale-95"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`flex-[2] px-6 py-3.5 rounded-2xl font-bold text-white shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${config.btn}`}
                                >
                                    {loading ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <>
                                            Confirm {config.verb}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
