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
  employee_class_section_assignments?: { classes?: { segments?: SegmentInfo | null } | null }[] | null;
};

/**
 * The segments a staff member belongs to, for grouping and filtering.
 *
 * The segment on the employee's profile (employee_profiles.segment_id) comes
 * first — it's the one HR sets. Segments of the classes they're assigned to
 * are added on top, so a teacher spread across segments shows under each.
 * Reading only the class assignments left anyone without one (new teachers,
 * subject teachers not yet allocated) as "No segment assigned" even with a
 * segment on their profile (TAFSD-273).
 */
export function employeeSegments(emp: SegmentSource): SegmentInfo[] {
  const byId = new Map<number, SegmentInfo>();
  if (emp.segments) byId.set(emp.segments.id, emp.segments);
  for (const a of emp.employee_class_section_assignments ?? []) {
    const s = a.classes?.segments;
    if (s) byId.set(s.id, s);
  }
  return byId.size > 0 ? [...byId.values()] : [UNASSIGNED_SEGMENT];
}
