"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const CAMPUSES_TILE = "school-setup.campuses";

/**
 * Sub-permissions of Campuses, for hiding and disabling UI.
 *
 * Only writes are gated — reading the list is unrestricted, since it feeds
 * dropdowns across the app.
 * The class/section mapping PUT is shared with Student Overrides and is not gated by this tile.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useCampusesAccess() {
    const tile = useTileAccess(CAMPUSES_TILE);

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
