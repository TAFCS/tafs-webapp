"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronDown, Plus, X } from "lucide-react";
import { EmployeeProfile } from "@/lib/hr.service";
import { Campus, OfferedClass, SectionInfo, campusesService } from "@/lib/campuses.service";

export interface ClassSectionRow {
  id: string;
  class_id: number | "";
  section_ids: number[];
}

export function assignmentsToRows(
  assignments: EmployeeProfile["employee_class_section_assignments"],
): ClassSectionRow[] {
  if (!assignments?.length) return [];
  const byClass: Record<number, number[]> = {};
  for (const a of assignments) {
    if (!byClass[a.class_id]) byClass[a.class_id] = [];
    byClass[a.class_id].push(a.section_id);
  }
  return Object.entries(byClass).map(([cid, sids]) => ({
    id: crypto.randomUUID(),
    class_id: Number(cid),
    section_ids: sids,
  }));
}

export function rowsToAssignments(rows: ClassSectionRow[]): { class_id: number; section_id: number }[] {
  const assignments: { class_id: number; section_id: number }[] = [];
  for (const row of rows) {
    if (!row.class_id) continue;
    for (const sid of row.section_ids) {
      assignments.push({ class_id: Number(row.class_id), section_id: sid });
    }
  }
  return assignments;
}

export function useClassAssignmentLookups() {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [allClasses, setAllClasses] = useState<OfferedClass[]>([]);
  const [allSections, setAllSections] = useState<SectionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [campusData, classData, sectionData] = await Promise.all([
          campusesService.list(),
          campusesService.listAllClasses(),
          campusesService.listAllSections(),
        ]);
        if (cancelled) return;
        setCampuses(campusData);
        setAllClasses(classData as unknown as OfferedClass[]);
        setAllSections(sectionData);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { campuses, allClasses, allSections, loading };
}

const selectCls =
  "w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm focus:border-primary transition-colors appearance-none";

interface EditorProps {
  campusId: number | null;
  rows: ClassSectionRow[];
  onRowsChange: (rows: ClassSectionRow[]) => void;
  campuses: Campus[];
  allClasses: OfferedClass[];
  allSections: SectionInfo[];
  showHeader?: boolean;
  compact?: boolean;
}

