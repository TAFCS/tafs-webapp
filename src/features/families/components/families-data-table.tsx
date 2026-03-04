"use client";

import React, { useState, useMemo, useEffect, ReactNode } from "react";
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

// Mock Data Models for Families
export interface Family {
    id: number;
    idx: number;
    legacy_pid: string | null;
    household_name: string;
    primary_address: string | null;
    consent_publicity: boolean;
    username: string | null;
    password_hash?: string | null;
    created_at: string;
    deleted_at: string | null;
    email: string | null;
}

const MOCK_FAMILIES: Family[] = [
    {
        idx: 0,
        id: 1,
        legacy_pid: null,
        household_name: "Test Household",
        primary_address: null,
        consent_publicity: false,
        username: "testparent",
        password_hash: "$2b$10$r7huqZ3gGnNHvgtvUtVCCuhmBGjBZIOotUJFOtmiEaPyEmId5LgU2",
        created_at: "2026-03-03 11:04:13.37332",
        deleted_at: null,
        email: "parent@example.com"
    },
    {
        idx: 1,
        id: 4,
        legacy_pid: null,
        household_name: "dsada",
        primary_address: null,
        consent_publicity: false,
        username: null,
        password_hash: null,
        created_at: "2026-03-03 13:21:29.778",
        deleted_at: null,
        email: null
    },
    {
        idx: 2,
        id: 7,
        legacy_pid: null,
        household_name: "asdad",
        primary_address: null,
        consent_publicity: false,
        username: null,
        password_hash: null,
        created_at: "2026-03-04 09:20:57.824",
        deleted_at: null,
        email: null
    },
    {
        idx: 3,
        id: 11,
        legacy_pid: null,
        household_name: "fdsfasdfa",
        primary_address: null,
        consent_publicity: false,
        username: null,
        password_hash: null,
        created_at: "2026-03-04 09:41:03.483",
        deleted_at: null,
        email: null
    }
];

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

