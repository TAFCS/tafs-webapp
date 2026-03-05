"use client";

import { FamiliesDataTable } from "@/features/families/components/families-data-table";
import { Link as LinkIcon, Users } from "lucide-react";
import { useState } from "react";

export default function FamiliesPage() {
    const [isCreateFamilyModalOpen, setIsCreateFamilyModalOpen] = useState(false);
    const [isChangeFamilyModalOpen, setIsChangeFamilyModalOpen] = useState(false);

    return (
        <div className="flex-1 h-[calc(100vh-64px)] flex flex-col p-6 overflow-hidden">
            <div className="mb-6 flex-shrink-0 flex flex-col lg:flex-row justify-between lg:items-end gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-900 border-b pb-2">Family & Household Directory</h2>
                    <p className="text-zinc-500 mt-2">Manage household connections, review sibling links, and monitor family-level financial statuses.</p>
                </div>

                {/* Global Action Buttons */}
                <div className="flex items-center gap-2 w-full lg:w-auto mt-2 lg:mt-0">
                    <button
                        onClick={() => setIsCreateFamilyModalOpen(true)}
                        className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm font-medium"
                    >
                        <Users className="h-4 w-4" />
                        Create New Family
                    </button>
                    <button
                        onClick={() => setIsChangeFamilyModalOpen(true)}
                        className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-zinc-700 rounded-lg hover:bg-zinc-50 transition-colors shadow-sm font-medium"
                    >
                        <LinkIcon className="h-4 w-4" />
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
