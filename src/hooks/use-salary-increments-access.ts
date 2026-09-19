"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const SALARY_INCREMENTS_TILE = "hr.salary_increments";

/**
 * Sub-permissions of the standalone Salary Increments page, for hiding and
 * disabling UI.
 *
 * `view` (settings read) and `apply` are ALSO reachable from
 * EmployeeSalaryIncrementSection.tsx inside the Employee Directory (gated
 * there on hr.employee_directory#schedule_pay.edit) — the backend decorates
 * those two routes with @RequireAnyAction across both tiles, so a
 * Directory-only holder is unaffected by this hook.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useSalaryIncrementsAccess() {
    const tile = useTileAccess(SALARY_INCREMENTS_TILE);

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
