"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Building2, Loader2, Lock, Network, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import toast from "react-hot-toast";
import { useAuthState } from "@/context/AuthContext";
import { hrService, type HierarchyEmployee, type ReportingHierarchy, type ScopeMismatchReport } from "@/lib/hr.service";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { HierarchyTree } from "./_components/HierarchyTree";
import { ManagerEditor } from "./_components/ManagerEditor";
import { MismatchReport } from "./_components/MismatchReport";
import { PersonSearch } from "./_components/PersonSearch";
import { ancestorsOf, layoutTree, managersOf } from "./_components/tree";

const toggleId = <T extends string | number>(prev: T[], id: T): T[] =>
  prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];

const parseIds = (raw: string | null): number[] =>
  (raw ?? "")
    .split(",")
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0);

function ReportingHierarchyPage() {
  const { user, isVerified } = useAuthState();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [data, setData] = useState<ReportingHierarchy | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters and the selected person live in the URL so a view can be shared.
  const [campusIds, setCampusIds] = useState<number[]>(() => parseIds(searchParams.get("campus")));
  const [departmentIds, setDepartmentIds] = useState<number[]>(() => parseIds(searchParams.get("dept")));
  const [selectedId, setSelectedId] = useState<number | null>(() => parseIds(searchParams.get("id"))[0] ?? null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [togglingEnforcement, setTogglingEnforcement] = useState(false);
  const [mismatches, setMismatches] = useState<ScopeMismatchReport | null>(null);
  const [loadingMismatches, setLoadingMismatches] = useState(false);

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const handleToggleEnforcement = async () => {
    if (!data) return;
    const nextState = !data.enforced;
    setTogglingEnforcement(true);
    try {
      await hrService.setReportingEnforcement(nextState);
      setData((prev) => (prev ? { ...prev, enforced: nextState } : null));
      toast.success(
        nextState
          ? "Reporting hierarchy enforcement is now ACTIVE on staff actions."
          : "Reporting hierarchy enforcement is now INACTIVE. Actions follow normal campus scope.",
      );
    } catch {
      toast.error("Could not update hierarchy enforcement setting.");
    } finally {
      setTogglingEnforcement(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams();
    if (campusIds.length) params.set("campus", campusIds.join(","));
    if (departmentIds.length) params.set("dept", departmentIds.join(","));
    if (selectedId != null) params.set("id", String(selectedId));
    const next = params.toString();
    if (next !== searchParams.toString()) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  }, [campusIds, departmentIds, selectedId, pathname, router, searchParams]);

  const load = useCallback(async () => {
    try {
      const [tree, rep] = await Promise.all([
        hrService.getReportingHierarchy(),
        hrService.getHierarchyMismatches().catch(() => null),
      ]);
      setData(tree);
      if (rep) setMismatches(rep);
      setLoadError(null);
    } catch {
      setLoadError("Could not load the reporting hierarchy. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshMismatches = useCallback(async () => {
    setLoadingMismatches(true);
    try {
      const rep = await hrService.getHierarchyMismatches();
      setMismatches(rep);
      toast.success("Mismatch report refreshed");
    } catch {
      toast.error("Could not refresh mismatch report.");
    } finally {
      setLoadingMismatches(false);
    }
  }, []);

  useEffect(() => {
    if (isVerified && isSuperAdmin) void load();
  }, [isVerified, isSuperAdmin, load]);

  const people = useMemo(() => new Map((data?.employees ?? []).map((e) => [e.id, e])), [data]);
  const lines = useMemo(() => data?.lines ?? [], [data]);
  const campusById = useMemo(() => new Map((data?.campuses ?? []).map((c) => [c.id, c])), [data]);
  const deptById = useMemo(() => new Map((data?.departments ?? []).map((d) => [d.id, d])), [data]);
  const campusName = useCallback((id: number | null) => (id != null ? campusById.get(id)?.campus_name ?? "" : ""), [campusById]);
  const campusCode = useCallback((id: number | null) => (id != null ? campusById.get(id)?.campus_code ?? "" : ""), [campusById]);
  const departmentName = useCallback((id: number | null) => (id != null ? deptById.get(id)?.name ?? "" : ""), [deptById]);

  const filtering = campusIds.length > 0 || departmentIds.length > 0;
  const matches = useCallback(
    (p: HierarchyEmployee) =>
      (campusIds.length === 0 || (p.campus_id != null && campusIds.includes(p.campus_id))) &&
      (departmentIds.length === 0 || (p.department_id != null && departmentIds.includes(p.department_id))),
    [campusIds, departmentIds],
  );

  const layout = useMemo(
    () => layoutTree(data?.employees ?? [], lines, expanded, collapsed),
    [data, lines, expanded, collapsed],
  );
  const placedIds = useMemo(() => new Set(layout.nodes.map((n) => n.person.id)), [layout]);
  const dimmed = useMemo(
    () => (filtering ? new Set(layout.nodes.filter((n) => !matches(n.person)).map((n) => n.person.id)) : new Set<number>()),
    [filtering, layout, matches],
  );
  const notPlaced = useMemo(
    () => (data?.employees ?? []).filter((e) => !placedIds.has(e.id) && matches(e)),
    [data, placedIds, matches],
  );

  const select = useCallback(
    (id: number) => {
      setSelectedId(id);
      // Open every manager above them so the node is on screen.
      const above = ancestorsOf(lines, id);
      setExpanded((s) => new Set([...s, ...above]));
      setCollapsed((s) => new Set([...s].filter((x) => !above.has(x))));
    },
    [lines],
  );

  useEffect(() => {
    if (selectedId == null) return;
    const el = document.getElementById(`hierarchy-node-${selectedId}`);
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [selectedId, layout]);

  const toggle = (id: number, collapse: boolean) => {
    if (collapse) {
      setCollapsed((s) => new Set(s).add(id));
      setExpanded((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    } else {
      setExpanded((s) => new Set(s).add(id));
      setCollapsed((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  };

  const selected = selectedId != null ? people.get(selectedId) ?? null : null;
  const canEdit = !!data?.migrated;

  if (!isVerified) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="max-w-lg mx-auto py-24 text-center space-y-3">
        <Lock className="h-8 w-8 mx-auto text-zinc-400" />
        <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-50">Super admins only</h1>
        <p className="text-sm text-zinc-500">Only a super admin can view or change who reports to whom.</p>
      </div>
    );
  }

  const campusOptions = (data?.campuses ?? []).map((c) => ({ id: c.id, label: c.campus_name }));
  const departmentOptions = (data?.departments ?? []).map((d) => ({ id: d.id, label: d.name }));

  return (
    <div className="pb-20 max-w-full space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-2xl text-primary">
            <Network className="h-7 w-7" />
          </div>
          Reporting Hierarchy
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium max-w-3xl">
          Set who reports to whom. Pick a person, then add the people they report to: as many as you like, at any
          level, in any department or campus. Only super admins can see this page.
        </p>
      </div>

      {data && !data.migrated && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>
            Reporting lines aren&apos;t set up on the database yet, so nothing can be saved. A developer needs to run the
            database migration first.
          </p>
        </div>
      )}

      {data && data.migrated && (
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border p-4.5 ${
            data.enforced
              ? "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-100"
              : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 text-zinc-800 dark:text-zinc-200"
          }`}
        >
          <div className="flex items-start sm:items-center gap-3">
            <div
              className={`p-2 rounded-xl shrink-0 ${
                data.enforced
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                  : "bg-zinc-200/80 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              {data.enforced ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">
                  Action Enforcement: {data.enforced ? "Active" : "Inactive (Staged Rollout)"}
                </span>
                <span
                  className={`text-[10px] uppercase tracking-wider font-black px-2 py-0.5 rounded-full ${
                    data.enforced
                      ? "bg-emerald-200/80 text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-200"
                      : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {data.enforced ? "Enforced" : "Off"}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {data.enforced
                  ? "Staff can only change attendance, leave, shifts, loans, and increments for their subordinates in this tree."
                  : "Staff actions follow normal campus and department scope so operations continue while you populate the tree."}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={togglingEnforcement}
            onClick={handleToggleEnforcement}
            className={`inline-flex items-center justify-center shrink-0 px-4 py-2 text-xs font-bold rounded-xl transition-colors disabled:opacity-50 cursor-pointer ${
              data.enforced
                ? "bg-zinc-200 hover:bg-zinc-300 text-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200"
                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            }`}
          >
            {togglingEnforcement ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : null}
            {data.enforced ? "Disable Enforcement" : "Enable Hierarchy Enforcement"}
          </button>
        </div>
      )}

      {data && data.migrated && (
        <MismatchReport
          report={mismatches}
          loading={loadingMismatches}
          onRefresh={refreshMismatches}
          onSelectPerson={select}
        />
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-80">
          <PersonSearch
            id="find-person"
            label="Find a person"
            placeholder="Name, employee code or CNIC"
            people={people}
            onPick={(p) => select(p.id)}
          />
        </div>
        <div className="w-[190px]">
          <FilterDropdown
            label="Campus"
            icon={Building2}
            value={campusIds}
            options={campusOptions}
            placeholder="All Campuses"
            onToggle={(id) => setCampusIds((prev) => toggleId(prev, id))}
            onClear={() => setCampusIds([])}
          />
        </div>
        <div className="w-[190px]">
          <FilterDropdown
            label="Department"
            icon={Users}
            value={departmentIds}
            options={departmentOptions}
            placeholder="All Departments"
            onToggle={(id) => setDepartmentIds((prev) => toggleId(prev, id))}
            onClear={() => setDepartmentIds([])}
          />
        </div>
        {filtering && (
          <button
            type="button"
            onClick={() => {
              setCampusIds([]);
              setDepartmentIds([]);
            }}
            className="h-9 px-3 text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Clear Filters
          </button>
        )}
        {data && (
          <p className="ml-auto text-xs text-zinc-500 tabular-nums">
            {placedIds.size} in the tree · {(data.employees.length - placedIds.size).toLocaleString()} not placed yet
          </p>
        )}
      </div>

      {loading ? (
        <div className="py-24 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : loadError ? (
        <p className="text-sm text-rose-600">{loadError}</p>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <aside className="xl:col-span-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-2">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Not placed yet <span className="text-zinc-300 dark:text-zinc-600">· {notPlaced.length}</span>
            </h2>
            <p className="text-[11px] text-zinc-400">Nobody above them and nobody below. Select one to place them.</p>
            {notPlaced.length === 0 ? (
              <p className="text-sm text-zinc-500 py-2">
                {filtering ? "Everyone matching these filters is in the tree." : "Everyone is in the tree."}
              </p>
            ) : (
              <ul className="max-h-[60vh] overflow-auto -mx-1 space-y-0.5">
                {notPlaced.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => select(p.id)}
                      className={`w-full text-left px-2 py-1.5 rounded-lg ${
                        p.id === selectedId ? "bg-primary/10" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                      }`}
                    >
                      <span className="block text-sm font-semibold text-zinc-800 dark:text-zinc-100 truncate">
                        {p.full_name || `#${p.id}`}
                      </span>
                      <span className="block text-[11px] text-zinc-500 truncate">
                        {[p.job_title, campusCode(p.campus_id)].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <section className="xl:col-span-6 min-w-0 space-y-2">
            {layout.nodes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 p-10 text-center space-y-2">
                <Network className="h-8 w-8 mx-auto text-zinc-300" />
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">The tree is empty</p>
                <p className="text-sm text-zinc-500 max-w-md mx-auto">
                  Start at the top. Select someone from Not placed yet, for example a directress, and add the person they
                  report to. Both appear here.
                </p>
              </div>
            ) : (
              <>
                <HierarchyTree
                  layout={layout}
                  selectedId={selectedId}
                  dimmed={dimmed}
                  campusCode={campusCode}
                  onSelect={select}
                  onToggle={toggle}
                />
                <p className="text-[11px] text-zinc-400">
                  Each person sits under the first manager listed for them; dotted lines show their other managers.
                  Groups larger than six start folded; use the number under a box to open them.
                </p>
              </>
            )}
          </section>

          <aside className="xl:col-span-3">
            {selected ? (
              <ManagerEditor
                key={`${selected.id}:${managersOf(lines, selected.id).join(",")}`}
                person={selected}
                lines={lines}
                people={people}
                campusName={campusName}
                departmentName={departmentName}
                canEdit={canEdit}
                onSelect={select}
                onSaved={load}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 p-6 text-sm text-zinc-500">
                Select a person in the tree or the list to see and change who they report to.
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="py-24 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      }
    >
      <ReportingHierarchyPage />
    </Suspense>
  );
}
