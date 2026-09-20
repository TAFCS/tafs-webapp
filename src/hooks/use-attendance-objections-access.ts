"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const ATTENDANCE_OBJECTIONS_TILE = "attendance.objections";

/**
 * Sub-permissions of Attendance Objections (/hr/objections), for hiding and disabling UI.
 *
 * `view` covers loading and viewing attendance objections list and details.
 * `review` covers accepting and rejecting attendance objections.
 *
 * Same contract as other use-*-access hooks: an affordance, not the boundary.
 * Every route is guarded by @RequireAction.
 *
 * Fails open for a session that predates sub-permissions: it carries no
 * actions at all, while any session holding this tile carries at least `view`
 * (its default action), so "holds the tile but cannot view" can only be a
 * stale token. Access tokens live 90 days.
 */
export function useAttendanceObjectionsAccess() {
  const tile = useTileAccess(ATTENDANCE_OBJECTIONS_TILE);

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
