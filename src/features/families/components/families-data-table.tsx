"use client";

import React, { useState, useEffect, ReactNode } from "react";
import {
    Search,
    MoreVertical,
    Eye,
    Users,
    GraduationCap,
    ChevronLeft,
    ChevronRight,
    X
} from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import api from "@/lib/api";
import {
    familiesService,
    type Family,
    type PaginationMeta,
    type CreateFamilyPayload,
} from "@/lib/families.service";
import { FamilyDetailModal } from "./family-detail-modal";

interface FamiliesDataTableProps {
    isCreateOpen?: boolean;
    onCloseCreate?: () => void;
    isAssignOpen?: boolean;
    onCloseAssign?: () => void;
}

export function FamiliesDataTable({
    isCreateOpen = false,
    onCloseCreate,
    isAssignOpen = false,
    onCloseAssign,
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
    }, [page, debouncedSearch, fetchFamilies]);

    // ── Create family form state ──────────────────────────────────────────────
    const [createForm, setCreateForm] = useState<CreateFamilyPayload>({ household_name: "" });
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const handleCreateFamily = async () => {
        if (!createForm.household_name.trim()) return;
        setIsCreating(true);
        setCreateError(null);
        try {
            await familiesService.create(createForm);
            setIsCreateFamilyModalOpen(false);
            setCreateForm({ household_name: "" });
            fetchFamilies(page, debouncedSearch);
        } catch {
            setCreateError("Failed to create family. Please try again.");
        } finally {
            setIsCreating(false);
        }
    };

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
                        className="w-full h-10 pl-10 pr-10 text-[13px] font-medium bg-white dark:bg-zinc-950 border border-zinc-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-zinc-400"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 hover:text-zinc-600">
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
                    <div className="flex flex-col items-center justify-center py-32 bg-zinc-50 border border-zinc-100 rounded-2xl gap-4">
                        <div className="p-5 bg-white rounded-2xl border border-zinc-100 shadow-sm">
                            <Users className="h-8 w-8 text-zinc-300" />
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-zinc-700">No families found</p>
                            <p className="text-sm text-zinc-400 mt-1">Try adjusting your search query</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {families.map((family) => {
                            const initials = family.household_name ? family.household_name.charAt(0).toUpperCase() : "?";
                            return (
                                <div key={family.id} className="group bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-900 rounded-2xl p-4 hover:shadow-md hover:border-zinc-200 dark:hover:border-zinc-800 transition-all duration-200 flex flex-col justify-between h-full relative">
                                    <div>
                                        <div className="flex items-start justify-between gap-3">
                                            {/* Avatar */}
                                            <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 flex items-center justify-center font-bold text-sm shrink-0">
                                                {initials}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="font-bold text-zinc-900 dark:text-zinc-100 text-[14px] leading-tight truncate uppercase">{family.household_name}</p>
                                                    <span className="text-[10px] text-zinc-400 font-mono font-bold">#{family.id}</span>
                                                </div>
                                                <div className="mt-1 flex flex-col gap-0.5 text-[11px] text-zinc-400 font-medium">
                                                    {family.email ? (
                                                        <span className="truncate">📧 {family.email}</span>
                                                    ) : (
                                                        <span className="text-zinc-300 italic">No email provided</span>
                                                    )}
                                                    {family.primary_address && <span className="truncate">📍 {family.primary_address}</span>}
                                                    {family.legacy_pid && <span className="text-[10px] font-mono text-zinc-400">Legacy PID: {family.legacy_pid}</span>}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="relative action-menu-container">
                                                <button
                                                    onClick={() => setOpenActionRowId(openActionRowId === family.id ? null : family.id)}
                                                    className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                                                >
                                                    <MoreVertical className="h-4 w-4" />
                                                </button>
                                                {openActionRowId === family.id && (
                                                    <div className="absolute right-0 top-8 mt-1 w-52 origin-top-right rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-xl z-50 overflow-hidden flex flex-col py-1">
                                                        <div className="py-1">
                                                            <ActionItem icon={<Eye />} label="View Family Details" onClick={() => { setDetailFamilyId(family.id); setOpenActionRowId(null); }} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Linked Students List */}
                                        <div className="mt-3 flex flex-wrap gap-1.5">
                                            {family.students && family.students.length > 0 ? (
                                                family.students.map((student) => (
                                                    <span key={student.cc} className="inline-flex items-center gap-1 text-[10px] bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-zinc-500 rounded-md px-1.5 py-0.5 font-bold uppercase tracking-tight">
                                                        <GraduationCap className="h-2.5 w-2.5 text-zinc-400" />
                                                        {student.full_name}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-[10px] text-zinc-400 italic">No enrolled students</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Primary Guardian Footer */}
                                    {family.primary_guardian && (
                                        <div className="mt-3 pt-3 border-t border-zinc-50 dark:border-zinc-900/50 flex items-center justify-between text-[11px] text-zinc-500">
                                            <span className="truncate font-semibold">👤 {family.primary_guardian.name}</span>
                                            {family.primary_guardian.cnic && (
                                                <span className="text-[10px] font-mono font-bold text-zinc-400">{family.primary_guardian.cnic}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

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

            {/* Family Detail Modal */}
            {detailFamilyId !== null && (
                <FamilyDetailModal
                    familyId={detailFamilyId}
                    onClose={() => setDetailFamilyId(null)}
                />
            )}

            {/* Create Family Modal */}
            {isCreateFamilyModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white dark:bg-zinc-950 rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-zinc-50 dark:bg-zinc-900">
                            <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">Create New Family</h3>
                            <button onClick={() => { setIsCreateFamilyModalOpen(false); setCreateForm({ household_name: "" }); setCreateError(null); }} className="text-zinc-400 hover:text-zinc-600 dark:text-zinc-400">✕</button>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto">
                            <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-4">Enter details to create a new household record.</p>
                            {createError && <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{createError}</p>}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Household Name <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 border-zinc-300 dark:border-zinc-700 focus:ring-primary focus:border-primary text-sm"
                                        placeholder="e.g. The Smith Family"
                                        value={createForm.household_name}
                                        onChange={e => setCreateForm(f => ({ ...f, household_name: e.target.value }))}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Email</label>
                                        <input
                                            type="email"
                                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 border-zinc-300 dark:border-zinc-700 focus:ring-primary focus:border-primary text-sm"
                                            value={createForm.email ?? ""}
                                            onChange={e => setCreateForm(f => ({ ...f, email: e.target.value || undefined }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Password</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 border-zinc-300 dark:border-zinc-700 focus:ring-primary focus:border-primary text-sm"
                                            value={createForm.password ?? ""}
                                            onChange={e => setCreateForm(f => ({ ...f, password: e.target.value || undefined }))}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Address</label>
                                    <textarea
                                        rows={2}
                                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 border-zinc-300 dark:border-zinc-700 focus:ring-primary focus:border-primary text-sm resize-none"
                                        value={createForm.primary_address ?? ""}
                                        onChange={e => setCreateForm(f => ({ ...f, primary_address: e.target.value || undefined }))}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t bg-zinc-50 dark:bg-zinc-900 flex justify-end gap-3">
                            <button onClick={() => { setIsCreateFamilyModalOpen(false); setCreateForm({ household_name: "" }); setCreateError(null); }} className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-950 shadow-sm transition-colors">Cancel</button>
                            <button
                                onClick={handleCreateFamily}
                                disabled={isCreating || !createForm.household_name.trim()}
                                className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 font-medium shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >{isCreating ? "Creating..." : "Create Family"}</button>
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
    const [familyResults, setFamilyResults] = useState<Family[]>([]);
    const [selectedFamilyName, setSelectedFamilyName] = useState("");

    useEffect(() => {
        if (!debouncedStudentQ) { setStudentResults([]); return; }
        api.get('/v1/students', { params: { search: debouncedStudentQ, limit: 8, fields: 'core,family' } })
            .then(r => setStudentResults((r.data as { data: { items: StudentHit[] } }).data?.items ?? []))
            .catch(() => setStudentResults([]));
    }, [debouncedStudentQ]);

    useEffect(() => {
        if (!debouncedFamilyQ) { setFamilyResults([]); return; }
        familiesService.list({ search: debouncedFamilyQ, limit: 8 })
            .then(r => setFamilyResults(r.data))
            .catch(() => setFamilyResults([]));
    }, [debouncedFamilyQ]);

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
                                    placeholder="Search target families..."
                                    value={familySearch}
                                    onChange={e => setFamilySearch(e.target.value)}
                                />
                            </div>
                            {familyResults.length > 0 && (
                                <div className="mt-1 border rounded-lg bg-white dark:bg-zinc-950 shadow-lg max-h-44 overflow-y-auto divide-y divide-zinc-100">
                                    {familyResults.map(f => (
                                        <button
                                            key={f.id}
                                            className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900 flex items-center justify-between"
                                            onClick={() => {
                                                setSelectedFamilyId(f.id);
                                                setSelectedFamilyName(f.household_name);
                                                setFamilySearch("");
                                                setFamilyResults([]);
                                            }}
                                        >
                                            <span className="font-medium text-zinc-800 dark:text-zinc-200 text-xs">{f.household_name}</span>
                                            <span className="text-zinc-400 text-[10px]">{f.email ?? "No email"}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {selectedFamilyId && (
                                <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                                    <span className="text-xs font-medium text-emerald-800">✔ Selected: {selectedFamilyName}</span>
                                    <button onClick={() => { setSelectedFamilyId(null); setSelectedFamilyName(""); }} className="ml-auto text-emerald-400 hover:text-emerald-600 text-xs">✕</button>
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
