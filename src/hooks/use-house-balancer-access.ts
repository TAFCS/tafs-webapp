"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const STUDENT_HOUSE_BALANCER_TILE = "student.house_balancer";
export const SCHOOL_SETUP_HOUSE_BALANCER_TILE = "school-setup.house_balancer";

/**
 * Sub-permissions of the House Balancer, for hiding and disabling UI.
 *
 * The one page is listed under two tiles (Student & Profiling and School
 * Setup), which carry the same actions, and the API accepts either. So this
 * answers "does EITHER tile the user holds allow it".
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useHouseBalancerAccess() {
    const a = useTileAccess(STUDENT_HOUSE_BALANCER_TILE);
    const b = useTileAccess(SCHOOL_SETUP_HOUSE_BALANCER_TILE);

    return useMemo(() => {
        const staleSession =
            (a.hasTile && !a.can("view")) || (b.hasTile && !b.can("view"));
        const can = (actionId: string) => staleSession || a.can(actionId) || b.can(actionId);
        return {
            can,
            canAny: (...actionIds: string[]) => actionIds.some(can),
            canAll: (...actionIds: string[]) => actionIds.every(can),
            hasTile: a.hasTile || b.hasTile,
            isSuperAdmin: a.isSuperAdmin,
            staleSession,
        };
    }, [a, b]);
}
