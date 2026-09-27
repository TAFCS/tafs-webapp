import { useEffect, useState } from "react";
import api from "@/lib/api";

/**
 * Same-day attendance override cut-off (TAFSD-205).
 *
 * A past day can always be overridden. TODAY can be overridden once it is
 * complete (clocked in and out), or — whatever the punches — once the PKT clock
 * reaches the cut-off set on Developer Settings (app_config
 * `attendance_same_day_override_cutoff`, default 15:00). The backend has no
 * same-day block of its own, so this is the one place the rule lives.
 */

export const DEFAULT_OVERRIDE_CUTOFF = "15:00";

const pktParts = (now: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Karachi",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
    return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
};

/** Today's date in Pakistan, YYYY-MM-DD. */
export function pktTodayIso(now: Date = new Date()): string {
    return pktParts(now).date;
}

/** True once the PKT clock has reached the "HH:MM" cut-off. */
export function isPastOverrideCutoff(cutoff: string, now: Date = new Date()): boolean {
    const m = /^(\d{2}):(\d{2})$/.exec(cutoff) ?? /^(\d{2}):(\d{2})$/.exec(DEFAULT_OVERRIDE_CUTOFF)!;
    return pktParts(now).minutes >= Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Whether a day may be overridden, as far as its date goes. Callers still apply
 * their own working-day / permission / finalised-run checks on top.
 */
export function isDayOverridable(
    date: string,
    opts: { cutoff: string; hasCheckIn: boolean; hasCheckOut: boolean; now?: Date },
): boolean {
    const now = opts.now ?? new Date();
    const today = pktTodayIso(now);
    if (date < today) return true;
    if (date > today) return false;
    return (opts.hasCheckIn && opts.hasCheckOut) || isPastOverrideCutoff(opts.cutoff, now);
}

let cached: Promise<string> | null = null;

function fetchCutoff(): Promise<string> {
    if (!cached) {
        cached = api
            .get("/v1/app-config/attendance-override-cutoff")
            .then(({ data }) => data?.data?.cutoff ?? DEFAULT_OVERRIDE_CUTOFF)
            .catch(() => {
                cached = null; // retry on the next mount
                return DEFAULT_OVERRIDE_CUTOFF;
            });
    }
    return cached;
}

/** Forget the cached value (after Developer Settings saves a new one). */
export function invalidateOverrideCutoff() {
    cached = null;
}

/** The configured cut-off ("HH:MM"), starting from the default until loaded. */
export function useOverrideCutoff(): string {
    const [cutoff, setCutoff] = useState(DEFAULT_OVERRIDE_CUTOFF);
    useEffect(() => {
        let alive = true;
        fetchCutoff().then((v) => alive && setCutoff(v));
        return () => {
            alive = false;
        };
    }, []);
    return cutoff;
}
