/** O-Level class IDs in TAFS (OI, OII, OIII). */
export const O_LEVEL_CLASS_IDS = [12, 13, 14] as const;

export function isOLevelClass(classId: number): boolean {
  return (O_LEVEL_CLASS_IDS as readonly number[]).includes(classId);
}

export function isOLevelClassCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return ['OI', 'OII', 'OIII'].includes(code.toUpperCase());
}
