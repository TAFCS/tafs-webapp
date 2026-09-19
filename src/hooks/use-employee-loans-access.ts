"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const EMPLOYEE_LOANS_TILE = "hr.employee_loans";

/**
 * Sub-permissions of the standalone Employee Loans page, for hiding and
 * disabling UI.
 *
 * Every write route this hook gates is ALSO reachable from EmployeeLoanTab.tsx
 * inside the Employee Directory (gated there on hr.employee_directory#loan.edit)
 * — the backend decorates those routes with @RequireAnyAction across both
 * tiles, so a Directory-only holder is unaffected by this hook.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useEmployeeLoansAccess() {
    const tile = useTileAccess(EMPLOYEE_LOANS_TILE);

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
