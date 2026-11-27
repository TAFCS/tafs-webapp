"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Copy, GraduationCap, Loader2, Lock, RotateCcw, Save, Search, Tags, Undo2 } from "lucide-react";
import toast from "react-hot-toast";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { toggleId } from "@/components/filters/filter-params";
import { campusesService, type Campus, type CampusClassInfo } from "@/lib/campuses.service";
import { ecFeesService } from "@/lib/ec-fees.service";
import { ecErrMsg, type EcClassScheduleRow, type EcFeeHeadOption, type EcFeeHeadSearchHit } from "@/lib/ec-fees.types";
import { getAcademicYears, getCurrentAcademicYear } from "@/lib/fee-utils";
import { EC_TILES, useExtracurricularAccess } from "@/hooks/use-extracurricular-access";
import { useUserScope } from "@/hooks/use-tile-access";
import { parseIds, useDebounced, useUrlSync } from "@/features/extracurricular/url-state";
import { EcField, EcModal, EcPageFallback, EcPageHeader, ecInputClass, ecPrimaryButton, ecSecondaryButton } from "@/features/extracurricular/ui";

const ALL = "all";
const cell = (classId: number, headId: number) => `${classId}|${headId}`;

/**
 * TAFSD-605: Extracurricular Fees → Class Amounts, the EC twin of the Class Fee
 * Schedule. One academic year at a time (the year is what you are editing, not
 * a filter). "All campuses" amounts apply everywhere; a campus tab sets that
 * campus's own amount, which beats the all-campus one for its students.
 */
export default function EcClassSchedulePage() {
    return (
        <Suspense fallback={<EcPageFallback />}>
            <EcClassScheduleInner />
        </Suspense>
    );
}

