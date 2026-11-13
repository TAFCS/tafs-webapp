"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock, FolderSearch, Loader2, Search, User, X } from "lucide-react";
import { studentsService, type SimpleStudentSearchResult } from "@/lib/students.service";
import { studentDocumentsService, type CompletenessSummary } from "@/lib/student-documents.service";
import { directCdnUrl } from "@/lib/media-url";
import { useDebounce } from "@/hooks/use-debounce";
import { StudentDocumentsVault } from "@/components/student-documents/StudentDocumentsVault";

const RECENT_KEY = "tafs.studentDocuments.recent";
const RECENT_MAX = 8;

type Lite = {
    cc: number;
    full_name: string | null;
    gr_number: string | null;
    photograph_url?: string | null;
    class_name?: string | null;
    section_name?: string | null;
};

const readRecent = (): Lite[] => {
    try {
        const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
        return Array.isArray(v) ? v.slice(0, RECENT_MAX) : [];
    } catch {
        return [];
    }
};
const pushRecent = (s: Lite) => {
    try {
        const next = [s, ...readRecent().filter((r) => r.cc !== s.cc)].slice(0, RECENT_MAX);
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
        /* storage blocked: recents are a convenience only */
    }
};

const toLite = (r: SimpleStudentSearchResult): Lite => ({
    cc: r.cc,
    full_name: r.full_name,
    gr_number: r.gr_number,
    photograph_url: r.photograph_url,
    class_name: r.classes?.description ?? null,
    section_name: r.sections?.description ?? null,
});

