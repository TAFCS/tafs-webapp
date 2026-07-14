"use client";

import { FamiliesDataTable } from "@/features/families/components/families-data-table";
import { familiesService, type FamilyStats } from "@/lib/families.service";
import { Link as LinkIcon, Users, Smartphone, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";

const STAT_CONFIG = [
    {
        key: "total" as keyof FamilyStats,
        label: "Total Families",
        icon: Users,
        iconBg: "bg-indigo-50",
        iconColor: "text-indigo-600",
        valueFn: (v: number) => v.toLocaleString(),
    },
    {
        key: "registeredOnApp" as keyof FamilyStats,
        label: "Registered on App",
        icon: Smartphone,
        iconBg: "bg-emerald-50",
        iconColor: "text-emerald-600",
        valueFn: (v: number) => v.toLocaleString(),
    },
    {
        key: "notConfigured" as keyof FamilyStats,
        label: "Not Configured",
        icon: AlertCircle,
        iconBg: "bg-amber-50",
        iconColor: "text-amber-600",
        valueFn: (v: number) => v.toLocaleString(),
    },
];

export default function FamiliesPage() {
    const [isCreateFamilyModalOpen, setIsCreateFamilyModalOpen] = useState(false);
    const [isChangeFamilyModalOpen, setIsChangeFamilyModalOpen] = useState(false);
    const [stats, setStats] = useState<FamilyStats | null>(null);
    const [isStatsLoading, setIsStatsLoading] = useState(true);

    useEffect(() => {
        familiesService.getStats()
            .then(setStats)
            .catch(() => { /* silently fail — stats are non-critical */ })
            .finally(() => setIsStatsLoading(false));
    }, []);

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

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {STAT_CONFIG.map(({ key, label, icon: Icon, iconBg, iconColor, valueFn }) => (
                    <div
                        key={key}
                        className="bg-white border border-zinc-100 rounded-2xl p-4 flex items-center gap-4 shadow-sm"
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                            <Icon className={`h-5 w-5 ${iconColor}`} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] leading-tight">
                                {label}
                            </p>
                            {isStatsLoading ? (
                                <div className="h-7 w-20 bg-zinc-100 animate-pulse rounded-lg mt-1.5" />
                            ) : (
                                <p className="text-2xl font-black text-zinc-900 mt-0.5 tracking-tight font-outfit">
                                    {stats ? valueFn(stats[key]) : "—"}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
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
