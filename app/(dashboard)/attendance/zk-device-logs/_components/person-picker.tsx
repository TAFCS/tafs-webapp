"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, User, X } from "lucide-react";
import { zkPushService, PersonSearchResult, DevicePersonType } from "@/lib/zk-push.service";

interface PersonPickerProps {
    personType: DevicePersonType;
    selected: PersonSearchResult | null;
    onSelect: (person: PersonSearchResult | null) => void;
}

function personMeta(p: PersonSearchResult): string {
    if (p.id !== undefined) {
        return p.employee_code ? `Code ${p.employee_code}` : "";
    }
    const parts = [
        p.gr_number ? `GR ${p.gr_number}` : `CC #${p.cc}`,
        p.classes?.description,
        p.sections?.description,
        p.campuses?.campus_name,
    ].filter(Boolean);
    return parts.join(" · ");
}

function PersonAvatar({ url, name }: { url?: string | null; name: string | null }) {
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
        setImgError(false);
    }, [url]);

    const sanitizedUrl = url?.replace(/([^:])\/\//g, "$1/");
    const proxiedUrl = sanitizedUrl ? `/api/v1/media/proxy?url=${encodeURIComponent(sanitizedUrl)}` : null;

    return (
        <div className="h-9 w-9 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
            {proxiedUrl && !imgError ? (
                <img
                    src={proxiedUrl}
                    alt={name ?? "Photo"}
                    className="h-full w-full object-cover"
                    onError={() => setImgError(true)}
                />
            ) : (
                <User className="h-4 w-4 text-zinc-300" />
            )}
        </div>
    );
}

export function PersonPicker({ personType, selected, onSelect }: PersonPickerProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<PersonSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        const handle = setTimeout(async () => {
            try {
                const data = personType === 'STAFF'
                    ? await zkPushService.searchEmployees(query)
                    : await zkPushService.searchStudents(query);
                if (!cancelled) setResults(data);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 250);
        return () => {
            cancelled = true;
            clearTimeout(handle);
        };
    }, [query, personType, open]);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (selected) {
        return (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
                <div className="flex items-center gap-2.5 min-w-0">
                    {personType === "STUDENT" && <PersonAvatar url={selected.photograph_url} name={selected.full_name} />}
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200 truncate">{selected.full_name ?? "Unnamed"}</p>
                        {personMeta(selected) && (
                            <p className="text-[11px] text-zinc-400 font-medium truncate">{personMeta(selected)}</p>
                        )}
                    </div>
                </div>
                <button type="button" onClick={() => onSelect(null)} className="text-zinc-400 hover:text-zinc-600 shrink-0">
                    <X className="w-4 h-4" />
                </button>
            </div>
        );
    }

    return (
        <div className="relative" ref={containerRef}>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setOpen(true)}
                    placeholder={
                        personType === "STAFF" ? "Search staff by name or code…" : "Search students by name or GR#…"
                    }
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-sm outline-none transition-all"
                />
            </div>
            {open && (
                <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg">
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-4 text-zinc-400 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" /> Searching…
                        </div>
                    ) : results.length === 0 ? (
                        <div className="py-4 text-center text-sm text-zinc-400">No matches</div>
                    ) : (
                        results.map((p) => (
                            <button
                                key={p.id ?? p.cc}
                                type="button"
                                onClick={() => {
                                    onSelect(p);
                                    setOpen(false);
                                    setQuery("");
                                }}
                                className="w-full flex items-center gap-2.5 text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                {personType === "STUDENT" && <PersonAvatar url={p.photograph_url} name={p.full_name} />}
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{p.full_name ?? "Unnamed"}</p>
                                    {personMeta(p) && (
                                        <p className="text-[11px] text-zinc-400 font-medium truncate">{personMeta(p)}</p>
                                    )}
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
