/** Toggle membership of `id` in a multi-select filter array. */
export function toggleId<T extends string | number>(prev: T[], id: T): T[] {
  return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
}

/** Serialize selected IDs as a comma-separated query param, or undefined when empty. */
export function serializeIds(ids: Array<string | number>): string | undefined {
  return ids.length > 0 ? ids.join(",") : undefined;
}
