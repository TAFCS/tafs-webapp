import api from "./api";
import { getApiOrigin } from "./api-base";

/**
 * TAFSD-531: personal access tokens for the admin MCP server. The backend
 * decides everything (who may issue, expiry limits, what the assistant can
 * see); this only carries requests.
 */
export interface McpToken {
    id: string;
    name: string;
    token_prefix: string;
    created_at: string;
    expires_at: string;
    last_used_at: string | null;
    revoked_at: string | null;
    status: "active" | "expired" | "revoked";
}

export interface IssuedMcpToken extends McpToken {
    /** Shown once. The backend keeps only its hash. */
    token: string;
}

export const MCP_TOKEN_MAX_DAYS = 90;

export async function listMcpTokens(): Promise<McpToken[]> {
    const { data } = await api.get("/v1/mcp/tokens");
    return data?.data ?? [];
}

export async function issueMcpToken(name: string, expiresInDays: number): Promise<IssuedMcpToken> {
    const { data } = await api.post("/v1/mcp/tokens", { name, expires_in_days: expiresInDays });
    return data.data;
}

export async function revokeMcpToken(id: string): Promise<McpToken> {
    const { data } = await api.delete(`/v1/mcp/tokens/${id}`);
    return data.data;
}

/** The URL an MCP client connects to: the backend itself, not the webapp's proxy. */
export function mcpEndpointUrl(): string {
    const origin = getApiOrigin() ?? (typeof window !== "undefined" ? window.location.origin : "");
    return `${origin}/api/v1/mcp`;
}

/** An app connected by OAuth sign-in (an MCP OAuth grant). */
export interface McpGrant {
    id: string;
    client_id: string;
    client_name: string;
    client_uri: string | null;
    redirect_hosts: string[];
    scope: string;
    created_at: string;
    expires_at: string;
    last_used_at: string | null;
    revoked_at: string | null;
    revoked_reason: string | null;
    status: "active" | "expired" | "revoked";
}

export async function listMcpGrants(): Promise<McpGrant[]> {
    const { data } = await api.get("/v1/mcp/grants");
    return data?.data ?? [];
}

export async function revokeMcpGrant(id: string): Promise<McpGrant> {
    const { data } = await api.delete(`/v1/mcp/grants/${id}`);
    return data.data;
}

/** What the consent screen shows: the app asking, who it would act as, and their tools. */
export interface McpConsentRequest {
    client: { id: string; name: string; name_verified: boolean; uri: string | null; redirect_host: string };
    acting_as: { username: string; full_name: string | null };
    scope: string;
    allowed: boolean;
    blocked_reason: "no_tile" | "impersonating" | null;
    tools: { name: string; title?: string; description?: string }[];
}

export async function getMcpConsent(ticket: string): Promise<McpConsentRequest> {
    const { data } = await api.get("/v1/mcp/oauth/consent", { params: { ticket } });
    return data.data;
}

/** Approve or deny. Answers the URL to send the browser back to the app. */
export async function decideMcpConsent(ticket: string, decision: "approve" | "deny"): Promise<string> {
    const { data } = await api.post("/v1/mcp/oauth/consent", { ticket, decision });
    return data.data.redirect_to;
}
