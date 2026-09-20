"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const SATURDAY_SCHEDULES_TILE = "attendance.saturday_schedules";

/**
 * Sub-permissions of Saturday Schedules, for hiding and disabling UI.
 *
 * `manage` creates and deletes schedules. A super admin can delegate the tile
 * and its actions to a role or person in People & Access.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useSaturdaySchedulesAccess() {
    const tile = useTileAccess(SATURDAY_SCHEDULES_TILE);

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
