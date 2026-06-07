"use client";

import { FamiliesDataTable } from "@/features/families/components/families-data-table";
import { Link as LinkIcon, Users } from "lucide-react";
import { useState } from "react";

export default function FamiliesPage() {
    const [isCreateFamilyModalOpen, setIsCreateFamilyModalOpen] = useState(false);
    const [isChangeFamilyModalOpen, setIsChangeFamilyModalOpen] = useState(false);

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-[22px] font-black tracking-tight text-zinc-900 dark:text-zinc-100">Family & Household Directory</h1>
                    <p className="text-[13px] text-zinc-500 mt-0.5">
                        Search and manage all household connections, parent credentials, and sibling roster links.
                    </p>
                </div>

                {/* Global Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => setIsCreateFamilyModalOpen(true)}
                        className="inline-flex items-center justify-center h-10 px-4 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all font-medium text-xs shadow-sm active:scale-95"
                    >
                        <Users className="h-4 w-4 mr-2" />
                        Create New Family
                    </button>
                    <button
                        onClick={() => setIsChangeFamilyModalOpen(true)}
                        className="inline-flex items-center justify-center h-10 px-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all font-medium text-xs shadow-sm active:scale-95"
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
            />
        </div>
    );
}
