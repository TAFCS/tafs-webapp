"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Archive, ArrowDown, ArrowUp, Award, Edit2, Loader2, Plus, RotateCcw, ShieldAlert, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import {
    CATEGORY_TONES,
    fetchStudentCategories,
    refreshStudentCategories,
    type CategoryTone,
    type StudentCategory,
} from "@/lib/student-benefits";
import { studentCategoriesService } from "@/lib/student-categories.service";
import { benefitChipClass, categoryDotClass } from "@/components/students/FeeBenefitsEditor";
import { useSpecialCategoriesAccess } from "@/hooks/use-special-categories-access";

type Form = { label: string; description: string; tone: CategoryTone };
const EMPTY: Form = { label: "", description: "", tone: "teal" };

const errMsg = (err: unknown, fallback: string) => {
    const m = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
    return Array.isArray(m) ? m.join(", ") : typeof m === "string" ? m : fallback;
};

/**
 * TAFSD-475: School Setup → Special Categories. Add, rename, recolour, reorder,
 * retire or restore the categories students can hold (Fee Endowment,
 * Complementary, …). Giving one to a student stays on the student's profile
 * and in Studentwise Fees.
 */
export default function SpecialCategoriesPage() {
    const access = useSpecialCategoriesAccess();
    const [rows, setRows] = useState<StudentCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<StudentCategory | "new" | null>(null);
    const [form, setForm] = useState<Form>(EMPTY);
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState<number | null>(null);

    const load = async (force = false) => {
        try {
            setRows(force ? await refreshStudentCategories() : await fetchStudentCategories());
        } catch (err) {
            toast.error(errMsg(err, "Couldn't load the categories"));
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        void load(true);
    }, []);

    const active = rows.filter((r) => r.is_active);
    const retired = rows.filter((r) => !r.is_active);

    const openNew = () => {
        setForm(EMPTY);
        setEditing("new");
    };
    const openEdit = (c: StudentCategory) => {
        setForm({ label: c.label, description: c.description ?? "", tone: c.tone });
        setEditing(c);
    };

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.label.trim()) return toast.error("Give the category a name");
        setSaving(true);
        try {
            const body = { label: form.label.trim(), description: form.description.trim() || null, tone: form.tone };
            if (editing === "new") {
                await studentCategoriesService.create(body);
                toast.success(`${body.label} added`);
            } else if (editing) {
                await studentCategoriesService.update(editing.id, body);
                toast.success(`${body.label} saved`);
            }
            setEditing(null);
            await load(true);
        } catch (err) {
            toast.error(errMsg(err, "Couldn't save the category"));
        } finally {
            setSaving(false);
        }
    };

    const act = async (c: StudentCategory, fn: () => Promise<unknown>, done: string) => {
        setBusyId(c.id);
        try {
            await fn();
            toast.success(done);
            await load(true);
        } catch (err) {
            toast.error(errMsg(err, "That didn't work"));
        } finally {
            setBusyId(null);
        }
    };

    /** Swap display order with the neighbour above or below. */
    const move = (c: StudentCategory, dir: -1 | 1) => {
        const i = active.findIndex((r) => r.id === c.id);
        const other = active[i + dir];
        if (!other) return;
        // Swap the two; equal orders (never set apart) get spread first.
        const [mine, theirs] = c.order === other.order ? [c.order + dir * 5, c.order] : [other.order, c.order];
        void act(
            c,
            async () => {
                await studentCategoriesService.update(c.id, { display_order: Math.max(0, mine) });
                await studentCategoriesService.update(other.id, { display_order: Math.max(0, theirs) });
            },
            "Order saved",
        );
    };

    const retire = (c: StudentCategory) => {
        if (!confirm(`Retire ${c.label}?\n\nNo more students can be given it. The ${c.student_count ?? 0} student(s) who hold it keep it until it is taken off them.`)) return;
        void act(c, () => studentCategoriesService.update(c.id, { is_active: false }), `${c.label} retired`);
    };
    const remove = (c: StudentCategory) => {
        if (!confirm(`Delete ${c.label}? Nobody holds it, so nothing else changes.`)) return;
        void act(c, () => studentCategoriesService.remove(c.id), `${c.label} deleted`);
    };

    const row = (c: StudentCategory, i: number, list: StudentCategory[]) => (
        <div key={c.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${categoryDotClass(c)}`} />
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-md border px-2 py-0.5 text-[11px] font-extrabold uppercase ${benefitChipClass(c)}`}>{c.label}</span>
                        <span className="font-mono text-[10px] text-zinc-400">{c.key}</span>
                    </div>
                    {c.description && <p className="mt-1 text-xs text-zinc-500">{c.description}</p>}
                </div>
            </div>
            <Link
                href={`/identity/students/reports?report=categories&category=${c.key}`}
                className="shrink-0 text-xs font-bold text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 sm:w-28 sm:text-right"
            >
                {c.student_count ?? 0} student{c.student_count === 1 ? "" : "s"}
            </Link>
            <div className="flex shrink-0 items-center gap-1">
                {busyId === c.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                ) : c.is_active ? (
                    <>
                        {access.can("edit") && (
                            <>
                                <IconBtn title="Move up" disabled={i === 0} onClick={() => move(c, -1)}><ArrowUp className="h-3.5 w-3.5" /></IconBtn>
                                <IconBtn title="Move down" disabled={i === list.length - 1} onClick={() => move(c, 1)}><ArrowDown className="h-3.5 w-3.5" /></IconBtn>
                                <IconBtn title="Edit" onClick={() => openEdit(c)}><Edit2 className="h-3.5 w-3.5" /></IconBtn>
                                <IconBtn title="Retire" onClick={() => retire(c)}><Archive className="h-3.5 w-3.5" /></IconBtn>
                            </>
                        )}
                        {access.can("delete") && (c.student_count ?? 0) === 0 && (
                            <IconBtn title="Delete" danger onClick={() => remove(c)}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                        )}
                    </>
                ) : (
                    <>
                        {access.can("edit") && (
                            <IconBtn title="Restore" onClick={() => act(c, () => studentCategoriesService.update(c.id, { is_active: true }), `${c.label} restored`)}>
                                <RotateCcw className="h-3.5 w-3.5" />
                            </IconBtn>
                        )}
                        {access.can("delete") && (c.student_count ?? 0) === 0 && (
                            <IconBtn title="Delete" danger onClick={() => remove(c)}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                        )}
                    </>
                )}
            </div>
        </div>
    );

    return (
        <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
            <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <p className="text-[11px] font-bold">
                    Categories show on the student profile, in Studentwise Fees and in the student reports. A category students hold can be retired, not deleted.
                </p>
            </div>

            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="space-y-1">
                    <h1 className="flex items-center gap-3 text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
                        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-900 text-white">
                            <Award className="h-5 w-5" />
                        </span>
                        Special Categories
                    </h1>
                    <p className="text-sm text-zinc-500">Fee Endowment, Complementary and the other categories a student can hold, each with a reason and an end date.</p>
                </div>
                {access.can("create") && (
                    <button
                        onClick={openNew}
                        className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-5 text-[11px] font-black uppercase tracking-widest text-white hover:bg-zinc-800"
                    >
                        <Plus className="h-4 w-4" /> Add category
                    </button>
                )}
            </div>

            <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                <div className="border-b border-zinc-100 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-zinc-400 dark:border-zinc-800">
                    In use · {active.length}
                </div>
                {loading ? (
                    <div className="flex items-center gap-2 p-6 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                ) : active.length === 0 ? (
                    <p className="p-6 text-sm text-zinc-500">No categories yet.</p>
                ) : (
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">{active.map((c, i) => row(c, i, active))}</div>
                )}
            </section>

            {retired.length > 0 && (
                <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40">
                    <div className="border-b border-zinc-100 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-zinc-400 dark:border-zinc-800">
                        Retired · {retired.length} · holders keep them, nobody new can be given them
                    </div>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">{retired.map((c, i) => row(c, i, retired))}</div>
                </section>
            )}

            {editing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
                    <form onSubmit={save} className="w-full max-w-md space-y-4 rounded-3xl border border-zinc-100 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100">{editing === "new" ? "Add a category" : `Edit ${editing.label}`}</h2>
                            <button type="button" onClick={() => setEditing(null)} className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <label className="block space-y-1 text-xs">
                            <span className="font-bold uppercase tracking-wider text-zinc-500">Name</span>
                            <input
                                autoFocus
                                value={form.label}
                                maxLength={100}
                                onChange={(e) => setForm({ ...form, label: e.target.value })}
                                placeholder="e.g. Staff Child"
                                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900"
                            />
                            {editing === "new" && <span className="block text-[10px] text-zinc-400">Written in full on every screen and report. Never use short forms like FE or COMP.</span>}
                        </label>
                        <label className="block space-y-1 text-xs">
                            <span className="font-bold uppercase tracking-wider text-zinc-500">What it means (optional)</span>
                            <input
                                value={form.description}
                                maxLength={300}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                placeholder="e.g. Monthly Tuition Fee waived; other heads charged"
                                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900"
                            />
                        </label>
                        <div className="space-y-1 text-xs">
                            <span className="font-bold uppercase tracking-wider text-zinc-500">Colour</span>
                            <div className="flex flex-wrap gap-2">
                                {CATEGORY_TONES.map((t) => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setForm({ ...form, tone: t })}
                                        aria-label={t}
                                        aria-pressed={form.tone === t}
                                        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${form.tone === t ? "border-zinc-900 dark:border-white" : "border-transparent"}`}
                                    >
                                        <span className={`h-5 w-5 rounded-full ${categoryDotClass({ tone: t })}`} />
                                    </button>
                                ))}
                            </div>
                        </div>
                        {form.label.trim() && (
                            <span className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-extrabold uppercase ${benefitChipClass({ tone: form.tone })}`}>{form.label.trim()}</span>
                        )}
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setEditing(null)} className="h-10 rounded-xl px-4 text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancel</button>
                            <button type="submit" disabled={saving} className="flex h-10 items-center gap-2 rounded-xl bg-zinc-900 px-5 text-xs font-black uppercase tracking-widest text-white disabled:opacity-60">
                                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

function IconBtn({ children, title, onClick, disabled, danger }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
    return (
        <button
            type="button"
            title={title}
            aria-label={title}
            disabled={disabled}
            onClick={onClick}
            className={`flex h-8 w-8 items-center justify-center rounded-xl text-zinc-500 transition-colors disabled:opacity-30 ${danger ? "hover:bg-rose-50 hover:text-rose-600" : "hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"}`}
        >
            {children}
        </button>
    );
}
