"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const RECEIVE_DEPOSIT_TILE = "finance.receive_deposit";

/**
 * Sub-permissions of Receive Deposit, for hiding and disabling UI.
 *
 * `record` and `split` (preview) are this page's alone on the backend. `waive`,
 * `split`, `print` and `main_receipt` are routes it shares with other tiles,
 * so the backend accepts either tile's action there; this hook only answers
 * "may THIS tile's holder do it".
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useReceiveDepositAccess() {
    const tile = useTileAccess(RECEIVE_DEPOSIT_TILE);

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
