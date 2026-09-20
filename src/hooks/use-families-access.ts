"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const FAMILIES_TILE = "student.families";

/**
 * Sub-permissions of Families (/families), for hiding and disabling UI.
 *
 * `view` covers opening directory, searching, stats, and opening family details.
 * `create` covers creating new families (manual or from student).
 * `edit` covers editing family info (name, address, email, credentials).
 * `assign_student` covers changing/assigning students to families.
 *
 * Same contract as other use-*-access hooks: an affordance, not the boundary.
 * Every route is guarded by @RequireAction and every query merges student scope.
 *
 * Fails open for a session that predates sub-permissions: it carries no
 * actions at all, while any session holding this tile carries at least `view`
 * (its default action), so "holds the tile but cannot view" can only be a
 * stale token. Access tokens live 90 days.
 */
export function useFamiliesAccess() {
  const tile = useTileAccess(FAMILIES_TILE);

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
