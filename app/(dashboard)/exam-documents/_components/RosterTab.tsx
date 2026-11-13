"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
    AlertTriangle,
    Atom,
    CalendarClock,
    Camera,
    CheckCircle2,
    FileDown,
    GraduationCap,
    Info,
    Layers,
    Loader2,
    Printer,
    Receipt,
    Search,
    ShieldAlert,
    SlidersHorizontal,
    UserX,
    X,
} from "lucide-react";
import toast from "react-hot-toast";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { toggleId } from "@/components/filters/filter-params";
import { campusesService, type SectionInfo } from "@/lib/campuses.service";
import {
    DOC_TYPE_LABELS,
    ROSTER_STATES,
    ROSTER_STATE_LABELS,
    downloadBlob,
    examDocumentsService,
    readBlobError,
    type ExamSchedule,
    type FeeDateKind,
    type MissingData,
    type Roster,
    type RosterRow,
    type RosterState,
} from "@/lib/exam-documents.service";
import { useExamDocumentsAccess } from "@/hooks/use-exam-documents-access";
import { FeeDateModal } from "./FeeDateModal";
import { InfoTip } from "./InfoTip";
import { errMsg, fmtDate, monthOf, rs, when } from "./format";

const parseList = (v: string | null) => (v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const parseIds = (v: string | null) => parseList(v).map(Number).filter((x) => Number.isInteger(x) && x > 0);
const pick = <T extends string>(v: string | null, allowed: readonly T[]) => parseList(v).filter((x): x is T => allowed.includes(x as T));

/** Same names the Student Directory filters by. */
const DISCIPLINES = [
    { id: "none", label: "No discipline" },
    { id: "Biology", label: "Biology" },
    { id: "Computer", label: "Computer" },
    { id: "Pre-Engineering", label: "Pre-Engineering" },
    { id: "Pre-Medical", label: "Pre-Medical" },
    { id: "Commerce", label: "Commerce" },
];
const PHOTO = [
    { id: "true", label: "Has photo" },
    { id: "false", label: "No photo" },
] as const;
const MISSING: { id: MissingData; label: string }[] = [
    { id: "father", label: "No father's name" },
    { id: "dob", label: "No date of birth" },
    { id: "photo", label: "No photo" },
];
const FEE_DATE_KINDS: { id: FeeDateKind; label: string }[] = [
    { id: "SCHEDULE", label: "Schedule's date" },
    { id: "OWN", label: "Own date" },
];

function useDebounced<T>(value: T, ms = 300) {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return v;
}

type FeeDateDialog = { mode: "schedule" } | { mode: "students"; ids: number[]; initialDate?: string };

/** TAFSD-510: who can get a document from this schedule, against which fee date, and issuing it. */
export function RosterTab({ schedule, onScheduleChanged }: { schedule: ExamSchedule; onScheduleChanged: () => void }) {
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();
    const access = useExamDocumentsAccess();

    const [sections, setSections] = useState<SectionInfo[]>([]);
    const [classIds, setClassIds] = useState<number[]>(() => parseIds(params.get("class_ids")));
    const [sectionIds, setSectionIds] = useState<number[]>(() => parseIds(params.get("section_ids")));
    const [disciplines, setDisciplines] = useState<string[]>(() => parseList(params.get("disciplines")));
    const [states, setStates] = useState<RosterState[]>(() => pick(params.get("states"), ROSTER_STATES));
    const [feeDateKinds, setFeeDateKinds] = useState<FeeDateKind[]>(() => pick(params.get("fee_dates"), ["SCHEDULE", "OWN"] as const));
    const [photo, setPhoto] = useState<string[]>(() => pick(params.get("photo"), ["true", "false"] as const));
    const [missing, setMissing] = useState<MissingData[]>(() => pick(params.get("missing"), ["photo", "father", "dob"] as const));
    const [search, setSearch] = useState(params.get("q") ?? "");
    const q = useDebounced(search);

    const [roster, setRoster] = useState<Roster | null>(null);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [printing, setPrinting] = useState(false);
    const [overrideFor, setOverrideFor] = useState<RosterRow | null>(null);
    const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
    const [feeDateDialog, setFeeDateDialog] = useState<FeeDateDialog | null>(null);

    useEffect(() => {
        campusesService.listAllSections().then(setSections).catch(() => undefined);
    }, []);

    useEffect(() => {
        const sp = new URLSearchParams(params.toString());
        const set = (k: string, v: string) => (v ? sp.set(k, v) : sp.delete(k));
        set("class_ids", classIds.join(","));
        set("section_ids", sectionIds.join(","));
        set("disciplines", disciplines.join(","));
        set("states", states.join(","));
        set("fee_dates", feeDateKinds.join(","));
        set("photo", photo.join(","));
        set("missing", missing.join(","));
        set("q", q.trim());
        router.replace(`${pathname}${sp.toString() ? `?${sp}` : ""}`, { scroll: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [classIds, sectionIds, disciplines, states, feeDateKinds, photo, missing, q]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const next = await examDocumentsService.roster(schedule.id, {
                class_ids: classIds,
                section_ids: sectionIds,
                disciplines,
                states,
                fee_date_kinds: feeDateKinds,
                // Both or neither ticked means everyone.
                has_photo: photo.length === 1 ? (photo[0] as "true" | "false") : "",
                missing,
                q,
            });
            setRoster(next);
            // Keep the selection across reloads (e.g. change dates, then issue the same students).
            const present = new Set(next.rows.map((r) => r.cc));
            setSelected((prev) => new Set([...prev].filter((cc) => present.has(cc))));
        } catch (err) {
            toast.error(errMsg(err, "Could not load students"));
        } finally {
            setLoading(false);
        }
    }, [schedule.id, classIds, sectionIds, disciplines, states, feeDateKinds, photo, missing, q]);

    useEffect(() => {
        void load();
    }, [load]);

    const rows = useMemo(() => roster?.rows ?? [], [roster]);
    const byCc = useMemo(() => new Map(rows.map((r) => [r.cc, r])), [rows]);
    const issuable = schedule.status === "PUBLISHED" && Boolean(roster?.issue_window_open);
    const canIssue = access.can("issue") && issuable;
    const canOverride = access.can("override_dues") && issuable;
    const canChangeDates = access.can("change_fee_dates");
    const canManage = access.can("manage_schedules");

    const clearedIds = rows.filter((r) => r.state === "CLEARED").map((r) => r.cc);
    const selectedRows = [...selected].map((cc) => byCc.get(cc)).filter((r): r is RosterRow => Boolean(r));
    const selPrintable = selectedRows.filter((r) => r.state === "CLEARED" || r.state === "ISSUED").map((r) => r.cc);
    const selDateable = selectedRows.filter((r) => r.state !== "ISSUED").map((r) => r.cc);
    const allListedSelected = rows.length > 0 && rows.every((r) => selected.has(r.cc));

    const filtersActive =
        classIds.length + sectionIds.length + disciplines.length + states.length + feeDateKinds.length + photo.length + missing.length > 0 || q.trim() !== "";
    const typing = search.trim() !== q.trim();
    const clearFilters = () => {
        setClassIds([]);
        setSectionIds([]);
        setDisciplines([]);
        setStates([]);
        setFeeDateKinds([]);
        setPhoto([]);
        setMissing([]);
        setSearch("");
    };

    const print = async (ccs: number[]) => {
        if (!ccs.length) return;
        setPrinting(true);
        try {
            const out = await examDocumentsService.issue(schedule.id, ccs);
            downloadBlob(out.blob, out.filename);
            toast.success([out.issued ? `${out.issued} issued` : "", out.reprinted ? `${out.reprinted} reprinted` : ""].filter(Boolean).join(", ") || "Done");
            await load();
        } catch (err) {
            const e = await readBlobError(err);
            if (e.code === "DUES_NOT_CLEARED") setBlockedMessage(e.message);
            else toast.error(e.message);
        } finally {
            setPrinting(false);
        }
    };

    const toggleRow = (cc: number, on: boolean) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (on) next.add(cc);
            else next.delete(cc);
            return next;
        });

    const classOptions = schedule.classes.map((c) => ({ id: c.id, label: c.description, sub: DOC_TYPE_LABELS[c.doc_type] }));
    const sectionOptions = sections.map((s) => ({ id: s.id, label: s.description }));
    const stateOptions = ROSTER_STATES.map((s) => ({ id: s, label: ROSTER_STATE_LABELS[s] }));
    const counts = roster?.counts;
    const types = new Set(schedule.classes.map((c) => c.doc_type));
    const docNoun = types.size > 1 ? "admit card or statement of entry" : types.has("ADMIT_CARD") ? "admit card" : "statement of entry";
    const scheduleDateIds = rows.filter((r) => r.state !== "ISSUED" && !r.own_fee_date).map((r) => r.cc);

    return (
        <div className="space-y-5 pb-20">
            {schedule.status !== "PUBLISHED" ? (
                <Banner>This schedule is a draft. Publish it before issuing documents. You can check dues and set fee dates now.</Banner>
            ) : roster && !roster.issue_window_open ? (
                <Banner>Documents can be issued from {fmtDate(schedule.issue_from)}. Until then you can check who is cleared and set fee dates.</Banner>
            ) : null}

            {/* Fee date */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 flex flex-col md:flex-row md:items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <CalendarClock className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em]">Fee date</p>
                    <p className="text-xl font-black text-zinc-900 dark:text-zinc-100">{fmtDate(schedule.fee_date)}</p>
                    <p className="text-sm text-zinc-500">
                        Every fee head dated on or before this must be paid before a student gets their {docNoun}.
                        {roster && roster.own_fee_dates > 0 && (
                            <>
                                {" "}
                                <button type="button" onClick={() => setFeeDateKinds(["OWN"])} className="font-semibold text-violet-700 dark:text-violet-400 hover:underline">
                                    {roster.own_fee_dates} student{roster.own_fee_dates === 1 ? " has" : "s have"} their own date
                                </button>
                                .
                            </>
                        )}
                    </p>
                </div>
                {canManage && (
                    <button
                        type="button"
                        onClick={() => setFeeDateDialog({ mode: "schedule" })}
                        className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 shrink-0"
                    >
                        <CalendarClock className="h-4 w-4" /> Change fee date
                    </button>
                )}
            </div>

            {/* Counts: click to filter */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard state="CLEARED" active={states} onPick={setStates} value={counts?.CLEARED} label="Cleared, ready to issue" />
                <StatCard
                    state="NOT_BILLED"
                    active={states}
                    onPick={setStates}
                    value={counts?.NOT_BILLED}
                    label="Not billed"
                    hint={roster && roster.counts.NOT_BILLED ? `${rs(roster.not_billed_owed_total)} never put on a voucher` : "Owe only fees the school hasn't billed"}
                />
                <StatCard
                    state="BLOCKED"
                    active={states}
                    onPick={setStates}
                    value={counts?.BLOCKED}
                    label="Owe dues"
                    hint={roster && roster.counts.BLOCKED ? `${rs(roster.blocked_owed_total)} outstanding` : undefined}
                />
                <StatCard state="ISSUED" active={states} onPick={setStates} value={counts?.ISSUED} label="Already issued" />
            </div>

            {roster && roster.counts.NOT_BILLED > 0 && (
                <div className="rounded-xl px-4 py-3 text-sm flex items-start gap-2 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    <Receipt className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                        <b>{roster.counts.NOT_BILLED.toLocaleString()}</b> student{roster.counts.NOT_BILLED === 1 ? "" : "s"} can&apos;t be issued only because fees dated on or before their fee
                        date were never put on a voucher. That isn&apos;t the family&apos;s fault: generate their vouchers so they can pay, or give them an earlier fee date.{" "}
                        <Link href="/bulk-voucher" target="_blank" className="font-semibold underline">
                            Bulk vouchers
                        </Link>
                    </span>
                </div>
            )}

            {/* Search + filters, laid out like the Student Directory */}
            <div className="space-y-3">
                <div className="relative flex-1 min-w-[260px] max-w-xl">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search by C.C., G.R. or name"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-10 pl-10 pr-10 text-[13px] font-medium bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-zinc-400"
                    />
                    {search && (
                        <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 hover:text-zinc-600">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                <div className="flex items-end gap-2 flex-wrap">
                    <SlidersHorizontal className="h-4 w-4 text-zinc-400 shrink-0 mb-3.5" />
                    <div className="w-[170px]">
                        <FilterDropdown label="Class" icon={GraduationCap} value={classIds} options={classOptions} placeholder="All classes" onToggle={(v) => setClassIds((p) => toggleId(p, v))} onClear={() => setClassIds([])} onSetValue={setClassIds} />
                    </div>
                    <div className="w-[150px]">
                        <FilterDropdown label="Section" icon={Layers} value={sectionIds} options={sectionOptions} placeholder="All sections" onToggle={(v) => setSectionIds((p) => toggleId(p, v))} onClear={() => setSectionIds([])} onSetValue={setSectionIds} />
                    </div>
                    <div className="w-[170px]">
                        <FilterDropdown<string> label="Discipline" icon={Atom} value={disciplines} options={DISCIPLINES} placeholder="All disciplines" onToggle={(v) => setDisciplines((p) => toggleId(p, v))} onClear={() => setDisciplines([])} onSetValue={setDisciplines} />
                    </div>
                    <div className="w-[170px]">
                        <FilterDropdown<RosterState> label="Dues status" icon={CheckCircle2} value={states} options={stateOptions} placeholder="Everyone" onToggle={(v) => setStates((p) => toggleId(p, v))} onClear={() => setStates([])} onSetValue={setStates} />
                    </div>
                    <div className="w-[160px]">
                        <FilterDropdown<FeeDateKind> label="Fee date" icon={CalendarClock} value={feeDateKinds} options={FEE_DATE_KINDS} placeholder="Any" onToggle={(v) => setFeeDateKinds((p) => toggleId(p, v))} onClear={() => setFeeDateKinds([])} onSetValue={setFeeDateKinds} />
                    </div>
                    <div className="w-[150px]">
                        <FilterDropdown<string> label="Photo" icon={Camera} value={photo} options={[...PHOTO]} placeholder="All photos" onToggle={(v) => setPhoto((p) => toggleId(p, v))} onClear={() => setPhoto([])} onSetValue={setPhoto} />
                    </div>
                    <div className="w-[180px]">
                        <FilterDropdown<MissingData> label="Missing data" icon={UserX} value={missing} options={MISSING} placeholder="Any" onToggle={(v) => setMissing((p) => toggleId(p, v))} onClear={() => setMissing([])} onSetValue={setMissing} />
                    </div>
                    {filtersActive && (
                        <button type="button" onClick={clearFilters} className="flex items-center gap-1.5 px-3 h-9 mb-1 text-[11px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/30 rounded-xl hover:bg-rose-100 transition-colors">
                            <X className="h-3 w-3" /> Clear
                        </button>
                    )}
                </div>
            </div>

            {canIssue && (
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        disabled={printing || clearedIds.length === 0}
                        onClick={() => print(clearedIds)}
                        className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold bg-primary text-white disabled:opacity-50"
                    >
                        {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Issue to all cleared listed ({clearedIds.length})
                    </button>
                    <span className="text-xs text-zinc-500">One PDF, one page per student. Holders get a reprint with the same serial.</span>
                </div>
            )}

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 text-xs text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                    <span>
                        {roster ? `${rows.length.toLocaleString()} student${rows.length === 1 ? "" : "s"}` : ""}
                        {loading && roster ? " · refreshing…" : ""}
                    </span>
                    {selected.size > 0 && (
                        <button type="button" onClick={() => setSelected(new Set())} className="font-semibold hover:text-zinc-900 dark:hover:text-zinc-100">
                            Clear selection ({selected.size})
                        </button>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                                <th className="py-3 px-3 w-8">
                                    <input
                                        type="checkbox"
                                        aria-label="Select everyone listed"
                                        checked={allListedSelected}
                                        onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.cc)) : new Set())}
                                    />
                                </th>
                                <th className="py-3 px-3 font-medium">Student</th>
                                <th className="py-3 px-3 font-medium">Class</th>
                                <th className="py-3 px-3 font-medium">Fee date</th>
                                <th className="py-3 px-3 font-medium">Status</th>
                                <th className="py-3 px-3 font-medium text-right">Owed</th>
                                <th className="py-3 px-3 font-medium">Document</th>
                                <th className="py-3 px-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {loading && !roster ? (
                                <tr>
                                    <td colSpan={8} className="py-16 text-center text-zinc-400">
                                        <Loader2 className="h-5 w-5 animate-spin inline" />
                                    </td>
                                </tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-16 text-center text-zinc-400 text-sm">
                                        {typing || loading ? "Searching…" : filtersActive ? "No student matches these filters." : "No enrolled students in these classes."}
                                    </td>
                                </tr>
                            ) : (
                                rows.map((r) => (
                                    <tr
                                        key={r.cc}
                                        className={`border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 ${selected.has(r.cc) ? "bg-primary/[0.04]" : ""} ${loading ? "opacity-60" : ""}`}
                                    >
                                        <td className="py-2.5 px-3 align-top">
                                            <input type="checkbox" aria-label={`Select ${r.full_name}`} checked={selected.has(r.cc)} onChange={(e) => toggleRow(r.cc, e.target.checked)} />
                                        </td>
                                        <td className="py-2.5 px-3 align-top">
                                            <div className="font-semibold text-zinc-900 dark:text-zinc-100">{r.full_name}</div>
                                            <div className="text-xs text-zinc-500">
                                                C.C. {r.cc}
                                                {r.gr_number ? ` · G.R. ${r.gr_number}` : ""}
                                                {r.discipline ? ` · ${r.discipline}` : ""}
                                                {r.student_status !== "ENROLLED" ? ` · ${r.student_status.toLowerCase()}` : ""}
                                            </div>
                                            <DataGaps row={r} />
                                        </td>
                                        <td className="py-2.5 px-3 align-top text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                                            {r.class_name}
                                            {r.section_name ? ` – ${r.section_name}` : ""}
                                        </td>
                                        <td className="py-2.5 px-3 align-top whitespace-nowrap">
                                            <FeeDateCell row={r} />
                                        </td>
                                        <td className="py-2.5 px-3 align-top">
                                            <StatusCell row={r} />
                                        </td>
                                        <td className="py-2.5 px-3 align-top text-right tabular-nums">
                                            <OwedCell row={r} />
                                        </td>
                                        <td className="py-2.5 px-3 align-top text-xs">
                                            {r.document ? (
                                                <div>
                                                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">#{r.document.serial}</span>{" "}
                                                    <span className="text-zinc-500">{DOC_TYPE_LABELS[r.document.doc_type]}</span>
                                                    {r.document.overridden && (
                                                        <InfoTip content={<>Issued with {rs(r.document.dues_outstanding_at_issue)} owed. Reason: {r.document.override_reason}</>}>
                                                            <span className="ml-1 inline-flex items-center gap-0.5 rounded px-1 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 font-bold">
                                                                <ShieldAlert className="h-3 w-3" /> override
                                                            </span>
                                                        </InfoTip>
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
                                        <td className="py-2.5 px-3 align-top text-right whitespace-nowrap">
                                            <div className="inline-flex items-center gap-1.5">
                                                {r.state !== "ISSUED" && canChangeDates && (
                                                    <button
                                                        type="button"
                                                        title="Change this student's fee date"
                                                        aria-label={`Change ${r.full_name}'s fee date`}
                                                        onClick={() => setFeeDateDialog({ mode: "students", ids: [r.cc], initialDate: r.fee_date })}
                                                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                                                    >
                                                        <CalendarClock className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {(r.state === "CLEARED" || r.state === "ISSUED") && canIssue && (
                                                    <button type="button" disabled={printing} onClick={() => print([r.cc])} className="h-8 px-3 rounded-lg text-xs font-semibold border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-50">
                                                        {r.state === "ISSUED" ? "Reprint" : "Issue"}
                                                    </button>
                                                )}
                                                {r.state === "NOT_BILLED" && (
                                                    <Link href="/fee-challan" target="_blank" className="h-8 px-3 inline-flex items-center gap-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300">
                                                        <Receipt className="h-3.5 w-3.5" /> Generate voucher
                                                    </Link>
                                                )}
                                                {(r.state === "BLOCKED" || r.state === "NOT_BILLED") && canOverride && (
                                                    <button type="button" onClick={() => setOverrideFor(r)} className="h-8 px-3 rounded-lg text-xs font-semibold border border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30">
                                                        Override…
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

            {/* Selection bar */}
            {selected.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 backdrop-blur shadow-2xl px-3 py-2 max-w-[calc(100vw-2rem)]">
                    <span className="px-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{selected.size} selected</span>
                    {canChangeDates && (
                        <button
                            type="button"
                            disabled={!selDateable.length}
                            onClick={() => setFeeDateDialog({ mode: "students", ids: selDateable })}
                            title={selDateable.length < selected.size ? "Students already issued keep the date their document was checked against" : undefined}
                            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-semibold border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                        >
                            <CalendarClock className="h-4 w-4" /> Change fee date ({selDateable.length})
                        </button>
                    )}
                    {canIssue && (
                        <button
                            type="button"
                            disabled={printing || !selPrintable.length}
                            onClick={() => print(selPrintable)}
                            title={selPrintable.length < selected.size ? "Only cleared students and holders can be printed" : undefined}
                            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-semibold bg-primary text-white disabled:opacity-50"
                        >
                            <Printer className="h-4 w-4" /> Issue / reprint ({selPrintable.length})
                        </button>
                    )}
                    <button type="button" onClick={() => setSelected(new Set())} className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-700" aria-label="Clear selection">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {feeDateDialog && (
                <FeeDateModal
                    scheduleId={schedule.id}
                    scheduleFeeDate={schedule.fee_date}
                    mode={feeDateDialog.mode}
                    studentIds={feeDateDialog.mode === "students" ? feeDateDialog.ids : []}
                    previewIds={scheduleDateIds}
                    initialDate={feeDateDialog.mode === "students" ? feeDateDialog.initialDate : undefined}
                    onClose={() => setFeeDateDialog(null)}
                    onSaved={() => {
                        setFeeDateDialog(null);
                        if (feeDateDialog.mode === "schedule") onScheduleChanged();
                        void load();
                    }}
                />
            )}

            {overrideFor && (
                <OverrideModal
                    scheduleId={schedule.id}
                    row={overrideFor}
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

// ─── Cells ───────────────────────────────────────────────────────────────────

function DataGaps({ row }: { row: RosterRow }) {
    const gaps = [!row.has_photo && "no photo", !row.has_father && "no father's name", !row.has_dob && "no date of birth"].filter(Boolean) as string[];
    if (!gaps.length) return null;
    return (
        <div className="flex flex-wrap gap-1 mt-1">
            {gaps.map((g) => (
                <span key={g} className="text-[10px] font-semibold rounded px-1.5 py-0.5 bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {g}
                </span>
            ))}
        </div>
    );
}

function FeeDateCell({ row }: { row: RosterRow }) {
    if (row.document) {
        return (
            <span className="text-xs text-zinc-500" title="The fee date this student was checked against when the document was issued">
                {fmtDate(row.document.fee_date ?? row.fee_date)}
            </span>
        );
    }
    if (!row.own_fee_date) return <span className="text-xs text-zinc-600 dark:text-zinc-400">{fmtDate(row.fee_date)}</span>;
    return (
        <InfoTip
            content={
                <>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">Own fee date: {fmtDate(row.own_fee_date.fee_date)}</p>
                    <p className="mt-1">
                        Set by {row.own_fee_date.set_by} on {when(row.own_fee_date.set_at)}.
                    </p>
                    {row.own_fee_date.reason && <p className="mt-1 italic">&ldquo;{row.own_fee_date.reason}&rdquo;</p>}
                </>
            }
        >
            <span className="inline-flex items-center gap-1.5 text-xs">
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{fmtDate(row.fee_date)}</span>
                <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">own</span>
            </span>
        </InfoTip>
    );
}

const BADGE: Record<RosterState, string> = {
    CLEARED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    NOT_BILLED: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    BLOCKED: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
    ISSUED: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
};

function StatusCell({ row }: { row: RosterRow }) {
    const badge = (
        <span className={`inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-bold rounded-md px-2 py-0.5 ${BADGE[row.state]}`}>
            {ROSTER_STATE_LABELS[row.state]}
            {(row.state === "NOT_BILLED" || row.state === "BLOCKED") && <Info className="h-3 w-3" />}
        </span>
    );
    if (row.state === "NOT_BILLED") {
        return (
            <InfoTip
                content={
                    <>
                        <p className="font-semibold text-amber-800 dark:text-amber-300">You should generate the voucher.</p>
                        <p className="mt-1">
                            {rs(row.not_billed_owed)} in fees dated on or before {fmtDate(row.fee_date)} has never been put on a voucher, so the family hasn&apos;t been asked to
                            pay it. This is not their fault. Generate the voucher from Fee Challan or Bulk Vouchers; once it&apos;s paid, the student is cleared.
                        </p>
                        <MonthList row={row} />
                    </>
                }
            >
                {badge}
            </InfoTip>
        );
    }
    if (row.state === "BLOCKED") {
        return (
            <InfoTip
                content={
                    <>
                        <p className="font-semibold text-red-700 dark:text-red-400">Can&apos;t be issued until paid.</p>
                        <p className="mt-1">
                            {rs(row.billed_owed)} on vouchers is unpaid for fees dated on or before {fmtDate(row.fee_date)}.
                            {row.not_billed_owed > 0 ? ` A further ${rs(row.not_billed_owed)} hasn't been billed yet: generate that voucher too.` : ""}
                        </p>
                        <MonthList row={row} />
                    </>
                }
            >
                {badge}
            </InfoTip>
        );
    }
    return badge;
}

function MonthList({ row }: { row: RosterRow }) {
    if (!row.months.length && !row.surcharge_outstanding) return null;
    return (
        <table className="w-full mt-2 tabular-nums">
            <tbody>
                {row.months.map((m) => (
                    <tr key={m.fee_date}>
                        <td className="py-0.5 pr-2">{monthOf(m.fee_date)}</td>
                        <td className="py-0.5 pr-2 text-right">{m.billed > 0 ? rs(m.billed) : ""}</td>
                        <td className="py-0.5 text-right text-amber-700 dark:text-amber-400">{m.not_billed > 0 ? `${rs(m.not_billed)} not billed` : ""}</td>
                    </tr>
                ))}
                {row.surcharge_outstanding > 0 && (
                    <tr>
                        <td className="py-0.5 pr-2">Surcharge</td>
                        <td className="py-0.5 pr-2 text-right">{rs(row.surcharge_outstanding)}</td>
                        <td />
                    </tr>
                )}
            </tbody>
        </table>
    );
}

function OwedCell({ row }: { row: RosterRow }) {
    if (row.owed <= 0) return <span className="text-zinc-400">—</span>;
    if (row.state === "ISSUED") return <span className="text-xs text-zinc-500">{rs(row.owed)} now</span>;
    return (
        <div>
            <span className={`font-bold ${row.state === "NOT_BILLED" ? "text-amber-700 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>{rs(row.owed)}</span>
            {row.billed_owed > 0 && row.not_billed_owed > 0 ? (
                <div className="text-[11px] text-zinc-500 whitespace-nowrap">
                    <div>{rs(row.billed_owed)} on vouchers</div>
                    <div className="text-amber-700 dark:text-amber-400">{rs(row.not_billed_owed)} not billed</div>
                </div>
            ) : (
                <div className="text-[11px] text-zinc-500 whitespace-nowrap">{row.not_billed_owed > 0 ? "never billed" : `since ${monthOf(row.oldest_unpaid_fee_date) || "—"}`}</div>
            )}
        </div>
    );
}

function StatCard({
    state,
    active,
    onPick,
    value,
    label,
    hint,
}: {
    state: RosterState;
    active: RosterState[];
    onPick: (s: RosterState[]) => void;
    value: number | undefined;
    label: string;
    hint?: string;
}) {
    const on = active.length === 1 && active[0] === state;
    const color = {
        CLEARED: "text-emerald-600 dark:text-emerald-400",
        NOT_BILLED: "text-amber-600 dark:text-amber-400",
        BLOCKED: "text-red-600 dark:text-red-400",
        ISSUED: "text-blue-600 dark:text-blue-400",
    }[state];
    return (
        <button
            type="button"
            onClick={() => onPick(on ? [] : [state])}
            title={on ? "Show everyone" : `Show only ${label.toLowerCase()}`}
            className={`text-left rounded-2xl border p-4 transition-colors ${
                on ? "border-primary ring-2 ring-primary/15 bg-primary/[0.03]" : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-zinc-300"
            }`}
        >
            <p className="text-xs font-medium text-zinc-500">{label}</p>
            <p className={`text-2xl font-black mt-1 tabular-nums ${color}`}>{value == null ? "—" : value.toLocaleString()}</p>
            {hint && <p className="text-xs text-zinc-400 mt-0.5">{hint}</p>}
        </button>
    );
}

function Banner({ children }: { children: React.ReactNode }) {
    return (
        <div className="rounded-xl px-4 py-3 text-sm flex items-center gap-2 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {children}
        </div>
    );
}

function OverrideModal({ scheduleId, row, onClose, onDone }: { scheduleId: number; row: RosterRow; onClose: () => void; onDone: () => void }) {
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
                            {row.full_name} (C.C. {row.cc}) owes <b className="text-red-600">{rs(row.owed)}</b> in fees dated on or before {fmtDate(row.fee_date)}
                            {row.not_billed_owed > 0 ? `, ${rs(row.not_billed_owed)} of it never billed` : ""}. The reason and your name are recorded on the document and in the
                            activity log.
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
