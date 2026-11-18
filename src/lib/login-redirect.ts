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
