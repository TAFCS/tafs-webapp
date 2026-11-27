"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, Loader2, Save, X } from "lucide-react";
import {
    campusesService,
    type Campus,
    type DocumentFooterPreview,
    type DocumentFooterPreviewArea,
} from "@/lib/campuses.service";

/**
 * TAFSD-603: the footer a campus's official documents print, with a live preview. A moment after
 * typing stops, the backend lays the draft out on each kind of document with the code that prints
 * it (the statement of entry / admit card footer, and the campus's own leaving-certificate blank)
 * and the editor shows that strip of the page, with each line's printed size. A line never wraps:
 * it prints smaller to stay on one line, and one too long even at the smallest size blocks saving.
 */

const DEBOUNCE_MS = 600;

/** The lines as the backend stores them: trimmed, single-spaced, blank lines dropped. */
const clean = (text: string) =>
    text
        .split("\n")
        .map((l) => l.replace(/\s+/g, " ").trim())
        .filter(Boolean);

function pdfUrl(base64: string): string {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
}

const pt = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}pt`;

const TONE = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    warn: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    bad: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
};

function verdict(a: DocumentFooterPreviewArea): { tone: keyof typeof TONE; text: string } {
    if (a.source === "DOCUMENT_DEFAULT") {
        return {
            tone: "ok",
            text:
                a.id === "LEAVING_CERTIFICATE"
                    ? "No footer set: the footer printed on the school's blank stays."
                    : "No footer set: the campus address and UAN print, then the school's emails and website.",
        };
    }
    const over = a.lines.findIndex((l) => l.overflow);
    if (over >= 0) return { tone: "bad", text: `Line ${over + 1} is too long even at the smallest size. Shorten it or split it.` };
    const shrunk = a.lines.map((l, i) => ({ l, i })).filter(({ l }) => l.shrunk);
    if (shrunk.length) {
        return {
            tone: "warn",
            text: `Fits by printing smaller: ${shrunk.map(({ l, i }) => `line ${i + 1} at ${pt(l.size)}`).join(", ")} instead of ${pt(shrunk[0].l.full_size)}.`,
        };
    }
    return { tone: "ok", text: `Every line fits at full size (${pt(a.lines[0]?.full_size ?? 0)}).` };
}

function AreaPreview({ area }: { area: DocumentFooterPreviewArea }) {
    const url = useMemo(() => pdfUrl(area.pdf_base64), [area.pdf_base64]);
    useEffect(() => () => URL.revokeObjectURL(url), [url]);
    const v = verdict(area);
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 ml-1">
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200">{area.label}</span>
                <a href={url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    Open full size <ExternalLink className="h-3 w-3" />
                </a>
            </div>
            <div className={`rounded-xl border px-3 py-2 text-xs flex gap-2 ${TONE[v.tone]}`}>
                {v.tone === "ok" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                <span>{v.text}</span>
            </div>
            <div
                className="relative rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white overflow-hidden"
                style={{ aspectRatio: `${area.width} / ${area.height}` }}
            >
                <iframe key={url} src={`${url}#toolbar=0&navpanes=0&view=FitH`} title={`${area.label} footer preview`} className="absolute inset-0 h-full w-full bg-white" />
            </div>
        </div>
    );
}

