"use client";

import { useEffect, useState } from "react";
import { attendanceService, DeviceHealth, DeviceHealthState } from "@/lib/attendance.service";
import { formatServerTime } from "@/lib/zk-time";

const REFRESH_MS = 60_000;

const STATE_STYLE: Record<DeviceHealthState, { chip: string; dot: string; label: string }> = {
    ok: { chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", dot: "bg-emerald-500", label: "Healthy" },
    warn: { chip: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", dot: "bg-amber-500", label: "Quiet" },
    alert: { chip: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", dot: "bg-orange-500", label: "Concerning" },
    critical: { chip: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400", dot: "bg-rose-500", label: "Offline" },
    off_hours: { chip: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400", dot: "bg-zinc-400", label: "Not expected" },
    never: { chip: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400", dot: "bg-rose-500", label: "Never seen" },
};

const REASON_LABEL = { sunday: "Sunday", saturday: "Saturday", after_hours: "after hours" } as const;

function ago(min: number | null): string {
    if (min === null) return "no contact yet";
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    if (min < 24 * 60) return `${Math.floor(min / 60)}h ${min % 60}m ago`;
    return `${Math.floor(min / (24 * 60))}d ago`;
}

export function DeviceHealthStrip() {
    const [devices, setDevices] = useState<DeviceHealth[] | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const data = await attendanceService.getDeviceHealth();
                if (!cancelled) { setDevices(data); setFailed(false); }
            } catch {
                if (!cancelled) setFailed(true);
            }
        };
        load();
        const id = setInterval(load, REFRESH_MS);
        return () => { cancelled = true; clearInterval(id); };
    }, []);

    // Hidden until there is something to show; also stays hidden for users the
    // endpoint rejects (no attendance permission) instead of showing an error.
    if (!devices?.length) return null;

    return (
        <div className="rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-black font-outfit text-zinc-900 dark:text-zinc-50">Device health</h2>
                {failed && <span className="text-xs text-rose-600 dark:text-rose-400">Couldn&apos;t refresh — showing last known</span>}
            </div>
            <div className="flex flex-wrap gap-2">
                {devices?.map((d) => {
                    const st = STATE_STYLE[d.state];
                    const detail = d.state === "off_hours" && d.not_expected_reason
                        ? `Not expected (${REASON_LABEL[d.not_expected_reason]})`
                        : `${st.label} · ${ago(d.minutes_since)}`;
                    return (
                        <div
                            key={d.sn}
                            title={`${d.name} (${d.sn})\nLast contact: ${formatServerTime(d.last_contact_at)}`}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${st.chip}`}
                        >
                            <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                            <span className="font-semibold">{d.name}</span>
                            <span className="opacity-80">{detail}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
