'use client';

import { OLevelMakeupPanel } from './OLevelMakeupPanel';
import { ALevelMakeupPanel } from './ALevelMakeupPanel';
import type { TimetableBlock, TimetableSlot } from '@/lib/timetables.service';
import type { TeachingGroup } from '@/lib/teaching-groups.service';
import type { MakeupSlotCellStatus, RescheduleLinkInfo } from '@/lib/makeup-calendar';
import type { SourceDatePresentStudent } from '@/lib/class-reschedules.service';
import type { MakeupCalendarMode } from './TimetableGrid';

export type AlevelSourcePick = { slotId: number; sourceDate: string };

interface Props {
  variant: 'olevel' | 'alevel';
  campusId: number;
  classId: number;
  sectionId?: number;
  teachingGroupId?: number;
  selectedGroup?: TeachingGroup;
  effectiveFrom: string | null;
  slots: TimetableSlot[];
  blocks: TimetableBlock[];
  canMarkStaff: boolean;
  canMarkRoll: boolean;
  canViewRoll: boolean;
  canEditLocked: boolean;
  onPendingSlotIdsChange: (ids: number[]) => void;
  onMakeupSlotClick: (slot: TimetableSlot, dateIso?: string) => void;
  selectedMakeupSlot: TimetableSlot | null;
  initialMakeupSourceDate?: string;
  onClearMakeupSlot: () => void;
  alevelSelectedSources: AlevelSourcePick[];
  onAlevelSelectedSourcesChange: (sources: AlevelSourcePick[]) => void;
  onClearAlevelSelection: () => void;
  onRescheduleCreated?: () => void;
  makeupDate: string;
  onMakeupDateChange: (dateIso: string) => void;
  makeupBlockNumber: number | null;
  onMakeupBlockNumberChange: (blockNumber: number | null) => void;
  attendanceSlot: TimetableSlot | null;
  attendanceDateIso: string;
  attendanceCellStatus: MakeupSlotCellStatus | null;
  attendanceRescheduleLink?: RescheduleLinkInfo;
  initialPresentStudents?: SourceDatePresentStudent[];
  onAttendanceSaved: () => void;
  onMakeupDeleted?: () => void;
  calendarMode?: MakeupCalendarMode;
}

export function MakeupReschedulePanel({
  variant,
  campusId,
  classId,
  sectionId,
  teachingGroupId,
  selectedGroup,
  effectiveFrom,
  slots,
  blocks,
  canMarkStaff,
  canMarkRoll,
  canViewRoll,
  canEditLocked,
  onPendingSlotIdsChange,
  onMakeupSlotClick,
  selectedMakeupSlot,
  initialMakeupSourceDate,
  onClearMakeupSlot,
  alevelSelectedSources,
  onAlevelSelectedSourcesChange,
  onClearAlevelSelection,
  onRescheduleCreated,
  makeupDate,
  onMakeupDateChange,
  makeupBlockNumber,
  onMakeupBlockNumberChange,
  attendanceSlot,
  attendanceDateIso,
  attendanceCellStatus,
  attendanceRescheduleLink,
  initialPresentStudents,
  onAttendanceSaved,
  onMakeupDeleted,
  calendarMode = 'schedule',
}: Props) {
  if (variant === 'olevel' && sectionId != null) {
    return (
      <OLevelMakeupPanel
        campusId={campusId}
        classId={classId}
        sectionId={sectionId}
        effectiveFrom={effectiveFrom}
        slots={slots}
        canMark={canMarkStaff}
        selectedSlot={selectedMakeupSlot}
        initialSourceDate={initialMakeupSourceDate}
        onClearSelectedSlot={onClearMakeupSlot}
        onPendingSlotIdsChange={onPendingSlotIdsChange}
      />
    );
  }

  if (variant === 'alevel' && teachingGroupId != null) {
    return (
      <ALevelMakeupPanel
        campusId={campusId}
        classId={classId}
        teachingGroupId={teachingGroupId}
        selectedGroup={selectedGroup}
        slots={slots}
        blocks={blocks}
        canMark={canMarkRoll}
        canView={canViewRoll}
        selectedSources={alevelSelectedSources}
        onSelectedSourcesChange={onAlevelSelectedSourcesChange}
        onSelectionClear={onClearAlevelSelection}
        onRescheduleCreated={onRescheduleCreated}
        makeupDate={makeupDate}
        onMakeupDateChange={onMakeupDateChange}
        makeupBlockNumber={makeupBlockNumber}
        onMakeupBlockNumberChange={onMakeupBlockNumberChange}
        attendanceSlot={attendanceSlot}
        attendanceDateIso={attendanceDateIso}
        attendanceCellStatus={attendanceCellStatus}
        attendanceRescheduleLink={attendanceRescheduleLink}
        initialPresentStudents={initialPresentStudents}
        onAttendanceSaved={onAttendanceSaved}
        onMakeupDeleted={onMakeupDeleted}
        calendarMode={calendarMode}
      />
    );
  }

  return null;
}
