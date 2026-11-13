"use client";

import { useEffect, useState } from "react";
import { Archive, Download, ExternalLink, FileWarning, History, Loader2, RotateCcw, Upload } from "lucide-react";
import toast from "react-hot-toast";
import {
    errMsg,
    formatBytes,
    formatDate,
    studentDocumentsService,
    type DocumentType,
    type VaultDocument,
    type VaultPermissions,
} from "@/lib/student-documents.service";
import { VaultModal } from "./VaultModal";

/** Opens a version in a new tab or downloads it. Each call is logged server-side. */
export async function openVersion(versionId: number, disposition: "inline" | "attachment", cc?: number) {
    try {
        const { url } = await studentDocumentsService.link(versionId, disposition, cc);
        if (disposition === "attachment") {
            const a = document.createElement("a");
            a.href = url;
            a.rel = "noopener";
            document.body.appendChild(a);
            a.click();
            a.remove();
        } else {
            window.open(url, "_blank", "noopener");
        }
    } catch (err) {
        toast.error(errMsg(err, "Couldn't open the file"));
    }
}

export function DocumentViewer({
    cc,
    doc,
    type,
    ownerLabel,
    perms,
    onClose,
    onReplace,
    onArchive,
    onRestore,
    onChanged,
}: {
    /** The student whose vault is open. */
    cc: number;
    doc: VaultDocument | null;
    type: DocumentType | null;
    ownerLabel: string;
    perms: VaultPermissions;
    onClose: () => void;
    onReplace: (doc: VaultDocument) => void;
    onArchive: (doc: VaultDocument) => void;
    onRestore: (doc: VaultDocument) => void;
    onChanged: () => void;
}) {
    const [versionId, setVersionId] = useState<number | null>(null);
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setVersionId(doc?.current?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the document or its current version changes
    }, [doc?.id, doc?.current?.id]);

    const version = doc?.versions.find((v) => v.id === versionId) ?? null;

    useEffect(() => {
        if (!versionId) return;
        let cancelled = false;
        setLoading(true);
        setFailed(false);
        setUrl(null);
        studentDocumentsService
            .link(versionId, "inline", cc)
            .then((r) => !cancelled && setUrl(r.url))
            .catch(() => !cancelled && setFailed(true))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- cc is fixed for the vault's lifetime
    }, [versionId]);

    if (!doc || !type) return null;
    const isCurrent = version?.id === doc.current?.id;
    const isPdf = version?.mime_type === "application/pdf";
    const generated = type.origin === "GENERATED";

    const makeCurrent = async () => {
        if (!version) return;
        setBusy(true);
        try {
            await studentDocumentsService.makeCurrent(doc.id, version.id, cc);
            toast.success(`Version ${version.version_no} is current again`);
            onChanged();
        } catch (err) {
            toast.error(errMsg(err, "Couldn't change the current version"));
        } finally {
            setBusy(false);
        }
    };

    const heading = `${type.name}${doc.title ? ` · ${doc.title}` : ""}`;

    return (
        <VaultModal
            open
            onClose={onClose}
            size="xl"
            title={heading}
            subtitle={
                <>
                    {ownerLabel}
                    {doc.academic_year ? ` · ${doc.academic_year}` : ""}
                    {doc.archived_at ? (
                        <span className="ml-2 rounded-md bg-zinc-200 px-1.5 py-0.5 text-[10px] font-black uppercase text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">Archived</span>
                    ) : null}
                </>
            }
        >
            <div className="grid h-full min-h-[60vh] lg:grid-cols-[1fr_20rem]">
                {/* Preview */}
                <div className="relative flex min-h-[50vh] items-center justify-center bg-zinc-100 dark:bg-zinc-950">
                    {loading && <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />}
                    {failed && (
                        <div className="flex flex-col items-center gap-2 p-6 text-center text-zinc-500">
                            <FileWarning className="h-8 w-8" />
                            <p className="text-sm font-bold">The file couldn&apos;t be loaded.</p>
                            <p className="text-xs">Try again in a moment, or download it.</p>
                        </div>
                    )}
                    {url && !loading && (isPdf ? (
                        <iframe src={url} title={heading} className="h-full min-h-[60vh] w-full border-0" />
                    ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={heading} className="max-h-[75vh] max-w-full object-contain p-4" />
                    ))}
                    {!isCurrent && version && (
                        <div className="absolute left-3 top-3 rounded-lg bg-amber-500 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow">
                            Older version {version.version_no}
                        </div>
                    )}
                </div>

                {/* Details */}
                <div className="flex flex-col border-t border-zinc-100 dark:border-zinc-800 lg:border-l lg:border-t-0">
                    <div className="space-y-2 border-b border-zinc-100 p-4 dark:border-zinc-800">
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => version && openVersion(version.id, "attachment", cc)}
                                disabled={!version}
                                className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-zinc-900 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
                            >
                                <Download className="h-3.5 w-3.5" /> Download
                            </button>
                            <button
                                onClick={() => version && openVersion(version.id, "inline", cc)}
                                disabled={!version}
                                className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                            >
                                <ExternalLink className="h-3.5 w-3.5" /> New tab
                            </button>
                        </div>
                        {!doc.archived_at && !generated && (perms.replace || perms.archive) && (
                            <div className="grid grid-cols-2 gap-2">
                                {perms.replace && (
                                    <button onClick={() => onReplace(doc)} className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
                                        <Upload className="h-3.5 w-3.5" /> Replace
                                    </button>
                                )}
                                {perms.archive && (
                                    <button onClick={() => onArchive(doc)} className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-rose-950/30">
                                        <Archive className="h-3.5 w-3.5" /> Archive
                                    </button>
                                )}
                            </div>
                        )}
                        {doc.archived_at && (
                            <div className="rounded-xl bg-zinc-50 p-3 text-[11px] text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
                                Archived {formatDate(doc.archived_at)} by {doc.archived_by}. <span className="font-bold">Reason:</span> {doc.archive_reason}
                                {perms.archive && (
                                    <button onClick={() => onRestore(doc)} className="mt-2 flex items-center gap-1 font-bold text-indigo-600 hover:underline">
                                        <RotateCcw className="h-3 w-3" /> Restore
                                    </button>
                                )}
                            </div>
                        )}
                        {generated && (
                            <p className="text-[11px] text-zinc-400">Issued by the school and filed automatically. It can&apos;t be replaced or archived here.</p>
                        )}
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto p-4">
                        <p className="mb-3 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                            <History className="h-3.5 w-3.5" /> {doc.versions.length} version{doc.versions.length === 1 ? "" : "s"}
                        </p>
                        <ol className="relative space-y-3 border-l border-zinc-200 pl-4 dark:border-zinc-700">
                            {doc.versions.map((v) => {
                                const selected = v.id === versionId;
                                const current = v.id === doc.current?.id;
                                return (
                                    <li key={v.id} className="relative">
                                        <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-zinc-900 ${current ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"}`} />
                                        <button
                                            onClick={() => setVersionId(v.id)}
                                            className={`w-full rounded-xl px-3 py-2 text-left transition-colors ${selected ? "bg-indigo-50 ring-1 ring-indigo-200 dark:bg-indigo-950/30 dark:ring-indigo-900" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black text-zinc-800 dark:text-zinc-100">Version {v.version_no}</span>
                                                {current && <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">Current</span>}
                                            </div>
                                            <p className="mt-0.5 text-[11px] text-zinc-500">{formatDate(v.uploaded_at, true)} · {v.uploaded_by}</p>
                                            <p className="text-[11px] text-zinc-400">
                                                {v.mime_type === "application/pdf" ? "PDF" : v.mime_type === "image/png" ? "PNG" : "JPG"}
                                                {v.page_count ? ` · ${v.page_count} page${v.page_count === 1 ? "" : "s"}` : ""} · {formatBytes(v.size_bytes)}
                                            </p>
                                            {v.note && <p className="mt-1 text-[11px] italic text-zinc-600 dark:text-zinc-300">“{v.note}”</p>}
                                        </button>
                                        {selected && !current && perms.replace && !doc.archived_at && !generated && (
                                            <button
                                                onClick={makeCurrent}
                                                disabled={busy}
                                                className="mt-1.5 flex items-center gap-1 pl-3 text-[11px] font-bold text-indigo-600 hover:underline disabled:opacity-50"
                                            >
                                                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} Make this the current version
                                            </button>
                                        )}
                                    </li>
                                );
                            })}
                        </ol>
                        <p className="mt-4 text-[10px] text-zinc-400">Old versions are never deleted. Every view and download is recorded in the student&apos;s log.</p>
                    </div>
                </div>
            </div>
        </VaultModal>
    );
}
