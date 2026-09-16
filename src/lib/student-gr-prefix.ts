/**
 * Student G.R. (General Register) prefixes — separate from employee codes.
 * Employee HR uses `campuses.campus_prefix` (GEJ, GKF, …) via `@/lib/employee-code`.
 * Never read campus_prefix here.
 */

export function getStudentGrPrefix(
  campusName: string | undefined,
  campusId?: number | null,
  academicSystem?: string,
): string {
  const isALevel = academicSystem?.toLowerCase().replace(/[^a-z]/g, "") === "alevel";
  if (isALevel) return "A-";
  if (!campusName && campusId == null) return "";
  const name = (campusName ?? "").toUpperCase();
  if (name.includes("KANEEZ FATIMA") || campusId === 2) return "KF-A";
  if (name.includes("NORTH NAZIMABAD") || campusId === 3) return "A-N";
  return "";
}
