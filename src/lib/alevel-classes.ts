import type { CampusClass } from "@/store/slices/campusesSlice";

/** AS (20) and A2 (21) — A-Level roll call classes */
export const ALEVEL_CLASS_IDS = new Set([20, 21]);

export function isAsA2Class(cls: CampusClass): boolean {
  if (ALEVEL_CLASS_IDS.has(cls.id)) return true;
  if (cls.academic_system === "A-Level") return true;
  const code = (cls.class_code ?? "").trim().toUpperCase();
  return code === "AS" || code === "A2";
}
