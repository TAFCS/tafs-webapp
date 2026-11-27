"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { ecFeesService } from "@/lib/ec-fees.service";
import {
    EC_LOCK_REASON_LABEL,
    EC_SKIP_REASON_LABEL,
    ecErrMsg,
    ecMonthShort,
    ecRs,
    type EcAmountSource,
    type EcBulkAssignPreview,
    type EcBulkRemovePreview,
    type EcFeeHeadOption,
} from "@/lib/ec-fees.types";
import { EcBulkTargetPicker, emptyTarget, targetToApi, type EcTargetState } from "./EcBulkTargetPicker";
import { EcField, EcModal, ecInputClass, ecPrimaryButton, ecSecondaryButton } from "./ui";

function MonthChips({ months, selected, onToggle }: { months: number[]; selected: number[]; onToggle: (m: number) => void }) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {months.map((m) => {
                const on = selected.includes(m);
                return (
                    <button
                        key={m}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onToggle(m)}
                        className={`h-8 px-3 rounded-lg text-xs font-semibold border ${
                            on ? "bg-orange-600 border-orange-600 text-white" : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300"
                        }`}
                    >
                        {ecMonthShort(m)}
                    </button>
                );
            })}
        </div>
    );
}

function HeadAndYear({
    heads,
    years,
    headId,
    year,
    onHead,
    onYear,
}: {
    heads: EcFeeHeadOption[];
    years: string[];
    headId: number | "";
    year: string;
    onHead: (id: number | "") => void;
    onYear: (y: string) => void;
}) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <EcField label="Head" htmlFor="ec-bulk-head">
                <select id="ec-bulk-head" value={headId} onChange={(e) => onHead(e.target.value ? Number(e.target.value) : "")} className={ecInputClass}>
                    <option value="">Pick a head…</option>
                    {heads.map((h) => (
                        <option key={h.id} value={h.id}>
                            {h.name}
                        </option>
                    ))}
                </select>
            </EcField>
            <EcField label="Academic year" htmlFor="ec-bulk-year">
                <select id="ec-bulk-year" value={year} onChange={(e) => onYear(e.target.value)} className={ecInputClass}>
                    {years.map((y) => (
                        <option key={y} value={y}>
                            {y}
                        </option>
                    ))}
                </select>
            </EcField>
        </div>
    );
}

/**
 * TAFSD-605: charge one extracurricular head to many students. Always previews
 * first; months a student already has are skipped, so running it twice is safe.
 */
