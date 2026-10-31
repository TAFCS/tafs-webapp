"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const HOUSES_TILE = "school-setup.houses";

/**
 * Sub-permissions of Houses, for hiding and disabling UI.
 *
 * Only writes are gated — reading the list is unrestricted, since it feeds
 * student forms and filters across the app.
 */
export function useHousesAccess() {
    const tile = useTileAccess(HOUSES_TILE);

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
