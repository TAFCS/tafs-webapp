"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const PENDING_RELEASE_TILE = "finance.pending_release";

/**
 * Sub-permissions of Pending Release, for hiding and disabling UI.
 *
 * Standalone — no shared routes with any other tile.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function usePendingReleaseAccess() {
    const tile = useTileAccess(PENDING_RELEASE_TILE);

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
