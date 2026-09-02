'use client';

import { OLevelMakeupPanel } from './OLevelMakeupPanel';
import { ALevelMakeupPanel } from './ALevelMakeupPanel';
import type { TimetableSlot } from '@/lib/timetables.service';
import type { TeachingGroup } from '@/lib/teaching-groups.service';

interface Props {
  variant: 'olevel' | 'alevel';
  campusId: number;
  classId: number;
  sectionId?: number;
  teachingGroupId?: number;
  selectedGroup?: TeachingGroup;
  effectiveFrom: string | null;
  slots: TimetableSlot[];
  canMarkStaff: boolean;
  canMarkRoll: boolean;
  canViewRoll: boolean;
  canEditLocked: boolean;
  onPendingSlotIdsChange: (ids: number[]) => void;
  onMakeupSlotClick: (slot: TimetableSlot) => void;
  selectedMakeupSlot: TimetableSlot | null;
  onClearMakeupSlot: () => void;
  alevelSelectedSlotIds: number[];
  onClearAlevelSelection: () => void;
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
  canMarkStaff,
  canMarkRoll,
  canViewRoll,
  canEditLocked,
  onPendingSlotIdsChange,
  onMakeupSlotClick,
  selectedMakeupSlot,
  onClearMakeupSlot,
  alevelSelectedSlotIds,
  onClearAlevelSelection,
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
        canMark={canMarkRoll}
        canView={canViewRoll}
        canEditLocked={canEditLocked}
        onSlotClick={onMakeupSlotClick}
        selectedSlotIds={alevelSelectedSlotIds}
        onPendingSlotIdsChange={onPendingSlotIdsChange}
        onSelectionClear={onClearAlevelSelection}
      />
    );
  }

  return null;
}
