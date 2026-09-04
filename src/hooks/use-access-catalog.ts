"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import {
    mergeNavModules,
    type AccessCatalog,
    type NavModule,
} from "@/lib/nav-config";

let cachedCatalog: AccessCatalog | null = null;
let inflight: Promise<AccessCatalog | null> | null = null;
let lastFetchedAt = 0;
let focusListenerAttached = false;
const subscribers = new Set<() => void>();

const FOCUS_TTL_MS = 60_000;

function notify() {
    subscribers.forEach((fn) => fn());
}

async function fetchCatalog(force = false): Promise<AccessCatalog | null> {
    if (!force && cachedCatalog && Date.now() - lastFetchedAt < FOCUS_TTL_MS) {
        return cachedCatalog;
    }
    if (inflight) return inflight;

    inflight = api
        .get("/v1/access/tiles")
        .then(({ data }) => {
            const next = (data.data ?? data) as AccessCatalog;
            cachedCatalog = next;
            lastFetchedAt = Date.now();
            notify();
            return next;
        })
        .catch(() => cachedCatalog)
        .finally(() => {
            inflight = null;
        });

    return inflight;
}

function ensureFocusListener() {
    if (typeof window === "undefined" || focusListenerAttached) return;
    focusListenerAttached = true;
    window.addEventListener("focus", () => {
        void fetchCatalog(false);
    });
}

export function useAccessCatalog() {
    const [catalog, setCatalog] = useState<AccessCatalog | null>(cachedCatalog);
    const [loading, setLoading] = useState(!cachedCatalog);

    const reload = useCallback(async () => {
        setLoading(!cachedCatalog);
        await fetchCatalog(true);
        setCatalog(cachedCatalog);
        setLoading(false);
    }, []);

    useEffect(() => {
        const onUpdate = () => {
            setCatalog(cachedCatalog);
            setLoading(false);
        };
        subscribers.add(onUpdate);
        ensureFocusListener();
        void fetchCatalog(false).then(() => {
            setCatalog(cachedCatalog);
            setLoading(false);
        });
        return () => {
            subscribers.delete(onUpdate);
        };
    }, []);

    const modules: NavModule[] = useMemo(() => mergeNavModules(catalog), [catalog]);

    return { catalog, loading, modules, reload };
}
