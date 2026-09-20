"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const ACADEMIC_CALENDAR_TILE = "attendance.academic_calendar";

/**
 * Sub-permissions of the Academic Calendar, for hiding and disabling UI.
 *
 * `manage` creates, edits and deletes days and syncs attendance. Every write
 * was super-admin-only, so `manage` has no legacy bridge: it is held by nobody
 * until a super admin grants it. Use `canManage` below for write controls: it
 * is NOT stale-tolerant, so an old session is never shown a button the API
 * would refuse.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useAcademicCalendarAccess() {
    const tile = useTileAccess(ACADEMIC_CALENDAR_TILE);

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
            /** Write access. Deliberately not stale-tolerant (see above). */
            canManage: tile.isSuperAdmin || (!staleSession && tile.can("manage")),
        };
    }, [tile]);
}
