"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Route,
  Search,
  ShieldAlert,
  Trash2,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { useAuthState } from "@/context/AuthContext";
import { studentsService, type SimpleStudentSearchResult } from "@/lib/students.service";
import {
  routingErrorMessage,
  ticketRoutingService,
  type QueueInput,
  type RoutingDecision,
  type RoutingIssue,
  type RoutingOverview,
  type RoutingRule,
  type RoutingStaff,
  type RuleInput,
  type TicketCategory,
  type TicketChildMatch,
  type TicketQueue,
} from "@/lib/ticket-routing.service";

const CATEGORY_LABEL: Record<TicketCategory, string> = {
  GENERAL: "General inquiries",
  FINANCIAL: "Fees & payments",
};

const CHILD_LABEL: Record<TicketChildMatch, string> = {
  ANY: "Any ticket",
  WITH_CHILD: "About a child",
  NO_CHILD: "Not about a child",
};

const card = "bg-white dark:bg-zinc-950 rounded-[24px] border border-zinc-100 dark:border-zinc-800 shadow-sm";
const input =
  "w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900/10";
const label = "text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400";
const primaryBtn =
  "inline-flex items-center justify-center gap-2 px-4 h-10 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-40";
const ghostBtn =
  "inline-flex items-center justify-center gap-1.5 px-3 h-9 text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-40";

