"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const TRANSFERS_TILE = "student.transfers";

/**
 * Sub-permissions of Transfers, for hiding and disabling UI.
 *
 * `view` covers search and the target pickers; `execute` is the transfer
 * itself; `print` opens the transfer order. GET /transfers/:cc/transfer-order
 * is also read by the Student Directory's Transfer Order tab, so the backend
 * accepts either tile there.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useTransfersAccess() {
    const tile = useTileAccess(TRANSFERS_TILE);

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
