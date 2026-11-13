"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    FileDown,
    Layers,
    Loader2,
    Printer,
    RotateCcw,
    ScrollText,
    Search,
    ShieldAlert,
    Trash2,
    Users,
    X,
} from "lucide-react";
import toast from "react-hot-toast";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { toggleId } from "@/components/filters/filter-params";
import { campusesService, type SectionInfo } from "@/lib/campuses.service";
import {
    DOC_TYPE_LABELS,
    ROSTER_STATE_LABELS,
    downloadBlob,
    examDocumentsService,
    readBlobError,
    type ExamSchedule,
    type Roster,
    type RosterRow,
    type RosterState,
} from "@/lib/exam-documents.service";
import { useExamDocumentsAccess } from "@/hooks/use-exam-documents-access";
import { ScheduleEditor } from "../_components/ScheduleEditor";
import { StatusBadge } from "../_components/StatusBadge";

const rs = (v: number) => `Rs. ${Math.abs(v).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
const fmtDate = (iso: string | null) =>
    iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const monthOf = (iso: string | null) =>
    iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "";
const when = (iso: string) =>
    new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const errMsg = (err: unknown, fallback: string) => {
    const m = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
    return Array.isArray(m) ? m.join(", ") : typeof m === "string" ? m : fallback;
};

const parseList = (v: string | null) => (v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const parseIds = (v: string | null) => parseList(v).map(Number).filter((x) => Number.isInteger(x) && x > 0);
const STATES: RosterState[] = ["CLEARED", "BLOCKED", "ISSUED"];

function useDebounced<T>(value: T, ms = 300) {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return v;
}

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
                        {[schedule.segment_line, schedule.campus_name, schedule.academic_year].filter(Boolean).join(" · ")} · dues cleared through{" "}
                        <b>{schedule.dues_month_label}</b> · issue from <b>{fmtDate(schedule.issue_from)}</b>
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
                <RosterTab schedule={schedule} />
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

function RosterTab({ schedule }: { schedule: ExamSchedule }) {
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();
    const access = useExamDocumentsAccess();

    const [sections, setSections] = useState<SectionInfo[]>([]);
    const [classIds, setClassIds] = useState<number[]>(() => parseIds(params.get("class_ids")));
    const [sectionIds, setSectionIds] = useState<number[]>(() => parseIds(params.get("section_ids")));
    const [states, setStates] = useState<RosterState[]>(() => parseList(params.get("states")).filter((s): s is RosterState => STATES.includes(s as RosterState)));
    const [search, setSearch] = useState(params.get("q") ?? "");
    const q = useDebounced(search);
    const [roster, setRoster] = useState<Roster | null>(null);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [printing, setPrinting] = useState(false);
    const [overrideFor, setOverrideFor] = useState<RosterRow | null>(null);
    const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

    useEffect(() => {
        campusesService.listAllSections().then(setSections).catch(() => undefined);
    }, []);

    useEffect(() => {
        const sp = new URLSearchParams(params.toString());
        const set = (k: string, v: string) => (v ? sp.set(k, v) : sp.delete(k));
        set("class_ids", classIds.join(","));
        set("section_ids", sectionIds.join(","));
        set("states", states.join(","));
        set("q", q.trim());
        router.replace(`${pathname}${sp.toString() ? `?${sp}` : ""}`, { scroll: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [classIds, sectionIds, states, q]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setRoster(await examDocumentsService.roster(schedule.id, { class_ids: classIds, section_ids: sectionIds, states, q }));
        } catch (err) {
            toast.error(errMsg(err, "Could not load students"));
        } finally {
            setLoading(false);
        }
    }, [schedule.id, classIds, sectionIds, states, q]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => setSelected(new Set()), [roster]);

    const rows = useMemo(() => roster?.rows ?? [], [roster]);
    const issuable = schedule.status === "PUBLISHED" && Boolean(roster?.issue_window_open);
    const canIssue = access.can("issue") && issuable;
    const canOverride = access.can("override_dues") && issuable;
    const printableIds = rows.filter((r) => r.state !== "BLOCKED").map((r) => r.cc);
    const clearedIds = rows.filter((r) => r.state === "CLEARED").map((r) => r.cc);
    const selectedPrintable = [...selected].filter((cc) => printableIds.includes(cc));
    const filtersActive = classIds.length > 0 || sectionIds.length > 0 || states.length > 0 || q.trim() !== "";
    const typing = search.trim() !== q.trim();

    const print = async (ccs: number[]) => {
        if (!ccs.length) return;
        setPrinting(true);
        try {
            const out = await examDocumentsService.issue(schedule.id, ccs);
            downloadBlob(out.blob, out.filename);
            toast.success(
                [out.issued ? `${out.issued} issued` : "", out.reprinted ? `${out.reprinted} reprinted` : ""].filter(Boolean).join(", ") || "Done",
            );
            await load();
        } catch (err) {
            const e = await readBlobError(err);
            if (e.code === "DUES_NOT_CLEARED") setBlockedMessage(e.message);
            else toast.error(e.message);
        } finally {
            setPrinting(false);
        }
    };

    const classOptions = schedule.classes.map((c) => ({ id: c.id, label: c.description, sub: DOC_TYPE_LABELS[c.doc_type] }));
    const sectionOptions = sections.map((s) => ({ id: s.id, label: s.description }));
    const stateOptions = STATES.map((s) => ({ id: s, label: ROSTER_STATE_LABELS[s] }));

    return (
        <div className="space-y-5">
            {schedule.status !== "PUBLISHED" ? (
                <Banner tone="amber">This schedule is a draft. Publish it before issuing documents.</Banner>
            ) : roster && !roster.issue_window_open ? (
                <Banner tone="amber">Documents can be issued from {fmtDate(schedule.issue_from)}. Until then you can check who is cleared.</Banner>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Stat label="Cleared, ready to issue" value={roster ? roster.counts.CLEARED.toLocaleString() : "—"} tone="emerald" />
                <Stat
                    label={`Owe dues through ${schedule.dues_month_label.toLowerCase()}`}
                    value={roster ? roster.counts.BLOCKED.toLocaleString() : "—"}
                    hint={roster && roster.counts.BLOCKED ? `${rs(roster.blocked_owed_total)} outstanding` : undefined}
                    tone="red"
                />
                <Stat label="Already issued" value={roster ? roster.counts.ISSUED.toLocaleString() : "—"} />
            </div>

            <div className="flex flex-col xl:flex-row gap-3 xl:items-end">
                <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] ml-1">Search</label>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="C.C., G.R. or name"
                            className="w-full h-11 pl-11 pr-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                </div>
                <div className="w-full xl:w-52">
                    <FilterDropdown label="Class" icon={Layers} value={classIds} options={classOptions} placeholder="All classes" onToggle={(v) => setClassIds((p) => toggleId(p, v))} onClear={() => setClassIds([])} onSetValue={setClassIds} />
                </div>
                <div className="w-full xl:w-48">
                    <FilterDropdown label="Section" icon={Users} value={sectionIds} options={sectionOptions} placeholder="All sections" onToggle={(v) => setSectionIds((p) => toggleId(p, v))} onClear={() => setSectionIds([])} onSetValue={setSectionIds} />
                </div>
                <div className="w-full xl:w-48">
                    <FilterDropdown<RosterState> label="Status" icon={CheckCircle2} value={states} options={stateOptions} placeholder="Everyone" onToggle={(v) => setStates((p) => toggleId(p, v))} onClear={() => setStates([])} onSetValue={setStates} />
                </div>
                {filtersActive && (
                    <button
                        type="button"
                        onClick={() => {
                            setClassIds([]);
                            setSectionIds([]);
                            setStates([]);
                            setSearch("");
                        }}
                        className="h-11 px-3 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-1"
                    >
                        <RotateCcw className="h-4 w-4" /> Clear filters
                    </button>
                )}
            </div>

            {canIssue && (
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        disabled={printing || clearedIds.length === 0}
                        onClick={() => print(clearedIds)}
                        className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold bg-primary text-white disabled:opacity-50"
                    >
                        {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Issue to all cleared listed ({clearedIds.length})
                    </button>
                    <button
                        type="button"
                        disabled={printing || selectedPrintable.length === 0}
                        onClick={() => print(selectedPrintable)}
                        className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold border border-zinc-200 dark:border-zinc-800 disabled:opacity-50"
                    >
                        <Printer className="h-4 w-4" /> Print selected ({selectedPrintable.length})
                    </button>
                    <span className="text-xs text-zinc-500 self-center">One PDF, one page per student. Holders get a reprint with the same serial.</span>
                </div>
            )}

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                                <th className="py-3 px-3 w-8">
                                    {canIssue && (
                                        <input
                                            type="checkbox"
                                            checked={printableIds.length > 0 && printableIds.every((cc) => selected.has(cc))}
                                            onChange={(e) => setSelected(e.target.checked ? new Set(printableIds) : new Set())}
                                            title="Select everyone who can be printed"
                                        />
                                    )}
                                </th>
                                <th className="py-3 px-3 font-medium">Student</th>
                                <th className="py-3 px-3 font-medium">Class</th>
                                <th className="py-3 px-3 font-medium">Status</th>
                                <th className="py-3 px-3 font-medium text-right">Owed through {monthOf(roster?.dues_cleared_through ?? null)}</th>
                                <th className="py-3 px-3 font-medium">Document</th>
                                <th className="py-3 px-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {loading && !roster ? (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center text-zinc-400">
                                        <Loader2 className="h-5 w-5 animate-spin inline" />
                                    </td>
                                </tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center text-zinc-400 text-sm">
                                        {typing || loading ? "Searching…" : filtersActive ? "No student matches these filters." : "No enrolled students in these classes."}
                                    </td>
                                </tr>
                            ) : (
                                rows.map((r) => (
                                    <tr key={r.cc} className={`border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 ${loading ? "opacity-60" : ""}`}>
                                        <td className="py-2.5 px-3">
                                            {canIssue && r.state !== "BLOCKED" && (
                                                <input
                                                    type="checkbox"
                                                    checked={selected.has(r.cc)}
                                                    onChange={(e) =>
                                                        setSelected((prev) => {
                                                            const next = new Set(prev);
                                                            if (e.target.checked) next.add(r.cc);
                                                            else next.delete(r.cc);
                                                            return next;
                                                        })
                                                    }
                                                />
                                            )}
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <div className="font-semibold text-zinc-900 dark:text-zinc-100">{r.full_name}</div>
                                            <div className="text-xs text-zinc-500">
                                                C.C. {r.cc}
                                                {r.gr_number ? ` · G.R. ${r.gr_number}` : ""}
                                                {!r.has_photo ? " · no photo" : ""}
                                                {r.student_status !== "ENROLLED" ? ` · ${r.student_status.toLowerCase()}` : ""}
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-3 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                                            {r.class_name}
                                            {r.section_name ? ` – ${r.section_name}` : ""}
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <StateBadge state={r.state} />
                                        </td>
                                        <td className="py-2.5 px-3 text-right tabular-nums">
                                            {r.owed > 0 ? (
                                                <div>
                                                    <span className="font-bold text-red-600 dark:text-red-400">{rs(r.owed)}</span>
                                                    <div className="text-[11px] text-zinc-500">
                                                        since {monthOf(r.oldest_unpaid_fee_date) || "—"}
                                                        {r.surcharge_outstanding > 0 ? ` · incl. ${rs(r.surcharge_outstanding)} surcharge` : ""}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-zinc-400">—</span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-3 text-xs">
                                            {r.document ? (
                                                <div>
                                                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">#{r.document.serial}</span>{" "}
                                                    <span className="text-zinc-500">{DOC_TYPE_LABELS[r.document.doc_type]}</span>
                                                    {r.document.overridden && (
                                                        <span title={r.document.override_reason ?? ""} className="ml-1 inline-flex items-center gap-0.5 rounded px-1 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 font-bold">
                                                            <ShieldAlert className="h-3 w-3" /> override
                                                        </span>
                                                    )}
                                                    <div className="text-zinc-500">
                                                        {when(r.document.issued_at)} by {r.document.issued_by}
                                                        {r.document.print_count > 1 ? ` · printed ${r.document.print_count}×` : ""}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-zinc-400">—</span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                            {r.state !== "BLOCKED" && canIssue && (
                                                <button type="button" disabled={printing} onClick={() => print([r.cc])} className="h-8 px-3 rounded-lg text-xs font-semibold border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-50">
                                                    {r.state === "ISSUED" ? "Reprint" : "Issue"}
                                                </button>
                                            )}
                                            {r.state === "BLOCKED" && canOverride && (
                                                <button type="button" onClick={() => setOverrideFor(r)} className="h-8 px-3 rounded-lg text-xs font-semibold border border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30">
                                                    Override…
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {overrideFor && (
                <OverrideModal
                    scheduleId={schedule.id}
                    row={overrideFor}
                    duesLabel={schedule.dues_month_label}
                    onClose={() => setOverrideFor(null)}
                    onDone={() => {
                        setOverrideFor(null);
                        void load();
                    }}
                />
            )}

            {blockedMessage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setBlockedMessage(null)}>
                    <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start justify-between gap-3">
                            <p className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-amber-500" /> Nothing was issued
                            </p>
                            <button type="button" onClick={() => setBlockedMessage(null)} className="text-zinc-400 hover:text-zinc-700">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">{blockedMessage}</p>
                        <p className="text-xs text-zinc-500">Their dues changed since the list loaded. Refresh to see who is cleared now.</p>
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => {
                                    setBlockedMessage(null);
                                    void load();
                                }}
                                className="h-10 px-4 rounded-xl text-sm font-semibold bg-primary text-white"
                            >
                                Refresh the list
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function OverrideModal({
    scheduleId,
    row,
    duesLabel,
    onClose,
    onDone,
}: {
    scheduleId: number;
    row: RosterRow;
    duesLabel: string;
    onClose: () => void;
    onDone: () => void;
}) {
    const [reason, setReason] = useState("");
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (reason.trim().length < 5) return toast.error("Give a reason (at least 5 characters)");
        setSaving(true);
        try {
            const out = await examDocumentsService.override(scheduleId, row.cc, reason.trim());
            downloadBlob(out.blob, out.filename);
            toast.success("Issued with an override");
            onDone();
        } catch (err) {
            toast.error((await readBlobError(err)).message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <ShieldAlert className="h-5 w-5 text-amber-500" /> Issue although dues are outstanding
                        </p>
                        <p className="text-sm text-zinc-500 mt-1">
                            {row.full_name} (C.C. {row.cc}) owes <b className="text-red-600">{rs(row.owed)}</b> through {duesLabel.toLowerCase()}. The reason and your name are
                            recorded on the document and in the activity log.
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-700">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="e.g. Father paid by cheque on 8 Dec; deposit not yet recorded"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    autoFocus
                />
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl text-sm font-semibold border border-zinc-200 dark:border-zinc-800">
                        Cancel
                    </button>
                    <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold bg-amber-600 text-white disabled:opacity-60">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Issue with override
                    </button>
                </div>
            </div>
        </div>
    );
}

function StateBadge({ state }: { state: RosterState }) {
    const cls =
        state === "CLEARED"
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
            : state === "BLOCKED"
              ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
              : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400";
    return <span className={`text-[11px] font-bold rounded-md px-2 py-0.5 ${cls}`}>{ROSTER_STATE_LABELS[state]}</span>;
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "emerald" | "red" }) {
    const color = tone === "emerald" ? "text-emerald-600 dark:text-emerald-400" : tone === "red" ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-zinc-100";
    return (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
            <p className="text-xs font-medium text-zinc-500">{label}</p>
            <p className={`text-2xl font-black mt-1 tabular-nums ${color}`}>{value}</p>
            {hint && <p className="text-xs text-zinc-400 mt-0.5">{hint}</p>}
        </div>
    );
}

function Banner({ tone, children }: { tone: "amber"; children: React.ReactNode }) {
    return (
        <div className={`rounded-xl px-4 py-3 text-sm flex items-center gap-2 ${tone === "amber" ? "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300" : ""}`}>
            <AlertTriangle className="h-4 w-4 shrink-0" /> {children}
        </div>
    );
}
