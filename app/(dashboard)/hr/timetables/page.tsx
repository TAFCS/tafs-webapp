"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarRange,
  Loader2,
  RefreshCw,
  MapPin,
  GraduationCap,
  ChevronDown,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCampuses } from "@/store/slices/campusesSlice";
import { useAuthState } from "@/context/AuthContext";
import { getAcademicYears, getCurrentAcademicYear } from "@/lib/fee-utils";
import {
  TimetableBlock,
  TimetableSlot,
  UpsertSlotPayload,
  timetablesService,
} from "@/lib/timetables.service";
import { teachingGroupsService, TeachingGroup } from "@/lib/teaching-groups.service";
import { DAYS, TimetableGrid, blockDisplayLabel } from "./_components/TimetableGrid";
import { SlotEditorModal, SlotEditorTarget } from "./_components/SlotEditorModal";
import { PeriodEditor } from "./_components/PeriodEditor";
import { isAsA2Class } from "@/lib/alevel-classes";
import type { CampusClass } from "@/store/slices/campusesSlice";

const ACADEMIC_YEARS = getAcademicYears(1, 2);

export default function TimetablesPage() {
  const dispatch = useAppDispatch();
  const campuses = useAppSelector((s) => s.campuses.items);
  const { user } = useAuthState();

  const canEdit =
    user?.permissions?.includes("hr.timetable.manage") ||
    user?.role === "SUPER_ADMIN";
  const canView =
    canEdit ||
    user?.permissions?.includes("hr.timetable.view") ||
    user?.role === "SUPER_ADMIN";

  const [campusId, setCampusId] = useState(user?.campusId ? String(user.campusId) : "");
  const [classId, setClassId] = useState("");
  const [teachingGroupId, setTeachingGroupId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [groups, setGroups] = useState<TeachingGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear());
  const [blocks, setBlocks] = useState<TimetableBlock[]>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [timetableId, setTimetableId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<SlotEditorTarget | null>(null);

  useEffect(() => {
    dispatch(fetchCampuses());
  }, [dispatch]);

  useEffect(() => {
    if (!campusId && campuses.length > 0) {
      setCampusId(String(user?.campusId ?? campuses[0].id));
    }
  }, [campuses, campusId, user?.campusId]);

  // Only AS/A2 (A-Level) classes use the cross-section Teaching Group model.
  // Every other class/segment (O-Level, other classes, sports staff, etc.)
  // schedules directly against its own campus+class+section timetable —
  // no Teaching Group container required.
  const selectedCampus = campuses.find((c) => String(c.id) === campusId);
  const availableClasses: CampusClass[] = selectedCampus?.offered_classes ?? [];
  const selectedClass = availableClasses.find((c) => String(c.id) === classId);
  const isALevel = selectedClass ? isAsA2Class(selectedClass) : false;
  const selectedGroup = groups.find((g) => String(g.id) === teachingGroupId);
  const availableSections = selectedClass?.sections?.filter((s) => s.is_active) ?? [];

  // Reset teaching group/section when class changes
  useEffect(() => {
    setTeachingGroupId("");
    setSectionId("");
  }, [classId]);

  // Reset class/group/section when campus changes
  useEffect(() => {
    setClassId("");
    setTeachingGroupId("");
    setSectionId("");
  }, [campusId]);

  useEffect(() => {
    if (!isALevel || !campusId || !classId) {
      setGroups([]);
      return;
    }
    let cancelled = false;
    setGroupsLoading(true);
    teachingGroupsService
      .list({ campus_id: Number(campusId), class_id: Number(classId), academic_year: academicYear })
      .then((data) => {
        if (!cancelled) setGroups(data.filter((g) => g.is_active));
      })
      .catch(() => !cancelled && setGroups([]))
      .finally(() => !cancelled && setGroupsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isALevel, campusId, classId, academicYear]);

  const isScopeReady =
    Boolean(campusId) &&
    Boolean(classId) &&
    (isALevel ? Boolean(teachingGroupId) : Boolean(sectionId));

  const loadGrid = useCallback(async () => {
    if (!isScopeReady) return;
    setLoading(true);
    setError(null);
    try {
      const grid = isALevel
        ? await timetablesService.getGridByGroup({
            teaching_group_id: Number(teachingGroupId),
            academic_year: academicYear,
          })
        : await timetablesService.getGrid({
            campus_id: Number(campusId),
            class_id: Number(classId),
            section_id: Number(sectionId),
            academic_year: academicYear,
          });
      setBlocks(grid.blocks);
      setSlots(grid.slots);
      setTimetableId(grid.timetable?.id ?? null);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Failed to load timetable");
      setBlocks([]);
      setSlots([]);
      setTimetableId(null);
    } finally {
      setLoading(false);
    }
  }, [isScopeReady, isALevel, campusId, classId, teachingGroupId, sectionId, academicYear]);

  useEffect(() => {
    loadGrid();
  }, [loadGrid]);

  async function ensureTimetableId(): Promise<number> {
    if (timetableId) return timetableId;
    const tt = isALevel
      ? await timetablesService.getOrCreateByGroup({
          teaching_group_id: Number(teachingGroupId),
          academic_year: academicYear,
        })
      : await timetablesService.getOrCreate({
          campus_id: Number(campusId),
          class_id: Number(classId),
          section_id: Number(sectionId),
          academic_year: academicYear,
        });
    setTimetableId(tt.id);
    return tt.id;
  }

  async function handleSave(payload: UpsertSlotPayload) {
    const id = await ensureTimetableId();
    await timetablesService.upsertSlot(id, payload);
    await loadGrid();
  }

  async function handleDelete(slotId: number) {
    await timetablesService.deleteSlot(slotId);
    await loadGrid();
  }

  function openAdd(dayOfWeek: number, blockNumber: number, slotOrder: number) {
    setEditor({ day_of_week: dayOfWeek, block_number: blockNumber, slot_order: slotOrder });
  }

  function openEdit(slot: TimetableSlot) {
    setEditor({
      day_of_week: slot.day_of_week,
      block_number: slot.block_number,
      slot_order: slot.slot_order,
      existing: {
        id: slot.id,
        subject_id: slot.subject_id,
        employee_id: slot.employee_id,
        room: slot.room,
      },
    });
  }

  const editorDayLabel = editor
    ? DAYS.find((d) => d.dow === editor.day_of_week)?.label ?? `Day ${editor.day_of_week}`
    : "";
  const editorBlock = editor
    ? blocks.find((b) => b.block_number === editor.block_number)
    : undefined;
  const editorBlockLabel = editorBlock
    ? blockDisplayLabel(editorBlock)
    : editor
      ? `Block ${editor.block_number}`
      : "";

  const selectCls =
    "w-full h-10 pl-3 pr-8 appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

  if (!canView) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900 px-4 py-3 text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          You do not have permission to view timetables.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2.5">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-600/20 ring-1 ring-rose-200 dark:ring-rose-500/30">
              <CalendarRange className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </span>
            Timetables
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1.5 ml-11">
            {isALevel
              ? "Weekly schedule for a teaching group (subject + teacher). Edits apply going forward."
              : "Weekly schedule for a class/section. Pick any subject + teacher per slot. Edits apply going forward."}
          </p>
        </div>
        <button
          type="button"
          onClick={loadGrid}
          disabled={!isScopeReady || loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-880/60 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-40 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Scope Card */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 backdrop-blur-sm p-5 space-y-4 shadow-sm dark:shadow-none">
        {/* Campus · Class · Teaching Group/Section · Academic Year */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Campus */}
          <div>
            <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2">
              <MapPin className="w-3 h-3" />
              Campus <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                value={campusId}
                onChange={(e) => {
                  setCampusId(e.target.value);
                  setTimetableId(null);
                }}
                className={selectCls}
              >
                <option value="" className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">Select campus…</option>
                {campuses.map((c) => (
                  <option key={c.id} value={c.id} className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">
                    {c.campus_name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
            </div>
          </div>

          {/* Class */}
          <div>
            <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2">
              <GraduationCap className="w-3 h-3" />
              Class <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setTimetableId(null);
                }}
                disabled={!campusId || availableClasses.length === 0}
                className={selectCls}
              >
                <option value="" className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">Select class…</option>
                {availableClasses.map((c) => (
                  <option key={c.id} value={c.id} className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">
                    {c.class_code ? `${c.class_code} — ${c.description}` : c.description}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
            </div>
          </div>

          {/* Teaching Group (A-Level only) / Section (everyone else) */}
          {isALevel ? (
            <div>
              <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2">
                Teaching Group <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={teachingGroupId}
                  onChange={(e) => {
                    setTeachingGroupId(e.target.value);
                    setTimetableId(null);
                  }}
                  disabled={!classId || groupsLoading}
                  className={selectCls}
                >
                  <option value="" className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">
                    {groupsLoading ? "Loading…" : "Select teaching group…"}
                  </option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id} className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">
                      {g.subjects?.name} — {g.employee_profiles?.full_name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
              </div>
              {classId && !groupsLoading && groups.length === 0 && (
                <p className="text-xs text-zinc-400 mt-1.5">
                  No teaching groups yet — create one under Teaching Groups first.
                </p>
              )}
            </div>
          ) : (
            <div>
              <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2">
                Section <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={sectionId}
                  onChange={(e) => {
                    setSectionId(e.target.value);
                    setTimetableId(null);
                  }}
                  disabled={!classId}
                  className={selectCls}
                >
                  <option value="" className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">
                    Select section…
                  </option>
                  {availableSections.map((s) => (
                    <option key={s.id} value={s.id} className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">
                      {s.description}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
              </div>
              {classId && availableSections.length === 0 && (
                <p className="text-xs text-zinc-400 mt-1.5">No sections offered for this class at this campus.</p>
              )}
            </div>
          )}

          {/* Academic Year */}
          <div>
            <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2">
              Academic Year
            </label>
            <div className="relative">
              <select
                value={academicYear}
                onChange={(e) => {
                  setAcademicYear(e.target.value);
                  setTimetableId(null);
                }}
                className={selectCls}
              >
                {ACADEMIC_YEARS.map((y) => (
                  <option key={y} value={y} className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">
                    {y}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {campusId && classId && (
        <PeriodEditor campusId={Number(campusId)} classId={Number(classId)} canEdit={!!canEdit} />
      )}

      {!canEdit && (
        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl px-4 py-2.5">
          Read-only — you can view the timetable but not edit slots.
        </p>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {!isScopeReady ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 px-6 py-20 text-center">
          <div className="flex flex-col items-center gap-3">
            <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
              <CalendarRange className="w-6 h-6 text-zinc-400 dark:text-zinc-500" />
            </span>
            <p className="text-sm text-zinc-400 dark:text-zinc-500">
              {isALevel
                ? "Select a class and teaching group to view its timetable."
                : "Select a class and section to view its timetable."}
            </p>
          </div>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-zinc-500 dark:text-zinc-400 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-rose-500" />
          <span className="text-sm font-medium">Loading timetable…</span>
        </div>
      ) : (
        <TimetableGrid
          blocks={blocks}
          slots={slots}
          canEdit={!!canEdit}
          onAdd={openAdd}
          onEdit={openEdit}
        />
      )}

      <SlotEditorModal
        open={!!editor}
        target={editor}
        campusId={campusId ? Number(campusId) : null}
        dayLabel={editorDayLabel}
        blockLabel={editorBlockLabel}
        academicSystem={selectedClass?.academic_system}
        lockedGroup={
          isALevel && selectedGroup && selectedGroup.subjects && selectedGroup.employee_profiles
            ? {
                subjectId: selectedGroup.subjects.id,
                subjectName: selectedGroup.subjects.name,
                employeeId: selectedGroup.employee_profiles.id,
                employeeName: selectedGroup.employee_profiles.full_name ?? `Employee #${selectedGroup.employee_profiles.id}`,
              }
            : undefined
        }
        onClose={() => setEditor(null)}
        onSave={handleSave}
        onDelete={canEdit ? handleDelete : undefined}
      />
    </div>
  );
}
