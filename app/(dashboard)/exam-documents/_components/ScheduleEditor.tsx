"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookmarkPlus, LayoutTemplate, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { campusesService, type Campus } from "@/lib/campuses.service";
import { getAcademicYears } from "@/lib/fee-utils";
import { newKey, type GridRow } from "./schedule-grid";
import {
    DOC_TYPE_LABELS,
    examDocumentsService,
    inferScheduleLayout,
    SCHEDULE_LAYOUT_LABELS,
    SCHEDULE_LAYOUTS,
    type ExamPaper,
    type ExamPreset,
    type ExamPresetRow,
    type ExamSchedule,
    type ExamScheduleUpsert,
    type ScheduleLayout,
} from "@/lib/exam-documents.service";

/** VI–X (15–19) get an admit card; every other class a statement of entry. Mirrors the backend. */
const SECONDARY = new Set([15, 16, 17, 18, 19]);
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];


/** TAFSD-522: sessions offered in the dropdown, last year to two ahead; the current one is the default. */
const SESSIONS = getAcademicYears(1, 2);
const CURRENT_SESSION = SESSIONS[1];

const errMsg = (err: unknown, fallback: string) => {
    const m = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
    return Array.isArray(m) ? m.join(", ") : typeof m === "string" ? m : fallback;
};

/**
 * Saved papers back into grid rows: one per date and time, or, when every class
 * has its own timing column (O Levels), one per date with each class's time.
 */
