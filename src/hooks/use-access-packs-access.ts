"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const ACCESS_PACKS_TILE = "system.access_packs";

/**
 * Access Packs sub-permissions. `manage` creates, edits and deletes packs and
 * role baselines. For anyone who is not a SUPER_ADMIN the API also refuses a
 * pack assigned to themselves, their own role, the SUPER_ADMIN role, and
 * adding anything they do not hold (TAFSD-365). An affordance, not the
 * boundary.
 */
export function useAccessPacksAccess() {
    const tile = useTileAccess(ACCESS_PACKS_TILE);

    return useMemo(
        () => ({
            canManage: tile.isSuperAdmin || tile.can("manage"),
            hasTile: tile.hasTile,
            isSuperAdmin: tile.isSuperAdmin,
        }),
        [tile],
    );
}
