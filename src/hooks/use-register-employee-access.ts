"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const REGISTER_EMPLOYEE_TILE = "hr.register_employee";

/**
 * Sub-permissions of the standalone "Register a Employee" page.
 *
 * This tile owns no distinct route — /hr/employees/new submits through the
 * exact same POST /hr/employees route as Employee Directory's own `create`,
 * widened there with @RequireAnyAction. This hook exists so someone granted
 * only this narrower tile (not the full Employee Directory) can still use
 * the form; see EmployeeForm.tsx's `mayUseForm` check.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useRegisterEmployeeAccess() {
    const tile = useTileAccess(REGISTER_EMPLOYEE_TILE);

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