export function FamiliesDataTable() {
    const [isLoading, setIsLoading] = useState(false);

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

    // Derived Logic: Filters
    const filteredData = useMemo(() => {
        return MOCK_FAMILIES.filter(family => {
            // 1. Global Search
            if (debouncedSearch) {
                const q = debouncedSearch.toLowerCase();
                const matches =
                    family.id.toString().includes(q) ||
                    family.household_name.toLowerCase().includes(q) ||
                    (family.email?.toLowerCase().includes(q) || false) ||
                    (family.username?.toLowerCase().includes(q) || false);
                if (!matches) return false;
            }

            return true;
        });
    }, [debouncedSearch]);

    return (
        <div className="bg-white border rounded-xl shadow-sm flex flex-col w-full text-sm flex-1 min-h-0">

            {/* Top Toolbar */}
            <div className="p-4 border-b flex flex-col gap-4 lg:flex-row lg:items-center justify-between bg-zinc-50/50 rounded-t-xl">

                <div className="relative w-full lg:max-w-md flex-1">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isLoading ? 'text-primary animate-pulse' : 'text-zinc-400'}`} />
                    <input
                        type="text"
                        placeholder="Search Household, ID, Email..."
                        className="w-full pl-9 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-zinc-100 transition-colors ${showFilters ? 'bg-zinc-100 border-zinc-300' : 'bg-white'}`}
                    >
                        <Filter className="h-4 w-4" />
                        <span className="font-medium">Filters</span>
                    </button>

                    <div className="relative columns-menu-container">
                        <button
                            onClick={() => setShowColumnToggles(!showColumnToggles)}
                            className="flex items-center gap-2 px-3 py-2 border bg-white rounded-lg hover:bg-zinc-100 transition-colors"
                        >
                            <Columns className="h-4 w-4" />
                            <span className="font-medium hidden sm:inline-block">Columns</span>
                            <ChevronDown className="h-3 w-3 opacity-50" />
                        </button>

                        {showColumnToggles && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-white border rounded-lg shadow-xl z-50 p-2 max-h-96 overflow-y-auto">
                                <div className="text-xs font-semibold text-zinc-500 px-2 py-1 uppercase tracking-wider mb-1">Toggle Columns</div>
                                {COLUMNS.map((col) => (
                                    <label key={col.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-50 rounded cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="rounded border-zinc-300 text-primary focus:ring-primary h-4 w-4"
                                            checked={visibleColumns.has(col.id)}
                                            onChange={() => toggleColumn(col.id)}
                                            disabled={col.isDefault && visibleColumns.has(col.id) && visibleColumns.size === 1}
                                        />
                                        <span className="text-zinc-700">{col.label}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>


            </div>

            {/* Advanced Filters Panel (Placeholder for now) */}
            {showFilters && (
                <div className="p-4 border-b bg-zinc-50 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-zinc-600">Consent Status</label>
                        <select className="border rounded-md px-3 py-1.5 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-primary/20">
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
                        <tr className="bg-zinc-50 border-b text-zinc-500 font-medium text-xs uppercase tracking-wider">
                            {COLUMNS.map(col => {
                                if (!visibleColumns.has(col.id)) return null;
                                return (
                                    <th key={col.id} className="py-3 px-4 first:pl-6">
                                        {col.label}
                                    </th>
                                );
                            })}
                            <th className="py-3 px-4 text-right pr-6 sticky right-0 bg-zinc-50 border-l shadow-[-10px_0_15px_-5px_rgb(0,0,0,0.03)] z-10 w-[80px]">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 relative">
                        {filteredData.length === 0 ? (
                            <tr>
                                <td colSpan={visibleColumns.size + 1} className="py-12 text-center text-zinc-500">
                                    No families found matching your criteria.
                                </td>
                            </tr>
                        ) : (
                            filteredData.map((family) => (
                                <tr key={family.id} className="hover:bg-zinc-50/50 transition-colors group">
                                    {COLUMNS.map(col => {
                                        if (!visibleColumns.has(col.id)) return null;

                                        let cellContent: ReactNode = family[col.id] as ReactNode;

                                        if (col.id === "id") {
                                            cellContent = (
                                                <span className="font-mono text-zinc-400 bg-zinc-50 px-1.5 py-0.5 rounded border border-zinc-200 text-xs">#{family.id}</span>
                                            );
                                        }

                                        if (col.id === "household_name") {
                                            cellContent = (
                                                <div className="font-semibold text-zinc-900 flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                                                        {family.household_name.charAt(0).toUpperCase()}
                                                    </div>
                                                    {family.household_name}
                                                </div>
                                            );
                                        }

                                        if (col.id === "email") {
                                            cellContent = family.email ? (
                                                <span className="text-zinc-600 lowercase">{family.email}</span>
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
                                                    <span className="text-zinc-700">{date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                    <span className="text-[10px] text-zinc-400">{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            );
                                        }

                                        if (col.id === "consent_publicity") {
                                            cellContent = (
                                                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${family.consent_publicity ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-zinc-50 text-zinc-500 border-zinc-200"}`}>
                                                    {family.consent_publicity ? "Granted" : "Not Provided"}
                                                </span>
                                            );
                                        }

                                        return (
                                            <td key={col.id} className="py-3 px-4 first:pl-6 text-zinc-700">
                                                {cellContent}
                                            </td>
                                        );
                                    })}

                                    <td className="py-3 px-4 text-right pr-6 sticky right-0 bg-white group-hover:bg-zinc-50 border-l shadow-[-10px_0_15px_-5px_rgb(0,0,0,0.03)] transition-colors z-10 w-[80px]">
                                        <div className="relative inline-block text-left action-menu-container">
                                            <button
                                                onClick={() => setOpenActionRowId(openActionRowId === family.id ? null : family.id)}
                                                className="p-1.5 rounded-md hover:bg-zinc-200 text-zinc-500 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
                                            >
                                                <MoreVertical className="h-4 w-4" />
                                            </button>

                                            {openActionRowId === family.id && (
                                                <div className="absolute right-0 top-8 mt-1 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none z-50 overflow-hidden divide-y divide-zinc-100 flex flex-col">
                                                    <div className="py-1">
                                                        <ActionItem icon={<Eye />} label="View Family Profile" onClick={() => setOpenActionRowId(null)} />
                                                        <ActionItem icon={<Users />} label="View Enrolled Students" />
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

            <div className="p-4 border-t bg-zinc-50 rounded-b-xl flex flex-col sm:flex-row gap-4 justify-between items-center text-zinc-500">
                <span>Showing {filteredData.length} records</span>
                <div className="flex gap-2">
                    <button className="px-3 py-1.5 border rounded-lg bg-white hover:bg-zinc-50 transition-colors disabled:opacity-50" disabled>Previous</button>
                    <button className="px-3 py-1.5 border rounded-lg bg-white hover:bg-zinc-50 transition-colors disabled:opacity-50" disabled>Next</button>
                </div>
            </div>
        </div>
    );
}

function ActionItem({ icon, label, color = "text-zinc-700", onClick }: { icon: ReactNode, label: string, color?: string, onClick?: () => void }) {
    return (
        <button onClick={onClick} className={`flex w-full items-center gap-2 px-4 py-2 text-xs font-medium hover:bg-zinc-100 ${color} transition-colors`}>
            <span className="h-4 w-4 opacity-70">{icon}</span>
            {label}
        </button>
    );
}
