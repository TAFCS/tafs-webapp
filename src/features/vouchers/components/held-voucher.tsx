"use client";

/**
 * "Unreleased" (a.k.a. held / pending-release) voucher state.
 *
 * A voucher is UNRELEASED when `released_to_parent_at` is null: it exists in the
 * system but is invisible & silent to parents until an admin releases it from
 * the Pending Release page. This is orthogonal to `status` (UNPAID / OVERDUE /
 * PARTIALLY_PAID …) — it is the state that comes *before* a voucher is really
 * "issued" to the family.
 *
 * Shown consistently on: /fee-challan, /studentwise-fees, /vouchers,
 * /vouchers/deposit. Keep this the one source of truth for the label + look.
 */

import { Lock } from "lucide-react";

export interface HeldVoucherShape {
    status?: string | null;
    released_to_parent_at?: string | null;
}

/** True when the voucher exists but has not been released to parents yet. */
export function isVoucherHeld(v?: HeldVoucherShape | null): boolean {
    if (!v) return false;
    if (v.status === "VOID") return false;
    return v.released_to_parent_at == null;
}

export function UnreleasedBadge({
    compact = false,
    withIcon = true,
    className = "",
}: {
    compact?: boolean;
    withIcon?: boolean;
    className?: string;
}) {
    return (
        <span
            title="Held — not yet released to parents (invisible & silent until an admin releases it)"
            className={`inline-flex items-center gap-1 rounded-full border font-black uppercase tracking-widest bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800 ${
                compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"
            } ${className}`}
        >
            {withIcon && <Lock className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />}
            Unreleased
        </span>
    );
}
