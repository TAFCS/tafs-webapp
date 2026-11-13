"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, FilePlus2, History, Loader2, RefreshCw, RotateCcw, Upload } from "lucide-react";
import toast from "react-hot-toast";
import { errMsg, studentDocumentsService, type VaultActivity } from "@/lib/student-documents.service";

const PAGE = 40;

const ACTION: Record<VaultActivity["action"], { label: string; icon: React.ElementType; tone: string }> = {
    UPLOADED: { label: "Filed", icon: FilePlus2, tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40" },
    REPLACED: { label: "New version", icon: Upload, tone: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40" },
    MADE_CURRENT: { label: "Older version restored", icon: History, tone: "bg-sky-50 text-sky-600 dark:bg-sky-950/40" },
    ARCHIVED: { label: "Archived", icon: Archive, tone: "bg-rose-50 text-rose-600 dark:bg-rose-950/40" },
    RESTORED: { label: "Restored", icon: RotateCcw, tone: "bg-amber-50 text-amber-600 dark:bg-amber-950/40" },
};

const dayLabel = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};

/** What was filed, replaced or archived lately, across the campuses the caller can see. */
export function ActivityTab({ onOpenStudent }: { onOpenStudent: (cc: number) => void }) {
    const [rows, setRows] = useState<VaultActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [more, setMore] = useState(false);
    const [done, setDone] = useState(false);

    const load = useCallback(async (before?: number) => {
        if (before) setMore(true);
        else setLoading(true);
        try {
            const page = await studentDocumentsService.activity(before, PAGE);
            setRows((prev) => (before ? [...prev, ...page] : page));
            setDone(page.length < PAGE);
        } catch (err) {
            toast.error(errMsg(err, "Couldn't load recent activity"));
        } finally {
            setLoading(false);
            setMore(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    if (loading) {
        return <div className="space-y-2">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800/60" />)}</div>;
    }
    if (!rows.length) {
        return (
            <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-zinc-200 p-12 text-center dark:border-zinc-800">
                <History className="h-8 w-8 text-zinc-300" />
                <p className="text-sm font-black text-zinc-700 dark:text-zinc-200">Nothing filed yet</p>
                <p className="text-xs text-zinc-400">Uploads, new versions and archives show up here as they happen.</p>
            </div>
        );
    }

    const groups: { day: string; items: VaultActivity[] }[] = [];
    for (const r of rows) {
        const day = dayLabel(r.changed_at);
        const g = groups[groups.length - 1];
        if (g && g.day === day) g.items.push(r);
        else groups.push({ day, items: [r] });
    }

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <div className="flex justify-end">
                <button onClick={() => load()} className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
                    <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </button>
            </div>
            {groups.map((g) => (
                <section key={g.day}>
                    <h3 className="mb-2 text-[11px] font-black uppercase tracking-widest text-zinc-400">{g.day}</h3>
                    <ul className="overflow-hidden rounded-3xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                        {g.items.map((r) => {
                            const a = ACTION[r.action] ?? ACTION.UPLOADED;
                            return (
                                <li key={r.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                                    <button onClick={() => onOpenStudent(r.cc)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${a.tone}`}>
                                            <a.icon className="h-4 w-4" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm text-zinc-800 dark:text-zinc-100">
                                                <span className="font-bold">{r.full_name ?? `CC ${r.cc}`}</span>
                                                <span className="text-zinc-400"> · {r.gr_number ? `GR ${r.gr_number}` : `CC ${r.cc}`}{r.class_name ? ` · ${r.class_name}${r.section_name ? ` ${r.section_name}` : ""}` : ""}</span>
                                            </span>
                                            <span className="mt-0.5 block text-xs text-zinc-500">{r.note ?? a.label}</span>
                                        </span>
                                        <span className="shrink-0 text-right text-[11px] text-zinc-400">
                                            {new Date(r.changed_at).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })}
                                            <span className="block font-semibold text-zinc-500">{r.changed_by}</span>
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ))}
            {!done && (
                <div className="flex justify-center">
                    <button onClick={() => load(rows[rows.length - 1]?.id)} disabled={more} className="flex h-10 items-center gap-2 rounded-xl border border-zinc-200 px-4 text-xs font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
                        {more && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Show older
                    </button>
                </div>
            )}
        </div>
    );
}
