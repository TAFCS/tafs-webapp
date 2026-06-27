"use client";

import { FamiliesDataTable } from "@/features/families/components/families-data-table";
import { Link as LinkIcon, Users } from "lucide-react";
import { useState } from "react";

export default function FamiliesPage() {
    const [isCreateFamilyModalOpen, setIsCreateFamilyModalOpen] = useState(false);
    const [isChangeFamilyModalOpen, setIsChangeFamilyModalOpen] = useState(false);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-[22px] font-black tracking-tight text-zinc-900">Family Directory</h1>
                    <p className="text-[13px] text-zinc-500 mt-0.5">Search and manage all household connections, guardians, and sibling rosters.</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => setIsCreateFamilyModalOpen(true)}
                        className="inline-flex items-center justify-center h-9 px-4 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all font-bold text-[12px] shadow-sm active:scale-95"
                    >
                        <Users className="h-3.5 w-3.5 mr-1.5" />
                        Create Family
                    </button>
                    <button
                        onClick={() => setIsChangeFamilyModalOpen(true)}
                        className="inline-flex items-center justify-center h-9 px-4 bg-white border border-zinc-200 text-zinc-600 rounded-xl hover:border-zinc-300 transition-all font-bold text-[12px] shadow-sm active:scale-95"
                    >
                        <LinkIcon className="h-3.5 w-3.5 mr-1.5" />
                        Change Family
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
