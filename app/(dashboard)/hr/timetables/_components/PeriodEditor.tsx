"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Clock, Loader2, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { ClassPeriod, timetablesService } from "@/lib/timetables.service";

interface Props {
  campusId: number;
  classId: number;
  canEdit: boolean;
}

interface DraftPeriod {
  id: number | null; // null = not yet saved
  block_number: string;
  start_time: string;
  end_time: string;
  is_break: boolean;
  label: string;
  saving?: boolean;
}

function toHHMM(iso: string): string {
  return new Date(iso).toISOString().slice(11, 16);
}

function toDraft(p: ClassPeriod): DraftPeriod {
  return {
    id: p.id,
    block_number: String(p.block_number),
    start_time: toHHMM(p.start_time),
    end_time: toHHMM(p.end_time),
    is_break: p.is_break,
    label: p.label ?? "",
  };
}

function blankDraft(nextBlockNumber: number): DraftPeriod {
  return {
    id: null,
    block_number: String(nextBlockNumber),
    start_time: "",
    end_time: "",
    is_break: false,
    label: "",
  };
}

export function PeriodEditor({ campusId, classId, canEdit }: Props) {
  const [periods, setPeriods] = useState<ClassPeriod[]>([]);
  const [drafts, setDrafts] = useState<DraftPeriod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await timetablesService.listPeriods({ campus_id: campusId, class_id: classId });
      setPeriods(data);
      setDrafts(data.map(toDraft));
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Failed to load periods");
    } finally {
      setLoading(false);
    }
  }, [campusId, classId]);

  useEffect(() => {
    load();
  }, [load]);

  function updateDraft(index: number, patch: Partial<DraftPeriod>) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function addRow() {
    const maxBlock = drafts.reduce((max, d) => Math.max(max, Number(d.block_number) || 0), 0);
    setDrafts((prev) => [...prev, blankDraft(maxBlock + 1)]);
  }

  async function saveRow(index: number) {
    const draft = drafts[index];
    const blockNumber = Number(draft.block_number);
    if (!blockNumber || !draft.start_time || !draft.end_time) {
      setError("Block #, start time, and end time are required");
      return;
    }
    setError(null);
    updateDraft(index, { saving: true });
    try {
      await timetablesService.upsertPeriod({
        campus_id: campusId,
        class_id: classId,
        block_number: blockNumber,
        start_time: draft.start_time,
        end_time: draft.end_time,
        is_break: draft.is_break,
        label: draft.label.trim() || undefined,
      });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Failed to save period");
      updateDraft(index, { saving: false });
    }
  }

  async function deleteRow(index: number) {
    const draft = drafts[index];
    if (draft.id == null) {
      setDrafts((prev) => prev.filter((_, i) => i !== index));
      return;
    }
    if (!confirm(`Delete period ${draft.block_number}?`)) return;
    setError(null);
    try {
      await timetablesService.deletePeriod(draft.id);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Failed to delete period");
    }
  }

  const inputCls =
    "w-full h-8 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 px-2 text-xs text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20";

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 backdrop-blur-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-5 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          <Clock className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
          Bell Schedule for this class
          {!loading && (
            <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">
              ({periods.length} period{periods.length === 1 ? "" : "s"})
            </span>
          )}
        </span>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-zinc-400" />
        ) : (
          <ChevronUp className="w-4 h-4 text-zinc-400" />
        )}
      </button>

      {!collapsed && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 px-5 py-4 space-y-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Sets this class&apos;s own period start/end times and break windows — different classes can run
            different period lengths. These times also drive timetable-derived check-in/payroll for any
            staff scheduled into this class.
          </p>

          {error && (
            <p className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </p>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-6 text-zinc-400">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                    <th className="text-left pb-2 pr-2 w-16">Block #</th>
                    <th className="text-left pb-2 pr-2 w-24">Start</th>
                    <th className="text-left pb-2 pr-2 w-24">End</th>
                    <th className="text-left pb-2 pr-2 w-16">Break?</th>
                    <th className="text-left pb-2 pr-2">Label</th>
                    {canEdit && <th className="pb-2 w-20" />}
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((draft, i) => (
                    <tr key={draft.id ?? `new-${i}`} className="border-t border-zinc-100 dark:border-zinc-800/60">
                      <td className="py-1.5 pr-2">
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={draft.block_number}
                          onChange={(e) => updateDraft(i, { block_number: e.target.value })}
                          disabled={!canEdit}
                          className={inputCls}
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input
                          type="time"
                          value={draft.start_time}
                          onChange={(e) => updateDraft(i, { start_time: e.target.value })}
                          disabled={!canEdit}
                          className={inputCls}
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input
                          type="time"
                          value={draft.end_time}
                          onChange={(e) => updateDraft(i, { end_time: e.target.value })}
                          disabled={!canEdit}
                          className={inputCls}
                        />
                      </td>
                      <td className="py-1.5 pr-2 text-center">
                        <input
                          type="checkbox"
                          checked={draft.is_break}
                          onChange={(e) => updateDraft(i, { is_break: e.target.checked })}
                          disabled={!canEdit}
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input
                          value={draft.label}
                          onChange={(e) => updateDraft(i, { label: e.target.value })}
                          placeholder={draft.is_break ? "BREAK" : "optional"}
                          disabled={!canEdit}
                          className={inputCls}
                        />
                      </td>
                      {canEdit && (
                        <td className="py-1.5 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => saveRow(i)}
                            disabled={draft.saving}
                            className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold disabled:opacity-50"
                          >
                            {draft.saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRow(i)}
                            className="p-1 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {drafts.length === 0 && (
                <p className="text-xs text-zinc-400 py-3">
                  No periods defined yet for this class{canEdit ? " — add one below." : "."}
                </p>
              )}

              {canEdit && (
                <button
                  type="button"
                  onClick={addRow}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-500"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add period
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
