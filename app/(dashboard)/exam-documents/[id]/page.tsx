"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, ScrollText, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { examDocumentsService, type ExamSchedule } from "@/lib/exam-documents.service";
import { useExamDocumentsAccess } from "@/hooks/use-exam-documents-access";
import { RosterTab } from "../_components/RosterTab";
import { errMsg, fmtDate } from "../_components/format";
import { ScheduleEditor } from "../_components/ScheduleEditor";
import { StatusBadge } from "../_components/StatusBadge";

/** TAFSD-510: one exam schedule. Students tab issues documents; Schedule tab edits the papers. */
export default function ExamSchedulePage() {
    return (
        <Suspense fallback={<div className="flex justify-center py-24 text-zinc-400"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
            <ExamScheduleView />
        </Suspense>
    );
}

function ExamScheduleView() {
    const { id: idParam } = useParams<{ id: string }>();
    const id = Number(idParam);
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();
    const access = useExamDocumentsAccess();
    const [tab, setTab] = useState<"students" | "schedule">(params.get("tab") === "schedule" ? "schedule" : "students");
    const [schedule, setSchedule] = useState<ExamSchedule | null>(null);
    const [busy, setBusy] = useState(false);

    const loadSchedule = useCallback(async () => {
        try {
            setSchedule(await examDocumentsService.getSchedule(id));
        } catch (err) {
            toast.error(errMsg(err, "Could not load the schedule"));
        }
    }, [id]);

    useEffect(() => {
        void loadSchedule();
    }, [loadSchedule]);

    const switchTab = (t: "students" | "schedule") => {
        setTab(t);
        const sp = new URLSearchParams(params.toString());
        if (t === "schedule") sp.set("tab", "schedule");
        else sp.delete("tab");
        router.replace(`${pathname}${sp.toString() ? `?${sp}` : ""}`, { scroll: false });
    };

    const setStatus = async (status: "DRAFT" | "PUBLISHED") => {
        setBusy(true);
        try {
            setSchedule(await examDocumentsService.setStatus(id, status));
            toast.success(status === "PUBLISHED" ? "Published. Documents can be issued from the issue date." : "Back to draft");
        } catch (err) {
            toast.error(errMsg(err, "Could not change the status"));
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!schedule || !confirm(`Delete "${schedule.title}"? This cannot be undone.`)) return;
        setBusy(true);
        try {
            await examDocumentsService.deleteSchedule(id);
            toast.success("Schedule deleted");
            router.push("/exam-documents");
        } catch (err) {
            toast.error(errMsg(err, "Could not delete the schedule"));
            setBusy(false);
        }
    };

    if (!schedule) {
        return (
            <div className="flex justify-center py-24 text-zinc-400">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
        );
    }

    const canManage = access.can("manage_schedules");

    return (
        <div className="space-y-6 pb-12">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <Link href="/exam-documents" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                        <ArrowLeft className="h-4 w-4" /> Exam Documents
                    </Link>
                    <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mt-2">
                        <ScrollText className="h-6 w-6 text-blue-500" /> {schedule.title}
                        <StatusBadge status={schedule.status} />
                    </h1>
                    <p className="text-sm text-zinc-500 mt-1">
                        {[schedule.segment_line, schedule.campus_name, schedule.academic_year].filter(Boolean).join(" · ")} · fee date{" "}
                        <b>{fmtDate(schedule.fee_date)}</b> · issue from <b>{fmtDate(schedule.issue_from)}</b>
                    </p>
                </div>
                {canManage && (
                    <div className="flex gap-2">
                        {schedule.status === "DRAFT" ? (
                            <button type="button" disabled={busy} onClick={() => setStatus("PUBLISHED")} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold bg-emerald-600 text-white disabled:opacity-60">
                                <CheckCircle2 className="h-4 w-4" /> Publish
                            </button>
                        ) : (
                            <button type="button" disabled={busy} onClick={() => setStatus("DRAFT")} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold border border-zinc-200 dark:border-zinc-800 disabled:opacity-60">
                                Back to draft
                            </button>
                        )}
                        {schedule.documents_issued === 0 && (
                            <button type="button" disabled={busy} onClick={remove} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold border border-red-200 text-red-600 dark:border-red-900 disabled:opacity-60">
                                <Trash2 className="h-4 w-4" /> Delete
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
                {(["students", "schedule"] as const).map((t) => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => switchTab(t)}
                        className={`px-4 h-10 text-sm font-semibold border-b-2 -mb-px ${
                            tab === t ? "border-primary text-zinc-900 dark:text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-800"
                        }`}
                    >
                        {t === "students" ? "Students" : "Schedule"}
                    </button>
                ))}
            </div>

            {tab === "students" ? (
                <RosterTab schedule={schedule} onScheduleChanged={loadSchedule} />
            ) : (
                <ScheduleEditor
                    key={schedule.updated_at}
                    schedule={schedule}
                    readOnly={!canManage}
                    onSaved={(s) => {
                        setSchedule(s);
                        if (s.documents_issued > 0) toast("Documents already issued keep their serials; reprints show the new papers.", { icon: "ℹ️" });
                    }}
                />
            )}
        </div>
    );
}
