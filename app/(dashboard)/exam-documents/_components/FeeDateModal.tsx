"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Loader2, RotateCcw, X } from "lucide-react";
import toast from "react-hot-toast";
import { examDocumentsService, type FeeDateOptions, type FeeDatePreview } from "@/lib/exam-documents.service";
import { errMsg, fmtDate, rs } from "./format";

/**
 * Pick a fee date: for the whole schedule (mode "schedule") or for selected
 * students (mode "students"). Lists the fee dates the schedule's students are
 * billed on, with how much of each was never put on a voucher, and previews
 * who would be cleared before anything is saved.
 */
export function FeeDateModal({
    scheduleId,
    scheduleFeeDate,
    mode,
    studentIds,
    previewIds,
    initialDate,
    onClose,
    onSaved,
}: {
    scheduleId: number;
    scheduleFeeDate: string;
    mode: "schedule" | "students";
    /** Students to change (mode "students"). */
    studentIds: number[];
    /** Students to preview against. In "schedule" mode, those on the schedule's date. */
    previewIds: number[];
    initialDate?: string;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [options, setOptions] = useState<FeeDateOptions | null>(null);
    const [date, setDate] = useState(initialDate ?? scheduleFeeDate);
    const [reset, setReset] = useState(false);
    const [reason, setReason] = useState("");
    const [preview, setPreview] = useState<FeeDatePreview | null>(null);
    const [previewing, setPreviewing] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        examDocumentsService.feeDateOptions(scheduleId).then(setOptions).catch(() => setOptions({ schedule_fee_date: null, students: 0, options: [] }));
    }, [scheduleId]);

    // Picking the schedule's own date for students is the same as putting them back on it.
    const backToSchedule = mode === "students" && (reset || date === scheduleFeeDate);
    const effective = reset ? scheduleFeeDate : date;
    const ids = mode === "students" ? studentIds : previewIds;

    useEffect(() => {
        if (!effective || !ids.length) {
            setPreview(null);
            return;
        }
        let live = true;
        setPreviewing(true);
        const t = setTimeout(() => {
            examDocumentsService
                .previewFeeDate(scheduleId, ids, effective)
                .then((p) => live && setPreview(p))
                .catch(() => live && setPreview(null))
                .finally(() => live && setPreviewing(false));
        }, 250);
        return () => {
            live = false;
            clearTimeout(t);
        };
        // ids is rebuilt each render; its contents only change with the selection.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scheduleId, effective, ids.join(",")]);

    const listed = options?.options ?? [];

    const unchanged = mode === "schedule" ? date === scheduleFeeDate : false;

    const save = async () => {
        if (!effective) return toast.error("Choose a fee date");
        setSaving(true);
        try {
            if (mode === "schedule") {
                await examDocumentsService.setScheduleFeeDate(scheduleId, date);
                toast.success(`Fee date is now ${fmtDate(date)}`);
            } else {
                const out = await examDocumentsService.setStudentFeeDates(scheduleId, studentIds, backToSchedule ? null : date, reason);
                toast.success(
                    [
                        `${out.updated} student${out.updated === 1 ? "" : "s"} ${backToSchedule ? "back on the schedule's date" : `now checked against ${fmtDate(date)}`}`,
                        out.skipped_issued ? `${out.skipped_issued} already issued, unchanged` : "",
                    ]
                        .filter(Boolean)
                        .join(" · "),
                );
            }
            onSaved();
        } catch (err) {
            toast.error(errMsg(err, "Could not save the fee date"));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div
                className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-5 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <CalendarClock className="h-5 w-5 text-primary" />
                            {mode === "schedule"
                                ? "Change the schedule's fee date"
                                : `Change the fee date for ${studentIds.length} student${studentIds.length === 1 ? "" : "s"}`}
                        </p>
                        <p className="text-sm text-zinc-500 mt-1">
                            Every fee head dated <b>on or before</b> this date must be paid before a document is issued. Heads are dated the 1st of each month, so{" "}
                            <i>1 Dec</i> means &ldquo;through December&rdquo;.
                            {mode === "schedule" ? " Students given their own date keep it." : ""}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-700">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {mode === "students" && (
                    <button
                        type="button"
                        onClick={() => setReset((r) => !r)}
                        className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm ${
                            reset ? "border-primary bg-primary/5" : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                        }`}
                    >
                        <RotateCcw className="h-4 w-4 text-zinc-500" />
                        <span className="flex-1">
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">Use the schedule&apos;s date</span>
                            <span className="text-zinc-500"> · {fmtDate(scheduleFeeDate)}</span>
                        </span>
                        {reset && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </button>
                )}

                <div className={reset ? "opacity-40 pointer-events-none" : ""}>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] ml-1 mb-1.5">Fee dates these students are billed on</p>
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800 max-h-64 overflow-y-auto">
                        {!options ? (
                            <div className="py-6 text-center text-zinc-400">
                                <Loader2 className="h-4 w-4 animate-spin inline" />
                            </div>
                        ) : listed.length === 0 ? (
                            <p className="py-4 px-3 text-sm text-zinc-500">No fee heads found for these classes.</p>
                        ) : (
                            listed.map((o) => {
                                const on = date === o.fee_date;
                                const billedPct = o.heads ? Math.round(((o.heads - o.not_billed) / o.heads) * 100) : 100;
                                return (
                                    <button
                                        key={o.fee_date}
                                        type="button"
                                        onClick={() => setDate(o.fee_date)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm ${on ? "bg-primary/5" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"}`}
                                    >
                                        <span className={`h-4 w-4 rounded-full border-2 shrink-0 ${on ? "border-primary bg-primary" : "border-zinc-300 dark:border-zinc-600"}`} />
                                        <span className="w-28 font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">{o.label}</span>
                                        <span className="flex-1 text-xs text-zinc-500">
                                            {o.not_billed > 0 ? (
                                                <span className="text-amber-700 dark:text-amber-400 font-semibold">
                                                    {o.not_billed === o.heads ? "Not billed yet" : `${o.not_billed.toLocaleString()} of ${o.heads.toLocaleString()} heads not billed`}
                                                </span>
                                            ) : (
                                                <span>All billed</span>
                                            )}
                                            {` · ${o.unpaid_students.toLocaleString()} of ${o.students.toLocaleString()} students unpaid`}
                                        </span>
                                        <span className="w-16 h-1.5 rounded-full bg-amber-200 dark:bg-amber-900/50 overflow-hidden shrink-0" title={`${billedPct}% billed`}>
                                            <span className="block h-full bg-emerald-500" style={{ width: `${billedPct}%` }} />
                                        </span>
                                        {o.fee_date === scheduleFeeDate && (
                                            <span className="text-[10px] font-bold uppercase text-primary shrink-0">schedule</span>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                    <label className="flex items-center gap-2 mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                        Or another date
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm"
                        />
                    </label>
                </div>

                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/60 px-4 py-3 text-sm min-h-[64px]">
                    {!ids.length ? (
                        <p className="text-zinc-500">No students to check.</p>
                    ) : previewing && !preview ? (
                        <p className="text-zinc-400 flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Checking…
                        </p>
                    ) : preview ? (
                        <div className={previewing ? "opacity-60" : ""}>
                            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                                Against {preview.fee_date_label}
                                {mode === "schedule" ? `, the ${preview.students.toLocaleString()} students on the schedule's date would be:` : ":"}
                            </p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{preview.counts.CLEARED.toLocaleString()} cleared</span>
                                <span className="text-amber-700 dark:text-amber-400 font-semibold">{preview.counts.NOT_BILLED.toLocaleString()} not billed</span>
                                <span className="text-red-600 dark:text-red-400 font-semibold">{preview.counts.BLOCKED.toLocaleString()} owe dues</span>
                                {preview.owed_total > 0 && <span className="text-zinc-500">{rs(preview.owed_total)} outstanding</span>}
                            </div>
                            {preview.skipped_issued > 0 && (
                                <p className="text-xs text-zinc-500 mt-1">
                                    {preview.skipped_issued} already issued: their document stays as it is.
                                </p>
                            )}
                        </div>
                    ) : null}
                </div>

                {mode === "students" && !backToSchedule && (
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] ml-1">Reason (recorded in the activity log)</span>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={2}
                            maxLength={500}
                            placeholder="e.g. December vouchers not issued yet for Sr I"
                            className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                )}

                {mode === "students" && !reset && date < scheduleFeeDate && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        An earlier date than the schedule&apos;s lets these students through with later months unpaid.
                    </p>
                )}

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl text-sm font-semibold border border-zinc-200 dark:border-zinc-800">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={save}
                        disabled={saving || unchanged || !effective}
                        className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold bg-primary text-white disabled:opacity-50"
                    >
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        {mode === "schedule" ? `Use ${effective ? fmtDate(effective) : "…"} for the schedule` : backToSchedule ? "Put back on the schedule's date" : `Save ${effective ? fmtDate(effective) : ""}`}
                    </button>
                </div>
            </div>
        </div>
    );
}
