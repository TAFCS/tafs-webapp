"use client";

import React, { useState, useEffect, ReactNode } from "react";
import {
    Search,
    MoreVertical,
    Filter,
    Columns,
    ChevronDown,
    Eye,
    Link as LinkIcon,
    Edit,
    DollarSign,
    Users
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

// Columns Definition
interface ColumnDef {
    id: keyof Family;
    label: string;
    isDefault: boolean;
}

const COLUMNS: ColumnDef[] = [
    { id: "id", label: "Family ID", isDefault: true },
    { id: "household_name", label: "Household Name", isDefault: true },
    { id: "email", label: "Email Address", isDefault: true },
    { id: "username", label: "Username", isDefault: true },
    { id: "created_at", label: "Created Date", isDefault: true },
    { id: "consent_publicity", label: "Publicity Consent", isDefault: false },
    { id: "primary_address", label: "Address", isDefault: false },
    { id: "legacy_pid", label: "Legacy ID", isDefault: false },
];

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

    // State: Columns
    const [visibleColumns, setVisibleColumns] = useState<Set<keyof Family>>(
        new Set(COLUMNS.filter(c => c.isDefault).map(c => c.id))
    );
    const [showColumnToggles, setShowColumnToggles] = useState(false);

    // State: Filters
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearch = useDebounce(searchQuery, 300);
    const [showFilters, setShowFilters] = useState(false);

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
                if (!target.closest('.columns-menu-container')) {
                    setShowColumnToggles(false);
                }
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleColumn = (colId: keyof Family) => {
        const next = new Set(visibleColumns);
        if (next.has(colId)) {
            next.delete(colId);
        } else {
            next.add(colId);
        }
        setVisibleColumns(next);
    };

    return (
        <div className="bg-white dark:bg-zinc-950 border rounded-xl shadow-sm flex flex-col w-full text-sm flex-1 min-h-0">

            {/* Top Toolbar */}
            <div className="p-4 border-b flex flex-col gap-4 lg:flex-row lg:items-center justify-between bg-zinc-50 dark:bg-zinc-900/50 rounded-t-xl">

                <div className="relative w-full lg:max-w-md flex-1">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isLoading ? 'text-primary animate-pulse' : 'text-zinc-400'}`} />
                    <input
                        type="text"
                        placeholder="Search Household, ID, Email..."
                        className="w-full pl-9 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white dark:bg-zinc-950"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 transition-colors ${showFilters ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700' : 'bg-white dark:bg-zinc-950'}`}
                    >
                        <Filter className="h-4 w-4" />
                        <span className="font-medium">Filters</span>
                    </button>

                    <div className="relative columns-menu-container">
                        <button
                            onClick={() => setShowColumnToggles(!showColumnToggles)}
                            className="flex items-center gap-2 px-3 py-2 border bg-white dark:bg-zinc-950 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 transition-colors"
                        >
                            <Columns className="h-4 w-4" />
                            <span className="font-medium hidden sm:inline-block">Columns</span>
                            <ChevronDown className="h-3 w-3 opacity-50" />
                        </button>

                        {showColumnToggles && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-zinc-950 border rounded-lg shadow-xl z-50 p-2 max-h-96 overflow-y-auto">
                                <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 px-2 py-1 uppercase tracking-wider mb-1">Toggle Columns</div>
                                {COLUMNS.map((col) => (
                                    <label key={col.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900 rounded cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="rounded border-zinc-300 dark:border-zinc-700 text-primary focus:ring-primary h-4 w-4"
                                            checked={visibleColumns.has(col.id)}
                                            onChange={() => toggleColumn(col.id)}
                                            disabled={col.isDefault && visibleColumns.has(col.id) && visibleColumns.size === 1}
                                        />
                                        <span className="text-zinc-700 dark:text-zinc-300">{col.label}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* Advanced Filters Panel (Placeholder for now) */}
            {showFilters && (
                <div className="p-4 border-b bg-zinc-50 dark:bg-zinc-900 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Consent Status</label>
                        <select className="border rounded-md px-3 py-1.5 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary/20">
                            <option value="All">All Families</option>
                            <option value="Consent">Has Consent</option>
                            <option value="NoConsent">No Consent</option>
                        </select>
                    </div>
                </div>
            )}

            {/* Table Area */}
            <div className={`overflow-auto flex-1 w-full min-h-0 transition-opacity duration-200 ${isLoading ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
                <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                        <tr className="bg-zinc-50 dark:bg-zinc-900 border-b text-zinc-500 dark:text-zinc-400 font-medium text-xs uppercase tracking-wider">
                            {COLUMNS.map(col => {
                                if (!visibleColumns.has(col.id)) return null;
                                return (
                                    <th key={col.id} className="py-3 px-4 first:pl-6">
                                        {col.label}
                                    </th>
                                );
                            })}
                            <th className="py-3 px-4 text-right pr-6 sticky right-0 bg-zinc-50 dark:bg-zinc-900 border-l shadow-[-10px_0_15px_-5px_rgb(0,0,0,0.03)] z-10 w-[80px]">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 relative">
                        {error ? (
                            <tr>
                                <td colSpan={visibleColumns.size + 1} className="py-12 text-center text-red-500">
                                    {error}
                                </td>
                            </tr>
                        ) : families.length === 0 && !isLoading ? (
                            <tr>
                                <td colSpan={visibleColumns.size + 1} className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                                    No families found matching your criteria.
                                </td>
                            </tr>
                        ) : (
                            families.map((family) => (
                                <tr key={family.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900/50 transition-colors group">
                                    {COLUMNS.map(col => {
                                        if (!visibleColumns.has(col.id)) return null;

                                        let cellContent: ReactNode = family[col.id] as ReactNode;

                                        if (col.id === "id") {
                                            cellContent = (
                                                <span className="font-mono text-zinc-400 bg-zinc-50 dark:bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 text-xs">#{family.id}</span>
                                            );
                                        }

                                        if (col.id === "household_name") {
                                            cellContent = (
                                                <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                                                        {family.household_name.charAt(0).toUpperCase()}
                                                    </div>
                                                    {family.household_name}
                                                </div>
                                            );
                                        }

                                        if (col.id === "email") {
                                            cellContent = family.email ? (
                                                <span className="text-zinc-600 dark:text-zinc-400 lowercase">{family.email}</span>
                                            ) : (
                                                <span className="text-zinc-300 italic">No email provided</span>
                                            );
                                        }

                                        if (col.id === "username") {
                                            cellContent = family.username ? (
                                                <span className="text-primary font-medium">@{family.username}</span>
                                            ) : (
                                                <span className="text-zinc-300">N/A</span>
                                            );
                                        }

                                        if (col.id === "created_at") {
                                            const date = new Date(family.created_at);
                                            cellContent = (
                                                <div className="flex flex-col">
                                                    <span className="text-zinc-700 dark:text-zinc-300">{date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                    <span className="text-[10px] text-zinc-400">{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            );
                                        }

                                        if (col.id === "consent_publicity") {
                                            cellContent = (
                                                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${family.consent_publicity ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800"}`}>
                                                    {family.consent_publicity ? "Granted" : "Not Provided"}
                                                </span>
                                            );
                                        }

                                        return (
                                            <td key={col.id} className="py-3 px-4 first:pl-6 text-zinc-700 dark:text-zinc-300">
                                                {cellContent}
                                            </td>
                                        );
                                    })}

                                    <td className="py-3 px-4 text-right pr-6 sticky right-0 bg-white dark:bg-zinc-950 group-hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900 border-l shadow-[-10px_0_15px_-5px_rgb(0,0,0,0.03)] transition-colors z-10 w-[80px]">
                                        <div className="relative inline-block text-left action-menu-container">
                                            <button
                                                onClick={() => setOpenActionRowId(openActionRowId === family.id ? null : family.id)}
                                                className="p-1.5 rounded-md hover:bg-zinc-200 text-zinc-500 dark:text-zinc-400 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
                                            >
                                                <MoreVertical className="h-4 w-4" />
                                            </button>

                                            {openActionRowId === family.id && (
                                                <div className="absolute right-0 top-8 mt-1 w-56 origin-top-right rounded-md bg-white dark:bg-zinc-950 shadow-lg ring-1 ring-black/5 focus:outline-none z-50 overflow-hidden divide-y divide-zinc-100 flex flex-col">
                                                    <div className="py-1">
                                                        <ActionItem icon={<Eye />} label="View Family Profile" onClick={() => { setDetailFamilyId(family.id); setOpenActionRowId(null); }} />
                                                        <ActionItem icon={<Users />} label="View Enrolled Students" onClick={() => { setDetailFamilyId(family.id); setOpenActionRowId(null); }} />
                                                    </div>
                                                    <div className="py-1">
                                                        <ActionItem icon={<DollarSign />} label="Billing & Ledger" color="text-emerald-600" />
                                                    </div>
                                                    <div className="py-1">
                                                        <ActionItem icon={<Edit />} label="Update Information" />
                                                        <ActionItem icon={<LinkIcon />} label="Manage Credentials" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="p-4 border-t bg-zinc-50 dark:bg-zinc-900 rounded-b-xl flex flex-col sm:flex-row gap-4 justify-between items-center text-zinc-500 dark:text-zinc-400">
                <span>
                    {meta
                        ? `Showing ${(meta.page - 1) * meta.limit + 1}–${Math.min(meta.page * meta.limit, meta.total)} of ${meta.total} records`
                        : `Showing ${families.length} records`}
                </span>
                <div className="flex gap-2">
                    <button
                        className="px-3 py-1.5 border rounded-lg bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900 transition-colors disabled:opacity-50"
                        disabled={!meta?.hasPrev || isLoading}
                        onClick={() => setPage(p => p - 1)}
                    >Previous</button>
                    <button
                        className="px-3 py-1.5 border rounded-lg bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 dark:bg-zinc-900 transition-colors disabled:opacity-50"
                        disabled={!meta?.hasNext || isLoading}
                        onClick={() => setPage(p => p + 1)}
                    >Next</button>
                </div>
            </div>

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
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Username</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 border-zinc-300 dark:border-zinc-700 focus:ring-primary focus:border-primary text-sm"
                                            value={createForm.username ?? ""}
                                            onChange={e => setCreateForm(f => ({ ...f, username: e.target.value || undefined }))}
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
                                <div className="flex items-center gap-2">
                                    <input
                                        id="consent"
                                        type="checkbox"
                                        className="rounded border-zinc-300 dark:border-zinc-700 h-4 w-4 text-primary"
                                        checked={createForm.consent_publicity ?? false}
                                        onChange={e => setCreateForm(f => ({ ...f, consent_publicity: e.target.checked }))}
                                    />
                                    <label htmlFor="consent" className="text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">Family consents to publicity use</label>
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
