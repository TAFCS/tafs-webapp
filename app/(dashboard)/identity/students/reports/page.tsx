"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
    ArrowLeft,
    ArrowLeftRight,
    BarChart3,
    Building2,
    CheckCircle2,
    Download,
    GraduationCap,
    Home,
    Layers,
    Loader2,
    SlidersHorizontal,
    Tags,
    Users,
    UsersRound,
    X,
    Printer,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCampuses } from "@/src/store/slices/campusesSlice";
import { fetchClasses } from "@/src/store/slices/classesSlice";
import { fetchSections } from "@/src/store/slices/sectionsSlice";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { toggleId } from "@/components/filters/filter-params";
import { useStudentAccess } from "@/hooks/use-student-access";
import { useStudentCategories } from "@/lib/student-benefits";
import { downloadReportFile, reportExportErrorMessage } from "@/app/(dashboard)/financial-reports/_components/download-report";
import {
    ALL_SPLITS,
    categoryOptions,
    ENDING_OPTIONS,
    REPORT_EXPORTS,
    CATEGORY_EXPORT_PARTS,
    type CategoryExportPart,
    SIBLING_OPTIONS,
    STRENGTH_GENDERS,
    STRENGTH_ROW_LEVELS,
    STRENGTH_SPLITS,
    strengthParams,
    studentReportsService,
    type StrengthColumn,
    type StrengthFilters,
    type StrengthGrid,
    type StrengthRow,
    type StrengthRowLevel,
    type StrengthSplit,
    type StudentReport,
} from "@/lib/student-reports.service";
import { MovementReport } from "./_components/MovementReport";
import { StrengthTable } from "./_components/StrengthTable";
import { PaperPicker, loadSavedPaper, savePaper, type PdfPaper } from "@/app/(dashboard)/financial-reports/_components/pdf-paper";
import { CellStudentsPanel } from "./_components/CellStudentsPanel";

// TAFSD-451: Student Reports, separate from Financial Reports (which live under
// Finance). Strength and Special Categories (TAFSD-452) are tabs; admissions &
// withdrawals (#453) joins them later. It sits under the Student
// Directory's address, so it has exactly the directory's access.

const STATUS_OPTIONS = [
    { id: "ENROLLED", label: "Enrolled" },
    { id: "SOFT_ADMISSION", label: "Soft Admission" },
    { id: "QUICK_ADMISSION", label: "Quick Admission" },
    { id: "LEFT", label: "Left" },
    { id: "EXPELLED", label: "Expelled" },
    { id: "GRADUATED", label: "Graduated" },
];

const BLANK: StrengthFilters = {
    campus_id: [],
    class_id: [],
    section_id: [],
    house_id: [],
    status: [],
    gender: [],
    siblings: [],
    category: [],
    ending_within_days: "",
    rows: "class",
    split: "status",
    split2: "",
};

// Special Categories is a record of current students, so it starts on Enrolled.
const DEFAULTS: Record<StudentReport, StrengthFilters> = {
    strength: BLANK,
    categories: { ...BLANK, status: ["ENROLLED"], split: "siblings", split2: "category" },
};

const REPORT_TABS = [
    { id: "strength", label: "Strength", icon: BarChart3 },
    { id: "categories", label: "Special Categories", icon: UsersRound },
    { id: "movement", label: "Admissions & Withdrawals", icon: ArrowLeftRight },
] as const;
type ReportTab = (typeof REPORT_TABS)[number]["id"];

function ReportTabs({ active, onPick }: { active: ReportTab; onPick: (id: ReportTab) => void }) {
    return (
        <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
            {REPORT_TABS.map((t) => (
                <button
                    key={t.id}
                    type="button"
                    onClick={() => onPick(t.id)}
                    className={`px-4 py-2 text-[12px] font-black -mb-px flex items-center gap-1.5 border-b-2 ${
                        active === t.id ? "text-primary border-primary" : "text-zinc-500 border-transparent hover:text-zinc-800"
                    }`}
                >
                    <t.icon className="h-3.5 w-3.5" /> {t.label}
                </button>
            ))}
        </div>
    );
}

