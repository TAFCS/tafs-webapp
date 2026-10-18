"use client";

import { useEffect, useState } from "react";

// TAFS runs on Pakistan time wherever the browser happens to be.
const PKT = "Asia/Karachi";

export function pktHour(d: Date): number {
    return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: PKT }).format(d));
}

export function pktClock(d: Date): string {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: PKT }).format(d);
}

export function greetingFor(hour: number): string {
    if (hour < 5) return "Burning the midnight oil";
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
}

/** Current time, or null until mounted (keeps server and client HTML identical). */
export function useNow(intervalMs = 15_000): Date | null {
    const [now, setNow] = useState<Date | null>(null);
    useEffect(() => {
        setNow(new Date());
        const t = setInterval(() => setNow(new Date()), intervalMs);
        return () => clearInterval(t);
    }, [intervalMs]);
    return now;
}
