"use client";

import { useState } from "react";
import {
    ArrowLeftRight,
    Search,
    Loader2,
    AlertCircle,
    User,
    Building2,
    BookOpen,
    Hash,
    ChevronRight,
    FileText,
    GraduationCap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface StudentResult {
    cc: number;
    full_name: string;
    gr_number?: string;
    campus_name?: string;
    class_name?: string;
    section_name?: string;
    academic_system?: string;
    segment_head?: string;
    photograph_url?: string | null;
}

export default function TransfersPage() {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState<StudentResult[]>([]);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const q = searchTerm.trim();
        if (!q) return;

        setIsSearching(true);
        setHasSearched(true);
        try {
            const { data: res } = await api.get(`/v1/transfers/search`, {
                params: { q },
            });
            const raw = res.data || res;
            setResults(
                (raw || []).map((s: any) => ({
                    cc: s.cc,
                    full_name: s.full_name,
                    gr_number: s.gr_number,
                    campus_name: s.campus_name,
                    class_name: s.class_name,
                    section_name: s.section_name,
                    academic_system: s.academic_system,
                    photograph_url: s.photograph_url,
                }))
            );
        } catch (err: any) {
            toast.error("Search failed. Please try again.");
            setResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleDirectCC = () => {
        const num = parseInt(searchTerm.trim());
        if (!isNaN(num) && num > 0) {
            router.push(`/transfers/transfer-order/${num}`);
        } else {
            toast.error("Enter a valid CC number to jump directly.");
        }
    };

    return (
        <div className="space-y-8 max-w-5xl mx-auto">

            {/* ── HEADER ── */}
            <div className="relative bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-8 overflow-hidden">
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="h-12 w-12 rounded-2xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                            <ArrowLeftRight className="h-6 w-6 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
                                Student Transfers
                            </h1>
                            <p className="text-zinc-500 dark:text-zinc-400 font-medium text-sm">
                                Shift a student between Cambridge and Secondary (or vice versa)
                            </p>
                        </div>
                    </div>

                    {/* ── SEARCH BAR ── */}
                    <form onSubmit={handleSearch} className="mt-6 flex gap-3">
                        <div className="relative flex-1 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-red-500 transition-colors" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by student name or CC number..."
                                className="w-full pl-12 pr-4 py-3.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-medium text-sm"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isSearching || !searchTerm.trim()}
                            className="px-6 py-3.5 bg-zinc-900 dark:bg-white dark:text-zinc-900 text-white rounded-2xl font-black text-sm hover:bg-zinc-700 dark:hover:bg-zinc-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
                        >
                            {isSearching ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Search className="h-4 w-4" />
                            )}
                            Search
                        </button>
                        <button
                            type="button"
                            onClick={handleDirectCC}
                            disabled={isSearching || !searchTerm.trim()}
                            className="px-6 py-3.5 bg-red-700 hover:bg-red-800 text-white rounded-2xl font-black text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-red-900/20"
                        >
                            <FileText className="h-4 w-4" />
                            Direct CC
                        </button>
                    </form>
                </div>

                {/* Decorative blobs */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full -mr-32 -mt-32 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-red-500/5 rounded-full -ml-20 -mb-20 blur-2xl" />
            </div>

            {/* ── INFO STRIP ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { icon: ArrowLeftRight, title: "Cambridge → Secondary", desc: "Shift from Cambridge to Secondary curriculum" },
                    { icon: GraduationCap, title: "Secondary → Cambridge", desc: "Move to Cambridge-aligned academic track" },
                    { icon: FileText, title: "Generates PDF", desc: "Official Transfer Order form, downloadable as PDF" },
                ].map(({ icon: Icon, title, desc }) => (
                    <div key={title} className="flex items-start gap-3 p-4 bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                        <div className="h-9 w-9 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                            <Icon className="h-4.5 w-4.5 text-red-600 dark:text-red-400 h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs font-black text-zinc-800 dark:text-zinc-200">{title}</p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">{desc}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── RESULTS ── */}
            <AnimatePresence mode="wait">
                {isSearching ? (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-950 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800"
                    >
                        <Loader2 className="h-10 w-10 text-red-500 animate-spin mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Searching...</p>
                    </motion.div>
                ) : hasSearched && results.length === 0 ? (
                    <motion.div
                        key="empty"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-950 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center"
                    >
                        <AlertCircle className="h-12 w-12 text-zinc-300 dark:text-zinc-700 mb-4" />
                        <h3 className="text-lg font-bold text-zinc-700 dark:text-zinc-300">No Students Found</h3>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1 max-w-xs">
                            Try a different name or CC number, or use "Direct CC" to jump straight to a transfer order.
                        </p>
                    </motion.div>
                ) : results.length > 0 ? (
                    <motion.div
                        key="results"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="space-y-3"
                    >
                        <p className="text-xs font-black uppercase tracking-widest text-zinc-400 px-1">
                            {results.length} result{results.length !== 1 ? "s" : ""} found
                        </p>
                        {results.map((student) => (
                            <motion.div
                                key={student.cc}
                                layout
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="group bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-red-300 dark:hover:border-red-800 hover:shadow-lg hover:shadow-red-500/5 transition-all overflow-hidden flex items-center gap-4 p-4 pr-5"
                            >
                                {/* Avatar / Photo */}
                                <div className="flex-shrink-0 h-14 w-12 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                                    {student.photograph_url ? (
                                        <img
                                            src={`/api/photo-proxy?url=${encodeURIComponent(student.photograph_url)}`}
                                            alt={student.full_name}
                                            className="h-full w-full object-cover"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center text-zinc-400 font-black text-lg">
                                            {student.full_name.charAt(0)}
                                        </div>
                                    )}
                                </div>

                                {/* Main info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors truncate">
                                            {student.full_name}
                                        </h3>
                                        {student.academic_system && (
                                            <span className={`flex-shrink-0 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${student.academic_system === 'CAMBRIDGE'
                                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30'
                                                : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-100 dark:border-green-900/30'
                                                }`}>
                                                {student.academic_system}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                                        <span className="flex items-center gap-1">
                                            <Hash className="h-3 w-3" />CC {student.cc}
                                        </span>
                                        {student.gr_number && (
                                            <span className="flex items-center gap-1">
                                                <Hash className="h-3 w-3" />GR {student.gr_number}
                                            </span>
                                        )}
                                        {student.campus_name && (
                                            <span className="flex items-center gap-1">
                                                <Building2 className="h-3 w-3" />{student.campus_name}
                                            </span>
                                        )}
                                        {student.class_name && (
                                            <span className="flex items-center gap-1">
                                                <BookOpen className="h-3 w-3" />{student.class_name}
                                                {student.section_name && ` · ${student.section_name}`}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* CTA */}
                                <button
                                    onClick={() => router.push(`/transfers/transfer-order/${student.cc}`)}
                                    className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-xl font-black text-xs transition-all shadow-md shadow-red-900/20 hover:shadow-red-900/30 group-hover:scale-[1.02] active:scale-95"
                                >
                                    <ArrowLeftRight className="h-3.5 w-3.5" />
                                    Transfer Order
                                    <ChevronRight className="h-3.5 w-3.5 -mr-1" />
                                </button>
                            </motion.div>
                        ))}
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </div>
    );
}
