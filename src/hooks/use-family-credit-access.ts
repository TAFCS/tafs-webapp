"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const FAMILY_CREDIT_TILE = "finance.family_credit";

/**
 * TAFSD-504: sub-permissions of Finance → Family Credit (add, deduct, refund,
 * transfer, undo, export). Nobody holds the tile by default; it is granted per
 * person in People & Access.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useFamilyCreditAccess() {
    const tile = useTileAccess(FAMILY_CREDIT_TILE);

    return useMemo(() => {
        const staleSession = tile.hasTile && !tile.can("view");
        const can = (actionId: string) => staleSession || tile.can(actionId);
        return {
            can,
            canAny: (...actionIds: string[]) => actionIds.some(can),
            hasTile: tile.hasTile,
            isSuperAdmin: tile.isSuperAdmin,
            staleSession,
        };
    }, [tile]);
}
