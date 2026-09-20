"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const EMPLOYEE_ATTENDANCE_CYCLE_TILE = "attendance.employee_attendance_cycle";

/**
 * Sub-permissions of Employee Attendance by Cycle (/hr/attendance-dashboard/cycle), for hiding and disabling UI.
 *
 * `view` covers loading and viewing the cycle attendance lines and punch card matrix.
 * `export` covers exporting employee lines and punch card matrix to Excel.
 * `mark` covers resolving missing punches or marking attendance in the line detail modal.
 *
 * Same contract as other use-*-access hooks: an affordance, not the boundary.
 * Every route is guarded by @RequireAction / @RequireAnyAction.
 *
 * Fails open for a session that predates sub-permissions: it carries no
 * actions at all, while any session holding this tile carries at least `view`
 * (its default action), so "holds the tile but cannot view" can only be a
 * stale token. Access tokens live 90 days.
 */
export function useEmployeeAttendanceCycleAccess() {
  const tile = useTileAccess(EMPLOYEE_ATTENDANCE_CYCLE_TILE);

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
