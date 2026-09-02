"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { DAYS, TimetableGrid, blockDisplayLabel, type MakeupCalendarMode } from "./_components/TimetableGrid";
import { SlotEditorModal, SlotEditorTarget } from "./_components/SlotEditorModal";
import { PeriodEditor } from "./_components/PeriodEditor";
import { isAsA2Class } from "@/lib/alevel-classes";
import { isOLevelClass } from "@/lib/olevel-classes";
import type { CampusClass } from "@/store/slices/campusesSlice";
import {
  TimetableModeToggle,
  type TimetablePageMode,
} from "./_components/TimetableModeToggle";
import { MakeupReschedulePanel } from "./_components/MakeupReschedulePanel";
import { useMakeupCalendarStatus } from "./_components/useMakeupCalendarStatus";
import { classReschedulesService } from "@/lib/class-reschedules.service";
import {
  cellStatusKey,
  blockCellStatusKey,
  clampWeekMonday,
  getMondayUtc,
  todayIsoUtc,
  type MakeupSlotCellStatus,
  type RescheduleLinkInfo,
} from "@/lib/makeup-calendar";

const ACADEMIC_YEARS = getAcademicYears(1, 2);

function navigateCalendarWeek(mondayIso: string, academicYear: string): string {
  return clampWeekMonday(mondayIso, academicYear);
}

function resolveCellStatus(
  statusByCell: Record<string, MakeupSlotCellStatus>,
  slot: TimetableSlot,
  dateIso: string,
  rescheduleLink?: RescheduleLinkInfo,
): MakeupSlotCellStatus {
  const key = cellStatusKey(slot.id, dateIso);
  const blockKey = blockCellStatusKey(slot.block_number, dateIso);
  const status = statusByCell[key] ?? statusByCell[blockKey] ?? "missed";
  if (rescheduleLink?.role === "makeup" && status === "missed") {
    return "makeup_upcoming";
  }
  return status;
}

function initialWeekMonday(academicYear: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return clampWeekMonday(getMondayUtc(today), academicYear);
}

