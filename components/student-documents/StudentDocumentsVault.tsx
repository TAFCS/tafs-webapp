"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertCircle,
    Archive,
    CheckCircle2,
    ChevronDown,
    Download,
    Eye,
    FileImage,
    FileText,
    Loader2,
    Lock,
    Plus,
    RefreshCw,
    School,
    Upload,
    User,
    Users,
} from "lucide-react";
import toast from "react-hot-toast";
import {
    errMsg,
    formatBytes,
    formatDate,
    studentDocumentsService,
    type DocumentType,
    type MissingItem,
    type Vault,
    type VaultDocument,
    type VaultGuardian,
} from "@/lib/student-documents.service";
import { directCdnUrl } from "@/lib/media-url";
import { DocumentViewer, openVersion } from "./DocumentViewer";
import { UploadDialog, guardianLabel, type UploadPreset } from "./UploadDialog";
import { VaultModal } from "./VaultModal";

const ARCHIVE_REASONS = ["Uploaded on the wrong student", "Wrong document type", "Unreadable copy", "Duplicate"];

const sortDocs = (a: VaultDocument, b: VaultDocument) =>
    (b.current?.uploaded_at ?? b.created_at).localeCompare(a.current?.uploaded_at ?? a.created_at);

/**
 * TAFSD-498: one student's documents. Used by the Documents tab of the student
 * panel and by the Student Documents page. Everything is read through the
 * vault endpoint (scope-checked); files open through short-lived links.
 */
