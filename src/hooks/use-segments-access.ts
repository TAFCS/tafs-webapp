"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const SEGMENTS_TILE = "school-setup.segments";

/**
 * Sub-permissions of Segments, for hiding and disabling UI.
 *
 * Only writes are gated — reading the list is unrestricted, since it feeds
 * dropdowns across the app.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useSegmentsAccess() {
    const tile = useTileAccess(SEGMENTS_TILE);

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
