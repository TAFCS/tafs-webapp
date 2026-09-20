"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const ALEVEL_ROLL_CALL_TILE = "attendance.alevel_roll_call";

/**
 * Sub-permissions of A-Level Roll Call, for hiding and disabling UI. `mark`
 * creates, updates and reverts roll sessions; `skip` skips one. The Timetables
 * page's roll-marking mode shares these routes and is governed by the
 * Timetables tile.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useALevelRollCallAccess() {
    const tile = useTileAccess(ALEVEL_ROLL_CALL_TILE);

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