export function StudentDocumentsVault({
    cc,
    variant = "panel",
    onChanged,
    onLoaded,
}: {
    cc: number;
    variant?: "panel" | "page";
    /** After an upload, replacement, archive or restore. */
    onChanged?: () => void;
    /** Once the student is known (the page records it in "Recently opened"). */
    onLoaded?: (student: Vault["student"]) => void;
}) {
    const [vault, setVault] = useState<Vault | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewing, setViewing] = useState<number | null>(null);
    const [uploadPreset, setUploadPreset] = useState<UploadPreset | null>(null);
    const [archiving, setArchiving] = useState<VaultDocument | null>(null);
    const [showArchived, setShowArchived] = useState(false);
    const [dragging, setDragging] = useState(false);

    const load = useCallback(
        async (quiet = false) => {
            if (!quiet) setLoading(true);
            try {
                const v = await studentDocumentsService.vault(cc);
                setVault(v);
                setError(null);
                if (!quiet) onLoaded?.(v.student);
            } catch (err) {
                setError(errMsg(err, "Couldn't load the documents"));
            } finally {
                setLoading(false);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps -- onLoaded is a notification, not an input
        [cc],
    );

    useEffect(() => {
        setVault(null);
        setViewing(null);
        setShowArchived(false);
        void load();
    }, [load]);

    const changed = useCallback(async () => {
        await load(true);
        onChanged?.();
    }, [load, onChanged]);

    const typesById = useMemo(() => new Map((vault?.types ?? []).map((t) => [t.id, t])), [vault]);
    const guardiansById = useMemo(() => new Map((vault?.guardians ?? []).map((g) => [g.id, g])), [vault]);

    if (loading && !vault) {
        return (
            <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800/60" />
                ))}
            </div>
        );
    }
    if (error || !vault) {
        return (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 p-8 text-center dark:border-rose-900/40 dark:bg-rose-950/20">
                <AlertCircle className="h-6 w-6 text-rose-500" />
                <p className="text-sm font-bold text-rose-700 dark:text-rose-300">{error ?? "Couldn't load the documents"}</p>
                <button onClick={() => load()} className="flex items-center gap-1.5 text-xs font-bold text-rose-700 hover:underline dark:text-rose-300">
                    <RefreshCw className="h-3.5 w-3.5" /> Try again
                </button>
            </div>
        );
    }

    const { student, guardians, documents, missing, completeness, permissions: perms } = vault;
    const canWrite = perms.upload || perms.replace;
    const active = documents.filter((d) => !d.archived_at);
    const archived = documents.filter((d) => d.archived_at);
    const viewingDoc = documents.find((d) => d.id === viewing) ?? null;

    const ownerLabel = (d: VaultDocument) => {
        if (d.guardian_id) {
            const g = guardiansById.get(d.guardian_id);
            return g ? guardianLabel(g) : "Guardian";
        }
        return student.full_name;
    };

    const openUpload = (preset: UploadPreset = {}) => {
        if (!canWrite) return;
        setUploadPreset(preset);
    };

    const activeTypes = vault.types.filter((t) => t.is_active);
    const studentProvided = activeTypes.filter((t) => t.owner === "STUDENT" && t.origin === "PROVIDED");
    const guardianProvided = activeTypes.filter((t) => t.owner === "GUARDIAN" && t.origin === "PROVIDED");
    const generatedTypes = vault.types.filter((t) => t.origin === "GENERATED");

    const studentDocsOf = (t: DocumentType) => active.filter((d) => d.type_id === t.id && d.student_id === student.cc).sort(sortDocs);
    const guardianDocsOf = (t: DocumentType, g: VaultGuardian) => active.filter((d) => d.type_id === t.id && d.guardian_id === g.id).sort(sortDocs);
    const missingSlot = (t: DocumentType, guardianId: number | null) =>
        missing.find((m) => m.type_id === t.id && (m.guardian_id ?? null) === guardianId);

    const studentOptionalEmpty = studentProvided.filter((t) => !studentDocsOf(t).length && !missingSlot(t, null) && !t.locked);
    const generatedDocs = active.filter((d) => typesById.get(d.type_id)?.origin === "GENERATED").sort(sortDocs);
    const pct = completeness.required ? Math.round((completeness.on_file / completeness.required) * 100) : 100;

    return (
        <div
            className="relative space-y-5"
            onDragOver={(e) => {
                if (!canWrite || !e.dataTransfer.types.includes("Files")) return;
                e.preventDefault();
                setDragging(true);
            }}
            onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setDragging(false);
            }}
            onDrop={(e) => {
                if (!canWrite) return;
                e.preventDefault();
                setDragging(false);
                if (e.dataTransfer.files?.length) openUpload({ files: Array.from(e.dataTransfer.files) });
            }}
        >
            {dragging && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-3xl border-2 border-dashed border-indigo-500 bg-indigo-50/90 dark:bg-indigo-950/80">
                    <div className="text-center">
                        <Upload className="mx-auto h-8 w-8 text-indigo-600" />
                        <p className="mt-2 text-sm font-black text-indigo-700 dark:text-indigo-300">Drop to file for {student.full_name}</p>
                    </div>
                </div>
            )}

            {variant === "page" && (
                <div className="flex items-center gap-4">
                    {directCdnUrl(student.photograph_url) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={directCdnUrl(student.photograph_url)!} alt="" className="h-14 w-14 rounded-2xl object-cover ring-1 ring-zinc-200 dark:ring-zinc-700" />
                    ) : (
                        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800"><User className="h-6 w-6" /></span>
                    )}
                    <div className="min-w-0 flex-1">
                        <h2 className="truncate text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">{student.full_name}</h2>
                        <p className="text-xs text-zinc-500">
                            CC {student.cc}
                            {student.gr_number ? ` · GR ${student.gr_number}` : ""}
                            {student.class_name ? ` · ${student.class_name}${student.section_name ? ` ${student.section_name}` : ""}` : ""}
                            {student.campus_name ? ` · ${student.campus_name}` : ""}
                        </p>
                    </div>
                    <span className="hidden rounded-lg bg-zinc-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 sm:inline">
                        {student.status.replace(/_/g, " ")}
                    </span>
                </div>
            )}

            {/* Completeness and the main action */}
            <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                    {completeness.required === 0 ? (
                        <p className="text-sm font-bold text-zinc-600 dark:text-zinc-300">No documents are marked as required yet.</p>
                    ) : missing.length === 0 ? (
                        <p className="flex items-center gap-2 text-sm font-black text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-4 w-4" /> All {completeness.required} required documents on file
                        </p>
                    ) : (
                        <>
                            <div className="flex items-baseline justify-between gap-2">
                                <p className="text-sm font-black text-zinc-800 dark:text-zinc-100">
                                    {completeness.on_file} of {completeness.required} required documents on file
                                </p>
                                <span className="text-xs font-bold text-amber-600">{missing.length} missing</span>
                            </div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                                <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {missing.map((m) => (
                                    <MissingChip key={`${m.type_id}-${m.guardian_id}`} item={m} onClick={perms.upload ? () => openUpload({ typeId: m.type_id, guardianId: m.guardian_id }) : undefined} />
                                ))}
                            </div>
                        </>
                    )}
                </div>
                {canWrite && (
                    <button
                        onClick={() => openUpload()}
                        className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 text-xs font-black text-white shadow-sm hover:bg-indigo-700"
                    >
                        <Upload className="h-4 w-4" /> File a document
                    </button>
                )}
            </div>

            {/* Student */}
            <Section icon={User} title="Student" hint={canWrite ? "Drag files anywhere here to file them" : undefined}>
                {studentProvided.map((t) => {
                    if (t.locked) return null;
                    const docs = studentDocsOf(t);
                    const slot = missingSlot(t, null);
                    if (!docs.length && !slot) return null;
                    return (
                        <TypeBlock key={t.id} type={t} count={docs.length} onAdd={t.allow_multiple && docs.length > 0 && perms.upload ? () => openUpload({ typeId: t.id }) : undefined}>
                            {docs.map((d) => (
                                <DocRow key={d.id} cc={student.cc} doc={d} type={t} onOpen={() => setViewing(d.id)} onReplace={perms.replace ? () => openUpload({ documentId: d.id }) : undefined} />
                            ))}
                            {!docs.length && slot && <EmptySlot label={t.name} onUpload={perms.upload ? () => openUpload({ typeId: t.id }) : undefined} />}
                        </TypeBlock>
                    );
                })}
                {vault.hidden_restricted_count > 0 && (
                    <p className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2.5 text-xs text-zinc-500 dark:bg-zinc-800/50">
                        <Lock className="h-3.5 w-3.5" /> {vault.hidden_restricted_count} restricted document{vault.hidden_restricted_count === 1 ? " is" : "s are"} hidden. Seeing them needs the restricted-documents permission.
                    </p>
                )}
                {studentOptionalEmpty.length > 0 && perms.upload && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="mr-1 text-[11px] font-bold text-zinc-400">Add:</span>
                        {studentOptionalEmpty.map((t) => (
                            <button key={t.id} onClick={() => openUpload({ typeId: t.id })} className="flex items-center gap-1 rounded-lg border border-dashed border-zinc-300 px-2 py-1 text-[11px] font-bold text-zinc-500 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 dark:border-zinc-700 dark:hover:bg-indigo-950/30">
                                <Plus className="h-3 w-3" /> {t.name}
                            </button>
                        ))}
                    </div>
                )}
                {!studentProvided.some((t) => studentDocsOf(t).length || missingSlot(t, null)) && studentOptionalEmpty.length > 0 && !perms.upload && (
                    <p className="text-xs text-zinc-400">Nothing on file for the student yet.</p>
                )}
            </Section>

            {/* Parents */}
            <Section icon={Users} title="Parents" hint="Shared with brothers and sisters">
                {guardians.length === 0 ? (
                    <p className="text-xs text-zinc-400">No guardians are linked to this student.</p>
                ) : (
                    guardians.map((g) => {
                        const blocks = guardianProvided
                            .filter((t) => !t.locked)
                            .map((t) => ({ t, docs: guardianDocsOf(t, g), slot: missingSlot(t, g.id) }));
                        const shown = blocks.filter((b) => b.docs.length || b.slot);
                        const optional = blocks.filter((b) => !b.docs.length && !b.slot);
                        return (
                            <div key={g.id} className="rounded-2xl border border-zinc-100 p-3 dark:border-zinc-800">
                                <p className="mb-2 text-xs font-black text-zinc-700 dark:text-zinc-200">{guardianLabel(g)}</p>
                                <div className="space-y-2">
                                    {shown.map(({ t, docs, slot }) => (
                                        <div key={t.id} className="space-y-2">
                                            {docs.map((d) => (
                                                <DocRow key={d.id} cc={student.cc} doc={d} type={t} onOpen={() => setViewing(d.id)} onReplace={perms.replace ? () => openUpload({ documentId: d.id }) : undefined} />
                                            ))}
                                            {!docs.length && slot && <EmptySlot label={t.name} onUpload={perms.upload ? () => openUpload({ typeId: t.id, guardianId: g.id }) : undefined} />}
                                        </div>
                                    ))}
                                    {!shown.length && !perms.upload && <p className="text-xs text-zinc-400">Nothing on file.</p>}
                                    {optional.length > 0 && perms.upload && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {optional.map(({ t }) => (
                                                <button key={t.id} onClick={() => openUpload({ typeId: t.id, guardianId: g.id })} className="flex items-center gap-1 rounded-lg border border-dashed border-zinc-300 px-2 py-1 text-[11px] font-bold text-zinc-500 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 dark:border-zinc-700 dark:hover:bg-indigo-950/30">
                                                    <Plus className="h-3 w-3" /> {t.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </Section>

            {/* Issued by the school */}
            <Section icon={School} title="Issued by the school">
                {generatedDocs.length === 0 ? (
                    <p className="text-xs text-zinc-400">
                        Admit cards, statements, certificates and orders the school issues are filed here automatically.
                    </p>
                ) : (
                    generatedDocs.map((d) => {
                        const t = typesById.get(d.type_id)!;
                        return <DocRow key={d.id} cc={student.cc} doc={d} type={t} onOpen={() => setViewing(d.id)} />;
                    })
                )}
                {generatedTypes.length === 0 && null}
            </Section>

            {archived.length > 0 && (
                <div>
                    <button onClick={() => setShowArchived((v) => !v)} className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
                        <Archive className="h-3.5 w-3.5" /> {showArchived ? "Hide" : "Show"} {archived.length} archived
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showArchived ? "rotate-180" : ""}`} />
                    </button>
                    {showArchived && (
                        <div className="mt-3 space-y-2 opacity-80">
                            {archived.sort(sortDocs).map((d) => {
                                const t = typesById.get(d.type_id);
                                return t ? <DocRow key={d.id} cc={student.cc} doc={d} type={t} owner={d.guardian_id ? ownerLabel(d) : undefined} onOpen={() => setViewing(d.id)} /> : null;
                            })}
                        </div>
                    )}
                </div>
            )}

            <UploadDialog
                open={!!uploadPreset}
                onClose={() => setUploadPreset(null)}
                cc={student.cc}
                studentName={student.full_name}
                types={vault.types}
                guardians={guardians}
                documents={documents}
                perms={perms}
                preset={uploadPreset}
                onDone={() => void changed()}
            />

            <DocumentViewer
                cc={student.cc}
                doc={viewingDoc}
                type={viewingDoc ? typesById.get(viewingDoc.type_id) ?? null : null}
                ownerLabel={viewingDoc ? ownerLabel(viewingDoc) : ""}
                perms={perms}
                onClose={() => setViewing(null)}
                onReplace={(d) => {
                    setViewing(null);
                    openUpload({ documentId: d.id });
                }}
                onArchive={(d) => setArchiving(d)}
                onRestore={async (d) => {
                    try {
                        await studentDocumentsService.restore(d.id, student.cc);
                        toast.success("Document restored");
                        await changed();
                    } catch (err) {
                        toast.error(errMsg(err, "Couldn't restore it"));
                    }
                }}
                onChanged={() => void changed()}
            />

            <ArchiveDialog
                cc={student.cc}
                doc={archiving}
                typeName={archiving ? typesById.get(archiving.type_id)?.name ?? "document" : ""}
                onClose={() => setArchiving(null)}
                onDone={async () => {
                    setArchiving(null);
                    setViewing(null);
                    await changed();
                }}
            />
        </div>
    );
}

// ─── Pieces ─────────────────────────────────────────────────────────────────

function Section({ icon: Icon, title, hint, children }: { icon: React.ElementType; title: string; hint?: string; children: React.ReactNode }) {
    return (
        <section className="space-y-2.5">
            <div className="flex items-baseline justify-between gap-2">
                <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-zinc-500">
                    <Icon className="h-3.5 w-3.5" /> {title}
                </h3>
                {hint && <span className="hidden text-[10px] text-zinc-400 sm:inline">{hint}</span>}
            </div>
            <div className="space-y-2">{children}</div>
        </section>
    );
}

function TypeBlock({ type, count, onAdd, children }: { type: DocumentType; count: number; onAdd?: () => void; children: React.ReactNode }) {
    if (!type.allow_multiple || count <= 1) {
        return (
            <div className="space-y-2">
                {children}
                {onAdd && (
                    <button onClick={onAdd} className="flex items-center gap-1 pl-1 text-[11px] font-bold text-indigo-600 hover:underline">
                        <Plus className="h-3 w-3" /> Add another {type.name.toLowerCase()}
                    </button>
                )}
            </div>
        );
    }
    return (
        <div className="space-y-2 rounded-2xl bg-zinc-50/70 p-2 dark:bg-zinc-800/30">
            <div className="flex items-center justify-between px-1">
                <span className="text-xs font-black text-zinc-600 dark:text-zinc-300">{type.name} <span className="font-bold text-zinc-400">· {count}</span></span>
                {onAdd && (
                    <button onClick={onAdd} className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:underline">
                        <Plus className="h-3 w-3" /> Add
                    </button>
                )}
            </div>
            {children}
        </div>
    );
}

function DocRow({
    cc,
    doc,
    type,
    owner,
    onOpen,
    onReplace,
}: {
    cc: number;
    doc: VaultDocument;
    type: DocumentType;
    owner?: string;
    onOpen: () => void;
    onReplace?: () => void;
}) {
    const v = doc.current;
    const isImage = v?.mime_type?.startsWith("image/");
    return (
        <div className="group flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-2.5 sm:p-3 transition-colors hover:border-indigo-200 hover:bg-indigo-50/30 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-900 dark:hover:bg-indigo-950/20">
            <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isImage ? "bg-sky-50 text-sky-600 dark:bg-sky-950/40" : "bg-rose-50 text-rose-600 dark:bg-rose-950/40"}`}>
                    {isImage ? <FileImage className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                </span>
                <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            {type.name}
                            {doc.title ? <span className="font-semibold text-zinc-500"> · {doc.title}</span> : null}
                        </span>
                        {type.required_at_admission && <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">Required</span>}
                        {type.restricted && <Lock className="h-3 w-3 text-amber-500" />}
                        {v && v.version_no > 1 && <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[9px] font-black text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">v{v.version_no}</span>}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-zinc-500">
                        {owner ? `${owner} · ` : ""}
                        {doc.academic_year ? `${doc.academic_year} · ` : ""}
                        {v ? `${formatDate(v.uploaded_at)} · ${v.uploaded_by}` : "No file"}
                        {v?.page_count && v.page_count > 1 ? ` · ${v.page_count} pages` : ""}
                        {v ? ` · ${formatBytes(v.size_bytes)}` : ""}
                        {doc.archived_at ? ` · archived: ${doc.archive_reason}` : ""}
                    </span>
                </span>
            </button>
            {/* On a phone the whole row opens the viewer, which has Download and Replace. */}
            <div className="hidden shrink-0 items-center gap-0.5 sm:flex">
                <IconBtn title="View" onClick={onOpen}><Eye className="h-4 w-4" /></IconBtn>
                {v && <IconBtn title="Download" onClick={() => openVersion(v.id, "attachment", cc)}><Download className="h-4 w-4" /></IconBtn>}
                {onReplace && !doc.archived_at && <IconBtn title="Replace with a clearer copy" onClick={onReplace}><Upload className="h-4 w-4" /></IconBtn>}
            </div>
        </div>
    );
}

function EmptySlot({ label, onUpload }: { label: string; onUpload?: () => void }) {
    const body = (
        <>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/50">
                <AlertCircle className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-bold text-zinc-800 dark:text-zinc-100">{label}</span>
                <span className="block truncate text-[11px] font-semibold text-amber-700 dark:text-amber-400">Required · not on file</span>
            </span>
            {onUpload && (
                <span className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-black text-amber-700 ring-1 ring-amber-200 group-hover:bg-amber-50 dark:bg-zinc-900 dark:ring-amber-900/60">
                    <Upload className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Upload</span>
                </span>
            )}
        </>
    );
    const cls = "group flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/40 p-2.5 dark:border-amber-900/50 dark:bg-amber-950/10 sm:p-3";
    return onUpload ? (
        <button type="button" onClick={onUpload} className={`${cls} hover:border-amber-300`} aria-label={`Upload ${label}`}>
            {body}
        </button>
    ) : (
        <div className={cls}>{body}</div>
    );
}

function MissingChip({ item, onClick }: { item: MissingItem; onClick?: () => void }) {
    const cls = "flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300";
    return onClick ? (
        <button onClick={onClick} className={`${cls} hover:bg-amber-100`} title="Upload it now">
            <Plus className="h-3 w-3" /> {item.label}
        </button>
    ) : (
        <span className={cls}>{item.label}</span>
    );
}

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
    return (
        <button title={title} aria-label={title} onClick={onClick} className="rounded-xl p-2 text-zinc-400 hover:bg-white hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
            {children}
        </button>
    );
}

function ArchiveDialog({
    cc,
    doc,
    typeName,
    onClose,
    onDone,
}: {
    cc: number;
    doc: VaultDocument | null;
    typeName: string;
    onClose: () => void;
    onDone: () => void;
}) {
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    useEffect(() => setReason(""), [doc?.id]);
    if (!doc) return null;
    const submit = async () => {
        if (!reason.trim()) return;
        setBusy(true);
        try {
            await studentDocumentsService.archive(doc.id, reason.trim(), cc);
            toast.success(`${typeName} archived`);
            onDone();
        } catch (err) {
            toast.error(errMsg(err, "Couldn't archive it"));
        } finally {
            setBusy(false);
        }
    };
    return (
        <VaultModal
            open
            onClose={onClose}
            busy={busy}
            title={`Archive ${typeName}?`}
            subtitle="It disappears from the list but is never deleted. Anyone allowed to archive can restore it."
            footer={
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} disabled={busy} className="h-10 rounded-xl border border-zinc-200 px-4 text-xs font-bold text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">Cancel</button>
                    <button onClick={submit} disabled={busy || !reason.trim()} className="flex h-10 items-center gap-2 rounded-xl bg-rose-600 px-5 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-40">
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />} Archive
                    </button>
                </div>
            }
        >
            <div className="space-y-3 p-5">
                <div className="flex flex-wrap gap-1.5">
                    {ARCHIVE_REASONS.map((r) => (
                        <button key={r} onClick={() => setReason(r)} className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold ${reason === r ? "border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/30" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"}`}>
                            {r}
                        </button>
                    ))}
                </div>
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={500}
                    rows={3}
                    autoFocus
                    placeholder="Why is it being archived?"
                    className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
            </div>
        </VaultModal>
    );
}
