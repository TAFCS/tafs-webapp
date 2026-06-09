"use client";

import { FamiliesDataTable } from "@/features/families/components/families-data-table";
import { Link as LinkIcon, Users, RefreshCw } from "lucide-react";
import { useState } from "react";

export default function FamiliesPage() {
    const [isCreateFamilyModalOpen, setIsCreateFamilyModalOpen] = useState(false);
    const [isChangeFamilyModalOpen, setIsChangeFamilyModalOpen] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const handleRefresh = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    return (
        <div className="space-y-6 p-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                        <span className="p-2 bg-primary/10 rounded-xl">
                            <Users className="h-6 w-6 text-primary" />
                        </span>
                        Family Directory
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm">
                        Search and manage all household connections, parent credentials, and sibling roster links.
                    </p>
                </div>

                {/* Global Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={handleRefresh}
                        className="inline-flex items-center justify-center h-10 px-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-all font-semibold text-xs shadow-sm active:scale-95"
                    >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </button>
                    <button
                        onClick={() => setIsCreateFamilyModalOpen(true)}
                        className="inline-flex items-center justify-center h-10 px-4 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all font-semibold text-xs shadow-sm active:scale-95"
                    >
                        <Users className="h-4 w-4 mr-2" />
                        Create New Family
                    </button>
                    <button
                        onClick={() => setIsChangeFamilyModalOpen(true)}
                        className="inline-flex items-center justify-center h-10 px-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-all font-semibold text-xs shadow-sm active:scale-95"
                    >
                        <LinkIcon className="h-4 w-4 mr-2" />
                        Change Student&apos;s Family
                    </button>
                </div>
            </div>

            <FamiliesDataTable
                isCreateOpen={isCreateFamilyModalOpen}
                onCloseCreate={() => setIsCreateFamilyModalOpen(false)}
                isAssignOpen={isChangeFamilyModalOpen}
                onCloseAssign={() => setIsChangeFamilyModalOpen(false)}
                refreshTrigger={refreshTrigger}
            />
        </div>
    );
}
