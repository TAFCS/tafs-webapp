"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import {
    mergeNavModules,
    type AccessCatalog,
    type NavModule,
} from "@/lib/nav-config";

let cachedCatalog: AccessCatalog | null = null;

export function useAccessCatalog() {
    const [catalog, setCatalog] = useState<AccessCatalog | null>(cachedCatalog);
    const [loading, setLoading] = useState(!cachedCatalog);

    const load = useCallback(async () => {
        try {
            const { data } = await api.get("/v1/access/tiles");
            const next = (data.data ?? data) as AccessCatalog;
            cachedCatalog = next;
            setCatalog(next);
        } catch {
            // Keep the last good catalog (or checked-in nav fallback).
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        const onFocus = () => { void load(); };
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, [load]);

    const modules: NavModule[] = useMemo(() => mergeNavModules(catalog), [catalog]);

    return { catalog, loading, modules, reload: load };
}
