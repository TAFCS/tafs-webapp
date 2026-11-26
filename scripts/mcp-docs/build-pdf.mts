/**
 * TAFSD-615: build the MCP Docs A4 PDF from the same content as the page.
 *
 *   node scripts/mcp-docs/build-pdf.mts        (Node 23.6+ runs TypeScript as is; needs tectonic: brew install tectonic)
 *
 * Writes docs/mcp-docs/TAFSync-AI-Assistant-MCP-Guide.tex (kept in git so a
 * change can be reviewed), compiles it with Tectonic against
 * docs/mcp-docs/tafs-manual.sty (a copy of the TAFSync Software Manual style),
 * and copies the PDF to public/docs/, where the page's Download button points.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    EXAMPLES,
    KEY_FACTS,
    LATE_SECTIONS,
    MCP_DOCS_DATE,
    MCP_DOCS_INTRO,
    MCP_DOCS_PDF_PATH,
    MCP_DOCS_SECTIONS,
    MCP_DOCS_VERSION,
    MCP_ENDPOINT,
    TOOLS_SECTION,
    TOOL_NOTES,
    type Block,
    type Section,
} from "../../src/features/mcp-docs/content.ts";
import { MCP_GENERATED, MCP_TOOLS_SOURCE_COMMIT } from "../../src/features/mcp-docs/mcp-tools.generated.ts";
import { describeAccess, describeArg, type GeneratedTool } from "../../src/features/mcp-docs/tool-format.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const docsDir = join(root, "docs", "mcp-docs");
const name = "TAFSync-AI-Assistant-MCP-Guide";
const TOOLS = MCP_GENERATED.tools as unknown as GeneratedTool[];

/** Escape plain text for LaTeX. */
function esc(s: string): string {
    return s
        .replace(/\\/g, "\u0000")
        .replace(/([&%$#_{}])/g, "\\$1")
        .replace(/~/g, "\\textasciitilde{}")
        .replace(/\^/g, "\\textasciicircum{}")
        .replace(/\u0000/g, "\\textbackslash{}");
}

/** Code in running text: breakable after / . - _ so long values wrap. */
function code(s: string): string {
    if (/^https:\/\/\S+$/.test(s)) return `\\url{${s}}`;
    return `\\texttt{${esc(s).replace(/([/.\-]|\\_)/g, "$1\\allowbreak{}")}}`;
}

/** The inline markup of content.ts: **bold**, `code`, [[UI label]], bare links. */
function inline(text: string): string {
    return text
        .split(/(\*\*[^*]+\*\*|`[^`]+`|\[\[[^\]]+\]\]|https:\/\/[^\s,)]+[^\s,).])/g)
        .map((p) => {
            if (p.startsWith("**")) return `\\textbf{${esc(p.slice(2, -2))}}`;
            if (p.startsWith("`")) return code(p.slice(1, -1));
            if (p.startsWith("[[")) return `\\ui{${esc(p.slice(2, -2)).replace(/ &gt; | > /g, " \\textgreater{} ")}}`;
            if (p.startsWith("https://")) return `\\url{${p}}`;
            return esc(p);
        })
        .join("");
}

function table(head: string[], rows: string[][], widths: number[]): string {
    const cols = widths.map((w) => `>{\\raggedright\\arraybackslash}p{${w}\\textwidth}`).join("");
    const headRow = head.map((h) => `\\textbf{${esc(h)}}`).join(" & ") + " \\\\";
    return [
        `\\begin{longtable}{@{}${cols}@{}}`,
        "\\toprule",
        headRow,
        "\\midrule\\endhead",
        ...rows.map((r) => r.map((c, i) => (i === 0 && widths.length === 2 ? `\\textbf{${inline(c)}}` : inline(c))).join(" & ") + " \\\\"),
        "\\bottomrule",
        "\\end{longtable}",
    ].join("\n");
}

function block(b: Block): string {
    switch (b.kind) {
        case "p":
            return inline(b.text) + "\n";
        case "steps":
            return ["\\begin{enumerate}", ...b.items.map((i) => `  \\item ${inline(i)}`), "\\end{enumerate}"].join("\n");
        case "list":
            return ["\\begin{itemize}", ...b.items.map((i) => `  \\item ${inline(i)}`), "\\end{itemize}"].join("\n");
        case "code":
            return ["\\begin{lstlisting}", b.text, "\\end{lstlisting}"].join("\n");
        case "note":
            return `\\note[${esc(b.title)}]{${inline(b.text)}}`;
        case "tip":
            return `\\tip[${esc(b.title)}]{${inline(b.text)}}`;
        case "warn":
            return `\\warning[${esc(b.title)}]{${inline(b.text)}}`;
        case "table":
            return table(b.head, b.rows, b.widths ?? [0.3, 0.67]);
    }
}

function section(s: Section): string {
    const out = [`\\section{${esc(s.title)}}\\label{${s.id}}`];
    for (const b of s.blocks ?? []) out.push(block(b));
    for (const p of s.parts ?? []) {
        out.push(`\\subsection{${esc(p.title)}}\\label{${p.id}}`);
        for (const b of p.blocks) out.push(block(b));
    }
    return out.join("\n\n");
}

function tool(t: GeneratedTool): string {
    const note = TOOL_NOTES[t.name];
    const args = Object.entries(t.inputSchema.properties ?? {});
    const required = new Set(t.inputSchema.required ?? []);
    const out = [
        `\\subsection{\\texttt{${esc(t.name)}}: ${esc(t.title)}}\\label{tool-${t.name.replace(/_/g, "-")}}`,
        esc(t.description),
        "",
        "\\begin{description}[leftmargin=7.5em, style=nextline, itemsep=1pt]",
    ];
    if (note) out.push(`  \\item[Returns] ${esc(note.returns)}`);
    out.push(`  \\item[Who gets it] ${esc(describeAccess(t))}`);
    if (note) {
        out.push(`  \\item[Scope] ${esc(note.scope)}`);
        out.push(`  \\item[Try] \\emph{\u201C${esc(note.example)}\u201D}`);
    }
    out.push("\\end{description}");
    if (args.length) {
        out.push(
            table(
                ["Input", "Type", "Meaning"],
                args.map(([k, s]) => {
                    const d = describeArg(s);
                    return [`\`${k}\`${required.has(k) ? " (required)" : ""}`, d.type, d.meaning];
                }),
                [0.25, 0.19, 0.5],
            ),
        );
    } else {
        out.push("\\noindent\\textit{No inputs.}\n");
    }
    if (note?.caveat) out.push(`\\warning[Good to know]{${esc(note.caveat)}}`);
    return out.join("\n");
}

const tex = String.raw`% GENERATED by scripts/mcp-docs/build-pdf.mts from src/features/mcp-docs (TAFSD-615).
% Do not edit by hand: change content.ts and rebuild.
\documentclass[11pt]{article}
\usepackage{tafs-manual}
\setlength{\parskip}{4pt}
\setlength{\parindent}{0pt}
\renewcommand{\manualheader}{TAFSync AI Assistant (MCP) Guide}
\hypersetup{pdftitle={TAFSync AI Assistant (MCP) Guide}, pdfauthor={TAFS IT and Software Department}}

\begin{document}
\manualcover{TAFSync AI Assistant}{Connecting Claude or ChatGPT to TAFSync (MCP)\\[4pt]\normalsize Version ${MCP_DOCS_VERSION}}{${MCP_DOCS_DATE}}

\tableofcontents
\clearpage

${esc(MCP_DOCS_INTRO)}

\begin{center}
\begin{tabularx}{\textwidth}{@{}l L@{}}
\toprule
\textbf{Server address} & \url{${MCP_ENDPOINT}} \\
\textbf{On the dashboard} & \menu{System \textgreater{} MCP Docs}, or \menu{System \textgreater{} AI Assistant (MCP)} \textgreater{} Read the guide \\
\midrule
${KEY_FACTS.map((f) => `\\textbf{${esc(f.title)}} & ${esc(f.text)} \\\\`).join("\n")}
\bottomrule
\end{tabularx}
\end{center}

${MCP_DOCS_SECTIONS.map(section).join("\n\n")}

\section{${esc(TOOLS_SECTION.title)}}\label{${TOOLS_SECTION.id}}
${esc(TOOLS_SECTION.intro)}

${table(
    ["Tool", "What it is for"],
    TOOLS.map((t) => [`\`${t.name}\``, t.title]),
    [0.35, 0.62],
)}

