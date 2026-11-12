"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
    ArrowDown,
    ArrowLeftRight,
    ArrowUp,
    Building2,
    Download,
    Loader2,
    Minus,
    Plus,
    RotateCcw,
    Search,
    Undo2,
    Wallet,
    X,
} from "lucide-react";
import toast from "react-hot-toast";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { toggleId } from "@/components/filters/filter-params";
import { campusesService, type Campus } from "@/lib/campuses.service";
import {
    REFUND_METHOD_LABELS,
    familyCreditService,
    type FamilyCreditDetail,
    type FamilyCreditEntry,
    type FamilyCreditList,
    type FamilyCreditListQuery,
    type FamilySearchHit,
    type RefundMethod,
} from "@/lib/family-credit.service";
import { useFamilyCreditAccess } from "@/hooks/use-family-credit-access";

type SortBy = NonNullable<FamilyCreditListQuery["sort_by"]>;
type SortDir = NonNullable<FamilyCreditListQuery["sort_dir"]>;
type ActionKind = "add" | "deduct" | "refund" | "transfer";

const PAGE_SIZE = 50;

const rs = (v: number) => `Rs. ${Math.abs(v).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
const signedRs = (v: number) => `${v >= 0 ? "+" : "−"}${rs(v)}`;
const when = (iso: string | null) =>
    iso
        ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
        : "—";

const errMsg = (err: unknown, fallback: string) => {
    const m = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
    return Array.isArray(m) ? m.join(", ") : typeof m === "string" ? m : fallback;
};

const parseIds = (v: string | null) =>
    (v ?? "")
        .split(",")
        .map((x) => Number(x))
        .filter((x) => Number.isInteger(x) && x > 0);

function useDebounced<T>(value: T, ms = 300) {
    const [v, setV] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setV(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return v;
}

/**
 * TAFSD-504: Finance → Family Credit. Who holds credit, each family's full
 * ledger, and the manual entries (add, deduct, refund, move, undo). Receive
 * Deposit still records excess and pays from credit as part of a deposit.
 * Everything here is append-only on the server; the page computes no balance.
 */
export default function FamilyCreditPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center py-24 text-zinc-400">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </div>
            }
        >
            <FamilyCreditInner />
        </Suspense>
    );
}

function FamilyCreditInner() {
    const access = useFamilyCreditAccess();
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();

    // Filters live in the URL so a filtered view can be shared and reloaded.
    const [search, setSearch] = useState(params.get("q") ?? "");
    const [campusIds, setCampusIds] = useState<number[]>(parseIds(params.get("campus")));
    const [includeZero, setIncludeZero] = useState(params.get("zero") === "1");
    const [sortBy, setSortBy] = useState<SortBy>((params.get("sort") as SortBy) || "balance");
    const [sortDir, setSortDir] = useState<SortDir>((params.get("dir") as SortDir) || "desc");
    const [page, setPage] = useState(Number(params.get("page")) || 1);
    const [openFamilyId, setOpenFamilyId] = useState<number | null>(Number(params.get("family")) || null);
    const q = useDebounced(search);

    const [campuses, setCampuses] = useState<Campus[]>([]);
    const [list, setList] = useState<FamilyCreditList | null>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const reqId = useRef(0);

    useEffect(() => {
        campusesService.list().then(setCampuses).catch(() => setCampuses([]));
    }, []);

    useEffect(() => {
        const next = new URLSearchParams();
        if (q.trim()) next.set("q", q.trim());
        if (campusIds.length) next.set("campus", campusIds.join(","));
        if (includeZero) next.set("zero", "1");
        if (sortBy !== "balance") next.set("sort", sortBy);
        if (sortDir !== "desc") next.set("dir", sortDir);
        if (page > 1) next.set("page", String(page));
        if (openFamilyId) next.set("family", String(openFamilyId));
        const qs = next.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, [q, campusIds, includeZero, sortBy, sortDir, page, openFamilyId, pathname, router]);

    const query: FamilyCreditListQuery = useMemo(
        () => ({ q, campus_ids: campusIds, include_zero: includeZero, sort_by: sortBy, sort_dir: sortDir, page, limit: PAGE_SIZE }),
        [q, campusIds, includeZero, sortBy, sortDir, page],
    );

    const load = useCallback(async () => {
        const id = ++reqId.current;
        setLoading(true);
        try {
            const data = await familyCreditService.list(query);
            if (id === reqId.current) setList(data);
        } catch (err) {
            if (id === reqId.current) toast.error(errMsg(err, "Couldn't load family credit"));
        } finally {
            if (id === reqId.current) setLoading(false);
        }
    }, [query]);

    useEffect(() => {
        void load();
    }, [load]);

    // A new search or filter starts from the first page.
    const firstRender = useRef(true);
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        setPage(1);
    }, [q, campusIds, includeZero, sortBy, sortDir]);

    const filtersActive = !!search.trim() || campusIds.length > 0 || includeZero;
    const clearFilters = () => {
        setSearch("");
        setCampusIds([]);
        setIncludeZero(false);
    };

    const toggleSort = (col: SortBy) => {
        if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else {
            setSortBy(col);
            setSortDir(col === "family" ? "asc" : "desc");
        }
    };

    const doExport = async () => {
        setExporting(true);
        try {
            const blob = await familyCreditService.exportExcel(query);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `family-credit-${new Date().toISOString().slice(0, 10)}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(errMsg(err, "Export failed"));
        } finally {
            setExporting(false);
        }
    };

    const campusOptions = campuses.map((c) => ({ id: c.id, label: c.campus_name }));
    const typing = search.trim() !== q.trim();

    return (
        <div className="space-y-6 pb-12">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Wallet className="h-6 w-6 text-emerald-500" /> Family Credit
                    </h1>
                    <p className="text-sm text-zinc-500 mt-1 max-w-2xl">
                        Money families have paid beyond their vouchers, held on the family so any sibling can use it.
                        Excess payments and paying from credit still happen on Receive Deposit.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setPickerOpen(true)}
                        className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                        <Search className="h-4 w-4" /> Open any family
                    </button>
                    {access.can("export") && (
                        <button
                            type="button"
                            onClick={doExport}
                            disabled={exporting}
                            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Stat label="Credit held" value={list ? rs(list.totals.total_balance) : "—"} accent />
                <Stat label="Families holding credit" value={list ? list.totals.families_holding_credit.toLocaleString() : "—"} />
                <Stat label="Families listed" value={list ? list.totals.families.toLocaleString() : "—"} hint={filtersActive ? "with these filters" : undefined} />
            </div>

            <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
                <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] ml-1">Search</label>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Family number or name, legacy id, student C.C., G.R. or name"
                            className="w-full h-11 pl-11 pr-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                </div>
                <div className="w-full lg:w-64">
                    <FilterDropdown
                        label="Campus"
                        icon={Building2}
                        value={campusIds}
                        options={campusOptions}
                        placeholder="All campuses"
                        onToggle={(id) => setCampusIds((prev) => toggleId(prev, id))}
                        onClear={() => setCampusIds([])}
                        onSetValue={setCampusIds}
                    />
                </div>
                <label className="flex items-center gap-2 h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
                    <input type="checkbox" checked={includeZero} onChange={(e) => setIncludeZero(e.target.checked)} />
                    Include families back to zero
                </label>
                {filtersActive && (
                    <button type="button" onClick={clearFilters} className="h-11 px-3 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-1">
                        <RotateCcw className="h-4 w-4" /> Clear filters
                    </button>
                )}
            </div>

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                                <SortTh label="Family" col="family" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                                <th className="py-3 px-4 font-medium">Students</th>
                                <th className="py-3 px-4 font-medium">Campus</th>
                                <SortTh label="Balance" col="balance" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} right />
                                <SortTh label="Last movement" col="last_movement" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                            </tr>
                        </thead>
                        <tbody>
                            {loading && !list ? (
                                <tr>
                                    <td colSpan={5} className="py-16 text-center text-zinc-400">
                                        <Loader2 className="h-5 w-5 animate-spin inline" />
                                    </td>
                                </tr>
                            ) : !list || list.items.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-16 text-center text-zinc-400 text-sm">
                                        {typing || loading
                                            ? "Searching…"
                                            : filtersActive
                                              ? "No family matches these filters."
                                              : "No family is holding credit right now."}
                                    </td>
                                </tr>
                            ) : (
                                list.items.map((r) => (
                                    <tr
                                        key={r.family_id}
                                        onClick={() => setOpenFamilyId(r.family_id)}
                                        className={`border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/60 ${loading ? "opacity-60" : ""}`}
                                    >
                                        <td className="py-3 px-4">
                                            <div className="font-semibold text-zinc-900 dark:text-zinc-100">{r.household_name}</div>
                                            <div className="text-xs text-zinc-500">
                                                Family #{r.family_id}
                                                {r.legacy_pid ? ` · ${r.legacy_pid}` : ""}
                                                {r.family_deleted ? " · removed" : ""}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                                            {r.students.length === 0 ? (
                                                <span className="italic text-zinc-400">No current students</span>
                                            ) : (
                                                <div className="flex flex-wrap gap-1">
                                                    {r.students.map((s) => (
                                                        <span key={s.cc} className="text-xs rounded-md bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5">
                                                            {s.full_name} <span className="text-zinc-400">({s.cc}{s.class_name ? ` · ${s.class_name}` : ""})</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-zinc-500 text-xs">
                                            {[...new Set(r.students.map((s) => s.campus_name).filter(Boolean))].join(", ") || "—"}
                                        </td>
                                        <td className={`py-3 px-4 text-right font-bold tabular-nums ${r.balance > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"}`}>
                                            {rs(r.balance)}
                                        </td>
                                        <td className="py-3 px-4 text-zinc-500 whitespace-nowrap text-xs">{when(r.last_movement_at)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {list && list.meta.total_pages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 text-sm text-zinc-500">
                        <span>
                            Page {list.meta.page} of {list.meta.total_pages} · {list.meta.total} families
                        </span>
                        <div className="flex gap-2">
                            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 disabled:opacity-40">
                                Previous
                            </button>
                            <button type="button" disabled={page >= list.meta.total_pages} onClick={() => setPage((p) => p + 1)} className="px-3 h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 disabled:opacity-40">
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {pickerOpen && (
                <FamilyPicker
                    title="Open a family"
                    hint="Any family you can see, holding credit or not. Use this to add credit to a family that has none yet."
                    onClose={() => setPickerOpen(false)}
                    onPick={(hit) => {
                        setPickerOpen(false);
                        setOpenFamilyId(hit.family_id);
                    }}
                />
            )}

            {openFamilyId && (
                <FamilyDrawer
                    familyId={openFamilyId}
                    onClose={() => setOpenFamilyId(null)}
                    onChanged={() => void load()}
                    onOpenFamily={(id) => setOpenFamilyId(id)}
                />
            )}
        </div>
    );
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
    return (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
            <p className="text-xs font-medium text-zinc-500">{label}</p>
            <p className={`text-2xl font-black mt-1 tabular-nums ${accent ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-900 dark:text-zinc-100"}`}>{value}</p>
            {hint && <p className="text-xs text-zinc-400 mt-0.5">{hint}</p>}
        </div>
    );
}

function SortTh({
    label,
    col,
    sortBy,
    sortDir,
    onSort,
    right,
}: {
    label: string;
    col: SortBy;
    sortBy: SortBy;
    sortDir: SortDir;
    onSort: (c: SortBy) => void;
    right?: boolean;
}) {
    const active = sortBy === col;
    return (
        <th className={`py-3 px-4 font-medium ${right ? "text-right" : ""}`}>
            <button type="button" onClick={() => onSort(col)} className={`inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100 ${active ? "text-zinc-900 dark:text-zinc-100" : ""}`}>
                {label}
                {active && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
            </button>
        </th>
    );
}

/** Server-side family search (number, name, legacy id, student C.C./G.R./name). */
function FamilyPicker({
    title,
    hint,
    excludeFamilyId,
    onPick,
    onClose,
}: {
    title: string;
    hint?: string;
    excludeFamilyId?: number;
    onPick: (hit: FamilySearchHit) => void;
    onClose: () => void;
}) {
    const [text, setText] = useState("");
    const q = useDebounced(text);
    // The hits remember which text they answer, so "still searching" is derived
    // rather than set from inside the effect.
    const [result, setResult] = useState<{ q: string; hits: FamilySearchHit[] }>({ q: "", hits: [] });

    useEffect(() => {
        let cancelled = false;
        if (!q.trim()) return;
        familyCreditService
            .searchSimple(q)
            .then((r) => !cancelled && setResult({ q, hits: r.filter((h) => h.family_id !== excludeFamilyId) }))
            .catch((err) => {
                if (cancelled) return;
                toast.error(errMsg(err, "Search failed"));
                setResult({ q, hits: [] });
            });
        return () => {
            cancelled = true;
        };
    }, [q, excludeFamilyId]);

    const busy = !!q.trim() && result.q !== q;
    const hits = result.q === q ? result.hits : [];
    const typing = text.trim() !== q.trim();

    return (
        <Modal title={title} onClose={onClose}>
            {hint && <p className="text-sm text-zinc-500 mb-3">{hint}</p>}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input
                    autoFocus
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Family number or name, student C.C., G.R. or name"
                    className="w-full h-11 pl-10 pr-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
            </div>
            <div className="mt-3 max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                {!text.trim() ? (
                    <p className="text-sm text-zinc-400 py-6 text-center">Start typing to search.</p>
                ) : typing || busy ? (
                    <p className="text-sm text-zinc-400 py-6 text-center">Searching…</p>
                ) : hits.length === 0 ? (
                    <p className="text-sm text-zinc-400 py-6 text-center">No family found.</p>
                ) : (
                    hits.map((h) => (
                        <button key={h.family_id} type="button" onClick={() => onPick(h)} className="w-full text-left py-2.5 px-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-lg">
                            <div className="flex items-center justify-between gap-3">
                                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                                    {h.household_name} <span className="text-xs font-normal text-zinc-500">#{h.family_id}{h.legacy_pid ? ` · ${h.legacy_pid}` : ""}</span>
                                </span>
                                <span className="text-xs tabular-nums text-zinc-500">{rs(h.balance)}</span>
                            </div>
                            <div className="text-xs text-zinc-500 mt-0.5">
                                {h.students.map((s) => `${s.full_name} (${s.cc}${s.class_name ? ` · ${s.class_name}` : ""})`).join(", ")}
                            </div>
                        </button>
                    ))
                )}
            </div>
        </Modal>
    );
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
            <div
                className={`w-full ${wide ? "max-w-2xl" : "max-w-lg"} rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-xl p-5`}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
                    <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900">
                        <X className="h-5 w-5 text-zinc-500" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

const ACTION_COPY: Record<ActionKind, { title: string; verb: string; help: string }> = {
    add: {
        title: "Add credit",
        verb: "Add",
        help: "Creates credit with no deposit behind it, for example an opening balance or a correction. It is not cash and won't appear in the Deposits report.",
    },
    deduct: {
        title: "Deduct credit",
        verb: "Deduct",
        help: "Takes credit away, for example one recorded by mistake. The balance can't go below zero.",
    },
    refund: {
        title: "Refund credit to the family",
        verb: "Refund",
        help: "Records credit paid back to the family. Pay the money out first, then record it here. The balance can't go below zero.",
    },
    transfer: {
        title: "Move credit to another family",
        verb: "Move",
        help: "Takes credit from this family and gives it to another, for example siblings registered under two family numbers.",
    },
};

function FamilyDrawer({
    familyId,
    onClose,
    onChanged,
    onOpenFamily,
}: {
    familyId: number;
    onClose: () => void;
    onChanged: () => void;
    onOpenFamily: (id: number) => void;
}) {
    const access = useFamilyCreditAccess();
    const [detail, setDetail] = useState<FamilyCreditDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [action, setAction] = useState<ActionKind | null>(null);
    const [undoing, setUndoing] = useState<FamilyCreditEntry | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setDetail(null);
        familyCreditService
            .detail(familyId)
            .then((d) => !cancelled && setDetail(d))
            .catch((err) => {
                if (cancelled) return;
                toast.error(errMsg(err, "Couldn't open this family"));
                onClose();
            })
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [familyId]);

    const applied = (d: FamilyCreditDetail) => {
        setDetail(d);
        setAction(null);
        setUndoing(null);
        onChanged();
    };

    const canTakeOut = (detail?.balance ?? 0) > 0;

    return (
        <div className="fixed inset-0 z-[60] flex justify-end bg-black/30" onMouseDown={onClose}>
            <div className="h-full w-full max-w-3xl bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-y-auto" onMouseDown={(e) => e.stopPropagation()}>
                <div className="sticky top-0 z-10 bg-white/95 dark:bg-zinc-950/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">{detail?.household_name ?? "Family"}</h2>
                            <p className="text-xs text-zinc-500 mt-0.5">
                                Family #{familyId}
                                {detail?.legacy_pid ? ` · ${detail.legacy_pid}` : ""}
                                {detail?.family_deleted ? " · family record removed" : ""}
                            </p>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="text-right">
                                <p className="text-xs text-zinc-500">Balance</p>
                                <p className={`text-2xl font-black tabular-nums ${(detail?.balance ?? 0) > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-900 dark:text-zinc-100"}`}>
                                    {detail ? rs(detail.balance) : "—"}
                                </p>
                            </div>
                            <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900">
                                <X className="h-5 w-5 text-zinc-500" />
                            </button>
                        </div>
                    </div>
                    {detail && (
                        <div className="flex flex-wrap gap-2 mt-4">
                            {access.can("add") && !detail.family_deleted && (
                                <ActionButton icon={Plus} label="Add credit" onClick={() => setAction("add")} tone="emerald" />
                            )}
                            {access.can("deduct") && (
                                <ActionButton icon={Minus} label="Deduct" onClick={() => setAction("deduct")} disabled={!canTakeOut} />
                            )}
                            {access.can("refund") && (
                                <ActionButton icon={Wallet} label="Refund to family" onClick={() => setAction("refund")} disabled={!canTakeOut} />
                            )}
                            {access.can("transfer") && (
                                <ActionButton icon={ArrowLeftRight} label="Move to another family" onClick={() => setAction("transfer")} disabled={!canTakeOut} />
                            )}
                        </div>
                    )}
                </div>

                {loading || !detail ? (
                    <div className="py-24 text-center text-zinc-400">
                        <Loader2 className="h-6 w-6 animate-spin inline" />
                    </div>
                ) : (
                    <div className="p-5 space-y-6">
                        <section>
                            <h3 className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400 mb-2">Students</h3>
                            {detail.students.length === 0 ? (
                                <p className="text-sm text-zinc-400 italic">No current students in this family.</p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {detail.students.map((s) => (
                                        <span key={s.cc} className="text-xs rounded-lg bg-zinc-100 dark:bg-zinc-900 px-2 py-1 text-zinc-700 dark:text-zinc-300">
                                            {s.full_name} · C.C. {s.cc}
                                            {s.gr_number ? ` · G.R. ${s.gr_number}` : ""}
                                            {s.class_name ? ` · ${s.class_name}${s.section_name ? `-${s.section_name}` : ""}` : ""}
                                            {s.campus_name ? ` · ${s.campus_name}` : ""}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </section>

                        <section>
                            <h3 className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400 mb-2">History</h3>
                            {detail.entries.length === 0 ? (
                                <p className="text-sm text-zinc-400 italic">No credit has ever been recorded for this family.</p>
                            ) : (
                                <div className="space-y-2">
                                    {detail.entries.map((e) => (
                                        <LedgerRow key={e.id} entry={e} canUndo={access.can("undo") && e.can_undo} onUndo={() => setUndoing(e)} onOpenFamily={onOpenFamily} />
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </div>

            {action && detail && <ActionForm kind={action} detail={detail} onClose={() => setAction(null)} onDone={applied} />}
            {undoing && detail && <UndoForm entry={undoing} onClose={() => setUndoing(null)} onDone={applied} />}
        </div>
    );
}

function ActionButton({
    icon: Icon,
    label,
    onClick,
    disabled,
    tone,
}: {
    icon: React.ElementType;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    tone?: "emerald";
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={disabled ? "This family has no credit to take out" : undefined}
            className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed ${
                tone === "emerald"
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
            }`}
        >
            <Icon className="h-4 w-4" /> {label}
        </button>
    );
}

function LedgerRow({
    entry: e,
    canUndo,
    onUndo,
    onOpenFamily,
}: {
    entry: FamilyCreditEntry;
    canUndo: boolean;
    onUndo: () => void;
    onOpenFamily: (id: number) => void;
}) {
    const refs: string[] = [];
    if (e.student_name) refs.push(e.student_name);
    if (e.voucher_id) refs.push(`Voucher #${e.voucher_id}`);
    if (e.deposit_id) refs.push(`Deposit #${e.deposit_id}`);
    if (e.method) refs.push(REFUND_METHOD_LABELS[e.method as RefundMethod] ?? e.method);
    if (e.reverses_entry_id) refs.push(`Undoes entry #${e.reverses_entry_id}`);
    const undone = e.undone_by_entry_id != null;

    return (
        <div className={`rounded-xl border p-3 ${undone ? "border-zinc-200/60 dark:border-zinc-800/60 opacity-60" : "border-zinc-200 dark:border-zinc-800"}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{e.kind_label}</span>
                        {e.counterpart_family_id != null && (
                            <button type="button" onClick={() => onOpenFamily(e.counterpart_family_id!)} className="text-xs text-primary hover:underline">
                                {e.amount < 0 && e.kind !== "ENTRY_REVERSED" ? "to" : "with"} {e.counterpart_family_name ?? "family"} #{e.counterpart_family_id}
                            </button>
                        )}
                        {undone && <span className="text-[10px] font-bold uppercase rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-zinc-500">Undone by #{e.undone_by_entry_id}</span>}
                    </div>
                    {e.notes && <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5 break-words">{e.notes}</p>}
                    <p className="text-xs text-zinc-400 mt-1">
                        #{e.id} · {when(e.created_at)} · {e.created_by ?? "system"}
                        {refs.length ? ` · ${refs.join(" · ")}` : ""}
                    </p>
                </div>
                <div className="text-right shrink-0">
                    <p className={`font-bold tabular-nums ${e.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-300"}`}>{signedRs(e.amount)}</p>
                    {canUndo && (
                        <button type="button" onClick={onUndo} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-rose-600">
                            <Undo2 className="h-3 w-3" /> Undo
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function ActionForm({
    kind,
    detail,
    onClose,
    onDone,
}: {
    kind: ActionKind;
    detail: FamilyCreditDetail;
    onClose: () => void;
    onDone: (d: FamilyCreditDetail) => void;
}) {
    const copy = ACTION_COPY[kind];
    const [amount, setAmount] = useState("");
    const [reason, setReason] = useState("");
    const [method, setMethod] = useState<RefundMethod>("cash");
    const [target, setTarget] = useState<FamilySearchHit | null>(null);
    const [picking, setPicking] = useState(false);
    const [saving, setSaving] = useState(false);

    const value = Number(amount);
    const valid = Number.isFinite(value) && value > 0 && /^\d+(\.\d{1,2})?$/.test(amount.trim());
    const takesOut = kind !== "add";
    const after = valid ? detail.balance + (takesOut ? -value : value) : null;
    const tooMuch = takesOut && valid && value > detail.balance;
    const ready = valid && !tooMuch && reason.trim().length >= 3 && (kind !== "transfer" || target != null);

    const submit = async (ev: React.FormEvent) => {
        ev.preventDefault();
        if (!ready) return;
        setSaving(true);
        try {
            const r = reason.trim();
            const d =
                kind === "add"
                    ? await familyCreditService.add(detail.family_id, value, r)
                    : kind === "deduct"
                      ? await familyCreditService.deduct(detail.family_id, value, r)
                      : kind === "refund"
                        ? await familyCreditService.refund(detail.family_id, value, method, r)
                        : await familyCreditService.transfer(detail.family_id, target!.family_id, value, r);
            toast.success(
                kind === "transfer" ? `${rs(value)} moved to ${target!.household_name}` : `${copy.verb}ed ${rs(value)}`,
            );
            onDone(d);
        } catch (err) {
            toast.error(errMsg(err, `Couldn't ${copy.verb.toLowerCase()} credit`));
        } finally {
            setSaving(false);
        }
    };

    if (picking) {
        return (
            <FamilyPicker
                title="Move credit to which family?"
                excludeFamilyId={detail.family_id}
                onClose={() => setPicking(false)}
                onPick={(h) => {
                    setTarget(h);
                    setPicking(false);
                }}
            />
        );
    }

    return (
        <Modal title={copy.title} onClose={onClose}>
            <form onSubmit={submit} className="space-y-4">
                <p className="text-sm text-zinc-500">{copy.help}</p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    {detail.household_name} holds <span className="font-bold tabular-nums">{rs(detail.balance)}</span>.
                </p>

                {kind === "transfer" && (
                    <div>
                        <label className="text-xs font-semibold text-zinc-500">To family</label>
                        <button
                            type="button"
                            onClick={() => setPicking(true)}
                            className="mt-1 w-full h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
                        >
                            {target ? (
                                <span>
                                    <span className="font-semibold">{target.household_name}</span> <span className="text-zinc-500">#{target.family_id} · holds {rs(target.balance)}</span>
                                </span>
                            ) : (
                                <span className="text-zinc-400">Search a family…</span>
                            )}
                        </button>
                    </div>
                )}

                <div>
                    <label className="text-xs font-semibold text-zinc-500">Amount (Rs.)</label>
                    <input
                        autoFocus={kind !== "transfer"}
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                        className="mt-1 w-full h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm tabular-nums outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="0"
                    />
                    {takesOut && detail.balance > 0 && (
                        <button type="button" onClick={() => setAmount(String(detail.balance))} className="mt-1 text-xs text-primary hover:underline">
                            Use the whole balance ({rs(detail.balance)})
                        </button>
                    )}
                    {tooMuch && <p className="mt-1 text-xs text-rose-600">That is more than the family holds. The balance can&apos;t go below zero.</p>}
                </div>

                {kind === "refund" && (
                    <div>
                        <label className="text-xs font-semibold text-zinc-500">Paid back by</label>
                        <div className="mt-1 flex gap-2">
                            {(Object.keys(REFUND_METHOD_LABELS) as RefundMethod[]).map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => setMethod(m)}
                                    className={`h-9 px-3 rounded-lg text-sm border ${method === m ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900" : "border-zinc-200 dark:border-zinc-800"}`}
                                >
                                    {REFUND_METHOD_LABELS[m]}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div>
                    <label className="text-xs font-semibold text-zinc-500">Reason (required)</label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        maxLength={500}
                        rows={3}
                        className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Why this entry is being made. Shown in the history."
                    />
                </div>

                {after != null && !tooMuch && (
                    <p className="text-sm text-zinc-500">
                        Balance after: <span className="font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{rs(after)}</span>
                    </p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl text-sm font-semibold border border-zinc-200 dark:border-zinc-800">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!ready || saving}
                        className="h-10 px-4 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        {copy.verb} {valid ? rs(value) : ""}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

function UndoForm({ entry, onClose, onDone }: { entry: FamilyCreditEntry; onClose: () => void; onDone: (d: FamilyCreditDetail) => void }) {
    const [reason, setReason] = useState("");
    const [saving, setSaving] = useState(false);
    const isTransfer = entry.kind === "TRANSFER_OUT" || entry.kind === "TRANSFER_IN";

    const submit = async (ev: React.FormEvent) => {
        ev.preventDefault();
        if (reason.trim().length < 3) return;
        setSaving(true);
        try {
            const d = await familyCreditService.undo(entry.id, reason.trim());
            toast.success("Entry undone");
            onDone(d);
        } catch (err) {
            toast.error(errMsg(err, "Couldn't undo this entry"));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal title="Undo this entry" onClose={onClose}>
            <form onSubmit={submit} className="space-y-4">
                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 p-3 text-sm">
                    <span className="font-semibold">{entry.kind_label}</span> · {signedRs(entry.amount)} · #{entry.id}
                    {entry.notes && <p className="text-zinc-500 mt-0.5">{entry.notes}</p>}
                </div>
                <p className="text-sm text-zinc-500">
                    Nothing is deleted. An opposite entry of {signedRs(-entry.amount)} is added
                    {isTransfer ? ", and the other family's half of the transfer is undone with it" : ""}. Refused if the
                    credit has already been used.
                </p>
                <div>
                    <label className="text-xs font-semibold text-zinc-500">Reason (required)</label>
                    <textarea
                        autoFocus
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        maxLength={500}
                        rows={3}
                        className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    />
                </div>
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl text-sm font-semibold border border-zinc-200 dark:border-zinc-800">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={reason.trim().length < 3 || saving}
                        className="h-10 px-4 rounded-xl text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />} Undo entry
                    </button>
                </div>
            </form>
        </Modal>
    );
}
