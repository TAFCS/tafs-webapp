"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight, Loader2, RefreshCw, Wifi } from "lucide-react";
import { zkPushService, ZkPushLog } from "@/lib/zk-push.service";

function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString("en-PK", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    });
}

function LogRow({ log }: { log: ZkPushLog }) {
    const [expanded, setExpanded] = useState(false);
    const payload = log.raw_payload as {
        sn?: string;
        query?: Record<string, string>;
        body?: string;
    };
    const query = payload.query ?? {};
    const body = payload.body ?? "";
    const bodyPreview = body.replace(/\s+/g, " ").trim();

    return (
        <>
            <tr
                className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors"
                onClick={() => setExpanded((p) => !p)}
            >
                <td className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                    {formatTime(log.received_at)}
                </td>
                <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-sm font-mono font-medium text-zinc-700 dark:text-zinc-200">
                        <Wifi className="w-3.5 h-3.5 text-green-500" />
                        {log.sn}
                    </span>
                </td>
                <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300 font-mono">
                    {query["table"] ?? "—"}
                </td>
                <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300 font-mono">
                    {query["Stamp"] ?? "—"}
                </td>
                <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300 font-mono max-w-md truncate">
                    {bodyPreview || <span className="text-zinc-400 italic">empty</span>}
                </td>
                <td className="px-4 py-3 text-zinc-400">
                    {expanded ? (
                        <ChevronDown className="w-4 h-4" />
                    ) : (
                        <ChevronRight className="w-4 h-4" />
                    )}
                </td>
            </tr>
            {expanded && (
                <tr className="bg-zinc-50 dark:bg-zinc-900/50">
                    <td colSpan={6} className="px-4 pb-3 pt-1 space-y-2">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                                Query Params
                            </p>
                            <pre className="text-xs font-mono text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all">
                                {JSON.stringify(query, null, 2)}
                            </pre>
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                                Raw Body
                            </p>
                            <pre className="text-xs font-mono text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all">
                                {body || "(empty)"}
                            </pre>
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                                Full Payload
                            </p>
                            <pre className="text-xs font-mono text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all">
                                {JSON.stringify(log.raw_payload, null, 2)}
                            </pre>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

export function RawLogsTab({ active }: { active: boolean }) {
    const [logs, setLogs] = useState<ZkPushLog[]>([]);
    const [devices, setDevices] = useState<string[]>([]);
    const [filterSn, setFilterSn] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await zkPushService.getLogs(filterSn || undefined);
            setLogs(data.logs);
            setDevices(data.devices);
            setLastRefresh(new Date());
        } catch {
            setError("Failed to load device logs. Check that you are logged in.");
        } finally {
            setLoading(false);
        }
    }, [filterSn]);

    useEffect(() => {
        if (active) fetchLogs();
    }, [fetchLogs, active]);

    useEffect(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (autoRefresh && active) {
            intervalRef.current = setInterval(fetchLogs, 10000);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [autoRefresh, fetchLogs, active]);

    return (
        <div className="space-y-6">
            {/* Stats + Filter */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                        <span className="font-medium text-zinc-700 dark:text-zinc-200">{logs.length}</span> events
                        {lastRefresh && (
                            <span className="text-zinc-400 dark:text-zinc-500">
                                · last at {lastRefresh.toLocaleTimeString()}
                            </span>
                        )}
                    </div>
                    {devices.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">Filter device:</span>
                            <button
                                onClick={() => setFilterSn("")}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                    filterSn === ""
                                        ? "bg-zinc-800 text-white dark:bg-white dark:text-zinc-900"
                                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                }`}
                            >
                                All
                            </button>
                            {devices.map((sn) => (
                                <button
                                    key={sn}
                                    onClick={() => setFilterSn(sn)}
                                    className={`px-2.5 py-1 rounded-full text-xs font-mono font-medium transition-colors ${
                                        filterSn === sn
                                            ? "bg-green-600 text-white"
                                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                    }`}
                                >
                                    {sn}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setAutoRefresh((p) => !p)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            autoRefresh
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                    >
                        {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
                    </button>
                    <button
                        onClick={fetchLogs}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            {/* Table */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                {loading && logs.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-16 text-zinc-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm">Loading logs…</span>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-16 text-zinc-400">
                        <Wifi className="w-8 h-8 opacity-30" />
                        <p className="text-sm">No push events received yet.</p>
                        <p className="text-xs text-zinc-400 max-w-sm text-center">
                            Configure the device server address to point at this domain on port 80,
                            then scan a card or fingerprint. The device pushes to{" "}
                            <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded">
                                /iclock/cdata
                            </code>
                            .
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                                    <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">
                                        Received At
                                    </th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Device SN
                                    </th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Table
                                    </th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Stamp
                                    </th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Body
                                    </th>
                                    <th className="px-4 py-2.5 w-8" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {logs.map((log) => (
                                    <LogRow key={log.id} log={log} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
