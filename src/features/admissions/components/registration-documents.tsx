"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileText, FolderOpen, Loader2, Paperclip, Plus, User, Users, X } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useStudentDocumentsAccess } from "@/hooks/use-student-documents-access";
import { errMsg, formatBytes, studentDocumentsService, type DocumentType } from "@/lib/student-documents.service";

/**
 * TAFSD-537: optional document uploads on the registration form (Form 1).
 *
 * The form only collects the files. Nothing is sent until the registration has
 * been saved and the student's CC and guardian ids are known; then each slot is
 * filed into the student vault (TAFSD-498) through the vault's own upload route,
 * so storage stays private and every upload is audit-logged like any other.
 * A failed upload never touches the registration: it is reported, and the
 * document can be filed from the student's Documents tab.
 */

// The vault's limits (backend vault-rules.ts), checked here so a bad file is
// refused when it is picked rather than after the student is saved.
const MAX_FILE = 10 * 1024 * 1024;
const MAX_TOTAL = 25 * 1024 * 1024;
const MAX_FILES = 20;
const ACCEPT = "application/pdf,image/jpeg,image/png";

const isAccepted = (f: File) => {
    const t = f.type.toLowerCase();
    if (t === "application/pdf" || t === "image/jpeg" || t === "image/jpg" || t === "image/png") return true;
    return /\.(pdf|jpe?g|png)$/i.test(f.name);
};

export type DocRole = "student" | "father" | "mother" | "guardian";

export interface DocSlot {
    role: DocRole;
    typeId: number;
    /** "B-Form / CNIC", "Father's CNIC". */
    label: string;
    files: File[];
}

/** Keyed by `${role}:${typeId}`. Empty slots are removed, so `{}` means "nothing attached". */
export type DocSlots = Record<string, DocSlot>;

const keyOf = (role: DocRole, typeId: number) => `${role}:${typeId}`;

const ROLE_TITLE: Record<Exclude<DocRole, "student">, string> = {
    father: "Father",
    mother: "Mother",
    guardian: "Guardian",
};

/** What the user may file, and which types to offer. */
function useRegistrationDocTypes() {
    const access = useStudentDocumentsAccess();
    const canUpload = access.hasTile && access.can("upload");
    const canRestricted = access.can("view_restricted");
    const [types, setTypes] = useState<DocumentType[] | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!canUpload) return;
        let cancelled = false;
        studentDocumentsService
            .types(false)
            .then((rows) => !cancelled && setTypes(rows))
            .catch(() => !cancelled && setFailed(true));
        return () => {
            cancelled = true;
        };
    }, [canUpload]);

    // Only documents a family hands in; the system files the generated ones
    // itself. A restricted type (medical record) is offered only to someone the
    // vault would let file it.
    const offered = useMemo(
        () =>
            (types ?? [])
                .filter((t) => t.is_active && t.origin === "PROVIDED" && (!t.restricted || canRestricted))
                .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name)),
        [types, canRestricted],
    );

    return {
        canUpload,
        loading: canUpload && types == null && !failed,
        failed,
        studentTypes: offered.filter((t) => t.owner === "STUDENT"),
        guardianTypes: offered.filter((t) => t.owner === "GUARDIAN"),
    };
}