function rowsFromPapers(papers: ExamPaper[], timingPerClass: boolean): GridRow[] {
    const byKey = new Map<string, GridRow>();
    for (const p of papers) {
        const k = timingPerClass ? p.paper_date : `${p.paper_date}|${p.time_text}`;
        let row = byKey.get(k);
        if (!row) {
            row = { key: newKey(), date: p.paper_date, time: p.time_text, cells: {}, times: {} };
            byKey.set(k, row);
        }
        const had = row.cells[p.class_id];
        row.cells[p.class_id] = had ? `${had} / ${p.subject}` : p.subject;
        if (timingPerClass) {
            const t = row.times![p.class_id];
            row.times![p.class_id] = had && t ? (t === p.time_text ? t : `${t} / ${p.time_text}`) : p.time_text;
        }
    }
    return [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

/** TAFSD-525: a preset's rows into the grid, dates left for the admin. */
const rowsFromPreset = (rows: ExamPresetRow[]): GridRow[] =>
    rows.map((r) => ({
        key: newKey(),
        date: "",
        time: r.time,
        cells: Object.fromEntries(Object.entries(r.cells).map(([k, v]) => [Number(k), v])),
        times: Object.fromEntries(Object.entries(r.times ?? {}).map(([k, v]) => [Number(k), v])),
    }));

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
    const [campusId, setCampusId] = useState<number | null>(schedule?.campus_id ?? null);
    const [academicYear, setAcademicYear] = useState(schedule?.academic_year ?? CURRENT_SESSION);
    const [title, setTitle] = useState(schedule?.title ?? "");
    const [segmentLine, setSegmentLine] = useState(schedule?.segment_line ?? "");
    const [referenceNo, setReferenceNo] = useState(schedule?.reference_no ?? "");
    const [feeDate, setFeeDate] = useState(schedule?.fee_date ?? "");
    const [issueFrom, setIssueFrom] = useState(schedule?.issue_from ?? "");
    const [classIds, setClassIds] = useState<number[]>(schedule?.classes.map((c) => c.id) ?? []);
    // TAFSD-525: "" means the layout follows the classes.
    const [layoutChoice, setLayoutChoice] = useState<ScheduleLayout | "">(schedule?.layout_chosen ? schedule.layout : "");
    const [rows, setRows] = useState<GridRow[]>(() => (schedule ? rowsFromPapers(schedule.papers, schedule.layout === "O_LEVEL") : []));
    const [notesText, setNotesText] = useState((schedule?.notes ?? []).join("\n"));
    const [saving, setSaving] = useState(false);
    const [presets, setPresets] = useState<ExamPreset[]>([]);
    const [presetId, setPresetId] = useState<number | null>(null);
    const [presetName, setPresetName] = useState<string | null>(null);
    const [savingPreset, setSavingPreset] = useState(false);

    useEffect(() => {
        campusesService.list().then(setCampuses).catch(() => toast.error("Could not load campuses"));
        examDocumentsService.listPresets().then(setPresets).catch(() => toast.error("Could not load presets"));
    }, []);

    useEffect(() => {
        if (!campusId && campuses.length === 1) setCampusId(campuses[0].id);
    }, [campuses, campusId]);

    // TAFSD-523: the classes on offer are the chosen campus's own.
    const campusClasses = useMemo(
        () =>
            (campuses.find((c) => c.id === campusId)?.offered_classes ?? [])
                .filter((c) => c.is_active !== false)
                .sort((a, b) => a.id - b.id),
        [campuses, campusId],
    );
    const offeredIds = useMemo(() => new Set(campusClasses.map((c) => c.id)), [campusClasses]);
    const sortedClassIds = useMemo(() => [...classIds].sort((a, b) => a - b), [classIds]);
    // Names from every campus, so a class ticked at another campus is still named after a switch.
    const classNames = useMemo(() => {
        const m = new Map<number, string>((schedule?.classes ?? []).map((c) => [c.id, c.description]));
        for (const p of presets) for (const c of p.classes) m.set(c.id, c.description);
        for (const c of campuses) for (const oc of c.offered_classes ?? []) m.set(oc.id, oc.description);
        return m;
    }, [campuses, schedule, presets]);
    const className = (id: number) => classNames.get(id) ?? `Class ${id}`;
    // Ticked classes the campus does not offer (after the campus was changed); they block saving.
    const notOffered = campuses.length && campusId ? sortedClassIds.filter((id) => !offeredIds.has(id)) : [];
    // TAFSD-522: a saved session outside the usual range still shows, selected.
    const sessions = SESSIONS.includes(academicYear) ? SESSIONS : [...SESSIONS, academicYear].sort();
    const defaultTime = rows[rows.length - 1]?.time || "8:00 – 11:30";
    const layout = layoutChoice || inferScheduleLayout(sortedClassIds);
    const timingPerClass = layout === "O_LEVEL";

    const toggleClass = (id: number) => setClassIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    const updateRow = (key: string, patch: Partial<GridRow>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    const setCell = (key: string, classId: number, v: string) =>
        setRows((prev) => prev.map((r) => (r.key === key ? { ...r, cells: { ...r.cells, [classId]: v } } : r)));
    const setCellTime = (key: string, classId: number, v: string) =>
        setRows((prev) => prev.map((r) => (r.key === key ? { ...r, times: { ...(r.times ?? {}), [classId]: v } } : r)));
    /** A class's time in a row: its own on the O Level layout, else the row's. */
    const cellTime = (r: GridRow, id: number) => (timingPerClass ? r.times?.[id]?.trim() : "") || r.time.trim();

    const papers = (): ExamPaper[] =>
        rows.flatMap((r) =>
            sortedClassIds
                .map((id) => ({ id, subject: (r.cells[id] ?? "").trim() }))
                .filter((c) => c.subject && c.subject !== "-")
                .map((c) => ({ class_id: c.id, paper_date: r.date, time_text: cellTime(r, c.id), subject: c.subject })),
        );

    // ── Presets (TAFSD-525) ──────────────────────────────────────────────
    const applyPreset = (id: number) => {
        const p = presets.find((x) => x.id === id);
        if (!p) return;
        const hasWork = rows.some((r) => Object.values(r.cells).some((v) => v.trim())) || title.trim();
        if (hasWork && !window.confirm(`Replace the title, classes, papers and notes with "${p.name}"?`)) return;
        setPresetId(p.id);
        setTitle(p.title);
        setSegmentLine(p.segment_line ?? "");
        setClassIds(p.classes.map((c) => c.id));
        setLayoutChoice(p.layout);
        setRows(rowsFromPreset(p.rows));
        setNotesText(p.notes.join("\n"));
        toast.success("Preset filled in. Enter the date of each paper day, and check the notes for this term's dates.");
    };

    const removePreset = async () => {
        const p = presets.find((x) => x.id === presetId);
        if (!p || !window.confirm(`Remove the preset "${p.name}"? Schedules made from it are not changed.`)) return;
        try {
            await examDocumentsService.deletePreset(p.id);
            setPresets((prev) => prev.filter((x) => x.id !== p.id));
            setPresetId(null);
            toast.success("Preset removed");
        } catch (err) {
            toast.error(errMsg(err, "Could not remove the preset"));
        }
    };

    const savePreset = async () => {
        const name = (presetName ?? "").trim();
        if (!name) return toast.error("Name the preset");
        if (!title.trim()) return toast.error("Give the assessment a title first");
        if (!sortedClassIds.length) return toast.error("Tick at least one class first");
        const presetRows: ExamPresetRow[] = rows.map((r) => {
            const cells: Record<string, string> = {};
            const times: Record<string, string> = {};
            for (const id of sortedClassIds) {
                const v = (r.cells[id] ?? "").trim();
                if (v && v !== "-") cells[id] = v;
                const t = r.times?.[id]?.trim();
                if (timingPerClass && t && t !== r.time.trim()) times[id] = t;
            }
            return { time: r.time.trim(), cells, ...(Object.keys(times).length ? { times } : {}) };
        });
        setSavingPreset(true);
        try {
            const saved = await examDocumentsService.createPreset({
                name,
                layout,
                title: title.trim(),
                segment_line: segmentLine.trim() || undefined,
                class_ids: sortedClassIds,
                rows: presetRows,
                notes: notesText.split(/\r?\n/).map((n) => n.replace(/^\s*(\d+[.)]|[•·-])\s*/, "").trim()).filter(Boolean),
            });
            setPresets((prev) => [...prev, saved]);
            setPresetId(saved.id);
            setPresetName(null);
            toast.success("Saved as a preset. Its dates are left out.");
        } catch (err) {
            toast.error(errMsg(err, "Could not save the preset"));
        } finally {
            setSavingPreset(false);
        }
    };

    const save = async () => {
        if (!campusId) return toast.error("Choose the campus");
        if (!academicYear) return toast.error("Choose the academic session");
        if (notOffered.length) return toast.error(`${notOffered.map(className).join(", ")} ${notOffered.length === 1 ? "is" : "are"} not offered at this campus. Untick ${notOffered.length === 1 ? "it" : "them"} first.`);
        if (!title.trim()) return toast.error("Give the assessment a title");
        if (!feeDate) return toast.error("Choose the fee date dues must be cleared through");
        if (!sortedClassIds.length) return toast.error("Tick at least one class");
        const bad = rows.find((r) => !r.date || !r.time.trim());
        if (bad) return toast.error(bad.date ? "Every row needs a time" : "Enter the date of every paper day");
        const body: ExamScheduleUpsert = {
            campus_id: campusId,
            academic_year: academicYear,
            title: title.trim(),
            segment_line: segmentLine.trim() || undefined,
            reference_no: referenceNo.trim() || undefined,
            layout: layoutChoice || undefined,
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

    const presetBar = !ro && presets.length > 0 && (
        <div className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30 p-4 flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
                <span className={label}>Start from a preset</span>
                <select value={presetId ?? ""} onChange={(e) => Number(e.target.value) && applyPreset(Number(e.target.value))} className={input}>
                    <option value="">Choose a preset…</option>
                    {presets.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.name} · {SCHEDULE_LAYOUT_LABELS[p.layout]}
                        </option>
                    ))}
                </select>
                <span className="text-xs text-zinc-500 ml-1">Fills the title, classes, layout, every paper&rsquo;s subject and the notes. You enter the dates.</span>
            </div>
            {presetId && (
                <button type="button" onClick={removePreset} className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-xs font-semibold border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-red-600 whitespace-nowrap">
                    <Trash2 className="h-4 w-4" /> Remove this preset
                </button>
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            {presetBar}
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
                    <span className={label}>Academic session</span>
                    <select disabled={ro} value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className={input}>
                        {sessions.map((y) => (
                            <option key={y} value={y}>
                                {y}
                            </option>
                        ))}
                    </select>
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
                    <span className={label}>Excel layout</span>
                    <select disabled={ro} value={layoutChoice} onChange={(e) => setLayoutChoice(e.target.value as ScheduleLayout | "")} className={input}>
                        <option value="">Match the classes ({SCHEDULE_LAYOUT_LABELS[inferScheduleLayout(sortedClassIds)]})</option>
                        {SCHEDULE_LAYOUTS.map((l) => (
                            <option key={l} value={l}>
                                {SCHEDULE_LAYOUT_LABELS[l]}
                            </option>
                        ))}
                    </select>
                    <span className="text-xs text-zinc-500 ml-1">Logos, school name, columns and footer of the exported sheet.</span>
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
                {!campusId ? (
                    <p className="text-xs text-zinc-500 ml-1">Choose the campus to see the classes it offers.</p>
                ) : campuses.length > 0 && campusClasses.length === 0 && notOffered.length === 0 ? (
                    <p className="text-xs text-zinc-500 ml-1">This campus has no classes set up. Add them under Campuses first.</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {campusClasses.map((c) => {
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
                        {notOffered.map((id) => (
                            <button
                                key={`x-${id}`}
                                type="button"
                                disabled={ro}
                                onClick={() => toggleClass(id)}
                                className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-semibold border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 disabled:opacity-70"
                                title="Not offered at this campus. Click to untick."
                            >
                                <AlertTriangle className="h-3.5 w-3.5" /> {className(id)}
                                {!ro && <X className="h-3.5 w-3.5" />}
                            </button>
                        ))}
                    </div>
                )}
                {notOffered.length > 0 && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 ml-1">
                        {notOffered.map(className).join(", ")} {notOffered.length === 1 ? "is" : "are"} not offered at this campus. Untick{" "}
                        {notOffered.length === 1 ? "it" : "them"} before saving; {notOffered.length === 1 ? "its" : "their"} papers go with {notOffered.length === 1 ? "it" : "them"}.
                    </p>
                )}
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
                        <p className="text-xs text-zinc-500">
                            One row per paper day. Leave a cell empty, or put “-”, when that class has no paper.
                            {timingPerClass && " Each level has its own time under its subject; left empty, it takes the row's."}
                        </p>
                    </div>
                    {!ro && (
                        <div className="flex gap-2">
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
                                <th className="py-2 px-3 font-medium min-w-[140px]">{timingPerClass ? "Time (default)" : "Time"}</th>
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
                                        No papers yet. Add a day for each paper date.
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
                                                {timingPerClass && (
                                                    <input
                                                        disabled={ro}
                                                        value={r.times?.[id] ?? ""}
                                                        onChange={(e) => setCellTime(r.key, id, e.target.value)}
                                                        placeholder={r.time || "Time"}
                                                        aria-label={`${className(id)} time`}
                                                        className={`${input} h-8 mt-1 text-xs`}
                                                    />
                                                )}
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
                <div className="flex flex-wrap justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => setPresetName(`${title.trim() || "Schedule"} — ${sortedClassIds.map(className).join(", ")}`)}
                        className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold border border-zinc-200 dark:border-zinc-800 mr-auto"
                        title="Keep the layout, classes, subjects and notes to start another schedule from. Dates are not kept."
                    >
                        <BookmarkPlus className="h-4 w-4" /> Save as preset
                    </button>
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

            {presetName !== null && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !savingPreset && setPresetName(null)}>
                    <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                            <LayoutTemplate className="h-5 w-5 text-blue-500" />
                            <p className="font-bold text-zinc-900 dark:text-zinc-100">Save as preset</p>
                        </div>
                        <p className="text-sm text-zinc-500">
                            Keeps the {SCHEDULE_LAYOUT_LABELS[layout]} layout, the title, {sortedClassIds.length} {sortedClassIds.length === 1 ? "class" : "classes"}, {rows.length}{" "}
                            paper {rows.length === 1 ? "day" : "days"} with their subjects, and the notes. Dates and the campus are left out.
                        </p>
                        <div className="flex flex-col gap-1.5">
                            <span className={label}>Preset name</span>
                            <input autoFocus value={presetName} onChange={(e) => setPresetName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && savePreset()} className={input} />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button type="button" disabled={savingPreset} onClick={() => setPresetName(null)} className="h-10 px-4 rounded-xl text-sm font-semibold border border-zinc-200 dark:border-zinc-800">
                                Cancel
                            </button>
                            <button type="button" disabled={savingPreset} onClick={savePreset} className="inline-flex items-center gap-1.5 h-10 px-5 rounded-xl text-sm font-semibold bg-primary text-white disabled:opacity-60">
                                {savingPreset ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />} Save preset
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
