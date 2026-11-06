"use client";

/**
 * Bulk student photo upload (TAFSD-483).
 *
 * Staff drop in a batch of photos named by CC ("1234.jpg" / "1234.png"). The
 * page checks every name against the server first and shows who each photo
 * belongs to, then uploads the ready ones in small chunks. Each upload becomes
 * the student's current photo; the old one stays in the photo progression
 * shown in the Student Directory. Nothing is overwritten or deleted, and
 * re-sending the same image is recognised and skipped.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    Download,
    FolderOpen,
    ImagePlus,
    Loader2,
    Trash2,
    Upload,
    User,
} from "lucide-react";
import { useStudentAccess } from "@/hooks/use-student-access";
import {
    BULK_PHOTO_CHUNK,
    studentPhotosService,
    type BulkPhotoRow,
    type BulkPhotoStatus,
} from "@/lib/students.service";

const MAX_BYTES = 10 * 1024 * 1024;
const NAME_RULE = /^\d{1,9}\.(jpe?g|png)$/i;

interface Item {
    key: string;
    file: File;
    preview: string;
    row: BulkPhotoRow;
}

const STATUS_META: Record<BulkPhotoStatus | "too_large", { label: string; tone: string }> = {
    ready: { label: "Ready", tone: "bg-sky-50 text-sky-700 border-sky-200" },
    uploaded: { label: "Uploaded", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    already_uploaded: { label: "Already uploaded", tone: "bg-zinc-100 text-zinc-600 border-zinc-200" },
    invalid_name: { label: "Bad file name", tone: "bg-amber-50 text-amber-700 border-amber-200" },
    not_found: { label: "No such CC", tone: "bg-red-50 text-red-700 border-red-200" },
    duplicate_cc: { label: "CC used twice", tone: "bg-amber-50 text-amber-700 border-amber-200" },
    error: { label: "Failed", tone: "bg-red-50 text-red-700 border-red-200" },
    too_large: { label: "Over 10 MB", tone: "bg-amber-50 text-amber-700 border-amber-200" },
};

const FILTER_ORDER: BulkPhotoStatus[] = [
    "ready",
    "uploaded",
    "already_uploaded",
    "duplicate_cc",
    "not_found",
    "invalid_name",
    "error",
];

/** The server's message from an axios error, if it sent one. */
function apiMessage(err: unknown, fallback: string): string {
    const msg = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
    return typeof msg === "string" ? msg : Array.isArray(msg) ? msg.join(", ") : fallback;
}

