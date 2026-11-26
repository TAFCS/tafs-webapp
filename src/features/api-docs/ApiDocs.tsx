"use client";

import { Fragment, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Copy, Download, FileCode2, Info, Loader2, TriangleAlert } from "lucide-react";
import toast from "react-hot-toast";
import { apiDocsService, type ApiDoc, type ApiDocBlock, type ApiDocSection, type ApiDocSummary } from "@/lib/api-docs.service";
import { downloadBlob } from "@/lib/exam-documents.service";

async function copy(text: string) {
    try {
        await navigator.clipboard.writeText(text);
        toast.success("Copied");
    } catch {
        toast.error("Could not copy; select the text and copy it");
    }
}

/** `code` and **bold** only, as the backend content promises. Never HTML. */
function Inline({ text }: { text: string }) {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return (
        <>
            {parts.map((p, i) => {
                if (p.startsWith("**") && p.endsWith("**") && p.length > 4)
                    return <strong key={i} className="font-bold text-zinc-900">{p.slice(2, -2)}</strong>;
                if (p.startsWith("`") && p.endsWith("`") && p.length > 2)
                    return (
                        <code key={i} className="px-1.5 py-0.5 rounded-md bg-zinc-100 text-[0.85em] text-zinc-800 break-words">
                            {p.slice(1, -1)}
                        </code>
                    );
                return <Fragment key={i}>{p}</Fragment>;
            })}
        </>
    );
}