function TimetablesPageContent() {
  const dispatch = useAppDispatch();
  const campuses = useAppSelector((s) => s.campuses.items);
  const { user } = useAuthState();
  const searchParams = useSearchParams();

  const canEdit =
    user?.permissions?.includes("hr.timetable.manage") ||
    user?.role === "SUPER_ADMIN";
  const canView =
    canEdit ||
    user?.permissions?.includes("hr.timetable.view") ||
    user?.role === "SUPER_ADMIN";
  const canMarkStaff =
    user?.permissions?.includes("attendance.staff.mark") ||
    user?.role === "SUPER_ADMIN";
  const canMarkRoll =
    user?.permissions?.includes("attendance.student.rollcall.mark") ||
    user?.role === "SUPER_ADMIN";
  const canViewRoll =
    canMarkRoll ||
    user?.permissions?.includes("attendance.student.rollcall.view") ||
    user?.role === "SUPER_ADMIN";
  const canEditLocked =
    user?.role === "SUPER_ADMIN" ||
    (user?.permissions ?? []).includes("attendance.student.edit_locked");

  const [pageMode, setPageMode] = useState<TimetablePageMode>("schedule");
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
  const [effectiveFrom, setEffectiveFrom] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<SlotEditorTarget | null>(null);
  const [makeupSlot, setMakeupSlot] = useState<TimetableSlot | null>(null);
  const [olevelPendingSlotIds, setOlevelPendingSlotIds] = useState<number[]>([]);
  const [alevelSelectedSources, setAlevelSelectedSources] = useState<
    Array<{ slotId: number; sourceDate: string }>
  >([]);
  const [activeWeekDate, setActiveWeekDate] = useState(() =>
    initialWeekMonday(getCurrentAcademicYear()),
  );
  const [attendanceTarget, setAttendanceTarget] = useState<{
    slot: TimetableSlot;
    dateIso: string;
    cellStatus: MakeupSlotCellStatus;
    rescheduleLink?: RescheduleLinkInfo;
  } | null>(null);
  const [makeupSlotDate, setMakeupSlotDate] = useState("");
  const [makeupTarget, setMakeupTarget] = useState<{
    slotId: number | null;
    dateIso: string;
    blockNumber: number;
  } | null>(null);
  const [makeupDate, setMakeupDate] = useState(() => todayIsoUtc());
  const [makeupBlockNumber, setMakeupBlockNumber] = useState<number | null>(null);
  const [deletingMakeup, setDeletingMakeup] = useState(false);
  const [makeupCalendarMode, setMakeupCalendarMode] = useState<MakeupCalendarMode>("schedule");

  // URL deep-link prefill
  useEffect(() => {
    const mode = searchParams.get("mode");
    if (mode === "makeup") setPageMode("makeup");
    const qpCampus = searchParams.get("campus_id");
    const qpClass = searchParams.get("class_id");
    const qpSection = searchParams.get("section_id");
    const qpGroup = searchParams.get("teaching_group_id");
    if (qpCampus) setCampusId(qpCampus);
    if (qpClass) setClassId(qpClass);
    if (qpSection) setSectionId(qpSection);
    if (qpGroup) setTeachingGroupId(qpGroup);
  }, [searchParams]);

  useEffect(() => {
    if (pageMode === "makeup") {
      setMakeupCalendarMode("schedule");
      setAttendanceTarget(null);
    }
  }, [pageMode]);

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
  const isALevel = selectedClass ? isAsA2Class(selectedClass) : false;
  const isOLevel = classId ? isOLevelClass(Number(classId)) : false;
  const supportsMakeup = isALevel || isOLevel;
  const selectedGroup = groups.find((g) => String(g.id) === teachingGroupId);
  const availableSections = selectedClass?.sections?.filter((s) => s.is_active) ?? [];

  const showMakeupTab =
    supportsMakeup &&
    (isOLevel ? canMarkStaff : canViewRoll);

  useEffect(() => {
    setTeachingGroupId("");
    setSectionId("");
    setMakeupSlot(null);
    setAlevelSelectedSources([]);
  }, [classId]);

  useEffect(() => {
    setClassId("");
    setTeachingGroupId("");
    setSectionId("");
    setMakeupSlot(null);
    setAlevelSelectedSources([]);
  }, [campusId]);

  useEffect(() => {
    if (!showMakeupTab && pageMode === "makeup") {
      setPageMode("schedule");
    }
  }, [showMakeupTab, pageMode]);

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
      setEffectiveFrom(grid.timetable?.effective_from ?? null);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Failed to load timetable");
      setBlocks([]);
      setSlots([]);
      setTimetableId(null);
      setEffectiveFrom(null);
    } finally {
      setLoading(false);
    }
  }, [isScopeReady, isALevel, campusId, classId, teachingGroupId, sectionId, academicYear]);

  useEffect(() => {
    loadGrid();
  }, [loadGrid]);

  const slotIds = useMemo(() => slots.map((s) => s.id), [slots]);

  const {
    statusByCell,
    presentByCell,
    makeupOverlays,
    rescheduleLinksByCell,
    loading: statusLoading,
    weekRefreshing: statusWeekRefreshing,
    error: statusError,
    refresh: refreshCalendarStatus,
  } = useMakeupCalendarStatus({
    teachingGroupId: isALevel && teachingGroupId ? Number(teachingGroupId) : null,
    slotIds,
    slots,
    weekMondayIso: activeWeekDate,
    enabled: pageMode === "makeup" && isALevel && isScopeReady,
  });

  useEffect(() => {
    setActiveWeekDate((prev) => clampWeekMonday(prev, academicYear));
  }, [academicYear]);

  useEffect(() => {
    if (!attendanceTarget) return;
    const key = cellStatusKey(attendanceTarget.slot.id, attendanceTarget.dateIso);
    const updated = statusByCell[key];
    if (updated && updated !== attendanceTarget.cellStatus) {
      setAttendanceTarget((prev) =>
        prev ? { ...prev, cellStatus: updated } : null,
      );
    }
  }, [statusByCell, attendanceTarget]);

  const clearMakeupSelection = useCallback(() => {
    setAttendanceTarget(null);
    setMakeupTarget(null);
  }, []);

  const handleDeleteMakeup = useCallback(
    async (target?: { dateIso: string; blockNumber: number }) => {
      const dateIso = target?.dateIso ?? attendanceTarget?.dateIso;
      const period = target?.blockNumber ?? attendanceTarget?.slot.block_number;
      if (!dateIso || period == null || !canMarkRoll || !teachingGroupId) {
        return;
      }
      if (
        !window.confirm(
          "Cancel this makeup class? The missed lesson(s) will show as not conducted again on the calendar.",
        )
      ) {
        return;
      }
      setDeletingMakeup(true);
      try {
        const rows = await classReschedulesService.list({
          teaching_group_id: Number(teachingGroupId),
          status: "SCHEDULED",
        });
        const bundle = rows.filter(
          (row) =>
            row.makeup_date.slice(0, 10) === dateIso && row.makeup_period === period,
        );
        if (bundle.length === 0) return;
        for (const row of bundle) {
          await classReschedulesService.cancel(row.id);
        }
        clearMakeupSelection();
        void refreshCalendarStatus();
      } catch {
        // keep selection so user can retry
      } finally {
        setDeletingMakeup(false);
      }
    },
    [
      attendanceTarget,
      canMarkRoll,
      teachingGroupId,
      clearMakeupSelection,
      refreshCalendarStatus,
    ],
  );

  const canDeleteSelectedMakeup = canMarkRoll;

  const handleActiveWeekDateChange = useCallback(
    (mondayIso: string) => {
      setActiveWeekDate(navigateCalendarWeek(mondayIso, academicYear));
    },
    [academicYear],
  );

  const toggleSourcePick = useCallback((slotId: number, sourceDate: string) => {
    setAlevelSelectedSources((prev) => {
      const exists = prev.some((p) => p.slotId === slotId && p.sourceDate === sourceDate);
      if (exists) {
        return prev.filter((p) => !(p.slotId === slotId && p.sourceDate === sourceDate));
      }
      return [
        ...prev.filter((p) => p.slotId !== slotId),
        { slotId, sourceDate },
      ];
    });
    setActiveWeekDate(navigateCalendarWeek(getMondayUtc(sourceDate), academicYear));
  }, [academicYear]);

  const openAttendance = useCallback(
    (
      slot: TimetableSlot,
      dateIso: string,
      cellStatus: MakeupSlotCellStatus,
      rescheduleLink?: RescheduleLinkInfo,
    ) => {
      setAttendanceTarget({ slot, dateIso, cellStatus, rescheduleLink });
      if (cellStatus === "makeup_upcoming") {
        setMakeupTarget({
          slotId: null,
          dateIso,
          blockNumber: slot.block_number,
        });
        setMakeupDate(dateIso);
        setMakeupBlockNumber(slot.block_number);
      }
    },
    [],
  );

  const handleMakeupSlotClick = useCallback(
    (slot: TimetableSlot, dateIso?: string) => {
      if (isOLevel) {
        setMakeupSlot(slot);
        setMakeupSlotDate(dateIso ?? "");
        return;
      }
      if (!isALevel || !dateIso) return;

      const rescheduleLink =
        rescheduleLinksByCell[cellStatusKey(slot.id, dateIso)] ??
        rescheduleLinksByCell[blockCellStatusKey(slot.block_number, dateIso)];
      const cellStatus = resolveCellStatus(
        statusByCell,
        slot,
        dateIso,
        rescheduleLink,
      );

      if (cellStatus === "off_day") {
        return;
      }

      if (makeupCalendarMode === "schedule") {
        if (cellStatus === "missed" || cellStatus === "rescheduled") {
          toggleSourcePick(slot.id, dateIso);
          return;
        }

        if (cellStatus === "makeup_upcoming") {
          setMakeupTarget({
            slotId: null,
            dateIso,
            blockNumber: slot.block_number,
          });
          setMakeupDate(dateIso);
          setMakeupBlockNumber(slot.block_number);
          handleActiveWeekDateChange(getMondayUtc(dateIso));
          return;
        }

        if (cellStatus === "upcoming" || dateIso >= todayIsoUtc()) {
          setMakeupTarget({
            slotId: null,
            dateIso,
            blockNumber: slot.block_number,
          });
          setMakeupDate(dateIso);
          setMakeupBlockNumber(slot.block_number);
          handleActiveWeekDateChange(getMondayUtc(dateIso));
        }
        return;
      }

      if (cellStatus === "missed") {
        openAttendance(slot, dateIso, cellStatus, rescheduleLink);
        return;
      }

      if (
        cellStatus === "rescheduled" ||
        cellStatus === "makeup_upcoming" ||
        cellStatus === "made_up" ||
        cellStatus === "conducted" ||
        cellStatus === "skipped"
      ) {
        openAttendance(slot, dateIso, cellStatus, rescheduleLink);
      }
    },
    [
      isOLevel,
      isALevel,
      statusByCell,
      rescheduleLinksByCell,
      makeupCalendarMode,
      toggleSourcePick,
      handleActiveWeekDateChange,
      openAttendance,
    ],
  );

  const handleMakeupDateChange = useCallback(
    (dateIso: string) => {
      setMakeupDate(dateIso);
      const dow = new Date(`${dateIso}T00:00:00.000Z`).getUTCDay();
      const daySlots = slots
        .filter((s) => s.day_of_week === dow)
        .sort((a, b) => a.block_number - b.block_number);
      const daySlot = daySlots[0];
      const classBlocks = blocks
        .filter((b) => !b.is_break)
        .sort((a, b) => a.block_number - b.block_number);
      const blockNumber = daySlot?.block_number ?? classBlocks[0]?.block_number ?? null;
      if (blockNumber != null) {
        setMakeupTarget({
          slotId: daySlot?.id ?? null,
          dateIso,
          blockNumber,
        });
        setMakeupBlockNumber(blockNumber);
      } else {
        setMakeupTarget(null);
        setMakeupBlockNumber(null);
      }
      handleActiveWeekDateChange(getMondayUtc(dateIso));
    },
    [slots, blocks, handleActiveWeekDateChange],
  );

  const gridInteractionMode = useMemo(() => {
    if (pageMode === "makeup") return "makeup" as const;
    if (canEdit) return "edit" as const;
    return "view" as const;
  }, [pageMode, canEdit]);

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

  const subtitle =
    pageMode === "makeup"
      ? isALevel
        ? "Schedule A-Level makeup classes — take student attendance on Roll Call when the makeup is held."
        : "Schedule O-Level missed lessons — confirm makeup held to excuse teacher on Staff Register."
      : isALevel
        ? "Weekly schedule for a teaching group (subject + teacher). Edits apply going forward."
        : "Weekly schedule for a class/section. Pick any subject + teacher per slot. Edits apply going forward.";

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2.5">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-600/20 ring-1 ring-rose-200 dark:ring-rose-500/30">
              <CalendarRange className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </span>
            Timetables
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1.5 ml-11">{subtitle}</p>
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

      <TimetableModeToggle
        mode={pageMode}
        onChange={setPageMode}
        showMakeup={showMakeupTab}
      />

      {pageMode === "makeup" && !supportsMakeup && classId && (
        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl px-4 py-2.5">
          Makeup reschedules are only available for O-Level (OI/OII/OIII) and A-Level (AS/A2) classes.
        </p>
      )}

      <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/80 backdrop-blur-md p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            Timetable Scope Filters
          </div>
          {isScopeReady && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              ✓ Ready
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2">
              <MapPin className="w-3 h-3 text-rose-500" />
              1. Campus <span className="text-rose-500">*</span>
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

          <div>
            <label className="flex items-center justify-between gap-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2">
              <span className="flex items-center gap-1">
                <GraduationCap className="w-3 h-3 text-rose-500" />
                2. Class <span className="text-rose-500">*</span>
              </span>
              {classId && (
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold tracking-normal ${
                  isALevel
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300"
                }`}>
                  {isALevel ? "A-LEVEL" : isOLevel ? "O-LEVEL" : "GENERAL"}
                </span>
              )}
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

          {isALevel ? (
            <div>
              <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2">
                3. Teaching Group <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={teachingGroupId}
                  onChange={(e) => {
                    setTeachingGroupId(e.target.value);
                    setTimetableId(null);
                    setAlevelSelectedSources([]);
                    setAttendanceTarget(null);
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
                3. Section <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={sectionId}
                  onChange={(e) => {
                    setSectionId(e.target.value);
                    setTimetableId(null);
                    setMakeupSlot(null);
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

          <div>
            <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2">
              4. Academic Year
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

      {pageMode === "schedule" && campusId && classId && (
        <PeriodEditor campusId={Number(campusId)} classId={Number(classId)} canEdit={!!canEdit} />
      )}

      {pageMode === "schedule" && !canEdit && (
        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl px-4 py-2.5">
          Read-only — you can view the timetable but not edit slots.
        </p>
      )}

      {statusError && pageMode === "makeup" && isALevel && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          {statusError}
        </div>
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
        <>
          <TimetableGrid
            blocks={blocks}
            slots={slots}
            canEdit={!!canEdit}
            interactionMode={gridInteractionMode}
            pendingSlotIds={
              pageMode === "makeup" && !isALevel ? olevelPendingSlotIds : []
            }
            selectedMakeupSlotIds={
              pageMode === "makeup" && isALevel
                ? alevelSelectedSources.map((p) => p.slotId)
                : []
            }
            selectedSourceCells={
              pageMode === "makeup" && isALevel
                ? alevelSelectedSources.map((p) => ({
                    slotId: p.slotId,
                    dateIso: p.sourceDate,
                  }))
                : []
            }
            makeupCalendarMode={pageMode === "makeup" && isALevel ? makeupCalendarMode : "schedule"}
            onMakeupCalendarModeChange={
              pageMode === "makeup" && isALevel
                ? (mode) => {
                    setMakeupCalendarMode(mode);
                    if (mode === "schedule") {
                      setAttendanceTarget(null);
                    }
                  }
                : undefined
            }
            selectedMakeupCell={
              pageMode === "makeup" && isALevel && makeupTarget
                ? {
                    slotId: makeupTarget.slotId,
                    blockNumber: makeupTarget.blockNumber,
                    dateIso: makeupTarget.dateIso,
                  }
                : null
            }
            makeupOverlays={
              pageMode === "makeup" && isALevel ? makeupOverlays : []
            }
            selectedAttendanceCell={
              pageMode === "makeup" &&
              isALevel &&
              makeupCalendarMode === "attendance" &&
              attendanceTarget
                ? {
                    slotId: attendanceTarget.slot.id,
                    dateIso: attendanceTarget.dateIso,
                    blockNumber: attendanceTarget.slot.block_number,
                  }
                : null
            }
            academicYear={academicYear}
            activeWeekDateIso={activeWeekDate}
            onActiveWeekDateChange={handleActiveWeekDateChange}
            statusByCell={pageMode === "makeup" && isALevel ? statusByCell : undefined}
            statusLoading={statusLoading}
            statusWeekRefreshing={statusWeekRefreshing}
            onAdd={openAdd}
            onEdit={openEdit}
            onMakeupSlot={pageMode === "makeup" && supportsMakeup ? handleMakeupSlotClick : undefined}
            canDeleteMakeup={canDeleteSelectedMakeup}
            deletingMakeup={deletingMakeup}
            onDeleteMakeup={(target) => void handleDeleteMakeup(target)}
          />

          {pageMode === "makeup" && supportsMakeup && (
            <MakeupReschedulePanel
              variant={isALevel ? "alevel" : "olevel"}
              campusId={Number(campusId)}
              classId={Number(classId)}
              sectionId={sectionId ? Number(sectionId) : undefined}
              teachingGroupId={teachingGroupId ? Number(teachingGroupId) : undefined}
              selectedGroup={selectedGroup}
              effectiveFrom={effectiveFrom}
              slots={slots}
              blocks={blocks}
              canMarkStaff={canMarkStaff}
              canMarkRoll={canMarkRoll}
              canViewRoll={canViewRoll}
              canEditLocked={canEditLocked}
              onPendingSlotIdsChange={setOlevelPendingSlotIds}
              onMakeupSlotClick={handleMakeupSlotClick}
              selectedMakeupSlot={makeupSlot}
              initialMakeupSourceDate={makeupSlotDate}
              onClearMakeupSlot={() => {
                setMakeupSlot(null);
                setMakeupSlotDate("");
              }}
              alevelSelectedSources={alevelSelectedSources}
              onAlevelSelectedSourcesChange={setAlevelSelectedSources}
              onClearAlevelSelection={() => {
                setAlevelSelectedSources([]);
                setMakeupTarget(null);
              }}
              onRescheduleCreated={() => {
                setMakeupTarget(null);
                void refreshCalendarStatus();
              }}
              makeupDate={makeupDate}
              onMakeupDateChange={handleMakeupDateChange}
              makeupBlockNumber={makeupBlockNumber}
              onMakeupBlockNumberChange={setMakeupBlockNumber}
              attendanceSlot={attendanceTarget?.slot ?? null}
              attendanceDateIso={attendanceTarget?.dateIso ?? ""}
              attendanceCellStatus={attendanceTarget?.cellStatus ?? null}
              attendanceRescheduleLink={attendanceTarget?.rescheduleLink}
              initialPresentStudents={
                attendanceTarget
                  ? presentByCell[
                      cellStatusKey(attendanceTarget.slot.id, attendanceTarget.dateIso)
                    ] ??
                    presentByCell[
                      blockCellStatusKey(
                        attendanceTarget.slot.block_number,
                        attendanceTarget.dateIso,
                      )
                    ]
                  : undefined
              }
              onAttendanceSaved={() => void refreshCalendarStatus()}
              onMakeupDeleted={() => {
                clearMakeupSelection();
                void refreshCalendarStatus();
              }}
              calendarMode={makeupCalendarMode}
            />
          )}
        </>
      )}

      {pageMode === "schedule" && (
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
      )}
    </div>
  );
}

export default function TimetablesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-24 text-zinc-500 gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-rose-500" />
          <span className="text-sm font-medium">Loading timetables…</span>
        </div>
      }
    >
      <TimetablesPageContent />
    </Suspense>
  );
}
