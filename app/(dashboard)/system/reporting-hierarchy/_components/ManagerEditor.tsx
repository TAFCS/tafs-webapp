"use client";

import { useMemo, useState } from "react";
import { ArrowUp, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import { hrService, type HierarchyEmployee, type ReportingLine } from "@/lib/hr.service";
import { PersonSearch } from "./PersonSearch";
import { directReportsOf, managersOf } from "./tree";

function errorMessage(err: unknown): string {
  const e = err as { response?: { data?: { message?: string | string[] } } };
  const m = e?.response?.data?.message;
  return Array.isArray(m) ? m.join(" ") : m || "Could not save reporting lines.";
}

/**
 * Who `person` reports to. A super admin may pick anyone, any number of times
 * over; the only thing the list order decides is which manager the employee
 * record shows (the first). Save replaces the whole set
 * (PUT /hr/reporting-hierarchy/:id/managers).
 *
 * The parent remounts this with a `key` of the saved lines, so switching
 * people or saving starts a fresh draft.
 */
export function ManagerEditor({
  person,
  lines,
  people,
  campusName,
  departmentName,
  canEdit,
  onSelect,
  onSaved,
}: {
  person: HierarchyEmployee;
  lines: ReportingLine[];
  people: Map<number, HierarchyEmployee>;
  campusName: (id: number | null) => string;
  departmentName: (id: number | null) => string;
  canEdit: boolean;
  onSelect: (id: number) => void;
  onSaved: () => Promise<void> | void;
}) {
  const saved = useMemo(
    () => managersOf(lines, person.id).filter((id) => people.has(id)),
    [lines, person.id, people],
  );
  const [draft, setDraft] = useState<number[]>(saved);
  const [saving, setSaving] = useState(false);
  const dirty = draft.length !== saved.length || draft.some((id, i) => saved[i] !== id);

  const reports = directReportsOf(lines, person.id)
    .map((id) => people.get(id))
    .filter((p): p is HierarchyEmployee => !!p)
    .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));

  const save = async () => {
    setSaving(true);
    try {
      await hrService.setReportingManagers(person.id, draft);
      toast.success(draft.length ? "Reporting lines saved" : "Reporting lines removed");
      await onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Selected</p>
        <h2 className="mt-1 text-lg font-black text-zinc-900 dark:text-zinc-50">{person.full_name || `#${person.id}`}</h2>
        <p className="text-xs text-zinc-500">
          {[person.job_title, departmentName(person.department_id), campusName(person.campus_id)].filter(Boolean).join(" · ")}
        </p>
      </div>

      <section className="space-y-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
          Reports to <span className="text-zinc-300 dark:text-zinc-600">· {draft.length}</span>
        </h3>
        {draft.length === 0 ? (
          <p className="text-sm text-zinc-500">Nobody yet. Add a manager below, or leave empty for someone at the top.</p>
        ) : (
          <ul className="space-y-1.5">
            {draft.map((id, i) => {
              const m = people.get(id);
              return (
                <li
                  key={id}
                  className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 py-2"
                >
                  <button type="button" onClick={() => onSelect(id)} className="flex-1 min-w-0 text-left">
                    <span className="block text-sm font-semibold text-zinc-800 dark:text-zinc-100 truncate">
                      {m?.full_name || `#${id}`}
                    </span>
                    <span className="block text-[11px] text-zinc-500 truncate">
                      {i === 0 && draft.length > 1 ? "Shown on the employee record · " : ""}
                      {m?.job_title || "—"}
                    </span>
                  </button>
                  {i > 0 && (
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setDraft((d) => [id, ...d.filter((x) => x !== id)])}
                      className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                      title="Move to the top (shown on the employee record)"
                      aria-label={`Move ${m?.full_name ?? "manager"} to the top`}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setDraft((d) => d.filter((x) => x !== id))}
                    className="p-1 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    aria-label={`Remove ${m?.full_name ?? "manager"}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {canEdit && (
        <PersonSearch
          id="add-manager"
          label="Add a manager"
          placeholder="Name, employee code or CNIC"
          people={people}
          problemFor={(m) => (draft.includes(m.id) ? "Already added" : null)}
          onPick={(m) => setDraft((d) => [...d, m.id])}
        />
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!canEdit || !dirty || saving}
          className="h-10 px-5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </button>
        {dirty && !saving && (
          <button
            type="button"
            onClick={() => setDraft(saved)}
            className="h-10 px-3 text-sm font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Discard changes
          </button>
        )}
      </div>

      <section className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
          Direct reports <span className="text-zinc-300 dark:text-zinc-600">· {reports.length}</span>
        </h3>
        {reports.length === 0 ? (
          <p className="text-sm text-zinc-500">Nobody reports to them yet. Select a person and add them as a manager.</p>
        ) : (
          <ul className="max-h-56 overflow-auto space-y-0.5">
            {reports.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelect(r.id)}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 text-sm text-zinc-700 dark:text-zinc-300 truncate"
                >
                  {r.full_name || `#${r.id}`}
                  <span className="ml-1.5 text-[11px] text-zinc-400">{r.job_title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
