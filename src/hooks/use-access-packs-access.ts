"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const ACCESS_PACKS_TILE = "system.access_packs";

/**
 * Access Packs is delegable to READ only (TAFSD-365). Creating, editing and
 * deleting packs, and changing what a role grants, are super admin only: a
 * pack edit changes the access of everyone it is assigned to, the editor
 * included. The API enforces it (@RequireSuperAdmin); this only hides the
 * controls. The old `manage` action is retired and resolves to nothing.
 */
export function useAccessPacksAccess() {
    const tile = useTileAccess(ACCESS_PACKS_TILE);

    return useMemo(
        () => ({
            canView: tile.isSuperAdmin || tile.hasTile,
            canManage: tile.isSuperAdmin,
            hasTile: tile.hasTile,
            isSuperAdmin: tile.isSuperAdmin,
        }),
        [tile],
    );
}
