"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, X, SlidersHorizontal, Users, ChevronLeft, ChevronRight, GraduationCap, Building2, BookOpen, Layers, Home } from "lucide-react";
import api from "@/lib/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchClasses } from "@/src/store/slices/classesSlice";
import { fetchCampuses } from "@/src/store/slices/campusesSlice";
import { fetchSections } from "@/src/store/slices/sectionsSlice";
import Image from "next/image";
import { StudentDetailDrawer } from "./tabs/StudentDetailDrawer";

// ── Types ──────────────────────────────────────────────────────────────────
interface StudentCore {
    cc: number;
    cc_number: number;
    full_name: string;
    gr_number: string | null;
    campus_name: string | null;
    campus_code: string | null;
    class_description: string | null;
    class_code: string | null;
    section_description: string | null;
    house_name: string | null;
    house_color: string | null;
    enrollment_status: "SOFT_ADMISSION" | "ENROLLED" | "EXPELLED" | "GRADUATED";
    photograph_url: string | null;
    primary_guardian_name?: string | null;
    guardian_relationship?: string | null;
}

interface Student {
    cc: number;
    core: StudentCore;
}

interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    ENROLLED:       { label: "ENROLLED",       bg: "bg-emerald-50",  text: "text-emerald-700", dot: "bg-emerald-500" },
    SOFT_ADMISSION: { label: "SOFT ADMISSION",  bg: "bg-blue-50",     text: "text-blue-700",    dot: "bg-blue-500" },
    EXPELLED:       { label: "EXPELLED",        bg: "bg-rose-50",     text: "text-rose-700",    dot: "bg-rose-500" },
    GRADUATED:      { label: "GRADUATED",       bg: "bg-violet-50",   text: "text-violet-700",  dot: "bg-violet-500" },
};

function StatusBadge({ status }: { status: string }) {
    const cfg = STATUS_CONFIG[status] ?? { label: status, bg: "bg-zinc-100", text: "text-zinc-600", dot: "bg-zinc-400" };
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
        </span>
    );
}

