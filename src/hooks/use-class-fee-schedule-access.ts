"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const CLASS_FEE_SCHEDULE_TILE = "finance.class_fee_schedule";

/**
 * Sub-permissions of Class Fee Schedule, for hiding and disabling UI.
 *
 * `GET /by-class` (used elsewhere to suggest default fee amounts inside
 * Student Overrides) is not gated by this tile at all — only view/create/
 * edit/delete/copy_history on the admin page itself.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useClassFeeScheduleAccess() {
    const tile = useTileAccess(CLASS_FEE_SCHEDULE_TILE);

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
