export interface SegmentInfo {
  id: number;
  code: string;
  name: string;
  display_order: number;
}

export const UNASSIGNED_SEGMENT: SegmentInfo = {
  id: 0,
  code: "UNASSIGNED",
  name: "No segment assigned",
  display_order: 999,
};

type SegmentSource = {
  segments?: SegmentInfo | null;
};

/**
 * The segment a staff member belongs to, for grouping and filtering: strictly
 * the segment on their profile (employee_profiles.segment_id) and nothing
 * else — class-section assignments do not count (TAFSD-273). No segment on
 * the profile means "No segment assigned".
 */
export function employeeSegments(emp: SegmentSource): SegmentInfo[] {
  return emp.segments ? [emp.segments] : [UNASSIGNED_SEGMENT];
}
