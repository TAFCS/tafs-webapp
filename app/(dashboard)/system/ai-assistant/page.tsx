"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookMarked, Bot, Copy, KeyRound, Link2, Loader2, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import {
    IssuedMcpToken,
    MCP_TOKEN_MAX_DAYS,
    McpGrant,
    McpToken,
    issueMcpToken,
    listMcpGrants,
    listMcpTokens,
    fetchMcpServerEndpoint,
    mcpEndpointUrl,
    revokeMcpGrant,
    revokeMcpToken,
} from "@/lib/mcp-tokens.service";

const STATUS_STYLE: Record<McpToken["status"] | McpGrant["status"], string> = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    expired: "bg-zinc-100 text-zinc-500 border-zinc-200",
    revoked: "bg-rose-50 text-rose-700 border-rose-200",
};

const when = (iso: string | null) => (iso ? format(new Date(iso), "dd MMM yyyy, hh:mm a") : "Never");

async function copy(text: string, label: string) {
    try {
        await navigator.clipboard.writeText(text);
        toast.success(`${label} copied`);
    } catch {
        toast.error("Could not copy; select the text and copy it");
    }
}

/**
 * TAFSD-531: AI Assistant (MCP). A person issues tokens for their own AI
 * assistant here. The assistant sees only what this person can already see:
 * their tiles decide which tools exist and their scope decides which records.
 */
