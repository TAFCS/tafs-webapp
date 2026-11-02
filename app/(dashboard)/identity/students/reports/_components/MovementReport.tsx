"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Download, GraduationCap, Info, Loader2, Printer, SlidersHorizontal, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCampuses } from "@/src/store/slices/campusesSlice";
import { fetchClasses } from "@/src/store/slices/classesSlice";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { toggleId } from "@/components/filters/filter-params";
import { useStudentAccess } from "@/hooks/use-student-access";
import { downloadReportFile, reportExportErrorMessage } from "@/app/(dashboard)/financial-reports/_components/download-report";
import { PaperPicker, loadSavedPaper, savePaper, type PdfPaper } from "@/app/(dashboard)/financial-reports/_components/pdf-paper";
import {
    movementParams,
    movementService,
    type MovementCellStudent,
    type MovementDeparture,
    type MovementFilters,
    type MovementGrid,
    type MovementMeasure,
    type StrengthColumn,
    type StrengthRow,
} from "@/lib/student-reports.service";
import { StrengthTable } from "./StrengthTable";

const MEASURES: { id: MovementMeasure; label: string }[] = [
    { id: "both", label: "Both, with net" },
    { id: "admissions", label: "Admissions" },
    { id: "withdrawals", label: "Withdrawals" },
];
const DEPARTURES: { id: MovementDeparture; label: string }[] = [
    { id: "LEFT", label: "Left" },
    { id: "EXPELLED", label: "Expelled" },
    { id: "GRADUATED", label: "Graduated" },
];

const pktToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
/** 1 August of the current session. */
const sessionStart = (today: string) => {
    const y = Number(today.slice(0, 4));
    return `${Number(today.slice(5, 7)) >= 8 ? y : y - 1}-08-01`;
};
const shortDate = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const segBtn = (on: boolean) =>
    `px-3 h-9 text-[12px] font-bold ${on ? "bg-primary text-white" : "bg-white dark:bg-zinc-950 text-zinc-600 hover:bg-zinc-50"}`;
const caption = "block text-[10px] font-black uppercase tracking-widest text-zinc-400";
const inputCls =
    "h-9 px-3 text-[12px] font-bold bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-primary";

/**
 * TAFSD-453: Admissions and Withdrawals (report C). Admissions by date of
 * admission; withdrawals on the day the student was marked as left. Rows by
 * campus or class, columns by month or session, every number opens its students.
 */
