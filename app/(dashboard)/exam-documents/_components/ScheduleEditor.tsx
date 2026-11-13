"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardPaste, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { campusesService, type Campus, type CampusClassInfo } from "@/lib/campuses.service";
import { newKey, parsePaste, type GridRow } from "./schedule-paste";
import {
    DOC_TYPE_LABELS,
    examDocumentsService,
    type ExamPaper,
    type ExamSchedule,
    type ExamScheduleUpsert,
} from "@/lib/exam-documents.service";

/** VI–X (15–19) get an admit card; every other class a statement of entry. Mirrors the backend. */
const SECONDARY = new Set([15, 16, 17, 18, 19]);
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];


function currentAcademicYear() {
    const d = new Date();
    const y = d.getFullYear();
    return d.getMonth() + 1 >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

const errMsg = (err: unknown, fallback: string) => {
    const m = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
    return Array.isArray(m) ? m.join(", ") : typeof m === "string" ? m : fallback;
};

function rowsFromPapers(papers: ExamPaper[]): GridRow[] {
    const byKey = new Map<string, GridRow>();
    for (const p of papers) {
        const k = `${p.paper_date}|${p.time_text}`;
        let row = byKey.get(k);
        if (!row) {
            row = { key: newKey(), date: p.paper_date, time: p.time_text, cells: {} };
            byKey.set(k, row);
        }
        row.cells[p.class_id] = row.cells[p.class_id] ? `${row.cells[p.class_id]} / ${p.subject}` : p.subject;
    }
    return [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

const input =
    "w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-2 focus:ring-primary/20";
const label = "text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] ml-1";

export function ScheduleEditor({
    schedule,
    readOnly,
    onSaved,
    onCancel,
}: {
    schedule?: ExamSchedule;
    readOnly?: boolean;
    onSaved: (s: ExamSchedule) => void;
    onCancel?: () => void;
}) {
    const [campuses, setCampuses] = useState<Campus[]>([]);
    const [allClasses, setAllClasses] = useState<CampusClassInfo[]>([]);
    const [campusId, setCampusId] = useState<number | null>(schedule?.campus_id ?? null);
    const [academicYear, setAcademicYear] = useState(schedule?.academic_year ?? currentAcademicYear());
    const [title, setTitle] = useState(schedule?.title ?? "");
    const [segmentLine, setSegmentLine] = useState(schedule?.segment_line ?? "");
    const [referenceNo, setReferenceNo] = useState(schedule?.reference_no ?? "");
    const [feeDate, setFeeDate] = useState(schedule?.fee_date ?? "");
    const [issueFrom, setIssueFrom] = useState(schedule?.issue_from ?? "");
    const [classIds, setClassIds] = useState<number[]>(schedule?.classes.map((c) => c.id) ?? []);
    const [rows, setRows] = useState<GridRow[]>(() => (schedule ? rowsFromPapers(schedule.papers) : []));
    const [notesText, setNotesText] = useState((schedule?.notes ?? []).join("\n"));
    const [pasteOpen, setPasteOpen] = useState(false);
    const [pasteText, setPasteText] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        campusesService.list().then(setCampuses).catch(() => toast.error("Could not load campuses"));
        campusesService.listAllClasses().then((cs) => setAllClasses([...cs].sort((a, b) => a.id - b.id))).catch(() => toast.error("Could not load classes"));
    }, []);

    useEffect(() => {
        if (!campusId && campuses.length === 1) setCampusId(campuses[0].id);
    }, [campuses, campusId]);

    const sortedClassIds = useMemo(() => [...classIds].sort((a, b) => a - b), [classIds]);
    const className = (id: number) => allClasses.find((c) => c.id === id)?.description ?? `Class ${id}`;
    const defaultTime = rows[rows.length - 1]?.time || "8:00 – 11:30";

    const toggleClass = (id: number) => setClassIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    const updateRow = (key: string, patch: Partial<GridRow>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    const setCell = (key: string, classId: number, v: string) =>
        setRows((prev) => prev.map((r) => (r.key === key ? { ...r, cells: { ...r.cells, [classId]: v } } : r)));

    const applyPaste = () => {
        if (!sortedClassIds.length) return toast.error("Tick the classes first, in the order of the sheet's columns");
        const parsed = parsePaste(pasteText, sortedClassIds, defaultTime);
        if (!parsed.length) return toast.error("No rows with a date were found in what you pasted");
        setRows(parsed);
        setPasteOpen(false);
        setPasteText("");
        toast.success(`${parsed.length} rows read. Check them before saving.`);
    };

    const papers = (): ExamPaper[] =>
        rows.flatMap((r) =>
            sortedClassIds
                .map((id) => ({ id, subject: (r.cells[id] ?? "").trim() }))
                .filter((c) => c.subject && c.subject !== "-")
                .map((c) => ({ class_id: c.id, paper_date: r.date, time_text: r.time.trim(), subject: c.subject })),
        );

    const save = async () => {
        if (!campusId) return toast.error("Choose the campus");
        if (!title.trim()) return toast.error("Give the assessment a title");
        if (!feeDate) return toast.error("Choose the fee date dues must be cleared through");
        if (!sortedClassIds.length) return toast.error("Tick at least one class");
        const bad = rows.find((r) => !r.date || !r.time.trim());
        if (bad) return toast.error("Every row needs a date and a time");
        const body: ExamScheduleUpsert = {
            campus_id: campusId,
            academic_year: academicYear.trim(),
            title: title.trim(),
            segment_line: segmentLine.trim() || undefined,
            reference_no: referenceNo.trim() || undefined,
            fee_date: feeDate,
            issue_from: issueFrom || undefined,
            notes: notesText.split(/\r?\n/).map((n) => n.replace(/^\s*(\d+[.)]|[•·-])\s*/, "").trim()).filter(Boolean),
            class_ids: sortedClassIds,
            papers: papers(),
        };
        setSaving(true);
        try {
            const saved = schedule
                ? await examDocumentsService.updateSchedule(schedule.id, body)
                : await examDocumentsService.createSchedule(body);
            toast.success("Schedule saved");
            onSaved(saved);
        } catch (err) {
            toast.error(errMsg(err, "Could not save the schedule"));
        } finally {
            setSaving(false);
        }
    };

    const ro = Boolean(readOnly);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                    <span className={label}>Campus</span>
                    <select disabled={ro} value={campusId ?? ""} onChange={(e) => setCampusId(Number(e.target.value) || null)} className={input}>
                        <option value="">Choose…</option>
                        {campuses.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.campus_name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col gap-1.5">
                    <span className={label}>Academic year</span>
                    <input disabled={ro} value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="2026-2027" className={input} />
                </div>
                <div className="flex flex-col gap-1.5">
                    <span className={label}>Reference #</span>
                    <input disabled={ro} value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder="TAFSAL-0001/…" className={input} />
                </div>
                <div className="flex flex-col gap-1.5 md:col-span-2">
                    <span className={label}>Assessment (printed as the title)</span>
                    <input disabled={ro} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="FIRST SEMESTER ASSESSMENTS" className={input} />
                </div>
                <div className="flex flex-col gap-1.5">
                    <span className={label}>Line under the title</span>
                    <input disabled={ro} value={segmentLine} onChange={(e) => setSegmentLine(e.target.value)} placeholder="SENIOR CAMBRIDGE" className={input} />
                </div>
                <div className="flex flex-col gap-1.5">
                    <span className={label}>Fee date</span>
                    <input disabled={ro} type="date" value={feeDate} onChange={(e) => setFeeDate(e.target.value)} className={input} />
                    <span className="text-xs text-zinc-500 ml-1">Every fee head dated on or before this must be paid. Heads are dated the 1st, so 1 Dec means through December.</span>
                </div>
                <div className="flex flex-col gap-1.5">
                    <span className={label}>Issue from</span>
                    <input disabled={ro} type="date" value={issueFrom} onChange={(e) => setIssueFrom(e.target.value)} className={input} />
                    <span className="text-xs text-zinc-500 ml-1">No document can be issued before this date.</span>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <span className={label}>Classes</span>
                <div className="flex flex-wrap gap-2">
                    {allClasses.map((c) => {
                        const on = classIds.includes(c.id);
                        return (
                            <button
                                key={c.id}
                                type="button"
                                disabled={ro}
                                onClick={() => toggleClass(c.id)}
                                className={`h-8 px-3 rounded-lg text-xs font-semibold border transition ${
                                    on
                                        ? "bg-primary text-white border-primary"
                                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300"
                                } disabled:opacity-70`}
                                title={SECONDARY.has(c.id) ? DOC_TYPE_LABELS.ADMIT_CARD : DOC_TYPE_LABELS.STATEMENT_OF_ENTRY}
                            >
                                {c.description}
                            </button>
                        );
                    })}
                </div>
                {sortedClassIds.length > 0 && (
                    <p className="text-xs text-zinc-500 ml-1">
                        {sortedClassIds.filter((id) => SECONDARY.has(id)).length > 0 &&
                            `Admit card: ${sortedClassIds.filter((id) => SECONDARY.has(id)).map(className).join(", ")}. `}
                        {sortedClassIds.filter((id) => !SECONDARY.has(id)).length > 0 &&
                            `Statement of entry (Cambridge logo): ${sortedClassIds.filter((id) => !SECONDARY.has(id)).map(className).join(", ")}.`}
                    </p>
                )}
            </div>

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                    <div>
                        <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Papers</p>
                        <p className="text-xs text-zinc-500">One row per paper day. Leave a cell empty, or put “-”, when that class has no paper.</p>
                    </div>
                    {!ro && (
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setPasteOpen(true)} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                                <ClipboardPaste className="h-4 w-4" /> Paste from Excel
                            </button>
                            <button
                                type="button"
                                onClick={() => setRows((prev) => [...prev, { key: newKey(), date: "", time: defaultTime, cells: {} }])}
                                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                            >
                                <Plus className="h-4 w-4" /> Add day
                            </button>
                        </div>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                                <th className="py-2 px-3 font-medium min-w-[170px]">Date</th>
                                <th className="py-2 px-3 font-medium min-w-[140px]">Time</th>
                                {sortedClassIds.map((id) => (
                                    <th key={id} className="py-2 px-3 font-medium min-w-[230px]">
                                        {className(id)}
                                    </th>
                                ))}
                                {!ro && <th className="w-10" />}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={sortedClassIds.length + 3} className="py-10 text-center text-zinc-400 text-sm">
                                        No papers yet. Add a day, or paste the rows from the school&apos;s Excel sheet.
                                    </td>
                                </tr>
                            ) : (
                                rows.map((r) => (
                                    <tr key={r.key} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 align-top">
                                        <td className="py-2 px-3">
                                            <input disabled={ro} type="date" value={r.date} onChange={(e) => updateRow(r.key, { date: e.target.value })} className={input} />
                                            <span className="text-[11px] text-zinc-400 ml-1">{r.date ? DAYS[new Date(`${r.date}T00:00:00`).getDay()] : ""}</span>
                                        </td>
                                        <td className="py-2 px-3">
                                            <input disabled={ro} value={r.time} onChange={(e) => updateRow(r.key, { time: e.target.value })} className={input} />
                                        </td>
                                        {sortedClassIds.map((id) => (
                                            <td key={id} className="py-2 px-3">
                                                <input
                                                    disabled={ro}
                                                    value={r.cells[id] ?? ""}
                                                    onChange={(e) => setCell(r.key, id, e.target.value.toUpperCase())}
                                                    placeholder="-"
                                                    className={input}
                                                />
                                            </td>
                                        ))}
                                        {!ro && (
                                            <td className="py-2 px-2">
                                                <button type="button" onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))} className="h-10 w-8 inline-flex items-center justify-center text-zinc-400 hover:text-red-500" title="Remove this day">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <span className={label}>Notes printed on every document (one per line)</span>
                <textarea disabled={ro} value={notesText} onChange={(e) => setNotesText(e.target.value)} rows={8} className={`${input} h-auto py-2 leading-relaxed`} />
            </div>

            {!ro && (
                <div className="flex justify-end gap-2">
                    {onCancel && (
                        <button type="button" onClick={onCancel} className="h-10 px-4 rounded-xl text-sm font-semibold border border-zinc-200 dark:border-zinc-800">
                            Cancel
                        </button>
                    )}
                    <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 h-10 px-5 rounded-xl text-sm font-semibold bg-primary text-white disabled:opacity-60">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save schedule
                    </button>
                </div>
            )}

            {pasteOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPasteOpen(false)}>
                    <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="font-bold text-zinc-900 dark:text-zinc-100">Paste from Excel</p>
                                <p className="text-xs text-zinc-500 mt-1">
                                    Copy the schedule rows (DAY, DATE, TIME, then one subject per class) and paste them here. Columns are matched to the
                                    ticked classes in order: {sortedClassIds.map(className).join(", ") || "tick the classes first"}. This replaces the papers below.
                                </p>
                            </div>
                            <button type="button" onClick={() => setPasteOpen(false)} className="text-zinc-400 hover:text-zinc-700">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={10} className={`${input} h-auto py-2 font-mono text-xs`} autoFocus />
                        <div className="flex justify-end">
                            <button type="button" onClick={applyPaste} className="h-10 px-4 rounded-xl text-sm font-semibold bg-primary text-white">
                                Read rows
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
