"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const STAFF_REGISTER_TILE = "attendance.staff_register";

/**
 * Sub-permissions of Staff Register (/hr/staff-register), for hiding and disabling UI.
 *
 * `view` covers loading and viewing the daily register of staff attendance across campuses.
 * `mark` covers marking staff statuses (Present/Absent/Late/Half Day/Excused), bulk marking, notes, and saving attendance.
 *
 * Same contract as other use-*-access hooks: an affordance, not the boundary.
 * Every route is guarded by @RequireAction / @RequireAnyAction.
 *
 * Fails open for a session that predates sub-permissions: it carries no
 * actions at all, while any session holding this tile carries at least `view`
 * (its default action), so "holds the tile but cannot view" can only be a
 * stale token. Access tokens live 90 days.
 */
export function useStaffRegisterAccess() {
  const tile = useTileAccess(STAFF_REGISTER_TILE);

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
