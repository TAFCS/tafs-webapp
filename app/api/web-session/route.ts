import { NextResponse } from 'next/server';

/**
 * Presence-flag cookie for Next.js middleware.
 *
 * The Nest login/refresh rewrite also sets `tafs_session` on this host via
 * Set-Cookie. This route is a belt-and-suspenders mint/clear so middleware
 * still sees a same-origin flag if the rewrite cookie is missing (e.g. a
 * partial failure). It is only a routing signal — JWT validation still
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
