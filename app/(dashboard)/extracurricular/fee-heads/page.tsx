"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CircleDot, Loader2, Pencil, Plus, Repeat, RotateCcw, Search, Tags, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { toggleId } from "@/components/filters/filter-params";
import { ecFeesService } from "@/lib/ec-fees.service";
import {
    EC_FREQUENCY_LABEL,
    EC_MONTHS,
    ecErrMsg,
    ecMonthShort,
    type EcFeeFrequency,
    type EcFeeHead,
    type EcFeeHeadState,
} from "@/lib/ec-fees.types";
import { EC_TILES, useExtracurricularAccess } from "@/hooks/use-extracurricular-access";
import { parseList, useDebounced, useUrlSync } from "@/features/extracurricular/url-state";
import {
    EcConfirmDialog,
    EcField,
    EcModal,
    EcPageFallback,
    EcPageHeader,
    ecInputClass,
    ecPrimaryButton,
    ecSecondaryButton,
} from "@/features/extracurricular/ui";

const FREQUENCIES: EcFeeFrequency[] = ["MONTHLY", "ONE_TIME"];
const STATES: EcFeeHeadState[] = ["ACTIVE", "INACTIVE"];
const STATE_LABEL: Record<EcFeeHeadState, string> = { ACTIVE: "Active", INACTIVE: "Inactive" };

/**
 * TAFSD-605: Extracurricular Fees → Fee Heads, the EC twin of School Setup →
 * Fee Types. A head is a name, monthly or one-time, and the months it falls in.
 * Amounts are set per class on Class Amounts and per student on Student Charges.
 */
export default function EcFeeHeadsPage() {
    return (
        <Suspense fallback={<EcPageFallback />}>
            <EcFeeHeadsInner />
        </Suspense>
    );
}

