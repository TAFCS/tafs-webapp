"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BookMarked,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  UserMinus,
  Users,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCampuses } from "@/store/slices/campusesSlice";
import type { CampusClass } from "@/store/slices/campusesSlice";
import { useAuthState } from "@/context/AuthContext";
import { getAcademicYears, getCurrentAcademicYear } from "@/lib/fee-utils";
import { hrService, EmployeeProfile, TEACHER_CATEGORY_CODES } from "@/lib/hr.service";
import { timetablesService, TimetableSubject } from "@/lib/timetables.service";
import {
  teachingGroupsService,
  TeachingGroup,
  TeachingGroupEnrollment,
} from "@/lib/teaching-groups.service";
import { studentsService, SectionRosterStudent } from "@/lib/students.service";

const ACADEMIC_YEARS = getAcademicYears(1, 2);

export default function TeachingGroupsPage() {
  const dispatch = useAppDispatch();
  const campuses = useAppSelector((s) => s.campuses.items);
  const { user } = useAuthState();

  const canEdit =
    user?.permissions?.includes("hr.timetable.manage") || user?.role === "SUPER_ADMIN";
  const canView =
    canEdit ||
    user?.permissions?.includes("hr.timetable.view") ||
    user?.role === "SUPER_ADMIN";

  const [campusId, setCampusId] = useState(user?.campusId ? String(user.campusId) : "");
  const [classId, setClassId] = useState("");
  const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear());
  const [groups, setGroups] = useState<TeachingGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showNewGroup, setShowNewGroup] = useState(false);

  useEffect(() => {
    dispatch(fetchCampuses());
  }, [dispatch]);

  useEffect(() => {
    if (!campusId && campuses.length > 0) {
      setCampusId(String(user?.campusId ?? campuses[0].id));
    }
  }, [campuses, campusId, user?.campusId]);

  const selectedCampus = campuses.find((c) => String(c.id) === campusId);
  const availableClasses: CampusClass[] = selectedCampus?.offered_classes ?? [];
  const selectedClass = availableClasses.find((c) => String(c.id) === classId);

  useEffect(() => {
    setClassId("");
  }, [campusId]);

  const isScopeReady = Boolean(campusId) && Boolean(classId);

  const loadGroups = useCallback(async () => {
    if (!isScopeReady) return;
    setLoading(true);
    setError(null);
    try {
      const data = await teachingGroupsService.list({
        campus_id: Number(campusId),
        class_id: Number(classId),
        academic_year: academicYear,
      });
      setGroups(data);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Failed to load teaching groups");
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [isScopeReady, campusId, classId, academicYear]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  async function handleRemoveGroup(group: TeachingGroup) {
    if (!confirm(`Remove teaching group "${group.subjects?.name} — ${group.employee_profiles?.full_name}"?`)) {
      return;
    }
    try {
      await teachingGroupsService.remove(group.id);
      await loadGroups();
    } catch (e: any) {
      alert(e?.response?.data?.message || e.message || "Failed to remove teaching group");
    }
  }

  if (!canView) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900 px-4 py-3 text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          You do not have permission to view teaching groups.
        </div>
      </div>
    );
  }

  const selectCls =
    "w-full h-10 pl-3 pr-8 appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2.5">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-600/20 ring-1 ring-rose-200 dark:ring-rose-500/30">
              <BookMarked className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </span>
            Teaching Groups
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1.5 ml-11">
            Subject classes that pull students across home sections (e.g. AS Maths).
            Enroll students here to record their subject combination.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadGroups}
            disabled={!isScopeReady || loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-880/60 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowNewGroup(true)}
              disabled={!isScopeReady}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold disabled:opacity-40 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Teaching Group
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 backdrop-blur-sm p-5 space-y-4 shadow-sm dark:shadow-none">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2">
              Campus <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select value={campusId} onChange={(e) => setCampusId(e.target.value)} className={selectCls}>
                <option value="">Select campus…</option>
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>{c.campus_name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2">
              Class <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                disabled={!campusId}
                className={selectCls}
              >
                <option value="">Select class…</option>
                {availableClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.class_code ? `${c.class_code} — ${c.description}` : c.description}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2">
              Academic Year
            </label>
            <div className="relative">
              <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className={selectCls}>
                {ACADEMIC_YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {!isScopeReady ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 px-6 py-20 text-center">
          <p className="text-sm text-zinc-400 dark:text-zinc-500">Select a campus and class to view teaching groups.</p>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-zinc-500 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-rose-500" />
          <span className="text-sm font-medium">Loading teaching groups…</span>
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 px-6 py-20 text-center">
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            No teaching groups yet for {selectedClass?.description} in {academicYear}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <TeachingGroupCard
              key={group.id}
              group={group}
              academicYear={academicYear}
              classSections={selectedClass?.sections ?? []}
              campusId={Number(campusId)}
              classId={Number(classId)}
              canEdit={!!canEdit}
              expanded={expandedId === group.id}
              onToggle={() => setExpandedId((v) => (v === group.id ? null : group.id))}
              onRemove={() => handleRemoveGroup(group)}
              onRosterChanged={loadGroups}
            />
          ))}
        </div>
      )}

      {showNewGroup && isScopeReady && (
        <NewGroupModal
          campusId={Number(campusId)}
          classId={Number(classId)}
          academicSystem={selectedClass?.academic_system ?? ""}
          academicYear={academicYear}
          onClose={() => setShowNewGroup(false)}
          onCreated={async () => {
            setShowNewGroup(false);
            await loadGroups();
          }}
        />
      )}
    </div>
  );
}

