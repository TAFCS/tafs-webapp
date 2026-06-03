/**
 * Class bands for principal scope — must match `classes.id` in the database.
 * Cambridge: 1=PN, 2=NUR, 3=KG, 4–8=JR, 9–11=SR, 12–14=O
 * Secondary: 15–19=VI–X | A-Level: 21=AS, 22=A2
 */
export const CLASS_BANDS = [
  { label: 'PN–KG', ids: [1, 2, 3] },
  { label: 'Jr I–II', ids: [4, 5] },
  { label: 'Jr III–V', ids: [6, 7, 8] },
  { label: 'Sr I–III', ids: [9, 10, 11] },
  { label: 'VI–X', ids: [15, 16, 17, 18, 19] },
  { label: 'O/A Levels', ids: [12, 13, 14, 21, 22] },
] as const;

export function classBandLabel(ids: number[]): string | null {
  if (!ids.length) return null;
  const sorted = [...ids].sort((a, b) => a - b).join(',');
  const band = CLASS_BANDS.find(
    (b) => [...b.ids].sort((a, c) => a - c).join(',') === sorted,
  );
  return band?.label ?? `Classes ${ids.join(', ')}`;
}

export function filterClassesByScope<T extends { id: number }>(
  classes: T[],
  allowedClassIds: number[] | undefined,
): T[] {
  if (!allowedClassIds?.length) return classes;
  const set = new Set(allowedClassIds);
  return classes.filter((c) => set.has(c.id));
}
