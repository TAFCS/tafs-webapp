"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const STUDENT_DIRECTORY_TILE = "student.directory";

/**
 * Sub-permissions of the Student Directory, for hiding and disabling UI.
 *
 * Same contract as useEmployeeAccess: this is an affordance, not the boundary.
 * Every route is guarded by @RequireAction and every list query merges
 * ScopeService.whereForStudents.
 *
 * Fails open for a session that predates sub-permissions — it carries no
 * actions at all, while any session holding this tile carries at least `view`
 * (its default action), so "holds the tile but cannot view" can only be a
 * stale token. Access tokens live 90 days.
 */
export function useStudentAccess() {
  const tile = useTileAccess(STUDENT_DIRECTORY_TILE);

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
