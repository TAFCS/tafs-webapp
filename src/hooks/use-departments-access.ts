"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const DEPARTMENTS_TILE = "hr.departments";

/**
 * Sub-permissions of Departments, for hiding and disabling UI.
 *
 * Only create/edit/delete are gated — reading the department list is
 * unrestricted (People & Access, Salary Increments, attendance boards, the
 * Employee form and more all read it just to populate a dropdown).
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useDepartmentsAccess() {
    const tile = useTileAccess(DEPARTMENTS_TILE);

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
