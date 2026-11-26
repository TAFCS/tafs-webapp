"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import toast from "react-hot-toast";
import {
    BookOpen, Check, Download, Eye, FileStack, Files, Loader2, MapPin, RefreshCw, X,
} from "lucide-react";
import {
    GuideArea, GuideContents, GuideModule,
    blobErrorMessage, formatBytes, guideFileName, guideService, saveBlob,
} from "@/lib/guide.service";

const pagesLabel = (n: number | null) => (n ? `${n} page${n === 1 ? "" : "s"}` : "");

/**
 * TAFSD-616: System → Guide. The TAFSync user manual, split into areas and
 * modules. Any section downloads as the A4 PDF typeset from the LaTeX; several
 * ticked modules download as one PDF the backend joins (cover, contents,
 * numbered straight through). The PDFs are built in tafs-software-manual by a
 * GitHub Action and read from its latest release, so this page writes nothing.
 *
 * URL: ?section=<area/module> is the module being previewed, ?sel=a,b the
 * ticked modules, so a view can be shared and reloaded.
 */
function GuidePageInner() {
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();

    const [contents, setContents] = useState<GuideContents | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null); // which download is running
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const previewUrlRef = useRef<string | null>(null);

    const section = params.get("section");
    const selected = useMemo(
        () => new Set((params.get("sel") ?? "").split(",").filter(Boolean)),
        [params],
    );

    const setQuery = useCallback(
        (next: { section?: string | null; sel?: string[] }) => {
            const q = new URLSearchParams(params.toString());
            if (next.section !== undefined) {
                if (next.section) q.set("section", next.section);
                else q.delete("section");
            }
            if (next.sel !== undefined) {
                if (next.sel.length) q.set("sel", next.sel.join(","));
                else q.delete("sel");
            }
            const s = q.toString();
            router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
        },
        [params, pathname, router],
    );

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setContents(await guideService.contents());
        } catch (err) {
            setError(await blobErrorMessage(err, "Could not load the guide"));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const allModules = useMemo(() => contents?.areas.flatMap((a) => a.modules) ?? [], [contents]);
    const moduleById = useMemo(() => new Map(allModules.map((m) => [m.id, m])), [allModules]);
    const previewModule = section ? moduleById.get(section) ?? null : null;

    // Only ticks that still exist in the published manual count.
    const ticked = useMemo(() => allModules.filter((m) => selected.has(m.id)), [allModules, selected]);
    const tickedPages = ticked.reduce((n, m) => n + (m.bare.pages ?? 0), 0);

    // Preview: fetch the module's PDF with the session and show it from a blob URL.
    useEffect(() => {
        let alive = true;
        const swap = (url: string | null) => {
            if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
            previewUrlRef.current = url;
            setPreviewUrl(url);
        };
        if (!previewModule) {
            swap(null);
            return;
        }
        setPreviewLoading(true);
        guideService
            .file(previewModule.pdf.file)
            .then((blob) => alive && swap(URL.createObjectURL(blob)))
            .catch(async (err) => alive && toast.error(await blobErrorMessage(err, "Could not open the preview")))
            .finally(() => alive && setPreviewLoading(false));
        return () => {
            alive = false;
        };
    }, [previewModule]);

    useEffect(() => () => {
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    }, []);

    const download = async (key: string, run: () => Promise<Blob>, name: string) => {
        setBusy(key);
        try {
            saveBlob(await run(), name);
        } catch (err) {
            toast.error(await blobErrorMessage(err, "The download failed"));
        } finally {
            setBusy(null);
        }
    };

    const toggle = (ids: string[], on: boolean) => {
        const next = new Set(selected);
        ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
        // Keep reading order in the URL.
        setQuery({ sel: allModules.filter((m) => next.has(m.id)).map((m) => m.id) });
    };

    const downloadSelected = () => {
        if (!ticked.length) return;
        const name = ticked.length === 1
            ? guideFileName(ticked[0].title)
            : `TAFSync Guide - ${ticked.length} sections (${format(new Date(), "yyyy-MM-dd")}).pdf`;
        download("selected", () => guideService.combine(ticked.map((m) => m.id)), name);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20">
            <div className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-primary/10 rounded-2xl">
                                <BookOpen className="h-6 w-6 text-primary" />
                            </div>
                            <h1 className="text-3xl font-black tracking-tight text-zinc-900">Guide</h1>
                        </div>
                        <p className="text-zinc-500 text-sm font-medium pl-1 max-w-3xl">
                            The TAFSync user manual: how each page works, step by step. Download any section as an A4
                            PDF ready to print, the whole manual, or tick several sections and download them as one PDF.
                        </p>
                        {contents && (
                            <p className="text-xs text-zinc-400 pl-1">
                                Last updated {format(new Date(contents.published_at ?? contents.built_at), "dd MMM yyyy, hh:mm a")}
                                {" · "}{contents.areas.length} areas, {allModules.length} sections
                            </p>
                        )}
                    </div>
                    {contents && (
                        <button
                            onClick={() => download("manual", () => guideService.file(contents.manual.file), "TAFSync Software Manual.pdf")}
                            disabled={busy !== null}
                            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-primary/90 disabled:opacity-60"
                        >
                            {busy === "manual" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            Whole manual
                            <span className="font-medium text-white/75">
                                {pagesLabel(contents.manual.pages)} · {formatBytes(contents.manual.bytes)}
                            </span>
                        </button>
                    )}
                </div>
            </div>

            {loading && (
                <div className="flex items-center justify-center gap-2 py-24 text-sm text-zinc-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading the guide…
                </div>
            )}

            {!loading && error && (
                <div className="bg-white p-8 rounded-[32px] border border-amber-200 text-center space-y-3">
                    <p className="text-sm font-semibold text-amber-800">{error}</p>
                    <button onClick={load} className="inline-flex items-center gap-2 text-sm font-bold text-primary">
                        <RefreshCw className="h-4 w-4" /> Try again
                    </button>
                </div>
            )}

            {!loading && contents && (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start">
                    {/* Sections */}
                    <div className="space-y-4">
                        <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
                            <div className="text-sm">
                                {ticked.length ? (
                                    <span className="font-semibold text-zinc-800">
                                        {ticked.length} selected{tickedPages ? ` · about ${tickedPages + 2} pages` : ""}
                                    </span>
                                ) : (
                                    <span className="text-zinc-500">Tick sections to download them together</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {ticked.length > 0 && (
                                    <button
                                        onClick={() => setQuery({ sel: [] })}
                                        className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-100"
                                    >
                                        <X className="h-3.5 w-3.5" /> Clear
                                    </button>
                                )}
                                <button
                                    onClick={() => toggle(allModules.map((m) => m.id), ticked.length !== allModules.length)}
                                    className="rounded-xl px-3 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100"
                                >
                                    {ticked.length === allModules.length ? "Untick all" : "Tick all"}
                                </button>
                                <button
                                    onClick={downloadSelected}
                                    disabled={!ticked.length || busy !== null}
                                    className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40"
                                >
                                    {busy === "selected" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileStack className="h-3.5 w-3.5" />}
                                    Download selected
                                </button>
                            </div>
                        </div>

                        {contents.areas.map((area) => (
                            <AreaCard
                                key={area.id}
                                area={area}
                                selected={selected}
                                previewId={section}
                                busy={busy}
                                onToggle={toggle}
                                onPreview={(m) => setQuery({ section: m.id === section ? null : m.id })}
                                onDownloadModule={(m) => download(m.id, () => guideService.file(m.pdf.file), guideFileName(m.title))}
                                onDownloadArea={() => download(`area:${area.id}`, () => guideService.file(area.pdf.file), guideFileName(area.title))}
                            />
                        ))}
                    </div>

                    {/* Preview */}
                    <div className="lg:sticky lg:top-2">
                        <div className="overflow-hidden rounded-[28px] border border-zinc-100 bg-white shadow-sm">
                            {previewModule ? (
                                <>
                                    <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-bold text-zinc-900">{previewModule.title}</p>
                                            <p className="truncate text-xs text-zinc-500">{previewModule.where}</p>
                                        </div>
                                        <button
                                            onClick={() => setQuery({ section: null })}
                                            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                                            aria-label="Close the preview"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="relative h-[78vh] bg-zinc-100">
                                        {previewLoading && (
                                            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-zinc-500">
                                                <Loader2 className="h-4 w-4 animate-spin" /> Opening…
                                            </div>
                                        )}
                                        {previewUrl && !previewLoading && (
                                            <iframe title={previewModule.title} src={`${previewUrl}#view=FitH`} className="h-full w-full" />
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="flex h-[40vh] flex-col items-center justify-center gap-3 px-8 text-center text-zinc-400">
                                    <Eye className="h-8 w-8" />
                                    <p className="text-sm">Choose <span className="font-semibold text-zinc-600">Read</span> on a section to read it here.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function AreaCard({
    area, selected, previewId, busy, onToggle, onPreview, onDownloadModule, onDownloadArea,
}: {
    area: GuideArea;
    selected: Set<string>;
    previewId: string | null;
    busy: string | null;
    onToggle: (ids: string[], on: boolean) => void;
    onPreview: (m: GuideModule) => void;
    onDownloadModule: (m: GuideModule) => void;
    onDownloadArea: () => void;
}) {
    const ids = area.modules.map((m) => m.id);
    const count = ids.filter((id) => selected.has(id)).length;
    const all = count === ids.length && ids.length > 0;

    return (
        <section className="rounded-[28px] border border-zinc-100 bg-white shadow-sm">
            <header className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
                <label className="flex cursor-pointer items-center gap-3">
                    <Tick checked={all} partial={count > 0 && !all} onChange={() => onToggle(ids, !all)} label={`Tick every section in ${area.title}`} />
                    <span className="text-base font-black tracking-tight text-zinc-900">{area.title}</span>
                    <span className="text-xs font-medium text-zinc-400">
                        {area.modules.length} section{area.modules.length === 1 ? "" : "s"}
                    </span>
                </label>
                <button
                    onClick={onDownloadArea}
                    disabled={busy !== null}
                    title={`${area.title} as one PDF${area.pdf.pages ? `, ${area.pdf.pages} pages` : ""}`}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-primary hover:bg-primary/5 disabled:opacity-50"
                >
                    {busy === `area:${area.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Files className="h-3.5 w-3.5" />}
                    Whole area
                </button>
            </header>
            <ul className="divide-y divide-zinc-50">
                {area.modules.map((m) => {
                    const on = selected.has(m.id);
                    const reading = previewId === m.id;
                    return (
                        <li key={m.id} className={`flex gap-3 px-5 py-4 ${reading ? "bg-primary/5" : ""}`}>
                            <div className="pt-0.5">
                                <Tick checked={on} onChange={() => onToggle([m.id], !on)} label={`Tick ${m.title}`} />
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                                <p className="text-sm font-bold text-zinc-900">{m.title}</p>
                                {m.summary && <p className="text-sm text-zinc-600">{m.summary}</p>}
                                <p className="flex items-center gap-1 text-xs text-zinc-400">
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{m.where}</span>
                                    {m.pdf.pages ? <span className="shrink-0">· {pagesLabel(m.pdf.pages)}</span> : null}
                                </p>
                            </div>
                            <div className="flex shrink-0 items-start gap-1">
                                <button
                                    onClick={() => onPreview(m)}
                                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold ${reading ? "bg-primary text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
                                >
                                    <Eye className="h-3.5 w-3.5" /> Read
                                </button>
                                <button
                                    onClick={() => onDownloadModule(m)}
                                    disabled={busy !== null}
                                    aria-label={`Download ${m.title}`}
                                    title="Download as PDF"
                                    className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-50"
                                >
                                    {busy === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

function Tick({ checked, partial = false, onChange, label }: { checked: boolean; partial?: boolean; onChange: () => void; label: string }) {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={partial ? "mixed" : checked}
            aria-label={label}
            onClick={(e) => {
                e.preventDefault();
                onChange();
            }}
            className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${
                checked || partial ? "border-primary bg-primary text-white" : "border-zinc-300 bg-white hover:border-primary"
            }`}
        >
            {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            {partial && !checked && <span className="h-0.5 w-2.5 rounded bg-white" />}
        </button>
    );
}

export default function GuidePage() {
    return (
        <Suspense fallback={null}>
            <GuidePageInner />
        </Suspense>
    );
}
