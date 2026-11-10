// Routes that stay public even when there's no session: nothing that runs on
// them may bounce a signed-out visitor to /auth/login. Google Play reviews the
// privacy policy signed out (TAFSD-501).
export const PUBLIC_PATHS = ['/auth', '/privacy-policy'];

export function isPublicPath(pathname: string): boolean {
    return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}
