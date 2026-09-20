"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const SHIFT_OVERRIDES_TILE = "attendance.shift_overrides";

/**
 * Sub-permissions of Shift Overrides, for hiding and disabling UI.
 *
 * `manage` creates and deletes overrides. The panel on this page is shared
 * with the Employee Directory's shift-overrides tab, which is governed by the
 * directory's own actions.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useShiftOverridesAccess() {
    const tile = useTileAccess(SHIFT_OVERRIDES_TILE);

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
