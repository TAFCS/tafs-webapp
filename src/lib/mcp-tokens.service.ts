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