export function EmployeeClassAssignmentsEditor({
  campusId,
  rows,
  onRowsChange,
  campuses,
  allClasses,
  allSections,
  showHeader = false,
  compact = false,
}: EditorProps) {
  const campusOfferedClasses = useMemo(
    () =>
      campusId != null
        ? (campuses.find((c) => c.id === campusId)?.offered_classes as OfferedClass[] | undefined) ?? []
        : null,
    [campusId, campuses],
  );

  const campusClasses = useMemo(() => {
    if (campusId != null && campusOfferedClasses && campusOfferedClasses.length > 0) {
      const active = campusOfferedClasses.filter((c) => c.is_active);
      if (active.length > 0) return active;
    }
    return allClasses;
  }, [campusId, campusOfferedClasses, allClasses]);

  const campusName = campusId != null
    ? campuses.find((c) => c.id === campusId)?.campus_name
    : null;

  const getSectionsForClass = (classId: number | ""): { id: number; description?: string; name?: string }[] => {
    if (!classId) return [];
    if (campusOfferedClasses && campusOfferedClasses.length > 0) {
      const found = campusOfferedClasses.find((c) => c.id === Number(classId));
      if (found && found.sections && found.sections.length > 0) {
        return found.sections.filter((s) => s.is_active);
      }
    }
    return allSections;
  };

  const addClassRow = () => {
    onRowsChange([...rows, { id: crypto.randomUUID(), class_id: "", section_ids: [] }]);
  };

  const removeClassRow = (id: string) => {
    onRowsChange(rows.filter((r) => r.id !== id));
  };

  const updateClassRow = (id: string, field: "class_id" | "section_ids", value: number | "" | number[]) => {
    onRowsChange(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const toggleSection = (rowId: string, sectionId: number) => {
    onRowsChange(
      rows.map((r) => {
        if (r.id !== rowId) return r;
        const already = r.section_ids.includes(sectionId);
        return {
          ...r,
          section_ids: already ? r.section_ids.filter((s) => s !== sectionId) : [...r.section_ids, sectionId],
        };
      }),
    );
  };

  return (
    <div>
      {showHeader && (
        <div className="flex items-center gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-6">
          <div className="p-2 bg-primary/10 rounded-xl">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">Class–Section Assignments</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {campusName
                ? `Classes offered at ${campusName}`
                : "Assign this employee to specific classes and sections"}
            </p>
          </div>
        </div>
      )}

      {campusId != null ? (
        <div className={`mb-4 flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/15 rounded-xl text-xs text-primary dark:text-primary/80 ${compact ? "text-[11px]" : ""}`}>
          <BookOpen className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            Showing classes offered at <span className="font-semibold">{campusName}</span>.
            {!compact && " Change the employee campus in Employment to filter differently."}
          </span>
        </div>
      ) : (
        <div className={`mb-4 flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-500 ${compact ? "text-[11px]" : ""}`}>
          <BookOpen className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            {compact
              ? "No campus set — all classes are shown. Set campus in Employment to filter."
              : "Select a campus above to filter classes by campus. All classes are shown when no campus is set."}
          </span>
        </div>
      )}

      <div className="space-y-3">
        {rows.length === 0 && (
          <p className="text-sm text-zinc-400 dark:text-zinc-600 italic py-2">
            No class assignments yet. Click &quot;Add Class&quot; below to assign.
          </p>
        )}
        {rows.map((row, idx) => {
          const rowSections = getSectionsForClass(row.class_id);
          return (
            <div
              key={row.id}
              className={`flex flex-col sm:flex-row gap-3 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 ${compact ? "p-3" : ""}`}
            >
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-2.5">
                {idx + 1}
              </div>
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Class</label>
                <div className="relative">
                  <select
                    className={selectCls}
                    value={row.class_id}
                    onChange={(e) => {
                      const newClassId = e.target.value ? Number(e.target.value) : "";
                      updateClassRow(row.id, "class_id", newClassId);
                      updateClassRow(row.id, "section_ids", []);
                    }}
                  >
                    <option value="">-- Select Class --</option>
                    {campusClasses.map((c) => {
                      const label = c.description || (c as any).name || (c as any).class_name || `Class #${c.id}`;
                      const codeStr = c.class_code || (c as any).code ? ` (${c.class_code || (c as any).code})` : "";
                      return (
                        <option key={c.id} value={c.id}>
                          {label}{codeStr}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                </div>
              </div>
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Sections</label>
                <div className="flex flex-wrap gap-1.5 min-h-[44px] p-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                  {!row.class_id ? (
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-600 self-center px-1">Select a class first</span>
                  ) : rowSections.length === 0 ? (
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-600 self-center px-1">No sections available</span>
                  ) : (
                    rowSections.map((sec) => {
                      const selected = row.section_ids.includes(sec.id);
                      const secLabel = sec.description || sec.name || (sec as any).section_name || `Section #${sec.id}`;
                      return (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => toggleSection(row.id, sec.id)}
                          className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-all border ${
                            selected
                              ? "bg-primary text-white border-primary"
                              : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-primary/50"
                          }`}
                        >
                          {secLabel}
                        </button>
                      );
                    })
                  )}
                </div>
                {row.section_ids.length > 0 && (
                  <p className="text-[10px] text-zinc-400">{row.section_ids.length} section(s) selected</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeClassRow(row.id)}
                className="flex-shrink-0 p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all self-start mt-6"
                title="Remove this class row"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={addClassRow}
          className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-semibold text-zinc-500 dark:text-zinc-400 hover:border-primary hover:text-primary transition-all"
        >
          <Plus className="h-4 w-4" />
          Add Class
        </button>
      </div>
    </div>
  );
}

interface ReadProps {
  assignments: EmployeeProfile["employee_class_section_assignments"];
}

export function EmployeeClassAssignmentsRead({ assignments }: ReadProps) {
  const assignmentsByClass = new Map<string, { sections: string[] }>();
  if (assignments) {
    for (const a of assignments) {
      const key = a.classes ? `${a.classes.description} (${a.classes.class_code})` : `Class #${a.class_id}`;
      const sec = a.sections?.description || `Section #${a.section_id}`;
      if (!assignmentsByClass.has(key)) assignmentsByClass.set(key, { sections: [] });
      assignmentsByClass.get(key)!.sections.push(sec);
    }
  }

  if (assignmentsByClass.size === 0) {
    return (
      <div className="text-center py-8">
        <BookOpen className="h-8 w-8 text-zinc-300 mx-auto mb-3" />
        <p className="text-sm font-semibold text-zinc-500">No class or section assignments</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {[...assignmentsByClass.entries()].map(([cls, { sections }]) => (
        <div
          key={cls}
          className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800"
        >
          <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{cls}</span>
          <div className="flex gap-1.5 flex-wrap justify-end">
            {sections.map((s) => (
              <span key={s} className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary">
                {s}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
