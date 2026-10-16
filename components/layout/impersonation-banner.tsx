"use client";

import { useState } from "react";
import { UserRoundCog, Loader2 } from "lucide-react";
import { useAuth, useAuthState } from "@/context/AuthContext";

/**
 * Shown on every dashboard page while a super admin is impersonating someone
 * (TAFSD-361), so it is never unclear whose session this is.
 */
export function ImpersonationBanner() {
    const { user } = useAuthState();
    const { exitImpersonation } = useAuth();
    const [exiting, setExiting] = useState(false);

    if (!user?.impersonator) return null;

    return (
        <div className="flex items-center gap-3 px-4 py-2 bg-amber-500 text-amber-950 text-sm font-semibold">
            <UserRoundCog className="h-4 w-4 shrink-0" />
            <p className="flex-1 min-w-0 truncate">
                Viewing as <span className="font-black">{user.fullName}</span> ({user.username}).
                Everything you do is recorded as {user.impersonator.fullName}.
            </p>
            <button
                onClick={async () => {
                    setExiting(true);
                    await exitImpersonation();
                }}
                disabled={exiting}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-amber-950 text-amber-50 px-3 py-1.5 text-xs font-bold hover:bg-amber-900 disabled:opacity-60"
            >
                {exiting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Exit impersonation
            </button>
        </div>
    );
}
