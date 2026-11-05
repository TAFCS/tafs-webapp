"use client";
import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, History, X } from "lucide-react";
import api from "@/lib/api";

/**
 * Photo progression (TAFSD-483): every photo a student has had, oldest to
 * newest, with the newest marked as current. Retakes never overwrite a photo,
 * so this is the full record. Click a photo to step through them full size.
 */

export interface PhotoHistoryItem {
    id: number;
    url: string;
    uploaded_at: string;
    uploaded_by?: string | null;
}

const cleanUrl = (u: string) => u.replace(/([^:])\/\//g, "$1/");

const fmt = (d: string) => {
    const date = new Date(d);
    return isNaN(date.getTime())
        ? "—"
        : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

/** Who uploaded it, in plain words. */
const sourceLabel = (by?: string | null) => {
    if (!by) return null;
    if (by === "system_backfill") return "Photo on record before history began";
    if (by.startsWith("bulk-import")) return "Photo-day bulk import";
    return `Uploaded by ${by}`;
};

export function PhotoProgression({ cc, refreshKey }: { cc: number; refreshKey?: string | null }) {
    const [items, setItems] = useState<PhotoHistoryItem[]>([]);
    const [open, setOpen] = useState<number | null>(null);

    useEffect(() => {
        if (!cc) return;
        let alive = true;
        api.get(`/v1/staff-editing/students/${cc}/photo-history`)
            .then((res) => {
                const list = res.data?.data ?? res.data;
                if (alive && Array.isArray(list)) setItems(list);
            })
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, [cc, refreshKey]);

    const step = useCallback(
        (dir: -1 | 1) => setOpen((i) => (i == null ? i : Math.min(items.length - 1, Math.max(0, i + dir)))),
        [items.length],
    );

    useEffect(() => {
        if (open == null) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft") step(-1);
            else if (e.key === "ArrowRight") step(1);
            else if (e.key === "Escape") setOpen(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, step]);

    if (items.length === 0) return null;
    const last = items.length - 1;
    const current = open != null ? items[open] : null;

    return (
        <div className="w-full pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                    <History className="h-3 w-3" />
                    Photo progression
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                    {items.length} photo{items.length === 1 ? "" : "s"}
                </span>
            </div>

            <ol className="flex items-start gap-1.5 overflow-x-auto pb-1 max-w-full">
                {items.map((item, i) => {
                    const isCurrent = i === last;
                    return (
                        <li key={item.id || i} className="flex items-start shrink-0">
                            {i > 0 && <span aria-hidden className="mt-6 mr-1.5 h-px w-2 bg-zinc-300 dark:bg-zinc-700" />}
                            <button
                                type="button"
                                onClick={() => setOpen(i)}
                                className="flex flex-col items-center group/photo"
                                title={`${isCurrent ? "Current photo" : `Photo ${i + 1}`} · ${fmt(item.uploaded_at)}`}
                            >
                                <span
                                    className={`h-12 w-12 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 border-2 transition-all group-hover/photo:scale-105 ${
                                        isCurrent
                                            ? "border-indigo-500"
                                            : "border-zinc-200 dark:border-zinc-700 group-hover/photo:border-indigo-400"
                                    }`}
                                >
                                    <img src={cleanUrl(item.url)} alt="" loading="lazy" className="h-full w-full object-cover" />
                                </span>
                                <span
                                    className={`text-[9px] font-bold uppercase mt-1 ${
                                        isCurrent ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-500"
                                    }`}
                                >
                                    {isCurrent ? "Current" : i === 0 ? "First" : `#${i + 1}`}
                                </span>
                                <span className="text-[8px] text-zinc-400 font-mono whitespace-nowrap">{fmt(item.uploaded_at)}</span>
                            </button>
                        </li>
                    );
                })}
            </ol>

            {current && open != null && (
                <div
                    className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    onClick={() => setOpen(null)}
                >
                    <div
                        className="relative max-w-4xl w-full max-h-[92vh] bg-zinc-950 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-900/60">
                            <div>
                                <h5 className="text-sm font-bold text-white uppercase tracking-tight">
                                    {open === last ? "Current photo" : `Photo ${open + 1} of ${items.length}`}
                                </h5>
                                <p className="text-[11px] font-mono text-zinc-400">
                                    {fmt(current.uploaded_at)}
                                    {sourceLabel(current.uploaded_by) ? ` · ${sourceLabel(current.uploaded_by)}` : ""}
                                </p>
                            </div>
                            <button
                                onClick={() => setOpen(null)}
                                className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl border border-zinc-700"
                                aria-label="Close"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="relative p-4 flex items-center justify-center">
                            <img
                                src={cleanUrl(current.url)}
                                alt=""
                                className="max-w-full max-h-[62vh] object-contain rounded-xl shadow-lg"
                            />
                            {open > 0 && (
                                <button
                                    onClick={() => step(-1)}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-white"
                                    aria-label="Older photo"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </button>
                            )}
                            {open < last && (
                                <button
                                    onClick={() => step(1)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-white"
                                    aria-label="Newer photo"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </button>
                            )}
                        </div>

                        {items.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto px-4 pb-4">
                                {items.map((item, i) => (
                                    <button
                                        key={item.id || i}
                                        onClick={() => setOpen(i)}
                                        className={`shrink-0 flex flex-col items-center gap-1 ${i === open ? "" : "opacity-60 hover:opacity-100"}`}
                                    >
                                        <span
                                            className={`h-14 w-14 rounded-lg overflow-hidden border-2 ${
                                                i === open ? "border-indigo-500" : "border-zinc-700"
                                            }`}
                                        >
                                            <img src={cleanUrl(item.url)} alt="" loading="lazy" className="h-full w-full object-cover" />
                                        </span>
                                        <span className="text-[9px] font-mono text-zinc-400">{fmt(item.uploaded_at)}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