const ids = (v: string | null) => (v ? v.split(",").map(Number).filter((n) => Number.isInteger(n)) : []);
const strs = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);
const isSplit = (v: string | null): v is StrengthSplit => ALL_SPLITS.some((s) => s.id === v);
const reportFrom = (sp: URLSearchParams): StudentReport => (sp.get("report") === "categories" ? "categories" : "strength");

/** Filters and layout from the URL; anything missing takes the report's default. */
function fromUrl(sp: URLSearchParams, report: StudentReport): StrengthFilters {
    const d = DEFAULTS[report];
    const rows = sp.get("rows");
    const split = sp.get("split");
    const split2 = sp.get("split2");
    const status = sp.get("status");
    return {
        campus_id: ids(sp.get("campus_id")),
        class_id: ids(sp.get("class_id")),
        section_id: ids(sp.get("section_id")),
        house_id: ids(sp.get("house_id")),
        // "all" keeps an explicit "every status" in the URL, where the default isn't empty.
        status: status === "all" ? [] : status ? strs(status) : d.status,
        gender: strs(sp.get("gender")),
        siblings: strs(sp.get("siblings")),
        category: strs(sp.get("category")),
        ending_within_days: ENDING_OPTIONS.some((o) => o.id === sp.get("ending_within_days")) ? (sp.get("ending_within_days") ?? "") : "",
        rows: STRENGTH_ROW_LEVELS.some((r) => r.id === rows) ? (rows as StrengthRowLevel) : d.rows,
        // "none" keeps an explicit "no split" in the URL, so the default doesn't come back on reload.
        split: split === "none" ? "" : isSplit(split) ? split : d.split,
        split2: split2 === "none" ? "" : isSplit(split2) ? split2 : split ? "" : d.split2,
    };
}

function toUrl(f: StrengthFilters, report: StudentReport): string {
    const p = new URLSearchParams(strengthParams(f));
    if (report !== "strength") p.set("report", report);
    if (!f.status.length && DEFAULTS[report].status.length) p.set("status", "all");
    if (!f.split) p.set("split", "none");
    else if (!f.split2 && DEFAULTS[report].split2) p.set("split2", "none");
    return p.toString();
}