export function MovementReport() {
    const dispatch = useAppDispatch();
    const access = useStudentAccess();
    const { items: campuses } = useAppSelector((s) => s.campuses);
    const { items: classes } = useAppSelector((s) => s.classes);

    const [filters, setFilters] = useState<MovementFilters>(() => {
        const today = pktToday();
        return { campus_id: [], class_id: [], measure: "both", rows: "class", period: "month", from: sessionStart(today), to: today, departures: ["LEFT"] };
    });
    const [grid, setGrid] = useState<MovementGrid | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cell, setCell] = useState<{ row?: string; column?: string; title: string } | null>(null);
    const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);
    const [part, setPart] = useState<"summary" | "list">("summary");
    const [paper, setPaper] = useState<PdfPaper>("A4");
    const [pdfOpen, setPdfOpen] = useState(false);

    useEffect(() => {
        dispatch(fetchCampuses());
        dispatch(fetchClasses());
        setPaper(loadSavedPaper());
    }, [dispatch]);

    useEffect(() => {
        if (!filters.from || !filters.to) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        movementService
            .grid(filters)
            .then((g) => !cancelled && setGrid(g))
            .catch((e) => !cancelled && setError(e?.response?.data?.message || "Could not load the report."))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [filters]);

    const set = <K extends keyof MovementFilters>(key: K, value: MovementFilters[K]) => setFilters((f) => ({ ...f, [key]: value }));
    const campusOptions = campuses.map((c: { id: number; campus_name: string }) => ({ id: c.id, label: c.campus_name }));
    const classOptions = classes.map((c: { id: number; description: string }) => ({ id: c.id, label: c.description }));

    const openCell = ({ row, column }: { row?: StrengthRow; column?: StrengthColumn }) => {
        const where = row ? (row.level === "class" ? `${row.campus} · ${row.label}` : row.label) : "All campuses";
        const what = column ? [column.group, column.label].filter(Boolean).join(" · ") : null;
        setCell({ row: row?.key, column: column?.key, title: what ? `${where} — ${what}` : where });
    };
    const cellQuery = useMemo(() => (cell ? { row: cell.row, column: cell.column } : null), [cell]);

    const exportReport = async (format: "xlsx" | "pdf") => {
        setExporting(format);
        try {
            const params = { ...movementParams(filters), format, part, ...(format === "pdf" ? { paper } : {}) };
            await downloadReportFile(
                "/v1/student-reports/movement/export",
                params,
                `admissions-withdrawals${part === "list" ? "-list" : ""}-${filters.from}-to-${filters.to}.${format}`,
            );
            if (format === "pdf") {
                savePaper(paper);
                setPdfOpen(false);
            }
        } catch (err) {
            toast.error(await reportExportErrorMessage(err, "Could not download the report."));
        } finally {
            setExporting(null);
        }
    };

    return (
        <div className="space-y-5">
            {/* Layout */}
            <div className="flex flex-wrap items-end gap-3">
                <label className="space-y-1">
                    <span className={caption}>Show</span>
                    <div className="flex rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                        {MEASURES.map((m) => (
                            <button key={m.id} type="button" onClick={() => set("measure", m.id)} className={segBtn(filters.measure === m.id)}>
                                {m.label}
                            </button>
                        ))}
                    </div>
                </label>
                <label className="space-y-1">
                    <span className={caption}>Rows</span>
                    <div className="flex rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                        <button type="button" onClick={() => set("rows", "campus")} className={segBtn(filters.rows === "campus")}>
                            Campus
                        </button>
                        <button type="button" onClick={() => set("rows", "class")} className={segBtn(filters.rows === "class")}>
                            + Class
                        </button>
                    </div>
                </label>
                <label className="space-y-1">
                    <span className={caption}>Columns</span>
                    <div className="flex rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                        <button type="button" onClick={() => set("period", "month")} className={segBtn(filters.period === "month")}>
                            Month by month
                        </button>
                        <button type="button" onClick={() => set("period", "session")} className={segBtn(filters.period === "session")}>
                            Session by session
                        </button>
                    </div>
                </label>
                <label className="space-y-1">
                    <span className={caption}>From</span>
                    <input type="date" className={inputCls} value={filters.from} max={filters.to} onChange={(e) => e.target.value && set("from", e.target.value)} />
                </label>
                <label className="space-y-1">
                    <span className={caption}>To</span>
                    <input type="date" className={inputCls} value={filters.to} min={filters.from} onChange={(e) => e.target.value && set("to", e.target.value)} />
                </label>
            </div>

            {/* Filters */}
            <div className="flex items-end gap-2 flex-wrap">
                <SlidersHorizontal className="h-4 w-4 text-zinc-400 shrink-0 mb-3.5" />
                <div className="w-[180px]">
                    <FilterDropdown label="Campus" icon={Building2} value={filters.campus_id} options={campusOptions} placeholder="All Campuses" onToggle={(id) => set("campus_id", toggleId(filters.campus_id, id))} onClear={() => set("campus_id", [])} />
                </div>
                <div className="w-[180px]">
                    <FilterDropdown label="Class" icon={GraduationCap} value={filters.class_id} options={classOptions} placeholder="All Classes" onToggle={(id) => set("class_id", toggleId(filters.class_id, id))} onClear={() => set("class_id", [])} />
                </div>
                {filters.measure !== "admissions" && (
                    <div className="flex items-center gap-3 h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Withdrawal =</span>
                        {DEPARTURES.map((d) => (
                            <label key={d.id} className="flex items-center gap-1.5 text-[12px] font-bold text-zinc-700 dark:text-zinc-300">
                                <input
                                    type="checkbox"
                                    checked={filters.departures.includes(d.id)}
                                    onChange={() => {
                                        const next = filters.departures.includes(d.id) ? filters.departures.filter((x) => x !== d.id) : [...filters.departures, d.id];
                                        if (next.length) set("departures", next);
                                    }}
                                />
                                {d.label}
                            </label>
                        ))}
                    </div>
                )}
                {access.can("export") && (
                    <div className="relative ml-auto flex items-center gap-2">
                        <select aria-label="What to download" value={part} onChange={(e) => setPart(e.target.value as "summary" | "list")} className={inputCls}>
                            <option value="summary">Summary (counts)</option>
                            <option value="list">Student list</option>
                        </select>
                        <button
                            type="button"
                            onClick={() => setPdfOpen((o) => !o)}
                            disabled={!!exporting || !grid}
                            className="flex items-center gap-1.5 px-3 h-9 text-[11px] font-bold text-rose-700 bg-rose-50 rounded-xl hover:bg-rose-100 disabled:opacity-50"
                        >
                            {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                            Download PDF
                        </button>
                        <button
                            type="button"
                            onClick={() => exportReport("xlsx")}
                            disabled={!!exporting || !grid}
                            className="flex items-center gap-1.5 px-3 h-9 text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-xl hover:bg-emerald-100 disabled:opacity-50"
                        >
                            {exporting === "xlsx" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            Download Excel
                        </button>
                        {pdfOpen && (
                            <div className="absolute right-0 top-11 z-30 w-72 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 shadow-xl space-y-3">
                                <PaperPicker paper={paper} onChange={setPaper} note="A sheet too wide for A4 prints on A3 anyway." />
                                <button
                                    type="button"
                                    onClick={() => exportReport("pdf")}
                                    disabled={!!exporting}
                                    className="w-full flex items-center justify-center gap-1.5 h-9 text-[11px] font-bold text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 rounded-xl disabled:opacity-50"
                                >
                                    {exporting === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                                    Download {paper} PDF
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {error && <p className="rounded-xl bg-rose-50 text-rose-700 text-sm px-4 py-3">{error}</p>}
            {!grid && loading && (
                <div className="py-20 flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                </div>
            )}
            {grid && !error && grid.student_count === 0 && !loading && (
                <p className="py-16 text-center text-sm text-zinc-500">No admissions or withdrawals in these dates.</p>
            )}
            {grid && !error && grid.student_count > 0 && (
                <div className={loading ? "opacity-60 transition-opacity" : ""}>
                    <StrengthTable grid={grid} onCell={openCell} totalLabel={grid.total_label} />
                    {grid.notes.map((n) => (
                        <p key={n} className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                            <Info className="h-3.5 w-3.5 shrink-0 mt-px" /> {n}.
                        </p>
                    ))}
                    <p className="mt-2 text-[11px] text-zinc-400">
                        Admissions count by date of admission, whatever the student&apos;s status now. Withdrawals count on the day the student was marked as left, in the class they left.
                        {filters.measure === "both" && " Net = admitted minus withdrawn."} Click any number to see the students.
                    </p>
                </div>
            )}

            {cell && cellQuery && (
                <MovementStudentsPanel key={`${cell.row ?? ""}|${cell.column ?? ""}`} filters={filters} cell={cellQuery} title={cell.title} onClose={() => setCell(null)} />
            )}
        </div>
    );
}

function MovementStudentsPanel({
    filters,
    cell,
    title,
    onClose,
}: {
    filters: MovementFilters;
    cell: { row?: string; column?: string };
    title: string;
    onClose: () => void;
}) {
    const [data, setData] = useState<{ total: number; truncated: boolean; items: MovementCellStudent[] } | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        movementService
            .cellStudents(filters, cell)
            .then((d) => !cancelled && setData(d))
            .catch((e) => !cancelled && setError(e?.response?.data?.message || "Could not load the students."));
        return () => {
            cancelled = true;
        };
    }, [filters, cell]);

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
            <div className="h-full w-full max-w-xl bg-white dark:bg-zinc-950 shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-3 p-5 border-b border-zinc-100 dark:border-zinc-800">
                    <div>
                        <h3 className="text-[15px] font-black text-zinc-900 dark:text-zinc-50">{title}</h3>
                        <p className="text-xs text-zinc-500 mt-0.5">
                            {data ? `${data.total.toLocaleString()} student${data.total === 1 ? "" : "s"}` : "Loading…"}
                            {data?.truncated && ` · showing the first ${data.items.length.toLocaleString()}`}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="flex-1 overflow-auto">
                    {error && <p className="p-5 text-sm text-rose-600">{error}</p>}
                    {!data && !error && (
                        <div className="p-10 flex justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                        </div>
                    )}
                    {data && (
                        <table className="w-full text-[12px]">
                            <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                <tr>
                                    <th className="text-left px-4 py-2">Student</th>
                                    <th className="text-left px-2 py-2">Class</th>
                                    <th className="text-left px-2 py-2">What</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.items.map((s, i) => (
                                    <tr key={`${s.cc}-${s.type}-${i}`} className="border-t border-zinc-100 dark:border-zinc-800 align-top">
                                        <td className="px-4 py-2">
                                            <Link href={`/identity/students?cc=${s.cc}`} className="font-bold text-zinc-800 dark:text-zinc-200 hover:text-primary">
                                                {s.full_name || `CC ${s.cc}`}
                                            </Link>
                                            <div className="text-[11px] text-zinc-400">
                                                CC {s.cc}
                                                {s.gr_number ? ` · GR ${s.gr_number}` : ""} · now {s.status.replace(/_/g, " ").toLowerCase()}
                                            </div>
                                        </td>
                                        <td className="px-2 py-2 text-zinc-600 dark:text-zinc-400">
                                            {[s.class_name, s.section].filter(Boolean).join(" ") || "Not recorded"}
                                            <div className="text-[11px] text-zinc-400">{s.campus}</div>
                                        </td>
                                        <td className="px-2 py-2">
                                            <div className={`text-[11px] font-bold ${s.type === "ADMITTED" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
                                                {s.type_label} · {shortDate(s.date)}
                                            </div>
                                            {s.note && <div className="text-[11px] text-zinc-500">{s.note}</div>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
