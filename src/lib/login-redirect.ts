/**
 * The login URL that brings the person back to where they are after signing
 * in, query string included (the MCP consent page carries its ticket there).
 * Same shape middleware.ts produces for a signed-out visit.
 */
export function loginUrlReturningHere(): string {
    if (typeof window === "undefined") return "/auth/login";
    const here = window.location.pathname + window.location.search;
    return `/auth/login?redirect=${encodeURIComponent(here)}`;
}

/**
 * Where to go after login, given the `redirect` parameter: a path on this
 * site, or null. The parameter comes from the URL, so it is resolved the way
 * the browser would resolve it and kept only if it stays on `origin`. String
 * checks are not enough: `/\evil.com`, `/<TAB>/evil.com` and `//evil.com` all
 * start with `/` and all leave the site.
 */
export function safeRedirectPath(raw: string | null | undefined, origin: string): string | null {
    if (!raw || !raw.startsWith("/")) return null;
    let resolved: URL;
    try {
        resolved = new URL(raw, origin);
    } catch {
        return null;
    }
    if (resolved.origin !== new URL(origin).origin) return null;
    return resolved.pathname + resolved.search + resolved.hash;
}
