"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, Edit2, Loader2, Lock, Plus, RotateCcw, School, User, Users, X, Archive } from "lucide-react";
import toast from "react-hot-toast";
import { errMsg, studentDocumentsService, type DocumentType, type DocumentTypeInput, type DocOwner } from "@/lib/student-documents.service";

type Draft = { name: string; description: string; owner: DocOwner; allow_multiple: boolean; required_at_admission: boolean; restricted: boolean };
const EMPTY: Draft = { name: "", description: "", owner: "STUDENT", allow_multiple: false, required_at_admission: false, restricted: false };

/**
 * The list of document types. Owner and code are fixed once created; types the
 * system issues can be renamed and reordered but not required or made multiple.
 * A type with documents can be retired, never deleted.
 */
export function TypesTab() {
    const [types, setTypes] = useState<DocumentType[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<number | "new" | null>(null);
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState<Draft>(EMPTY);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState("");

    const load = async () => {
        try {
            setTypes(await studentDocumentsService.types(true));
        } catch (err) {
            toast.error(errMsg(err, "Couldn't load document types"));
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        void load();
    }, []);

    const patch = async (t: DocumentType, data: DocumentTypeInput, done?: string) => {
        setBusyId(t.id);
        try {
            await studentDocumentsService.updateType(t.id, data);
            if (done) toast.success(done);
            await load();
        } catch (err) {
            toast.error(errMsg(err, "Couldn't save"));
        } finally {
            setBusyId(null);
        }
    };

    const create = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!draft.name.trim()) return toast.error("Give the document type a name");
        setBusyId("new");
        try {
            await studentDocumentsService.createType({ ...draft, name: draft.name.trim(), description: draft.description.trim() || null });
            toast.success(`${draft.name.trim()} added`);
            setDraft(EMPTY);
            setAdding(false);
            await load();
        } catch (err) {
            toast.error(errMsg(err, "Couldn't add it"));
        } finally {
            setBusyId(null);
        }
    };

    const move = (list: DocumentType[], i: number, dir: -1 | 1) => {
        const a = list[i];
        const b = list[i + dir];
        if (!a || !b) return;
        const [x, y] = a.display_order === b.display_order ? [a.display_order + dir * 5, a.display_order] : [b.display_order, a.display_order];
        setBusyId(a.id);
        Promise.all([studentDocumentsService.updateType(a.id, { display_order: Math.max(0, x) }), studentDocumentsService.updateType(b.id, { display_order: Math.max(0, y) })])
            .then(load)
            .catch((err) => toast.error(errMsg(err, "Couldn't reorder")))
            .finally(() => setBusyId(null));
    };

    if (loading) return <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800/60" />)}</div>;

    const groups: { title: string; hint: string; icon: React.ElementType; list: DocumentType[] }[] = [
        { title: "Student", hint: "Documents the family hands in about the child", icon: User, list: types.filter((t) => t.owner === "STUDENT" && t.origin === "PROVIDED") },
        { title: "Parents", hint: "Held once per guardian and shared by siblings", icon: Users, list: types.filter((t) => t.owner === "GUARDIAN") },
        { title: "Issued by the school", hint: "Filed automatically when the system produces them", icon: School, list: types.filter((t) => t.origin === "GENERATED") },
    ];

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <p className="text-sm text-zinc-500">
                    Mark what the school needs at admission and the missing-documents report follows. Restricted types are only seen by staff given that permission.
                </p>
                {!adding && (
                    <button onClick={() => setAdding(true)} className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 text-xs font-black text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900">
                        <Plus className="h-4 w-4" /> Add a type
                    </button>
                )}
            </div>

            {adding && (
                <form onSubmit={create} className="space-y-3 rounded-3xl border border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-900 dark:bg-indigo-950/20">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={100} placeholder="Name, e.g. Vaccination card" className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
                        <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={300} placeholder="Description (optional)" className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Segment value={draft.owner} onChange={(owner) => setDraft({ ...draft, owner })} options={[{ id: "STUDENT", label: "Student's" }, { id: "GUARDIAN", label: "Parent's" }]} />
                        <Toggle on={draft.allow_multiple} onClick={() => setDraft({ ...draft, allow_multiple: !draft.allow_multiple })} label="Many per student" />
                        <Toggle on={draft.required_at_admission} onClick={() => setDraft({ ...draft, required_at_admission: !draft.required_at_admission })} label="Required at admission" />
                        <Toggle on={draft.restricted} onClick={() => setDraft({ ...draft, restricted: !draft.restricted })} label="Restricted" />
                    </div>
                    <p className="text-[11px] text-zinc-500">Whose document it is can&apos;t be changed later.</p>
                    <div className="flex gap-2">
                        <button type="submit" disabled={busyId === "new"} className="flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-xs font-black text-white disabled:opacity-50">
                            {busyId === "new" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Add
                        </button>
                        <button type="button" onClick={() => { setAdding(false); setDraft(EMPTY); }} className="h-9 rounded-xl px-3 text-xs font-bold text-zinc-500">Cancel</button>
                    </div>
                </form>
            )}

            {groups.map((g) => {
                const active = g.list.filter((t) => t.is_active);
                const retired = g.list.filter((t) => !t.is_active);
                return (
                    <section key={g.title} className="space-y-2">
                        <h3 className="flex items-baseline gap-2 text-[11px] font-black uppercase tracking-widest text-zinc-500">
                            <g.icon className="h-3.5 w-3.5 self-center" /> {g.title}
                            <span className="font-medium normal-case tracking-normal text-zinc-400">{g.hint}</span>
                        </h3>
                        <div className="divide-y divide-zinc-100 overflow-hidden rounded-3xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
                            {[...active, ...retired].map((t) => {
                                const i = active.indexOf(t);
                                const generated = t.origin === "GENERATED";
                                const busy = busyId === t.id;
                                return (
                                    <div key={t.id} className={`flex flex-col gap-3 p-4 lg:flex-row lg:items-center ${t.is_active ? "" : "opacity-60"}`}>
                                        <div className="min-w-0 flex-1">
                                            {editingId === t.id ? (
                                                <form
                                                    className="flex gap-2"
                                                    onSubmit={(e) => {
                                                        e.preventDefault();
                                                        if (editName.trim() && editName.trim() !== t.name) void patch(t, { name: editName.trim() }, "Renamed");
                                                        setEditingId(null);
                                                    }}
                                                >
                                                    <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={100} className="h-9 flex-1 rounded-xl border border-zinc-200 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
                                                    <button type="submit" className="rounded-xl bg-zinc-900 px-3 text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">Save</button>
                                                    <button type="button" onClick={() => setEditingId(null)} className="rounded-xl p-2 text-zinc-400"><X className="h-4 w-4" /></button>
                                                </form>
                                            ) : (
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{t.name}</span>
                                                    {t.restricted && <Lock className="h-3.5 w-3.5 text-amber-500" />}
                                                    {!t.is_active && <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-zinc-500 dark:bg-zinc-800">Retired</span>}
                                                    <span className="text-[11px] text-zinc-400">{(t.document_count ?? 0).toLocaleString()} on file</span>
                                                </div>
                                            )}
                                            {t.description && editingId !== t.id && <p className="mt-0.5 text-xs text-zinc-500">{t.description}</p>}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {!generated && (
                                                <>
                                                    <Toggle small disabled={busy || !t.is_active} on={t.required_at_admission} onClick={() => patch(t, { required_at_admission: !t.required_at_admission })} label="Required" />
                                                    <Toggle small disabled={busy || !t.is_active} on={t.allow_multiple} onClick={() => patch(t, { allow_multiple: !t.allow_multiple })} label="Many" />
                                                </>
                                            )}
                                            <Toggle small disabled={busy || !t.is_active} on={t.restricted} onClick={() => patch(t, { restricted: !t.restricted })} label="Restricted" />
                                            <span className="mx-1 hidden h-5 w-px bg-zinc-200 dark:bg-zinc-700 lg:block" />
                                            {busy ? (
                                                <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                                            ) : t.is_active ? (
                                                <>
                                                    <Icon title="Move up" disabled={i <= 0} onClick={() => move(active, i, -1)}><ArrowUp className="h-3.5 w-3.5" /></Icon>
                                                    <Icon title="Move down" disabled={i >= active.length - 1} onClick={() => move(active, i, 1)}><ArrowDown className="h-3.5 w-3.5" /></Icon>
                                                    <Icon title="Rename" onClick={() => { setEditingId(t.id); setEditName(t.name); }}><Edit2 className="h-3.5 w-3.5" /></Icon>
                                                    {!generated && (
                                                        <Icon title="Retire (no new uploads; documents on file stay)" onClick={() => confirm(`Retire ${t.name}? No more can be filed. The ${t.document_count ?? 0} on file stay.`) && patch(t, { is_active: false }, `${t.name} retired`)}>
                                                            <Archive className="h-3.5 w-3.5" />
                                                        </Icon>
                                                    )}
                                                </>
                                            ) : (
                                                <Icon title="Bring back" onClick={() => patch(t, { is_active: true }, `${t.name} restored`)}><RotateCcw className="h-3.5 w-3.5" /></Icon>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {g.list.length === 0 && <p className="p-4 text-xs text-zinc-400">None yet.</p>}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}

function Toggle({ on, onClick, label, small, disabled }: { on: boolean; onClick: () => void; label: string; small?: boolean; disabled?: boolean }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-pressed={on}
            className={`flex items-center gap-1.5 rounded-lg border font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${small ? "px-2 py-1 text-[11px]" : "px-3 py-2 text-xs"} ${
                on ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            }`}
        >
            <span className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${on ? "border-indigo-600 bg-indigo-600 text-white" : "border-zinc-300 dark:border-zinc-600"}`}>
                {on && <Check className="h-2.5 w-2.5" />}
            </span>
            {label}
        </button>
    );
}

function Segment<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[] }) {
    return (
        <div className="flex rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
            {options.map((o) => (
                <button key={o.id} type="button" onClick={() => onChange(o.id)} className={`rounded-md px-3 py-1.5 text-xs font-bold ${value === o.id ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-500"}`}>
                    {o.label}
                </button>
            ))}
        </div>
    );
}

function Icon({ title, onClick, disabled, children }: { title: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
    return (
        <button title={title} aria-label={title} onClick={onClick} disabled={disabled} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
            {children}
        </button>
    );
}
