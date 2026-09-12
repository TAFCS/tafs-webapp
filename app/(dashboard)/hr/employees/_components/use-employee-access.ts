"use client";

import { useMemo } from "react";
import { useTileAccess } from "@/hooks/use-tile-access";

export const EMPLOYEE_DIRECTORY_TILE = "hr.employee_directory";

/**
 * Sub-permissions of the Employee Directory, for hiding and disabling UI.
 *
 * This is NOT the enforcement boundary — every route is guarded by
 * @RequireAction and every field of PATCH /:id by EMPLOYEE_FIELD_TAB_MAP. A
 * hidden button is an affordance; the API is what says no.
 *
 * One deliberate fail-open: a session issued before sub-permissions shipped
 * carries none at all, while any session that holds this tile carries at least
 * `view` (its default action). So "holds the tile but cannot view" can only
 * mean a stale token, and those users get the old all-or-nothing UI until
 * their next refresh rather than a blank panel. Access tokens live 90 days.
 */
export function useEmployeeAccess() {
  const tile = useTileAccess(EMPLOYEE_DIRECTORY_TILE);

  return useMemo(() => {
    const staleSession = tile.hasTile && !tile.can("view");
    const can = (actionId: string) => staleSession || tile.can(actionId);
    return {
      can,
      canAny: (...actionIds: string[]) => actionIds.some(can),
      canAll: (...actionIds: string[]) => actionIds.every(can),
      hasTile: tile.hasTile,
      isSuperAdmin: tile.isSuperAdmin,
      /** True while the caller's token predates sub-permissions. */
      staleSession,
    };
  }, [tile]);
}

/**
 * Tab id in EmployeeDetailPanel → action prefix in the manifest.
 *
 * Only one differs: the tab is `schedule`, the actions are `schedule_pay.*`,
 * because the tab shows pay and the action names say so.
 */
export const TAB_ACTION_PREFIX: Record<string, string> = {
  profile: "profile",
  employment: "employment",
  schedule: "schedule_pay",
  security_deposit: "security_deposit",
  loan: "loan",
  classes: "classes",
  progression: "progression",
  portal: "portal",
  biometric: "biometric",
  shift_overrides: "shift_overrides",
};