export function EcBulkAssignDialog({
    heads,
    years,
    defaultYear,
    onClose,
    onDone,
}: {
    heads: EcFeeHeadOption[];
    years: string[];
    defaultYear: string;
    onClose: () => void;
    onDone: () => void;
}) {
    const [headId, setHeadId] = useState<number | "">("");
    const [year, setYear] = useState(defaultYear);
    const [months, setMonths] = useState<number[]>([]);
    const [source, setSource] = useState<EcAmountSource>("SCHEDULE");
    const [amount, setAmount] = useState("");
    const [target, setTarget] = useState<EcTargetState>(emptyTarget);
    const [preview, setPreview] = useState<EcBulkAssignPreview | null>(null);
    const [busy, setBusy] = useState<"preview" | "apply" | null>(null);

    const head = heads.find((h) => h.id === headId) ?? null;
    useEffect(() => setMonths(head?.months ?? []), [head]);
    useEffect(() => setPreview(null), [headId, year, months, source, amount, target]);

    const input = useMemo(() => {
        const t = targetToApi(target);
        if (!head || !t || months.length === 0) return null;
        if (source === "CUSTOM" && !(/^\d+$/.test(amount) && Number(amount) >= 1)) return null;
        return { ...t, fee_head_id: head.id, academic_year: year, months, amount_source: source, ...(source === "CUSTOM" ? { amount: Number(amount) } : {}) };
    }, [head, target, months, source, amount, year]);

    const runPreview = async () => {
        if (!input) {
            toast.error(!head ? "Pick a head" : months.length === 0 ? "Pick at least one month" : source === "CUSTOM" && !amount ? "Give the amount" : "Pick the students");
            return;
        }
        setBusy("preview");
        try {
            setPreview(await ecFeesService.bulkAssignPreview(input));
        } catch (err) {
            toast.error(ecErrMsg(err, "Couldn't preview"));
        } finally {
            setBusy(null);
        }
    };

    const apply = async () => {
        if (!input) return;
        setBusy("apply");
        try {
            const res = await ecFeesService.bulkAssign(input);
            toast.success(`${res.created} charge${res.created === 1 ? "" : "s"} added for ${res.students_to_charge} student${res.students_to_charge === 1 ? "" : "s"}`);
            onDone();
        } catch (err) {
            toast.error(ecErrMsg(err, "Couldn't add the charges"));
        } finally {
            setBusy(null);
        }
    };

    return (
        <EcModal
            open
            wide
            title="Bulk assign an extracurricular head"
            subtitle="Charges a head to many students. Months a student already has are skipped."
            onClose={onClose}
            footer={
                <>
                    <button type="button" className={ecSecondaryButton} onClick={onClose} disabled={!!busy}>
                        Close
                    </button>
                    <button type="button" className={ecSecondaryButton} onClick={runPreview} disabled={!!busy}>
                        {busy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Preview
                    </button>
                    <button type="button" className={ecPrimaryButton} onClick={apply} disabled={!preview || preview.charges_to_create === 0 || !!busy}>
                        {busy === "apply" && <Loader2 className="h-4 w-4 animate-spin" />}
                        {preview ? `Add ${preview.charges_to_create} charge${preview.charges_to_create === 1 ? "" : "s"}` : "Add charges"}
                    </button>
                </>
            }
        >
            <HeadAndYear heads={heads} years={years} headId={headId} year={year} onHead={setHeadId} onYear={setYear} />
            {head && (
                <EcField label="Months to charge" hint={head.frequency === "ONE_TIME" ? "A one-time head is charged in its one month." : "Untick a month to leave it out."}>
                    <MonthChips months={head.months} selected={months} onToggle={(m) => head.frequency !== "ONE_TIME" && setMonths((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]))} />
                </EcField>
            )}
            <EcField label="Amount">
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="ec-amount-source" checked={source === "SCHEDULE"} onChange={() => setSource("SCHEDULE")} />
                        Each student&apos;s class amount (from Class Amounts)
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="ec-amount-source" checked={source === "CUSTOM"} onChange={() => setSource("CUSTOM")} />
                        One amount for everyone
                    </label>
                    {source === "CUSTOM" && (
                        <EcField label="Amount per month" unit="Rs" htmlFor="ec-bulk-amount">
                            <input id="ec-bulk-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} className={`${ecInputClass} w-48`} placeholder="e.g. 2500" />
                        </EcField>
                    )}
                </div>
            </EcField>
            <EcField label="Students">
                <EcBulkTargetPicker value={target} onChange={setTarget} />
            </EcField>

            {preview && (
                <div className="space-y-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <Summary label="Students matched" value={preview.students_matched} />
                        <Summary label="Students to charge" value={preview.students_to_charge} />
                        <Summary label="Charges to add" value={preview.charges_to_create} />
                        <Summary label="Total" value={ecRs(preview.total_amount)} />
                    </div>
                    {preview.students_requested != null && preview.students_requested > preview.students_matched && (
                        <p className="text-xs text-amber-600">
                            {preview.students_requested - preview.students_matched} of the C.C.s you gave are not enrolled students you can see, and are left out.
                        </p>
                    )}
                    {(preview.skipped.already_charged > 0 || preview.skipped.no_class_amount > 0 || preview.skipped.no_class > 0) && (
                        <p className="text-xs text-zinc-500">
                            Skipped: {preview.skipped.already_charged} already charged · {preview.skipped.no_class_amount} without a class amount · {preview.skipped.no_class} not in a class
                        </p>
                    )}
                    <PreviewTable
                        head={["Student", "Class", "Amount", "Months to add", "Note"]}
                        rows={preview.rows.map((r) => [
                            <StudentCell key="s" name={r.full_name} cc={r.cc} gr={r.gr_number} />,
                            [r.class_name, r.section_name].filter(Boolean).join(" ") || "—",
                            r.amount == null ? "—" : ecRs(r.amount),
                            r.months_to_create.map(ecMonthShort).join(", ") || "—",
                            r.skip_reason ? <span key="n" className="text-zinc-400">{EC_SKIP_REASON_LABEL[r.skip_reason]}</span> : "",
                        ])}
                        truncated={preview.rows_truncated}
                    />
                </div>
            )}
        </EcModal>
    );
}

/**
 * TAFSD-605: take one extracurricular head off many students. Only charges not
 * yet on a voucher are removed; the rest are listed with the reason.
 */
