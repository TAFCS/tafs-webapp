"use client";

import React, { useState, useEffect, ReactNode } from "react";
import {
    Search,
    Users,
    GraduationCap,
    ChevronLeft,
    ChevronRight,
    X,
    UserPlus,
    RefreshCw,
    AlertCircle,
    Eye,
    Mail,
    MapPin,
} from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import api from "@/lib/api";
import {
    familiesService,
    type Family,
    type PaginationMeta,
} from "@/lib/families.service";
import { FamilyDetailModal } from "./family-detail-modal";

interface FamiliesDataTableProps {
    isCreateOpen?: boolean;
    onCloseCreate?: () => void;
    isAssignOpen?: boolean;
    onCloseAssign?: () => void;
    refreshTrigger?: number;
}

export function FamiliesDataTable({
    isCreateOpen = false,
    onCloseCreate,
    isAssignOpen = false,
    onCloseAssign,
    refreshTrigger = 0,
}: FamiliesDataTableProps = {}) {
    // ── Live data state ──────────────────────────────────────────────────────
    const [families, setFamilies] = useState<Family[]>([]);
    const [meta, setMeta] = useState<PaginationMeta | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);

    // State: Filters
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearch = useDebounce(searchQuery, 300);

    // Actions Menu
    const [openActionRowId, setOpenActionRowId] = useState<number | null>(null);

    // Detail modal
    const [selectedFamilyId, setSelectedFamilyId] = useState<number | null>(null);
    const [detailFamilyId, setDetailFamilyId] = useState<number | null>(null);

    // Aliases so the rest of the component can use concise names
    const isCreateFamilyModalOpen = isCreateOpen;
    const setIsCreateFamilyModalOpen = (open: boolean) => { if (!open) onCloseCreate?.(); };
    const isChangeFamilyModalOpen = isAssignOpen;
    const setIsChangeFamilyModalOpen = (open: boolean) => { if (!open) onCloseAssign?.(); };

    // Reset all assign-modal state whenever the modal opens (prevents stale selectedFamilyId
    // from a previous row action causing a 409 conflict on submit)
    useEffect(() => {
        if (isAssignOpen) {
            setSelectedFamilyId(null);
            setSelectedStudentId(null);
            setSelectedStudentName("");
            setAssignStudentSearch("");
            setAssignFamilySearch("");
            setAssignError(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAssignOpen]);

    // ── Fetch families from API ───────────────────────────────────────────────
    const fetchFamilies = React.useCallback(async (currentPage: number, search: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await familiesService.list({
                page: currentPage,
                limit: 10,
                search: search || undefined,
            });
            setFamilies(result.data);
            setMeta(result.meta);
        } catch {
            setError("Failed to load families. Please try again.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch]);

    useEffect(() => {
        fetchFamilies(page, debouncedSearch);
    }, [page, debouncedSearch, fetchFamilies, refreshTrigger]);

    // ── Create family state (initializeFromStudent flow) ─────────────────────
    const [createStudentSearch, setCreateStudentSearch] = useState("");
    const [createStudentResults, setCreateStudentResults] = useState<StudentHit[]>([]);
    const [createSelectedStudent, setCreateSelectedStudent] = useState<StudentHit | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const debouncedCreateSearch = useDebounce(createStudentSearch, 350);

    useEffect(() => {
        if (!debouncedCreateSearch) { setCreateStudentResults([]); return; }
        api.get('/v1/students', { params: { search: debouncedCreateSearch, limit: 8, fields: 'core,family' } })
            .then(r => setCreateStudentResults((r.data as { data: { items: StudentHit[] } }).data?.items ?? []))
            .catch(() => setCreateStudentResults([]));
    }, [debouncedCreateSearch]);

    const handleCreateFamily = async () => {
        if (!createSelectedStudent) return;
        const cc = createSelectedStudent.core?.cc_number ? Number(createSelectedStudent.core.cc_number) : createSelectedStudent.id;
        if (!cc) { setCreateError("Could not determine student CC number."); return; }
        setIsCreating(true);
        setCreateError(null);
        try {
            await familiesService.initializeFromStudent(cc);
            setIsCreateFamilyModalOpen(false);
            setCreateStudentSearch("");
            setCreateStudentResults([]);
            setCreateSelectedStudent(null);
            fetchFamilies(page, debouncedSearch);
        } catch (err: any) {
            setCreateError(err?.response?.data?.message || "Failed to create family. Please try again.");
        } finally {
            setIsCreating(false);
        }
    };

    // Reset create modal state when opened
    useEffect(() => {
        if (isCreateOpen) {
            setCreateStudentSearch("");
            setCreateStudentResults([]);
            setCreateSelectedStudent(null);
            setCreateError(null);
        }
    }, [isCreateOpen]);

    // ── Assign child state ────────────────────────────────────────────────────
    const [assignStudentSearch, setAssignStudentSearch] = useState("");
    const [assignFamilySearch, setAssignFamilySearch] = useState("");
    const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
    const [selectedStudentName, setSelectedStudentName] = useState("");
    const [isAssigning, setIsAssigning] = useState(false);
    const [assignError, setAssignError] = useState<string | null>(null);

    const handleAssignChild = async () => {
        if (!selectedStudentId || !selectedFamilyId) return;
        setIsAssigning(true);
        setAssignError(null);
        try {
            await familiesService.assignChild(selectedFamilyId, selectedStudentId);
            setIsChangeFamilyModalOpen(false);
            setSelectedStudentId(null);
            setSelectedStudentName("");
            setSelectedFamilyId(null);
            setAssignStudentSearch("");
            setAssignFamilySearch("");
            fetchFamilies(page, debouncedSearch);
        } catch {
            setAssignError("Failed to assign student. Please try again.");
        } finally {
            setIsAssigning(false);
        }
    };

    // Click outside listener
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Element;
            if (target && typeof target.closest === 'function') {
                if (!target.closest('.action-menu-container')) {
                    setOpenActionRowId(null);
                }
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="space-y-6 w-full">
            {/* Search + Filters */}
            <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative flex-1 min-w-[260px]">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search Household, ID, Email..."
                        className="w-full h-11 pl-10 pr-10 text-sm font-semibold bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-zinc-400"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 hover:text-zinc-655">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

            </div>

            {/* Main Content Area */}
            <div className={`w-full transition-opacity duration-200 ${isLoading ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
                {error ? (
                    <div className="py-12 text-center text-red-500">{error}</div>
                ) : families.length === 0 && !isLoading ? (
                    <div className="flex flex-col items-center justify-center py-32 bg-zinc-50 dark:bg-zinc-900/10 border border-zinc-100 dark:border-zinc-800/50 rounded-2xl gap-4">
                        <div className="p-5 bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
                            <Users className="h-8 w-8 text-zinc-300 dark:text-zinc-700" />
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-zinc-700 dark:text-zinc-350">No families found</p>
                            <p className="text-sm text-zinc-400 mt-1">Try adjusting your search query</p>
                        </div>
                    </div>
                ) : (
                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-950 shadow-sm w-full">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                                    <tr>
                                        <th className="px-5 py-3 text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest w-20">ID</th>
                                        <th className="px-5 py-3 text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Household</th>
                                        <th className="px-5 py-3 text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Primary Guardian</th>
                                        <th className="px-5 py-3 text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Contact & Address</th>
                                        <th className="px-5 py-3 text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Linked Students</th>
                                        <th className="px-5 py-3 text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest text-right w-24">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                                    {families.map((family) => {
                                        const initials = family.household_name ? family.household_name.charAt(0).toUpperCase() : "?";
                                        return (
                                            <tr
                                                key={family.id}
                                                onClick={() => setDetailFamilyId(family.id)}
                                                className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 transition-colors duration-150 cursor-pointer"
                                            >
                                                <td className="px-5 py-4">
                                                    <span className="text-[11px] font-mono font-bold text-zinc-400 dark:text-zinc-500">#{family.id}</span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 uppercase">
                                                            {initials}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-zinc-900 dark:text-zinc-100 text-sm leading-tight uppercase group-hover:text-primary transition-colors">
                                                                {family.household_name}
                                                            </p>
                                                            {family.legacy_pid && (
                                                                <span className="text-[10px] font-mono text-zinc-400 mt-0.5 block">
                                                                    Legacy PID: {family.legacy_pid}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    {family.primary_guardian ? (
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                                                                {family.primary_guardian.name}
                                                            </span>
                                                            {family.primary_guardian.cnic && (
                                                                <span className="text-[10px] font-mono text-zinc-400">
                                                                    CNIC: {family.primary_guardian.cnic}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-zinc-450 dark:text-zinc-500 italic">No primary guardian</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex flex-col gap-0.5 max-w-[240px]">
                                                        {family.email ? (
                                                            <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate flex items-center gap-1.5">
                                                                <Mail className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                                                                {family.email}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-zinc-300 dark:text-zinc-600 italic">No email</span>
                                                        )}
                                                        {family.primary_address ? (
                                                            <span className="text-xs text-zinc-500 dark:text-zinc-450 truncate flex items-center gap-1.5 mt-0.5" title={family.primary_address}>
                                                                <MapPin className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                                                                {family.primary_address}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-zinc-300 dark:text-zinc-600 italic">No address</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex flex-wrap gap-1.5 max-w-[320px]">
                                                        {family.students && family.students.length > 0 ? (
                                                            family.students.map((student) => (
                                                                <span key={student.cc} className="inline-flex items-center gap-1 text-[10px] bg-zinc-50 dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg px-2 py-0.5 font-bold uppercase tracking-tight">
                                                                    <GraduationCap className="h-3 w-3 text-zinc-400 dark:text-zinc-500" />
                                                                    {student.full_name}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-[10px] text-zinc-450 dark:text-zinc-500 italic">No enrolled students</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDetailFamilyId(family.id);
                                                        }}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] font-black uppercase tracking-widest rounded-lg border border-zinc-200 dark:border-zinc-800 transition-colors"
                                                    >
                                                        <Eye className="h-3.5 w-3.5" />
                                                        Details
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {meta && meta.pages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <p className="text-[12px] text-zinc-400 dark:text-zinc-500">
                        Page <strong className="text-zinc-600 dark:text-zinc-400">{meta.page}</strong> of <strong className="text-zinc-600 dark:text-zinc-400">{meta.pages}</strong>
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={!meta.hasPrev}
                            className="h-8 w-8 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        {Array.from({ length: Math.min(5, meta.pages) }, (_, i) => {
                            const p = meta.page <= 3 ? i + 1 : meta.page - 2 + i;
                            if (p < 1 || p > meta.pages) return null;
                            return (
                                <button key={p} onClick={() => setPage(p)} className={`h-8 w-8 text-[12px] font-bold rounded-xl transition-all ${p === meta.page ? "bg-primary text-white shadow-sm" : "border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900"}`}>
                                    {p}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => setPage(p => Math.min(meta.pages, p + 1))}
                            disabled={!meta.hasNext}
                            className="h-8 w-8 flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Family Detail Modal */}
            {detailFamilyId !== null && (
                <FamilyDetailModal
                    familyId={detailFamilyId}
                    onClose={() => setDetailFamilyId(null)}
                />
            )}

            {/* Create Family Modal — initializeFromStudent flow */}
            {isCreateFamilyModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-gradient-to-r from-violet-600 to-indigo-600">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center">
                                    <UserPlus className="h-4 w-4 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">Create New Family</h3>
                                    <p className="text-[10px] text-white/70">Build a household from a student&apos;s existing guardian data</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setIsCreateFamilyModalOpen(false); }}
                                className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                            >
                                <X className="h-3.5 w-3.5 text-white" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* How it works */}
                            <div className="flex items-start gap-3 p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 rounded-xl">
                                <AlertCircle className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                                <p className="text-[11px] text-indigo-700 dark:text-indigo-300 leading-relaxed">
                                    Search for a student by <strong>name or CC number</strong>. The system will automatically build a family household using their existing guardian records (father, mother, address, home phone).
                                </p>
                            </div>

                            {createError && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                                    <p className="text-xs text-red-700">{createError}</p>
                                </div>
                            )}

                            {/* Student search */}
                            <div>
                                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Select Student <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                    <input
                                        type="text"
                                        className="w-full pl-9 pr-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-sm bg-white dark:bg-zinc-900 transition-all"
                                        placeholder="Search by name, CC number or GR..."
                                        value={createStudentSearch}
                                        onChange={e => { setCreateStudentSearch(e.target.value); setCreateSelectedStudent(null); }}
                                    />
                                </div>

                                {/* Results dropdown */}
                                {createStudentResults.length > 0 && !createSelectedStudent && (
                                    <div className="mt-1 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 shadow-lg max-h-52 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {createStudentResults.map(s => {
                                            const name = s.core?.full_name ?? `${s.core?.first_name ?? ''} ${s.core?.last_name ?? ''}`.trim();
                                            const cc = s.core?.cc_number;
                                            const currentFamily = s.family?.household_name;
                                            return (
                                                <button
                                                    key={s.id}
                                                    className="w-full text-left px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center justify-between gap-4"
                                                    onClick={() => {
                                                        setCreateSelectedStudent(s);
                                                        setCreateStudentSearch(name);
                                                        setCreateStudentResults([]);
                                                    }}
                                                >
                                                    <div>
                                                        <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase">{name}</p>
                                                        <p className="text-[10px] text-zinc-400 font-medium mt-0.5">CC: {cc ?? '—'}</p>
                                                    </div>
                                                    {currentFamily ? (
                                                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full shrink-0">Has family</span>
                                                    ) : (
                                                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full shrink-0">No family</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Selected chip */}
                                {createSelectedStudent && (
                                    <div className="mt-2 flex items-center gap-2 px-3 py-2.5 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-xl">
                                        <div className="h-6 w-6 rounded-lg bg-violet-500 flex items-center justify-center shrink-0">
                                            <GraduationCap className="h-3.5 w-3.5 text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-violet-800 dark:text-violet-200 uppercase">
                                                {createSelectedStudent.core?.full_name ?? `${createSelectedStudent.core?.first_name} ${createSelectedStudent.core?.last_name}`}
                                            </p>
                                            <p className="text-[10px] text-violet-500 font-medium">CC: {createSelectedStudent.core?.cc_number ?? '—'}</p>
                                        </div>
                                        <button
                                            onClick={() => { setCreateSelectedStudent(null); setCreateStudentSearch(''); }}
                                            className="text-violet-400 hover:text-violet-600 transition-colors"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t bg-zinc-50 dark:bg-zinc-900 flex justify-end gap-3">
                            <button
                                onClick={() => { setIsCreateFamilyModalOpen(false); }}
                                className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateFamily}
                                disabled={isCreating || !createSelectedStudent}
                                className="px-5 py-2 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isCreating ? (
                                    <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Creating...</>
                                ) : (
                                    <><UserPlus className="h-3.5 w-3.5" /> Create Family</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Change Student's Family Modal */}
            {isChangeFamilyModalOpen && (
                <AssignChildModal
                    studentSearch={assignStudentSearch}
                    setStudentSearch={setAssignStudentSearch}
                    familySearch={assignFamilySearch}
                    setFamilySearch={setAssignFamilySearch}
                    selectedStudentId={selectedStudentId}
                    setSelectedStudentId={setSelectedStudentId}
                    selectedStudentName={selectedStudentName}
                    setSelectedStudentName={setSelectedStudentName}
                    selectedFamilyId={selectedFamilyId}
                    setSelectedFamilyId={setSelectedFamilyId}
                    onAssign={handleAssignChild}
                    onClose={() => {
                        setIsChangeFamilyModalOpen(false);
                        setAssignStudentSearch("");
                        setAssignFamilySearch("");
                        setSelectedStudentId(null);
                        setSelectedStudentName("");
                        setSelectedFamilyId(null);
                        setAssignError(null);
                    }}
                    isAssigning={isAssigning}
                    error={assignError}
                />
            )}
        </div>
    );
}

function ActionItem({ icon, label, color = "text-zinc-700 dark:text-zinc-300", onClick }: { icon: ReactNode, label: string, color?: string, onClick?: () => void }) {
    return (
        <button onClick={onClick} className={`flex w-full items-center gap-2 px-4 py-2 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 ${color} transition-colors`}>
            <span className="h-4 w-4 opacity-70">{icon}</span>
            {label}
        </button>
    );
}

// ─── AssignChildModal ─────────────────────────────────────────────────────────

// Students API returns items in a nested shape: { id, core: {...}, family: {...} }
interface StudentHit {
    id: number;
    core?: {
        first_name: string;
        last_name: string;
        full_name: string;
        cc_number: string | null;
        gr_number: string | null;
    };
    family?: {
        household_name: string | null;
    } | null;
}

interface AssignChildModalProps {
    studentSearch: string;
    setStudentSearch: (v: string) => void;
    familySearch: string;
    setFamilySearch: (v: string) => void;
    selectedStudentId: number | null;
    setSelectedStudentId: (id: number | null) => void;
    selectedStudentName: string;
    setSelectedStudentName: (n: string) => void;
    selectedFamilyId: number | null;
    setSelectedFamilyId: (id: number | null) => void;
    onAssign: () => void;
    onClose: () => void;
    isAssigning: boolean;
    error: string | null;
}

function AssignChildModal({
    studentSearch, setStudentSearch,
    familySearch, setFamilySearch,
    selectedStudentId, setSelectedStudentId,
    selectedStudentName, setSelectedStudentName,
    selectedFamilyId, setSelectedFamilyId,
    onAssign, onClose, isAssigning, error,
}: AssignChildModalProps) {
    const debouncedStudentQ = useDebounce(studentSearch, 350);
    const debouncedFamilyQ = useDebounce(familySearch, 350);

    const [studentResults, setStudentResults] = useState<StudentHit[]>([]);
    const [selectedFamilyName, setSelectedFamilyName] = useState("");
    const [familyError, setFamilyError] = useState<string | null>(null);
    const [isLoadingFamily, setIsLoadingFamily] = useState(false);

    useEffect(() => {
        if (!debouncedStudentQ) { setStudentResults([]); return; }
        api.get('/v1/students', { params: { search: debouncedStudentQ, limit: 8, fields: 'core,family' } })
            .then(r => setStudentResults((r.data as { data: { items: StudentHit[] } }).data?.items ?? []))
            .catch(() => setStudentResults([]));
    }, [debouncedStudentQ]);

    useEffect(() => {
        const id = Number(debouncedFamilyQ.trim());
        if (!debouncedFamilyQ.trim() || isNaN(id)) {
            setSelectedFamilyId(null);
            setSelectedFamilyName("");
            setFamilyError(null);
            return;
        }

        setIsLoadingFamily(true);
        setFamilyError(null);
        familiesService.getById(id)
            .then(f => {
                setSelectedFamilyId(f.id);
                setSelectedFamilyName(f.household_name);
            })
            .catch(() => {
                setSelectedFamilyId(null);
                setSelectedFamilyName("");
                setFamilyError("Family ID not found");
            })
            .finally(() => {
                setIsLoadingFamily(false);
            });
    }, [debouncedFamilyQ, setSelectedFamilyId, setSelectedFamilyName]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-zinc-950 rounded-xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col h-[90vh] md:h-auto md:max-h-[85vh]">
                <div className="px-6 py-4 border-b flex justify-between items-center bg-zinc-50 dark:bg-zinc-900 flex-shrink-0">
                    <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">Change Student&apos;s Family</h3>
                    <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-400">✕</button>
                </div>
                <div className="p-6 flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-900/50">
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">Search for a student and select a target household to move them to.</p>
                    {error && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

                    {/* Student search */}
                    <div className="mb-6">
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Select Student to Move</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                            <input
                                type="text"
                                className="w-full pl-9 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-1 border-zinc-300 dark:border-zinc-700 focus:ring-primary focus:border-primary text-sm shadow-sm bg-white dark:bg-zinc-950"
                                placeholder="Search by name, CC, or GR..."
                                value={studentSearch}
                                onChange={e => setStudentSearch(e.target.value)}
                            />
                        </div>
                        {studentResults.length > 0 && (
                            <div className="mt-1 border rounded-lg bg-white dark:bg-zinc-950 shadow-lg z-10 max-h-44 overflow-y-auto divide-y divide-zinc-100">
                                {studentResults.map(s => (
                                    <button
                                        key={s.id}
                                        className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900 flex items-center justify-between"
                                        onClick={() => {
                                            setSelectedStudentId(s.id);
                                            setSelectedStudentName(s.core?.full_name ?? `${s.core?.first_name ?? ''} ${s.core?.last_name ?? ''}`.trim());
                                            setStudentSearch("");
                                            setStudentResults([]);
                                        }}
                                    >
                                        <span className="font-medium text-zinc-800 dark:text-zinc-200 text-xs">{s.core?.full_name ?? `${s.core?.first_name} ${s.core?.last_name}`}</span>
                                        <span className="text-zinc-400 text-[10px]">{s.core?.cc_number ?? '—'} | {s.family?.household_name ?? "No family"}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {selectedStudentId && (
                            <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                                <span className="text-xs font-medium text-blue-800">✔ Selected: {selectedStudentName}</span>
                                <button onClick={() => { setSelectedStudentId(null); setSelectedStudentName(""); }} className="ml-auto text-blue-400 hover:text-blue-600 text-xs">✕</button>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* To Column */}
                        <div className="bg-white dark:bg-zinc-950 border rounded-xl p-5 shadow-sm md:col-span-2">
                            <h4 className="font-semibold text-zinc-800 dark:text-zinc-200 mb-4 flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Target Family
                            </h4>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                <input
                                    type="text"
                                    className="w-full pl-9 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-1 border-emerald-300 focus:ring-emerald-500 focus:border-emerald-500 text-sm bg-white dark:bg-zinc-950"
                                    placeholder="Enter Target Family ID..."
                                    value={familySearch}
                                    onChange={e => setFamilySearch(e.target.value)}
                                />
                            </div>
                            {isLoadingFamily && (
                                <p className="mt-2 text-xs text-zinc-500 flex items-center gap-1.5">
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Fetching family details...
                                </p>
                            )}
                            {familyError && (
                                <p className="mt-2 text-xs text-red-600">{familyError}</p>
                            )}
                            {selectedFamilyId && !isLoadingFamily && (
                                <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                                    <span className="text-xs font-medium text-emerald-800">✔ Selected: {selectedFamilyName} (ID: {selectedFamilyId})</span>
                                    <button onClick={() => { setSelectedFamilyId(null); setSelectedFamilyName(""); setFamilySearch(""); }} className="ml-auto text-emerald-400 hover:text-emerald-600 text-xs">✕</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="px-6 py-4 border-t bg-zinc-50 dark:bg-zinc-900 flex justify-end gap-3 flex-shrink-0">
                    <button onClick={onClose} className="px-5 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-950 shadow-sm transition-colors">Cancel</button>
                    <button
                        onClick={onAssign}
                        disabled={!selectedStudentId || !selectedFamilyId || isAssigning}
                        className="px-5 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 font-medium shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >{isAssigning ? "Moving..." : "Execute Move"}</button>
                </div>
            </div>
        </div>
    );
}
