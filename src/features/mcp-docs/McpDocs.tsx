"use client";

import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { BookOpen, Copy, Download, Info, Lightbulb, TriangleAlert } from "lucide-react";
import toast from "react-hot-toast";
import {
    Block,
    EXAMPLES,
    KEY_FACTS,
    LATE_SECTIONS,
    MCP_DOCS_DATE,
    MCP_DOCS_INTRO,
    MCP_DOCS_PDF_PATH,
    MCP_DOCS_SECTIONS,
    MCP_DOCS_VERSION,
    MCP_ENDPOINT,
    Section,
    TOOLS_SECTION,
    TOOL_NOTES,
} from "./content";
import { MCP_GENERATED, MCP_TOOLS_SOURCE_COMMIT } from "./mcp-tools.generated";
import { describeArg, describeAccess, type GeneratedTool } from "./tool-format";

const TOOLS = MCP_GENERATED.tools as unknown as GeneratedTool[];

async function copy(text: string) {
    try {
        await navigator.clipboard.writeText(text);
        toast.success("Copied");
    } catch {
        toast.error("Could not copy; select the text and copy it");
    }
}

/** **bold**, `code`, [[UI label]] and bare https links, as in content.ts. */
function Inline({ text }: { text: string }) {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[\[[^\]]+\]\]|https:\/\/[^\s,)]+[^\s,).])/g);
    return (
        <>
            {parts.map((p, i) => {
                if (p.startsWith("**")) return <strong key={i} className="font-bold text-zinc-900">{p.slice(2, -2)}</strong>;
                if (p.startsWith("`"))
                    return (
                        <code key={i} className="px-1.5 py-0.5 rounded-md bg-zinc-100 text-[0.85em] text-zinc-800 break-all">
                            {p.slice(1, -1)}
                        </code>
                    );
                if (p.startsWith("[["))
                    return <span key={i} className="font-semibold text-zinc-900">{p.slice(2, -2)}</span>;
                if (p.startsWith("https://"))
                    return (
                        <a key={i} href={p} target="_blank" rel="noreferrer" className="text-primary underline break-all">
                            {p}
                        </a>
                    );
                return <Fragment key={i}>{p}</Fragment>;
            })}
        </>
    );
}

const BOX = {
    note: { cls: "bg-sky-50 border-sky-200 text-sky-950", Icon: Info },
    tip: { cls: "bg-emerald-50 border-emerald-200 text-emerald-950", Icon: Lightbulb },
    warn: { cls: "bg-amber-50 border-amber-200 text-amber-950", Icon: TriangleAlert },
} as const;

