"use client";

import { useState } from "react";
import { X, Plus, Trash2, Calendar, LayoutGrid, Info } from "lucide-react";
import { TabAddSingle } from "./TabAddSingle";
import { TabAddRange } from "./TabAddRange";
import { TabDeleteSingle } from "./TabDeleteSingle";
import { TabDeleteRange } from "./TabDeleteRange";

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

type TabType = "add_single" | "add_range" | "delete_single" | "delete_range";

export function BulkOperationsDrawer({ isOpen, onClose }: Props) {
    const [activeTab, setActiveTab] = useState<TabType>("add_single");

    if (!isOpen) return null;

    const tabs: { id: TabType; label: string; icon: any; color: string }[] = [
        { id: "add_single", label: "Add (Single)", icon: Plus, color: "text-emerald-600" },
        { id: "add_range", label: "Add (Range)", icon: Calendar, color: "text-emerald-600" },
        { id: "delete_single", label: "Delete (Single)", icon: Trash2, color: "text-rose-600" },
        { id: "delete_range", label: "Delete (Range)", icon: LayoutGrid, color: "text-rose-600" },
    ];

    return (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-zinc-950 flex flex-col h-screen overflow-hidden animate-in slide-in-from-bottom duration-500">
            {/* Header / Navbar */}
            <div className="px-8 py-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-950 sticky top-0 z-20">
                <div className="flex items-center gap-6">
                    <button 
                        onClick={onClose}
                        className="p-3 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-2xl transition-all active:scale-95 group"
                    >
                        <X className="h-6 w-6 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors" />
                    </button>
                    <div>
                        <h2 className="text-3xl font-black tracking-tighter text-zinc-900 dark:text-zinc-100 uppercase">Bulk Operations</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                            <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase italic">Global Fee Management System</p>
                        </div>
                    </div>
                </div>

                {/* Tabs Navigation in Header */}
                <div className="hidden lg:flex bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        const isAdd = tab.id.startsWith("add");
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    flex items-center gap-3 px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all
                                    ${isActive 
                                        ? "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white shadow-xl scale-105 z-10" 
                                        : "text-zinc-400 hover:text-zinc-600"
                                    }
                                `}
                            >
                                <div className={`
                                    p-1.5 rounded-lg transition-colors
                                    ${isActive 
                                        ? (isAdd ? "bg-emerald-500 text-white" : "bg-rose-500 text-white") 
                                        : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400"
                                    }
                                `}>
                                    <Icon className="h-3.5 w-3.5" />
                                </div>
                                <div className="flex flex-col items-start leading-none">
                                    <span className={`text-[8px] font-black mb-0.5 ${isActive ? (isAdd ? "text-emerald-500" : "text-rose-500") : "text-zinc-400"}`}>
                                        {isAdd ? "ADD" : "DELETE"}
                                    </span>
                                    <span>{tab.label.split(" (")[1].replace(")", "")}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden sm:block text-right">
                        <p className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">Transaction Mode</p>
                        <p className="text-[11px] font-bold text-emerald-500">Auto-Atomic per Student</p>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-zinc-50/30 dark:bg-zinc-950/30 custom-scrollbar">
                {/* Mobile Tabs */}
                <div className="lg:hidden px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex gap-2 overflow-x-auto no-scrollbar">
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                             <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${isActive ? "bg-zinc-900 text-white" : "text-zinc-400 bg-zinc-100"}`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                <div className="max-w-4xl mx-auto px-6 py-12">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] shadow-2xl shadow-zinc-200/50 dark:shadow-none p-8 md:p-12 animate-in fade-in slide-in-from-bottom-12 duration-700">
                        {activeTab === "add_single" && <TabAddSingle />}
                        {activeTab === "add_range" && <TabAddRange />}
                        {activeTab === "delete_single" && <TabDeleteSingle />}
                        {activeTab === "delete_range" && <TabDeleteRange />}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-xl">
                        <Info className="h-4 w-4 text-zinc-400" />
                    </div>
                    <p className="text-[10px] font-medium text-zinc-400 leading-tight max-w-md">
                        This operation affects the core <span className="text-zinc-600 dark:text-zinc-200 font-bold uppercase">student_fees</span> table. 
                        By confirming, you agree that each insert/delete is verified independently. 
                        <b> Vouchers protect existing heads from deletion.</b>
                    </p>
                </div>
                <div className="flex gap-2">
                    <kbd className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700 text-[9px] font-bold text-zinc-400 uppercase tracking-tighter shadow-sm">ESC TO EXIT</kbd>
                </div>
            </div>
        </div>
    );
}
