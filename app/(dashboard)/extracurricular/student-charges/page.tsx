"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarRange, CircleDot, Layers, ListMinus, ListPlus, Loader2, Lock, Plus, RotateCcw, Save, Tags, Undo2, UserCog } from "lucide-react";
import toast from "react-hot-toast";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { toggleId } from "@/components/filters/filter-params";
import { ecFeesService } from "@/lib/ec-fees.service";
import {
    EC_CHARGE_STATUS_LABEL,
    EC_LOCK_REASON_LABEL,
    EC_MONTHS,
    ecErrMsg,
    ecMonthShort,
    ecRs,
    type EcAmountSource,
    type EcCharge,
    type EcChargeStatus,
    type EcFeeHeadOption,
    type EcStudentCharges,
    type EcStudentClassAmount,
} from "@/lib/ec-fees.types";
import { getAcademicYears, getCurrentAcademicYear } from "@/lib/fee-utils";
import { EC_TILES, useExtracurricularAccess } from "@/hooks/use-extracurricular-access";
import { parseList, useUrlSync } from "@/features/extracurricular/url-state";
import { EcField, EcModal, EcPageFallback, EcPageHeader, ecInputClass, ecPrimaryButton, ecSecondaryButton } from "@/features/extracurricular/ui";
import { EcStudentPicker, type EcPickedStudent } from "@/features/extracurricular/EcStudentPicker";
import { EcBulkAssignDialog, EcBulkRemoveDialog } from "@/features/extracurricular/EcBulkChargeDialogs";

const STATUSES: EcChargeStatus[] = ["NOT_ISSUED", "ISSUED", "PARTIALLY_PAID", "PAID", "WAIVED"];
const editKey = (year: string, headId: number, month: number) => `${year}|${headId}|${month}`;

const STATUS_STYLE: Record<EcChargeStatus, string> = {
    NOT_ISSUED: "",
    ISSUED: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-900",
    PARTIALLY_PAID: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900",
    PAID: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900",
    WAIVED: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-300 dark:border-teal-900",
};

/**
 * TAFSD-605: Extracurricular Fees → Student Charges, the EC twin of Student
 * Overrides. A charge is one head in one month for one student. Charges not yet
 * on a voucher are edited in place; once issued (or paid, or waived) a charge
 * is locked here and changes through its voucher.
 */
export default function EcStudentChargesPage() {
    return (
        <Suspense fallback={<EcPageFallback />}>
            <EcStudentChargesInner />
        </Suspense>
    );
}

