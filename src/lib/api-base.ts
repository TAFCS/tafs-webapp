/**
 * Resolve the axios base URL for the TAFS API.
 *
 * The browser always uses same-origin `/api` so auth cookies (Set-Cookie from
 * the Nest rewrite) land on the Next host. Middleware can read `tafs_session`,
 * and browsers will not treat the cookies as third-party (which broke login
 * when the client called Railway directly).
 *
 * Server-side callers use NEXT_PUBLIC_API_URL when set.
 */

/** Same fallback as next.config.ts rewrites. */
const PROD_API_FALLBACK = 'https://tafs-backend-production.up.railway.app/api';

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  );
}

export function isLocalApiUrl(url: string | undefined): boolean {
  if (!url) return true;
  try {
    return isLoopbackHost(new URL(url).hostname);
  } catch {
    return true;
  }
}

/** Absolute API origin for sockets / server-side, or null for local rewrite. */
export function getApiOrigin(): string | null {
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim() || PROD_API_FALLBACK;
  if (isLocalApiUrl(process.env.NEXT_PUBLIC_API_URL?.trim())) {
    // Prefer explicit local URL when configured; otherwise null → caller fallback.
    const local = process.env.NEXT_PUBLIC_API_URL?.trim();
    if (!local) return null;
    try {
      return new URL(local).origin;
    } catch {
      return null;
    }
  }
  try {
    return new URL(envUrl).origin;
  } catch {
    return null;
  }
}

export function resolveApiBaseURL(): string | undefined {
  // Browser: always same-origin proxy — cookies must stay on the webapp host.
  if (typeof window !== 'undefined') {
    return '/api';
  }

  // Server-side (RSC / route handlers)
  return process.env.NEXT_PUBLIC_API_URL?.trim() || PROD_API_FALLBACK;
}

/**
 * Absolute URL for browser resource tags (`<img>`, `<audio>`) that must hit
 * the API (e.g. authenticated media proxy). Uses the same base as axios.
 */
export function apiResourceUrl(path: string): string {
  const base = resolveApiBaseURL() || '/api';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base.replace(/\/$/, '')}${normalized}`;
}