function RenderBlock({ block }: { block: Block }) {
    switch (block.kind) {
        case "p":
            return <p className="text-sm text-zinc-600 leading-relaxed"><Inline text={block.text} /></p>;
        case "steps":
            return (
                <ol className="space-y-2">
                    {block.items.map((item, i) => (
                        <li key={i} className="flex gap-3 text-sm text-zinc-600 leading-relaxed">
                            <span className="shrink-0 h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-black flex items-center justify-center">
                                {i + 1}
                            </span>
                            <span className="pt-0.5"><Inline text={item} /></span>
                        </li>
                    ))}
                </ol>
            );
        case "list":
            return (
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-zinc-600 leading-relaxed marker:text-zinc-300">
                    {block.items.map((item, i) => (
                        <li key={i}><Inline text={item} /></li>
                    ))}
                </ul>
            );
        case "code":
            return (
                <div className="flex items-start gap-2">
                    <code className="flex-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs break-all">{block.text}</code>
                    <button
                        onClick={() => copy(block.text)}
                        className="p-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50"
                        title="Copy"
                        aria-label="Copy"
                    >
                        <Copy className="h-4 w-4" />
                    </button>
                </div>
            );
        case "note":
        case "tip":
        case "warn": {
            const { cls, Icon } = BOX[block.kind];
            return (
                <div className={`rounded-2xl border p-4 text-sm leading-relaxed ${cls}`}>
                    <div className="flex items-center gap-2 font-bold mb-1">
                        <Icon className="h-4 w-4" /> {block.title}
                    </div>
                    <Inline text={block.text} />
                </div>
            );
        }
        case "table":
            return (
                <div className="overflow-x-auto rounded-2xl border border-zinc-100">
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-50 text-[11px] uppercase tracking-wider text-zinc-500">
                            <tr>
                                {block.head.map((h) => (
                                    <th key={h} className="text-left px-4 py-2.5 font-bold">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {block.rows.map((row, i) => (
                                <tr key={i} className="align-top">
                                    {row.map((cell, j) => (
                                        <td key={j} className={`px-4 py-2.5 ${j === 0 ? "font-semibold text-zinc-900 w-1/3" : "text-zinc-600"}`}>
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

function Card({ id, title, children }: { id: string; title: string; children: ReactNode }) {
    return (
        <section id={id} className="scroll-mt-24 bg-white p-6 rounded-[28px] border border-zinc-100 shadow-sm space-y-4">
            <h2 className="text-lg font-black text-zinc-900">{title}</h2>
            {children}
        </section>
    );
}

function RenderSection({ section }: { section: Section }) {
    return (
        <Card id={section.id} title={section.title}>
            {section.blocks?.map((b, i) => <RenderBlock key={i} block={b} />)}
            {section.parts?.map((part) => (
                <div key={part.id} id={part.id} className="scroll-mt-24 space-y-3 pt-2">
                    <h3 className="text-sm font-black uppercase tracking-wider text-zinc-500">{part.title}</h3>
                    {part.blocks.map((b, i) => <RenderBlock key={i} block={b} />)}
                </div>
            ))}
        </Card>
    );
}

function ToolCard({ tool }: { tool: GeneratedTool }) {
    const note = TOOL_NOTES[tool.name];
    const args = Object.entries(tool.inputSchema.properties ?? {});
    const required = new Set(tool.inputSchema.required ?? []);
    const access = describeAccess(tool);
    return (
        <div id={`tool-${tool.name}`} className="scroll-mt-24 rounded-2xl border border-zinc-100 p-5 space-y-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <code className="text-base font-black text-zinc-900">{tool.name}</code>
                <span className="text-sm text-zinc-500">{tool.title}</span>
            </div>
            <p className="text-sm text-zinc-600">{tool.description}</p>
            {note && (
                <dl className="grid grid-cols-1 sm:grid-cols-[9rem_1fr] gap-x-4 gap-y-1.5 text-sm">
                    <dt className="font-bold text-zinc-900">Returns</dt>
                    <dd className="text-zinc-600">{note.returns}</dd>
                    <dt className="font-bold text-zinc-900">Who gets it</dt>
                    <dd className="text-zinc-600">{access}</dd>
                    <dt className="font-bold text-zinc-900">Scope</dt>
                    <dd className="text-zinc-600">{note.scope}</dd>
                    <dt className="font-bold text-zinc-900">Try</dt>
                    <dd className="text-zinc-600 italic">“{note.example}”</dd>
                </dl>
            )}
            {args.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-zinc-100">
                    <table className="w-full text-xs">
                        <thead className="bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-500">
                            <tr>
                                <th className="text-left px-3 py-2 font-bold">Input</th>
                                <th className="text-left px-3 py-2 font-bold">Type</th>
                                <th className="text-left px-3 py-2 font-bold">Meaning</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {args.map(([key, schema]) => {
                                const d = describeArg(schema);
                                return (
                                    <tr key={key} className="align-top">
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <code className="font-bold text-zinc-900">{key}</code>
                                            {required.has(key) && <span className="ml-1.5 text-[10px] font-bold text-rose-600">required</span>}
                                        </td>
                                        <td className="px-3 py-2 text-zinc-500 whitespace-nowrap">{d.type}</td>
                                        <td className="px-3 py-2 text-zinc-600">{d.meaning}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-xs text-zinc-400">No inputs.</p>
            )}
            {note?.caveat && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">{note.caveat}</div>
            )}
        </div>
    );
}

const TOC: { id: string; title: string }[] = [
    ...MCP_DOCS_SECTIONS.map((s) => ({ id: s.id, title: s.title })),
    { id: TOOLS_SECTION.id, title: TOOLS_SECTION.title },
    { id: "examples", title: "Example questions" },
    ...LATE_SECTIONS.map((s) => ({ id: s.id, title: s.title })),
];

/**
 * TAFSD-615: the MCP Docs page. Shown on its own tile (/system/mcp-docs) and,
 * for holders of the AI Assistant tile, at /system/ai-assistant/docs.
 */
export default function McpDocs() {
    return (
        <div className="max-w-6xl mx-auto pb-20">
            <div className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm space-y-4 mb-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 rounded-2xl">
                            <BookOpen className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-zinc-900">MCP Docs</h1>
                            <p className="text-xs font-semibold text-zinc-400">
                                TAFSync AI Assistant guide · version {MCP_DOCS_VERSION} · {MCP_DOCS_DATE}
                            </p>
                        </div>
                    </div>
                    <a
                        href={MCP_DOCS_PDF_PATH}
                        download
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary text-white text-sm font-bold hover:opacity-90"
                    >
                        <Download className="h-4 w-4" /> Download PDF (A4)
                    </a>
                </div>
                <p className="text-zinc-600 text-sm font-medium max-w-3xl leading-relaxed">{MCP_DOCS_INTRO}</p>
                <div className="flex items-center gap-2 max-w-2xl">
                    <code className="flex-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs break-all">{MCP_ENDPOINT}</code>
                    <button
                        onClick={() => copy(MCP_ENDPOINT)}
                        className="p-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50"
                        title="Copy the address"
                        aria-label="Copy the address"
                    >
                        <Copy className="h-4 w-4" />
                    </button>
                </div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-3 pt-2">
                    {KEY_FACTS.map((f) => (
                        <div key={f.title} className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4">
                            <div className="text-sm font-black text-zinc-900">{f.title}</div>
                            <div className="text-xs text-zinc-500 mt-1 leading-relaxed">{f.text}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[13rem_1fr] gap-8">
                <nav className="hidden lg:block">
                    <div className="sticky top-24 space-y-1 text-sm">
                        <div className="text-[11px] font-black uppercase tracking-wider text-zinc-400 px-3 pb-1">Contents</div>
                        {TOC.map((t) => (
                            <Link key={t.id} href={`#${t.id}`} className="block px-3 py-1.5 rounded-xl text-zinc-600 hover:bg-white hover:text-zinc-900">
                                {t.title}
                            </Link>
                        ))}
                    </div>
                </nav>

                <div className="space-y-6 min-w-0">
                    {MCP_DOCS_SECTIONS.map((s) => <RenderSection key={s.id} section={s} />)}

                    <Card id={TOOLS_SECTION.id} title={`${TOOLS_SECTION.title} (${TOOLS.length})`}>
                        <p className="text-sm text-zinc-600 leading-relaxed">{TOOLS_SECTION.intro}</p>
                        <div className="flex flex-wrap gap-2">
                            {TOOLS.map((t) => (
                                <Link key={t.name} href={`#tool-${t.name}`} className="px-2.5 py-1 rounded-lg bg-zinc-100 text-xs font-mono text-zinc-700 hover:bg-zinc-200">
                                    {t.name}
                                </Link>
                            ))}
                        </div>
                        <div className="space-y-4">
                            {TOOLS.map((t) => <ToolCard key={t.name} tool={t} />)}
                        </div>
                        <p className="text-[11px] text-zinc-400">Generated from the MCP server code at tafs-backend {MCP_TOOLS_SOURCE_COMMIT}.</p>
                    </Card>

                    <Card id="examples" title="Example questions">
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {EXAMPLES.map((q) => (
                                <li key={q} className="rounded-2xl border border-zinc-100 bg-zinc-50/60 px-4 py-3 text-sm text-zinc-700 italic">“{q}”</li>
                            ))}
                        </ul>
                    </Card>

                    {LATE_SECTIONS.map((s) => <RenderSection key={s.id} section={s} />)}
                </div>
            </div>
        </div>
    );
}