function Avatar({ url, name, size = 40 }: { url: string | null; name: string; size?: number }) {
    const initials = name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
    if (url) {
        const sanitizedUrl = url.replace(/([^:])\/\//g, '$1/');
        return <Image src={sanitizedUrl} alt={name} width={size} height={size} className="rounded-full object-cover ring-2 ring-white shadow-sm" style={{ width: size, height: size }} />;
    }
    const colors = ["bg-violet-100 text-violet-700", "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700"];
    const color = colors[name.charCodeAt(0) % colors.length];
    return (
        <div className={`rounded-full flex items-center justify-center font-bold text-xs ring-2 ring-white shadow-sm ${color}`} style={{ width: size, height: size, flexShrink: 0 }}>
            {initials}
        </div>
    );
}

function StudentCard({ student, onClick }: { student: Student; onClick: () => void }) {
    const c = student.core;
    return (
        <button
            onClick={onClick}
            className="w-full text-left bg-white border border-zinc-100 rounded-2xl p-4 hover:shadow-md hover:border-zinc-200 transition-all duration-200 group active:scale-[0.99]"
        >
            <div className="flex items-start gap-3">
                <Avatar url={c.photograph_url} name={c.full_name} size={44} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                        <p className="font-bold text-zinc-900 text-[14px] leading-tight truncate group-hover:text-primary transition-colors uppercase">{c.full_name}</p>
                        <StatusBadge status={c.enrollment_status} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span className="text-[11px] text-zinc-400 font-mono">CC {c.cc_number}</span>
                        {c.gr_number && <span className="text-[11px] text-zinc-400 font-mono">GR {c.gr_number}</span>}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {c.campus_name && (
                            <span className="flex items-center gap-1 text-[10px] bg-zinc-50 border border-zinc-100 text-zinc-500 rounded-md px-1.5 py-0.5 font-bold uppercase tracking-tight">
                                <Building2 className="h-2.5 w-2.5 text-zinc-400" />{c.campus_name}
                            </span>
                        )}
                        {c.class_description && (
                            <span className="flex items-center gap-1 text-[10px] bg-zinc-50 border border-zinc-100 text-zinc-500 rounded-md px-1.5 py-0.5 font-bold uppercase tracking-tight">
                                <BookOpen className="h-2.5 w-2.5 text-zinc-400" />{c.class_description}
                            </span>
                        )}
                        {c.section_description && (
                            <span className="flex items-center gap-1 text-[10px] bg-zinc-50 border border-zinc-100 text-zinc-500 rounded-md px-1.5 py-0.5 font-bold uppercase tracking-tight">
                                <Layers className="h-2.5 w-2.5 text-zinc-400" />{c.section_description}
                            </span>
                        )}
                        {c.house_name && (
                            <span className="flex items-center gap-1 text-[10px] rounded-md px-1.5 py-0.5 font-bold" style={{ background: c.house_color ? `${c.house_color}22` : "#f4f4f5", color: c.house_color || "#71717a" }}>
                                <Home className="h-2.5 w-2.5" />{c.house_name}
                            </span>
                        )}
                        {c.primary_guardian_name && (
                             <span className="flex items-center gap-1 text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-md px-1.5 py-0.5 font-bold">
                                 <Users className="h-2.5 w-2.5 text-indigo-400" />
                                 {c.guardian_relationship ? `${c.guardian_relationship}: ` : ""}{c.primary_guardian_name}
                             </span>
                        )}
                    </div>
                </div>
            </div>
        </button>
    );
}

function FilterSelect({ label, value, onChange, options, icon }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; icon?: React.ReactNode }) {
    return (
        <div className="relative">
            {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">{icon}</div>}
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className={`h-9 pr-3 text-[12px] font-medium text-zinc-700 bg-white border border-zinc-200 rounded-xl appearance-none outline-none hover:border-zinc-300 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all ${icon ? "pl-8" : "pl-3"}`}
            >
                <option value="">{label}</option>
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function StudentsDirectoryPage() {
    const dispatch = useAppDispatch();
    const { items: campuses } = useAppSelector(s => s.campuses);
    const { items: classes }  = useAppSelector(s => s.classes);
    const { items: sections } = useAppSelector(s => s.sections);

    const [students, setStudents]     = useState<Student[]>([]);
    const [meta, setMeta]             = useState<PaginationMeta | null>(null);
    const [isLoading, setIsLoading]   = useState(false);
    const [selectedCc, setSelectedCc] = useState<number | null>(null);

    // Filters
    const [search, setSearch]         = useState("");
    const [campusId, setCampusId]     = useState("");
    const [classId, setClassId]       = useState("");
    const [sectionId, setSectionId]   = useState("");
    const [houseId, setHouseId]       = useState("");
    const [status, setStatus]         = useState("");
    const [isAbnormal, setIsAbnormal] = useState(false);
    const [page, setPage]             = useState(1);

    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        dispatch(fetchCampuses());
        dispatch(fetchClasses());
        dispatch(fetchSections());
    }, [dispatch]);

    const fetchStudents = useCallback(async (params: Record<string, string | number>) => {
        setIsLoading(true);
        try {
            const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v !== 0));
            const { data } = await api.get("/v1/students", { params: { ...clean, fields: "core", limit: 24 } });
            setStudents(data?.data?.items || []);
            setMeta(data?.data?.pagination || null);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const triggerFetch = useCallback(() => {
        fetchStudents({ page, search, campus_id: campusId, class_id: classId, section_id: sectionId, house_id: houseId, status, is_abnormal: isAbnormal ? 1 : 0 });
    }, [page, search, campusId, classId, sectionId, houseId, status, isAbnormal, fetchStudents]);

    // Debounced search
    useEffect(() => {
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => { setPage(1); triggerFetch(); }, search ? 400 : 0);
        return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    // Instant on filter/page change
    useEffect(() => { triggerFetch(); }, [page, campusId, classId, sectionId, houseId, status, triggerFetch]);

    const hasFilters = campusId || classId || sectionId || houseId || status || isAbnormal;
    const clearFilters = () => { setCampusId(""); setClassId(""); setSectionId(""); setHouseId(""); setStatus(""); setIsAbnormal(false); setPage(1); };

    const campusOptions  = campuses.map((c: any) => ({ value: String(c.id), label: c.campus_name }));
    const classOptions   = classes.map((c: any) => ({ value: String(c.id), label: c.description }));
    const sectionOptions = sections.map((s: any) => ({ value: String(s.id), label: s.description }));
    const statusOptions  = [
        { value: "ENROLLED", label: "Enrolled" },
        { value: "SOFT_ADMISSION", label: "Soft Admission" },
        { value: "EXPELLED", label: "Expelled" },
        { value: "GRADUATED", label: "Graduated" },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-[22px] font-black tracking-tight text-zinc-900">Student Directory</h1>
                    <p className="text-[13px] text-zinc-500 mt-0.5">
                        {meta ? <span><strong className="text-zinc-700">{meta.total.toLocaleString()}</strong> students found</span> : "Search and manage all students"}
                    </p>
                </div>
            </div>

            {/* Search + Filters */}
            <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative flex-1 min-w-[260px]">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search by name, CC, or GR number..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full h-10 pl-10 pr-10 text-[13px] font-medium bg-white border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-zinc-400"
                    />
                    {search && (
                        <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 hover:text-zinc-600">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {/* Filter dropdowns */}
                <div className="flex items-center gap-2 flex-wrap">
                    <SlidersHorizontal className="h-4 w-4 text-zinc-400 shrink-0" />
                    <FilterSelect label="All Campuses" value={campusId} onChange={v => { setCampusId(v); setPage(1); }} options={campusOptions} />

                    {/* TEMP: Abnormal Filter Button */}
                    <button
                        onClick={() => { setIsAbnormal(!isAbnormal); setPage(1); }}
                        className={`h-9 px-4 flex items-center gap-2 text-[12px] font-bold rounded-xl transition-all border ${
                            isAbnormal 
                            ? "bg-rose-50 border-rose-200 text-rose-600 shadow-sm" 
                            : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"
                        }`}
                    >
                        <div className={`h-2 w-2 rounded-full ${isAbnormal ? "bg-rose-500 animate-pulse" : "bg-zinc-300"}`} />
                        Audit
                    </button>
                    <FilterSelect label="All Classes"  value={classId}  onChange={v => { setClassId(v);  setPage(1); }} options={classOptions} />
                    <FilterSelect label="All Sections" value={sectionId} onChange={v => { setSectionId(v); setPage(1); }} options={sectionOptions} />
                    <FilterSelect label="All Statuses" value={status}   onChange={v => { setStatus(v);   setPage(1); }} options={statusOptions} />
                    {hasFilters && (
                        <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 h-9 text-[11px] font-bold text-rose-600 bg-rose-50 rounded-xl hover:bg-rose-100 transition-colors">
                            <X className="h-3 w-3" /> Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="bg-white border border-zinc-100 rounded-2xl p-4 animate-pulse">
                            <div className="flex items-start gap-3">
                                <div className="h-11 w-11 rounded-full bg-zinc-100 shrink-0" />
                                <div className="flex-1 space-y-2 pt-1">
                                    <div className="h-3.5 bg-zinc-100 rounded w-3/4" />
                                    <div className="h-2.5 bg-zinc-100 rounded w-1/2" />
                                    <div className="flex gap-1.5 mt-2">
                                        <div className="h-4 bg-zinc-100 rounded w-16" />
                                        <div className="h-4 bg-zinc-100 rounded w-14" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : students.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 bg-zinc-50 border border-zinc-100 rounded-2xl gap-4">
                    <div className="p-5 bg-white rounded-2xl border border-zinc-100 shadow-sm">
                        <Users className="h-8 w-8 text-zinc-300" />
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-zinc-700">No students found</p>
                        <p className="text-sm text-zinc-400 mt-1">{search || hasFilters ? "Try adjusting your search or filters" : "No students available"}</p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {students.map(s => (
                        <StudentCard key={s.cc} student={s} onClick={() => setSelectedCc(s.cc)} />
                    ))}
                </div>
            )}

            {/* Pagination */}
            {meta && meta.pages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <p className="text-[12px] text-zinc-400">
                        Page <strong className="text-zinc-600">{meta.page}</strong> of <strong className="text-zinc-600">{meta.pages}</strong>
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={!meta.hasPrev}
                            className="h-8 w-8 flex items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        {Array.from({ length: Math.min(5, meta.pages) }, (_, i) => {
                            const p = meta.page <= 3 ? i + 1 : meta.page - 2 + i;
                            if (p < 1 || p > meta.pages) return null;
                            return (
                                <button key={p} onClick={() => setPage(p)} className={`h-8 w-8 text-[12px] font-bold rounded-xl transition-all ${p === meta.page ? "bg-primary text-white shadow-sm" : "border border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
                                    {p}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => setPage(p => Math.min(meta.pages, p + 1))}
                            disabled={!meta.hasNext}
                            className="h-8 w-8 flex items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            <StudentDetailDrawer 
                cc={selectedCc} 
                onClose={() => setSelectedCc(null)} 
                classes={classes}
            />
        </div>
    );
}