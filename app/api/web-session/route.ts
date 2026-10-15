import { NextResponse } from 'next/server';

/**
 * Presence-flag cookie for Next.js middleware.
 *
 * Auth tokens (`tafs_access` / `tafs_refresh`) live on the API origin (Railway
 * in production). Middleware on the Vercel host cannot read those cookies, so
 * the webapp mints a same-origin `tafs_session` flag after login/refresh and
 * clears it on logout. It is only a routing signal — JWT validation still
 * happens on every API request.
 */

const SESSION_MAX_AGE = 90 * 24 * 60 * 60; // match ACCESS/REFRESH TTL (90 days)

function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('tafs_session', '1', sessionCookieOptions(SESSION_MAX_AGE));
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('tafs_session', '', sessionCookieOptions(0));
  return res;
}
