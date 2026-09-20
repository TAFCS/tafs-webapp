"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const CLASS_MODES_TILE = "attendance.class_modes";

/**
 * Sub-permissions of Class Modes, for hiding and disabling UI. `manage` sets
 * or clears a class's attendance mode.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useClassModesAccess() {
    const tile = useTileAccess(CLASS_MODES_TILE);

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