export function DocumentFooterEditor({
    campus,
    canEdit,
    onClose,
    onSaved,
}: {
    campus: Campus;
    canEdit: boolean;
    onClose: () => void;
    onSaved: (lines: string[]) => void;
}) {
    const saved = useMemo(() => campus.document_footer ?? [], [campus.document_footer]);
    const [text, setText] = useState(saved.join("\n"));
    const [preview, setPreview] = useState<DocumentFooterPreview | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const draft = useMemo(() => clean(text), [text]);
    const key = JSON.stringify(draft);
    const firstRun = useRef(true);

    useEffect(() => {
        const ctrl = new AbortController();
        const timer = setTimeout(
            async () => {
                setLoading(true);
                try {
                    const p = await campusesService.previewDocumentFooter(campus.id, JSON.parse(key), ctrl.signal);
                    if (ctrl.signal.aborted) return;
                    setPreview(p);
                    setError(null);
                } catch (err) {
                    if (ctrl.signal.aborted) return;
                    const m = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
                    setError(typeof m === "string" ? m : "Could not lay out the preview");
                } finally {
                    if (!ctrl.signal.aborted) setLoading(false);
                }
            },
            firstRun.current ? 0 : DEBOUNCE_MS,
        );
        firstRun.current = false;
        return () => {
            clearTimeout(timer);
            ctrl.abort();
        };
    }, [campus.id, key]);

    // Only a preview of the lines now on screen may allow saving.
    const current = preview !== null && JSON.stringify(preview.lines) === key;
    const unchanged = JSON.stringify(saved) === key;
    const tooMany = draft.length > (preview?.max_lines ?? 3);
    const maxChars = preview?.max_chars ?? 160;
    const blocking = !current ? "Laying out the preview…" : preview.problems.length ? preview.problems[0] : null;
    const canSave = canEdit && !saving && !unchanged && current && !preview.problems.length;

    const save = async () => {
        if (!canSave) return;
        setSaving(true);
        setError(null);
        try {
            onSaved(await campusesService.saveDocumentFooter(campus.id, draft));
        } catch (err) {
            const m = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
            setError(typeof m === "string" ? m : Array.isArray(m) ? m.join(" ") : "Could not save the footer");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" /> Document footer
                        </h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            {campus.campus_name.toUpperCase()} · printed at the bottom of its statements of entry, admit cards and leaving certificates.
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full" aria-label="Close">
                        <X className="h-5 w-5 text-zinc-500" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    <div className="space-y-1.5">
                        <label htmlFor="document-footer" className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] ml-1">
                            Footer lines
                        </label>
                        <textarea
                            id="document-footer"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            disabled={!canEdit}
                            rows={4}
                            spellCheck={false}
                            placeholder={"C-61, 62, 63, 64 & 65, Block - 13, Gulistan-e-Jauhar, Karachi, Pakistan.\nPhone: 3461-2878 · Fax: (92-21) 3461-2881 · Helpline: 0300-8258061\nE-mail: american@cyber.net.pk · Website: www.tafs.edu.pk"}
                            className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-mono leading-6 outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                        />
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 ml-1 text-[11px] text-zinc-500">
                            <span className={tooMany ? "text-red-600 font-semibold" : ""}>
                                {draft.length} of {preview?.max_lines ?? 3} lines
                            </span>
                            {draft.map((l, i) => (
                                <span key={i} className={l.length > maxChars ? "text-red-600 font-semibold" : ""}>
                                    line {i + 1}: {l.length}/{maxChars}
                                </span>
                            ))}
                        </div>
                        <p className="text-[11px] text-zinc-400 ml-1">
                            One printed line per line, as typed. A long line prints smaller to stay on one line. Leave it empty to keep each document&rsquo;s own footer.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-2 ml-1">
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em]">Live preview, as it prints</span>
                            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
                        </div>
                        {preview && current && preview.problems.length > 0 && (
                            <div className={`rounded-xl border px-3 py-2 text-xs ${TONE.bad}`}>
                                <ul className="list-disc ml-4 space-y-0.5">
                                    {preview.problems.map((p, i) => (
                                        <li key={i}>{p}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {preview ? (
                            <div className={`space-y-5 transition-opacity ${current ? "" : "opacity-60"}`}>
                                {preview.areas.map((a) => (
                                    <AreaPreview key={a.id} area={a} />
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-sm text-zinc-400 flex items-center justify-center">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Laying out the footer…
                            </div>
                        )}
                        {error && <div className={`rounded-xl border px-3 py-2 text-xs ${TONE.bad}`}>{error}</div>}
                    </div>
                </div>

                <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-3 bg-zinc-50 dark:bg-zinc-900/50">
                    {!unchanged && blocking && <span className="mr-auto text-xs text-zinc-500 truncate">{blocking}</span>}
                    <button type="button" onClick={onClose} className="h-10 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl">
                        {canEdit ? "Cancel" : "Close"}
                    </button>
                    {canEdit && (
                        <button
                            type="button"
                            onClick={save}
                            disabled={!canSave}
                            className="h-10 px-5 inline-flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-40"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Save footer
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
