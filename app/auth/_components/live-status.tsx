"use client";

import { greetingFor, pktClock, pktHour, useNow } from "./pkt-time";

/** "Karachi 1:12 AM · Burning the midnight oil" with a live sync dot. */
export function LiveStatus() {
    const now = useNow();
    return (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-slate-400">
            <span className="inline-flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                    <span className="tfs-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400/70" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                All campuses in sync
            </span>
            <span className="tabular-nums">
                Karachi <span className="text-slate-200">{now ? pktClock(now) : "--:--"}</span>
            </span>
            {now && <span className="hidden sm:inline text-slate-500">{greetingFor(pktHour(now))}</span>}
        </div>
    );
}
