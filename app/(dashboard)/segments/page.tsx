"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Layers,
    Search,
    Loader2,
    AlertCircle,
    Info,
    BookOpen,
    Users,
    Hash,
} from "lucide-react";
import toast from "react-hot-toast";
import { hrService, Segment } from "@/lib/hr.service";

export default function SegmentsPage() {
    const [segments, setSegments] = useState<Segment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        let alive = true;
        (async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await hrService.listSegments();
                if (alive) setSegments(data);
            } catch (err) {
                const msg =
                    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                    "Failed to load segments.";
                if (alive) {
                    setError(typeof msg === "string" ? msg : "Failed to load segments.");
                    toast.error("Failed to load segments");
                }
            } finally {
                if (alive) setIsLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    const filtered = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return segments;
        return segments.filter(
            (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
        );
    }, [segments, searchTerm]);

    const totalClasses = segments.reduce((sum, s) => sum + (s._count?.classes ?? 0), 0);
    const totalStaff = segments.reduce((sum, s) => sum + (s._count?.employee_profiles ?? 0), 0);

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20 mt-4 px-4">
            {/* Read-only notice */}
            <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-indigo-700 dark:text-indigo-300">
                <Info className="h-4 w-4 shrink-0" />
                <p className="text-[11px] font-bold">
                    Segments are system-defined wings that group classes and staff. This view is read-only.
                </p>
            </div>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-4">
                        <div className="h-12 w-12 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-[18px] flex items-center justify-center shadow-xl shadow-zinc-200 dark:shadow-none">
                            <Layers className="h-6 w-6" />
                        </div>
                        Segments
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium ml-1">
                        All academic wings configured for the institution.
                    </p>
                </div>

                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-zinc-900 dark:group-focus-within:text-zinc-100 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search segments..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-12 w-full md:w-72 pl-11 pr-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-800 transition-all shadow-sm"
                    />
                </div>
            </div>

            {/* Summary */}
            {!isLoading && !error && segments.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                    <SummaryTile label="Segments" value={segments.length} icon={Layers} />
                    <SummaryTile label="Classes" value={totalClasses} icon={BookOpen} />
                    <SummaryTile label="Staff" value={totalStaff} icon={Users} />
                </div>
            )}

            {/* Body */}
            {isLoading ? (
                <div className="flex items-center justify-center py-32 text-zinc-400">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </div>
            ) : error ? (
                <div className="flex items-center gap-3 px-5 py-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-700 dark:text-rose-300">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p className="text-sm font-bold">{error}</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="py-28 text-center bg-zinc-50 dark:bg-zinc-900 rounded-[32px] border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                    <div className="h-16 w-16 bg-white dark:bg-zinc-950 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-zinc-200 dark:shadow-none">
                        <Layers className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
                    </div>
                    <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100">
                        {segments.length === 0 ? "No segments configured" : "No matching segments"}
                    </h3>
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium mt-1 text-sm">
                        {segments.length === 0
                            ? "Segments are seeded during setup."
                            : "Try a different search term."}
                    </p>
                </div>
            ) : (
                <div className="overflow-hidden bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[28px] shadow-sm">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-zinc-100 dark:border-zinc-800/70 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                <th className="px-6 py-4 w-16">Order</th>
                                <th className="px-6 py-4">Segment</th>
                                <th className="px-6 py-4 w-32 text-right">Classes</th>
                                <th className="px-6 py-4 w-32 text-right">Staff</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((s) => (
                                <tr
                                    key={s.id}
                                    className="border-b border-zinc-50 dark:border-zinc-900 last:border-0 hover:bg-zinc-50/70 dark:hover:bg-zinc-900/50 transition-colors"
                                >
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1 text-xs font-black text-zinc-400">
                                            <Hash className="h-3 w-3" />
                                            {s.display_order}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-black text-zinc-900 dark:text-zinc-100">{s.name}</div>
                                        <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mt-0.5">
                                            {s.code}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-black text-zinc-700 dark:text-zinc-300">
                                        {s._count?.classes ?? "—"}
                                    </td>
                                    <td className="px-6 py-4 text-right font-black text-zinc-700 dark:text-zinc-300">
                                        {s._count?.employee_profiles ?? "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function SummaryTile({
    label,
    value,
    icon: Icon,
}: {
    label: string;
    value: number;
    icon: typeof Layers;
}) {
    return (
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[22px] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                <Icon className="h-3.5 w-3.5" />
                {label}
            </div>
            <div className="mt-2 text-3xl font-black text-zinc-900 dark:text-zinc-100">{value}</div>
        </div>
    );
}
