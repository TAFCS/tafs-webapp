"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, Tag, UserPlus } from "lucide-react";
import { zkPushService, UnmappedPin } from "@/lib/zk-push.service";
import { MappingModal } from "./pin-mappings-tab";

function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString("en-PK", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
}

export function UnmappedPinsTab({ active }: { active: boolean }) {
    const [pins, setPins] = useState<UnmappedPin[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mappingTarget, setMappingTarget] = useState<UnmappedPin | null>(null);

    const fetchPins = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await zkPushService.getUnmappedPins();
            setPins(data);
        } catch {
            setError("Failed to load unmapped PINs.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (active) fetchPins();
    }, [active, fetchPins]);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <span className="font-medium text-zinc-700 dark:text-zinc-200">{pins.length}</span> unmapped PINs with
                scan activity
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                {loading && pins.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-16 text-zinc-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm">Loading unmapped PINs…</span>
                    </div>
                ) : pins.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-16 text-zinc-400">
                        <Tag className="w-8 h-8 opacity-30" />
                        <p className="text-sm">No unmapped PINs — every scanning device PIN is mapped.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                                    <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Device SN
                                    </th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        PIN
                                    </th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Suggested Name
                                    </th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Scans
                                    </th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">
                                        First Seen
                                    </th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">
                                        Last Seen
                                    </th>
                                    <th className="px-4 py-2.5 w-32" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {pins.map((p) => (
                                    <tr
                                        key={`${p.device_sn}:${p.device_pin}`}
                                        className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                                    >
                                        <td className="px-4 py-3 text-sm font-mono text-zinc-700 dark:text-zinc-200">{p.device_sn}</td>
                                        <td className="px-4 py-3 text-sm font-mono text-zinc-700 dark:text-zinc-200">{p.device_pin}</td>
                                        <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">
                                            {p.suggested_name ?? <span className="text-zinc-400 italic">unknown</span>}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{p.scan_count}</td>
                                        <td className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                                            {formatDateTime(p.first_seen)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                                            {formatDateTime(p.last_seen)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => setMappingTarget(p)}
                                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                                            >
                                                <UserPlus className="w-3.5 h-3.5" />
                                                Map this PIN
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {mappingTarget && (
                <MappingModal
                    mapping={null}
                    prefill={mappingTarget}
                    onClose={() => setMappingTarget(null)}
                    onSaved={fetchPins}
                />
            )}
        </div>
    );
}
