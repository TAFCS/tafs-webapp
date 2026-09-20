"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const QUICK_CHECK_IN_TILE = "attendance.quick_check_in";

/**
 * Sub-permissions of Quick Check-In, for hiding and disabling UI. `scan`
 * records a manual check-in or check-out.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useQuickCheckInAccess() {
    const tile = useTileAccess(QUICK_CHECK_IN_TILE);

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
