'use client';

import { ALevelMakeupPanel } from './ALevelMakeupPanel';
import type { TimetableBlock, TimetableSlot } from '@/lib/timetables.service';
import type { TeachingGroup } from '@/lib/teaching-groups.service';
import type { MakeupSlotCellStatus, RescheduleLinkInfo } from '@/lib/makeup-calendar';
import type { SourceDatePresentStudent } from '@/lib/class-reschedules.service';
import type { MakeupCalendarMode } from './TimetableGrid';

export type AlevelSourcePick = { slotId: number; sourceDate: string };

interface Props {
  campusId: number;
  classId: number;
  teachingGroupId: number;
  selectedGroup?: TeachingGroup;
  slots: TimetableSlot[];
  blocks: TimetableBlock[];
  canMarkRoll: boolean;
  canViewRoll: boolean;
  canEditLocked: boolean;
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
  campusId,
  classId,
  teachingGroupId,
  selectedGroup,
  slots,
  blocks,
  canMarkRoll,
  canViewRoll,
  canEditLocked,
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
