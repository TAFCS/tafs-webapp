"use client";

import { useEffect, useState } from "react";
import { Pencil, X, Trash2, Milestone, Loader2 } from "lucide-react";
import {
  hrService,
  EmployeePreviousEmployer,
  EmployeePreviousEmployerPayload,
} from "@/lib/hr.service";

const emptyForm = (): EmployeePreviousEmployerPayload => ({
  employer_name: "",
  location: "",
  job_title: "",
  employed_from: "",
  employed_to: "",
  reason_for_leaving: "",
});

export function EmployeePreviousEmployersSection({
  employeeId,
  initial,
  onChanged,
  canEdit = true,
}: {
  employeeId: number;
  initial?: EmployeePreviousEmployer[];
  onChanged?: () => void;
  /** Mirrors hr.employee_directory#profile.edit — false hides every control. */
  canEdit?: boolean;
}) {
  const [rows, setRows] = useState<EmployeePreviousEmployer[]>(initial ?? []);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EmployeePreviousEmployerPayload | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRows(initial ?? []);
  }, [initial]);

  const handleAdd = async () => {
    if (!form?.employer_name?.trim()) {
      alert("Employer name is required");
      return;
    }
    setSaving(true);
    try {
      const created = await hrService.upsertPreviousEmployer(employeeId, {
        employer_name: form.employer_name.trim(),
        location: form.location?.trim() || null,
        job_title: form.job_title?.trim() || null,
        employed_from: form.employed_from?.trim() || null,
        employed_to: form.employed_to?.trim() || null,
        reason_for_leaving: form.reason_for_leaving?.trim() || null,
      });
      setRows((prev) => [created, ...prev]);
      setForm(null);
      onChanged?.();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to add previous employer");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this previous employer record?")) return;
    try {
      await hrService.deletePreviousEmployer(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      onChanged?.();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to delete previous employer");
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5 relative">
      {canEdit && (
        <div className="absolute top-4 right-4">
          <button
            type="button"
            onClick={() => {
              setEditing((v) => !v);
              setForm(null);
            }}
            className="p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl text-zinc-400"
          >
            {editing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          </button>
        </div>
      )}

      <h3 className="text-[13px] font-extrabold text-zinc-900 dark:text-zinc-100 mb-4 tracking-tight flex items-center gap-2">
        <Milestone className="h-4 w-4 text-indigo-500 shrink-0" />
        Previous Employment
      </h3>
      <p className="text-xs text-zinc-500 mb-4">
        Employers before joining TAFS (manual history — separate from Progression).
      </p>

      {editing && canEdit && (
        <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-700 rounded-xl p-4 mb-4 space-y-3">
          <h4 className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 uppercase">
            Add Previous Employer
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-zinc-400">Employer Name</span>
              <input
                className="w-full h-9 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-[13px] uppercase outline-none"
                value={form?.employer_name || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...(p ?? emptyForm()), employer_name: e.target.value.toUpperCase() }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-zinc-400">Location</span>
              <input
                className="w-full h-9 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-[13px] uppercase outline-none"
                value={form?.location || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...(p ?? emptyForm()), location: e.target.value.toUpperCase() }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-zinc-400">Job Title</span>
              <input
                className="w-full h-9 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-[13px] uppercase outline-none"
                value={form?.job_title || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...(p ?? emptyForm()), job_title: e.target.value.toUpperCase() }))
                }
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-[10px] font-bold uppercase text-zinc-400">From</span>
                <input
                  className="w-full h-9 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-[13px] outline-none"
                  placeholder="2019"
                  value={form?.employed_from || ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...(p ?? emptyForm()), employed_from: e.target.value }))
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold uppercase text-zinc-400">To</span>
                <input
                  className="w-full h-9 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-[13px] outline-none"
                  placeholder="2022"
                  value={form?.employed_to || ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...(p ?? emptyForm()), employed_to: e.target.value }))
                  }
                />
              </label>
            </div>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-[10px] font-bold uppercase text-zinc-400">Reason for Leaving</span>
              <input
                className="w-full h-9 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-[13px] uppercase outline-none"
                value={form?.reason_for_leaving || ""}
                onChange={(e) =>
                  setForm((p) => ({
                    ...(p ?? emptyForm()),
                    reason_for_leaving: e.target.value.toUpperCase(),
                  }))
                }
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-bold disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Add Employer
          </button>
        </div>
      )}

      {rows.length > 0 ? (
        <div className="relative pl-6 border-l border-zinc-100 dark:border-zinc-800 ml-3 space-y-6">
          {rows.map((r) => (
            <div key={r.id} className="relative">
              <div className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 bg-white dark:bg-zinc-900 border-2 border-indigo-600 rounded-full" />
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <h4 className="text-[13px] font-extrabold text-zinc-800 dark:text-zinc-200 uppercase truncate">
                    {r.employer_name || "—"}
                  </h4>
                  <p className="text-[12px] text-zinc-500 font-semibold uppercase">
                    {r.location || "Location N/A"}
                    {r.job_title ? ` · ${r.job_title}` : ""}
                  </p>
                  <p className="text-[11px] text-zinc-400 font-semibold uppercase">
                    {r.employed_from || "?"} – {r.employed_to || "?"}
                    {r.reason_for_leaving ? ` · Reason: ${r.reason_for_leaving}` : ""}
                  </p>
                </div>
                {editing && canEdit && (
                  <button
                    type="button"
                    onClick={() => handleDelete(r.id)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="italic text-zinc-400 text-center py-4 text-sm">
          No previous employment history logged.
        </p>
      )}
    </div>
  );
}
