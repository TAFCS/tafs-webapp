"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertCircle,
    Building2,
    CheckSquare,
    GraduationCap,
    Hash,
    Loader2,
    Lock,
    RefreshCw,
    Send,
    Square,
    Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { toggleId } from "@/components/filters/filter-params";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCampuses } from "@/store/slices/campusesSlice";
import { fetchClasses } from "@/store/slices/classesSlice";
import {
    fetchPendingRelease,
    releaseBulkJob,
    releaseVouchers,
} from "@/store/slices/pendingReleaseSlice";
import type { VoucherItem } from "@/store/slices/vouchersSlice";

function formatDate(value?: string | null) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
}

function formatAmount(value?: string | number | null) {
    return Math.round(Number(value ?? 0)).toLocaleString();
}

export default function PendingReleasePage() {
    const dispatch = useAppDispatch();
    const { items, isLoading, isReleasing, error, pagination } = useAppSelector((s) => s.pendingRelease);
    const campuses = useAppSelector((s) => s.campuses.items);
    const classes = useAppSelector((s) => s.classes.items);
    const campusesLoading = useAppSelector((s) => s.campuses.isLoading);
    const classesLoading = useAppSelector((s) => s.classes.isLoading);

    const [campusIds, setCampusIds] = useState<number[]>([]);
    const [classIds, setClassIds] = useState<number[]>([]);
    const [cc, setCc] = useState("");
    const [gr, setGr] = useState("");
    const [page, setPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [releasingJobId, setReleasingJobId] = useState<number | null>(null);
    const [debouncedCc, setDebouncedCc] = useState("");
    const [debouncedGr, setDebouncedGr] = useState("");

    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedCc(cc);
            setDebouncedGr(gr);
        }, 400);
        return () => clearTimeout(t);
    }, [cc, gr]);

    useEffect(() => {
        dispatch(fetchCampuses());
        dispatch(fetchClasses());
    }, [dispatch]);

    const load = useCallback(() => {
        const ccNum = parseInt(debouncedCc, 10);
        dispatch(fetchPendingRelease({
            campus_id: campusIds.length ? campusIds.join(",") : undefined,
            class_id: classIds.length ? classIds.join(",") : undefined,
            cc: !isNaN(ccNum) && ccNum > 0 ? ccNum : undefined,
            gr: debouncedGr.trim() || undefined,
            page,
            limit: 50,
        }));
    }, [dispatch, campusIds, classIds, debouncedCc, debouncedGr, page]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        setSelectedIds(new Set());
    }, [items]);

    const groups = useMemo(() => {
        const map = new Map<string, { jobId: number | null; vouchers: VoucherItem[] }>();
        for (const v of items) {
            const jobId = v.bulk_voucher_job_id ?? null;
            const key = jobId == null ? "individual" : `job-${jobId}`;
            const existing = map.get(key);
            if (existing) existing.vouchers.push(v);
            else map.set(key, { jobId, vouchers: [v] });
        }
        return [...map.values()];
    }, [items]);

    const toggleOne = (id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleGroup = (vouchers: VoucherItem[]) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            const allSelected = vouchers.every((v) => next.has(v.id));
            for (const v of vouchers) {
                if (allSelected) next.delete(v.id);
                else next.add(v.id);
            }
            return next;
        });
    };

    const handleReleaseSelected = async () => {
        const ids = [...selectedIds];
        if (ids.length === 0) {
            toast.error("Select at least one voucher.");
            return;
        }
        try {
            const result = await dispatch(releaseVouchers(ids)).unwrap();
            toast.success(`${result.released} voucher(s) released to parents.`);
            setSelectedIds(new Set());
            load();
        } catch (err: any) {
            toast.error(typeof err === "string" ? err : "Failed to release vouchers.");
        }
    };

    const handleReleaseJob = async (jobId: number) => {
        setReleasingJobId(jobId);
        try {
            const result = await dispatch(releaseBulkJob(jobId)).unwrap();
            toast.success(`Job #${jobId}: ${result.released} voucher(s) released.`);
            load();
        } catch (err: any) {
            toast.error(typeof err === "string" ? err : "Failed to release job.");
        } finally {
            setReleasingJobId(null);
        }
    };

    const campusOptions = campuses.map((c) => ({ id: c.id, label: c.campus_name, sub: c.campus_code }));
    const classOptions = classes.map((c) => ({ id: c.id, label: c.description, sub: c.class_code }));

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                            <Lock className="h-5 w-5" />
                        </div>
                        <p className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">Finance</p>
                    </div>
                    <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">Pending Release</h1>
                    <p className="text-sm text-zinc-500 mt-1">
                        Held vouchers exist in the system but are invisible to parents until you release them.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={load}
                        disabled={isLoading}
                        className="h-12 px-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[12px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                    <button
                        onClick={handleReleaseSelected}
                        disabled={isReleasing || selectedIds.size === 0}
                        className="h-12 px-6 rounded-2xl bg-primary text-white text-[12px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:hover:scale-100"
                    >
                        {isReleasing && releasingJobId == null ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Release Selected ({selectedIds.size})
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[28px] p-6 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <FilterDropdown
                        label="Campus"
                        icon={Building2}
                        value={campusIds}
                        options={campusOptions}
                        loading={campusesLoading}
                        placeholder="All campuses"
                        onToggle={(id) => { setPage(1); setCampusIds((prev) => toggleId(prev, id)); }}
                        onClear={() => { setPage(1); setCampusIds([]); }}
                    />
                    <FilterDropdown
                        label="Class"
                        icon={GraduationCap}
                        value={classIds}
                        options={classOptions}
                        loading={classesLoading}
                        placeholder="All classes"
                        onToggle={(id) => { setPage(1); setClassIds((prev) => toggleId(prev, id)); }}
                        onClear={() => { setPage(1); setClassIds([]); }}
                    />
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] flex items-center gap-1.5 ml-1">
                            <Hash className="h-3 w-3" /> Student CC
                        </label>
                        <input
                            type="text"
                            value={cc}
                            onChange={(e) => { setPage(1); setCc(e.target.value); }}
                            placeholder="e.g. 12345"
                            className="h-11 px-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/10"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] flex items-center gap-1.5 ml-1">
                            <Users className="h-3 w-3" /> GR Number
                        </label>
                        <input
                            type="text"
                            value={gr}
                            onChange={(e) => { setPage(1); setGr(e.target.value); }}
                            placeholder="Search GR"
                            className="h-11 px-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/10"
                        />
                    </div>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 px-5 py-4 text-rose-600">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <p className="text-sm font-semibold">{error}</p>
                </div>
            )}

            {isLoading ? (
                <div className="py-24 flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-[12px] font-black uppercase tracking-widest text-zinc-400">Loading held vouchers...</p>
                </div>
            ) : items.length === 0 ? (
                <div className="py-24 flex flex-col items-center gap-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[28px]">
                    <Lock className="h-10 w-10 text-zinc-300" />
                    <p className="text-lg font-black text-zinc-900 dark:text-zinc-100">Nothing pending</p>
                    <p className="text-sm text-zinc-500">Held vouchers will appear here until they are released to parents.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {groups.map((group) => {
                        const allSelected = group.vouchers.every((v) => selectedIds.has(v.id));
                        const someSelected = group.vouchers.some((v) => selectedIds.has(v.id));
                        return (
                            <div
                                key={group.jobId == null ? "individual" : `job-${group.jobId}`}
                                className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[28px] overflow-hidden shadow-sm"
                            >
                                <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => toggleGroup(group.vouchers)}
                                            className="text-zinc-400 hover:text-primary"
                                            aria-label="Select group"
                                        >
                                            {allSelected ? <CheckSquare className="h-5 w-5 text-primary" /> : someSelected ? <CheckSquare className="h-5 w-5 text-primary/50" /> : <Square className="h-5 w-5" />}
                                        </button>
                                        <div>
                                            <p className="text-[13px] font-black text-zinc-900 dark:text-zinc-100">
                                                {group.jobId == null ? "Individually Issued" : `Bulk Job #${group.jobId}`}
                                            </p>
                                            <p className="text-[11px] font-medium text-zinc-400">
                                                {group.vouchers.length} voucher{group.vouchers.length === 1 ? "" : "s"} held
                                            </p>
                                        </div>
                                    </div>
                                    {group.jobId != null && (
                                        <button
                                            onClick={() => handleReleaseJob(group.jobId!)}
                                            disabled={isReleasing}
                                            className="h-10 px-4 rounded-xl bg-amber-500 text-white text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-amber-600 disabled:opacity-40"
                                        >
                                            {releasingJobId === group.jobId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                            Release Job
                                        </button>
                                    )}
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-zinc-50 dark:bg-zinc-900/50 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                                <th className="px-6 py-3 w-12" />
                                                <th className="px-4 py-3">Voucher</th>
                                                <th className="px-4 py-3">Student</th>
                                                <th className="px-4 py-3">Campus / Class</th>
                                                <th className="px-4 py-3">Issue</th>
                                                <th className="px-4 py-3">Due</th>
                                                <th className="px-4 py-3 text-right">Amount</th>
                                                <th className="px-4 py-3">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {group.vouchers.map((v) => (
                                                <tr key={v.id} className="border-t border-zinc-100 dark:border-zinc-900 hover:bg-zinc-50/60 dark:hover:bg-zinc-900/30">
                                                    <td className="px-6 py-3">
                                                        <button onClick={() => toggleOne(v.id)} className="text-zinc-400 hover:text-primary">
                                                            {selectedIds.has(v.id) ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5" />}
                                                        </button>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm font-bold text-zinc-900 dark:text-zinc-100">#{v.id}</td>
                                                    <td className="px-4 py-3">
                                                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{v.students?.full_name}</p>
                                                        <p className="text-[11px] text-zinc-400">CC {v.students?.cc} / GR {v.students?.gr_number || "N/A"}</p>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                                                        {v.campuses?.campus_name}
                                                        <span className="text-zinc-300"> / </span>
                                                        {v.classes?.description}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm">{formatDate(v.issue_date)}</td>
                                                    <td className="px-4 py-3 text-sm">{formatDate(v.due_date)}</td>
                                                    <td className="px-4 py-3 text-sm font-mono font-bold text-right">{formatAmount(v.total_payable_before_due)}</td>
                                                    <td className="px-4 py-3">
                                                        <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                                                            {v.status || "UNPAID"}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-3">
                    <button
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="h-10 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-[12px] font-black uppercase tracking-widest disabled:opacity-40"
                    >
                        Prev
                    </button>
                    <span className="text-sm font-bold text-zinc-500">
                        Page {pagination.page} of {pagination.totalPages} / {pagination.total} held
                    </span>
                    <button
                        disabled={page >= pagination.totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="h-10 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-[12px] font-black uppercase tracking-widest disabled:opacity-40"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
