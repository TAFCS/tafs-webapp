"use client";

import { FamiliesDataTable } from "@/features/families/components/families-data-table";
import { familiesService, type FamilyStats } from "@/lib/families.service";
import { useFamiliesAccess } from "@/hooks/use-families-access";
import { Link as LinkIcon, Users, UserCheck, Smartphone, Play, ShieldAlert } from "lucide-react";
import { useState, useEffect } from "react";
import { VideoDemoModal } from "@/components/VideoDemoModal";

const DEFAULT_FAMILIES_DEMO_VIDEO_URL =
    "https://tafs-assets.sgp1.cdn.digitaloceanspaces.com/demos/families/families-demo.mp4";

const familiesDemoVideoUrl =
    process.env.NEXT_PUBLIC_FAMILIES_DEMO_VIDEO_URL?.trim() || DEFAULT_FAMILIES_DEMO_VIDEO_URL;

const STAT_CONFIG = [
    {
        key: "total" as keyof FamilyStats,
        label: "Total Families",
        icon: Users,
        iconBg: "bg-indigo-50",
        iconColor: "text-indigo-600",
        valueFn: (v: number, _stats: FamilyStats) => v.toLocaleString(),
    },
    {
        key: "activeWithChildren" as keyof FamilyStats,
        label: "Active w/ Children",
        icon: UserCheck,
        iconBg: "bg-emerald-50",
        iconColor: "text-emerald-600",
        valueFn: (v: number, _stats: FamilyStats) => v.toLocaleString(),
    },
    {
        key: "withCredentials" as keyof FamilyStats,
        label: "With Credentials",
        icon: Smartphone,
        iconBg: "bg-sky-50",
        iconColor: "text-sky-600",
        valueFn: (v: number, stats: FamilyStats) =>
            `${v.toLocaleString()} (${stats.kidsInCredentialedFamilies.toLocaleString()} kids)`,
    },
];

export default function FamiliesPage() {
    const access = useFamiliesAccess();
    const [isCreateFamilyModalOpen, setIsCreateFamilyModalOpen] = useState(false);
    const [isChangeFamilyModalOpen, setIsChangeFamilyModalOpen] = useState(false);
    const [isDemoOpen, setIsDemoOpen] = useState(false);
    const [stats, setStats] = useState<FamilyStats | null>(null);
    const [isStatsLoading, setIsStatsLoading] = useState(true);

    useEffect(() => {
        if (!access.can("view")) {
            setIsStatsLoading(false);
            return;
        }
        familiesService.getStats()
            .then(setStats)
            .catch(() => { /* silently fail — stats are non-critical */ })
            .finally(() => setIsStatsLoading(false));
    }, [access]);

    if (access.hasTile && !access.can("view") && !access.staleSession) {
        return (
            <div className="p-12 text-center bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center mb-4">
                    <ShieldAlert className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Permission Denied</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
                    You have access to the Family Directory tile, but viewing household records has been restricted by your administrator.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-[22px] font-black tracking-tight text-zinc-900 dark:text-zinc-100">Family Directory</h1>
                    <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-0.5">Search and manage all household connections, guardians, and sibling rosters.</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => setIsDemoOpen(true)}
                        className="flex items-center gap-1.5 px-4 h-9 text-[11px] font-bold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <Play className="h-3.5 w-3.5" />
                        DEMO
                    </button>
                    {access.can("create") && (
                        <button
                            onClick={() => setIsCreateFamilyModalOpen(true)}
                            className="inline-flex items-center justify-center h-9 px-4 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all font-bold text-[12px] shadow-sm active:scale-95"
                        >
                            <Users className="h-3.5 w-3.5 mr-1.5" />
                            Create Family
                        </button>
                    )}
                    {access.can("assign_student") && (
                        <button
                            onClick={() => setIsChangeFamilyModalOpen(true)}
                            className="inline-flex items-center justify-center h-9 px-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-all font-bold text-[12px] shadow-sm active:scale-95"
                        >
                            <LinkIcon className="h-3.5 w-3.5 mr-1.5" />
                            Change Family
                        </button>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {STAT_CONFIG.map(({ key, label, icon: Icon, iconBg, iconColor, valueFn }) => (
                    <div
                        key={key}
                        className="bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-4 flex items-center gap-4 shadow-sm"
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                            <Icon className={`h-5 w-5 ${iconColor}`} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em] leading-tight">
                                {label}
                            </p>
                            {isStatsLoading ? (
                                <div className="h-7 w-20 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-lg mt-1.5" />
                            ) : (
                                <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mt-0.5 tracking-tight font-outfit">
                                    {stats ? valueFn(stats[key], stats) : "—"}
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

            <VideoDemoModal
                isOpen={isDemoOpen}
                onClose={() => setIsDemoOpen(false)}
                videoUrl={familiesDemoVideoUrl}
                title="Families Demo"
            />
        </div>
    );
}

