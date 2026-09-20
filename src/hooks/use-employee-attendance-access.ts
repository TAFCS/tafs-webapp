"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const EMPLOYEE_ATTENDANCE_TILE = "attendance.employee_attendance";

/**
 * Sub-permissions of Employee Attendance (/hr/attendance-dashboard), for hiding and disabling UI.
 *
 * `view` covers loading and viewing the daily attendance dashboard, summary metrics, and employee timelines.
 * `mark` covers bulk marking attendance, setting clock-out times, and resolving missing punches / objections.
 *
 * Same contract as other use-*-access hooks: an affordance, not the boundary.
 * Every route is guarded by @RequireAction / @RequireAnyAction.
 *
 * Fails open for a session that predates sub-permissions: it carries no
 * actions at all, while any session holding this tile carries at least `view`
 * (its default action), so "holds the tile but cannot view" can only be a
 * stale token. Access tokens live 90 days.
 */
export function useEmployeeAttendanceAccess() {
  const tile = useTileAccess(EMPLOYEE_ATTENDANCE_TILE);

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