function RenderBlock({ block }: { block: ApiDocBlock }) {
    switch (block.type) {
        case "p":
            return <p className="text-sm text-zinc-600 leading-relaxed"><Inline text={block.text} /></p>;
        case "list": {
            const Tag = block.ordered ? "ol" : "ul";
            return (
                <Tag className={`${block.ordered ? "list-decimal" : "list-disc"} pl-5 space-y-1.5 text-sm text-zinc-600 leading-relaxed marker:text-zinc-400`}>
                    {block.items.map((item, i) => (
                        <li key={i}><Inline text={item} /></li>
                    ))}
                </Tag>
            );
        }
        case "code":
            return (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-950 overflow-hidden">
                    <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-zinc-800">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{block.title ?? "Example"}</span>
                        <button
                            onClick={() => copy(block.code)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
                            title="Copy"
                            aria-label="Copy"
                        >
                            <Copy className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    <pre className="px-4 py-3 text-xs leading-relaxed text-zinc-100 overflow-x-auto"><code>{block.code}</code></pre>
                </div>
            );
        case "note": {
            const warn = block.tone === "warn";
            const Icon = warn ? TriangleAlert : Info;
            return (
                <div className={`flex gap-3 rounded-2xl border p-4 text-sm leading-relaxed ${warn ? "bg-amber-50 border-amber-200 text-amber-950" : "bg-sky-50 border-sky-200 text-sky-950"}`}>
                    <Icon className="h-4 w-4 shrink-0 mt-0.5" />
                    <span><Inline text={block.text} /></span>
                </div>
            );
        }
        case "table":
            return (
                <div className="overflow-x-auto rounded-2xl border border-zinc-100">
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-50 text-[11px] uppercase tracking-wider text-zinc-500">
                            <tr>
                                {block.head.map((h, i) => (
                                    <th key={i} className="text-left px-4 py-2.5 font-bold whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {block.rows.map((row, i) => (
                                <tr key={i} className="align-top">
                                    {row.map((cell, j) => (
                                        <td key={j} className={`px-4 py-2.5 ${j === 0 ? "font-semibold text-zinc-900" : "text-zinc-600"}`}>
                                            <Inline text={cell} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
    }
}

function RenderSection({ section, depth = 0 }: { section: ApiDocSection; depth?: number }) {
    const body = (
        <>
            {section.blocks.map((b, i) => <RenderBlock key={i} block={b} />)}
            {section.subsections?.map((s) => <RenderSection key={s.id} section={s} depth={depth + 1} />)}
        </>
    );
    if (depth === 0)
        return (
            <section id={section.id} className="scroll-mt-24 bg-white p-6 rounded-[28px] border border-zinc-100 shadow-sm space-y-4">
                <h2 className="text-lg font-black text-zinc-900">{section.title}</h2>
                {body}
            </section>
        );
    return (
        <div id={section.id} className="scroll-mt-24 space-y-3 pt-2">
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-500">{section.title}</h3>
            {body}
        </div>
    );
}

/**
 * TAFSD-614: the API Docs page (/system/api-docs, tile system.api_docs).
 * Everything shown comes from the backend, which refuses anyone without the tile.
 */
export default function ApiDocs() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [docs, setDocs] = useState<ApiDocSummary[] | null>(null);
    const [doc, setDoc] = useState<ApiDoc | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [downloading, setDownloading] = useState(false);

    const selected = searchParams.get("doc") ?? docs?.[0]?.slug ?? null;
    const summary = docs?.find((d) => d.slug === selected) ?? null;

    useEffect(() => {
        apiDocsService
            .list()
            .then(setDocs)
            .catch((e) => setError(e?.response?.data?.message ?? "Could not load the API docs"));
    }, []);

    useEffect(() => {
        if (!selected) return;
        let live = true;
        setDoc(null);
        apiDocsService
            .get(selected)
            .then((d) => live && setDoc(d))
            .catch((e) => live && setError(e?.response?.data?.message ?? "Could not load this document"));
        return () => {
            live = false;
        };
    }, [selected]);

    const pick = (slug: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("doc", slug);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const downloadPdf = async () => {
        if (!doc) return;
        setDownloading(true);
        try {
            downloadBlob(await apiDocsService.pdf(doc.slug), doc.downloadName);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not download the PDF");
        } finally {
            setDownloading(false);
        }
    };

    if (error)
        return (
            <div className="max-w-6xl mx-auto rounded-[28px] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900">{error}</div>
        );

    return (
        <div className="max-w-6xl mx-auto pb-20">
            <div className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm space-y-5 mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-2xl">
                        <FileCode2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-zinc-900">API Docs</h1>
                        <p className="text-xs font-semibold text-zinc-400">The external APIs TAFSync runs, as the code implements them today</p>
                    </div>
                </div>

                {!docs ? (
                    <div className="flex items-center gap-2 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3" role="tablist">
                        {docs.map((d) => {
                            const active = d.slug === selected;
                            return (
                                <button
                                    key={d.slug}
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => pick(d.slug)}
                                    className={`text-left rounded-2xl border p-4 transition ${active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-zinc-100 bg-zinc-50/60 hover:bg-zinc-50"}`}
                                >
                                    <div className="text-sm font-black text-zinc-900">{d.title}</div>
                                    <div className="text-xs text-zinc-500 mt-0.5">{d.subtitle}</div>
                                    <div className="text-[11px] font-semibold text-zinc-400 mt-2">Version {d.version} · checked {d.updated}</div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {summary && (
                <div className="bg-white p-6 rounded-[28px] border border-zinc-100 shadow-sm mb-8 flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-3xl space-y-1">
                        <h2 className="text-xl font-black text-zinc-900">{summary.title}</h2>
                        <p className="text-sm text-zinc-600 leading-relaxed">{summary.summary}</p>
                    </div>
                    <button
                        onClick={downloadPdf}
                        disabled={!doc || !summary.pdf_available || downloading}
                        title={summary.pdf_available ? undefined : "The PDF for this document has not been built"}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50"
                    >
                        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download PDF (A4)
                    </button>
                </div>
            )}

            {docs && !doc && (
                <div className="flex items-center gap-2 text-sm text-zinc-500 px-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading document…</div>
            )}

            {doc && (
                <div className="grid grid-cols-1 lg:grid-cols-[13rem_1fr] gap-8">
                    <nav className="hidden lg:block">
                        <div className="sticky top-24 space-y-1 text-sm">
                            <div className="text-[11px] font-black uppercase tracking-wider text-zinc-400 px-3 pb-1">Contents</div>
                            {doc.sections.map((s) => (
                                <a key={s.id} href={`#${s.id}`} className="block px-3 py-1.5 rounded-xl text-zinc-600 hover:bg-white hover:text-zinc-900">
                                    {s.title}
                                </a>
                            ))}
                        </div>
                    </nav>
                    <div className="space-y-6 min-w-0">
                        {doc.sections.map((s) => <RenderSection key={s.id} section={s} />)}
                    </div>
                </div>
            )}
        </div>
    );
}