function EcClassScheduleInner() {
    const access = useExtracurricularAccess(EC_TILES.classSchedule);
    const userScope = useUserScope();
    const params = useSearchParams();
    const years = useMemo(() => getAcademicYears(2, 2), []);

    const campusRestricted = userScope.isRestricted("campuses");
    const [year, setYear] = useState(() => {
        const y = params.get("year");
        return y && /^\d{4}-\d{4}$/.test(y) ? y : getCurrentAcademicYear();
    });
    const [tab, setTab] = useState<string>(params.get("campus") || ALL);
    const [classIds, setClassIds] = useState<number[]>(parseIds(params.get("classes")));
    const [headIds, setHeadIds] = useState<number[]>(parseIds(params.get("heads")));
    const [headSearch, setHeadSearch] = useState(params.get("q") ?? "");
    const hq = useDebounced(headSearch);
    useUrlSync({ year, campus: tab === ALL ? undefined : tab, classes: classIds, heads: headIds, q: hq.trim() });

    const [campuses, setCampuses] = useState<Campus[]>([]);
    const [classes, setClasses] = useState<CampusClassInfo[]>([]);
    const [heads, setHeads] = useState<EcFeeHeadOption[]>([]);
    const [hits, setHits] = useState<EcFeeHeadSearchHit[] | null>(null);
    const [rows, setRows] = useState<EcClassScheduleRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [edits, setEdits] = useState<Map<string, string>>(new Map());
    const [saving, setSaving] = useState(false);
    const [copyOpen, setCopyOpen] = useState(false);
    const reqId = useRef(0);

    useEffect(() => {
        campusesService.list().then(setCampuses).catch(() => setCampuses([]));
        campusesService.listAllClasses().then(setClasses).catch(() => setClasses([]));
        ecFeesService.feeHeadOptions().then(setHeads).catch((err) => toast.error(ecErrMsg(err, "Couldn't load the heads")));
    }, []);

    // Server-side head search (Rule 2) narrows the head columns.
    useEffect(() => {
        let cancelled = false;
        if (!hq.trim()) {
            setHits(null);
            return;
        }
        ecFeesService
            .searchFeeHeads(hq)
            .then((h) => !cancelled && setHits(h))
            .catch(() => !cancelled && setHits([]));
        return () => {
            cancelled = true;
        };
    }, [hq]);

    const visibleCampuses = useMemo(() => userScope.filterOptions("campuses", campuses, (c) => c.id), [userScope, campuses]);

    // A campus-scoped user starts on their own campus: they can't edit all-campus amounts.
    useEffect(() => {
        if (campusRestricted && tab === ALL && visibleCampuses.length > 0) setTab(String(visibleCampuses[0].id));
    }, [campusRestricted, tab, visibleCampuses]);

    const tabCampusId = tab === ALL ? null : Number(tab);

    const load = useCallback(async () => {
        const id = ++reqId.current;
        setLoading(true);
        try {
            const data = await ecFeesService.listClassSchedule({ academic_year: year, campus_ids: tabCampusId ? [tabCampusId] : [] });
            if (id === reqId.current) setRows(data);
        } catch (err) {
            if (id === reqId.current) toast.error(ecErrMsg(err, "Couldn't load the class amounts"));
        } finally {
            if (id === reqId.current) setLoading(false);
        }
    }, [year, tabCampusId]);

    useEffect(() => {
        void load();
    }, [load]);

    const own = useMemo(() => {
        const m = new Map<string, EcClassScheduleRow>();
        for (const r of rows) if (r.campus_id === tabCampusId) m.set(cell(r.class_id, r.fee_head_id), r);
        return m;
    }, [rows, tabCampusId]);
    const inherited = useMemo(() => {
        const m = new Map<string, EcClassScheduleRow>();
        if (tabCampusId != null) for (const r of rows) if (r.campus_id == null) m.set(cell(r.class_id, r.fee_head_id), r);
        return m;
    }, [rows, tabCampusId]);

    const shownClasses = useMemo(
        () => (classIds.length ? classes.filter((c) => classIds.includes(c.id)) : classes),
        [classes, classIds],
    );
    const shownHeads = useMemo(() => {
        let list = heads;
        if (headIds.length) list = list.filter((h) => headIds.includes(h.id));
        if (hits) {
            const ids = new Set(hits.map((h) => h.id));
            list = list.filter((h) => ids.has(h.id));
        }
        return list;
    }, [heads, headIds, hits]);

    const readOnly = !access.can("edit") || (tabCampusId == null && campusRestricted);
    const dirty = useMemo(() => {
        const out: { classId: number; headId: number; value: string }[] = [];
        for (const [key, value] of edits) {
            const [classId, headId] = key.split("|").map(Number);
            const current = own.get(key);
            const was = current ? String(current.amount) : "";
            if (value.trim() !== was) out.push({ classId, headId, value: value.trim() });
        }
        return out;
    }, [edits, own]);

    const guardSwitch = (fn: () => void) => {
        if (dirty.length) {
            toast.error("Save or discard your changes first");
            return;
        }
        setEdits(new Map());
        fn();
    };

    const save = async () => {
        const bad = dirty.find((d) => d.value !== "" && (!/^\d+$/.test(d.value) || Number(d.value) < 1));
        if (bad) {
            toast.error("Amounts are whole rupees, 1 or more. Leave a cell empty to clear it.");
            return;
        }
        setSaving(true);
        try {
            const res = await ecFeesService.saveClassSchedule(
                year,
                dirty.map((d) => ({ class_id: d.classId, fee_head_id: d.headId, campus_id: tabCampusId, amount: d.value === "" ? null : Number(d.value) })),
            );
            toast.success(`Saved: ${res.saved} set, ${res.cleared} cleared`);
            setEdits(new Map());
            await load();
        } catch (err) {
            toast.error(ecErrMsg(err, "Couldn't save the class amounts"));
        } finally {
            setSaving(false);
        }
    };

    const filtersActive = classIds.length > 0 || headIds.length > 0 || !!headSearch.trim();
    const clearFilters = () => {
        setClassIds([]);
        setHeadIds([]);
        setHeadSearch("");
    };

    const tabName = tabCampusId == null ? "All campuses" : campuses.find((c) => c.id === tabCampusId)?.campus_name ?? "Campus";

    return (
        <div className="space-y-6 pb-28">
            <EcPageHeader
                icon={CalendarDays}
                title="Class Amounts"
                description="What each extracurricular head costs per class. An “All campuses” amount applies everywhere; a campus tab sets that campus's own amount. Students are charged from these on Student Charges."
                actions={
                    access.can("copy_year") && (
                        <button type="button" className={ecSecondaryButton} onClick={() => guardSwitch(() => setCopyOpen(true))}>
                            <Copy className="h-4 w-4" /> Copy from another year
                        </button>
                    )
                }
            />

            <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
                <div className="w-full lg:w-48">
                    <EcField label="Academic year (editing)" htmlFor="ec-year">
                        <select id="ec-year" value={year} onChange={(e) => guardSwitch(() => setYear(e.target.value))} className={ecInputClass}>
                            {years.map((y) => (
                                <option key={y} value={y}>
                                    {y}
                                </option>
                            ))}
                        </select>
                    </EcField>
                </div>
                <div className="flex-1">
                    <EcField label="Find a head" htmlFor="ec-head-q">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                            <input id="ec-head-q" value={headSearch} onChange={(e) => setHeadSearch(e.target.value)} placeholder="Part of a head name" className={`${ecInputClass} pl-11`} />
                        </div>
                    </EcField>
                </div>
                <div className="w-full lg:w-56">
                    <FilterDropdown
                        label="Classes"
                        icon={GraduationCap}
                        value={classIds}
                        options={classes.map((c) => ({ id: c.id, label: c.description }))}
                        placeholder="All classes"
                        onToggle={(id) => setClassIds((prev) => toggleId(prev, id))}
                        onClear={() => setClassIds([])}
                        onSetValue={setClassIds}
                    />
                </div>
                <div className="w-full lg:w-56">
                    <FilterDropdown
                        label="Heads"
                        icon={Tags}
                        value={headIds}
                        options={heads.map((h) => ({ id: h.id, label: h.name }))}
                        placeholder="All heads"
                        onToggle={(id) => setHeadIds((prev) => toggleId(prev, id))}
                        onClear={() => setHeadIds([])}
                        onSetValue={setHeadIds}
                    />
                </div>
                {filtersActive && (
                    <button type="button" onClick={clearFilters} className="h-11 px-3 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-1">
                        <RotateCcw className="h-4 w-4" /> Clear filters
                    </button>
                )}
            </div>

            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Campus">
                <TabButton active={tab === ALL} onClick={() => guardSwitch(() => setTab(ALL))} locked={campusRestricted}>
                    All campuses
                </TabButton>
                {visibleCampuses.map((c) => (
                    <TabButton key={c.id} active={tab === String(c.id)} onClick={() => guardSwitch(() => setTab(String(c.id)))}>
                        {c.campus_name}
                    </TabButton>
                ))}
            </div>

            {tabCampusId == null && campusRestricted && (
                <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" /> All-campus amounts can only be changed by someone with every campus in scope.
                </p>
            )}

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
                {heads.length === 0 && !loading ? (
                    <div className="py-16 text-center text-sm text-zinc-400">No active extracurricular heads. Add one on Fee Heads first.</div>
                ) : shownHeads.length === 0 ? (
                    <div className="py-16 text-center text-sm text-zinc-400">
                        {hq.trim() !== headSearch.trim() ? "Searching…" : "No head matches these filters."}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="text-sm min-w-full">
                            <thead>
                                <tr className="text-left text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                                    <th className="py-3 px-4 font-medium sticky left-0 bg-zinc-50 dark:bg-zinc-900 z-10 min-w-[10rem]">Class</th>
                                    {shownHeads.map((h) => (
                                        <th key={h.id} className="py-3 px-3 font-medium min-w-[9rem]">
                                            <div className="text-zinc-700 dark:text-zinc-200">{h.name}</div>
                                            <div className="text-[10px] font-normal text-zinc-400">Amount in Rs</div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className={loading ? "opacity-60" : ""}>
                                {shownClasses.map((c) => (
                                    <tr key={c.id} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
                                        <td className="py-2 px-4 font-semibold text-zinc-800 dark:text-zinc-100 sticky left-0 bg-white dark:bg-zinc-950 z-10">{c.description}</td>
                                        {shownHeads.map((h) => {
                                            const key = cell(c.id, h.id);
                                            const current = own.get(key);
                                            const parent = inherited.get(key);
                                            const value = edits.get(key) ?? (current ? String(current.amount) : "");
                                            const changed = edits.has(key) && value.trim() !== (current ? String(current.amount) : "");
                                            return (
                                                <td key={h.id} className="py-2 px-3">
                                                    <div className={`flex items-center h-9 rounded-lg border ${changed ? "border-orange-400 ring-2 ring-orange-500/20" : "border-zinc-200 dark:border-zinc-800"} bg-white dark:bg-zinc-900 ${readOnly ? "opacity-70" : ""}`}>
                                                        <span className="pl-2 pr-1 text-[11px] text-zinc-400 select-none">Rs</span>
                                                        <input
                                                            aria-label={`${h.name} amount for ${c.description}, ${tabName}, in rupees`}
                                                            inputMode="numeric"
                                                            value={value}
                                                            disabled={readOnly}
                                                            placeholder={parent ? `${parent.amount} (all)` : "—"}
                                                            onChange={(e) => {
                                                                const v = e.target.value.replace(/[^\d]/g, "");
                                                                setEdits((prev) => new Map(prev).set(key, v));
                                                            }}
                                                            className="w-full min-w-0 bg-transparent pr-2 text-sm outline-none tabular-nums placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
                                                        />
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {tabCampusId != null && (
                <p className="text-xs text-zinc-500">
                    Greyed amounts marked “(all)” come from All campuses. Type an amount to give {tabName} its own; empty a cell to go back to the all-campus amount.
                </p>
            )}

            {dirty.length > 0 && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl px-4 py-3">
                    <span className="text-sm text-zinc-600 dark:text-zinc-300">
                        {dirty.length} unsaved change{dirty.length === 1 ? "" : "s"} · {tabName} · {year}
                    </span>
                    <button type="button" className={ecSecondaryButton} onClick={() => setEdits(new Map())} disabled={saving}>
                        <Undo2 className="h-4 w-4" /> Discard
                    </button>
                    <button type="button" className={ecPrimaryButton} onClick={save} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
                    </button>
                </div>
            )}

            {copyOpen && (
                <CopyYearDialog
                    years={years}
                    targetYear={year}
                    onClose={() => setCopyOpen(false)}
                    onDone={async () => {
                        setCopyOpen(false);
                        await load();
                    }}
                />
            )}
        </div>
    );
}

function TabButton({ active, locked, onClick, children }: { active: boolean; locked?: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            role="tab"
            aria-selected={active}
            onClick={onClick}
            className={`h-9 px-3.5 rounded-xl text-sm font-semibold border inline-flex items-center gap-1.5 ${
                active
                    ? "bg-orange-600 border-orange-600 text-white"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            }`}
        >
            {locked && <Lock className="h-3.5 w-3.5" />} {children}
        </button>
    );
}

function CopyYearDialog({ years, targetYear, onClose, onDone }: { years: string[]; targetYear: string; onClose: () => void; onDone: () => void }) {
    const sources = years.filter((y) => y !== targetYear);
    const [from, setFrom] = useState(sources.includes(prevYear(targetYear)) ? prevYear(targetYear) : sources[0] ?? "");
    const [overwrite, setOverwrite] = useState(false);
    const [busy, setBusy] = useState(false);

    const run = async () => {
        setBusy(true);
        try {
            const res = await ecFeesService.copyClassScheduleYear(from, targetYear, overwrite);
            toast.success(`Copied into ${res.to}: ${res.created} added, ${res.updated} replaced, ${res.kept} kept`);
            onDone();
        } catch (err) {
            toast.error(ecErrMsg(err, "Couldn't copy the amounts"));
        } finally {
            setBusy(false);
        }
    };

    return (
        <EcModal
            open
            title={`Copy amounts into ${targetYear}`}
            subtitle="Only amounts you can edit are copied."
            onClose={onClose}
            footer={
                <>
                    <button type="button" className={ecSecondaryButton} onClick={onClose} disabled={busy}>
                        Cancel
                    </button>
                    <button type="button" className={ecPrimaryButton} onClick={run} disabled={busy || !from}>
                        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Copy into {targetYear}
                    </button>
                </>
            }
        >
            <EcField label="Copy from" htmlFor="ec-copy-from">
                <select id="ec-copy-from" value={from} onChange={(e) => setFrom(e.target.value)} className={ecInputClass}>
                    {sources.map((y) => (
                        <option key={y} value={y}>
                            {y}
                        </option>
                    ))}
                </select>
            </EcField>
            <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
                <input type="checkbox" className="mt-0.5" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
                <span>
                    Replace amounts already set in {targetYear}
                    <span className="block text-xs text-zinc-400">Off: amounts already in {targetYear} are kept and only the missing ones are added.</span>
                </span>
            </label>
            <p className="text-xs text-zinc-500">Students already charged keep their amounts. Class amounts only set what new charges start from.</p>
        </EcModal>
    );
}

function prevYear(y: string): string {
    const start = Number(y.slice(0, 4));
    return `${start - 1}-${start}`;
}
