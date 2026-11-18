"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bot, Check, Loader2, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { McpConsentRequest, decideMcpConsent, getMcpConsent } from "@/lib/mcp-tokens.service";

/**
 * TAFSD-531: the consent screen of the MCP OAuth sign-in. An MCP client (Claude
 * Code, claude.ai, …) sends the person here through the backend's /authorize;
 * middleware sends them through the normal TAFS login first if needed. They see
 * which app is asking, that it will act as them, and exactly the tools they
 * would get, then approve or deny. Either way the browser goes back to the app.
 */
function Consent() {
    const ticket = useSearchParams().get("ticket") ?? "";
    const [req, setReq] = useState<McpConsentRequest | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
    const [done, setDone] = useState<"approve" | "deny" | null>(null);

    useEffect(() => {
        if (!ticket) {
            setError("This sign-in link is incomplete. Start again from your app.");
            return;
        }
        getMcpConsent(ticket)
            .then(setReq)
            .catch((err) => setError(err?.response?.data?.message || "This sign-in link is not valid. Start again from your app."));
    }, [ticket]);

    const decide = async (decision: "approve" | "deny") => {
        setBusy(decision);
        try {
            const to = await decideMcpConsent(ticket, decision);
            setDone(decision);
            window.location.assign(to);
        } catch (err: any) {
            setError(err?.response?.data?.message || "Something went wrong. Start again from your app.");
            setBusy(null);
        }
    };

    const blockedText =
        req?.blocked_reason === "impersonating"
            ? "You are impersonating another user. Exit impersonation to connect an app as yourself."
            : "Your TAFS access does not include the AI Assistant (MCP). Ask an administrator to grant it in People & Access.";

    return (
        <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[28px] border border-zinc-100 dark:border-zinc-800 shadow-sm p-8 space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-2xl">
                        <Bot className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <div className="text-xs font-bold uppercase tracking-wide text-zinc-400">TAFS AI Assistant</div>
                        <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-100">Connect an app</h1>
                    </div>
                </div>

                {error ? (
                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium">{error}</div>
                ) : !req ? (
                    <div className="py-10 flex justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">{req.client.name}</span> wants to use TAFS{" "}
                            <span className="font-bold">as you</span> ({req.acting_as.full_name ?? req.acting_as.username}). It will
                            send you back to <span className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{req.client.redirect_host}</span>.
                        </p>

                        {req.allowed ? (
                            <div className="space-y-2">
                                <div className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                                    It will be able to read, within your campus and class scope
                                </div>
                                <ul className="rounded-2xl border border-zinc-100 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {req.tools.map((t) => (
                                        <li key={t.name} className="px-4 py-2.5">
                                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t.title ?? t.name}</div>
                                            {t.description && <div className="text-xs text-zinc-500 mt-0.5">{t.description}</div>}
                                        </li>
                                    ))}
                                </ul>
                                <div className="flex items-start gap-2 text-xs text-zinc-500">
                                    <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
                                    Read-only. It never sees more than you can, every call is logged under your name, and you can
                                    disconnect it any time from System → AI Assistant (MCP).
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-start gap-2 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
                                <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                                {blockedText}
                            </div>
                        )}

                        {done ? (
                            <div className="text-sm text-zinc-500 flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" /> Returning to {req.client.name}…
                            </div>
                        ) : (
                            <div className="flex gap-3">
                                <button
                                    onClick={() => decide("deny")}
                                    disabled={busy !== null}
                                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 font-bold text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                                >
                                    {busy === "deny" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                                    {req.allowed ? "Deny" : "Back to app"}
                                </button>
                                {req.allowed && (
                                    <button
                                        onClick={() => decide("approve")}
                                        disabled={busy !== null}
                                        className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-zinc-900 text-white font-bold text-sm hover:bg-zinc-800 disabled:opacity-50"
                                    >
                                        {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                        Approve
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </main>
    );
}

export default function McpAuthorizePage() {
    return (
        <Suspense fallback={null}>
            <Consent />
        </Suspense>
    );
}