function TeachingGroupCard({
  group,
  academicYear,
  classSections,
  campusId,
  classId,
  canEdit,
  expanded,
  onToggle,
  onRemove,
  onRosterChanged,
}: {
  group: TeachingGroup;
  academicYear: string;
  classSections: { id: number; description: string }[];
  campusId: number;
  classId: number;
  canEdit: boolean;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onRosterChanged: () => void;
}) {
  const [roster, setRoster] = useState<TeachingGroupEnrollment[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [candidates, setCandidates] = useState<SectionRosterStudent[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRoster = useCallback(async () => {
    setLoadingRoster(true);
    try {
      setRoster(await teachingGroupsService.getRoster(group.id));
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Failed to load roster");
    } finally {
      setLoadingRoster(false);
    }
  }, [group.id]);

  useEffect(() => {
    if (expanded) loadRoster();
  }, [expanded, loadRoster]);

  async function loadCandidates() {
    setLoadingCandidates(true);
    setError(null);
    try {
      const perSection = await Promise.all(
        classSections.map((s) =>
          studentsService.listSectionRoster({ campus_id: campusId, class_id: classId, section_id: s.id }),
        ),
      );
      const merged = new Map<number, SectionRosterStudent>();
      perSection.flat().forEach((s) => merged.set(s.cc, s));
      setCandidates(Array.from(merged.values()));
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Failed to load students");
    } finally {
      setLoadingCandidates(false);
    }
  }

  const enrolledIds = useMemo(() => new Set(roster.map((r) => r.student_id)), [roster]);
  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidates.filter((c) => {
      if (enrolledIds.has(c.cc)) return false;
      if (!q) return true;
      return (c.full_name || "").toLowerCase().includes(q) || String(c.gr_number ?? "").includes(q);
    });
  }, [candidates, enrolledIds, search]);

  function toggleSelected(cc: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cc)) next.delete(cc);
      else next.add(cc);
      return next;
    });
  }

  async function handleEnroll() {
    if (selected.size === 0) return;
    setEnrolling(true);
    setError(null);
    try {
      await teachingGroupsService.bulkEnroll(group.id, {
        student_ids: Array.from(selected),
        academic_year: academicYear,
      });
      setSelected(new Set());
      await loadRoster();
      onRosterChanged();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Failed to enroll students");
    } finally {
      setEnrolling(false);
    }
  }

  async function handleRemoveStudent(studentId: number) {
    try {
      await teachingGroupsService.removeEnrollment(group.id, studentId);
      await loadRoster();
      onRosterChanged();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Failed to remove student");
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {group.subjects?.name} — {group.employee_profiles?.full_name}
              {!group.is_active && (
                <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400">(inactive)</span>
              )}
            </p>
            {group.label && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{group.label}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <Users className="w-3.5 h-3.5" />
            {group._count?.student_subject_enrollments ?? 0} enrolled
          </span>
          {canEdit && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 px-5 py-4 space-y-4">
          {error && (
            <p className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2">
              Roster ({roster.length})
            </p>
            {loadingRoster ? (
              <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
            ) : roster.length === 0 ? (
              <p className="text-xs text-zinc-400">No students enrolled yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {roster.map((r) => (
                  <span
                    key={r.id}
                    className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-700 dark:text-zinc-300"
                  >
                    {r.students.full_name}
                    {r.students.sections?.description ? ` (${r.students.sections.description})` : ""}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleRemoveStudent(r.student_id)}
                        className="p-0.5 rounded hover:bg-rose-100 dark:hover:bg-rose-950/40 text-zinc-400 hover:text-rose-600"
                      >
                        <UserMinus className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>

          {canEdit && (
            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/60 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search students by name or GR#…"
                  className="flex-1 h-9 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 px-3 text-sm text-zinc-800 dark:text-zinc-100"
                />
                <button
                  type="button"
                  onClick={loadCandidates}
                  disabled={loadingCandidates}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40"
                >
                  {loadingCandidates ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Load class roster"}
                </button>
              </div>

              {candidates.length > 0 && (
                <div className="max-h-[220px] overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {filteredCandidates.map((c) => (
                    <label
                      key={c.cc}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(c.cc)}
                        onChange={() => toggleSelected(c.cc)}
                      />
                      <span className="text-zinc-800 dark:text-zinc-100">{c.full_name}</span>
                      <span className="text-xs text-zinc-400 ml-auto">GR# {c.gr_number ?? "—"}</span>
                    </label>
                  ))}
                  {filteredCandidates.length === 0 && (
                    <p className="text-xs text-zinc-400 px-3 py-4 text-center">No matching students.</p>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handleEnroll}
                disabled={selected.size === 0 || enrolling}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold disabled:opacity-40 transition-colors"
              >
                {enrolling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Enroll {selected.size > 0 ? `(${selected.size})` : ""}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NewGroupModal({
  campusId,
  classId,
  academicSystem,
  academicYear,
  onClose,
  onCreated,
}: {
  campusId: number;
  classId: number;
  academicSystem: string;
  academicYear: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [subjects, setSubjects] = useState<TimetableSubject[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [label, setLabel] = useState("");
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      timetablesService.listSubjects({ academic_system: academicSystem, active: true }),
      hrService.listEmployees(),
    ])
      .then(([subs, emps]) => {
        if (cancelled) return;
        setSubjects(subs);
        setEmployees(emps);
      })
      .catch((e) => !cancelled && setError(e?.response?.data?.message || e.message))
      .finally(() => !cancelled && setLoadingMeta(false));
    return () => {
      cancelled = true;
    };
  }, [academicSystem]);

  const teachers = useMemo(() => {
    return employees.filter((emp) => {
      if (!emp.staff_categories?.code || !TEACHER_CATEGORY_CODES.has(emp.staff_categories.code)) return false;
      if (!teacherSearch.trim()) return true;
      const q = teacherSearch.trim().toLowerCase();
      return (emp.full_name || emp.users?.full_name || "").toLowerCase().includes(q);
    });
  }, [employees, teacherSearch]);

  async function handleSave() {
    if (!subjectId || !employeeId) {
      setError("Subject and teacher are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await teachingGroupsService.create({
        campus_id: campusId,
        class_id: classId,
        subject_id: Number(subjectId),
        employee_id: Number(employeeId),
        academic_year: academicYear,
        label: label.trim() || undefined,
      });
      onCreated();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Failed to create teaching group");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">New Teaching Group</h2>
        </div>
        <div className="px-5 py-5 space-y-4">
          {loadingMeta ? (
            <Loader2 className="w-5 h-5 animate-spin text-zinc-400 mx-auto" />
          ) : (
            <>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Subject</label>
                <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={inputCls}>
                  <option value="">Select subject…</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Teacher</label>
                <input
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  placeholder="Search teachers…"
                  className={`${inputCls} mb-2`}
                />
                <div className="max-h-[160px] overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {teachers.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setEmployeeId(String(t.id))}
                      className={`w-full text-left px-3 py-2 text-sm ${
                        String(t.id) === employeeId
                          ? "bg-rose-50 dark:bg-rose-600/20 text-rose-700 dark:text-rose-300 font-semibold"
                          : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                      }`}
                    >
                      {t.full_name || t.users?.full_name || `Employee #${t.id}`}
                    </button>
                  ))}
                  {teachers.length === 0 && (
                    <p className="text-xs text-zinc-400 px-3 py-4 text-center">No teachers found.</p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                  Label <span className="text-zinc-400 normal-case font-normal">(optional)</span>
                </label>
                <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls} />
              </div>
            </>
          )}
          {error && <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-100 dark:border-zinc-800">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-500">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loadingMeta}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
