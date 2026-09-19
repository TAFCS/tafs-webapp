"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const EMPLOYEE_NOTICES_TILE = "hr.employee_notices";

/**
 * Sub-permissions of Employee Notices, for hiding and disabling UI.
 *
 * Gates only the admin broadcast routes — every employee's own notice feed
 * (getFeed/markRead) stays open to any logged-in staff member, unrelated to
 * who may send announcements.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useEmployeeNoticesAccess() {
    const tile = useTileAccess(EMPLOYEE_NOTICES_TILE);

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