${TOOLS.map(tool).join("\n\n")}

\medskip
{\small\color{black!55} Generated from the MCP server code at tafs-backend ${MCP_TOOLS_SOURCE_COMMIT}.}

\section{Example questions}\label{examples}
\begin{itemize}
${EXAMPLES.map((q) => `  \\item \\emph{\u201C${esc(q)}\u201D}`).join("\n")}
\end{itemize}

${LATE_SECTIONS.map(section).join("\n\n")}

\vfill
{\small\color{black!55} TAFS IT and Software Department \,--\, The American Foundation School. The same guide is on the dashboard under \menu{System \textgreater{} MCP Docs}.}
\end{document}
`;

mkdirSync(join(docsDir, "build"), { recursive: true });
const texPath = join(docsDir, `${name}.tex`);
writeFileSync(texPath, tex);
execFileSync("tectonic", ["-X", "compile", "--keep-logs", "--outdir", join(docsDir, "build"), texPath], {
    cwd: docsDir,
    stdio: "inherit",
});
const publicPath = join(root, "public", MCP_DOCS_PDF_PATH);
mkdirSync(dirname(publicPath), { recursive: true });
copyFileSync(join(docsDir, "build", `${name}.pdf`), publicPath);
console.log(`wrote ${texPath}\nwrote ${publicPath}`);