export default function AiAssistantPage() {
    const [tokens, setTokens] = useState<McpToken[]>([]);
    const [grants, setGrants] = useState<McpGrant[]>([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState("");
    const [days, setDays] = useState(30);
    const [issuing, setIssuing] = useState(false);
    const [issued, setIssued] = useState<IssuedMcpToken | null>(null);
    // The public address sign-in is bound to (TAFSD-531); the API origin is only a fallback.
    const [serverEndpoint, setServerEndpoint] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;
        fetchMcpServerEndpoint().then((url) => {
            if (alive) setServerEndpoint(url);
        });
        return () => {
            alive = false;
        };
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [t, g] = await Promise.all([listMcpTokens(), listMcpGrants()]);
            setTokens(t);
            setGrants(g);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Could not load your tokens");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const issue = async () => {
        if (!name.trim()) return;
        setIssuing(true);
        try {
            const t = await issueMcpToken(name.trim(), days);
            setIssued(t);
            setName("");
            load();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Could not issue the token");
        } finally {
            setIssuing(false);
        }
    };

    const revoke = async (t: McpToken) => {
        if (!window.confirm(`Revoke "${t.name}"? Any assistant using it stops working at once.`)) return;
        try {
            await revokeMcpToken(t.id);
            toast.success("Token revoked");
            if (issued?.id === t.id) setIssued(null);
            load();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Could not revoke the token");
        }
    };

    const disconnect = async (g: McpGrant) => {
        if (!window.confirm(`Disconnect "${g.client_name}"? It stops working at once and must sign in again.`)) return;
        try {
            await revokeMcpGrant(g.id);
            toast.success("App disconnected");
            load();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Could not disconnect the app");
        }
    };

    const endpoint = serverEndpoint ?? mcpEndpointUrl();
    const signInCommand = `claude mcp add --transport http tafs ${endpoint}`;
    const command = issued
        ? `claude mcp add --transport http tafs ${endpoint} --header "Authorization: Bearer ${issued.token}"`
        : "";

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            <div className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm space-y-2">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-2xl">
                        <Bot className="h-6 w-6 text-primary" />
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-zinc-900">AI Assistant (MCP)</h1>
                </div>
                <p className="text-zinc-500 text-sm font-medium pl-1 max-w-3xl">
                    Connect an AI assistant such as Claude to TAFS with your own access. It can only read what you can
                    already see: your tiles decide which tools it has, and your campus and class scope decides which
                    records it gets. Every call it makes is recorded in the activity log under your name.
                </p>
                <Link
                    href="/system/ai-assistant/docs"
                    className="inline-flex items-center gap-2 ml-1 mt-1 text-sm font-bold text-primary hover:underline"
                >
                    <BookMarked className="h-4 w-4" /> Read the guide: connecting Claude or ChatGPT, every tool, limits
                </Link>
            </div>

            <div className="bg-white p-6 rounded-[28px] border border-zinc-100 shadow-sm space-y-3">
                <h2 className="text-base font-black text-zinc-900 flex items-center gap-2">
                    <Link2 className="h-4 w-4" /> Connect with sign-in (recommended)
                </h2>
                <p className="text-sm text-zinc-600">
                    Add the server to your AI app with no token. It opens TAFS in your browser, you sign in and approve,
                    and it is connected. In Claude Code:
                </p>
                <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs break-all">{signInCommand}</code>
                    <button
                        onClick={() => copy(signInCommand, "Command")}
                        className="p-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50"
                        title="Copy command"
                    >
                        <Copy className="h-4 w-4" />
                    </button>
                </div>
                <p className="text-xs text-zinc-500">
                    In claude.ai: Settings → Connectors → Add custom connector, with the URL <code>{endpoint}</code>.
                </p>
            </div>

            <div className="bg-white rounded-[28px] border border-zinc-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-100 text-base font-black text-zinc-900">Connected apps</div>
                {loading ? (
                    <div className="p-10 flex justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                    </div>
                ) : grants.length === 0 ? (
                    <div className="p-10 text-center text-sm text-zinc-500">No apps connected by sign-in.</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-50 text-zinc-500 text-xs uppercase">
                            <tr>
                                <th className="text-left px-6 py-3">App</th>
                                <th className="text-left px-3 py-3">Returns to</th>
                                <th className="text-left px-3 py-3">Approved</th>
                                <th className="text-left px-3 py-3">Last used</th>
                                <th className="text-left px-3 py-3">Status</th>
                                <th className="px-6 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {grants.map((g) => (
                                <tr key={g.id} className="border-t border-zinc-100">
                                    <td className="px-6 py-3 font-semibold text-zinc-900">{g.client_name}</td>
                                    <td className="px-3 py-3 font-mono text-xs text-zinc-500">{g.redirect_hosts.join(", ")}</td>
                                    <td className="px-3 py-3 text-zinc-600">{when(g.created_at)}</td>
                                    <td className="px-3 py-3 text-zinc-600">{when(g.last_used_at)}</td>
                                    <td className="px-3 py-3">
                                        <span className={`px-2 py-1 rounded-lg border text-xs font-bold capitalize ${STATUS_STYLE[g.status]}`}>
                                            {g.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        {g.status === "active" && (
                                            <button
                                                onClick={() => disconnect(g)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 text-xs font-bold hover:bg-rose-50"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" /> Disconnect
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="bg-white p-6 rounded-[28px] border border-zinc-100 shadow-sm space-y-4">
                <h2 className="text-base font-black text-zinc-900 flex items-center gap-2">
                    <Plus className="h-4 w-4" /> New personal token (for apps without sign-in)
                </h2>
                <div className="flex flex-col md:flex-row gap-3">
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={100}
                        placeholder="What it is for, e.g. Claude Code on my laptop"
                        className="flex-1 px-4 py-3 rounded-2xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <label className="flex items-center gap-2 text-sm text-zinc-600">
                        Expires in
                        <select
                            value={days}
                            onChange={(e) => setDays(Number(e.target.value))}
                            className="px-3 py-3 rounded-2xl border border-zinc-200 text-sm"
                        >
                            {[7, 30, 60, MCP_TOKEN_MAX_DAYS].map((d) => (
                                <option key={d} value={d}>
                                    {d} days
                                </option>
                            ))}
                        </select>
                    </label>
                    <button
                        onClick={issue}
                        disabled={issuing || !name.trim()}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-2xl font-bold text-sm hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {issuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                        Issue token
                    </button>
                </div>

                {issued && (
                    <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
                        <div className="flex items-start gap-2 text-amber-900 text-sm font-bold">
                            <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                            Copy this token now. It will not be shown again. Treat it like your password: anyone
                            holding it can read what you can read until it expires or you revoke it.
                        </div>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs break-all">
                                {issued.token}
                            </code>
                            <button
                                onClick={() => copy(issued.token, "Token")}
                                className="p-2 rounded-xl border border-amber-200 bg-white hover:bg-amber-100"
                                title="Copy token"
                            >
                                <Copy className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="text-xs text-amber-900 space-y-1">
                            <div>Claude Code:</div>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 px-3 py-2 bg-white border border-amber-200 rounded-xl break-all">
                                    {command}
                                </code>
                                <button
                                    onClick={() => copy(command, "Command")}
                                    className="p-2 rounded-xl border border-amber-200 bg-white hover:bg-amber-100"
                                    title="Copy command"
                                >
                                    <Copy className="h-4 w-4" />
                                </button>
                            </div>
                            <div>
                                Other MCP clients: server URL <code>{endpoint}</code>, header{" "}
                                <code>Authorization: Bearer &lt;token&gt;</code>.
                            </div>
                        </div>
                        <button onClick={() => setIssued(null)} className="text-xs font-bold text-amber-900 underline">
                            I have copied it
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-[28px] border border-zinc-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-100 text-base font-black text-zinc-900">Your personal tokens</div>
                {loading ? (
                    <div className="p-10 flex justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                    </div>
                ) : tokens.length === 0 ? (
                    <div className="p-10 text-center text-sm text-zinc-500">No tokens yet.</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-50 text-zinc-500 text-xs uppercase">
                            <tr>
                                <th className="text-left px-6 py-3">Name</th>
                                <th className="text-left px-3 py-3">Token</th>
                                <th className="text-left px-3 py-3">Created</th>
                                <th className="text-left px-3 py-3">Expires</th>
                                <th className="text-left px-3 py-3">Last used</th>
                                <th className="text-left px-3 py-3">Status</th>
                                <th className="px-6 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {tokens.map((t) => (
                                <tr key={t.id} className="border-t border-zinc-100">
                                    <td className="px-6 py-3 font-semibold text-zinc-900">{t.name}</td>
                                    <td className="px-3 py-3 font-mono text-xs text-zinc-500">{t.token_prefix}…</td>
                                    <td className="px-3 py-3 text-zinc-600">{when(t.created_at)}</td>
                                    <td className="px-3 py-3 text-zinc-600">{when(t.expires_at)}</td>
                                    <td className="px-3 py-3 text-zinc-600">{when(t.last_used_at)}</td>
                                    <td className="px-3 py-3">
                                        <span
                                            className={`px-2 py-1 rounded-lg border text-xs font-bold capitalize ${STATUS_STYLE[t.status]}`}
                                        >
                                            {t.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        {t.status === "active" && (
                                            <button
                                                onClick={() => revoke(t)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 text-xs font-bold hover:bg-rose-50"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" /> Revoke
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
