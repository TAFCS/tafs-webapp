/**
 * Two kinds of timestamp come off the ZK attendance endpoints and they must be
 * rendered differently.
 *
 * Scan times (scan_time, first/last seen, check-in/out) are the reader's own
 * Pakistan wall clock. The backend parses them with Date.UTC(...) and stores
 * them in a timestamp-without-zone column, so they arrive labelled UTC while
 * meaning PKT. Rendering those in the browser's zone shifts them by the local
 * offset — +5h on a PKT machine — which is why they read five hours late.
 * Formatting them in UTC hands back the exact wall clock the device recorded.
 *
 * Server timestamps (audit changed_at, name-hint updated_at, received_at) come
 * from now() and are true instants, so those convert into Asia/Karachi normally.
 */

const BASE: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
};

/** A device wall-clock timestamp (scan times) — rendered as the PKT the reader saw. */
export function formatDeviceTime(iso: string | null | undefined, withYear = false): string {
    if (!iso) return "—";
    return `${new Date(iso).toLocaleString("en-PK", {
        ...BASE,
        ...(withYear ? { year: "numeric" } : {}),
        timeZone: "UTC",
    })} PKT`;
}

/** A true instant recorded by the server — converted into PKT. */
export function formatServerTime(iso: string | null | undefined, withYear = false): string {
    if (!iso) return "—";
    return `${new Date(iso).toLocaleString("en-PK", {
        ...BASE,
        ...(withYear ? { year: "numeric" } : {}),
        timeZone: "Asia/Karachi",
    })} PKT`;
}
