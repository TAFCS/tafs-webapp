import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Server-side route protection.
 *
 * Checks for the `tafs_session` cookie. This cookie is set as httpOnly by the
 * backend (Set-Cookie header) on login/refresh and cleared on logout —
 * JavaScript cannot read, forge, or clear it.
 *
 * In production the API lives on a different origin, so the webapp also mints
 * a same-origin `tafs_session` via POST /api/web-session after login/refresh.
 *
 * Actual JWT validation still happens per-request at the API layer.
 * The cookie here is only a routing signal.
 */
export function middleware(request: NextRequest) {
    const session = request.cookies.get('tafs_session');
    const isRoot = request.nextUrl.pathname === '/';

    if (request.nextUrl.pathname === '/privacy-policy') {
        return NextResponse.next();
    }

    if (isRoot) {
        if (session) {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        } else {
            return NextResponse.redirect(new URL('/auth/login', request.url));
        }
    }

    if (!session) {
        const loginUrl = new URL('/auth/login', request.url);
        loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    /**
     * Protect all routes except:
     *  - /auth/* (login, register)
     *  - Next.js internal paths (_next/static, _next/image)
     *  - /api/* (backend proxy + Next route handlers)
     *  - static public assets (logos, favicon, etc.)
     */
    matcher: [
        '/((?!auth|api|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|mp4|webm|woff2?)$).*)',
    ],
};
