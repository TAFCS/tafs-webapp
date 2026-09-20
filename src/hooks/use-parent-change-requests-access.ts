"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const PARENT_CHANGE_REQUESTS_TILE = "student.parent_change_requests";

/**
 * Sub-permissions of Parent Change Requests (/parent-change-requests), for hiding and disabling UI.
 *
 * `view` covers opening the requests list, searching, and viewing request details.
 * `process` covers approving (in full or partially) or rejecting requests.
 *
 * Same contract as other use-*-access hooks: an affordance, not the boundary.
 * Every route is guarded by @RequireAction and every query merges student scope.
 *
 * Fails open for a session that predates sub-permissions: it carries no
 * actions at all, while any session holding this tile carries at least `view`
 * (its default action), so "holds the tile but cannot view" can only be a
 * stale token. Access tokens live 90 days.
 */
export function useParentChangeRequestsAccess() {
  const tile = useTileAccess(PARENT_CHANGE_REQUESTS_TILE);

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
