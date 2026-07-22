"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, X, BookOpen, User, DoorOpen, ChevronDown } from "lucide-react";
import { hrService, EmployeeProfile, TEACHER_CATEGORY_CODES } from "@/lib/hr.service";
import {
  TimetableSubject,
  UpsertSlotPayload,
  timetablesService,
} from "@/lib/timetables.service";

const TEACHER_CATEGORIES = TEACHER_CATEGORY_CODES;

export interface SlotEditorTarget {
  day_of_week: number;
  block_number: number;
  slot_order: number;
  existing?: {
    id: number;
    subject_id: number;
    employee_id: number;
    room: string | null;
  };
}

interface Props {
  open: boolean;
  target: SlotEditorTarget | null;
  campusId: number | null;
  dayLabel: string;
  blockLabel: string;
  onClose: () => void;
  onSave: (payload: UpsertSlotPayload) => Promise<void>;
  onDelete?: (slotId: number) => Promise<void>;
}

export function SlotEditorModal({
  open,
  target,
  campusId,
  dayLabel,
  blockLabel,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [subjects, setSubjects] = useState<TimetableSubject[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [room, setRoom] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewSubject, setShowNewSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectCode, setNewSubjectCode] = useState("");
  const [creatingSubject, setCreatingSubject] = useState(false);

  useEffect(() => {
    if (!open || !target) return;
    setSubjectId(target.existing ? String(target.existing.subject_id) : "");
    setEmployeeId(target.existing ? String(target.existing.employee_id) : "");
    setRoom(target.existing?.room ?? "");
    setTeacherSearch("");
    setError(null);
    setShowNewSubject(false);
    setNewSubjectName("");
    setNewSubjectCode("");

    let cancelled = false;
    setLoadingMeta(true);
    Promise.all([
      timetablesService.listSubjects({ academic_system: "A-Level", active: true }),
      hrService.listEmployees(),
    ])
      .then(([subs, emps]) => {
        if (cancelled) return;
        setSubjects(subs);
        setEmployees(emps);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.response?.data?.message || e.message || "Failed to load options");
      })
      .finally(() => {
        if (!cancelled) setLoadingMeta(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, target]);

  const teachers = useMemo(() => {
    return employees.filter((emp) => {
      if (!emp.staff_categories?.code || !TEACHER_CATEGORIES.has(emp.staff_categories.code)) return false;
      if (campusId && emp.campus_id && emp.campus_id !== campusId) return false;
      if (!teacherSearch.trim()) return true;
      const q = teacherSearch.trim().toLowerCase();
      const name = (emp.full_name || emp.users?.full_name || "").toLowerCase();
      const code = (emp.employee_code || "").toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [employees, campusId, teacherSearch]);

  if (!open || !target) return null;

  async function handleCreateSubject() {
    if (!newSubjectName.trim()) return;
    setCreatingSubject(true);
    setError(null);
    try {
      const created = await timetablesService.createSubject({
        name: newSubjectName.trim(),
        code: newSubjectCode.trim() || undefined,
        academic_system: "A-Level",
      });
      setSubjects((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSubjectId(String(created.id));
      setShowNewSubject(false);
      setNewSubjectName("");
      setNewSubjectCode("");
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Failed to create subject");
    } finally {
      setCreatingSubject(false);
    }
  }

  async function handleSave() {
    if (!subjectId || !employeeId) {
      setError("Subject and teacher are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        day_of_week: target!.day_of_week,
        block_number: target!.block_number,
        slot_order: target!.slot_order,
        subject_id: Number(subjectId),
        employee_id: Number(employeeId),
        room: room.trim() || undefined,
      });
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Failed to save slot");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!target?.existing || !onDelete) return;
    if (!confirm(target.slot_order === 1
      ? "Delete this slot? Any split in the same block will also be removed."
      : "Delete this split slot?")) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onDelete(target.existing.id);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Failed to delete slot");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20 transition-all";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/80">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
              {target.existing ? "Edit Slot" : target.slot_order === 2 ? "Add Split" : "Add Slot"}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {dayLabel} · {blockLabel}
              {target.slot_order === 2 ? " · concurrent split" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-450 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-5">
          {loadingMeta ? (
            <div className="flex items-center justify-center py-10 text-zinc-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading…
            </div>
          ) : (
            <>
              {/* Subject */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                    <BookOpen className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                    Subject
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowNewSubject((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-500 dark:hover:text-rose-350 transition-colors font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New subject
                  </button>
                </div>

                {showNewSubject && (
                  <div className="mb-3 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/80 space-y-2.5">
                    <input
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                      placeholder="Subject name"
                      className={inputCls}
                    />
                    <input
                      value={newSubjectCode}
                      onChange={(e) => setNewSubjectCode(e.target.value)}
                      placeholder="Code (optional)"
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={handleCreateSubject}
                      disabled={creatingSubject || !newSubjectName.trim()}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50 transition-colors"
                    >
                      {creatingSubject ? "Creating…" : "Create Subject"}
                    </button>
                  </div>
                )}

                <div className="relative">
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className={`${inputCls} appearance-none cursor-pointer pr-10`}
                  >
                    <option value="" className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">Select subject…</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id} className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">
                        {s.name}{s.code ? ` (${s.code})` : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
                </div>
              </div>

              {/* Teacher */}
              <div>
                <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2">
                  <User className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                  Teacher
                </label>
                <input
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  placeholder="Search teachers…"
                  className={`${inputCls} mb-2.5`}
                />
                <div className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 overflow-hidden">
                  <div className="max-h-[160px] overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {teachers.map((t) => {
                      const isSelected = String(t.id) === employeeId;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setEmployeeId(String(t.id))}
                          className={`w-full text-left px-3.5 py-2.5 text-sm transition-all flex items-center justify-between ${
                            isSelected
                              ? "bg-rose-50 dark:bg-rose-600/20 text-rose-700 dark:text-rose-300 font-semibold"
                              : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                          }`}
                        >
                          <span>{t.full_name || t.users?.full_name || `Employee #${t.id}`}</span>
                          {t.employee_code && (
                            <span className={`text-xs tabular-nums ${isSelected ? "text-rose-600 dark:text-rose-400/80" : "text-zinc-400 dark:text-zinc-500"}`}>
                              {t.employee_code}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {teachers.length === 0 && (
                      <div className="text-xs text-zinc-500 py-6 text-center">
                        No teachers match this campus/search.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Room */}
              <div>
                <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2">
                  <DoorOpen className="w-3.5 h-3.5 text-zinc-550 dark:text-zinc-400" />
                  Room <span className="text-zinc-400 dark:text-zinc-600 normal-case tracking-normal font-normal ml-1">(optional)</span>
                </label>
                <input
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="e.g. Lab 2"
                  className={inputCls}
                />
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-rose-700 dark:text-rose-400 bg-rose-55 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 rounded-xl px-3 py-2.5">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/60">
          <div>
            {target.existing && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-sm text-rose-650 hover:text-rose-500 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-450 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loadingMeta}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