function EcFeeHeadsInner() {
    const access = useExtracurricularAccess(EC_TILES.feeHeads);
    const params = useSearchParams();

    const [search, setSearch] = useState(params.get("q") ?? "");
    const [frequencies, setFrequencies] = useState<EcFeeFrequency[]>(parseList(params.get("frequency"), FREQUENCIES));
    const [states, setStates] = useState<EcFeeHeadState[]>(parseList(params.get("status"), STATES));
    const q = useDebounced(search);
    useUrlSync({ q: q.trim(), frequency: frequencies, status: states });

    const [rows, setRows] = useState<EcFeeHead[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [editor, setEditor] = useState<{ mode: "create" } | { mode: "edit"; head: EcFeeHead } | null>(null);
    const [deleting, setDeleting] = useState<EcFeeHead | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);
    const reqId = useRef(0);

    const load = useCallback(async () => {
        const id = ++reqId.current;
        setLoading(true);
        try {
            const data = await ecFeesService.listFeeHeads({ q, frequencies, states });
            if (id === reqId.current) setRows(data);
        } catch (err) {
            if (id === reqId.current) toast.error(ecErrMsg(err, "Couldn't load the heads"));
        } finally {
            if (id === reqId.current) setLoading(false);
        }
    }, [q, frequencies, states]);

    useEffect(() => {
        void load();
    }, [load]);

    const filtersActive = !!search.trim() || frequencies.length > 0 || states.length > 0;
    const clearFilters = () => {
        setSearch("");
        setFrequencies([]);
        setStates([]);
    };

    const toggleActive = async (head: EcFeeHead) => {
        setBusyId(head.id);
        try {
            await ecFeesService.updateFeeHead(head.id, { is_active: !head.is_active });
            toast.success(head.is_active ? `${head.name} deactivated` : `${head.name} activated`);
            await load();
        } catch (err) {
            toast.error(ecErrMsg(err, "Couldn't change the head"));
        } finally {
            setBusyId(null);
        }
    };

    const confirmDelete = async () => {
        if (!deleting) return;
        setBusyId(deleting.id);
        try {
            await ecFeesService.deleteFeeHead(deleting.id);
            toast.success(`${deleting.name} deleted`);
            setDeleting(null);
            await load();
        } catch (err) {
            toast.error(ecErrMsg(err, "Couldn't delete the head"));
        } finally {
            setBusyId(null);
        }
    };

    const typing = search.trim() !== q.trim();

    return (
        <div className="space-y-6 pb-12">
            <EcPageHeader
                icon={Tags}
                title="Fee Heads"
                description="Extracurricular charges are billed on their own vouchers, never with academic fees. Add a head here, set its amount per class on Class Amounts, then charge students on Student Charges."
                actions={
                    access.can("create") && (
                        <button type="button" className={ecPrimaryButton} onClick={() => setEditor({ mode: "create" })}>
                            <Plus className="h-4 w-4" /> Add head
                        </button>
                    )
                }
            />

            <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
                <div className="flex-1">
                    <EcField label="Search" htmlFor="ec-head-search">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                            <input
                                id="ec-head-search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Part of a head name"
                                className={`${ecInputClass} pl-11`}
                            />
                        </div>
                    </EcField>
                </div>
                <div className="w-full lg:w-56">
                    <FilterDropdown<EcFeeFrequency>
                        label="Frequency"
                        icon={Repeat}
                        value={frequencies}
                        options={FREQUENCIES.map((f) => ({ id: f, label: EC_FREQUENCY_LABEL[f] }))}
                        placeholder="Monthly and one-time"
                        onToggle={(id) => setFrequencies((prev) => toggleId(prev, id))}
                        onClear={() => setFrequencies([])}
                        onSetValue={setFrequencies}
                    />
                </div>
                <div className="w-full lg:w-56">
                    <FilterDropdown<EcFeeHeadState>
                        label="Status"
                        icon={CircleDot}
                        value={states}
                        options={STATES.map((s) => ({ id: s, label: STATE_LABEL[s] }))}
                        placeholder="Active and inactive"
                        onToggle={(id) => setStates((prev) => toggleId(prev, id))}
                        onClear={() => setStates([])}
                        onSetValue={setStates}
                    />
                </div>
                {filtersActive && (
                    <button type="button" onClick={clearFilters} className="h-11 px-3 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-1">
                        <RotateCcw className="h-4 w-4" /> Clear filters
                    </button>
                )}
            </div>

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                                <th className="py-3 px-4 font-medium">Head</th>
                                <th className="py-3 px-4 font-medium">Frequency</th>
                                <th className="py-3 px-4 font-medium">Months</th>
                                <th className="py-3 px-4 font-medium">Used by</th>
                                <th className="py-3 px-4 font-medium">Status</th>
                                <th className="py-3 px-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && !rows ? (
                                <tr>
                                    <td colSpan={6} className="py-16 text-center text-zinc-400">
                                        <Loader2 className="h-5 w-5 animate-spin inline" />
                                    </td>
                                </tr>
                            ) : !rows || rows.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-16 text-center text-zinc-400 text-sm">
                                        {typing || loading
                                            ? "Searching…"
                                            : filtersActive
                                              ? "No head matches these filters."
                                              : "No extracurricular heads yet. Add the first one."}
                                    </td>
                                </tr>
                            ) : (
                                rows.map((h) => (
                                    <tr key={h.id} className={`border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 ${loading ? "opacity-60" : ""}`}>
                                        <td className="py-3 px-4">
                                            <div className="font-semibold text-zinc-900 dark:text-zinc-100">{h.name}</div>
                                            <div className="text-xs text-zinc-400">Order {h.sort_order}</div>
                                        </td>
                                        <td className="py-3 px-4 text-zinc-600 dark:text-zinc-300">{EC_FREQUENCY_LABEL[h.frequency]}</td>
                                        <td className="py-3 px-4">
                                            <div className="flex flex-wrap gap-1">
                                                {h.months.length === 12 ? (
                                                    <span className="text-xs rounded-md bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 px-1.5 py-0.5">Every month</span>
                                                ) : (
                                                    h.months.map((m) => (
                                                        <span key={m} className="text-xs rounded-md bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-zinc-600 dark:text-zinc-300">
                                                            {ecMonthShort(m)}
                                                        </span>
                                                    ))
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-xs text-zinc-500">
                                            <div>{h.charges_count.toLocaleString()} student month(s)</div>
                                            <div>{h.schedule_rows_count.toLocaleString()} class amount(s)</div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <button
                                                type="button"
                                                disabled={!access.can("edit") || busyId === h.id}
                                                onClick={() => toggleActive(h)}
                                                title={access.can("edit") ? (h.is_active ? "Deactivate" : "Activate") : undefined}
                                                className={`text-xs font-semibold rounded-full px-2.5 py-1 border disabled:cursor-default ${
                                                    h.is_active
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900"
                                                        : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800"
                                                }`}
                                            >
                                                {busyId === h.id ? <Loader2 className="h-3 w-3 animate-spin inline" /> : h.is_active ? "Active" : "Inactive"}
                                            </button>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex justify-end gap-1">
                                                {access.can("edit") && (
                                                    <button type="button" onClick={() => setEditor({ mode: "edit", head: h })} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900" aria-label={`Edit ${h.name}`}>
                                                        <Pencil className="h-4 w-4 text-zinc-500" />
                                                    </button>
                                                )}
                                                {access.can("delete") && (
                                                    <button type="button" onClick={() => setDeleting(h)} className="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30" aria-label={`Delete ${h.name}`}>
                                                        <Trash2 className="h-4 w-4 text-rose-500" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {editor && (
                <HeadEditor
                    head={editor.mode === "edit" ? editor.head : null}
                    onClose={() => setEditor(null)}
                    onSaved={async () => {
                        setEditor(null);
                        await load();
                    }}
                />
            )}

            <EcConfirmDialog
                open={!!deleting}
                title={`Delete ${deleting?.name ?? "head"}?`}
                danger
                busy={busyId === deleting?.id}
                confirmLabel="Delete head"
                onClose={() => setDeleting(null)}
                onConfirm={confirmDelete}
                body={
                    deleting && deleting.charges_count > 0 ? (
                        <p>
                            This head is charged to {deleting.charges_count.toLocaleString()} student month(s), so it can&apos;t be deleted.
                            Deactivate it instead: it stays on those students&apos; records but can&apos;t be charged again.
                        </p>
                    ) : (
                        <>
                            <p>The head and its {deleting?.schedule_rows_count ?? 0} class amount(s) are removed. No student is charged for it.</p>
                            <p>This can&apos;t be undone.</p>
                        </>
                    )
                }
            />
        </div>
    );
}

function HeadEditor({ head, onClose, onSaved }: { head: EcFeeHead | null; onClose: () => void; onSaved: () => void }) {
    const [name, setName] = useState(head?.name ?? "");
    const [frequency, setFrequency] = useState<EcFeeFrequency>(head?.frequency ?? "MONTHLY");
    const [months, setMonths] = useState<number[]>(head?.months ?? []);
    const [sortOrder, setSortOrder] = useState(String(head?.sort_order ?? 0));
    const [active, setActive] = useState(head?.is_active ?? true);
    const [saving, setSaving] = useState(false);

    const pickMonth = (m: number) => {
        if (frequency === "ONE_TIME") setMonths([m]);
        else setMonths((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
    };

    const changeFrequency = (f: EcFeeFrequency) => {
        setFrequency(f);
        if (f === "ONE_TIME" && months.length > 1) setMonths(months.slice(0, 1));
    };

    const order = Number(sortOrder);
    const problems = [
        name.trim().length < 2 && "Give the head a name.",
        months.length === 0 && (frequency === "ONE_TIME" ? "Pick the month it is charged in." : "Pick at least one month."),
        (!Number.isInteger(order) || order < 0) && "Display order must be a whole number, 0 or more.",
    ].filter(Boolean) as string[];

    const save = async () => {
        if (problems.length) {
            toast.error(problems[0]);
            return;
        }
        setSaving(true);
        try {
            if (head) {
                await ecFeesService.updateFeeHead(head.id, { name, frequency, months, sort_order: order, is_active: active });
                toast.success("Head saved");
            } else {
                await ecFeesService.createFeeHead({ name, frequency, months, sort_order: order });
                toast.success("Head added");
            }
            onSaved();
        } catch (err) {
            toast.error(ecErrMsg(err, "Couldn't save the head"));
        } finally {
            setSaving(false);
        }
    };

    return (
        <EcModal
            open
            title={head ? `Edit ${head.name}` : "Add an extracurricular head"}
            subtitle="Amounts are set per class on Class Amounts."
            onClose={onClose}
            footer={
                <>
                    <button type="button" className={ecSecondaryButton} onClick={onClose} disabled={saving}>
                        Cancel
                    </button>
                    <button type="button" className={ecPrimaryButton} onClick={save} disabled={saving}>
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />} {head ? "Save head" : "Add head"}
                    </button>
                </>
            }
        >
            <EcField label="Head name" htmlFor="ec-head-name">
                <input id="ec-head-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Scouts Registration" className={ecInputClass} maxLength={100} autoFocus />
            </EcField>

            <EcField label="Frequency">
                <div className="grid grid-cols-2 gap-2">
                    {FREQUENCIES.map((f) => (
                        <button
                            key={f}
                            type="button"
                            onClick={() => changeFrequency(f)}
                            className={`text-left rounded-xl border px-3 py-2.5 ${
                                frequency === f
                                    ? "border-orange-400 bg-orange-50 dark:bg-orange-950/30 ring-2 ring-orange-500/20"
                                    : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                            }`}
                        >
                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{EC_FREQUENCY_LABEL[f]}</div>
                            <div className="text-xs text-zinc-500">{f === "MONTHLY" ? "Charged in each month you pick" : "Charged once, in the month you pick"}</div>
                        </button>
                    ))}
                </div>
            </EcField>

            <EcField
                label={frequency === "ONE_TIME" ? "Month it is charged in" : "Months it is charged in"}
                hint={head ? "Charges already made from this head keep their own months and amounts." : undefined}
            >
                <div className="grid grid-cols-6 gap-1.5">
                    {EC_MONTHS.map((m) => {
                        const on = months.includes(m.num);
                        return (
                            <button
                                key={m.num}
                                type="button"
                                onClick={() => pickMonth(m.num)}
                                aria-pressed={on}
                                className={`h-9 rounded-lg text-xs font-semibold border ${
                                    on
                                        ? "bg-orange-600 border-orange-600 text-white"
                                        : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                                }`}
                            >
                                {m.short}
                            </button>
                        );
                    })}
                </div>
                {frequency === "MONTHLY" && (
                    <div className="flex gap-3 text-xs mt-1 ml-1">
                        <button type="button" className="font-semibold text-orange-600 hover:underline" onClick={() => setMonths(EC_MONTHS.map((m) => m.num))}>
                            Every month
                        </button>
                        <button type="button" className="font-semibold text-zinc-500 hover:underline" onClick={() => setMonths([])}>
                            Clear
                        </button>
                    </div>
                )}
            </EcField>

            <EcField label="Display order" htmlFor="ec-head-order" hint="Lower numbers are listed first.">
                <input id="ec-head-order" type="number" min={0} step={1} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={`${ecInputClass} w-32`} />
            </EcField>

            {head && (
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
                    <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                    Active (an inactive head can&apos;t be charged to students)
                </label>
            )}
        </EcModal>
    );
}
