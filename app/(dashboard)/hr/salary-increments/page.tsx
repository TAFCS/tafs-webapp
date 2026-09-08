"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { BadgePercent, CalendarClock, ChevronDown, Loader2, Search, Settings2, TrendingUp, Users, Wallet, X } from "lucide-react";
import { useAuthState } from "@/context/AuthContext";
import { Department, hrService, SalaryIncrementAnalytics, SalaryIncrementDueRow, SalaryIncrementMode, SalaryIncrementPreview, SalaryIncrementSettings, Segment } from "@/lib/hr.service";
import { Campus, campusesService } from "@/lib/campuses.service";
import { MultiSelect } from "./_components/MultiSelect";

const input = "h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const money = (n: number | null | undefined) => `Rs. ${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Temporary"];

export default function SalaryIncrementsPage() {
  const { user } = useAuthState();
  const canView = user?.permissions?.includes("hr.employees.view") || user?.role === "SUPER_ADMIN";
  const canManage = user?.permissions?.includes("hr.employees.edit") || user?.role === "SUPER_ADMIN";
  const campusScoped = user?.campusId != null;

  const [rows, setRows] = useState<SalaryIncrementDueRow[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [settings, setSettings] = useState<SalaryIncrementSettings | null>(null);
  const [analytics, setAnalytics] = useState<SalaryIncrementAnalytics | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"workspace" | "history">("workspace");
  const [showPolicy, setShowPolicy] = useState(false);

  const [status, setStatus] = useState<"due" | "upcoming" | "all">("due");
  const [campusIds, setCampusIds] = useState<number[]>([]);
  const [deptIds, setDeptIds] = useState<number[]>([]);
  const [segIds, setSegIds] = useState<number[]>([]);
  const [catIds, setCatIds] = useState<number[]>([]);
  const [empTypes, setEmpTypes] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<SalaryIncrementMode>("PERCENTAGE");
  const [value, setValue] = useState("");
  const [effective, setEffective] = useState(today());
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState<SalaryIncrementPreview[] | null>(null);

  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setLoadError(null);
    const [queue, prefs, campusData, depts, segmentData, analyticsData] = await Promise.allSettled([
      hrService.listSalaryIncrementDue({
        status,
        campus_ids: campusIds,
        department_ids: deptIds,
        segment_ids: segIds,
        staff_category_ids: catIds,
        employment_types: empTypes,
        search: search || undefined,
      }),
      hrService.getSalaryIncrementSettings(),
      campusesService.list(),
      hrService.listDepartments(),
      hrService.listSegments(),
      hrService.getSalaryIncrementAnalytics(),
    ]);
    if (queue.status === "fulfilled") setRows(queue.value);
    if (prefs.status === "fulfilled") setSettings(prefs.value);
    if (campusData.status === "fulfilled") setCampuses(campusData.value);
    if (depts.status === "fulfilled") setDepartments(depts.value);
    if (segmentData.status === "fulfilled") setSegments(segmentData.value);
    if (analyticsData.status === "fulfilled") setAnalytics(analyticsData.value);
    if ([queue, prefs, analyticsData].some((r) => r.status === "rejected"))
      setLoadError("The Salary Increments API is not available yet. Deploy the matching backend release and run its database migration, then refresh this page.");
    if ([campusData, depts, segmentData].some((r) => r.status === "rejected"))
      toast.error("Some employee filters could not be loaded.");
    setLoading(false);
  }, [canView, status, campusIds, deptIds, segIds, catIds, empTypes, search]);

  useEffect(() => {
    const timer = setTimeout(load, 180);
    return () => clearTimeout(timer);
  }, [load]);

  const categoryOptions = useMemo(() => {
    const scoped = deptIds.length ? departments.filter((d) => deptIds.includes(d.id)) : departments;
    const seen = new Map<number, string>();
    scoped.forEach((d) => (d.staff_categories ?? []).forEach((c) => seen.set(c.id, c.name)));
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [departments, deptIds]);

  const activeFilterCount =
    campusIds.length + deptIds.length + segIds.length + catIds.length + empTypes.length + (search ? 1 : 0);
  const clearFilters = () => {
    setCampusIds([]);
    setDeptIds([]);
    setSegIds([]);
    setCatIds([]);
    setEmpTypes([]);
    setSearch("");
  };

  const payload = () => ({
    employee_ids: selected,
    mode,
    ...(mode === "PERCENTAGE" ? { percentage: Number(value) } : { fixed_amount: Number(value) }),
    effective_from: effective,
    notes: notes || undefined,
  });
  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const previewTotal = useMemo(() => preview?.reduce((sum, r) => sum + (r.increment_amount ?? 0), 0) ?? 0, [preview]);

  async function showPreview() {
    if (!selected.length || !Number(value) || !effective) return toast.error("Choose staff, a positive amount, and effective date.");
    setSaving(true);
    try {
      setPreview(await hrService.previewSalaryIncrement(payload()));
    } catch {
      toast.error("Preview failed.");
    } finally {
      setSaving(false);
    }
  }
  async function apply() {
    setSaving(true);
    try {
      const result = await hrService.applySalaryIncrement(payload());
      toast.success(`${result.successes.length} increment(s) applied.${result.failures.length ? ` ${result.failures.length} could not be applied.` : ""}`);
      setPreview(null);
      setSelected([]);
      await load();
    } catch {
      toast.error("Could not apply increments.");
    } finally {
      setSaving(false);
    }
  }
  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    try {
      setSettings(await hrService.updateSalaryIncrementSettings({ default_cycle_months: settings.default_cycle_months, upcoming_window_days: settings.upcoming_window_days }));
      toast.success("Cycle settings saved.");
      await load();
    } catch {
      toast.error("Settings must be valid whole numbers.");
    } finally {
      setSaving(false);
    }
  }

  if (!canView) return <div className="p-8 text-sm text-zinc-500">You do not have access to salary increments.</div>;

  const summaryCards = analytics
    ? [
        { label: "Increments recorded", value: analytics.summary.total_increments.toLocaleString(), icon: Users, hint: "All-time confirmed changes" },
        { label: "Average increment", value: `${analytics.summary.average_increment_percent}%`, icon: TrendingUp, hint: `${money(analytics.summary.average_increment_amount)} per month` },
        { label: "Monthly payroll impact", value: money(analytics.summary.monthly_payroll_increase), icon: Wallet, hint: `${money(analytics.summary.annual_payroll_impact)} annualised` },
        { label: "Awaiting review", value: analytics.summary.due_count.toLocaleString(), icon: CalendarClock, hint: "Employees due or overdue" },
      ]
    : [];

  return (
    <main className="p-5 md:p-8 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-amber-100 p-3 text-amber-700"><BadgePercent /></div>
          <div>
            <h1 className="text-2xl font-bold">Salary Increments</h1>
            <p className="text-sm text-zinc-500">Build a targeted increment, inspect its 12-month impact, then explicitly confirm it.</p>
          </div>
        </div>
        <div className="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
          <button onClick={() => setActiveView("workspace")} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${activeView === "workspace" ? "bg-white shadow dark:bg-zinc-700" : "text-zinc-500"}`}>Bulk workspace</button>
          <button onClick={() => setActiveView("history")} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${activeView === "history" ? "bg-white shadow dark:bg-zinc-700" : "text-zinc-500"}`}>History &amp; insights</button>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex items-start justify-between">
                <p className="text-xs font-semibold text-zinc-500">{card.label}</p>
                <Icon className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-2 text-xl font-bold">{card.value}</p>
              <p className="mt-1 text-xs text-zinc-500">{card.hint}</p>
            </div>
          );
        })}
      </section>

      {activeView === "history" ? (
        <section className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="font-bold">Past salary increments</h2>
            <p className="text-sm text-zinc-500">Latest 100 confirmed changes, including the monthly and annual impact.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900">
                <tr><th className="p-3">Effective</th><th>Employee</th><th>Department</th><th>Method</th><th>Monthly change</th><th>Salary after</th><th>12-month impact</th><th>Applied by</th></tr>
              </thead>
              <tbody>
                {analytics?.records.map((row) => (
                  <tr key={row.id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="p-3">{row.effective_from}</td>
                    <td className="font-medium">{row.employee_name ?? "Unnamed"}<span className="block text-xs font-normal text-zinc-500">{row.employee_code}</span></td>
                    <td>{row.department ?? "—"}</td>
                    <td>{row.mode === "PERCENTAGE" ? `${row.percentage}%` : money(row.fixed_amount)}<span className="block text-xs text-zinc-500">{row.notes ?? "No note"}</span></td>
                    <td className="font-semibold text-emerald-600">+{money(row.increment_amount)} ({row.increment_percent}%)</td>
                    <td>{money(row.new_pay)}</td>
                    <td>{money(row.annual_impact)}</td>
                    <td>{row.applied_by ?? "System"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {analytics && !analytics.records.length && <p className="p-10 text-center text-sm text-zinc-500">No salary increments have been recorded yet.</p>}
          </div>
        </section>
      ) : (
        <>
          {loadError && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{loadError}</div>}

          <section className="flex flex-wrap items-center gap-2">
            <select className={input} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="due">Due / overdue</option>
              <option value="upcoming">Upcoming</option>
              <option value="all">All eligible</option>
            </select>
            {!campusScoped && <MultiSelect label="Campus" options={campuses.map((c) => ({ value: c.id, label: c.campus_name }))} selected={campusIds} onChange={(v) => setCampusIds(v as number[])} />}
            <MultiSelect label="Department" options={departments.map((d) => ({ value: d.id, label: d.name }))} selected={deptIds} onChange={(v) => setDeptIds(v as number[])} />
            <MultiSelect label="Category" options={categoryOptions} selected={catIds} onChange={(v) => setCatIds(v as number[])} />
            <MultiSelect label="Segment" options={segments.map((s) => ({ value: s.id, label: s.name }))} selected={segIds} onChange={(v) => setSegIds(v as number[])} />
            <MultiSelect label="Employment type" options={EMPLOYMENT_TYPES.map((t) => ({ value: t, label: t }))} selected={empTypes} onChange={(v) => setEmpTypes(v as string[])} />
            <label className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
              <input className={`${input} pl-9`} placeholder="Search employee" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="h-10 rounded-xl px-3 text-sm font-semibold text-amber-600 hover:underline">Clear {activeFilterCount}</button>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="p-3"><input type="checkbox" checked={rows.length > 0 && selected.length === rows.length} onChange={() => setSelected(selected.length === rows.length ? [] : rows.map((r) => r.employee_id))} /></th>
                  <th>Employee</th><th>Campus</th><th>Department / category</th><th>Current pay</th><th>Next due</th><th>Remaining</th><th>Cycle</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="p-10 text-center"><Loader2 className="mx-auto animate-spin" /></td></tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.employee_id} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="p-3"><input type="checkbox" checked={selected.includes(r.employee_id)} onChange={() => toggle(r.employee_id)} disabled={!canManage || r.status === "MISSING_ANCHOR"} /></td>
                      <td className="p-3 font-medium">{r.name ?? "Unnamed"}<span className="block text-xs font-normal text-zinc-500">{r.employee_code}</span></td>
                      <td className="p-3 text-zinc-500">{r.campus ?? "—"}</td>
                      <td className="p-3 text-zinc-500">{r.department ?? "—"}<span className="block text-xs">{[r.segment, r.staff_category].filter(Boolean).join(" · ")}</span></td>
                      <td>{money(r.monthly_pay)}</td>
                      <td>{r.next_due_date ?? "Missing join date"}</td>
                      <td className={`font-semibold ${r.months_remaining != null && r.months_remaining <= 0 ? "text-rose-600" : "text-zinc-600"}`}>{r.months_remaining == null ? "—" : r.months_remaining <= 0 ? `${Math.abs(r.months_remaining)} mo overdue` : `${r.months_remaining} mo`}</td>
                      <td>{r.cycle_months} mo</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {!loading && !rows.length && <p className="p-8 text-center text-sm text-zinc-500">No employees match these filters.</p>}
          </section>

          {settings && canManage && (
            <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <button onClick={() => setShowPolicy((v) => !v)} className="flex w-full items-center justify-between p-3 text-sm font-semibold text-zinc-500">
                <span className="flex items-center gap-2"><Settings2 className="h-4 w-4" /> Cycle policy</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showPolicy ? "rotate-180" : ""}`} />
              </button>
              {showPolicy && (
                <div className="flex flex-wrap items-end gap-3 border-t border-zinc-200 p-4 dark:border-zinc-800">
                  <label className="text-xs font-semibold">Default cycle (months)
                    <input className={`${input} mt-1 block w-36`} type="number" min="1" max="120" value={settings.default_cycle_months} onChange={(e) => setSettings({ ...settings, default_cycle_months: Number(e.target.value) })} />
                  </label>
                  <label className="text-xs font-semibold">Upcoming window (days)
                    <input className={`${input} mt-1 block w-36`} type="number" min="1" max="365" value={settings.upcoming_window_days} onChange={(e) => setSettings({ ...settings, upcoming_window_days: Number(e.target.value) })} />
                  </label>
                  <button disabled={saving} onClick={saveSettings} className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">Save policy</button>
                  <span className="text-xs text-zinc-500">Any whole-month cycle from 1–120 (for example 12 or 14).</span>
                </div>
              )}
            </section>
          )}

          {canManage && selected.length > 0 && (
            <section className="sticky bottom-4 rounded-2xl bg-zinc-900 p-4 text-white shadow-xl">
              <div className="flex flex-wrap items-end gap-3">
                <strong>{selected.length} selected</strong>
                <select className={`${input} text-zinc-900`} value={mode} onChange={(e) => setMode(e.target.value as SalaryIncrementMode)}>
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED_AMOUNT">Fixed PKR amount</option>
                </select>
                <input className={`${input} w-32 text-zinc-900`} type="number" min="0.01" placeholder={mode === "PERCENTAGE" ? "e.g. 10" : "e.g. 5000"} value={value} onChange={(e) => setValue(e.target.value)} />
                <input className={`${input} text-zinc-900`} type="date" value={effective} onChange={(e) => setEffective(e.target.value)} />
                <input className={`${input} w-48 text-zinc-900`} placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
                <button onClick={showPreview} disabled={saving} className="h-10 rounded-xl bg-amber-400 px-4 text-sm font-bold text-zinc-900">Preview increase</button>
                <button onClick={() => setSelected([])} className="p-2"><X /></button>
              </div>
            </section>
          )}
        </>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5 dark:bg-zinc-900">
            <div className="flex justify-between">
              <div>
                <h2 className="text-lg font-bold">Confirm salary increments</h2>
                <p className="text-sm text-zinc-500">New monthly and full 12-month salary are shown before payroll is changed.</p>
              </div>
              <button onClick={() => setPreview(null)}><X /></button>
            </div>
            <div className="mt-4 space-y-2">
              {preview.map((r) => (
                <div key={r.employee_id} className="grid grid-cols-4 gap-2 rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-800">
                  <span className="font-medium">{r.employee_name ?? `Employee #${r.employee_id}`}</span>
                  {r.error ? (
                    <span className="col-span-3 text-rose-600">{r.error}</span>
                  ) : (
                    <>
                      <span>{money(r.previous_pay)} → {money(r.new_pay)}</span>
                      <span>12 mo: {money(r.annual_pay_after)}</span>
                      <span className="text-emerald-600">+{money(r.increment_amount)}/mo</span>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-zinc-500">Total monthly increase: {money(previewTotal)}</span>
              <button onClick={apply} disabled={saving || preview.every((r) => r.error)} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">{saving ? "Applying…" : "Confirm and apply"}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
