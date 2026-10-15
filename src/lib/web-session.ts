/**
 * Sync the Vercel-side `tafs_session` presence cookie with the API session.
 * No-ops outside the browser. Failures are non-fatal — middleware may bounce
 * once; AuthProvider will still restore from the API cookies.
 */

export async function markWebSession(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api/web-session', { method: 'POST', credentials: 'same-origin' });
  } catch {
    // ignore
  }
}

export async function clearWebSession(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api/web-session', { method: 'DELETE', credentials: 'same-origin' });
  } catch {
    // ignore
  }
}