export function EcBulkRemoveDialog({
    heads,
    years,
    defaultYear,
    onClose,
    onDone,
}: {
    heads: EcFeeHeadOption[];
    years: string[];
    defaultYear: string;
    onClose: () => void;
    onDone: () => void;
}) {
    const [headId, setHeadId] = useState<number | "">("");
    const [year, setYear] = useState(defaultYear);
    const [months, setMonths] = useState<number[]>([]);
    const [target, setTarget] = useState<EcTargetState>(emptyTarget);
    const [preview, setPreview] = useState<EcBulkRemovePreview | null>(null);
    const [busy, setBusy] = useState<"preview" | "apply" | null>(null);

    const head = heads.find((h) => h.id === headId) ?? null;
    useEffect(() => setMonths([]), [headId]);
    useEffect(() => setPreview(null), [headId, year, months, target]);

    const input = useMemo(() => {
        const t = targetToApi(target);
        if (!head || !t) return null;
        return { ...t, fee_head_id: head.id, academic_year: year, months };
    }, [head, target, year, months]);

    const runPreview = async () => {
        if (!input) {
            toast.error(!head ? "Pick a head" : "Pick the students");
            return;
        }
        setBusy("preview");
        try {
            setPreview(await ecFeesService.bulkRemovePreview(input));
        } catch (err) {
            toast.error(ecErrMsg(err, "Couldn't preview"));
        } finally {
            setBusy(null);
        }
    };

    const apply = async () => {
        if (!input) return;
        setBusy("apply");
        try {
            const res = await ecFeesService.bulkRemove(input);
            toast.success(`${res.removed} charge${res.removed === 1 ? "" : "s"} removed`);
            onDone();
        } catch (err) {
            toast.error(ecErrMsg(err, "Couldn't remove the charges"));
        } finally {
            setBusy(null);
        }
    };

    return (
        <EcModal
            open
            wide
            title="Bulk remove an extracurricular head"
            subtitle="Only charges not yet on a voucher are removed."
            onClose={onClose}
            footer={
                <>
                    <button type="button" className={ecSecondaryButton} onClick={onClose} disabled={!!busy}>
                        Close
                    </button>
                    <button type="button" className={ecSecondaryButton} onClick={runPreview} disabled={!!busy}>
                        {busy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Preview
                    </button>
                    <button
                        type="button"
                        className={ecPrimaryButton.replace("bg-orange-600", "bg-rose-600").replace("hover:bg-orange-700", "hover:bg-rose-700")}
                        onClick={apply}
                        disabled={!preview || preview.charges_to_remove === 0 || !!busy}
                    >
                        {busy === "apply" && <Loader2 className="h-4 w-4 animate-spin" />}
                        {preview ? `Remove ${preview.charges_to_remove} charge${preview.charges_to_remove === 1 ? "" : "s"}` : "Remove charges"}
                    </button>
                </>
            }
        >
            <HeadAndYear heads={heads} years={years} headId={headId} year={year} onHead={setHeadId} onYear={setYear} />
            {head && (
                <EcField label="Months to remove" hint="None picked means every month of the year.">
                    <MonthChips months={head.months} selected={months} onToggle={(m) => setMonths((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]))} />
                </EcField>
            )}
            <EcField label="Students">
                <EcBulkTargetPicker value={target} onChange={setTarget} />
            </EcField>

            {preview && (
                <div className="space-y-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <Summary label="Students matched" value={preview.students_matched} />
                        <Summary label="Charges to remove" value={preview.charges_to_remove} />
                        <Summary label="Amount removed" value={ecRs(preview.amount_to_remove)} />
                        <Summary label="Kept (locked)" value={preview.locked} />
                    </div>
                    {preview.locked > 0 && (
                        <p className="text-xs text-zinc-500">
                            Kept because they are {preview.locked_by_reason.ON_VOUCHER} on a voucher · {preview.locked_by_reason.PAID} paid · {preview.locked_by_reason.WAIVED} waived.
                            Change those through their vouchers.
                        </p>
                    )}
                    <PreviewTable
                        head={["Student", "Class", "Removing", "Kept"]}
                        rows={preview.rows.map((r) => [
                            <StudentCell key="s" name={r.full_name} cc={r.cc} gr={r.gr_number} />,
                            [r.class_name, r.section_name].filter(Boolean).join(" ") || "—",
                            r.removable.join(", ") || "—",
                            r.locked.length
                                ? r.locked.map((l) => `${l.period} (${EC_LOCK_REASON_LABEL[l.reason]}${l.voucher_number ? ` ${l.voucher_number}` : ""})`).join(", ")
                                : "—",
                        ])}
                        truncated={preview.rows_truncated}
                    />
                </div>
            )}
        </EcModal>
    );
}

function Summary({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">{label}</div>
            <div className="text-base font-black text-zinc-900 dark:text-zinc-100">{value}</div>
        </div>
    );
}

function StudentCell({ name, cc, gr }: { name: string | null; cc: number; gr: string | null }) {
    return (
        <div>
            <div className="font-medium text-zinc-800 dark:text-zinc-100">{name ?? `Student ${cc}`}</div>
            <div className="text-[11px] text-zinc-400">
                C.C. {cc}
                {gr ? ` · G.R. ${gr}` : ""}
            </div>
        </div>
    );
}

function PreviewTable({ head, rows, truncated }: { head: string[]; rows: React.ReactNode[][]; truncated: boolean }) {
    return (
        <div className="max-h-72 overflow-auto rounded-xl border border-zinc-100 dark:border-zinc-900">
            <table className="w-full text-xs">
                <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900">
                    <tr className="text-left text-zinc-500">
                        {head.map((h) => (
                            <th key={h} className="py-2 px-3 font-medium">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td colSpan={head.length} className="py-6 text-center text-zinc-400">
                                No students match.
                            </td>
                        </tr>
                    ) : (
                        rows.map((r, i) => (
                            <tr key={i} className="border-t border-zinc-100 dark:border-zinc-900">
                                {r.map((c, j) => (
                                    <td key={j} className="py-2 px-3 align-top">
                                        {c}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
            {truncated && <div className="px-3 py-2 text-[11px] text-zinc-400">Showing the first 300 students. All of them are included when you apply.</div>}
        </div>
    );
}
