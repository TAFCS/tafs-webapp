"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CalendarOff,
  CheckCircle2,
  ClipboardList,
  Loader2,
  RefreshCw,
  SkipForward,
  MapPin,
  ChevronDown,
  Calendar,
  Clock,
  ArrowRight,
  Sparkles,
  Layers,
  Info,
  CalendarDays,
  UserCheck,
  UserX,
  History,
  CalendarRange,
  Pencil,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCampuses, CampusClass } from "@/store/slices/campusesSlice";
import { useAuthState } from "@/context/AuthContext";
import { getCurrentAcademicYear } from "@/lib/fee-utils";
import {
  attendanceService,
  RollRecordStatus,
  RollSession,
  RollSessionRosterEntry,
} from "@/lib/attendance.service";
import { DaySlotsResponse, timetablesService } from "@/lib/timetables.service";
import { teachingGroupsService, TeachingGroup } from "@/lib/teaching-groups.service";
import { isAsA2Class } from "@/lib/alevel-classes";
import {
  classReschedulesService,
  EligibleSourceSlot,
  SourceDateHoldStatus,
  SourceDateHoldStatusRow,
} from "@/lib/class-reschedules.service";
import { timetablesMakeupHref } from "@/lib/reschedule-ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const LEGACY_PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

type SourcePick = { slotId: number; sourceDate: string };

