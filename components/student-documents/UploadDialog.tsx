"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Camera, FileText, Info, Loader2, Lock, Upload, X } from "lucide-react";
import toast from "react-hot-toast";
import {
    errMsg,
    formatBytes,
    studentDocumentsService,
    type DocumentType,
    type VaultDocument,
    type VaultGuardian,
    type VaultPermissions,
} from "@/lib/student-documents.service";
import { VaultModal } from "./VaultModal";

const MAX_FILE = 10 * 1024 * 1024;
const MAX_TOTAL = 25 * 1024 * 1024;
const MAX_FILES = 20;
const ACCEPT = "application/pdf,image/jpeg,image/png";

export interface UploadPreset {
    typeId?: number;
    guardianId?: number | null;
    /** Replace this document (add a version). */
    documentId?: number | null;
    files?: File[];
}

type Picked = { id: string; file: File; preview: string | null };

const isAccepted = (f: File) => {
    const t = f.type.toLowerCase();
    if (t === "application/pdf" || t === "image/jpeg" || t === "image/jpg" || t === "image/png") return true;
    return /\.(pdf|jpe?g|png)$/i.test(f.name);
};

export const guardianLabel = (g: VaultGuardian) => {
    const rel = g.relationship.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    return g.full_name ? `${rel} · ${g.full_name}` : rel;
};

