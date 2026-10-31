"use client";

import { useState, useEffect } from "react";
import {
    Flag,
    Save,
    Loader2,
    RefreshCw,
    Plus,
    Trash2,
    ShieldAlert,
    CheckCircle2,
    XCircle,
    Palette,
    AlertCircle,
    UserCheck,
    Check,
} from "lucide-react";
import api from "@/lib/api";
import { useDeleteGuard } from "@/hooks/use-delete-guard";
import { useHousesAccess } from "@/hooks/use-houses-access";
import toast from "react-hot-toast";

interface HouseItem {
    id: number;
    house_name: string;
    house_color: string | null;
    is_active: boolean;
}

const PRESET_COLORS = [
    { label: "Red", value: "#EF4444" },
    { label: "Blue", value: "#3B82F6" },
    { label: "Green", value: "#10B981" },
    { label: "Yellow", value: "#EAB308" },
    { label: "Purple", value: "#8B5CF6" },
    { label: "Orange", value: "#F97316" },
    { label: "Teal", value: "#14B8A6" },
    { label: "Pink", value: "#EC4899" },
    { label: "Indigo", value: "#6366F1" },
];

export default function HousesPage() {
    const access = useHousesAccess();
    const [houses, setHouses] = useState<HouseItem[]>([]);
    const [originalHouses, setOriginalHouses] = useState<HouseItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
    const [searchQuery, setSearchQuery] = useState("");

    const deleteGuard = useDeleteGuard("houses");

    // Add Modal state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [newHouse, setNewHouse] = useState({
        house_name: "",
        house_color: "#3B82F6",
        is_active: true,
    });

    // Delete Modal state
    const [deleteTarget, setDeleteTarget] = useState<HouseItem | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchHouses = async () => {
        setIsLoading(true);
        try {
            const { data } = await api.get("/v1/houses?include_inactive=true");
            const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
            const mapped: HouseItem[] = items.map((item: any) => ({
                id: Number(item.id),
                house_name: item.house_name || "",
                house_color: item.house_color || "",
                is_active: item.is_active !== undefined ? Boolean(item.is_active) : true,
            }));
            setHouses(mapped);
            setOriginalHouses(JSON.parse(JSON.stringify(mapped)));
        } catch (err: any) {
            console.error("Failed to load houses:", err);
            toast.error("Failed to load houses. Please try again.");
            setHouses([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHouses();
    }, []);

    const handleFieldChange = (id: number, field: keyof HouseItem, value: any) => {
        setHouses(prev =>
            prev.map(h => (h.id === id ? { ...h, [field]: value } : h))
        );
    };

    const handleToggleActive = (id: number) => {
        if (!access.can("edit")) {
            toast.error("You do not have permission to edit houses.");
            return;
        }
        setHouses(prev =>
            prev.map(h => (h.id === id ? { ...h, is_active: !h.is_active } : h))
        );
    };

    const handleSave = async () => {
        if (!access.can("edit")) {
            toast.error("You do not have permission to edit houses.");
            return;
        }

        const modified = houses.filter(h => {
            const orig = originalHouses.find(o => o.id === h.id);
            if (!orig) return false;
            return (
                orig.house_name !== h.house_name ||
                orig.house_color !== h.house_color ||
                orig.is_active !== h.is_active
            );
        });

        if (modified.length === 0) {
            toast.success("No changes to save.");
            return;
        }

        setIsSaving(true);
        try {
            await api.patch("/v1/houses/bulk", {
                items: modified.map(h => ({
                    id: h.id,
                    house_name: h.house_name,
                    house_color: h.house_color,
                    is_active: h.is_active,
                })),
            });
            toast.success(`Successfully saved ${modified.length} house(s).`);
            setOriginalHouses(JSON.parse(JSON.stringify(houses)));
        } catch (err: any) {
            console.error("Error saving houses:", err);
            const msg = err.response?.data?.message || "Failed to save houses.";
            toast.error(Array.isArray(msg) ? msg.join("; ") : msg);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddHouse = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!access.can("create")) {
            toast.error("You do not have permission to create houses.");
            return;
        }

        if (!newHouse.house_name.trim()) {
            toast.error("House name is required.");
            return;
        }

        setIsAdding(true);
        try {
            await api.post("/v1/houses", {
                house_name: newHouse.house_name.trim(),
                house_color: newHouse.house_color.trim(),
                is_active: newHouse.is_active,
            });
            toast.success("House created successfully.");
            setIsAddModalOpen(false);
            setNewHouse({ house_name: "", house_color: "#3B82F6", is_active: true });
            fetchHouses();
        } catch (err: any) {
            console.error("Error adding house:", err);
            const msg = err.response?.data?.message || "Failed to add house.";
            toast.error(Array.isArray(msg) ? msg.join("; ") : msg);
        } finally {
            setIsAdding(false);
        }
    };

    const openDeleteDialog = async (house: HouseItem) => {
        setDeleteTarget(house);
        await deleteGuard.check(house.id);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        if (!access.can("delete")) {
            toast.error("You do not have permission to delete houses.");
            return;
        }

        setIsDeleting(true);
        try {
            await api.delete(`/v1/houses/${deleteTarget.id}`);
            toast.success("House deleted successfully.");
            setDeleteTarget(null);
            deleteGuard.reset();
            fetchHouses();
        } catch (err: any) {
            console.error("Error deleting house:", err);
            const msg = err.response?.data?.message || "Failed to delete house.";
            toast.error(Array.isArray(msg) ? msg.join("; ") : msg);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeactivateFromModal = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await api.patch(`/v1/houses/${deleteTarget.id}`, { is_active: false });
            toast.success(`${deleteTarget.house_name} deactivated successfully.`);
            setDeleteTarget(null);
            deleteGuard.reset();
            fetchHouses();
        } catch (err: any) {
            const msg = err.response?.data?.message || "Failed to deactivate house.";
            toast.error(Array.isArray(msg) ? msg.join("; ") : msg);
        } finally {
            setIsDeleting(false);
        }
    };

    const hasChanges = JSON.stringify(houses) !== JSON.stringify(originalHouses);

    const filteredHouses = houses.filter(h => {
        if (filterStatus === "ACTIVE" && !h.is_active) return false;
        if (filterStatus === "INACTIVE" && h.is_active) return false;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            return (
                h.house_name.toLowerCase().includes(q) ||
                (h.house_color && h.house_color.toLowerCase().includes(q))
            );
        }
        return true;
    });

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
            {/* Top Setup notice */}
            <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl text-indigo-700 dark:text-indigo-300">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <p className="text-xs font-medium">
                    Setup zone — Houses are referenced by student enrollment, profiling, and house balancing. Active houses appear in drop-downs and auto-balancers; deactivated houses remain on existing student records.
                </p>
            </div>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                            <Flag className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Houses</h1>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                Configure student houses, colors, and active status.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {access.can("create") && (
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm shadow-indigo-500/20 transition-all active:scale-95"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Add House
                        </button>
                    )}
                    <button
                        onClick={fetchHouses}
                        disabled={isLoading || isSaving}
                        className="inline-flex items-center justify-center px-3.5 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-xl shadow-sm transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                    {access.can("edit") && (
                        <button
                            onClick={handleSave}
                            disabled={isLoading || isSaving || !hasChanges}
                            className="inline-flex items-center justify-center px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 text-sm font-semibold rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    Save Changes
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl max-w-fit">
                    {(["ALL", "ACTIVE", "INACTIVE"] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setFilterStatus(tab)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                                filterStatus === tab
                                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
                                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                            }`}
                        >
                            {tab === "ALL" ? "All Houses" : tab === "ACTIVE" ? "Active" : "Deactivated"}
                        </button>
                    ))}
                </div>

                <div className="w-full sm:w-72">
                    <input
                        type="text"
                        placeholder="Search by name or color..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-50/80 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-5 py-3.5 w-16">ID</th>
                                <th className="px-5 py-3.5">House Name</th>
                                <th className="px-5 py-3.5">Color & Preview</th>
                                <th className="px-5 py-3.5 text-center w-36">Status</th>
                                <th className="px-5 py-3.5 text-right w-28">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-zinc-500">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                                        Loading houses...
                                    </td>
                                </tr>
                            ) : filteredHouses.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                                        <Flag className="h-8 w-8 mx-auto mb-2 text-zinc-400 opacity-60" />
                                        No houses found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                filteredHouses.map(house => {
                                    const orig = originalHouses.find(o => o.id === house.id);
                                    const isRowModified =
                                        orig &&
                                        (orig.house_name !== house.house_name ||
                                            orig.house_color !== house.house_color ||
                                            orig.is_active !== house.is_active);

                                    return (
                                        <tr
                                            key={house.id}
                                            className={`transition-colors ${
                                                isRowModified
                                                    ? "bg-amber-50/40 dark:bg-amber-950/20"
                                                    : "hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40"
                                            }`}
                                        >
                                            <td className="px-5 py-4 font-mono text-xs text-zinc-400">
                                                #{house.id}
                                            </td>

                                            <td className="px-5 py-4">
                                                {access.can("edit") ? (
                                                    <input
                                                        type="text"
                                                        value={house.house_name}
                                                        onChange={e =>
                                                            handleFieldChange(
                                                                house.id,
                                                                "house_name",
                                                                e.target.value
                                                            )
                                                        }
                                                        className="w-full max-w-sm px-3 py-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100 bg-transparent border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-950 rounded-lg transition-all focus:outline-none"
                                                    />
                                                ) : (
                                                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                                                        {house.house_name}
                                                    </span>
                                                )}
                                            </td>

                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-6 h-6 rounded-full border border-black/10 shadow-sm shrink-0"
                                                        style={{
                                                            backgroundColor:
                                                                house.house_color || "#94a3b8",
                                                        }}
                                                    />
                                                    {access.can("edit") ? (
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                value={house.house_color || ""}
                                                                placeholder="e.g. #3B82F6 or RED"
                                                                onChange={e =>
                                                                    handleFieldChange(
                                                                        house.id,
                                                                        "house_color",
                                                                        e.target.value
                                                                    )
                                                                }
                                                                className="w-32 px-2.5 py-1 text-xs font-mono bg-transparent border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-950 rounded-lg transition-all focus:outline-none"
                                                            />
                                                            <input
                                                                type="color"
                                                                value={
                                                                    house.house_color &&
                                                                    house.house_color.startsWith("#")
                                                                        ? house.house_color
                                                                        : "#3B82F6"
                                                                }
                                                                onChange={e =>
                                                                    handleFieldChange(
                                                                        house.id,
                                                                        "house_color",
                                                                        e.target.value
                                                                    )
                                                                }
                                                                className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                                                                title="Pick color"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs font-mono text-zinc-500 uppercase">
                                                            {house.house_color || "None"}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-5 py-4 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleActive(house.id)}
                                                    disabled={!access.can("edit")}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                                                        house.is_active
                                                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"
                                                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
                                                    } ${access.can("edit") ? "hover:scale-105 cursor-pointer" : "cursor-default"}`}
                                                    title={
                                                        access.can("edit")
                                                            ? "Click to toggle active status"
                                                            : undefined
                                                    }
                                                >
                                                    {house.is_active ? (
                                                        <>
                                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                                            Active
                                                        </>
                                                    ) : (
                                                        <>
                                                            <XCircle className="h-3.5 w-3.5 text-zinc-400" />
                                                            Deactivated
                                                        </>
                                                    )}
                                                </button>
                                            </td>

                                            <td className="px-5 py-4 text-right">
                                                {access.can("delete") && (
                                                    <button
                                                        onClick={() => openDeleteDialog(house)}
                                                        className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                                                        title="Delete house"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add House Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
                        <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-xl">
                                    <Flag className="h-5 w-5" />
                                </div>
                                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                    Add New House
                                </h2>
                            </div>
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleAddHouse}>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                                        House Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. IQBAL HOUSE or FALCON"
                                        value={newHouse.house_name}
                                        onChange={e =>
                                            setNewHouse({ ...newHouse, house_name: e.target.value })
                                        }
                                        className="w-full px-3.5 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
                                        House Color
                                    </label>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div
                                            className="w-8 h-8 rounded-xl border border-black/10 shrink-0 shadow-sm"
                                            style={{ backgroundColor: newHouse.house_color }}
                                        />
                                        <input
                                            type="text"
                                            value={newHouse.house_color}
                                            onChange={e =>
                                                setNewHouse({ ...newHouse, house_color: e.target.value })
                                            }
                                            className="flex-1 px-3 py-2 text-sm font-mono bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                            placeholder="#3B82F6"
                                        />
                                        <input
                                            type="color"
                                            value={
                                                newHouse.house_color.startsWith("#")
                                                    ? newHouse.house_color
                                                    : "#3B82F6"
                                            }
                                            onChange={e =>
                                                setNewHouse({ ...newHouse, house_color: e.target.value })
                                            }
                                            className="w-9 h-9 rounded-xl cursor-pointer border border-zinc-200 dark:border-zinc-700 bg-transparent p-1"
                                            title="Custom color picker"
                                        />
                                    </div>

                                    {/* Presets */}
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {PRESET_COLORS.map(c => (
                                            <button
                                                key={c.value}
                                                type="button"
                                                onClick={() =>
                                                    setNewHouse({ ...newHouse, house_color: c.value })
                                                }
                                                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition-all ${
                                                    newHouse.house_color.toLowerCase() ===
                                                    c.value.toLowerCase()
                                                        ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 font-bold"
                                                        : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                                                }`}
                                            >
                                                <span
                                                    className="w-2.5 h-2.5 rounded-full"
                                                    style={{ backgroundColor: c.value }}
                                                />
                                                {c.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <label className="flex items-center gap-2.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={newHouse.is_active}
                                            onChange={e =>
                                                setNewHouse({ ...newHouse, is_active: e.target.checked })
                                            }
                                            className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                        />
                                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                            Active immediately (available for assignment)
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3 bg-zinc-50 dark:bg-zinc-900/60">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isAdding}
                                    className="inline-flex items-center justify-center px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50"
                                >
                                    {isAdding ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Adding...
                                        </>
                                    ) : (
                                        "Add House"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete / Deactivate Confirmation Modal */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-sm">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
                        <div className="p-6">
                            {deleteGuard.isLoading ? (
                                <div className="text-center py-6">
                                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-3" />
                                    <p className="text-zinc-500 font-medium">Checking student assignments...</p>
                                </div>
                            ) : (deleteGuard.dependencies?.students || 0) > 0 ? (
                                <div>
                                    <div className="h-12 w-12 bg-amber-50 text-amber-600 dark:bg-amber-950/40 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <AlertCircle className="h-6 w-6" />
                                    </div>
                                    <h3 className="text-lg font-bold text-center text-zinc-900 dark:text-zinc-100 mb-2">
                                        House Has Assigned Students
                                    </h3>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center mb-4">
                                        <strong className="text-zinc-900 dark:text-zinc-100">
                                            {deleteTarget.house_name}
                                        </strong>{" "}
                                        currently has{" "}
                                        <strong className="text-amber-600 dark:text-amber-400">
                                            {deleteGuard.dependencies?.students} active student(s)
                                        </strong>
                                        . Hard deletion is prevented to protect student records.
                                    </p>
                                    <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl text-xs text-zinc-500 mb-5">
                                        Deactivating this house stops new students from being assigned to it and hides it from auto-rebalancing while preserving all historical records.
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-2.5">
                                        <button
                                            onClick={() => setDeleteTarget(null)}
                                            className="flex-1 py-2.5 text-sm font-medium border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleDeactivateFromModal}
                                            disabled={isDeleting}
                                            className="flex-1 py-2.5 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-sm transition-all disabled:opacity-50"
                                        >
                                            {isDeleting ? "Deactivating..." : "Deactivate House"}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div className="h-12 w-12 bg-rose-50 text-rose-600 dark:bg-rose-950/40 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Trash2 className="h-6 w-6" />
                                    </div>
                                    <h3 className="text-lg font-bold text-center text-zinc-900 dark:text-zinc-100 mb-2">
                                        Delete House?
                                    </h3>
                                    <p className="text-sm text-zinc-500 text-center mb-6">
                                        Are you sure you want to permanently delete{" "}
                                        <strong className="text-zinc-900 dark:text-zinc-100">
                                            {deleteTarget.house_name}
                                        </strong>
                                        ? This house has 0 student assignments. This action cannot be undone.
                                    </p>
                                    <div className="flex gap-2.5">
                                        <button
                                            onClick={() => setDeleteTarget(null)}
                                            className="flex-1 py-2.5 text-sm font-medium border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleDelete}
                                            disabled={isDeleting}
                                            className="flex-1 py-2.5 text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm transition-all disabled:opacity-50"
                                        >
                                            {isDeleting ? "Deleting..." : "Delete Permanently"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
