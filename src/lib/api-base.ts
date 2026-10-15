/**
 * Resolve the axios base URL for the TAFS API.
 *
 * Locally NEXT_PUBLIC_API_URL points at localhost — the browser keeps using
 * same-origin `/api` so Next rewrites stay loopback and auth cookies land on
 * the Next host (middleware can read `tafs_session`).
 *
 * In production the env URL is the Railway origin. Hitting it directly avoids
 * the Vercel→Railway rewrite hop on every REST call.
 */

/** Same fallback as next.config.ts rewrites — used when env is unset at build. */
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

function configuredApiUrl(): string | undefined {
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (envUrl) return envUrl;
  // Client bundle on Vercel: prefer direct Railway even if the env var was
  // missing at build time (rewrite destination already used this fallback).
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return PROD_API_FALLBACK;
  }
  return undefined;
}

/** Absolute API origin (scheme + host), or null when using the local rewrite. */
export function getApiOrigin(): string | null {
  const envUrl = configuredApiUrl();
  if (!envUrl || isLocalApiUrl(envUrl)) return null;
  try {
    return new URL(envUrl).origin;
  } catch {
    return null;
  }
}

export function resolveApiBaseURL(): string | undefined {
  const envUrl = configuredApiUrl();

  // Server-side (RSC / route handlers): call the backend directly when configured.
  if (typeof window === 'undefined') {
    return envUrl || process.env.NEXT_PUBLIC_API_URL;
  }

  // Browser, production: talk to Railway (or whatever NEXT_PUBLIC_API_URL is).
  if (envUrl && !isLocalApiUrl(envUrl)) {
    return envUrl;
  }

  // Browser, local: same-origin rewrite via next.config.ts.
  return '/api';
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