function StrengthReport() {
    const { categories: studentCategories } = useStudentCategories();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const dispatch = useAppDispatch();
    const access = useStudentAccess();
    const { items: campuses } = useAppSelector((s) => s.campuses);
    const { items: classes } = useAppSelector((s) => s.classes);
    const { items: sections } = useAppSelector((s) => s.sections);
    const [houses, setHouses] = useState<{ id: number; house_name: string }[]>([]);

    const [report, setReport] = useState<StudentReport>(() => reportFrom(new URLSearchParams(searchParams.toString())));
    const [filters, setFilters] = useState<StrengthFilters>(() => fromUrl(new URLSearchParams(searchParams.toString()), report));
    const [grid, setGrid] = useState<StrengthGrid | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);
    const [cell, setCell] = useState<{ row?: string; column?: string; title: string } | null>(null);

    useEffect(() => {
        dispatch(fetchCampuses());
        dispatch(fetchClasses());
        dispatch(fetchSections());
        api.get("/v1/houses")
            .then((res) => {
                const list = res.data?.data || res.data || [];
                if (Array.isArray(list)) setHouses(list);
            })
            .catch(() => {});
    }, [dispatch]);

    // Keep the URL in step, so a view can be shared and reloaded.
    useEffect(() => {
        const next = toUrl(filters, report);
        if (next !== searchParams.toString()) router.replace(`${pathname}?${next}`, { scroll: false });
    }, [filters, report, pathname, router, searchParams]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        studentReportsService
            .strength(filters)
            .then((g) => !cancelled && setGrid(g))
            .catch((e) => !cancelled && setError(e?.response?.data?.message || "Could not load the report."))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [filters]);

    const set = useCallback(<K extends keyof StrengthFilters>(key: K, value: StrengthFilters[K]) => {
        setFilters((f) => ({ ...f, [key]: value }));
    }, []);

    const campusOptions = campuses.map((c: { id: number; campus_name: string }) => ({ id: c.id, label: c.campus_name }));
    const classOptions = classes.map((c: { id: number; description: string }) => ({ id: c.id, label: c.description }));
    const sectionOptions = sections.map((s: { id: number; description: string }) => ({ id: s.id, label: s.description }));
    const houseOptions = houses.map((h) => ({ id: h.id, label: h.house_name }));
    const statusChanged = filters.status.join(",") !== DEFAULTS[report].status.join(",");
    const hasFilters =
        filters.campus_id.length +
            filters.class_id.length +
            filters.section_id.length +
            filters.house_id.length +
            filters.gender.length +
            filters.siblings.length +
            filters.category.length +
            (filters.ending_within_days ? 1 : 0) >
            0 || statusChanged;
    const splits = report === "categories" ? ALL_SPLITS : STRENGTH_SPLITS;

    // Switching report keeps where you're looking (campus, class, …) and takes the new report's layout and defaults.
    const switchReport = (next: StudentReport) => {
        if (next === report) return;
        setCell(null);
        setReport(next);
        setFilters((f) => ({ ...DEFAULTS[next], campus_id: f.campus_id, class_id: f.class_id, section_id: f.section_id, house_id: f.house_id, gender: f.gender }));
    };

    const splitLabel = (id: string) => ALL_SPLITS.find((s) => s.id === id)?.label ?? id;
    const openCell = ({ row, column }: { row?: StrengthRow; column?: StrengthColumn }) => {
        const where = row ? (row.level === "campus" ? row.label : `${row.campus} · ${row.label}`) : "All students";
        const what = column ? [column.group, column.subtotal ? null : column.label].filter(Boolean).join(" · ") : null;
        setCell({ row: row?.key, column: column?.key, title: what ? `${where} — ${what}` : where });
    };
    const cellQuery = useMemo(() => (cell ? { row: cell.row, column: cell.column } : null), [cell]);

    // TAFSD-455: Excel, or the same school-format sheet printed to PDF like the defaulters report.
    const [paper, setPaper] = useState<PdfPaper>("A4");
    const [pdfOpen, setPdfOpen] = useState(false);
    const [part, setPart] = useState<CategoryExportPart>("summary");
    useEffect(() => setPaper(loadSavedPaper()), []);
    const exportReport = async (format: "xlsx" | "pdf") => {
        setExporting(format);
        try {
            const file = REPORT_EXPORTS[report];
            const partOf = report === "categories" ? CATEGORY_EXPORT_PARTS.find((p) => p.value === part) : undefined;
            const params = {
                ...strengthParams(filters),
                format,
                ...(format === "pdf" ? { paper } : {}),
                ...(partOf ? { part: partOf.value } : {}),
            };
            await downloadReportFile(file.path, params, `${file.basename}${partOf ? `-${partOf.file}` : ""}.${format}`);
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

    const selectCls =
        "h-9 px-3 text-[12px] font-bold bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-primary";

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <Link href="/identity/students" className="inline-flex items-center gap-1 text-[12px] font-bold text-zinc-500 hover:text-zinc-800">
                        <ArrowLeft className="h-3.5 w-3.5" /> Student Directory
                    </Link>
                    <h1 className="text-[22px] font-black tracking-tight text-zinc-900 dark:text-zinc-50 mt-1">Student Reports</h1>
                    <p className="text-[13px] text-zinc-500 mt-0.5">
                        {grid ? (
                            <>
                                <strong className="text-zinc-700 dark:text-zinc-300">{grid.student_count.toLocaleString()}</strong> students, as of today
                            </>
                        ) : (
                            "Students on roll, counted your way"
                        )}
                    </p>
                </div>
                {access.can("export") && (
                    <div className="relative flex items-center gap-2">
                        {report === "categories" && (
                            <select
                                aria-label="What to download"
                                value={part}
                                onChange={(e) => setPart(e.target.value as CategoryExportPart)}
                                className={selectCls}
                            >
                                {CATEGORY_EXPORT_PARTS.map((p) => (
                                    <option key={p.value} value={p.value}>
                                        {p.label}
                                    </option>
                                ))}
                            </select>
                        )}
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

            <ReportTabs
                active={report}
                onPick={(id) => (id === "movement" ? router.replace(`${pathname}?report=movement`, { scroll: false }) : switchReport(id))}
            />

            {/* Layout */}
            <div className="flex flex-wrap items-end gap-3">
                <label className="space-y-1">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-zinc-400">Rows</span>
                    <div className="flex rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                        {STRENGTH_ROW_LEVELS.map((r) => (
                            <button
                                key={r.id}
                                type="button"
                                onClick={() => set("rows", r.id)}
                                className={`px-3 h-9 text-[12px] font-bold ${filters.rows === r.id ? "bg-primary text-white" : "bg-white dark:bg-zinc-950 text-zinc-600 hover:bg-zinc-50"}`}
                            >
                                {r.id === "campus" ? "Campus" : r.id === "class" ? "+ Class" : "+ Section"}
                            </button>
                        ))}
                    </div>
                </label>
                <label className="space-y-1">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-zinc-400">Columns</span>
                    <select className={selectCls} value={filters.split} onChange={(e) => setFilters((f) => ({ ...f, split: e.target.value as StrengthSplit | "", split2: e.target.value ? f.split2 : "" }))}>
                        <option value="">Total only</option>
                        {splits.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.label}
                            </option>
                        ))}
                    </select>
                </label>
                {filters.split && (
                    <label className="space-y-1">
                        <span className="block text-[10px] font-black uppercase tracking-widest text-zinc-400">Then by</span>
                        <select className={selectCls} value={filters.split2} onChange={(e) => set("split2", e.target.value as StrengthSplit | "")}>
                            <option value="">Nothing</option>
                            {splits.filter((s) => s.id !== filters.split).map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.label}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                {filters.split && filters.split2 && (
                    <p className="text-[12px] text-zinc-500 pb-2">
                        {splitLabel(filters.split)} × {splitLabel(filters.split2)}
                    </p>
                )}
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
                <div className="w-[160px]">
                    <FilterDropdown label="Section" icon={Layers} value={filters.section_id} options={sectionOptions} placeholder="All Sections" onToggle={(id) => set("section_id", toggleId(filters.section_id, id))} onClear={() => set("section_id", [])} />
                </div>
                <div className="w-[160px]">
                    <FilterDropdown label="House" icon={Home} value={filters.house_id} options={houseOptions} placeholder="All Houses" onToggle={(id) => set("house_id", toggleId(filters.house_id, id))} onClear={() => set("house_id", [])} />
                </div>
                <div className="w-[150px]">
                    <FilterDropdown<string> label="Gender" icon={Users} value={filters.gender} options={STRENGTH_GENDERS.map((g) => ({ id: g.id, label: g.label }))} placeholder="All" onToggle={(id) => set("gender", toggleId(filters.gender, id))} onClear={() => set("gender", [])} />
                </div>
                <div className="w-[180px]">
                    <FilterDropdown<string> label="Status" icon={CheckCircle2} value={filters.status} options={STATUS_OPTIONS} placeholder="Everyone on roll" onToggle={(id) => set("status", toggleId(filters.status, id))} onClear={() => set("status", [])} />
                </div>
                {report === "categories" && (
                    <>
                        <div className="w-[160px]">
                            <FilterDropdown<string> label="Siblings" icon={UsersRound} value={filters.siblings} options={SIBLING_OPTIONS.map((o) => ({ ...o }))} placeholder="All" onToggle={(id) => set("siblings", toggleId(filters.siblings, id))} onClear={() => set("siblings", [])} />
                        </div>
                        <div className="w-[220px]">
                            <FilterDropdown<string> label="Category" icon={Tags} value={filters.category} options={categoryOptions(studentCategories)} placeholder="All" onToggle={(id) => set("category", toggleId(filters.category, id))} onClear={() => set("category", [])} />
                        </div>
                        <label className="flex flex-col gap-1">
                            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">Ending</span>
                            <select value={filters.ending_within_days} onChange={(e) => set("ending_within_days", e.target.value)} className={selectCls}>
                                {ENDING_OPTIONS.map((o) => (
                                    <option key={o.id} value={o.id}>{o.label}</option>
                                ))}
                            </select>
                        </label>
                    </>
                )}
                {hasFilters && (
                    <button
                        type="button"
                        onClick={() => setFilters((f) => ({ ...DEFAULTS[report], rows: f.rows, split: f.split, split2: f.split2 }))}
                        className="flex items-center gap-1.5 px-3 h-9 text-[11px] font-bold text-rose-600 bg-rose-50 rounded-xl hover:bg-rose-100"
                    >
                        <X className="h-3 w-3" /> Clear filters
                    </button>
                )}
            </div>

            {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
            {!grid && loading && (
                <div className="py-20 flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                </div>
            )}
            {grid && grid.student_count === 0 && !loading && (
                <p className="py-16 text-center text-sm text-zinc-500">No students match these filters.</p>
            )}
            {grid && grid.student_count > 0 && (
                <div className={loading ? "opacity-60 transition-opacity" : ""}>
                    <StrengthTable grid={grid} onCell={openCell} />
                    {report === "categories" && (
                        <p className="mt-2 text-[11px] text-zinc-400">
                            Has siblings = at least one other student of the same family is Enrolled. Siblings who have left or graduated are named in the list, but don&apos;t count.
                        </p>
                    )}
                    <p className="mt-2 text-[11px] text-zinc-400">
                        Age is in completed years today. New = admitted on or after{" "}
                        {new Date(`${grid.session_start}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}{" "}
                        (this session). Click any number to see the students.
                    </p>
                </div>
            )}

            {cell && cellQuery && <CellStudentsPanel key={`${cell.row ?? ""}|${cell.column ?? ""}`} filters={filters} cell={cellQuery} title={cell.title} report={report} onClose={() => setCell(null)} />}
        </div>
    );
}

/** TAFSD-453: report C has its own filters, so it is its own component under the same tabs. */
function MovementPage() {
    const router = useRouter();
    const pathname = usePathname();
    return (
        <div className="space-y-6">
            <div>
                <Link href="/identity/students" className="inline-flex items-center gap-1 text-[12px] font-bold text-zinc-500 hover:text-zinc-800">
                    <ArrowLeft className="h-3.5 w-3.5" /> Student Directory
                </Link>
                <h1 className="text-[22px] font-black tracking-tight text-zinc-900 dark:text-zinc-50 mt-1">Student Reports</h1>
                <p className="text-[13px] text-zinc-500 mt-0.5">Who joined and who left, by campus or class, month by month or session by session</p>
            </div>
            <ReportTabs
                active="movement"
                onPick={(id) => id !== "movement" && router.replace(id === "strength" ? pathname : `${pathname}?report=${id}`, { scroll: false })}
            />
            <MovementReport />
        </div>
    );
}

function ReportsRouter() {
    const searchParams = useSearchParams();
    return searchParams.get("report") === "movement" ? <MovementPage /> : <StrengthReport />;
}

export default function StudentReportsPage() {
    return (
        <Suspense
            fallback={
                <div className="py-20 flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                </div>
            }
        >
            <ReportsRouter />
        </Suspense>
    );
}
