"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const ACADEMIC_ACTIONS_TILE = "student.academic_actions";

/**
 * Sub-permissions of Academic Actions (bulk promote), for hiding and disabling
 * UI. `promote` covers running a promotion and the GR-number suggestions; the
 * Student Directory's own `promote` is accepted by the same routes.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useAcademicActionsAccess() {
    const tile = useTileAccess(ACADEMIC_ACTIONS_TILE);

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
