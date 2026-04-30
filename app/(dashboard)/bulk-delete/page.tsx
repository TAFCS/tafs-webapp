"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
    Search, Loader2, Filter, CheckCircle2, Clock, XCircle, Trash2,
    Building2, GraduationCap, Users, Hash, SlidersHorizontal,
    ChevronLeft, ChevronRight, RefreshCw, X, Calendar, AlertTriangle
} from "lucide-react";
import api from "@/lib/api";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { fetchClasses } from "@/store/slices/classesSlice";
import { fetchCampuses } from "@/store/slices/campusesSlice";
import { fetchSections } from "@/store/slices/sectionsSlice";
import toast from "react-hot-toast";

// --- Helpers ---
function formatDate(dateStr: string | null | undefined) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-PK", {
        day: "2-digit", month: "short", year: "numeric",
    });
}

function getStatusConfig(status: string | null) {
    switch (status) {
        case "PAID":
            return { label: "Paid", classes: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800" };
        case "PARTIALLY_PAID":
            return { label: "Partially Paid", classes: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800" };
        case "OVERDUE":
            return { label: "Overdue", classes: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800" };
        case "VOID":
            return { label: "Void", classes: "bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-800/10 dark:text-zinc-500 dark:border-zinc-800 line-through" };
        default:
            return { label: "Unpaid", classes: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800" };
    }
}

// --- Custom Dropdown (Simplified version of the one in vouchers/page.tsx) ---
interface DropdownOption { id: number; label: string; sub?: string; }

function FilterDropdown({
    label, icon: Icon, value, options, loading, placeholder, onSelect, onClear,
}: {
    label: string;
    icon: React.ElementType;
    value: number | "";
    options: DropdownOption[];
    loading?: boolean;
    placeholder: string;
    onSelect: (id: number) => void;
    onClear: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const ref = useRef<HTMLDivElement>(null);
    const selected = options.find(o => o.id === value);
    const filtered = options.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        (o.sub && o.sub.toLowerCase().includes(search.toLowerCase()))
    );

    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    return (
        <div className="flex flex-col gap-1.5" ref={ref}>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] flex items-center gap-1.5 ml-1">
                <Icon className="h-3 w-3" /> {label}
            </label>
            <div className="relative">
                <button
                    type="button"
                    onClick={() => { setOpen(o => !o); setSearch(""); }}
                    className={`w-full h-11 flex items-center justify-between px-4 rounded-xl text-sm transition-all border shadow-sm
                        ${value !== "" ? "bg-primary/5 border-primary/30 text-zinc-900 dark:text-zinc-100" : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400"}
                        hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10`}
                >
                    <span className="font-semibold truncate">
                        {selected ? selected.label : placeholder}
                    </span>
                    <div className="flex items-center gap-1.5 ml-2 shrink-0">
                        {value !== "" && (
                            <span
                                role="button"
                                onClick={(e) => { e.stopPropagation(); onClear(); }}
                                className="p-0.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
                            >
                                <X className="h-3.5 w-3.5" />
                            </span>
                        )}
                        <ChevronRight className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
                    </div>
                </button>

                {open && (
                    <div className="absolute z-50 top-full mt-2 w-full min-w-[220px] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                        <div className="p-2.5 border-b border-zinc-100 dark:border-zinc-800">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                                <input
                                    autoFocus type="text" placeholder="Search..."
                                    value={search} onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-3 h-8 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:border-primary placeholder:text-zinc-400"
                                />
                            </div>
                        </div>
                        <div className="max-h-56 overflow-y-auto p-1">
                            {loading ? (
                                <div className="flex items-center justify-center gap-2 py-6 text-zinc-400 text-xs">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="py-6 text-center text-xs text-zinc-400">No results</div>
                            ) : filtered.map(o => (
                                <button
                                    key={o.id} type="button"
                                    onClick={() => { onSelect(o.id); setOpen(false); }}
                                    className={`w-full flex items-center justify-between px-3.5 h-10 rounded-lg text-sm transition-all
                                        ${value === o.id ? "bg-primary text-white font-semibold" : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                                >
                                    <span>{o.label}</span>
                                    {o.sub && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${value === o.id ? "bg-white/20" : "bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"}`}>{o.sub}</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function BulkDeleteVouchersPage() {
    const dispatch = useAppDispatch();

    // Redux data
    const campuses = useAppSelector(s => s.campuses.items);
    const classes = useAppSelector(s => s.classes.items);
    const sections = useAppSelector(s => s.sections.items);

    // State
    const [vouchers, setVouchers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [showFilters, setShowFilters] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [totalVouchers, setTotalVouchers] = useState(0);

    // Filter values
    const [campusId, setCampusId] = useState<number | "">("");
    const [classId, setClassId] = useState<number | "">("");
    const [sectionId, setSectionId] = useState<number | "">("");
    const [statusFilter, setStatusFilter] = useState<string[]>(["UNPAID", "OVERDUE", "VOID"]);
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [academicYear, setAcademicYear] = useState("");

    // Load reference data
    useEffect(() => {
        if (campuses.length === 0) dispatch(fetchCampuses());
        if (classes.length === 0) dispatch(fetchClasses());
        if (sections.length === 0) dispatch(fetchSections());
    }, [dispatch, campuses.length, classes.length, sections.length]);

    const fetchFilteredVouchers = useCallback(async () => {
        setIsLoading(true);
        try {
            const params: any = {
                page,
                limit: pageSize,
                status: statusFilter.join(","),
            };
            if (campusId !== "") params.campus_id = campusId;
            if (classId !== "") params.class_id = classId;
            if (sectionId !== "") params.section_id = sectionId;
            if (dateFrom) params.date_from = dateFrom;
            if (dateTo) params.date_to = dateTo;
            if (academicYear) params.academic_year = academicYear;

            const { data } = await api.get("/v1/vouchers", { params });
            setVouchers(data.data.items);
            setTotalVouchers(data.data.meta.total);
            setSelectedIds([]); // Clear selection on new fetch
        } catch (err: any) {
            toast.error("Failed to fetch vouchers");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [page, pageSize, campusId, classId, sectionId, statusFilter, dateFrom, dateTo, academicYear]);

    useEffect(() => {
        fetchFilteredVouchers();
    }, [fetchFilteredVouchers]);

    const handleToggleSelect = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (selectedIds.length === vouchers.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(vouchers.map(v => v.id));
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.length === 0) return;

        if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} vouchers? This will reset all linked fee heads to NOT_ISSUED. This cannot be undone.`)) {
            return;
        }

        const loadingToast = toast.loading(`Deleting ${selectedIds.length} vouchers...`);
        try {
            const { data } = await api.delete("/v1/vouchers/bulk", { data: { ids: selectedIds } });
            toast.dismiss(loadingToast);
            
            if (data.data.skipped > 0) {
                toast.success(`${data.data.deleted} deleted, ${data.data.skipped} skipped (due to status or other reasons).`, { duration: 5000 });
            } else {
                toast.success(`${data.data.deleted} vouchers deleted successfully.`);
            }
            
            fetchFilteredVouchers();
        } catch (err: any) {
            toast.dismiss(loadingToast);
            toast.error(err.response?.data?.message || "Failed to delete vouchers.");
            console.error(err);
        }
    };

    const handleClearFilters = () => {
        setCampusId("");
        setClassId("");
        setSectionId("");
        setStatusFilter(["UNPAID", "OVERDUE", "VOID"]);
        setDateFrom("");
        setDateTo("");
        setAcademicYear("");
        setPage(1);
    };

    const campusOptions: DropdownOption[] = campuses.map(c => ({ id: c.id, label: c.campus_name, sub: c.campus_code }));
    const classOptions: DropdownOption[] = classes.map(c => ({ id: c.id, label: c.description, sub: c.class_code }));
    const sectionOptions: DropdownOption[] = sections.map(s => ({ id: s.id, label: s.description }));

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                        <span className="p-2 bg-rose-50 dark:bg-rose-900/20 rounded-xl text-rose-600">
                            <Trash2 className="h-6 w-6" />
                        </span>
                        Bulk Delete Vouchers
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm">
                        Find and delete vouchers in bulk. This will reset fee heads to "NOT_ISSUED".
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowFilters(f => !f)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all
                            ${showFilters ? "bg-primary/10 border-primary/20 text-primary" : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300"}`}
                    >
                        <SlidersHorizontal className="h-4 w-4" />
                        Filters
                    </button>

                    <button
                        onClick={fetchFilteredVouchers}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 transition-all"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Filters */}
            {showFilters && (
                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[28px] p-6 shadow-sm animate-in slide-in-from-top-4 fade-in duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <FilterDropdown
                            label="Campus"
                            icon={Building2}
                            value={campusId}
                            options={campusOptions}
                            placeholder="Select Campus"
                            onSelect={setCampusId}
                            onClear={() => setCampusId("")}
                        />

                        <FilterDropdown
                            label="Class"
                            icon={GraduationCap}
                            value={classId}
                            options={classOptions}
                            placeholder="Select Class"
                            onSelect={setClassId}
                            onClear={() => setClassId("")}
                        />

                        <FilterDropdown
                            label="Section"
                            icon={Users}
                            value={sectionId}
                            options={sectionOptions}
                            placeholder="Select Section"
                            onSelect={setSectionId}
                            onClear={() => setSectionId("")}
                        />

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] flex items-center gap-1.5 ml-1">
                                <Filter className="h-3 w-3" /> Status
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {["UNPAID", "OVERDUE", "VOID", "PAID"].map(s => (
                                    <button
                                        key={s}
                                        onClick={() => {
                                            setStatusFilter(prev =>
                                                prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
                                            );
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border
                                            ${statusFilter.includes(s)
                                                ? "bg-primary/10 border-primary/20 text-primary"
                                                : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300"
                                            }`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] flex items-center gap-1.5 ml-1">
                                <Calendar className="h-3 w-3" /> Issue Date Range
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={e => setDateFrom(e.target.value)}
                                    className="h-11 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all text-zinc-700 dark:text-zinc-300"
                                />
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={e => setDateTo(e.target.value)}
                                    className="h-11 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all text-zinc-700 dark:text-zinc-300"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] flex items-center gap-1.5 ml-1">
                                <Hash className="h-3 w-3" /> Academic Year
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. 2025-2026"
                                value={academicYear}
                                onChange={e => setAcademicYear(e.target.value)}
                                className="h-11 px-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400 font-semibold"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-900">
                        <button
                            onClick={handleClearFilters}
                            className="px-6 py-2.5 text-sm font-bold text-zinc-400 hover:text-rose-500 transition-colors mr-4"
                        >
                            Reset All
                        </button>
                        <button
                            onClick={() => { setPage(1); fetchFilteredVouchers(); }}
                            className="px-8 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all"
                        >
                            Apply Filters
                        </button>
                    </div>
                </div>
            )}

            {/* Results Table */}
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[28px] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800">
                                <th className="px-5 py-4 text-center w-12">
                                    <input
                                        type="checkbox"
                                        checked={vouchers.length > 0 && selectedIds.length === vouchers.length}
                                        onChange={handleSelectAll}
                                        className="w-4 h-4 rounded border-zinc-300 text-primary focus:ring-primary"
                                    />
                                </th>
                                <th className="px-5 py-4 text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest w-20">VCH #</th>
                                <th className="px-5 py-4 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">Student</th>
                                <th className="px-5 py-4 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">Campus</th>
                                <th className="px-5 py-4 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">Class</th>
                                <th className="px-5 py-4 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">Issue Date</th>
                                <th className="px-5 py-4 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">Status</th>
                                <th className="px-5 py-4 text-right text-[10px] font-black text-zinc-400 uppercase tracking-widest">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={8} className="px-5 py-8 text-center">
                                            <div className="h-4 bg-zinc-100 dark:bg-zinc-900 rounded-md w-full"></div>
                                        </td>
                                    </tr>
                                ))
                            ) : vouchers.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-5 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-full">
                                                <Search className="h-8 w-8 text-zinc-300" />
                                            </div>
                                            <p className="text-zinc-500 font-medium">No vouchers found matching your filters.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : vouchers.map((v, i) => {
                                const status = getStatusConfig(v.status);
                                return (
                                    <tr key={v.id} className="group border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                                        <td className="px-5 py-4 text-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(v.id)}
                                                onChange={() => handleToggleSelect(v.id)}
                                                className="w-4 h-4 rounded border-zinc-300 text-primary focus:ring-primary"
                                            />
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <span className="text-[11px] font-mono text-zinc-400">{v.id}</span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{v.students?.full_name}</span>
                                                <span className="text-[10px] text-zinc-400">CC-{v.students?.cc}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="text-sm text-zinc-600 dark:text-zinc-400">{v.campuses?.campus_name}</span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="text-sm text-zinc-600 dark:text-zinc-400">{v.classes?.description}</span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="text-sm text-zinc-500 dark:text-zinc-400 font-mono">{formatDate(v.issue_date)}</span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border ${status.classes}`}>
                                                {status.label}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                                                {Number(v.total_payable_before_due).toLocaleString()}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalVouchers > 0 && (
                    <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/30 dark:bg-zinc-900/30">
                        <p className="text-xs text-zinc-400">
                            Showing <span className="font-bold text-zinc-700 dark:text-zinc-300">{vouchers.length}</span> of <span className="font-bold text-zinc-700 dark:text-zinc-300">{totalVouchers}</span> vouchers
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-900 disabled:opacity-40 transition-all"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 px-3">
                                Page {page}
                            </span>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={page * pageSize >= totalVouchers}
                                className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-900 disabled:opacity-40 transition-all"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Bulk Action Bar */}
            {selectedIds.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-8 animate-in slide-in-from-bottom-10 duration-300 z-[100]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-500 flex items-center justify-center text-white font-black text-xs">
                            {selectedIds.length}
                        </div>
                        <span className="text-sm font-bold tracking-tight">Vouchers Selected</span>
                    </div>

                    <div className="h-8 w-px bg-white/20 dark:bg-zinc-200" />

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSelectedIds([])}
                            className="px-4 py-2 text-sm font-bold text-zinc-400 hover:text-white dark:hover:text-zinc-600 transition-colors"
                        >
                            Clear
                        </button>
                        <button
                            onClick={handleDeleteSelected}
                            className="flex items-center gap-2 px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white text-sm font-black rounded-xl transition-all shadow-lg shadow-rose-500/20 active:scale-95"
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete Selected
                        </button>
                    </div>
                </div>
            )}
            
            {/* Warning for mass delete */}
            {statusFilter.includes("PAID") && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-amber-700 dark:text-amber-400">Caution: PAID status included</p>
                        <p className="text-xs text-amber-600/80 mt-1">
                            Deleting PAID vouchers is usually restricted to prevent financial discrepancies. Ensure you only delete them if they were recorded in error.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
