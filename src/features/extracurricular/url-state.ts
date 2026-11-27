"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * TAFSD-605: filter state for the Extracurricular Fees pages lives in the URL
 * (Rule 1), comma-joined, so a filtered view can be shared and reloaded. Empty
 * arrays are left out: empty means "all", never "none".
 */

export const parseIds = (v: string | null): number[] =>
    (v ?? "")
        .split(",")
        .map((x) => Number(x))
        .filter((x) => Number.isInteger(x) && x > 0);

export function parseList<T extends string>(v: string | null, allowed: readonly T[]): T[] {
    const set = new Set<string>(allowed);
    return (v ?? "")
        .split(",")
        .map((x) => x.trim())
        .filter((x): x is T => set.has(x));
}

type UrlValue = string | number | boolean | null | undefined | ReadonlyArray<string | number>;

/** Mirrors `values` into the query string with router.replace (no history spam, no scroll). */
export function useUrlSync(values: Record<string, UrlValue>) {
    const router = useRouter();
    const pathname = usePathname();
    const qs = useMemo(() => {
        const p = new URLSearchParams();
        for (const [k, v] of Object.entries(values)) {
            if (v == null || v === false || v === "") continue;
            if (Array.isArray(v)) {
                if (v.length) p.set(k, v.join(","));
            } else {
                p.set(k, v === true ? "1" : String(v));
            }
        }
        return p.toString();
        // values is rebuilt every render; compare by content.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(values)]);

    useEffect(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, [qs, pathname, router]);
}

export function useDebounced<T>(value: T, ms = 300): T {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return v;
}
