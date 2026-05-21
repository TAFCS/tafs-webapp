import type { CampusClass } from "@/store/slices/campusesSlice";

/** AS (21) and A2 (22) — A-Level roll call classes */
export const ALEVEL_CLASS_IDS = new Set([21, 22]);

export function isAsA2Class(cls: CampusClass): boolean {
  if (ALEVEL_CLASS_IDS.has(cls.id)) return true;
  if (cls.academic_system === "A-Level") return true;
  const code = (cls.class_code ?? "").trim().toUpperCase();
  return code === "AS" || code === "A2";
}