const cleanUrl = (u: string) => u.replace(/([^:])\/\//g, "$1/");

function isImage(f: File) {
    return /\.(jpe?g|png)$/i.test(f.name) || f.type === "image/jpeg" || f.type === "image/png";
}

function csvOf(items: Item[]) {
    const esc = (v: unknown) => {
        const s = v == null ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = ["file", "cc", "status", "student", "gr", "class", "section", "message", "url"];
    const lines = items.map(({ row }) =>
        [
            row.file,
            row.cc,
            row.status,
            row.student?.full_name,
            row.student?.gr_number,
            row.student?.class_name,
            row.student?.section_name,
            row.message,
            row.url,
        ]
            .map(esc)
            .join(","),
    );
    return [head.join(","), ...lines].join("\n");
}

export default function BulkStudentPhotosPage() {
    const access = useStudentAccess();
    const canUpload = access.can("identity.edit");

    const [items, setItems] = useState<Item[]>([]);
    const [checking, setChecking] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [statusFilter, setStatusFilter] = useState<BulkPhotoStatus[]>([]);
    const [dragging, setDragging] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const folderInput = useRef<HTMLInputElement>(null);

    // Free the thumbnail object URLs when the page unmounts.
    const itemsRef = useRef<Item[]>([]);
    itemsRef.current = items;
    useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview)), []);

    useEffect(() => {
        if (folderInput.current) folderInput.current.setAttribute("webkitdirectory", "");
    }, []);

    /** Check a fresh set of files against the server and merge them into the list. */
    const addFiles = useCallback(
        async (incoming: File[]) => {
            const images = incoming.filter(isImage);
            const skipped = incoming.length - images.length;
            if (!images.length) {
                toast.error("No JPG or PNG files in that selection.");
                return;
            }

            // A file already in the list (same name and size) is not added twice.
            const seen = new Set(itemsRef.current.map((i) => `${i.file.name}|${i.file.size}`));
            const fresh = images.filter((f) => !seen.has(`${f.name}|${f.size}`));
            if (!fresh.length) {
                toast("Those files are already in the list.");
                return;
            }

            setChecking(true);
            try {
                // Re-check the whole batch: a CC repeated across two drops is only visible together.
                const all = [...itemsRef.current.map((i) => i.file), ...fresh];
                const rows = await studentPhotosService.previewBulk(all.map((f) => f.name));
                const prior = new Map(itemsRef.current.map((i) => [i.file, i]));
                const next: Item[] = all.map((file, idx) => {
                    const old = prior.get(file);
                    let row = rows[idx];
                    // Keep finished outcomes from an earlier upload in this session.
                    if (old && ["uploaded", "already_uploaded", "error"].includes(old.row.status)) row = old.row;
                    if (row.status === "ready" && file.size > MAX_BYTES) {
                        row = { ...row, status: "error", message: "Larger than 10 MB" };
                    }
                    return {
                        key: old?.key ?? `${file.name}|${file.size}|${file.lastModified}`,
                        file,
                        preview: old?.preview ?? URL.createObjectURL(file),
                        row,
                    };
                });
                setItems(next);
                if (skipped) toast(`${skipped} non-image file${skipped === 1 ? "" : "s"} ignored.`);
            } catch (err) {
                toast.error(apiMessage(err, "Could not check the files. Try again."));
            } finally {
                setChecking(false);
            }
        },
        [],
    );

    const removeItem = (key: string) => {
        setItems((prev) => {
            const gone = prev.find((i) => i.key === key);
            if (gone) URL.revokeObjectURL(gone.preview);
            return prev.filter((i) => i.key !== key);
        });
    };

    const clearAll = () => {
        items.forEach((i) => URL.revokeObjectURL(i.preview));
        setItems([]);
        setStatusFilter([]);
    };

    const counts = useMemo(() => {
        const c: Partial<Record<BulkPhotoStatus, number>> = {};
        for (const i of items) c[i.row.status] = (c[i.row.status] ?? 0) + 1;
        return c;
    }, [items]);

    const ready = items.filter((i) => i.row.status === "ready");

    const upload = async () => {
        if (!ready.length) return;
        setUploading(true);
        setProgress({ done: 0, total: ready.length });
        let failedChunks = 0;
        for (let i = 0; i < ready.length; i += BULK_PHOTO_CHUNK) {
            const chunk = ready.slice(i, i + BULK_PHOTO_CHUNK);
            let results: BulkPhotoRow[];
            try {
                results = await studentPhotosService.uploadBulkChunk(chunk.map((c) => c.file));
            } catch (err) {
                failedChunks++;
                const message = apiMessage(err, "Upload request failed");
                results = chunk.map((c) => ({ ...c.row, status: "error" as const, message }));
            }
            const byKey = new Map(chunk.map((c, idx) => [c.key, results[idx]]));
            setItems((prev) => prev.map((it) => (byKey.has(it.key) ? { ...it, row: byKey.get(it.key)! } : it)));
            setProgress({ done: Math.min(i + chunk.length, ready.length), total: ready.length });
        }
        setUploading(false);
        if (failedChunks) toast.error("Some photos failed. Filter by “Failed” and upload again.");
        else toast.success("Upload finished.");
    };

    const retryFailed = () => {
        setItems((prev) =>
            prev.map((it) =>
                it.row.status === "error" && it.row.student && it.file.size <= MAX_BYTES
                    ? { ...it, row: { ...it.row, status: "ready", message: undefined } }
                    : it,
            ),
        );
    };

    const downloadReport = () => {
        const blob = new Blob([csvOf(items)], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `student-photos-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    const visible = statusFilter.length ? items.filter((i) => statusFilter.includes(i.row.status)) : items;

    if (!canUpload) {
        return (
            <div className="p-8 max-w-xl">
                <Link href="/identity/students" className="inline-flex items-center gap-1.5 text-[12px] font-bold text-zinc-500 hover:text-zinc-800">
                    <ArrowLeft className="h-3.5 w-3.5" /> Student Directory
                </Link>
                <p className="mt-6 text-[14px] text-zinc-600">
                    You need permission to edit student photos to use bulk upload.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <Link href="/identity/students" className="inline-flex items-center gap-1.5 text-[12px] font-bold text-zinc-500 hover:text-zinc-800">
                        <ArrowLeft className="h-3.5 w-3.5" /> Student Directory
                    </Link>
                    <h1 className="text-[22px] font-black tracking-tight text-zinc-900 mt-1">Bulk photo upload</h1>
                    <p className="text-[13px] text-zinc-500 mt-0.5 max-w-2xl">
                        Name each photo by the student&apos;s CC, for example <code className="font-mono text-zinc-700">1234.jpg</code> or{" "}
                        <code className="font-mono text-zinc-700">1234.png</code>. Each one becomes the student&apos;s current photo, and their
                        previous photos stay in their photo progression.
                    </p>
                </div>
                {items.length > 0 && (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={downloadReport}
                            className="flex items-center gap-1.5 px-4 h-9 text-[11px] font-bold text-zinc-700 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50"
                        >
                            <Download className="h-3.5 w-3.5" /> REPORT
                        </button>
                        <button
                            type="button"
                            onClick={clearAll}
                            disabled={uploading}
                            className="flex items-center gap-1.5 px-4 h-9 text-[11px] font-bold text-zinc-700 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 disabled:opacity-50"
                        >
                            <Trash2 className="h-3.5 w-3.5" /> CLEAR
                        </button>
                    </div>
                )}
            </div>

            {/* Drop zone */}
            <div
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    if (!uploading) addFiles(Array.from(e.dataTransfer.files));
                }}
                className={`rounded-2xl border-2 border-dashed p-8 flex flex-col items-center justify-center text-center transition-colors ${
                    dragging ? "border-primary bg-primary/5" : "border-zinc-200 bg-white"
                }`}
            >
                {checking ? (
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                ) : (
                    <ImagePlus className="h-8 w-8 text-zinc-300" />
                )}
                <p className="mt-3 text-[14px] font-bold text-zinc-800">
                    {checking ? "Checking file names…" : "Drop photos here"}
                </p>
                <p className="text-[12px] text-zinc-500">JPG or PNG, up to 10 MB each</p>
                <div className="mt-4 flex gap-2">
                    <button
                        type="button"
                        disabled={uploading || checking}
                        onClick={() => fileInput.current?.click()}
                        className="flex items-center gap-1.5 px-4 h-9 text-[11px] font-bold text-white bg-primary rounded-xl hover:opacity-90 disabled:opacity-50"
                    >
                        <ImagePlus className="h-3.5 w-3.5" /> CHOOSE PHOTOS
                    </button>
                    <button
                        type="button"
                        disabled={uploading || checking}
                        onClick={() => folderInput.current?.click()}
                        className="flex items-center gap-1.5 px-4 h-9 text-[11px] font-bold text-zinc-700 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 disabled:opacity-50"
                    >
                        <FolderOpen className="h-3.5 w-3.5" /> CHOOSE FOLDER
                    </button>
                </div>
                <input
                    ref={fileInput}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={(e) => {
                        addFiles(Array.from(e.target.files ?? []));
                        e.target.value = "";
                    }}
                />
                <input
                    ref={folderInput}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                        addFiles(Array.from(e.target.files ?? []));
                        e.target.value = "";
                    }}
                />
            </div>

            {items.length > 0 && (
                <>
                    {/* Summary + action */}
                    <div className="flex items-center justify-between gap-4 flex-wrap rounded-2xl border border-zinc-200 bg-white px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                            {FILTER_ORDER.filter((s) => counts[s]).map((s) => {
                                const on = statusFilter.includes(s);
                                return (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() =>
                                            setStatusFilter((prev) => (on ? prev.filter((x) => x !== s) : [...prev, s]))
                                        }
                                        className={`px-3 h-8 rounded-full border text-[11px] font-bold transition-all ${STATUS_META[s].tone} ${
                                            on ? "ring-2 ring-offset-1 ring-primary/40" : statusFilter.length ? "opacity-50" : ""
                                        }`}
                                    >
                                        {STATUS_META[s].label} · {counts[s]}
                                    </button>
                                );
                            })}
                            {statusFilter.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setStatusFilter([])}
                                    className="px-2 h-8 text-[11px] font-bold text-zinc-500 hover:text-zinc-800"
                                >
                                    Clear filter
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            {uploading && (
                                <div className="flex items-center gap-2 text-[12px] text-zinc-600">
                                    <div className="h-2 w-40 rounded-full bg-zinc-100 overflow-hidden">
                                        <div
                                            className="h-full bg-primary transition-all"
                                            style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                                        />
                                    </div>
                                    {progress.done}/{progress.total}
                                </div>
                            )}
                            {!uploading && (counts.error ?? 0) > 0 && (
                                <button
                                    type="button"
                                    onClick={retryFailed}
                                    className="px-4 h-9 text-[11px] font-bold text-zinc-700 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50"
                                >
                                    RETRY FAILED
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={upload}
                                disabled={uploading || checking || ready.length === 0}
                                className="flex items-center gap-1.5 px-5 h-9 text-[11px] font-bold text-white bg-primary rounded-xl hover:opacity-90 disabled:opacity-40"
                            >
                                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                {uploading ? "UPLOADING…" : `UPLOAD ${ready.length} PHOTO${ready.length === 1 ? "" : "S"}`}
                            </button>
                        </div>
                    </div>

                    {/* Rows */}
                    <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-[13px]">
                                <thead className="bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-500">
                                    <tr>
                                        <th className="text-left font-bold px-4 py-2.5">Photo</th>
                                        <th className="text-left font-bold px-4 py-2.5">File</th>
                                        <th className="text-left font-bold px-4 py-2.5">Student</th>
                                        <th className="text-left font-bold px-4 py-2.5">Class</th>
                                        <th className="text-left font-bold px-4 py-2.5">Current → New</th>
                                        <th className="text-left font-bold px-4 py-2.5">Status</th>
                                        <th className="px-4 py-2.5" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                    {visible.map((it) => {
                                        const r = it.row;
                                        const meta = STATUS_META[r.status];
                                        const before =
                                            r.status === "uploaded" ? null : r.student?.current_photo_url ?? null;
                                        return (
                                            <tr key={it.key} className="align-middle">
                                                <td className="px-4 py-2">
                                                    <img src={it.preview} alt="" loading="lazy" className="h-12 w-10 rounded-md object-cover border border-zinc-200" />
                                                </td>
                                                <td className="px-4 py-2 font-mono text-[12px] text-zinc-700">
                                                    {it.file.name}
                                                    {!NAME_RULE.test(it.file.name) && (
                                                        <div className="text-[10px] text-amber-600 font-sans">Rename to the CC, e.g. 1234.jpg</div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2">
                                                    {r.student ? (
                                                        <>
                                                            <div className="font-bold text-zinc-900 uppercase text-[12px]">{r.student.full_name}</div>
                                                            <div className="text-[11px] font-mono text-zinc-500">
                                                                CC {r.cc}
                                                                {r.student.gr_number ? ` · GR ${r.student.gr_number}` : ""}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <span className="text-zinc-400">{r.cc ? `CC ${r.cc}` : "—"}</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 text-[12px] text-zinc-600">
                                                    {r.student?.class_name ?? "—"}
                                                    {r.student?.section_name ? ` · ${r.student.section_name}` : ""}
                                                </td>
                                                <td className="px-4 py-2">
                                                    {r.student && (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="h-10 w-8 rounded-md overflow-hidden bg-zinc-100 border border-zinc-200 flex items-center justify-center">
                                                                {before ? (
                                                                    <img src={cleanUrl(before)} alt="" loading="lazy" className="h-full w-full object-cover" />
                                                                ) : r.status === "uploaded" ? (
                                                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                                ) : (
                                                                    <User className="h-4 w-4 text-zinc-300" />
                                                                )}
                                                            </span>
                                                            <ArrowRight className="h-3 w-3 text-zinc-300" />
                                                            <img src={it.preview} alt="" loading="lazy" className="h-10 w-8 rounded-md object-cover border border-primary/40" />
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${meta.tone}`}>
                                                        {r.status === "error" && <AlertCircle className="h-3 w-3" />}
                                                        {meta.label}
                                                    </span>
                                                    {r.message && r.status !== "ready" && (
                                                        <div className="text-[10px] text-zinc-500 mt-0.5 max-w-[220px]">{r.message}</div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                    {!uploading && r.status !== "uploaded" && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeItem(it.key)}
                                                            className="p-1.5 text-zinc-400 hover:text-red-600"
                                                            aria-label={`Remove ${it.file.name}`}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