function clampSourceDateForWeekday(
  sourceDate: string,
  weekday: number,
  minDateIso: string,
): string {
  let d = new Date(`${sourceDate}T00:00:00Z`);
  const min = new Date(`${minDateIso}T00:00:00Z`);
  if (d < min) d = new Date(min);
  const diff = (weekday - d.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function normalizeSourcePicks(
  picks: SourcePick[],
  slots: EligibleSourceSlot[],
  minDateIso: string,
): SourcePick[] {
  const slotIdSet = new Set(slots.map((s) => s.id));
  return dedupeSourcePicks(
    picks
      .filter((pick) => slotIdSet.has(pick.slotId))
      .map((pick) => {
      const slot = slots.find((s) => s.id === pick.slotId);
      if (!slot) return pick;
      return {
        ...pick,
        sourceDate: clampSourceDateForWeekday(
          pick.sourceDate,
          slot.day_of_week,
          minDateIso,
        ),
      };
    }),
  );
}

function dedupeSourcePicks(picks: SourcePick[]): SourcePick[] {
  const seen = new Set<string>();
  return picks.filter((pick) => {
    const key = `${pick.slotId}|${pick.sourceDate}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function apiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { message?: string | string[] } } })?.response
    ?.data;
  const msg = data?.message;
  if (Array.isArray(msg)) return msg.join(", ");
  if (typeof msg === "string" && msg.length > 0) return msg;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

const WEEKDAY_FULL: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

function blockLabel(block: DaySlotsResponse["blocks"][number]): string {
  if (block.label) return block.label;
  const d = new Date(block.start_time);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const hour12 = ((h + 11) % 12) + 1;
  const suffix = h < 12 ? "am" : "pm";
  const time =
    m === 0 ? `${hour12}${suffix}` : `${hour12}:${String(m).padStart(2, "0")}${suffix}`;
  return time;
}

/** Makeup slot must come from this teaching group's timetable on the makeup date. */
function resolveMakeupSlotForGroup(
  daySlots: DaySlotsResponse | null,
  candidateId: number | null,
): { slotId: number | null; periodNum: number } {
  if (!daySlots) return { slotId: null, periodNum: 1 };
  for (const block of daySlots.blocks) {
    for (const slot of block.slots) {
      if (candidateId === slot.id) {
        return { slotId: slot.id, periodNum: block.block_number };
      }
    }
  }
  for (const block of daySlots.blocks) {
    if (block.slots.length > 0) {
      return { slotId: block.slots[0].id, periodNum: block.block_number };
    }
  }
  return { slotId: null, periodNum: 1 };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatRelativeDate(isoDateStr: string): string {
  if (!isoDateStr) return "";
  const d = new Date(isoDateStr + "T00:00:00Z");
  if (isNaN(d.getTime())) return isoDateStr;

  const todayStr = todayIso();
  const today = new Date(todayStr + "T00:00:00Z");
  const diffDays = Math.round((today.getTime() - d.getTime()) / (1000 * 3600 * 24));

  const formatted = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  if (diffDays === 0) return `${formatted} (Today)`;
  if (diffDays === 1) return `${formatted} (Yesterday)`;
  if (diffDays > 1) return `${formatted} (${diffDays} days ago)`;
  if (diffDays === -1) return `${formatted} (Tomorrow)`;
  if (diffDays < -1) return `${formatted} (in ${Math.abs(diffDays)} days)`;
  return formatted;
}

function academicYearAugustStart(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const startYear = month >= 7 ? year : year - 1;
  return `${startYear}-08-01`;
}

function minVisibleSourceDateIso(
  makeupDateIso: string,
  timetableEffectiveFrom?: string | null,
): string {
  const augustFirst = academicYearAugustStart(makeupDateIso);
  if (!timetableEffectiveFrom) return augustFirst;
  return augustFirst > timetableEffectiveFrom ? augustFirst : timetableEffectiveFrom;
}

function generateWeekdayOccurrences(
  weekday: number,
  makeupDateIso: string,
  defaultDateIso: string,
  options?: { pastWeeks?: number; futureWeeks?: number; minDateIso?: string },
): Array<{
  dateIso: string;
  label: string;
  weekdayLabel: string;
  relative: string;
  isDefault: boolean;
  isFuture: boolean;
}> {
  const pastWeeks = options?.pastWeeks ?? 10;
  const futureWeeks = options?.futureWeeks ?? 4;
  if (!makeupDateIso) return [];

  const anchor = new Date(`${makeupDateIso}T00:00:00Z`);
  if (isNaN(anchor.getTime())) return [];

  const anchorDow = anchor.getUTCDay();
  const diff = (anchorDow - weekday + 7) % 7;
  const nearest = new Date(anchor);
  nearest.setUTCDate(nearest.getUTCDate() - diff);

  const todayStr = todayIso();
  const today = new Date(`${todayStr}T00:00:00Z`);

  const dates: Date[] = [];
  for (let i = pastWeeks; i >= 0; i--) {
    const d = new Date(nearest);
    d.setUTCDate(d.getUTCDate() - i * 7);
    dates.push(d);
  }
  for (let i = 1; i <= futureWeeks; i++) {
    const d = new Date(nearest);
    d.setUTCDate(d.getUTCDate() + i * 7);
    dates.push(d);
  }

  return dates
    .map((d) => {
      const iso = d.toISOString().slice(0, 10);
      const weekdayLabel = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
      const formattedDate = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });

      const diffDays = Math.round((today.getTime() - d.getTime()) / 86400000);
      let relative = "";
      if (diffDays === 0) relative = "Today";
      else if (diffDays === 1) relative = "Yesterday";
      else if (diffDays > 1) relative = `${diffDays}d ago`;
      else if (diffDays === -1) relative = "Tomorrow";
      else if (diffDays < -1) relative = `in ${Math.abs(diffDays)}d`;

      return {
        dateIso: iso,
        label: formattedDate,
        weekdayLabel,
        relative,
        isDefault: iso === defaultDateIso,
        isFuture: diffDays < 0,
      };
    })
    .filter((item) => !options?.minDateIso || item.dateIso >= options.minDateIso);
}

function sourceDateChipClass(
  isSelected: boolean,
  holdStatus: SourceDateHoldStatus | undefined,
): string {
  if (isSelected) {
    return "bg-indigo-600 text-white border-indigo-600 shadow-sm";
  }
  switch (holdStatus) {
    case "upcoming":
      return "bg-amber-50/80 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-900/50 hover:border-indigo-300";
    case "held":
      return "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800 hover:border-emerald-400";
    case "off_day":
    case "skipped":
      return "bg-zinc-100 dark:bg-zinc-900/60 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300";
    case "missed":
      return "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800 hover:border-rose-400";
    default:
      return "bg-zinc-50 dark:bg-zinc-900/40 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-indigo-300";
  }
}

function sourceDateChipLabel(
  holdStatus: SourceDateHoldStatus | undefined,
  item: { isFuture: boolean; isDefault: boolean; relative: string },
): string {
  if (item.isFuture || holdStatus === "upcoming") return item.relative;
  switch (holdStatus) {
    case "held":
      return "Held";
    case "missed":
      return "Missed";
    case "off_day":
      return "No school";
    case "skipped":
      return "Skipped";
    default:
      return item.isDefault ? "Suggested" : item.relative;
  }
}

function RollCallPageInner() {
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const campuses = useAppSelector((s) => s.campuses.items);
  const { user } = useAuthState();

  const canMark =
    user?.permissions?.includes("attendance.student.rollcall.mark") ||
    user?.role === "SUPER_ADMIN";
  const canView =
    canMark ||
    user?.permissions?.includes("attendance.student.rollcall.view") ||
    user?.role === "SUPER_ADMIN";

  const gulistanCampus = campuses.find(
    (c) =>
      c.campus_name.toLowerCase().includes("gulistan") ||
      c.campus_name.toLowerCase().includes("johar") ||
      c.campus_name.toLowerCase().includes("jauhar")
  );
  const lockedCampusId = gulistanCampus
    ? String(gulistanCampus.id)
    : user?.campusId
    ? String(user.campusId)
    : "";

  const [classId, setClassId] = useState("");
  const [teachingGroupId, setTeachingGroupId] = useState("");
  const [groups, setGroups] = useState<TeachingGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [sessionDate, setSessionDate] = useState(todayIso());
  const [period, setPeriod] = useState(1);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [daySlots, setDaySlots] = useState<DaySlotsResponse | null>(null);
  const [daySlotsLoading, setDaySlotsLoading] = useState(false);
  const [session, setSession] = useState<RollSession | null>(null);
  const [marks, setMarks] = useState<Record<number, RollRecordStatus>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState("");
  const [showSkip, setShowSkip] = useState(false);
  // Explicit opt-in to editing an already-submitted roll call (undo/correct
  // errors). Requires the attendance.student.edit_locked permission.
  const [editSubmitted, setEditSubmitted] = useState(false);
  const [makeupMode, setMakeupMode] = useState(false);
  const [eligibleSlots, setEligibleSlots] = useState<EligibleSourceSlot[]>([]);
  const [timetableEffectiveFrom, setTimetableEffectiveFrom] = useState<string | null>(null);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [selectedSources, setSelectedSources] = useState<SourcePick[]>([]);
  const [expandedSourceWeekday, setExpandedSourceWeekday] = useState<number | null>(null);
  const [holdStatusByWeekday, setHoldStatusByWeekday] = useState<
    Record<number, Record<string, SourceDateHoldStatusRow>>
  >({});
  const [holdStatusLoading, setHoldStatusLoading] = useState(false);
  const [weekdayDraftDates, setWeekdayDraftDates] = useState<Record<number, string>>({});
  const urlApplied = useRef(false);
  const skipNextClassReset = useRef(false);
  const userEditedMarks = useRef(false);

  useEffect(() => {
    if (urlApplied.current) return;
    if (searchParams.get("makeup") !== "1") return;
    urlApplied.current = true;
    skipNextClassReset.current = true;

    const date = searchParams.get("date");
    const groupId = searchParams.get("teaching_group_id");
    const classIdParam = searchParams.get("class_id");

    if (date) setSessionDate(date);
    if (classIdParam) setClassId(classIdParam);
    if (groupId) setTeachingGroupId(groupId);
    setMakeupMode(true);
  }, [searchParams]);

  useEffect(() => {
    dispatch(fetchCampuses());
  }, [dispatch]);

  const selectedCampus =
    gulistanCampus || campuses.find((c) => String(c.id) === lockedCampusId);
  const availableClasses: CampusClass[] = (
    selectedCampus?.offered_classes ?? []
  ).filter(isAsA2Class);

  useEffect(() => {
    if (skipNextClassReset.current) {
      skipNextClassReset.current = false;
      return;
    }
    setTeachingGroupId("");
    setSelectedSources([]);
  }, [classId]);

  useEffect(() => {
    setSelectedSources([]);
    setHoldStatusByWeekday({});
    setEligibleSlots([]);
    setTimetableEffectiveFrom(null);
    setExpandedSourceWeekday(null);
    setSelectedSlotId(null);
    setDaySlots(null);
  }, [teachingGroupId, sessionDate]);

  useEffect(() => {
    if (!makeupMode || !teachingGroupId || !sessionDate || eligibleSlots.length === 0) return;
    let cancelled = false;
    classReschedulesService
      .list({
        teaching_group_id: Number(teachingGroupId),
        status: "SCHEDULED",
      })
      .then((pending) => {
        if (cancelled) return;
        const forDate = pending.filter(
          (r) => r.makeup_date.slice(0, 10) === sessionDate && r.makeup_roll_session_id,
        );
        if (forDate.length === 0) return;
        const minIso = minVisibleSourceDateIso(sessionDate, timetableEffectiveFrom);
        setSelectedSources((prev) => {
          if (prev.length > 0) return prev;
          return normalizeSourcePicks(
            forDate.map((r) => ({
              slotId: r.source_timetable_slot_id,
              sourceDate: r.source_date.slice(0, 10),
            })),
            eligibleSlots,
            minIso,
          );
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [makeupMode, teachingGroupId, sessionDate, eligibleSlots, timetableEffectiveFrom]);

  useEffect(() => {
    if (!lockedCampusId || !classId) {
      setGroups([]);
      return;
    }
    let cancelled = false;
    setGroupsLoading(true);
    teachingGroupsService
      .list({
        campus_id: Number(lockedCampusId),
        class_id: Number(classId),
        academic_year: getCurrentAcademicYear(),
      })
      .then((data) => {
        if (!cancelled) setGroups(data.filter((g) => g.is_active));
      })
      .catch(() => !cancelled && setGroups([]))
      .finally(() => !cancelled && setGroupsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [lockedCampusId, classId]);

  useEffect(() => {
    if (!makeupMode || !teachingGroupId || !sessionDate) {
      setEligibleSlots([]);
      setTimetableEffectiveFrom(null);
      return;
    }
    let cancelled = false;
    setEligibleLoading(true);
    classReschedulesService
      .getEligibleSlots({
        teaching_group_id: Number(teachingGroupId),
        makeup_date: sessionDate,
      })
      .then((data) => {
        if (cancelled) return;
        setEligibleSlots(data.slots);
        setTimetableEffectiveFrom(data.timetable_effective_from);
      })
      .catch(() => {
        if (!cancelled) {
          setEligibleSlots([]);
          setTimetableEffectiveFrom(null);
        }
      })
      .finally(() => {
        if (!cancelled) setEligibleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [makeupMode, teachingGroupId, sessionDate]);

  const slotsByWeekday = useMemo(() => {
    const map = new Map<number, EligibleSourceSlot[]>();
    for (const slot of eligibleSlots) {
      const list = map.get(slot.day_of_week) ?? [];
      list.push(slot);
      map.set(slot.day_of_week, list);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([dayOfWeek, slots]) => ({
        dayOfWeek,
        dayLabel: WEEKDAY_FULL[dayOfWeek] ?? slots[0].day_label,
        slots: [...slots].sort((a, b) => a.block_number - b.block_number),
        defaultSourceDate: slots[0].default_source_date,
      }));
  }, [eligibleSlots]);

  const makeupDayLabel = useMemo(() => {
    if (!sessionDate) return "Makeup day";
    const d = new Date(`${sessionDate}T00:00:00Z`);
    return d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  }, [sessionDate]);

  useEffect(() => {
    if (!makeupMode || slotsByWeekday.length === 0) {
      setExpandedSourceWeekday(null);
      return;
    }
    setExpandedSourceWeekday((prev) => {
      if (prev != null && slotsByWeekday.some((g) => g.dayOfWeek === prev)) return prev;
      return slotsByWeekday[0].dayOfWeek;
    });
  }, [makeupMode, slotsByWeekday]);

  const minSourceDateIso = useMemo(
    () => minVisibleSourceDateIso(sessionDate, timetableEffectiveFrom),
    [sessionDate, timetableEffectiveFrom],
  );

  useEffect(() => {
    if (!makeupMode || !teachingGroupId || expandedSourceWeekday == null) {
      return;
    }
    if (eligibleLoading || eligibleSlots.length === 0) return;

    const group = slotsByWeekday.find((g) => g.dayOfWeek === expandedSourceWeekday);
    if (!group) return;

    const eligibleIdSet = new Set(eligibleSlots.map((s) => s.id));

    const selectedOnDay = selectedSources.filter((p) => {
      if (!eligibleIdSet.has(p.slotId)) return false;
      const slot = eligibleSlots.find((s) => s.id === p.slotId);
      return slot?.day_of_week === expandedSourceWeekday;
    });
    const slotIds = [
      ...new Set(
        (selectedOnDay.length > 0
          ? selectedOnDay.map((p) => p.slotId)
          : group.slots.map((s) => s.id)),
      ),
    ].filter((id) => eligibleIdSet.has(id));

    const dateIsos = generateWeekdayOccurrences(
      group.dayOfWeek,
      sessionDate,
      group.defaultSourceDate,
      { minDateIso: minSourceDateIso },
    ).map((d) => d.dateIso);

    if (slotIds.length === 0 || dateIsos.length === 0) return;

    let cancelled = false;
    setHoldStatusLoading(true);
    classReschedulesService
      .getSourceDateHoldStatus({
        teaching_group_id: Number(teachingGroupId),
        source_timetable_slot_ids: slotIds.join(","),
        dates: dateIsos.join(","),
      })
      .then((result) => {
        if (cancelled) return;
        const map: Record<string, SourceDateHoldStatusRow> = {};
        for (const row of result.dates) {
          map[row.date] = row;
        }
        setHoldStatusByWeekday((prev) => ({ ...prev, [expandedSourceWeekday]: map }));
      })
      .catch(() => {
        if (!cancelled) {
          setHoldStatusByWeekday((prev) => ({ ...prev, [expandedSourceWeekday]: {} }));
        }
      })
      .finally(() => {
        if (!cancelled) setHoldStatusLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    makeupMode,
    teachingGroupId,
    expandedSourceWeekday,
    selectedSources,
    sessionDate,
    eligibleSlots,
    eligibleLoading,
    slotsByWeekday,
    minSourceDateIso,
  ]);

  const makeupReady =
    makeupMode && selectedSources.length > 0 && Boolean(teachingGroupId);

  const normalizedSelectedSources = useMemo(
    () => normalizeSourcePicks(selectedSources, eligibleSlots, minSourceDateIso),
    [selectedSources, eligibleSlots, minSourceDateIso],
  );

  const getActiveDateForWeekday = useCallback(
    (dayOfWeek: number, defaultSourceDate: string) => {
      const pick = selectedSources.find((p) => {
        const slot = eligibleSlots.find((s) => s.id === p.slotId);
        return slot?.day_of_week === dayOfWeek;
      });
      const raw =
        pick?.sourceDate ?? weekdayDraftDates[dayOfWeek] ?? defaultSourceDate;
      return clampSourceDateForWeekday(raw, dayOfWeek, minSourceDateIso);
    },
    [selectedSources, eligibleSlots, weekdayDraftDates, minSourceDateIso],
  );

  useEffect(() => {
    if (!makeupMode || eligibleSlots.length === 0) return;
    setSelectedSources((prev) => {
      const next = normalizeSourcePicks(prev, eligibleSlots, minSourceDateIso);
      if (
        next.length === prev.length &&
        next.every(
          (pick, i) =>
            pick.slotId === prev[i]?.slotId && pick.sourceDate === prev[i]?.sourceDate,
        )
      ) {
        return prev;
      }
      return next;
    });
    setWeekdayDraftDates((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [dow, date] of Object.entries(next)) {
        const clamped = clampSourceDateForWeekday(date, Number(dow), minSourceDateIso);
        if (clamped !== date) {
          next[Number(dow)] = clamped;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [makeupMode, minSourceDateIso, eligibleSlots, selectedSources]);

  const toggleSourceSlot = (slot: EligibleSourceSlot, checked: boolean) => {
    setSelectedSources((prev) => {
      if (checked) {
        if (prev.some((p) => p.slotId === slot.id)) return prev;
        const siblingDateRaw =
          prev.find((p) => {
            const s = eligibleSlots.find((es) => es.id === p.slotId);
            return s?.day_of_week === slot.day_of_week;
          })?.sourceDate ??
          weekdayDraftDates[slot.day_of_week] ??
          slot.default_source_date;
        const siblingDate = clampSourceDateForWeekday(
          siblingDateRaw,
          slot.day_of_week,
          minSourceDateIso,
        );
        return [...prev, { slotId: slot.id, sourceDate: siblingDate }];
      }
      return prev.filter((p) => p.slotId !== slot.id);
    });
  };

  const updateWeekdaySourceDate = (dayOfWeek: number, sourceDate: string) => {
    setWeekdayDraftDates((prev) => ({ ...prev, [dayOfWeek]: sourceDate }));
    setSelectedSources((prev) =>
      prev.map((p) => {
        const slot = eligibleSlots.find((s) => s.id === p.slotId);
        return slot?.day_of_week === dayOfWeek ? { ...p, sourceDate } : p;
      }),
    );
  };

  const selectAllWeekdaySlots = (
    dayOfWeek: number,
    slots: EligibleSourceSlot[],
    defaultSourceDate: string,
    checked: boolean,
  ) => {
    if (checked) {
      const date = getActiveDateForWeekday(dayOfWeek, defaultSourceDate);
      setSelectedSources((prev) => {
        const without = prev.filter((p) => {
          const slot = eligibleSlots.find((s) => s.id === p.slotId);
          return slot?.day_of_week !== dayOfWeek;
        });
        const additions = slots.map((slot) => ({ slotId: slot.id, sourceDate: date }));
        return [...without, ...additions];
      });
    } else {
      setSelectedSources((prev) =>
        prev.filter((p) => {
          const slot = eligibleSlots.find((s) => s.id === p.slotId);
          return slot?.day_of_week !== dayOfWeek;
        }),
      );
    }
  };

  const isScopeReady =
    Boolean(lockedCampusId) &&
    Boolean(classId) &&
    Boolean(teachingGroupId) &&
    Boolean(sessionDate) &&
    (!makeupMode || makeupReady);

  const slotPills =
    daySlots?.blocks.flatMap((block) =>
      block.slots.map((slot) => ({
        slot,
        block,
        pillLabel: `${blockLabel(block)} — ${slot.subject.name}`,
      }))
    ) ?? [];
  const timetableMode = slotPills.length > 0;

  const isSlotValidForDay = useCallback(
    (slotId: number | null) => {
      if (!slotId) return true;
      if (!daySlots) return false;
      return daySlots.blocks.some((block) =>
        block.slots.some((slot) => slot.id === slotId)
      );
    },
    [daySlots]
  );

  const getSourcePresentStudents = useCallback(() => {
    const ccs = new Set<number>();
    const grs = new Set<string>();
    if (!makeupMode || selectedSources.length === 0) return { ccs, grs };

    for (const pick of selectedSources) {
      const slot = eligibleSlots.find((s) => s.id === pick.slotId);
      if (!slot) continue;
      const holdRow = holdStatusByWeekday[slot.day_of_week]?.[pick.sourceDate];
      if (holdRow?.present_by_slot) {
        for (const slotPresent of holdRow.present_by_slot) {
          if (slotPresent.slot_id === pick.slotId || !slotPresent.slot_id) {
            for (const student of slotPresent.students) {
              if (student.cc) ccs.add(student.cc);
              if (student.gr_number) grs.add(student.gr_number);
            }
          }
        }
      }
    }
    return { ccs, grs };
  }, [makeupMode, selectedSources, eligibleSlots, holdStatusByWeekday]);

  const applySession = useCallback(
    (s: RollSession) => {
      setSession(s);
      const next: Record<number, RollRecordStatus> = {};
      let hasSavedRecord = false;
      for (const row of s.roster ?? []) {
        if (row.record?.status) {
          next[row.student.cc] = row.record.status;
          hasSavedRecord = true;
        }
      }

      if (!hasSavedRecord && makeupMode) {
        const { ccs, grs } = getSourcePresentStudents();
        if (ccs.size > 0 || grs.size > 0) {
          for (const row of s.roster ?? []) {
            const wasPresent =
              (row.student.cc && ccs.has(row.student.cc)) ||
              (row.student.gr_number && grs.has(row.student.gr_number));
            if (wasPresent) {
              next[row.student.cc] = "PRESENT";
            }
          }
        }
      }

      setMarks(next);
    },
    [makeupMode, getSourcePresentStudents],
  );

  // Leave "edit submitted" mode whenever we move to a different session or
  // its status changes, so a finalized roll call is never silently editable.
  useEffect(() => {
    setEditSubmitted(false);
  }, [session?.id, session?.status]);

  useEffect(() => {
    userEditedMarks.current = false;
  }, [session?.id, sessionDate, teachingGroupId, selectedSources]);

  useEffect(() => {
    if (
      !makeupMode ||
      !session ||
      session.status === "SUBMITTED" ||
      userEditedMarks.current
    ) {
      return;
    }
    const { ccs, grs } = getSourcePresentStudents();
    if (ccs.size === 0 && grs.size === 0) return;

    const hasSavedRecord = session.roster?.some((r) => Boolean(r.record?.status));
    if (hasSavedRecord) return;

    setMarks((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const row of session.roster ?? []) {
        const wasPresent =
          (row.student.cc && ccs.has(row.student.cc)) ||
          (row.student.gr_number && grs.has(row.student.gr_number));
        if (wasPresent && next[row.student.cc] !== "PRESENT") {
          next[row.student.cc] = "PRESENT";
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [makeupMode, session, getSourcePresentStudents]);

  const validateSourcePicks = useCallback(
    (picks: SourcePick[]) => {
      for (const pick of picks) {
        const slot = eligibleSlots.find((s) => s.id === pick.slotId);
        if (!slot) continue;
        const dow = new Date(`${pick.sourceDate}T00:00:00Z`).getUTCDay();
        if (dow !== slot.day_of_week) {
          const dayLabel = WEEKDAY_FULL[slot.day_of_week] ?? slot.day_label;
          throw new Error(
            `${dayLabel} session requires a ${dayLabel} missed date — ${pick.sourceDate} is a ${WEEKDAY_FULL[dow] ?? "different day"}.`,
          );
        }
      }
    },
    [eligibleSlots],
  );

  const loadSession = useCallback(
    async (opts?: { slotId?: number | null; periodNum?: number }) => {
      if (!isScopeReady || !canView) return;

      const rawSlotId = opts?.slotId !== undefined ? opts.slotId : selectedSlotId;
      let slotId = rawSlotId;
      let periodNum = opts?.periodNum ?? period;

      if (makeupMode) {
        if (daySlotsLoading || !daySlots) return;
        const resolved = resolveMakeupSlotForGroup(daySlots, rawSlotId);
        slotId = resolved.slotId;
        periodNum = resolved.periodNum;
        if (!slotId) {
          setError("No timetable slot on this makeup date for this teaching group.");
          setSession(null);
          setMarks({});
          return;
        }
      } else if (opts?.slotId === undefined && !isSlotValidForDay(slotId)) {
        return;
      }

      setLoading(true);
      setError(null);
      setSuccess(null);
      try {
        const campusId = Number(lockedCampusId);
        const classIdNum = Number(classId);
        const groupId = Number(teachingGroupId);

        let active: RollSession | null = null;

        if (makeupMode && normalizedSelectedSources.length > 0) {
          const pendingList = await classReschedulesService.list({
            teaching_group_id: groupId,
            status: "SCHEDULED",
          });
          const bundlePending = pendingList.filter(
            (r) => r.makeup_date.slice(0, 10) === sessionDate,
          );
          const pendingKeys = new Set(
            pendingList.map(
              (r) => `${r.source_timetable_slot_id}|${r.source_date.slice(0, 10)}`,
            ),
          );
          const toCreate = normalizedSelectedSources.filter(
            (s) => !pendingKeys.has(`${s.slotId}|${s.sourceDate}`),
          );

          const sessionId =
            bundlePending.find((r) => r.makeup_roll_session_id)?.makeup_roll_session_id ??
            pendingList.find(
              (r) =>
                r.makeup_roll_session_id &&
                normalizedSelectedSources.some(
                  (s) =>
                    s.slotId === r.source_timetable_slot_id &&
                    s.sourceDate === r.source_date.slice(0, 10),
                ),
            )?.makeup_roll_session_id;

          const sourcesNeedingSync = normalizedSelectedSources.filter((s) =>
            pendingList.some(
              (r) =>
                r.source_timetable_slot_id === s.slotId &&
                r.source_date.slice(0, 10) === s.sourceDate &&
                r.makeup_date.slice(0, 10) !== sessionDate,
            ),
          );

          if (sessionId) {
            active = await attendanceService.getRollSession(sessionId);
            const effectivePeriod = active.period;
            const needsCreate =
              toCreate.length > 0 ||
              (sourcesNeedingSync.length > 0 && active.session_date?.slice(0, 10) !== sessionDate);

            if (needsCreate && canMark) {
              const sourcesPayload = dedupeSourcePicks([...toCreate, ...sourcesNeedingSync]);
              if (sourcesPayload.length > 0) {
                validateSourcePicks(sourcesPayload);
                const created = await classReschedulesService.create({
                  campus_id: campusId,
                  class_id: classIdNum,
                  teaching_group_id: groupId,
                  sources: sourcesPayload.map((s) => ({
                    source_timetable_slot_id: s.slotId,
                    source_date: s.sourceDate,
                  })),
                  makeup_date: sessionDate,
                  makeup_period: effectivePeriod,
                  ...(slotId ? { makeup_timetable_slot_id: slotId } : {}),
                });
                active = created.makeup_session;
              }
            }
          } else if (canMark) {
            const sourcesPayload = normalizedSelectedSources;
            if (sourcesPayload.length === 0) {
              throw new Error("Select at least one missed session to reschedule.");
            }
            validateSourcePicks(sourcesPayload);
            const created = await classReschedulesService.create({
              campus_id: campusId,
              class_id: classIdNum,
              teaching_group_id: groupId,
              sources: sourcesPayload.map((s) => ({
                source_timetable_slot_id: s.slotId,
                source_date: s.sourceDate,
              })),
              makeup_date: sessionDate,
              makeup_period: periodNum,
              ...(slotId ? { makeup_timetable_slot_id: slotId } : {}),
            });
            active = await attendanceService.getRollSession(
              created.makeup_session.id
            );
          }
        } else {
          const existing = await attendanceService.listRollSessions({
            date: sessionDate,
            campus_id: campusId,
            class_id: classIdNum,
            teaching_group_id: groupId,
            period: periodNum,
            ...(slotId ? { timetable_slot_id: slotId } : {}),
          });

          active =
            existing.find(
              (s) =>
                s.period === periodNum &&
                (slotId ? s.timetable_slot_id === slotId : !s.timetable_slot_id)
            ) ?? null;

          if (!active && canMark) {
            active = await attendanceService.createRollSession({
              session_date: sessionDate,
              campus_id: campusId,
              class_id: classIdNum,
              teaching_group_id: groupId,
              period: periodNum,
              ...(slotId ? { timetable_slot_id: slotId } : {}),
            });
          } else if (active) {
            active = await attendanceService.getRollSession(active.id);
          }
        }

        if (!active) {
          setSession(null);
          setMarks({});
          setError("No roll session found. Select scope with mark permission to open one.");
          return;
        }

        applySession(active);
      } catch (err) {
        console.error(err);
        setError(apiErrorMessage(err, "Failed to load roll call session."));
        setSession(null);
      } finally {
        setLoading(false);
      }
    },
    [
      isScopeReady,
      canView,
      canMark,
      lockedCampusId,
      classId,
      teachingGroupId,
      sessionDate,
      period,
      selectedSlotId,
      isSlotValidForDay,
      applySession,
      makeupMode,
      normalizedSelectedSources,
      eligibleSlots,
      validateSourcePicks,
      daySlots,
      daySlotsLoading,
    ]
  );

  const loadSessionBusy = useRef(false);
  const loadSessionRef = useRef(loadSession);
  loadSessionRef.current = loadSession;

  const runLoadSession = useCallback(
    (opts?: { slotId?: number | null; periodNum?: number }) => {
      if (loadSessionBusy.current) return;
      loadSessionBusy.current = true;
      void loadSessionRef.current(opts).finally(() => {
        loadSessionBusy.current = false;
      });
    },
    []
  );

  useEffect(() => {
    if (!isScopeReady) {
      setDaySlots(null);
      setSelectedSlotId(null);
      setDaySlotsLoading(false);
      setSession(null);
      setMarks({});
      return;
    }

    let cancelled = false;
    setDaySlotsLoading(true);
    setDaySlots(null);
    setSelectedSlotId(null);
    setSession(null);
    setMarks({});

    (async () => {
      try {
        const data = await timetablesService.getDaySlotsByGroup({
          teaching_group_id: Number(teachingGroupId),
          date: sessionDate,
        });
        if (cancelled) return;

        setDaySlots(data);
        const pills = data.blocks.flatMap((block) =>
          block.slots.map((slot) => ({ ...slot, block_number: block.block_number }))
        );

        const slotId = pills.length > 0 ? pills[0].id : null;
        const periodNum = pills.length > 0 ? pills[0].block_number : 1;

        setSelectedSlotId(slotId);
        setPeriod(periodNum);
        setDaySlotsLoading(false);

        if (!cancelled && canView) {
          runLoadSession({ slotId, periodNum });
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setDaySlots(null);
          setSelectedSlotId(null);
          setDaySlotsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isScopeReady, teachingGroupId, sessionDate, canView, runLoadSession]);

  useEffect(() => {
    if (makeupMode && makeupReady && canView && !daySlotsLoading && daySlots) {
      runLoadSession();
    }
  }, [
    makeupMode,
    makeupReady,
    selectedSources,
    canView,
    daySlotsLoading,
    daySlots,
    runLoadSession,
    sessionDate,
    teachingGroupId,
  ]);

  const selectSlot = useCallback(
    (slotId: number, blockNumber: number) => {
      setSelectedSlotId(slotId);
      setPeriod(blockNumber);
      runLoadSession({ slotId, periodNum: blockNumber });
    },
    [runLoadSession]
  );

  const selectLegacyPeriod = useCallback(
    (periodNum: number) => {
      setPeriod(periodNum);
      setSelectedSlotId(null);
      runLoadSession({ slotId: null, periodNum });
    },
    [runLoadSession]
  );

  const roster: RollSessionRosterEntry[] = session?.roster ?? [];
  const sessionIsSaturday =
    !!session?.session_date && new Date(session.session_date).getUTCDay() === 6;
  const isHolidaySkip =
    session?.status === "SKIPPED" &&
    !!session.skip_reason &&
    session.skip_reason.startsWith("Holiday:") &&
    !(sessionIsSaturday && session.skip_reason === "Holiday: Weekend");
  const isReopenableSkip = session?.status === "SKIPPED" && !isHolidaySkip;
  const isSubmitted = session?.status === "SUBMITTED";
  // Permission to reopen/correct a submitted (locked) roll call.
  const canEditLocked =
    (user?.permissions?.includes("attendance.student.edit_locked") ?? false) ||
    user?.role === "SUPER_ADMIN";
  const editingSubmitted = isSubmitted && canEditLocked && editSubmitted;
  const isLocked =
    (isSubmitted && !editingSubmitted) || isHolidaySkip;
  const canEdit =
    canMark &&
    (session?.status === "DRAFT" || isReopenableSkip || editingSubmitted);

  const presentCount = useMemo(
    () => roster.filter((r) => marks[r.student.cc] === "PRESENT").length,
    [roster, marks]
  );

  const togglePresent = (cc: number) => {
    if (!canEdit) return;
    setMarks((prev) => {
      const next = { ...prev };
      if (next[cc] === "PRESENT") {
        delete next[cc];
      } else {
        next[cc] = "PRESENT";
      }
      return next;
    });
  };

  const buildRecords = () =>
    roster.map((row) => ({
      student_cc: row.student.cc,
      status: marks[row.student.cc] ?? ("ABSENT" as RollRecordStatus),
    }));

  const handleSaveDraft = async () => {
    if (!session || !canEdit) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const wasEditingSubmitted = editingSubmitted;
      const updated = await attendanceService.updateRollSession(session.id, {
        records: buildRecords(),
      });
      applySession(updated);
      setSuccess(
        wasEditingSubmitted
          ? "Changes saved. This roll call is still marked submitted."
          : "Draft saved successfully.",
      );
    } catch (err: unknown) {
      console.error(err);
      setError(editingSubmitted ? "Failed to save changes." : "Failed to save draft.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!session || !canEdit) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const wasEditingSubmitted = editingSubmitted;
      const updated = await attendanceService.updateRollSession(session.id, {
        records: buildRecords(),
        submit: true,
      });
      applySession(updated);
      setEditSubmitted(false);
      const completion = updated.reschedule_completion;
      if (completion) {
        const parts = [
          `${completion.sourceCount} original slot${
            completion.sourceCount === 1 ? "" : "s"
          } covered`,
          `${completion.excusedStudentCount} student excusal${
            completion.excusedStudentCount === 1 ? "" : "s"
          } recorded`,
        ];
        if (completion.staffExcusedDays > 0) {
          parts.push(
            `teacher register updated for ${completion.staffExcusedDays} day${
              completion.staffExcusedDays === 1 ? "" : "s"
            }`
          );
        }
        if (completion.staffExcuseWarnings.length > 0) {
          parts.push(completion.staffExcuseWarnings[0]);
        }
        setSuccess(`Roll call submitted! ${parts.join("; ")}.`);
      } else if (wasEditingSubmitted) {
        setSuccess("Roll call corrected. The recorded attendance has been updated.");
      } else {
        setSuccess("Roll call submitted! Attendance has been recorded.");
      }
    } catch (err: unknown) {
      console.error(err);
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message;
      setError(msg || "Failed to submit roll call.");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    if (!session || !canMark || !skipReason.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await attendanceService.skipRollSession(
        session.id,
        skipReason.trim()
      );
      applySession(updated);
      setShowSkip(false);
      setSkipReason("");
      setSuccess("Session marked as skipped.");
    } catch (err) {
      console.error(err);
      setError("Failed to skip session.");
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          You do not have permission to view A-Level roll call.
        </div>
      </div>
    );
  }

  const selectCls =
    "w-full h-11 px-3 pr-8 appearance-none bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm";
  const labelCls =
    "block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5";

  const selectedGroup = groups.find((g) => String(g.id) === teachingGroupId);

  const timetablesMakeupLink = timetablesMakeupHref({
    campusId: lockedCampusId || undefined,
    classId: classId || undefined,
    teachingGroupId: teachingGroupId || undefined,
  });

  return (
    <div className="pb-28 sm:pb-8 max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/80 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-500/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <ClipboardList className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                A-Level Roll Call
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                Record attendance for regular timetable slots or makeup classes.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={timetablesMakeupLink}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition-colors shadow-sm"
          >
            <History className="h-3.5 w-3.5 text-indigo-500" />
            Manage on Timetables
          </Link>

          <button
            type="button"
            onClick={() => void loadSession()}
            disabled={loading || daySlotsLoading || !isScopeReady}
            className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 active:bg-zinc-50 dark:active:bg-zinc-800 disabled:opacity-40 transition-all shadow-sm"
            aria-label="Refresh"
            title="Refresh session"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                loading || daySlotsLoading ? "animate-spin" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 rounded-2xl flex gap-3 text-sm shadow-sm animate-in fade-in duration-200">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-rose-500" />
          <div className="font-medium">{error}</div>
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 rounded-2xl flex gap-3 text-sm shadow-sm animate-in fade-in duration-200">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-500" />
          <div className="font-medium">{success}</div>
        </div>
      )}

      {isHolidaySkip && (
        <div className="p-4 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 text-sky-900 dark:text-sky-200 rounded-2xl flex gap-3 items-start text-sm shadow-sm">
          <CalendarOff className="h-5 w-5 shrink-0 mt-0.5 text-sky-500" />
          <div>
            <p className="font-semibold">Roll call skipped — Holiday / Day Off</p>
            <p className="text-sky-800/80 dark:text-sky-300/80 mt-0.5">
              {session?.skip_reason?.replace(/^Holiday:\s*/, "") ??
                "Not a working day."}
            </p>
          </div>
        </div>
      )}

      {/* Main Mode Segmented Control */}
      <div className="bg-zinc-100 dark:bg-zinc-900/60 p-1.5 rounded-2xl flex border border-zinc-200/80 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => {
            setMakeupMode(false);
            setSelectedSources([]);
          }}
          className={`flex-1 py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
            !makeupMode
              ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200/50 dark:border-zinc-700"
              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
          }`}
        >
          <CalendarDays className={`h-4 w-4 ${!makeupMode ? "text-primary" : ""}`} />
          Regular Class Roll Call
        </button>

        <button
          type="button"
          onClick={() => setMakeupMode(true)}
          className={`flex-1 py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
            makeupMode
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Makeup / Rescheduled Class
        </button>
      </div>

      {/* Scope Card */}
      <div
        className={`bg-white dark:bg-zinc-950 border rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm transition-all ${
          makeupMode
            ? "border-indigo-200 dark:border-indigo-900/50 ring-1 ring-indigo-500/10"
            : "border-zinc-200 dark:border-zinc-800"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-900 pb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold">
              <MapPin className="w-3.5 h-3.5 text-rose-500" />
              Gulistan-e-Jauhar Campus
            </span>
            {makeupMode && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-indigo-800/50">
                <Sparkles className="w-3 h-3" /> Reschedule Mode
              </span>
            )}
          </div>
          <span className="text-xs text-zinc-400 font-mono">
            {formatRelativeDate(sessionDate)}
          </span>
        </div>

        {/* Form Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>
              <Layers className="h-3.5 w-3.5 text-zinc-400" /> Class
            </label>
            <div className="relative">
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className={selectCls}
              >
                <option value="">Select class…</option>
                {availableClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.class_code}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className={labelCls}>
              <Calendar className="h-3.5 w-3.5 text-zinc-400" />
              {makeupMode ? "Makeup Date (Held On)" : "Date"}
            </label>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className={selectCls}
            />
            {makeupMode && (
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                When the lesson is actually being held — any day, past or future.
              </p>
            )}
          </div>

          <div>
            <label className={labelCls}>
              <Clock className="h-3.5 w-3.5 text-zinc-400" /> Subject Group
            </label>
            <div className="relative">
              <select
                value={teachingGroupId}
                onChange={(e) => setTeachingGroupId(e.target.value)}
                disabled={!classId || groupsLoading}
                className={selectCls}
              >
                <option value="">
                  {groupsLoading ? "Loading subject groups…" : "Select subject group…"}
                </option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.subjects?.name} — {g.employee_profiles?.full_name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
            </div>
            {classId && !groupsLoading && groups.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                No active subject groups set up for this class yet.
              </p>
            )}
          </div>
        </div>

        {/* MAKEUP MODE SECTION */}
        {makeupMode && teachingGroupId && (
          <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-b from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-zinc-950 p-5 space-y-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-500" />
                  Select Original Timetable Slot(s) to Replace
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                  Pick the recurring slot(s) that were missed. Any weekday and any calendar
                  date works for both the missed lesson and the makeup session.
                </p>
              </div>

              {selectedSources.length > 0 && (
                <span className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-indigo-600 text-white">
                  {selectedSources.length} Slot{selectedSources.length === 1 ? "" : "s"} Selected
                </span>
              )}
            </div>

            {/* List of Eligible Timetable Slots */}
            {eligibleLoading ? (
              <div className="flex items-center gap-2 py-6 text-xs text-indigo-600 dark:text-indigo-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading timetable slots for {selectedGroup?.subjects?.name}…
              </div>
            ) : eligibleSlots.length === 0 ? (
              <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs">
                No regular timetable slots found for this subject group. Please configure the group&apos;s recurring timetable under Attendance → Timetables.
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                {slotsByWeekday.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    {slotsByWeekday.map((group) => {
                      const selectedCount = selectedSources.filter((p) => {
                        const slot = eligibleSlots.find((s) => s.id === p.slotId);
                        return slot?.day_of_week === group.dayOfWeek;
                      }).length;
                      const isActive = expandedSourceWeekday === group.dayOfWeek;

                      return (
                        <button
                          key={group.dayOfWeek}
                          type="button"
                          onClick={() => setExpandedSourceWeekday(group.dayOfWeek)}
                          className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                            isActive
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                              : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-indigo-300"
                          }`}
                        >
                          {group.dayLabel}
                          <span className="ml-1.5 opacity-80">
                            ({group.slots.length} session{group.slots.length === 1 ? "" : "s"}
                            {selectedCount > 0 ? ` · ${selectedCount} selected` : ""})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {slotsByWeekday.map((group) => {
                  if (expandedSourceWeekday !== group.dayOfWeek) return null;

                  const activeDate = getActiveDateForWeekday(
                    group.dayOfWeek,
                    group.defaultSourceDate,
                  );
                  const candidateDates = generateWeekdayOccurrences(
                    group.dayOfWeek,
                    sessionDate,
                    group.defaultSourceDate,
                    { minDateIso: minSourceDateIso },
                  );
                  const activeHoldStatus = holdStatusByWeekday[group.dayOfWeek]?.[activeDate];
                  const selectedOnDay = selectedSources.filter((p) => {
                    const slot = eligibleSlots.find((s) => s.id === p.slotId);
                    return slot?.day_of_week === group.dayOfWeek;
                  });
                  const allSelected = selectedOnDay.length === group.slots.length;

                  return (
                    <div
                      key={group.dayOfWeek}
                      className="rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-zinc-900 p-4 space-y-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            Missed {group.dayLabel} lessons → {makeupDayLabel} makeup
                          </h4>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            Choose which {group.dayLabel} session(s) are being held on{" "}
                            {formatRelativeDate(sessionDate)}.
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-100 dark:border-indigo-900">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Date: {formatRelativeDate(activeDate)}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-[11px] font-extrabold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                            Sessions on {group.dayLabel}
                          </label>
                          <label className="flex items-center gap-2 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={(e) =>
                                selectAllWeekdaySlots(
                                  group.dayOfWeek,
                                  group.slots,
                                  group.defaultSourceDate,
                                  e.target.checked,
                                )
                              }
                              className="h-3.5 w-3.5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            Select all
                          </label>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          {group.slots.map((slot) => {
                            const checked = selectedSources.some((p) => p.slotId === slot.id);
                            return (
                              <label
                                key={slot.id}
                                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                                  checked
                                    ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-500/20"
                                    : "border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-800"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => toggleSourceSlot(slot, e.target.checked)}
                                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                                      Period {slot.block_number}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                      {slot.time_label}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {slot.subject.name}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className="block text-[11px] font-extrabold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                              <CalendarRange className="h-3.5 w-3.5" />
                              Which {group.dayLabel} was missed?
                            </label>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold">
                              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                Class held
                              </span>
                              <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400">
                                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                                Missed
                              </span>
                              <span className="inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                                <span className="h-2.5 w-2.5 rounded-full bg-zinc-400" />
                                No school / skipped
                              </span>
                              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                                Upcoming
                              </span>
                              {holdStatusLoading && (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {candidateDates.map((item) => {
                              const isSelected = activeDate === item.dateIso;
                              const holdRow = holdStatusByWeekday[group.dayOfWeek]?.[item.dateIso];
                              const holdStatus = holdRow?.hold_status;
                              const pastLabel = sourceDateChipLabel(holdStatus, item);

                              return (
                                <button
                                  key={item.dateIso}
                                  type="button"
                                  onClick={() =>
                                    updateWeekdaySourceDate(group.dayOfWeek, item.dateIso)
                                  }
                                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center min-w-[90px] ${sourceDateChipClass(isSelected, holdStatus)}`}
                                >
                                  <span className="text-[10px] font-extrabold uppercase opacity-80">
                                    {item.weekdayLabel} • {item.label}
                                  </span>
                                  <span className="text-[10px] font-normal opacity-90 mt-0.5">
                                    {pastLabel}
                                  </span>
                                </button>
                              );
                            })}
                          </div>



                          <div>
                            <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                              Or enter any custom date (from August onward)
                            </label>
                            <input
                              type="date"
                              value={activeDate}
                              min={minSourceDateIso}
                              onChange={(e) =>
                                updateWeekdaySourceDate(group.dayOfWeek, e.target.value)
                              }
                              className="w-full h-10 px-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
                            />
                            {activeDate &&
                              new Date(`${activeDate}T00:00:00Z`).getUTCDay() !==
                                group.dayOfWeek && (
                                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1.5">
                                  This date is not a {group.dayLabel} — pick a date that falls on{" "}
                                  {group.dayLabel}.
                                </p>
                              )}
                          </div>
                        </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* VISUAL FLOW DIAGRAM BANNER */}
            {selectedSources.length > 0 && (
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/90 dark:bg-indigo-950/50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                  <Info className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>Reschedule Automation Preview</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-indigo-800 dark:text-indigo-300 pt-1">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-indigo-200 dark:border-indigo-800 shadow-sm">
                    <span className="font-bold">Original Missed Date(s):</span>
                    {selectedSources
                      .map((s) => formatRelativeDate(s.sourceDate))
                      .join(", ")}
                  </div>
                  <ArrowRight className="h-4 w-4 text-indigo-500" />
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-bold shadow-sm">
                    <span>Makeup: {formatRelativeDate(sessionDate)}</span>
                  </div>
                </div>
                <p className="text-[11px] text-indigo-700/90 dark:text-indigo-300/80 leading-relaxed pt-1">
                  • Students marked <strong>PRESENT</strong> will be automatically marked <strong>EXCUSED</strong> on their original missed slot date(s).<br />
                  • The teacher&apos;s staff register will also be automatically <strong>EXCUSED</strong> for the original slot date(s).
                </p>
              </div>
            )}
          </div>
        )}

        {/* Timetable Lesson Pills (Makeup Period Selection) */}
        {timetableMode && (
          <div className="space-y-2 pt-1 border-t border-zinc-100 dark:border-zinc-900">
            <label className={labelCls}>
              {makeupMode
                ? `Scheduled Lessons on ${formatRelativeDate(sessionDate)}`
                : "Scheduled Lessons for Today"}
            </label>
            <div className="flex flex-wrap gap-2">
              {slotPills.map(({ slot, block, pillLabel }) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => selectSlot(slot.id, block.block_number)}
                  disabled={daySlotsLoading || loading}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    selectedSlotId === slot.id
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                  }`}
                >
                  {pillLabel}
                </button>
              ))}
            </div>
          </div>
        )}

        {!timetableMode && teachingGroupId && (
          <div className="space-y-2 pt-1 border-t border-zinc-100 dark:border-zinc-900">
            <label className={labelCls}>Select Period</label>
            <div className="flex flex-wrap gap-1.5">
              {LEGACY_PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => selectLegacyPeriod(p)}
                  className={`h-9 px-4 rounded-xl text-xs font-bold border transition-all ${
                    period === p
                      ? "bg-primary text-white border-primary"
                      : "bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  Period {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Status badges */}
        {session && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-900">
            <span
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                session.status === "SUBMITTED"
                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
                  : session.status === "SKIPPED"
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                  : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800"
              }`}
            >
              Status: {session.status}
              {session.skip_reason ? ` (${session.skip_reason})` : ""}
            </span>

            {session.session_kind === "MAKEUP" && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800">
                <Sparkles className="w-3 h-3" /> Makeup Session Active
              </span>
            )}

            {session.reschedule_as_source?.status === "COMPLETED" && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-200 border border-sky-200 dark:border-sky-800">
                Covered by makeup on {session.reschedule_as_source.makeup_date?.slice(0, 10)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Roster & Attendance Marking Section */}
      {!isScopeReady ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50 px-6 py-16 text-center shadow-sm">
          <ClipboardList className="h-10 w-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-zinc-700 dark:text-zinc-300">
            {makeupMode ? "Configure Makeup Session Scope" : "Select Class Scope"}
          </h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 max-w-md mx-auto">
            {makeupMode
              ? "Select class, makeup date (any day), subject group, and pick at least one missed slot to open roll call."
              : "Select class, date, and subject group to begin roll call."}
          </p>
        </div>
      ) : loading || daySlotsLoading ? (
        <div className="flex flex-col items-center py-20 bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <Loader2 className="h-9 w-9 text-indigo-600 animate-spin" />
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mt-3">
            {daySlotsLoading ? "Loading schedule..." : "Loading student roster..."}
          </p>
        </div>
      ) : !session ? null : (
        <div className="space-y-4">
          {/* Action Header */}
          <div className="flex flex-wrap items-center justify-between px-1 gap-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Student Roster ({roster.length})
              </p>
            </div>

            <div className="flex items-center gap-3">
              {canEdit && roster.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      userEditedMarks.current = true;
                      setMarks(
                        Object.fromEntries(
                          roster.map((r) => [r.student.cc, "PRESENT" as RollRecordStatus])
                        )
                      );
                    }}
                    disabled={presentCount === roster.length}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 disabled:opacity-40 transition-colors"
                  >
                    <UserCheck className="h-3.5 w-3.5" /> All Present
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      userEditedMarks.current = true;
                      setMarks({});
                    }}
                    disabled={presentCount === 0}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 disabled:opacity-40 transition-colors"
                  >
                    <UserX className="h-3.5 w-3.5" /> All Absent
                  </button>
                </div>
              )}

              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {presentCount} / {roster.length} Present
              </span>
            </div>
          </div>

          {/* Student Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {roster.length === 0 ? (
              <div className="col-span-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-12 text-center text-zinc-500 dark:text-zinc-400 text-sm">
                No students currently enrolled in this teaching group.
              </div>
            ) : (
              (() => {
                const sourcePresent = getSourcePresentStudents();
                return roster.map((row) => {
                  const isPresent = marks[row.student.cc] === "PRESENT";
                  const wasPresentOnSource =
                    makeupMode &&
                    ((row.student.cc && sourcePresent.ccs.has(row.student.cc)) ||
                      (row.student.gr_number && sourcePresent.grs.has(row.student.gr_number)));

                  return (
                    <button
                      key={row.student.cc}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => togglePresent(row.student.cc)}
                      className={`flex items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all active:scale-[0.99] disabled:active:scale-100 ${
                        isPresent
                          ? "bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 shadow-sm"
                          : "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                      } ${!canEdit ? "opacity-75 cursor-not-allowed" : ""}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                          {row.student.full_name}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="text-xs text-zinc-400 font-mono">
                            GR# {row.student.gr_number ?? "—"}
                          </span>
                          {wasPresentOnSource && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 px-2 py-0.5 rounded-md">
                              <UserCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              Present on original date
                            </span>
                          )}
                        </div>
                      </div>

                      <span
                        className={`shrink-0 flex items-center justify-center h-8 w-8 rounded-xl border-2 transition-all ${
                          isPresent
                            ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                            : "bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-transparent"
                        }`}
                      >
                        <Check className="h-4 w-4 stroke-[3]" />
                      </span>
                    </button>
                  );
                });
              })()
            )}
          </div>

          {/* Skip Form Modal Card */}
          {showSkip && canMark && session.status === "DRAFT" && (
            <div className="bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-3 shadow-md animate-in fade-in">
              <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200">
                Reason for Skipping Session
              </label>
              <textarea
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                rows={2}
                className="w-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl px-3 py-2 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="e.g. Teacher absent or emergency schedule change..."
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowSkip(false)}
                  className="px-4 py-2 text-xs font-semibold border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={saving || !skipReason.trim()}
                  className="px-4 py-2 text-xs font-semibold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl disabled:opacity-50"
                >
                  Confirm Skip
                </button>
              </div>
            </div>
          )}

          {isLocked && (
            isSubmitted && canEditLocked ? (
              <div className="flex flex-col items-center gap-2 py-3">
                <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
                  This roll call has been submitted and recorded.
                </p>
                <button
                  type="button"
                  onClick={() => setEditSubmitted(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit / correct this roll call
                </button>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center py-2">
                {isHolidaySkip
                  ? "This day is marked as a holiday / day off, so attendance cannot be recorded."
                  : "This session is locked. Contact an administrator with edit_locked permission to modify submitted roll call records."}
              </p>
            )
          )}

          {editingSubmitted && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3">
              <Pencil className="h-4 w-4 text-amber-700 dark:text-amber-300 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-800 dark:text-amber-200">
                <p className="font-bold">Editing a submitted roll call</p>
                <p className="mt-0.5 text-amber-700/90 dark:text-amber-300/80">
                  Your changes overwrite the recorded attendance. Use{" "}
                  <span className="font-semibold">Save &amp; re-submit</span> to keep it finalized, or{" "}
                  <button
                    type="button"
                    onClick={() => setEditSubmitted(false)}
                    className="font-semibold underline underline-offset-2"
                  >
                    cancel
                  </button>{" "}
                  to leave it unchanged.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sticky Bottom Action Bar */}
      {canEdit && roster.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 sm:static bg-white/95 dark:bg-zinc-950/95 backdrop-blur border-t sm:border-t-0 border-zinc-200 dark:border-zinc-800 p-4 sm:p-0 sm:mt-6 flex gap-3 shadow-[0_-8px_20px_rgba(0,0,0,0.08)] sm:shadow-none z-30">
          {!editingSubmitted && (
            <button
              type="button"
              onClick={() => setShowSkip((v) => !v)}
              title="Skip session"
              className="px-3.5 py-3 sm:py-3 text-sm border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 flex items-center justify-center transition-colors shadow-sm"
            >
              <SkipForward className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving}
            className="flex-1 py-3 text-sm border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800/80 disabled:opacity-50 transition-all shadow-sm"
          >
            {editingSubmitted ? "Save Changes" : "Save Draft"}
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-[2] py-3 text-sm font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />{" "}
                {editingSubmitted ? "Saving..." : "Submitting..."}
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />{" "}
                {editingSubmitted ? "Save & Re-submit" : "Submit Roll Call"}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default function RollCallPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      }
    >
      <RollCallPageInner />
    </Suspense>
  );
}
