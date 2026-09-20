"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const TIMETABLES_TILE = "attendance.timetables";

/**
 * Sub-permissions of Timetables, for hiding and disabling UI.
 *
 * `slots.manage` edits slots (and creates subjects from the slot editor);
 * `periods.manage` edits the period definitions. The page also hosts
 * attendance-marking modes that are governed by their own capabilities.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useTimetablesAccess() {
    const tile = useTileAccess(TIMETABLES_TILE);

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