export function UploadDialog({
    open,
    onClose,
    cc,
    studentName,
    types,
    guardians,
    documents,
    perms,
    preset,
    onDone,
}: {
    open: boolean;
    onClose: () => void;
    cc: number;
    studentName: string;
    types: DocumentType[];
    guardians: VaultGuardian[];
    documents: VaultDocument[];
    perms: VaultPermissions;
    preset: UploadPreset | null;
    onDone: () => void;
}) {
    const fileInput = useRef<HTMLInputElement>(null);
    const cameraInput = useRef<HTMLInputElement>(null);
    const [picked, setPicked] = useState<Picked[]>([]);
    const [typeId, setTypeId] = useState<number | null>(null);
    const [guardianId, setGuardianId] = useState<number | null>(null);
    const [documentId, setDocumentId] = useState<number | null>(null);
    const [title, setTitle] = useState("");
    const [year, setYear] = useState("");
    const [note, setNote] = useState("");
    const [dragging, setDragging] = useState(false);
    const [progress, setProgress] = useState<number | null>(null);
    const [isTouch, setIsTouch] = useState(false);

    const uploadable = useMemo(
        () => types.filter((t) => t.is_active && t.origin === "PROVIDED" && !t.locked),
        [types],
    );
    const studentTypes = uploadable.filter((t) => t.owner === "STUDENT");
    const guardianTypes = uploadable.filter((t) => t.owner === "GUARDIAN");

    // Reset whenever the dialog opens.
    useEffect(() => {
        if (!open) return;
        setIsTouch(typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
        const doc = preset?.documentId ? documents.find((d) => d.id === preset.documentId) : undefined;
        setTypeId(doc?.type_id ?? preset?.typeId ?? null);
        setGuardianId(doc?.guardian_id ?? preset?.guardianId ?? null);
        setDocumentId(doc?.id ?? null);
        setTitle(doc?.title ?? "");
        setYear(doc?.academic_year ?? "");
        setNote("");
        setProgress(null);
        setPicked([]);
        if (preset?.files?.length) addFiles(preset.files);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, preset]);

    // Free preview URLs.
    useEffect(() => () => picked.forEach((p) => p.preview && URL.revokeObjectURL(p.preview)), [picked]);

    const type = types.find((t) => t.id === typeId) ?? null;
    const isGuardianType = type?.owner === "GUARDIAN";

    // Default the guardian to the first one when a parent document is chosen.
    useEffect(() => {
        if (isGuardianType && guardianId == null && guardians.length) setGuardianId(guardians[0].id);
        if (!isGuardianType && guardianId != null && !documentId) setGuardianId(null);
    }, [isGuardianType, guardians, guardianId, documentId]);

    // A single-copy type already on file: this upload becomes its next version.
    const existing = useMemo(() => {
        if (documentId) return documents.find((d) => d.id === documentId) ?? null;
        if (!type || type.allow_multiple) return null;
        return (
            documents.find(
                (d) =>
                    d.type_id === type.id &&
                    !d.archived_at &&
                    (isGuardianType ? d.guardian_id === guardianId : d.student_id === cc),
            ) ?? null
        );
    }, [documentId, documents, type, isGuardianType, guardianId, cc]);

    const isReplace = !!existing;
    const allowed = isReplace ? perms.replace : perms.upload;

    function addFiles(list: FileList | File[]) {
        const incoming = Array.from(list);
        const bad = incoming.filter((f) => !isAccepted(f));
        if (bad.length) toast.error(`${bad.map((f) => f.name).join(", ")}: only PDF, JPG or PNG`);
        const big = incoming.filter((f) => isAccepted(f) && f.size > MAX_FILE);
        if (big.length) toast.error(`${big.map((f) => f.name).join(", ")}: larger than 10 MB`);
        const ok = incoming.filter((f) => isAccepted(f) && f.size <= MAX_FILE);
        setPicked((prev) => {
            const next = [
                ...prev,
                ...ok.map((file) => ({
                    id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
                    file,
                    preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
                })),
            ];
            if (next.length > MAX_FILES) {
                toast.error(`At most ${MAX_FILES} files at once`);
                return next.slice(0, MAX_FILES);
            }
            return next;
        });
    }

    const move = (i: number, dir: -1 | 1) =>
        setPicked((prev) => {
            const j = i + dir;
            if (j < 0 || j >= prev.length) return prev;
            const next = [...prev];
            [next[i], next[j]] = [next[j], next[i]];
            return next;
        });

    const total = picked.reduce((n, p) => n + p.file.size, 0);
    const problem = !picked.length
        ? "Add the scan or photo"
        : total > MAX_TOTAL
          ? "The files add up to more than 25 MB"
          : !type
            ? "Choose what kind of document this is"
            : isGuardianType && !guardianId
              ? "Choose whose document this is"
              : !allowed
                ? isReplace
                    ? "You can add documents but not replace one already on file"
                    : "You can replace documents but not add new ones"
                : null;

    const submit = async () => {
        if (problem || !type) return;
        setProgress(0);
        try {
            const res = await studentDocumentsService.upload(
                cc,
                {
                    files: picked.map((p) => p.file),
                    type_id: type.id,
                    guardian_id: isGuardianType ? guardianId : null,
                    document_id: existing?.id ?? null,
                    title: type.allow_multiple ? title : undefined,
                    academic_year: type.allow_multiple ? year : undefined,
                    note,
                },
                setProgress,
            );
            toast.success(res.replaced ? `${type.name}: version ${res.version.version_no} saved` : `${type.name} filed`);
            onDone();
            onClose();
        } catch (err) {
            toast.error(errMsg(err, "Upload failed"));
            setProgress(null);
        }
    };

    const busy = progress !== null;
    const locked = !!preset?.documentId;
    const owner = isGuardianType ? guardians.find((g) => g.id === guardianId) : null;

    return (
        <VaultModal
            open={open}
            onClose={onClose}
            busy={busy}
            size="lg"
            title={isReplace ? `Replace ${type?.name ?? "document"}` : "File a document"}
            subtitle={<>For <span className="font-bold text-zinc-700 dark:text-zinc-300">{studentName}</span>{owner ? <> · {guardianLabel(owner)}</> : null}</>}
            footer={
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[11px] text-zinc-400">{busy ? `Uploading… ${progress}%` : problem ?? "Ready to file."}</p>
                    <div className="flex gap-2">
                        <button onClick={onClose} disabled={busy} className="h-10 flex-1 rounded-xl border border-zinc-200 px-4 text-xs font-bold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 sm:flex-none">
                            Cancel
                        </button>
                        <button
                            onClick={submit}
                            disabled={!!problem || busy}
                            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-xs font-black text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                        >
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            {isReplace ? "Save new version" : "File document"}
                        </button>
                    </div>
                </div>
            }
        >
            <div className="grid gap-5 p-5 md:grid-cols-[1fr_1fr]">
                {/* Files */}
                <div className="space-y-3">
                    <div
                        onDragOver={(e) => {
                            e.preventDefault();
                            setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setDragging(false);
                            if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
                        }}
                        className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
                            dragging
                                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                                : "border-zinc-200 bg-zinc-50/60 dark:border-zinc-700 dark:bg-zinc-800/30"
                        }`}
                    >
                        <Upload className="h-6 w-6 text-zinc-400" />
                        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-200">Drop scans or photos here</p>
                        <p className="text-[11px] text-zinc-400">PDF, JPG or PNG · up to 10 MB each</p>
                        <div className="mt-1 flex flex-wrap justify-center gap-2">
                            <button
                                type="button"
                                onClick={() => fileInput.current?.click()}
                                disabled={busy}
                                className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                            >
                                Choose files
                            </button>
                            {isTouch && (
                                <button
                                    type="button"
                                    onClick={() => cameraInput.current?.click()}
                                    disabled={busy}
                                    className="flex h-9 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                                >
                                    <Camera className="h-3.5 w-3.5" /> Take photo
                                </button>
                            )}
                        </div>
                        <input ref={fileInput} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
                        <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
                    </div>

                    {picked.length > 0 && (
                        <div className="space-y-1.5">
                            {picked.map((p, i) => (
                                <div key={p.id} className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-white p-1.5 pr-2 dark:border-zinc-800 dark:bg-zinc-900">
                                    {p.preview ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={p.preview} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                                    ) : (
                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-500 dark:bg-rose-950/30">
                                            <FileText className="h-4 w-4" />
                                        </span>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-xs font-bold text-zinc-800 dark:text-zinc-200">{p.file.name}</p>
                                        <p className="text-[10px] text-zinc-400">{picked.length > 1 ? `Page ${i + 1} · ` : ""}{formatBytes(p.file.size)}</p>
                                    </div>
                                    {picked.length > 1 && (
                                        <>
                                            <button type="button" title="Move up" disabled={i === 0 || busy} onClick={() => move(i, -1)} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"><ArrowUp className="h-3.5 w-3.5" /></button>
                                            <button type="button" title="Move down" disabled={i === picked.length - 1 || busy} onClick={() => move(i, 1)} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"><ArrowDown className="h-3.5 w-3.5" /></button>
                                        </>
                                    )}
                                    <button type="button" title="Remove" disabled={busy} onClick={() => setPicked((prev) => prev.filter((x) => x.id !== p.id))} className="rounded-lg p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"><X className="h-3.5 w-3.5" /></button>
                                </div>
                            ))}
                            {picked.length > 1 && (
                                <p className="flex items-start gap-1.5 rounded-xl bg-indigo-50 px-3 py-2 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300">
                                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    These {picked.length} files will be saved as one PDF, in this order ({formatBytes(total)}).
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* What it is */}
                <div className="space-y-4">
                    <label className="block space-y-1.5">
                        <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Document</span>
                        <select
                            value={typeId ?? ""}
                            disabled={locked || busy}
                            onChange={(e) => {
                                setTypeId(e.target.value ? Number(e.target.value) : null);
                                setDocumentId(null);
                            }}
                            className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 disabled:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        >
                            <option value="">Choose…</option>
                            <optgroup label="Student">
                                {studentTypes.map((t) => (
                                    <option key={t.id} value={t.id}>{t.name}{t.required_at_admission ? " (required)" : ""}</option>
                                ))}
                            </optgroup>
                            {guardians.length > 0 && guardianTypes.length > 0 && (
                                <optgroup label="Parents">
                                    {guardianTypes.map((t) => (
                                        <option key={t.id} value={t.id}>Parent&apos;s {t.name}{t.required_at_admission ? " (required)" : ""}</option>
                                    ))}
                                </optgroup>
                            )}
                        </select>
                        {type?.description && <span className="block text-[11px] text-zinc-400">{type.description}</span>}
                        {type?.restricted && (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600"><Lock className="h-3 w-3" /> Restricted: only staff allowed to see restricted documents can open it.</span>
                        )}
                    </label>

                    {isGuardianType && (
                        <div className="space-y-1.5">
                            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Whose</span>
                            <div className="flex flex-wrap gap-2">
                                {guardians.map((g) => (
                                    <button
                                        key={g.id}
                                        type="button"
                                        disabled={locked || busy}
                                        onClick={() => setGuardianId(g.id)}
                                        className={`rounded-xl border px-3 py-2 text-left text-xs font-bold transition-colors ${
                                            guardianId === g.id
                                                ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                                                : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                        }`}
                                    >
                                        {guardianLabel(g)}
                                    </button>
                                ))}
                            </div>
                            <span className="block text-[11px] text-zinc-400">Shared with this guardian&apos;s other children automatically.</span>
                        </div>
                    )}

                    {type?.allow_multiple && !isReplace && (
                        <div className="grid grid-cols-[1fr_7rem] gap-2">
                            <label className="space-y-1.5">
                                <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Label <span className="normal-case text-zinc-400">(optional)</span></span>
                                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} disabled={busy} placeholder={type.code === "REPORT_CARD" ? "Term 1" : "What is it?"} className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
                            </label>
                            <label className="space-y-1.5">
                                <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Year</span>
                                <input value={year} onChange={(e) => setYear(e.target.value)} maxLength={20} disabled={busy} placeholder="2026-27" className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
                            </label>
                        </div>
                    )}

                    {isReplace && existing && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
                            A {type?.name} is already on file{existing.title ? ` (${existing.title})` : ""}. This upload becomes{" "}
                            <span className="font-black">version {(existing.current?.version_no ?? 0) + 1}</span>; the current copy stays in its history and can be brought back.
                        </div>
                    )}

                    <label className="block space-y-1.5">
                        <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Note <span className="normal-case text-zinc-400">(optional)</span></span>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            maxLength={500}
                            rows={2}
                            disabled={busy}
                            placeholder={isReplace ? "Why the new copy? e.g. clearer scan brought by the father" : "Anything worth knowing about this copy"}
                            className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        />
                    </label>

                    {busy && (
                        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                            <div className="h-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
                        </div>
                    )}
                </div>
            </div>
        </VaultModal>
    );
}
