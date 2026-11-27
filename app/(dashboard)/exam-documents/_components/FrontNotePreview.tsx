"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, ScanSearch } from "lucide-react";
import {
    DOC_TYPE_LABELS,
    examDocumentsService,
    type FrontNotePreview as Preview,
    type FrontNotePreviewClass,
    type FrontNotePreviewRequest,
} from "@/lib/exam-documents.service";

/**
 * TAFSD-555: the live preview of a schedule's front note. The backend lays out and renders the
 * front page of each class's documents from the unsaved draft with the same code that prints
 * them (a made-up student; everything about a student sits in fixed boxes), and checks the page
 * holds on one sheet. So the page shown here is the page that prints: same Times font, same
 * size, same box. It refreshes a moment after typing stops.
 */

const DEBOUNCE_MS = 700;

export type FrontNoteVerdict = { blocking: string | null };

function pdfUrl(base64: string): string {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
}

const pt = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}pt`;

function verdict(c: FrontNotePreviewClass): { tone: "ok" | "warn" | "bad"; text: string } {
    if (!c.fits) return { tone: "bad", text: "Too long: the front page spills onto a second sheet even at the smallest size. Shorten the note." };
    if (c.standard_lines) return { tone: "ok", text: "The two standard lines print." };
    if (c.shrunk)
        return {
            tone: "warn",
            text: `Fits only by shrinking: the note prints at ${pt(c.note_size)} instead of ${pt(c.full_note_size)}${
                c.table_size < 10 ? `, and the papers at ${pt(c.table_size)}` : ""
            }. Shorten it to print larger.`,
        };
    return { tone: "ok", text: `Fits at full size (${pt(c.note_size)}).` };
}

const TONE = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    warn: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    bad: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
};
const DOT = { ok: "bg-emerald-500", warn: "bg-amber-500", bad: "bg-red-500" };

export function FrontNotePreview({
    request,
    maxLines,
    onVerdict,
}: {
    /** Null until the draft has a campus and at least one class. */
    request: Omit<FrontNotePreviewRequest, "class_id"> | null;
    maxLines: number;
    onVerdict: (v: FrontNoteVerdict) => void;
}) {
    const [classId, setClassId] = useState<number | null>(null);
    const [preview, setPreview] = useState<Preview | null>(null);
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const key = useMemo(() => (request ? JSON.stringify({ ...request, class_id: classId ?? undefined }) : null), [request, classId]);
    const urlRef = useRef<string | null>(null);

    useEffect(() => {
        if (!key) {
            setPreview(null);
            return;
        }
        const ctrl = new AbortController();
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const p = await examDocumentsService.previewFrontNote(JSON.parse(key), ctrl.signal);
                if (ctrl.signal.aborted) return;
                const next = pdfUrl(p.pdf_base64);
                if (urlRef.current) URL.revokeObjectURL(urlRef.current);
                urlRef.current = next;
                setUrl(next);
                setPreview(p);
                setError(null);
            } catch (err) {
                if (ctrl.signal.aborted) return;
                const m = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
                setError(typeof m === "string" ? m : "Could not lay out the preview");
            } finally {
                if (!ctrl.signal.aborted) setLoading(false);
            }
        }, DEBOUNCE_MS);
        return () => {
            clearTimeout(timer);
            ctrl.abort();
        };
    }, [key]);

    useEffect(() => () => {
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    }, []);

    // A class unticked since it was picked: fall back to the tightest.
    useEffect(() => {
        if (classId && request && !request.class_ids.includes(classId)) setClassId(null);
    }, [request, classId]);

    const tooMany = preview ? preview.lines > maxLines : false;
    const spills = preview?.classes.filter((c) => !c.fits) ?? [];
    // Only a result for the request now on screen may block saving.
    const current = preview && request && preview.classes.every((c) => request.class_ids.includes(c.class_id));
    useEffect(() => {
        if (!current) return onVerdict({ blocking: null });
        if (tooMany) return onVerdict({ blocking: `The front note can have at most ${maxLines} lines, so it stays on one page` });
        if (spills.length)
            return onVerdict({
                blocking: `The front note does not fit on the front of the ${spills.map((c) => c.class_name).join(", ")} documents. Shorten it.`,
            });
        onVerdict({ blocking: null });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [current, tooMany, spills.length, preview]);

    if (!request) {
        return (
            <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 p-6 text-sm text-zinc-500 flex items-center gap-2">
                <ScanSearch className="h-4 w-4" /> Choose the campus and tick a class to see the front page as it prints.
            </div>
        );
    }

    const shown = preview?.classes.find((c) => c.class_id === preview.shown_class_id) ?? null;
    const v = shown ? verdict(shown) : null;

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 ml-1">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em]">Live preview, as it prints</span>
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
                {url && (
                    <a href={url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                        Open full size <ExternalLink className="h-3 w-3" />
                    </a>
                )}
            </div>

            {preview && preview.classes.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                    {preview.classes.map((c) => {
                        const t = verdict(c).tone;
                        const active = c.class_id === preview.shown_class_id;
                        return (
                            <button
                                key={c.class_id}
                                type="button"
                                onClick={() => setClassId(c.class_id)}
                                title={`${DOC_TYPE_LABELS[c.doc_type]}, ${c.papers} ${c.papers === 1 ? "paper" : "papers"}`}
                                className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-semibold border ${
                                    active ? "border-primary text-primary bg-primary/5" : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300"
                                }`}
                            >
                                <span className={`h-2 w-2 rounded-full ${DOT[t]}`} />
                                {c.class_name}
                                {c.class_id === preview.tightest_class_id && preview.classes.length > 1 ? <span className="font-normal text-zinc-400">tightest</span> : null}
                            </button>
                        );
                    })}
                </div>
            )}

            {tooMany && (
                <div className={`rounded-xl border px-3 py-2 text-xs flex gap-2 ${TONE.bad}`}>
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {preview!.lines} lines: the front note can have at most {maxLines}. Join or remove some.
                </div>
            )}
            {v && shown && (
                <div className={`rounded-xl border px-3 py-2 text-xs flex gap-2 ${TONE[v.tone]}`}>
                    {v.tone === "ok" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                    <span>
                        <b>
                            {shown.class_name} {DOC_TYPE_LABELS[shown.doc_type].toLowerCase()}:
                        </b>{" "}
                        {v.text}
                    </span>
                </div>
            )}
            {error && <div className={`rounded-xl border px-3 py-2 text-xs ${TONE.bad}`}>{error}</div>}

            <div className="relative rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 overflow-hidden" style={{ aspectRatio: "595 / 842" }}>
                {url ? (
                    <iframe key={url} src={`${url}#toolbar=0&navpanes=0&view=FitH`} title="Front page preview" className="absolute inset-0 h-full w-full bg-white" />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Laying out the front page…
                    </div>
                )}
            </div>
            <p className="text-[11px] text-zinc-400 ml-1">
                A sample student; every student&rsquo;s page is laid out the same way. Papers without a date yet are shown with the longest date.
            </p>
        </div>
    );
}