export function RegistrationDocumentsSection({
    slots,
    onChange,
    showGuardian,
    guardianRelationship,
}: {
    slots: DocSlots;
    onChange: (next: DocSlots) => void;
    /** The emergency contact is a third person (not the father or mother), saved as a guardian. */
    showGuardian: boolean;
    guardianRelationship?: string;
}) {
    const { canUpload, loading, failed, studentTypes, guardianTypes } = useRegistrationDocTypes();
    const attached = Object.values(slots).filter((s) => s.files.length).length;

    const setFiles = (role: DocRole, type: DocumentType, label: string, files: File[]) => {
        const next = { ...slots };
        const key = keyOf(role, type.id);
        if (files.length) next[key] = { role, typeId: type.id, label, files };
        else delete next[key];
        onChange(next);
    };

    const people: Array<{ role: Exclude<DocRole, "student">; title: string }> = [
        { role: "father", title: "Father" },
        { role: "mother", title: "Mother" },
        ...(showGuardian
            ? [{ role: "guardian" as const, title: guardianRelationship?.trim() ? `Guardian (${guardianRelationship.trim()})` : "Guardian" }]
            : []),
    ];

    return (
        <section>
            <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-5 flex items-end justify-between gap-4 flex-wrap">
                <div>
                    <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-primary" /> Documents
                        <span className="text-[10px] font-bold normal-case tracking-normal px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">Optional</span>
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
                        Attach what the family handed in. PDF, JPG or PNG, up to 10 MB a file; several photos of one document are combined into one PDF.
                        They are filed into the student&apos;s Documents once the registration is saved.
                    </p>
                </div>
                {attached > 0 && (
                    <span className="text-[11px] font-bold text-primary bg-primary/10 rounded-md px-2 py-1">
                        {attached} attached
                    </span>
                )}
            </div>

            {!canUpload ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3">
                    Attaching documents here needs Student Documents › <span className="font-semibold">File new documents</span>. Register as usual;
                    the papers can be filed later from the student&apos;s Documents tab by someone who has it.
                </p>
            ) : loading ? (
                <div className="flex items-center gap-2 text-xs text-zinc-400 py-4">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading document types…
                </div>
            ) : failed ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-300">
                    Document types could not be loaded, so nothing can be attached here. Register as usual and file the papers from the student&apos;s Documents tab.
                </p>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
                            <User className="h-4 w-4 text-zinc-400" />
                            <span className="text-xs font-black uppercase tracking-wide text-zinc-700 dark:text-zinc-300">Student</span>
                        </div>
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {studentTypes.map((t) => (
                                <SlotRow
                                    key={t.id}
                                    label={t.name}
                                    hint={t.required_at_admission ? "Usually needed at admission" : t.description}
                                    files={slots[keyOf("student", t.id)]?.files ?? []}
                                    onChange={(files) => setFiles("student", t, t.name, files)}
                                />
                            ))}
                            {!studentTypes.length && <p className="px-4 py-3 text-xs text-zinc-400">No student document types are set up.</p>}
                        </div>
                    </div>

                    <div className="space-y-5">
                        {people.map((p) => (
                            <div key={p.role} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
                                    <Users className="h-4 w-4 text-zinc-400" />
                                    <span className="text-xs font-black uppercase tracking-wide text-zinc-700 dark:text-zinc-300">{p.title}</span>
                                    <span className="text-[10px] text-zinc-400">shared with siblings</span>
                                </div>
                                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {guardianTypes.map((t) => {
                                        const label = `${ROLE_TITLE[p.role]}'s ${t.name}`;
                                        return (
                                            <SlotRow
                                                key={t.id}
                                                label={t.name}
                                                hint={t.required_at_admission ? "Usually needed at admission" : t.description}
                                                files={slots[keyOf(p.role, t.id)]?.files ?? []}
                                                onChange={(files) => setFiles(p.role, t, label, files)}
                                            />
                                        );
                                    })}
                                    {!guardianTypes.length && <p className="px-4 py-3 text-xs text-zinc-400">No parent document types are set up.</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}

function SlotRow({
    label,
    hint,
    files,
    onChange,
}: {
    label: string;
    hint?: string | null;
    files: File[];
    onChange: (files: File[]) => void;
}) {
    const input = useRef<HTMLInputElement>(null);
    const total = files.reduce((n, f) => n + f.size, 0);

    const add = (list: FileList) => {
        const incoming = Array.from(list);
        const bad = incoming.filter((f) => !isAccepted(f));
        if (bad.length) toast.error(`${bad.map((f) => f.name).join(", ")}: only PDF, JPG or PNG`);
        const big = incoming.filter((f) => isAccepted(f) && f.size > MAX_FILE);
        if (big.length) toast.error(`${big.map((f) => f.name).join(", ")}: larger than 10 MB`);
        let next = [...files, ...incoming.filter((f) => isAccepted(f) && f.size <= MAX_FILE)];
        if (next.length > MAX_FILES) {
            toast.error(`At most ${MAX_FILES} files for one document`);
            next = next.slice(0, MAX_FILES);
        }
        if (next.reduce((n, f) => n + f.size, 0) > MAX_TOTAL) {
            toast.error(`${label}: the files add up to more than 25 MB`);
            return;
        }
        onChange(next);
    };

    return (
        <div className="px-4 py-2.5">
            <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 break-words">{label}</p>
                    {hint && <p className="text-[10px] text-zinc-400 truncate">{hint}</p>}
                </div>
                <button
                    type="button"
                    onClick={() => input.current?.click()}
                    className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                    {files.length ? <Plus className="h-3.5 w-3.5" /> : <Paperclip className="h-3.5 w-3.5" />}
                    {files.length ? "Add page" : "Attach"}
                </button>
                <input
                    ref={input}
                    type="file"
                    multiple
                    accept={ACCEPT}
                    className="hidden"
                    onChange={(e) => {
                        if (e.target.files) add(e.target.files);
                        e.target.value = "";
                    }}
                />
            </div>
            {files.length > 0 && (
                <div className="mt-2 space-y-1">
                    {files.map((f, i) => (
                        <div key={`${f.name}-${f.size}-${f.lastModified}-${i}`} className="flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 rounded-md px-2 py-1">
                            <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                            <span className="truncate flex-1">{f.name}</span>
                            <span className="shrink-0 text-zinc-400">{formatBytes(f.size)}</span>
                            <button
                                type="button"
                                onClick={() => onChange(files.filter((_, j) => j !== i))}
                                className="shrink-0 p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800"
                                aria-label={`Remove ${f.name}`}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                    {files.length > 1 && (
                        <p className="text-[10px] text-zinc-400">
                            {files.length} files ({formatBytes(total)}), filed as one PDF in this order.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Filing, after the registration is saved ──────────────────────────────

export interface FilingResult {
    label: string;
    ok: boolean;
    /** "already on file", or why it failed. */
    note?: string;
}

export interface FilingState {
    cc: number;
    total: number;
    done: number;
    running: boolean;
    results: FilingResult[];
}

type SavedGuardianLink = {
    relationship?: string | null;
    is_emergency_contact?: boolean | null;
    guardians?: { id?: number } | null;
    guardian_id?: number;
};

/** Which saved guardian each role's documents belong to, from the register response. */
export function guardianIdsFrom(links: SavedGuardianLink[] | undefined): Partial<Record<Exclude<DocRole, "student">, number>> {
    const list = links ?? [];
    const idOf = (l?: SavedGuardianLink) => l?.guardians?.id ?? l?.guardian_id;
    const isParent = (l: SavedGuardianLink) => l.relationship === "Father" || l.relationship === "Mother";
    const others = list.filter((l) => !isParent(l));
    return {
        father: idOf(list.find((l) => l.relationship === "Father")),
        mother: idOf(list.find((l) => l.relationship === "Mother")),
        guardian: idOf(others.find((l) => l.is_emergency_contact) ?? others[0]),
    };
}

/**
 * Files every attached slot into the vault, one at a time. Never throws: each
 * slot ends up as a result, so one bad file can't stop the rest.
 */
export async function fileRegistrationDocuments(
    cc: number,
    slots: DocSlots,
    guardianIds: Partial<Record<Exclude<DocRole, "student">, number>>,
    onProgress: (results: FilingResult[]) => void,
): Promise<FilingResult[]> {
    const results: FilingResult[] = [];
    for (const slot of Object.values(slots)) {
        if (!slot.files.length) continue;
        let result: FilingResult;
        const guardianId = slot.role === "student" ? null : guardianIds[slot.role];
        if (slot.role !== "student" && !guardianId) {
            result = { label: slot.label, ok: false, note: `no ${ROLE_TITLE[slot.role].toLowerCase()} was saved on this registration` };
        } else {
            try {
                await studentDocumentsService.upload(cc, { files: slot.files, type_id: slot.typeId, guardian_id: guardianId });
                result = { label: slot.label, ok: true };
            } catch (err) {
                const status = (err as { response?: { status?: number } })?.response?.status;
                const msg = errMsg(err, "upload failed");
                // A parent already known from a sibling's registration can already
                // have this document. The identical file is simply on file; a
                // different one would replace it, which needs its own grant.
                result =
                    status === 409 && /already/i.test(msg)
                        ? { label: slot.label, ok: true, note: "already on file" }
                        : status === 403 && /not replace/i.test(msg)
                          ? { label: slot.label, ok: false, note: "one is already on file (a sibling's registration); replacing it needs Student Documents › Replace" }
                          : { label: slot.label, ok: false, note: msg };
            }
        }
        results.push(result);
        onProgress([...results]);
    }
    return results;
}

/** Shown in the success banner while documents are filed, and after. */
export function DocumentFilingReport({ state }: { state: FilingState }) {
    const failed = state.results.filter((r) => !r.ok);
    const filed = state.results.length - failed.length;
    const vaultHref = `/identity/documents?tab=students&cc=${state.cc}`;

    if (state.running) {
        return (
            <p className="mt-2 flex items-center gap-2 text-xs text-emerald-800">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Filing documents into the student&apos;s Documents… {state.done} of {state.total}
            </p>
        );
    }

    return (
        <div className="mt-2 text-xs">
            {filed > 0 && (
                <p className="flex items-center gap-1.5 text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {filed} document{filed === 1 ? "" : "s"} filed into the student&apos;s Documents.
                </p>
            )}
            {failed.length > 0 && (
                <div className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                    <p className="flex items-center gap-1.5 font-semibold">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {failed.length} document{failed.length === 1 ? "" : "s"} could not be filed. The registration is saved; file {failed.length === 1 ? "it" : "them"} from the student&apos;s Documents.
                    </p>
                    <ul className="mt-1 ml-5 list-disc space-y-0.5">
                        {failed.map((r) => (
                            <li key={r.label}>
                                <span className="font-semibold">{r.label}</span>: {r.note}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <Link href={vaultHref} target="_blank" className="mt-1.5 inline-flex items-center gap-1 font-bold text-primary hover:underline">
                <FolderOpen className="h-3.5 w-3.5" /> Open the student&apos;s Documents
            </Link>
        </div>
    );
}
