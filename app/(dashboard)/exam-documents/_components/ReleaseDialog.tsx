"use client";

import { useState } from "react";
import { GraduationCap, Loader2, Megaphone, Send, Smartphone, X } from "lucide-react";
import toast from "react-hot-toast";
import { examDocumentsService, type ExamSchedule, type RosterRow } from "@/lib/exam-documents.service";
import { errMsg, fmtDate } from "./format";

/**
 * TAFSD-544: release issued documents to the parent app. Each family gets a
 * push and a document card on its Notice Board, with the optional message.
 * The preview shows the first student exactly as the parent will see them.
 */

const MAX = 300;

const titleCase = (t: string) =>
    t
        .trim()
        .split(/\s+/)
        .map((w) => (/^(?:[IVX]+|AS|A2|\d[\w-]*)$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
        .join(" ");

export function ReleaseDialog({
    schedule,
    rows,
    onClose,
    onDone,
}: {
    schedule: ExamSchedule;
    /** The students asked for: issued and unreleased ones go out, the rest are counted. */
    rows: RosterRow[];
    onClose: () => void;
    onDone: () => void;
}) {
    const [message, setMessage] = useState("");
    const [saving, setSaving] = useState(false);

    const toRelease = rows.filter((r) => r.document && !r.document.released_at);
    const already = rows.filter((r) => r.document?.released_at).length;
    const notIssued = rows.filter((r) => !r.document).length;
    const types = new Set(toRelease.map((r) => r.document!.doc_type));
    const noun = types.size > 1 ? "documents" : types.has("ADMIT_CARD") ? (toRelease.length === 1 ? "admit card" : "admit cards") : toRelease.length === 1 ? "statement of entry" : "statements of entry";
    const groups = [...new Set(toRelease.map((r) => `${r.class_name ?? ""}${r.section_name ? ` – ${r.section_name}` : ""}`))].filter(Boolean);
    const label = groups.length > 3 ? `${groups.slice(0, 3).join(", ")} and ${groups.length - 3} more` : groups.join(", ");

    const sample = toRelease[0];
    const sampleType = sample?.document?.doc_type ?? "STATEMENT_OF_ENTRY";
    const assessment = titleCase(schedule.title);
    const firstLine = message.trim().split("\n")[0]?.trim();
    const pushTitle = sampleType === "ADMIT_CARD" ? "Admit Card ready" : "Statement of Entry ready";
    const pushBody = sample
        ? `${sample.full_name}'s ${assessment} ${sampleType === "ADMIT_CARD" ? "admit card" : "statement of entry"} is in the app.${firstLine ? ` ${firstLine}` : ""}`
        : "";
    const firstPaper = schedule.papers
        ?.filter((p) => !sample || p.class_id === sample.class_id)
        .map((p) => p.paper_date)
        .sort()[0];

    const release = async () => {
        setSaving(true);
        try {
            const out = await examDocumentsService.release(
                schedule.id,
                toRelease.map((r) => r.cc),
                message,
            );
            const notes = [
                out.already_released ? `${out.already_released} already released` : "",
                out.no_family ? `${out.no_family} with no parent account` : "",
                out.not_issued ? `${out.not_issued} not issued` : "",
            ].filter(Boolean);
            if (out.no_family) {
                const names = out.students.filter((s) => s.outcome === "NO_FAMILY").map((s) => s.name);
                toast(`${out.released} released. No parent account linked for: ${names.slice(0, 5).join(", ")}${names.length > 5 ? ` and ${names.length - 5} more` : ""}.`, { icon: "⚠️", duration: 8000 });
            } else {
                toast.success(`${out.released} released to the app${notes.length ? ` (${notes.join(", ")})` : ""}`);
            }
            onDone();
        } catch (err) {
            toast.error(errMsg(err, "Could not release"));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="release-title"
                className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-5 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p id="release-title" className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <Smartphone className="h-5 w-5 text-primary" /> Release {toRelease.length} {noun}
                            {label ? `, ${label}` : ""}
                        </p>
                        <p className="text-sm text-zinc-500 mt-1">
                            {assessment} · {schedule.academic_year.replace("-", " – ")}. Each parent gets a notification, and the document appears on their Notice Board.
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-700" aria-label="Close">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 px-4 py-3 text-sm grid gap-1.5">
                    <div className="grid grid-cols-[8rem_1fr] gap-2">
                        <strong className="text-emerald-700 dark:text-emerald-400 tabular-nums">{toRelease.length} to release</strong>
                        <span className="text-zinc-500">Issued, not in the app yet</span>
                    </div>
                    {already > 0 && (
                        <div className="grid grid-cols-[8rem_1fr] gap-2">
                            <strong className="tabular-nums">{already} skipped</strong>
                            <span className="text-zinc-500">Already released. Parents keep the card they have.</span>
                        </div>
                    )}
                    {notIssued > 0 && (
                        <div className="grid grid-cols-[8rem_1fr] gap-2">
                            <strong className="text-amber-700 dark:text-amber-400 tabular-nums">{notIssued} not issued</strong>
                            <span className="text-zinc-500">Issue them first. They are left out of this release.</span>
                        </div>
                    )}
                </div>

                <div>
                    <label htmlFor="release-msg" className="block text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 mb-1.5 ml-1">
                        Message to parents (optional)
                    </label>
                    <textarea
                        id="release-msg"
                        rows={3}
                        maxLength={MAX}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="e.g. Please bring this to the exam hall every day"
                        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm resize-y"
                    />
                    <div className="flex justify-between gap-3 text-xs text-zinc-500 mt-1">
                        <span>Shown above the document and in the notification. Same text for all {toRelease.length}.</span>
                        <span className="tabular-nums">
                            {message.length} / {MAX}
                        </span>
                    </div>
                </div>

                {sample && (
                    <div>
                        <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 mb-1.5 ml-1">What the parent sees</span>
                        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 p-3.5 grid gap-3 justify-items-center">
                            <div className="w-full max-w-sm grid grid-cols-[30px_1fr] gap-2.5 rounded-2xl bg-white border border-[#BCD0EA] px-3 py-2.5 text-zinc-900">
                                <span className="h-[30px] w-[30px] rounded-lg bg-[#021A54] text-white grid place-items-center">
                                    <GraduationCap className="h-4 w-4" />
                                </span>
                                <div className="min-w-0">
                                    <div className="flex justify-between text-xs text-zinc-500">
                                        <span>TAFS</span>
                                        <span>now</span>
                                    </div>
                                    <b className="block text-[13.5px]">{pushTitle}</b>
                                    <p className="text-[13px] leading-snug">{pushBody}</p>
                                </div>
                            </div>

                            <article className="w-full max-w-sm rounded-xl border border-[#BCD0EA] bg-white text-[#021A54] overflow-hidden shadow-sm">
                                <div className="grid grid-cols-[34px_1fr_auto] gap-2.5 items-center px-3.5 py-3">
                                    <span className="h-[34px] w-[34px] rounded-lg bg-[#021A54]/[0.08] grid place-items-center">
                                        <Smartphone className="h-4 w-4" />
                                    </span>
                                    <div>
                                        <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#4C617F]">{sampleType === "ADMIT_CARD" ? "Admit card" : "Statement of entry"}</div>
                                        <div className="text-[13.5px] font-semibold leading-tight">{assessment}</div>
                                    </div>
                                    <div className="text-[11px] text-[#4C617F] text-right tabular-nums leading-tight">
                                        S. # {sample.document!.serial}
                                        <br />
                                        {schedule.academic_year.replace("-", " – ")}
                                    </div>
                                </div>
                                <div className="border-t-[1.5px] border-dashed border-[#BCD0EA]" />
                                <div className="px-3.5 py-3 space-y-2.5 bg-[#F1F5FB]">
                                    <div className="flex justify-between gap-2">
                                        <div>
                                            <b className="block text-base leading-tight">{sample.full_name}</b>
                                            <span className="text-xs text-[#4C617F]">
                                                {sample.class_name}
                                                {sample.section_name ? ` – ${sample.section_name}` : ""} · C.C. {sample.cc}
                                            </span>
                                        </div>
                                        <time className="text-[11px] text-[#021A54]/45">now</time>
                                    </div>
                                    {message.trim() && (
                                        <div className="flex gap-2 rounded-lg bg-[#BCD0EA]/30 px-2.5 py-2 text-[12.5px] leading-snug">
                                            <Megaphone className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                            <span className="line-clamp-2">{message.trim()}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center">
                                        <small className="text-[11.5px] text-[#4C617F]">{firstPaper ? `First paper ${fmtDate(firstPaper)}` : " "}</small>
                                        <span className="h-9 px-5 inline-flex items-center rounded-full bg-[#021A54] text-white text-[13px] font-semibold">View</span>
                                    </div>
                                </div>
                            </article>
                        </div>
                    </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-zinc-500 max-w-[16rem]">Sample shown for the first student. Every card carries its own student, serial and paper dates.</span>
                    <div className="flex gap-2">
                        <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl text-sm font-semibold border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={saving || toRelease.length === 0}
                            onClick={release}
                            className="h-10 px-4 inline-flex items-center gap-1.5 rounded-xl text-sm font-semibold bg-primary text-white disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Release {toRelease.length} to app
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