export function StudentsTab({
    cc,
    backTo,
    onSelect,
    onBack,
}: {
    cc: number | null;
    backTo: "missing" | "activity" | null;
    onSelect: (cc: number | null) => void;
    onBack: (to: "missing" | "activity") => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [q, setQ] = useState("");
    const debounced = useDebounce(q.trim(), 250);
    const [results, setResults] = useState<SimpleStudentSearchResult[]>([]);
    const [summary, setSummary] = useState<Map<number, CompletenessSummary>>(new Map());
    /** The query the current results answer; "searching" is derived from it. */
    const [answered, setAnswered] = useState("");
    const [highlight, setHighlight] = useState(0);
    const [recent, setRecent] = useState<Lite[]>([]);
    const searching = !!debounced && answered !== debounced;

    // localStorage only exists in the browser, so read it after mount.
    useEffect(() => {
        let alive = true;
        void Promise.resolve().then(() => alive && setRecent(readRecent()));
        return () => {
            alive = false;
        };
    }, [cc]);

    // "/" jumps to the search box from anywhere on the page.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement;
            if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) && !t.isContentEditable) {
                e.preventDefault();
                inputRef.current?.focus();
                inputRef.current?.select();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    useEffect(() => {
        if (!cc) inputRef.current?.focus();
    }, [cc]);

    useEffect(() => {
        let cancelled = false;
        if (!debounced) return;
        studentsService
            .searchSimple({ q: debounced })
            .then(async (rows) => {
                if (cancelled) return;
                setResults(rows);
                setHighlight(0);
                setAnswered(debounced);
                const sums = await studentDocumentsService.summary(rows.map((r) => r.cc)).catch(() => []);
                if (!cancelled) setSummary(new Map(sums.map((s) => [s.cc, s])));
            })
            .catch(() => {
                if (cancelled) return;
                setResults([]);
                setAnswered(debounced);
            });
        return () => {
            cancelled = true;
        };
    }, [debounced]);

    const choose = (s: Lite) => onSelect(s.cc);

    const list: Lite[] = debounced ? results.map(toLite) : recent;

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!list.length) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, list.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            const s = list[highlight];
            if (s) choose(s);
        } else if (e.key === "Escape") {
            setQ("");
        }
    };

    return (
        <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
            {/* Search and results. On a phone it gives way to the vault once a student is open. */}
            <aside className={`${cc ? "hidden lg:block" : ""} lg:sticky lg:top-4 lg:self-start`}>
                <div className="rounded-3xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <input
                            ref={inputRef}
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            onKeyDown={onKeyDown}
                            placeholder="Name, GR, CC, B-Form or parent's phone"
                            className="h-11 w-full rounded-2xl border border-zinc-200 bg-zinc-50 pl-9 pr-16 text-sm font-medium text-zinc-900 outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:ring-indigo-950"
                            aria-label="Search students"
                        />
                        {q ? (
                            <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700" aria-label="Clear search">
                                <X className="h-3.5 w-3.5" />
                            </button>
                        ) : (
                            <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-zinc-200 bg-white px-1.5 text-[10px] font-bold text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 sm:block">/</kbd>
                        )}
                    </div>

                    <div className="mt-2">
                        {!debounced && (
                            <p className="flex items-center gap-1.5 px-2 pb-1 pt-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                <Clock className="h-3 w-3" /> {recent.length ? "Recently opened" : "Search to begin"}
                            </p>
                        )}
                        {debounced && searching && results.length === 0 && (
                            <p className="flex items-center gap-2 px-2 py-6 text-xs text-zinc-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…</p>
                        )}
                        {debounced && !searching && results.length === 0 && (
                            <p className="px-2 py-6 text-center text-xs text-zinc-400">No student in your campuses matches “{debounced}”.</p>
                        )}
                        {!debounced && recent.length === 0 && (
                            <p className="px-2 pb-3 text-xs leading-relaxed text-zinc-400">
                                Type a name, GR number or CC. Arrow keys move through results, Enter opens one.
                            </p>
                        )}
                        <ul className="max-h-[60vh] space-y-0.5 overflow-y-auto" role="listbox">
                            {list.map((s, i) => {
                                const sum = summary.get(s.cc);
                                const match = debounced ? results[i]?.matched_on : undefined;
                                const selected = s.cc === cc;
                                return (
                                    <li key={s.cc}>
                                        <button
                                            onClick={() => choose(s)}
                                            onMouseEnter={() => setHighlight(i)}
                                            role="option"
                                            aria-selected={selected}
                                            className={`flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors ${
                                                selected
                                                    ? "bg-indigo-600 text-white"
                                                    : i === highlight
                                                      ? "bg-zinc-100 dark:bg-zinc-800"
                                                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                                            }`}
                                        >
                                            {directCdnUrl(s.photograph_url) ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={directCdnUrl(s.photograph_url)!} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
                                            ) : (
                                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-white/20" : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"}`}><User className="h-4 w-4" /></span>
                                            )}
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-bold">{s.full_name}</span>
                                                <span className={`block truncate text-[11px] ${selected ? "text-indigo-100" : "text-zinc-500"}`}>
                                                    {s.gr_number ? `GR ${s.gr_number}` : `CC ${s.cc}`}
                                                    {s.class_name ? ` · ${s.class_name}${s.section_name ? ` ${s.section_name}` : ""}` : ""}
                                                    {match && match !== "Name" ? ` · ${match}` : ""}
                                                </span>
                                            </span>
                                            {sum && <Completeness sum={sum} inverted={selected} />}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>
            </aside>

            {/* The open student */}
            <section className="min-w-0">
                {cc ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <button onClick={() => onSelect(null)} className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 lg:hidden">
                                <ArrowLeft className="h-3.5 w-3.5" /> Search
                            </button>
                            {backTo && (
                                <button onClick={() => onBack(backTo)} className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:underline">
                                    <ArrowLeft className="h-3.5 w-3.5" /> Back to {backTo === "missing" ? "missing documents" : "recent activity"}
                                </button>
                            )}
                        </div>
                        <div className="rounded-3xl border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40 sm:p-5">
                            <StudentDocumentsVault
                                key={cc}
                                cc={cc}
                                variant="page"
                                onLoaded={(s) => {
                                    pushRecent({ cc: s.cc, full_name: s.full_name, gr_number: s.gr_number, photograph_url: s.photograph_url, class_name: s.class_name, section_name: s.section_name });
                                    setRecent(readRecent());
                                }}
                                onChanged={() => {
                                    // Refresh every pill in the list: a parent's document counts for each sibling shown.
                                    const shown = [...new Set([cc, ...list.map((l) => l.cc)])];
                                    studentDocumentsService
                                        .summary(shown)
                                        .then((sums) => setSummary((m) => {
                                            const next = new Map(m);
                                            sums.forEach((s) => next.set(s.cc, s));
                                            return next;
                                        }))
                                        .catch(() => {});
                                }}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-zinc-200 p-10 text-center dark:border-zinc-800">
                        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
                            <FolderSearch className="h-7 w-7" />
                        </span>
                        <p className="text-sm font-black text-zinc-700 dark:text-zinc-200">Open a student to see their documents</p>
                        <p className="max-w-sm text-xs leading-relaxed text-zinc-400">
                            Search on the left. You can drag scans straight onto a student&apos;s documents, and several photos of one form are saved as a single PDF.
                        </p>
                    </div>
                )}
            </section>
        </div>
    );
}

function Completeness({ sum, inverted }: { sum: CompletenessSummary; inverted?: boolean }) {
    if (!sum.required) return null;
    const complete = sum.on_file >= sum.required;
    const none = sum.on_file === 0;
    const tone = inverted
        ? "bg-white/20 text-white"
        : complete
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
          : none
            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
            : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400";
    return (
        <span
            className={`shrink-0 rounded-lg px-1.5 py-0.5 text-[10px] font-black tabular-nums ${tone}`}
            title={complete ? "All required documents on file" : `Missing: ${sum.missing.join(", ")}`}
        >
            {sum.on_file}/{sum.required}
        </span>
    );
}
