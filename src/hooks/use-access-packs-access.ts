"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const ACCESS_PACKS_TILE = "system.access_packs";

/**
 * Sub-permissions of Access Packs, for hiding and disabling UI. `manage`
 * creates, edits and deletes packs; a pack grants nothing until it is assigned
 * in People & Access.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useAccessPacksAccess() {
    const tile = useTileAccess(ACCESS_PACKS_TILE);

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
