import type { Segment } from "./hr.service";

/**
 * Not every campus runs every segment — Gulistan-e-Johar runs all of them,
 * Kaneez Fatima and North Nazimabad only Pre-Primary and Junior Cambridge.
 * The mapping lives in `campus_segments` and rides along on each segment as
 * `campus_ids`, so a page that loaded the full list once can narrow it locally
 * as the user switches campus.
 *
 * Narrows `segments` to the ones offered at `campusId`.
 *
 * - No campus picked (`null`): returns everything. A picker cannot be narrowed
 *   by a campus nobody chose, and an unnarrowed list is the honest default.
 * - A campus with nothing configured: returns everything, matching the
 *   backend, which treats an unconfigured campus as unrestricted rather than
 *   leaving its picker mysteriously empty.
 */
export function segmentsForCampus(segments: Segment[], campusId: number | null | undefined): Segment[] {
  if (!campusId) return segments;
  // A payload without campus_ids predates the mapping — do not filter on it.
  if (!segments.some((s) => Array.isArray(s.campus_ids))) return segments;
  const offered = segments.filter((s) => s.campus_ids?.includes(campusId));
  return offered.length > 0 ? offered : segments;
}

/** Union of the segments offered across `campusIds`; empty selection means all. */
export function segmentsForCampuses(segments: Segment[], campusIds: number[]): Segment[] {
  if (campusIds.length === 0) return segments;
  if (!segments.some((s) => Array.isArray(s.campus_ids))) return segments;
  const offered = segments.filter((s) => s.campus_ids?.some((id) => campusIds.includes(id)));
  return offered.length > 0 ? offered : segments;
}

/** True when `segmentId` may be assigned to someone posted at `campusId`. */
export function isSegmentOfferedAtCampus(
  segments: Segment[],
  campusId: number | null | undefined,
  segmentId: number | null | undefined,
): boolean {
  if (!segmentId || !campusId) return true;
  return segmentsForCampus(segments, campusId).some((s) => s.id === segmentId);
}
