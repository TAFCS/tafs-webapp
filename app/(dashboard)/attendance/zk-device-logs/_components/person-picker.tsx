"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { zkPushService, DevicePersonType, PersonSearchResult } from "@/lib/zk-push.service";

interface PersonPickerProps {
    personType: DevicePersonType;
    selected: PersonSearchResult | null;
    onSelect: (person: PersonSearchResult | null) => void;
}

function personLabel(p: PersonSearchResult) {
    if (p.id !== undefined) {
        return `${p.full_name ?? "Unnamed"}${p.employee_code ? ` (${p.employee_code})` : ""}`;
    }
    return `${p.full_name ?? "Unnamed"}${p.gr_number ? ` (${p.gr_number})` : ""}`;
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
                const data = await zkPushService.searchPersons(personType, query || undefined);
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
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{personLabel(selected)}</span>
                <button type="button" onClick={() => onSelect(null)} className="text-zinc-400 hover:text-zinc-600">
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
                <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg">
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
                                className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                {personLabel(p)}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
