"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const ENROLLMENTS_TILE = "student.enrollments";

/**
 * Sub-permissions of Enrollments, for hiding and disabling UI.
 *
 * `enroll` completes an admission; `pursuit_status` marks a candidate as not
 * pursuing (and reverses it). Certificates and the admission order are shared
 * with Student Directory tabs and carry no action of this tile.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useEnrollmentsAccess() {
    const tile = useTileAccess(ENROLLMENTS_TILE);

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