function EcStudentChargesInner() {
    const access = useExtracurricularAccess(EC_TILES.studentCharges);
    const params = useSearchParams();
    const currentYear = getCurrentAcademicYear();
    const baseYears = useMemo(() => getAcademicYears(2, 2), []);

    const [studentCc, setStudentCc] = useState<number | null>(Number(params.get("student")) || null);
    const [picked, setPicked] = useState<EcPickedStudent | null>(null);
    const [years, setYears] = useState<string[]>((params.get("years") ?? "").split(",").filter((y) => /^\d{4}-\d{4}$/.test(y)));
    const [headIds, setHeadIds] = useState<number[]>(
        (params.get("heads") ?? "").split(",").map(Number).filter((x) => Number.isInteger(x) && x > 0),
    );
    const [statuses, setStatuses] = useState<EcChargeStatus[]>(parseList(params.get("status"), STATUSES));
    useUrlSync({ student: studentCc ?? undefined, years, heads: headIds, status: statuses });

    const [heads, setHeads] = useState<EcFeeHeadOption[]>([]);
    const [data, setData] = useState<EcStudentCharges | null>(null);
    const [loading, setLoading] = useState(false);
    const [edits, setEdits] = useState<Map<string, string>>(new Map());
    const [saving, setSaving] = useState(false);
    const [addFor, setAddFor] = useState<string | null>(null);
    const [bulk, setBulk] = useState<"assign" | "remove" | null>(null);
    const reqId = useRef(0);

    useEffect(() => {
        ecFeesService.feeHeadOptions().then(setHeads).catch(() => setHeads([]));
    }, []);

    const load = useCallback(async () => {
        if (!studentCc) {
            setData(null);
            return;
        }
        const id = ++reqId.current;
        setLoading(true);
        try {
            const res = await ecFeesService.studentCharges(studentCc);
            if (id !== reqId.current) return;
            setData(res);
            setPicked((p) =>
                p?.cc === res.student.cc
                    ? p
                    : {
                          cc: res.student.cc,
                          full_name: res.student.full_name,
                          gr_number: res.student.gr_number,
                          class_name: res.student.class_name,
                          section_name: res.student.section_name,
                          campus_name: res.student.campus_name,
                      },
            );
        } catch (err) {
            if (id === reqId.current) {
                toast.error(ecErrMsg(err, "Couldn't load the student's charges"));
                setData(null);
            }
        } finally {
            if (id === reqId.current) setLoading(false);
        }
    }, [studentCc]);

    useEffect(() => {
        void load();
    }, [load]);

    const charges = useMemo(() => data?.charges ?? [], [data]);
    const yearsWithCharges = useMemo(() => [...new Set(charges.map((c) => c.academic_year))], [charges]);
    const yearOptions = useMemo(() => [...new Set([...baseYears, ...yearsWithCharges])].sort().reverse(), [baseYears, yearsWithCharges]);
    // Empty = all: every year with charges, plus the current year to add to.
    const shownYears = useMemo(
        () => (years.length ? [...years].sort().reverse() : [...new Set([currentYear, ...yearsWithCharges])].sort().reverse()),
        [years, currentYear, yearsWithCharges],
    );
    const headOptions = useMemo(() => {
        const m = new Map<number, string>();
        for (const h of heads) m.set(h.id, h.name);
        for (const c of charges) if (!m.has(c.fee_head_id)) m.set(c.fee_head_id, c.fee_head_name);
        return [...m.entries()].map(([id, label]) => ({ id, label }));
    }, [heads, charges]);

    const dirty = useMemo(() => {
        const byKey = new Map(charges.map((c) => [editKey(c.academic_year, c.fee_head_id, c.target_month), c]));
        const out: { year: string; headId: number; month: number; value: string }[] = [];
        for (const [key, value] of edits) {
            const [year, headId, month] = [key.split("|")[0], Number(key.split("|")[1]), Number(key.split("|")[2])];
            const was = byKey.get(key);
            if (value.trim() !== (was ? String(was.amount) : "")) out.push({ year, headId, month, value: value.trim() });
        }
        return out;
    }, [edits, charges]);

    const pickStudent = (s: EcPickedStudent | null) => {
        if (dirty.length) {
            toast.error("Save or discard your changes first");
            return;
        }
        setEdits(new Map());
        setPicked(s);
        setStudentCc(s?.cc ?? null);
        if (!s) setData(null);
    };

    const save = async () => {
        if (!studentCc) return;
        if (dirty.some((d) => d.value !== "" && (!/^\d+$/.test(d.value) || Number(d.value) < 1))) {
            toast.error("Amounts are whole rupees, 1 or more. Empty a cell to remove the charge.");
            return;
        }
        setSaving(true);
        try {
            const byYear = new Map<string, typeof dirty>();
            for (const d of dirty) byYear.set(d.year, [...(byYear.get(d.year) ?? []), d]);
            let created = 0;
            let updated = 0;
            let removed = 0;
            for (const [year, cells] of byYear) {
                const res = await ecFeesService.saveStudentCharges(
                    studentCc,
                    year,
                    cells.map((c) => ({ fee_head_id: c.headId, target_month: c.month, amount: c.value === "" ? null : Number(c.value) })),
                );
                created += res.created;
                updated += res.updated;
                removed += res.removed;
            }
            toast.success(`Saved: ${created} added, ${updated} changed, ${removed} removed`);
            setEdits(new Map());
            await load();
        } catch (err) {
            toast.error(ecErrMsg(err, "Couldn't save the charges"));
            await load();
        } finally {
            setSaving(false);
        }
    };

    const filtersActive = years.length > 0 || headIds.length > 0 || statuses.length > 0;

    return (
        <div className="space-y-6 pb-28">
            <EcPageHeader
                icon={UserCog}
                title="Student Charges"
                description="What each student is charged for extracurricular heads. Change a charge here until it is put on a voucher; after that it changes through its voucher. Use Bulk assign to charge a whole class or campus at once."
                actions={
                    <>
                        {access.can("bulk_assign") && (
                            <button type="button" className={ecSecondaryButton} onClick={() => setBulk("assign")}>
                                <ListPlus className="h-4 w-4" /> Bulk assign
                            </button>
                        )}
                        {access.can("bulk_remove") && (
                            <button type="button" className={ecSecondaryButton} onClick={() => setBulk("remove")}>
                                <ListMinus className="h-4 w-4" /> Bulk remove
                            </button>
                        )}
                    </>
                }
            />

            <div className="max-w-2xl">
                <EcStudentPicker value={picked} onChange={pickStudent} />
            </div>

            {studentCc && (
                <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
                    <div className="w-full lg:w-56">
                        <FilterDropdown<string>
                            label="Academic years"
                            icon={CalendarRange}
                            value={years}
                            options={yearOptions.map((y) => ({ id: y, label: y }))}
                            placeholder="Years with charges"
                            onToggle={(id) => setYears((p) => toggleId(p, id))}
                            onClear={() => setYears([])}
                            onSetValue={setYears}
                        />
                    </div>
                    <div className="w-full lg:w-56">
                        <FilterDropdown
                            label="Heads"
                            icon={Tags}
                            value={headIds}
                            options={headOptions}
                            placeholder="All heads"
                            onToggle={(id) => setHeadIds((p) => toggleId(p, id))}
                            onClear={() => setHeadIds([])}
                            onSetValue={setHeadIds}
                        />
                    </div>
                    <div className="w-full lg:w-56">
                        <FilterDropdown<EcChargeStatus>
                            label="Status"
                            icon={CircleDot}
                            value={statuses}
                            options={STATUSES.map((s) => ({ id: s, label: EC_CHARGE_STATUS_LABEL[s] }))}
                            placeholder="Any status"
                            onToggle={(id) => setStatuses((p) => toggleId(p, id))}
                            onClear={() => setStatuses([])}
                            onSetValue={setStatuses}
                        />
                    </div>
                    {filtersActive && (
                        <button
                            type="button"
                            onClick={() => {
                                setYears([]);
                                setHeadIds([]);
                                setStatuses([]);
                            }}
                            className="h-11 px-3 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-1"
                        >
                            <RotateCcw className="h-4 w-4" /> Clear filters
                        </button>
                    )}
                </div>
            )}

            {!studentCc ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 py-16 text-center text-sm text-zinc-400">
                    Search for a student to see and change their extracurricular charges.
                </div>
            ) : loading && !data ? (
                <div className="py-16 text-center text-zinc-400">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                </div>
            ) : data ? (
                <div className="space-y-6">
                    {shownYears.map((year) => (
                        <YearGrid
                            key={year}
                            year={year}
                            charges={charges.filter((c) => c.academic_year === year)}
                            heads={heads}
                            headFilter={headIds}
                            statusFilter={statuses}
                            canEdit={access.can("edit")}
                            edits={edits}
                            onEdit={(key, value) => setEdits((prev) => new Map(prev).set(key, value))}
                            onAddHead={() => setAddFor(year)}
                        />
                    ))}
                </div>
            ) : null}

            {dirty.length > 0 && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl px-4 py-3">
                    <span className="text-sm text-zinc-600 dark:text-zinc-300">
                        {dirty.length} unsaved change{dirty.length === 1 ? "" : "s"}
                    </span>
                    <button type="button" className={ecSecondaryButton} onClick={() => setEdits(new Map())} disabled={saving}>
                        <Undo2 className="h-4 w-4" /> Discard
                    </button>
                    <button type="button" className={ecPrimaryButton} onClick={save} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
                    </button>
                </div>
            )}

            {addFor && studentCc && (
                <AddHeadDialog
                    cc={studentCc}
                    year={addFor}
                    charges={charges.filter((c) => c.academic_year === addFor)}
                    onClose={() => setAddFor(null)}
                    onDone={async () => {
                        setAddFor(null);
                        await load();
                    }}
                />
            )}
            {bulk === "assign" && (
                <EcBulkAssignDialog
                    heads={heads}
                    years={yearOptions}
                    defaultYear={currentYear}
                    onClose={() => setBulk(null)}
                    onDone={async () => {
                        setBulk(null);
                        await load();
                    }}
                />
            )}
            {bulk === "remove" && (
                <EcBulkRemoveDialog
                    heads={heads}
                    years={yearOptions}
                    defaultYear={currentYear}
                    onClose={() => setBulk(null)}
                    onDone={async () => {
                        setBulk(null);
                        await load();
                    }}
                />
            )}
        </div>
    );
}

