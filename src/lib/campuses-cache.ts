/**
 * Short TTL cache for GET /v1/campuses — every dashboard page that mounts a
 * campus picker used to re-hit the network. Shared by campusesService and the
 * Redux thunk.
 */

const TTL_MS = 60_000;

let cached: { at: number; data: unknown } | null = null;
let inflight: Promise<unknown> | null = null;

export function getCachedCampuses<T>(): T | null {
  if (!cached) return null;
  if (Date.now() - cached.at > TTL_MS) {
    cached = null;
    return null;
  }
  return cached.data as T;
}

export function setCachedCampuses(data: unknown): void {
  cached = { at: Date.now(), data };
}

export function invalidateCampusesCache(): void {
  cached = null;
  inflight = null;
}

/** Deduplicate concurrent list fetches while a request is in flight. */
export async function fetchCampusesOnce<T>(loader: () => Promise<T>): Promise<T> {
  const hit = getCachedCampuses<T>();
  if (hit) return hit;

  if (inflight) return inflight as Promise<T>;

  inflight = loader()
    .then((data) => {
      setCachedCampuses(data);
      return data;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight as Promise<T>;
}
