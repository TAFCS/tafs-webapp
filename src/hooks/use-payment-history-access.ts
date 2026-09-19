"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const PAYMENT_HISTORY_TILE = "finance.payment_history";

/**
 * Sub-permissions of Payment History, for hiding and disabling UI.
 *
 * This tile owns no route of its own — GET /students/:id/payment-history is
 * the Student Directory's own route, widened with @RequireAnyAction so a
 * Payment History holder can use it without needing the Student Directory
 * tile too. `clear_deposit` is confirmed exclusive to this page.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function usePaymentHistoryAccess() {
    const tile = useTileAccess(PAYMENT_HISTORY_TILE);

    return useMemo(() => {
        const staleSession = tile.hasTile && !tile.can("view");
        const can = (actionId: string) => staleSession || tile.can(actionId);
        return {
            can,
            canAny: (...actionIds: string[]) => actionIds.some(can),
            canAll: (...actionIds: string[]) => actionIds.every(can),
            hasTile: tile.hasTile,
            isSuperAdmin: tile.isSuperAdmin,
            staleSession,
        };
    }, [tile]);
}