function YearGrid({
    year,
    charges,
    heads,
    headFilter,
    statusFilter,
    canEdit,
    edits,
    onEdit,
    onAddHead,
}: {
    year: string;
    charges: EcCharge[];
    heads: EcFeeHeadOption[];
    headFilter: number[];
    statusFilter: EcChargeStatus[];
    canEdit: boolean;
    edits: Map<string, string>;
    onEdit: (key: string, value: string) => void;
    onAddHead: () => void;
}) {
    const headById = new Map(heads.map((h) => [h.id, h]));
    const rows = [...new Map(charges.map((c) => [c.fee_head_id, c.fee_head_name])).entries()]
        .filter(([id]) => !headFilter.length || headFilter.includes(id))
        .filter(([id]) => !statusFilter.length || charges.some((c) => c.fee_head_id === id && statusFilter.includes(c.status)));
    const byKey = new Map(charges.map((c) => [`${c.fee_head_id}|${c.target_month}`, c]));
    const total = charges.reduce((n, c) => n + c.amount, 0);
    const paid = charges.reduce((n, c) => n + c.amount_paid, 0);
    const waived = charges.reduce((n, c) => n + c.waived_amount, 0);

    return (
        <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-zinc-100 dark:border-zinc-900">
                <div>
                    <h2 className="font-black text-zinc-900 dark:text-zinc-100">{year}</h2>
                    <p className="text-xs text-zinc-500">
                        Charged {ecRs(total)} · Received {ecRs(paid)}
                        {waived > 0 ? ` · Waived ${ecRs(waived)}` : ""} · Outstanding {ecRs(Math.max(total - paid - waived, 0))}
                    </p>
                </div>
                {canEdit && (
                    <button type="button" className={ecSecondaryButton} onClick={onAddHead}>
                        <Plus className="h-4 w-4" /> Add head
                    </button>
                )}
            </div>
            {rows.length === 0 ? (
                <div className="py-10 text-center text-sm text-zinc-400">
                    {charges.length === 0 ? `No extracurricular charges in ${year}.` : "No head matches these filters."}
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="text-sm min-w-full">
                        <thead>
                            <tr className="text-left text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-900">
                                <th className="py-2.5 px-4 font-medium sticky left-0 bg-zinc-50 dark:bg-zinc-900 z-10 min-w-[11rem]">Head (amounts in Rs)</th>
                                {EC_MONTHS.map((m) => (
                                    <th key={m.num} className="py-2.5 px-1.5 font-medium text-center min-w-[5.5rem]">
                                        {m.short}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(([headId, headName]) => {
                                const head = headById.get(headId);
                                return (
                                    <tr key={headId} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
                                        <td className="py-2 px-4 font-semibold text-zinc-800 dark:text-zinc-100 sticky left-0 bg-white dark:bg-zinc-950 z-10">
                                            {headName}
                                            {!head && <span className="block text-[10px] font-normal text-zinc-400">Inactive head</span>}
                                        </td>
                                        {EC_MONTHS.map((m) => {
                                            const charge = byKey.get(`${headId}|${m.num}`);
                                            const key = editKey(year, headId, m.num);
                                            const dimmed = statusFilter.length > 0 && (!charge || !statusFilter.includes(charge.status));
                                            return (
                                                <td key={m.num} className={`py-1.5 px-1 text-center ${dimmed ? "opacity-30" : ""}`}>
                                                    <ChargeCell
                                                        charge={charge}
                                                        chargeable={!!head && head.months.includes(m.num)}
                                                        canEdit={canEdit}
                                                        value={edits.get(key)}
                                                        label={`${headName} ${m.long} ${year}, in rupees`}
                                                        onChange={(v) => onEdit(key, v)}
                                                    />
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

function ChargeCell({
    charge,
    chargeable,
    canEdit,
    value,
    label,
    onChange,
}: {
    charge: EcCharge | undefined;
    chargeable: boolean;
    canEdit: boolean;
    value: string | undefined;
    label: string;
    onChange: (v: string) => void;
}) {
    if (charge?.locked_reason) {
        const title = [
            `${EC_CHARGE_STATUS_LABEL[charge.status]}${charge.current_voucher?.voucher_number ? ` on ${charge.current_voucher.voucher_number}` : ""}`,
            charge.amount_paid > 0 ? `received ${ecRs(charge.amount_paid)}` : "",
            charge.waived_amount > 0 ? `waived ${ecRs(charge.waived_amount)}` : "",
            `locked: ${EC_LOCK_REASON_LABEL[charge.locked_reason]}`,
        ]
            .filter(Boolean)
            .join(" · ");
        return (
            <div title={title} className={`h-9 rounded-lg border px-1.5 flex flex-col items-center justify-center leading-tight ${STATUS_STYLE[charge.status]}`}>
                <span className="text-xs font-semibold tabular-nums flex items-center gap-0.5">
                    <Lock className="h-2.5 w-2.5" /> {charge.amount.toLocaleString("en-PK")}
                </span>
                <span className="text-[9px]">{EC_CHARGE_STATUS_LABEL[charge.status]}</span>
            </div>
        );
    }
    if (!charge && (!chargeable || !canEdit)) {
        return <span className="text-zinc-300 dark:text-zinc-700">·</span>;
    }
    const shown = value ?? (charge ? String(charge.amount) : "");
    const changed = value !== undefined && value.trim() !== (charge ? String(charge.amount) : "");
    return (
        <input
            aria-label={label}
            inputMode="numeric"
            value={shown}
            disabled={!canEdit}
            placeholder="—"
            onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
            className={`w-full h-9 rounded-lg border text-center text-sm tabular-nums outline-none bg-white dark:bg-zinc-900 placeholder:text-zinc-300 dark:placeholder:text-zinc-700 ${
                changed ? "border-orange-400 ring-2 ring-orange-500/20" : "border-zinc-200 dark:border-zinc-800"
            }`}
        />
    );
}

function AddHeadDialog({
    cc,
    year,
    charges,
    onClose,
    onDone,
}: {
    cc: number;
    year: string;
    charges: EcCharge[];
    onClose: () => void;
    onDone: () => void;
}) {
    const [options, setOptions] = useState<EcStudentClassAmount[] | null>(null);
    const [headId, setHeadId] = useState<number | "">("");
    const [months, setMonths] = useState<number[]>([]);
    const [source, setSource] = useState<EcAmountSource>("SCHEDULE");
    const [amount, setAmount] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        ecFeesService
            .studentClassAmounts(cc, year)
            .then(setOptions)
            .catch((err) => {
                toast.error(ecErrMsg(err, "Couldn't load the heads"));
                setOptions([]);
            });
    }, [cc, year]);

    const head = options?.find((o) => o.fee_head_id === headId) ?? null;
    const charged = useMemo(() => new Set(charges.filter((c) => c.fee_head_id === headId).map((c) => c.target_month)), [charges, headId]);
    useEffect(() => {
        if (!head) return;
        setMonths(head.months.filter((m) => !charged.has(m)));
        setSource(head.amount != null ? "SCHEDULE" : "CUSTOM");
    }, [head, charged]);

    const finalAmount = source === "SCHEDULE" ? head?.amount ?? null : /^\d+$/.test(amount) && Number(amount) >= 1 ? Number(amount) : null;

    const submit = async () => {
        if (!head || months.length === 0 || finalAmount == null) {
            toast.error(!head ? "Pick a head" : months.length === 0 ? "Pick at least one month" : "Give the amount in whole rupees");
            return;
        }
        setBusy(true);
        try {
            const res = await ecFeesService.saveStudentCharges(
                cc,
                year,
                months.map((m) => ({ fee_head_id: head.fee_head_id, target_month: m, amount: finalAmount, source })),
            );
            toast.success(`${res.created} charge${res.created === 1 ? "" : "s"} added`);
            onDone();
        } catch (err) {
            toast.error(ecErrMsg(err, "Couldn't add the head"));
        } finally {
            setBusy(false);
        }
    };

    return (
        <EcModal
            open
            title={`Add a head for ${year}`}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className={ecSecondaryButton} onClick={onClose} disabled={busy}>
                        Cancel
                    </button>
                    <button type="button" className={ecPrimaryButton} onClick={submit} disabled={busy || !head}>
                        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Add {months.length} month{months.length === 1 ? "" : "s"}
                    </button>
                </>
            }
        >
            {options == null ? (
                <div className="py-6 text-center text-zinc-400">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                </div>
            ) : options.length === 0 ? (
                <p className="text-sm text-zinc-500">There are no active extracurricular heads. Add one on Fee Heads first.</p>
            ) : (
                <>
                    <EcField label="Head" htmlFor="ec-add-head">
                        <select id="ec-add-head" value={headId} onChange={(e) => setHeadId(e.target.value ? Number(e.target.value) : "")} className={ecInputClass}>
                            <option value="">Pick a head…</option>
                            {options.map((o) => (
                                <option key={o.fee_head_id} value={o.fee_head_id}>
                                    {o.name}
                                    {o.amount != null ? ` (class amount ${ecRs(o.amount)})` : ""}
                                </option>
                            ))}
                        </select>
                    </EcField>
                    {head && (
                        <>
                            <EcField label="Months" hint={charged.size ? "Months already charged are not shown." : undefined}>
                                <div className="flex flex-wrap gap-1.5">
                                    {head.months
                                        .filter((m) => !charged.has(m))
                                        .map((m) => {
                                            const on = months.includes(m);
                                            return (
                                                <button
                                                    key={m}
                                                    type="button"
                                                    aria-pressed={on}
                                                    onClick={() => head.frequency !== "ONE_TIME" && setMonths((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]))}
                                                    className={`h-8 px-3 rounded-lg text-xs font-semibold border ${
                                                        on ? "bg-orange-600 border-orange-600 text-white" : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300"
                                                    }`}
                                                >
                                                    {ecMonthShort(m)}
                                                </button>
                                            );
                                        })}
                                    {head.months.every((m) => charged.has(m)) && <span className="text-sm text-zinc-500">Every month of this head is already charged.</span>}
                                </div>
                            </EcField>
                            <EcField label="Amount">
                                <div className="space-y-2">
                                    <label className={`flex items-center gap-2 text-sm ${head.amount == null ? "opacity-50" : "cursor-pointer"}`}>
                                        <input type="radio" name="ec-add-source" disabled={head.amount == null} checked={source === "SCHEDULE"} onChange={() => setSource("SCHEDULE")} />
                                        Class amount {head.amount != null ? ecRs(head.amount) : "(none set for this class)"}
                                    </label>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="radio" name="ec-add-source" checked={source === "CUSTOM"} onChange={() => setSource("CUSTOM")} />
                                        A different amount
                                    </label>
                                    {source === "CUSTOM" && (
                                        <EcField label="Amount per month" unit="Rs" htmlFor="ec-add-amount">
                                            <input id="ec-add-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} className={`${ecInputClass} w-48`} placeholder="e.g. 2500" />
                                        </EcField>
                                    )}
                                </div>
                            </EcField>
                            {finalAmount != null && months.length > 0 && (
                                <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                                    <Layers className="h-3.5 w-3.5" /> {months.length} × {ecRs(finalAmount)} = {ecRs(months.length * finalAmount)}
                                </p>
                            )}
                        </>
                    )}
                </>
            )}
        </EcModal>
    );
}