export default function TicketRoutingPage() {
  const { user } = useAuthState();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [data, setData] = useState<RoutingOverview | null>(null);
  const [issues, setIssues] = useState<RoutingIssue[] | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const [overview, health] = await Promise.all([
        ticketRoutingService.overview(),
        ticketRoutingService.health(),
      ]);
      setData(overview);
      setIssues(health);
    } catch (e) {
      toast.error(routingErrorMessage(e, "Could not load routing settings"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) void reload();
    else setLoading(false);
  }, [isSuperAdmin, reload]);

  if (!isSuperAdmin) {
    return (
      <div className={`${card} max-w-xl mx-auto mt-16 p-10 text-center space-y-3`}>
        <ShieldAlert className="h-10 w-10 mx-auto text-zinc-400" />
        <p className="font-bold text-zinc-900 dark:text-zinc-50">Super admins only</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Ticket routing can only be changed by a super admin.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      <div className={`${card} p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div className="space-y-1">
          <Link
            href="/support-tickets"
            className="inline-flex items-center gap-1 text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Support Tickets
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-zinc-950 text-white rounded-2xl">
              <Route className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">Ticket Routing</h1>
          </div>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium pl-1">
            Decide who receives new parent tickets. The most specific matching rule wins; if its
            target can&apos;t take the ticket, the next rule is tried, then the fallback queue.
          </p>
        </div>
      </div>

      {loading || !data ? (
        <div className={`${card} py-32 flex items-center justify-center`}>
          <Loader2 className="h-8 w-8 animate-spin text-zinc-900 dark:text-zinc-50" />
        </div>
      ) : (
        <>
          <HealthPanel issues={issues ?? []} />
          <PreviewPanel data={data} />
          <RulesSection data={data} onChanged={reload} />
          <QueuesSection data={data} onChanged={reload} />
        </>
      )}
    </div>
  );
}

// ─── Health ───────────────────────────────────────────────────────────────────

function HealthPanel({ issues }: { issues: RoutingIssue[] }) {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  if (issues.length === 0) {
    return (
      <div className={`${card} p-5 flex items-center gap-3`}>
        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-300">
          Every class has an active owner and every queue has a backup.
        </p>
      </div>
    );
  }
  return (
    <div className={`${card} p-5 space-y-3`}>
      <p className={label}>
        Routing health · {errors.length} problem{errors.length === 1 ? "" : "s"}, {warnings.length} warning
        {warnings.length === 1 ? "" : "s"}
      </p>
      <ul className="space-y-2">
        {[...errors, ...warnings].map((i, idx) => (
          <li
            key={idx}
            className={`flex items-start gap-2 text-sm rounded-xl px-3 py-2 ${
              i.severity === "error" ? "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300" : "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200"
            }`}
          >
            {i.severity === "error" ? (
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            )}
            <span>{i.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Preview ──────────────────────────────────────────────────────────────────

function PreviewPanel({ data }: { data: RoutingOverview }) {
  const [category, setCategory] = useState<TicketCategory>("GENERAL");
  const [withChild, setWithChild] = useState(true);
  const [student, setStudent] = useState<SimpleStudentSearchResult | null>(null);
  const [subtopic, setSubtopic] = useState("");
  const [result, setResult] = useState<RoutingDecision | null>(null);
  const [running, setRunning] = useState(false);

  const subtopics =
    category === "FINANCIAL"
      ? data.options.subtopics.FINANCIAL
      : withChild
        ? data.options.subtopics.GENERAL_WITH_CHILD
        : data.options.subtopics.GENERAL_NO_CHILD;

  const run = async () => {
    if (withChild && !student) {
      toast.error("Pick a student, or switch to a ticket that is not about a child");
      return;
    }
    setRunning(true);
    try {
      setResult(
        await ticketRoutingService.preview({
          category,
          subtopic: subtopic || undefined,
          student_cc: withChild ? student?.cc : undefined,
        }),
      );
    } catch (e) {
      toast.error(routingErrorMessage(e, "Preview failed"));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className={`${card} p-6 space-y-4`}>
      <div>
        <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-50">Test a ticket</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">See where a new ticket would go right now, and why.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <div className="space-y-1">
          <p className={label}>Category</p>
          <select
            className={input}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as TicketCategory);
              setSubtopic("");
              setResult(null);
            }}
          >
            <option value="GENERAL">{CATEGORY_LABEL.GENERAL}</option>
            <option value="FINANCIAL">{CATEGORY_LABEL.FINANCIAL}</option>
          </select>
        </div>
        <div className="space-y-1">
          <p className={label}>About</p>
          <select
            className={input}
            value={withChild ? "child" : "family"}
            onChange={(e) => {
              setWithChild(e.target.value === "child");
              setSubtopic("");
              setResult(null);
            }}
          >
            <option value="child">A specific child</option>
            <option value="family">Not one child</option>
          </select>
        </div>
        <div className="space-y-1 md:col-span-2">
          <p className={label}>Topic</p>
          <select className={input} value={subtopic} onChange={(e) => setSubtopic(e.target.value)}>
            <option value="">Any topic</option>
            {subtopics.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      {withChild && <StudentPicker value={student} onChange={(s) => { setStudent(s); setResult(null); }} />}
      <button className={primaryBtn} onClick={run} disabled={running}>
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Route className="h-4 w-4" />}
        Show route
      </button>

      {result && (
        <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-4 space-y-3">
          <p className="text-sm text-zinc-900 dark:text-zinc-50">
            {result.student && <span className="text-zinc-500 dark:text-zinc-400">{result.student} → </span>}
            <span className="font-black">
              {result.target.kind === "none" ? "Unassigned (no route)" : result.target.name}
            </span>
            <span className="ml-2 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {result.status === "OPEN" ? "waits in queue to be claimed" : "assigned immediately"}
            </span>
          </p>
          <ol className="space-y-1">
            {result.steps.map((s, i) => (
              <li key={i} className="text-xs flex gap-2">
                <span
                  className={`font-bold ${s.outcome === "routed" ? "text-emerald-700" : "text-amber-700"}`}
                >
                  {s.outcome === "routed" ? "✓" : "↷"}
                </span>
                <span className="text-zinc-700 dark:text-zinc-300">
                  <span className="font-semibold">{s.rule_name}</span>: {s.outcome} {s.reason}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function StudentPicker({
  value,
  onChange,
}: {
  value: SimpleStudentSearchResult | null;
  onChange: (s: SimpleStudentSearchResult | null) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SimpleStudentSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        setResults(await studentsService.searchSimple({ q: term }));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [q]);

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 py-2">
        <div className="flex-1 text-sm">
          <span className="font-bold text-zinc-900 dark:text-zinc-50">{value.full_name}</span>
          <span className="text-zinc-500 dark:text-zinc-400">
            {" "}
            · CC {value.cc} · {value.campuses?.campus_name} · {value.classes?.description}
          </span>
        </div>
        <button className={ghostBtn} onClick={() => onChange(null)}>
          <X className="h-3.5 w-3.5" /> Change
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-3 text-zinc-400" />
        <input
          className={`${input} pl-9`}
          placeholder="Search student by name, GR or CC"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {q.trim() && (
        <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 max-h-56 overflow-auto">
          {searching ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 p-3">Searching…</p>
          ) : results.length === 0 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 p-3">No students match “{q.trim()}”.</p>
          ) : (
            results.map((s) => (
              <button
                key={s.cc}
                className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
                onClick={() => {
                  onChange(s);
                  setQ("");
                }}
              >
                <span className="font-semibold">{s.full_name}</span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  {" "}
                  · {s.gr_number ?? `CC ${s.cc}`} · {s.campuses?.campus_name} · {s.classes?.description}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Rules ────────────────────────────────────────────────────────────────────

function RulesSection({ data, onChanged }: { data: RoutingOverview; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState<RoutingRule | "new" | null>(null);
  const campusName = useMemo(() => new Map(data.options.campuses.map((c) => [c.id, c.campus_name])), [data]);
  const segmentName = useMemo(() => new Map(data.options.segments.map((s) => [s.id, s.name])), [data]);
  const className = useMemo(() => new Map(data.options.classes.map((c) => [c.id, c.description])), [data]);

  const conditions = (r: RoutingRule) => {
    const parts = [CHILD_LABEL[r.child_match]];
    if (r.campus_id != null) parts.push(campusName.get(r.campus_id) ?? `Campus ${r.campus_id}`);
    if (r.segment_id != null) parts.push(segmentName.get(r.segment_id) ?? `Segment ${r.segment_id}`);
    if (r.class_ids.length) parts.push(r.class_ids.map((id) => className.get(id) ?? id).join(", "));
    if (r.subtopic) parts.push(`Topic: ${r.subtopic}`);
    return parts.join(" · ");
  };

  const toggle = async (r: RoutingRule) => {
    try {
      await ticketRoutingService.updateRule(r.id, { is_active: !r.is_active });
      toast.success(r.is_active ? "Rule switched off" : "Rule switched on");
      await onChanged();
    } catch (e) {
      toast.error(routingErrorMessage(e, "Could not update rule"));
    }
  };

  const remove = async (r: RoutingRule) => {
    if (!confirm(`Delete rule "${r.name}"?`)) return;
    try {
      await ticketRoutingService.deleteRule(r.id);
      toast.success("Rule deleted");
      await onChanged();
    } catch (e) {
      toast.error(routingErrorMessage(e, "Could not delete rule"));
    }
  };

  return (
    <div className={`${card} p-6 space-y-5`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-50">Rules</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Ranked by how specific they are: topic, then class, segment, campus. Priority (lower first) breaks ties.
          </p>
        </div>
        <button className={primaryBtn} onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" /> Add rule
        </button>
      </div>

      {(["GENERAL", "FINANCIAL"] as TicketCategory[]).map((cat) => {
        const rules = data.rules.filter((r) => r.category === cat);
        return (
          <div key={cat} className="space-y-2">
            <p className={label}>{CATEGORY_LABEL[cat]}</p>
            {rules.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No rules — every ticket goes to the fallback queue.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-900 text-left">
                    <tr className={label}>
                      <th className="px-3 py-2">Rule</th>
                      <th className="px-3 py-2">Applies to</th>
                      <th className="px-3 py-2">Sends to</th>
                      <th className="px-3 py-2">Priority</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((r) => {
                      const inactiveTarget = r.target_user && r.target_user.is_active === false;
                      return (
                        <tr key={r.id} className={`border-t border-zinc-100 dark:border-zinc-800 ${r.is_active ? "" : "opacity-50"}`}>
                          <td className="px-3 py-2 font-semibold text-zinc-900 dark:text-zinc-50">{r.name}</td>
                          <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">{conditions(r)}</td>
                          <td className="px-3 py-2">
                            {r.target_user ? (
                              <span className={inactiveTarget ? "text-red-700 dark:text-red-300 font-semibold" : "text-zinc-900 dark:text-zinc-50"}>
                                {r.target_user.full_name}
                                {inactiveTarget && " (inactive)"}
                              </span>
                            ) : r.target_queue ? (
                              <span className="inline-flex items-center gap-1 text-zinc-900 dark:text-zinc-50">
                                <Users className="h-3.5 w-3.5" /> {r.target_queue.name}
                              </span>
                            ) : (
                              <span className="text-red-700 dark:text-red-300 font-semibold">No target</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">{r.priority}</td>
                          <td className="px-3 py-2">
                            <div className="flex justify-end gap-1.5">
                              <button className={ghostBtn} onClick={() => toggle(r)}>
                                {r.is_active ? "Switch off" : "Switch on"}
                              </button>
                              <button className={ghostBtn} onClick={() => setEditing(r)} aria-label="Edit rule">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button className={ghostBtn} onClick={() => remove(r)} aria-label="Delete rule">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {editing && (
        <RuleEditor
          data={data}
          rule={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await onChanged();
          }}
        />
      )}
    </div>
  );
}

function RuleEditor({
  data,
  rule,
  onClose,
  onSaved,
}: {
  data: RoutingOverview;
  rule: RoutingRule | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<RuleInput>(() =>
    rule
      ? {
          name: rule.name,
          category: rule.category,
          child_match: rule.child_match,
          campus_id: rule.campus_id,
          segment_id: rule.segment_id,
          class_ids: rule.class_ids,
          subtopic: rule.subtopic,
          target_user_id: rule.target_user_id,
          target_queue_id: rule.target_queue_id,
          priority: rule.priority,
          is_active: rule.is_active,
        }
      : { name: "", category: "GENERAL", child_match: "WITH_CHILD", class_ids: [], priority: 100, is_active: true },
  );
  const [targetKind, setTargetKind] = useState<"user" | "queue">(rule?.target_queue_id != null ? "queue" : "user");
  const [saving, setSaving] = useState(false);
  const set = (patch: RuleInput) => setForm((f) => ({ ...f, ...patch }));

  const placementAllowed = form.child_match !== "NO_CHILD";
  const queues = data.queues.filter((q) => q.category === form.category);
  const classes = data.options.classes.filter((c) => form.segment_id == null || c.segment_id === form.segment_id);
  const subtopics =
    form.category === "FINANCIAL"
      ? data.options.subtopics.FINANCIAL
      : form.child_match === "WITH_CHILD"
        ? data.options.subtopics.GENERAL_WITH_CHILD
        : form.child_match === "NO_CHILD"
          ? data.options.subtopics.GENERAL_NO_CHILD
          : [...new Set([...data.options.subtopics.GENERAL_WITH_CHILD, ...data.options.subtopics.GENERAL_NO_CHILD])];

  const save = async () => {
    if (!form.name?.trim()) return toast.error("Give the rule a name");
    const payload: RuleInput = {
      ...form,
      subtopic: form.subtopic || null,
      target_user_id: targetKind === "user" ? form.target_user_id ?? null : null,
      target_queue_id: targetKind === "queue" ? form.target_queue_id ?? null : null,
      ...(placementAllowed ? {} : { campus_id: null, segment_id: null, class_ids: [] }),
    };
    if (!payload.target_user_id && payload.target_queue_id == null) return toast.error("Pick who the rule sends tickets to");
    setSaving(true);
    try {
      if (rule) await ticketRoutingService.updateRule(rule.id, payload);
      else await ticketRoutingService.createRule(payload);
      toast.success(rule ? "Rule updated" : "Rule added");
      await onSaved();
    } catch (e) {
      toast.error(routingErrorMessage(e, "Could not save rule"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={rule ? "Edit rule" : "Add rule"} onClose={onClose}>
      <div className="space-y-4">
        <Field name="Name">
          <input className={input} value={form.name ?? ""} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Transport questions" />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field name="Category">
            <select
              className={input}
              value={form.category}
              onChange={(e) => set({ category: e.target.value as TicketCategory, target_queue_id: null, subtopic: null })}
            >
              <option value="GENERAL">{CATEGORY_LABEL.GENERAL}</option>
              <option value="FINANCIAL">{CATEGORY_LABEL.FINANCIAL}</option>
            </select>
          </Field>
          <Field name="Tickets">
            <select
              className={input}
              value={form.child_match}
              onChange={(e) => set({ child_match: e.target.value as TicketChildMatch, subtopic: null })}
            >
              {(Object.keys(CHILD_LABEL) as TicketChildMatch[]).map((k) => (
                <option key={k} value={k}>
                  {CHILD_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {placementAllowed && (
          <div className="grid gap-4 md:grid-cols-2">
            <Field name="Campus">
              <select
                className={input}
                value={form.campus_id ?? ""}
                onChange={(e) => set({ campus_id: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Any campus</option>
                {data.options.campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.campus_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field name="Segment">
              <select
                className={input}
                value={form.segment_id ?? ""}
                onChange={(e) => set({ segment_id: e.target.value ? Number(e.target.value) : null, class_ids: [] })}
              >
                <option value="">Any segment</option>
                {data.options.segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {placementAllowed && (
          <Field name={`Classes${form.class_ids?.length ? ` (${form.class_ids.length})` : " — any"}`}>
            <div className="flex flex-wrap gap-1.5">
              {classes.map((c) => {
                const on = form.class_ids?.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      set({
                        class_ids: on ? form.class_ids!.filter((id) => id !== c.id) : [...(form.class_ids ?? []), c.id],
                      })
                    }
                    className={`px-2.5 h-8 rounded-lg text-xs font-bold border ${
                      on ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 border-zinc-900" : "bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    }`}
                  >
                    {c.description}
                  </button>
                );
              })}
              {!!form.class_ids?.length && (
                <button type="button" className={ghostBtn} onClick={() => set({ class_ids: [] })}>
                  Clear
                </button>
              )}
            </div>
          </Field>
        )}

        <Field name="Topic">
          <select className={input} value={form.subtopic ?? ""} onChange={(e) => set({ subtopic: e.target.value || null })}>
            <option value="">Any topic</option>
            {subtopics.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>

        <Field name="Send to">
          <div className="flex gap-2 mb-2">
            {(["user", "queue"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTargetKind(k)}
                className={`px-3 h-8 rounded-lg text-xs font-bold border ${
                  targetKind === k ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 border-zinc-900" : "bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800"
                }`}
              >
                {k === "user" ? "A staff member" : "A queue"}
              </button>
            ))}
          </div>
          {targetKind === "user" ? (
            <StaffSelect
              staff={data.options.staff}
              value={form.target_user_id ?? null}
              onChange={(id) => set({ target_user_id: id })}
            />
          ) : queues.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No {CATEGORY_LABEL[form.category ?? "GENERAL"].toLowerCase()} queues yet.</p>
          ) : (
            <select
              className={input}
              value={form.target_queue_id ?? ""}
              onChange={(e) => set({ target_queue_id: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">Choose a queue</option>
              {queues.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field name="Priority (lower runs first among equals)">
            <input
              type="number"
              min={0}
              className={input}
              value={form.priority ?? 100}
              onChange={(e) => set({ priority: Number(e.target.value) })}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-300 pt-6">
            <input type="checkbox" checked={form.is_active ?? true} onChange={(e) => set({ is_active: e.target.checked })} />
            Rule is on
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button className={ghostBtn} onClick={onClose}>
            Cancel
          </button>
          <button className={primaryBtn} onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save rule
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Queues ───────────────────────────────────────────────────────────────────

function QueuesSection({ data, onChanged }: { data: RoutingOverview; onChanged: () => Promise<void> }) {
  const [creating, setCreating] = useState(false);
  return (
    <div className={`${card} p-6 space-y-5`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-50">Queues</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Groups of staff who share tickets. Pool queues wait for someone to claim; auto queues assign the first
            available member in order.
          </p>
        </div>
        <button className={primaryBtn} onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Add queue
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {data.queues.map((q) => (
          <QueueCard key={q.id} queue={q} staff={data.options.staff} onChanged={onChanged} />
        ))}
        {creating && (
          <QueueCard
            queue={null}
            staff={data.options.staff}
            onChanged={async () => {
              setCreating(false);
              await onChanged();
            }}
            onCancel={() => setCreating(false)}
          />
        )}
      </div>
    </div>
  );
}

function QueueCard({
  queue,
  staff,
  onChanged,
  onCancel,
}: {
  queue: TicketQueue | null;
  staff: RoutingStaff[];
  onChanged: () => Promise<void>;
  onCancel?: () => void;
}) {
  const initial = useMemo<QueueInput & { members: RoutingStaff[] }>(
    () => ({
      name: queue?.name ?? "",
      category: queue?.category ?? "GENERAL",
      assignment: queue?.assignment ?? "POOL",
      allow_forward: queue?.allow_forward ?? false,
      is_fallback: queue?.is_fallback ?? false,
      is_active: queue?.is_active ?? true,
      members: queue?.members.map((m) => m.user) ?? [],
    }),
    [queue],
  );
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(initial), [initial]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const move = (idx: number, dir: -1 | 1) => {
    const members = [...form.members];
    const [m] = members.splice(idx, 1);
    members.splice(idx + dir, 0, m);
    set({ members });
  };
  const activeMembers = form.members.filter((m) => m.is_active !== false).length;

  const save = async () => {
    if (!form.name?.trim()) return toast.error("Give the queue a name");
    const { members, ...rest } = form;
    const payload: QueueInput = { ...rest, member_ids: members.map((m) => m.id) };
    setSaving(true);
    try {
      if (queue) await ticketRoutingService.updateQueue(queue.id, payload);
      else await ticketRoutingService.createQueue(payload);
      toast.success(queue ? "Queue saved" : "Queue added");
      await onChanged();
    } catch (e) {
      toast.error(routingErrorMessage(e, "Could not save queue"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!queue || !confirm(`Delete queue "${queue.name}"?`)) return;
    try {
      await ticketRoutingService.deleteQueue(queue.id);
      toast.success("Queue deleted");
      await onChanged();
    } catch (e) {
      toast.error(routingErrorMessage(e, "Could not delete queue"));
    }
  };

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${form.is_active ? "border-zinc-200 dark:border-zinc-800" : "border-zinc-100 dark:border-zinc-800 opacity-60"}`}>
      <div className="flex items-start gap-2">
        <input
          className={`${input} font-bold`}
          value={form.name ?? ""}
          placeholder="Queue name"
          onChange={(e) => set({ name: e.target.value })}
        />
        {queue && (
          <button className={ghostBtn} onClick={remove} aria-label="Delete queue">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {queue && (
          <span className="px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 font-bold text-zinc-700 dark:text-zinc-300">
            {queue.open_tickets} open ticket{queue.open_tickets === 1 ? "" : "s"}
          </span>
        )}
        {form.is_fallback && (
          <span className="px-2 py-1 rounded-lg bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900 font-bold">Fallback for {CATEGORY_LABEL[form.category!].toLowerCase()}</span>
        )}
        {activeMembers === 0 && <span className="px-2 py-1 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-bold">No active members</span>}
        {activeMembers === 1 && <span className="px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 font-bold">One person — add a backup</span>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select
          className={input}
          value={form.category}
          disabled={!!queue}
          onChange={(e) => set({ category: e.target.value as TicketCategory })}
        >
          <option value="GENERAL">{CATEGORY_LABEL.GENERAL}</option>
          <option value="FINANCIAL">{CATEGORY_LABEL.FINANCIAL}</option>
        </select>
        <select
          className={input}
          value={form.assignment}
          onChange={(e) => set({ assignment: e.target.value as "POOL" | "AUTO" })}
        >
          <option value="POOL">Pool — members claim</option>
          <option value="AUTO">Auto — first available member</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-800 dark:text-zinc-300">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!form.allow_forward} onChange={(e) => set({ allow_forward: e.target.checked })} />
          Members can forward to anyone
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!form.is_fallback} onChange={(e) => set({ is_fallback: e.target.checked })} />
          Fallback queue
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!form.is_active} onChange={(e) => set({ is_active: e.target.checked })} />
          On
        </label>
      </div>

      <div className="space-y-1.5">
        <p className={label}>Members{form.assignment === "AUTO" ? " (tried in this order)" : ""}</p>
        {form.members.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400">No members yet.</p>}
        {form.members.map((m, idx) => (
          <div key={m.id} className="flex items-center gap-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 px-3 py-1.5 text-sm">
            <span className={`flex-1 ${m.is_active === false ? "text-red-700 dark:text-red-300" : "text-zinc-900 dark:text-zinc-50"}`}>
              {m.full_name}
              <span className="text-zinc-500 dark:text-zinc-400"> · {m.username}</span>
              {m.is_active === false && " (inactive)"}
            </span>
            <button className="p-1 disabled:opacity-30" disabled={idx === 0} onClick={() => move(idx, -1)} aria-label="Move up">
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              className="p-1 disabled:opacity-30"
              disabled={idx === form.members.length - 1}
              onClick={() => move(idx, 1)}
              aria-label="Move down"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button className="p-1" onClick={() => set({ members: form.members.filter((x) => x.id !== m.id) })} aria-label="Remove">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <StaffSelect
          staff={staff.filter((s) => !form.members.some((m) => m.id === s.id))}
          value={null}
          placeholder="Add a member…"
          onChange={(id) => {
            const person = staff.find((s) => s.id === id);
            if (person) set({ members: [...form.members, person] });
          }}
        />
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button className={ghostBtn} onClick={onCancel}>
            Cancel
          </button>
        )}
        {queue && dirty && (
          <button className={ghostBtn} onClick={() => setForm(initial)}>
            Discard
          </button>
        )}
        <button className={primaryBtn} onClick={save} disabled={saving || (!!queue && !dirty)}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {queue ? "Save queue" : "Add queue"}
        </button>
      </div>
    </div>
  );
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

/** Typeahead over the active staff list the overview returns. */
function StaffSelect({
  staff,
  value,
  onChange,
  placeholder = "Search staff by name or username…",
}: {
  staff: RoutingStaff[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const selected = value ? staff.find((s) => s.id === value) : null;
  const term = q.trim().toLowerCase();
  const matches = term
    ? staff.filter((s) => s.full_name.toLowerCase().includes(term) || s.username.toLowerCase().includes(term)).slice(0, 8)
    : [];

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm">
        <span className="flex-1">
          <span className="font-bold">{selected.full_name}</span>
          <span className="text-zinc-500 dark:text-zinc-400"> · {selected.username} · {selected.role}</span>
        </span>
        <button className={ghostBtn} onClick={() => onChange(null)}>
          Change
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <input className={input} placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
      {term && (
        <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 max-h-48 overflow-auto">
          {matches.length === 0 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 p-3">No active staff match “{q.trim()}”.</p>
          ) : (
            matches.map((s) => (
              <button
                key={s.id}
                className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
                onClick={() => {
                  onChange(s.id);
                  setQ("");
                }}
              >
                <span className="font-semibold">{s.full_name}</span>
                <span className="text-zinc-500 dark:text-zinc-400"> · {s.username} · {s.role}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Field({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className={label}>{name}</p>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 md:p-10" onClick={onClose}>
      <div className={`${card} w-full max-w-2xl p-6 space-y-4`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-50">{title}</h3>
          <button className={ghostBtn} onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
