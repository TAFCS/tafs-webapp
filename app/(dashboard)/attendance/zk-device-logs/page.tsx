"use client";

import { useState } from "react";
import { Activity, ShieldAlert } from "lucide-react";
import { useAuthState } from "@/context/AuthContext";
import { RawLogsTab } from "./_components/raw-logs-tab";
import { PinMappingsTab } from "./_components/pin-mappings-tab";
import { UnmappedPinsTab } from "./_components/unmapped-pins-tab";

type TabKey = "raw" | "mappings" | "unmapped";

const TABS: { key: TabKey; label: string }[] = [
    { key: "raw", label: "Raw Logs" },
    { key: "mappings", label: "PIN Mappings" },
    { key: "unmapped", label: "Unmapped PINs" },
];

export default function ZkDeviceLogsPage() {
    const { user } = useAuthState();
    const [activeTab, setActiveTab] = useState<TabKey>("raw");

    if (user && user.role !== "SUPER_ADMIN") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="p-4 bg-red-50 text-red-500 rounded-full">
                    <ShieldAlert className="h-12 w-12" />
                </div>
                <h2 className="text-xl font-black text-zinc-800">Access Denied</h2>
                <p className="text-zinc-500 max-w-xs text-center text-sm font-medium">
                    Only Super Administrator accounts are authorized to view ZK device logs.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                    <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">ZK Device Attendance</h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        Raw payloads, PIN-to-person mappings, and unmapped device PINs
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl w-fit">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            activeTab === tab.key
                                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content — all stay mounted so polling/state isn't lost on switch */}
            <div className={activeTab === "raw" ? "" : "hidden"}>
                <RawLogsTab active={activeTab === "raw"} />
            </div>
            <div className={activeTab === "mappings" ? "" : "hidden"}>
                <PinMappingsTab active={activeTab === "mappings"} />
            </div>
            <div className={activeTab === "unmapped" ? "" : "hidden"}>
                <UnmappedPinsTab active={activeTab === "unmapped"} />
            </div>
        </div>
    );
}
