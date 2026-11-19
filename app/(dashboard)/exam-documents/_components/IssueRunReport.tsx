"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, History, Loader2, Printer, RotateCcw, X, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import {
    GAP_LABELS,
    SKIP_LABELS,
    downloadBlob,
    examDocumentsService,
    type IssueRun,
    type IssueRunSummary,
    type RunOutcome,
    type RunStudent,
    type SkipCode,
} from "@/lib/exam-documents.service";
import { errMsg, fmtDate, rs, when } from "./format";

/**
 * TAFSD-543: the report of one Issue run. Who got a document, who was reprinted,
 * and every student who got none, with the reason, so staff can chase the dues
 * or fix the record. Kept on the server, so it can be opened again from Past runs.
 */

const OUTCOMES: { id: RunOutcome; label: string }[] = [
    { id: "SKIPPED", label: "Not generated" },
    { id: "ISSUED", label: "Issued" },
    { id: "REPRINTED", label: "Reprinted" },
];

const SKIP_ORDER: SkipCode[] = ["DUES_NOT_CLEARED", "NOT_BILLED", "ALREADY_ISSUED", "NOT_ENROLLED", "OTHER_CAMPUS", "CLASS_NOT_ON_SCHEDULE", "NOT_FOUND"];

const SKIP_TONE: Record<SkipCode, string> = {
    DUES_NOT_CLEARED: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
    NOT_BILLED: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
    ALREADY_ISSUED: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
    NOT_ENROLLED: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    OTHER_CAMPUS: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    CLASS_NOT_ON_SCHEDULE: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    NOT_FOUND: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function Shell({ title, sub, onClose, children, footer }: { title: React.ReactNode; sub?: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="min-w-0">
                        <p className="font-bold text-zinc-900 dark:text-zinc-100">{title}</p>
                        {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
                    </div>
                    <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200" aria-label="Close">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
                {footer && <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3 border-t border-zinc-100 dark:border-zinc-800">{footer}</div>}
            </div>
        </div>
    );
}

function Stat({ icon, value, label, tone }: { icon: React.ReactNode; value: number; label: string; tone: string }) {
    return (
        <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${tone}`}>
            {icon}
            <div>
                <p className="text-lg font-bold leading-none">{value.toLocaleString()}</p>
                <p className="text-[11px] font-semibold mt-1 opacity-80">{label}</p>
            </div>
        </div>
    );
}

function ResultCell({ r }: { r: RunStudent }) {
    if (r.outcome === "SKIPPED" && r.reason_code) {
        return <span className={`inline-flex text-[11px] font-semibold rounded-md px-1.5 py-0.5 whitespace-nowrap ${SKIP_TONE[r.reason_code]}`}>{SKIP_LABELS[r.reason_code]}</span>;
    }
    return (
        <span className="inline-flex text-[11px] font-semibold rounded-md px-1.5 py-0.5 whitespace-nowrap bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            {r.outcome === "ISSUED" ? "Issued" : "Reprinted"} #{r.serial}
        </span>
    );
}

/** One run's report. Opens on the students who got nothing when there are any. */
export function IssueRunReportModal({ scheduleId, runId, onClose, onBack }: { scheduleId: number; runId: number; onClose: () => void; onBack?: () => void }) {
    const [run, setRun] = useState<IssueRun | null>(null);
    const [failed, setFailed] = useState<string | null>(null);
    const [outcomes, setOutcomes] = useState<RunOutcome[]>([]);
    const [reasons, setReasons] = useState<SkipCode[]>([]);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        let live = true;
        examDocumentsService
            .getRun(scheduleId, runId)
            .then((r) => {
                if (!live) return;
                setRun(r);
                if (r.counts.skipped > 0) setOutcomes(["SKIPPED"]);
            })
            .catch((err) => live && setFailed(errMsg(err, "Could not load the report")));
        return () => {
            live = false;
        };
    }, [scheduleId, runId]);

    const byReason = useMemo(() => {
        const m = new Map<SkipCode, number>();
        for (const s of run?.students ?? []) if (s.reason_code) m.set(s.reason_code, (m.get(s.reason_code) ?? 0) + 1);
        return SKIP_ORDER.filter((c) => m.has(c)).map((c) => ({ code: c, n: m.get(c)! }));
    }, [run]);

    // Empty means all (Rule 1). A reason filter only narrows the skipped students.
    const rows = useMemo(
        () =>
            (run?.students ?? []).filter(
                (s) => (!outcomes.length || outcomes.includes(s.outcome)) && (!reasons.length || (s.reason_code != null && reasons.includes(s.reason_code))),
            ),
        [run, outcomes, reasons],
    );

    const exportXlsx = async () => {
        setExporting(true);
        try {
            const out = await examDocumentsService.exportRun(scheduleId, runId);
            downloadBlob(out.blob, out.filename);
        } catch (err) {
            toast.error(errMsg(err, "Could not export the report"));
        } finally {
            setExporting(false);
        }
    };

    const c = run?.counts;
    return (
        <Shell
            onClose={onClose}
            title={<>Issue report{run ? ` · ${run.label}` : ""}</>}
            sub={run ? `Run #${run.id} by ${run.created_by}, ${when(run.created_at)}` : undefined}
            footer={
                <>
                    {onBack && (
                        <button type="button" onClick={onBack} className="mr-auto inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-sm font-semibold text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900">
                            <History className="h-4 w-4" /> All runs
                        </button>
                    )}
                    <button
                        type="button"
                        disabled={!run || exporting}
                        onClick={exportXlsx}
                        className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-50"
                    >
                        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Download Excel
                    </button>
                    <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl text-sm font-semibold bg-primary text-white">
                        Done
                    </button>
                </>
            }
        >
            {failed ? (
                <p className="text-sm text-red-600">{failed}</p>
            ) : !run || !c ? (
                <div className="flex items-center gap-2 text-sm text-zinc-500 py-10 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading the report…
                </div>
            ) : (
                <div className="space-y-4">
                    {run.error && (
                        <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
                            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {run.error}
                        </div>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Stat icon={<CheckCircle2 className="h-5 w-5" />} value={c.issued} label="Issued" tone="bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300" />
                        <Stat icon={<RotateCcw className="h-5 w-5" />} value={c.reprinted} label="Reprinted" tone="bg-sky-50 text-sky-800 dark:bg-sky-950/30 dark:text-sky-300" />
                        <Stat icon={<XCircle className="h-5 w-5" />} value={c.skipped} label="Not generated" tone="bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300" />
                        <Stat icon={<AlertTriangle className="h-5 w-5" />} value={c.with_gaps} label="Printed with missing details" tone="bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300" />
                    </div>
                    {run.hidden > 0 && (
                        <p className="text-xs text-zinc-500">{run.hidden} more student{run.hidden === 1 ? " was" : "s were"} in this run but {run.hidden === 1 ? "is" : "are"} outside your access.</p>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5">
                        {OUTCOMES.map((o) => (
                            <button
                                key={o.id}
                                type="button"
                                onClick={() => setOutcomes((p) => toggle(p, o.id))}
                                className={`h-8 px-3 rounded-lg text-xs font-semibold border ${
                                    outcomes.includes(o.id) ? "bg-primary text-white border-primary" : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                                }`}
                            >
                                {o.label} ({o.id === "SKIPPED" ? c.skipped : o.id === "ISSUED" ? c.issued : c.reprinted})
                            </button>
                        ))}
                        {byReason.length > 0 && <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />}
                        {byReason.map((r) => (
                            <button
                                key={r.code}
                                type="button"
                                onClick={() => setReasons((p) => toggle(p, r.code))}
                                className={`h-8 px-2.5 rounded-lg text-xs font-semibold ${SKIP_TONE[r.code]} ${reasons.includes(r.code) ? "ring-2 ring-offset-1 ring-current dark:ring-offset-zinc-950" : "opacity-80 hover:opacity-100"}`}
                            >
                                {SKIP_LABELS[r.code]} · {r.n}
                            </button>
                        ))}
                        {(outcomes.length > 0 || reasons.length > 0) && (
                            <button type="button" onClick={() => (setOutcomes([]), setReasons([]))} className="h-8 px-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                                Show all
                            </button>
                        )}
                    </div>

                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500 bg-zinc-50 dark:bg-zinc-900/60">
                                    <th className="px-3 py-2 font-semibold">Student</th>
                                    <th className="px-3 py-2 font-semibold">Class</th>
                                    <th className="px-3 py-2 font-semibold">Result</th>
                                    <th className="px-3 py-2 font-semibold">Why / details</th>
                                    <th className="px-3 py-2 font-semibold text-right">Owed</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.cc} className="border-t border-zinc-100 dark:border-zinc-800/60 align-top">
                                        <td className="px-3 py-2.5">
                                            <p className="font-semibold text-zinc-900 dark:text-zinc-100">{r.name}</p>
                                            <p className="text-xs text-zinc-500">
                                                C.C. {r.cc}
                                                {r.gr ? ` · G.R. ${r.gr}` : ""}
                                            </p>
                                        </td>
                                        <td className="px-3 py-2.5 whitespace-nowrap text-zinc-700 dark:text-zinc-300">{r.class ? `${r.class}${r.section ? ` – ${r.section}` : ""}` : "—"}</td>
                                        <td className="px-3 py-2.5">
                                            <ResultCell r={r} />
                                        </td>
                                        <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400 max-w-md">
                                            {r.reason ?? (r.fee_date ? <span className="text-xs">Cleared through {fmtDate(r.fee_date)}</span> : null)}
                                            {r.gaps.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {r.gaps.map((g) => (
                                                        <span key={g} className="text-[10px] font-semibold rounded px-1.5 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                                                            Printed with: {GAP_LABELS[g].toLowerCase()}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5 text-right whitespace-nowrap font-medium text-zinc-900 dark:text-zinc-100">{r.owed ? rs(r.owed) : ""}</td>
                                    </tr>
                                ))}
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-3 py-8 text-center text-sm text-zinc-500">
                                            No students match these filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </Shell>
    );
}

/** Every Issue run on the schedule, newest first. */
export function IssueRunsModal({ scheduleId, onOpen, onClose }: { scheduleId: number; onOpen: (runId: number) => void; onClose: () => void }) {
    const [runs, setRuns] = useState<IssueRunSummary[] | null>(null);
    useEffect(() => {
        examDocumentsService
            .listRuns(scheduleId)
            .then(setRuns)
            .catch((err) => {
                toast.error(errMsg(err, "Could not load past runs"));
                setRuns([]);
            });
    }, [scheduleId]);

    return (
        <Shell onClose={onClose} title="Past issue runs" sub="Each time documents are issued, the report of who was left out and why is kept here.">
            {!runs ? (
                <div className="flex items-center gap-2 text-sm text-zinc-500 py-10 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
            ) : runs.length === 0 ? (
                <p className="text-sm text-zinc-500 py-10 text-center">No documents have been issued from this schedule yet.</p>
            ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {runs.map((r) => (
                        <li key={r.id}>
                            <button type="button" onClick={() => onOpen(r.id)} className="w-full text-left flex flex-wrap items-center gap-x-4 gap-y-1 py-3 px-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900">
                                <Printer className="h-4 w-4 text-zinc-400 shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">{r.label}</p>
                                    <p className="text-xs text-zinc-500">
                                        {when(r.created_at)} · {r.created_by}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
                                    <span className="rounded-md px-1.5 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">{r.issued} issued</span>
                                    {r.reprinted > 0 && <span className="rounded-md px-1.5 py-0.5 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400">{r.reprinted} reprinted</span>}
                                    <span
                                        className={`rounded-md px-1.5 py-0.5 ${r.skipped ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"}`}
                                    >
                                        {r.skipped} not generated
                                    </span>
                                    {r.error && <span className="rounded-md px-1.5 py-0.5 bg-red-600 text-white">PDF failed</span>}
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </Shell>
    );
}
