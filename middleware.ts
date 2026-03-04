import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Server-side route protection.
 *
 * Checks for the `tafs_session` cookie. This cookie is set as httpOnly by the
 * backend (Set-Cookie header) on login/refresh and cleared on logout —
 * JavaScript cannot read, forge, or clear it.
 *
 * Actual JWT validation still happens per-request at the API layer.
 * The cookie here is only a routing signal.
 */
export function middleware(request: NextRequest) {
    const session = request.cookies.get('tafs_session');

    if (!session) {
        const loginUrl = new URL('/auth/login', request.url);
        // Preserve the intended destination so we can redirect back after login
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
     *  - /api/* (backend proxy routes)
     *  - root public assets (favicon.ico, etc.)
     */
    matcher: ['/((?!auth|api|_next/static|_next/image|favicon\\.ico).*)'],
};
