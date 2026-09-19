"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const PEOPLE_ACCESS_TILE = "system.people_access";

/**
 * Sub-permissions of the People & Access panel, for hiding and disabling UI.
 *
 * Tab-shaped, like Employee/Student Directory — but unlike those, no tab has
 * a separate `.view` action here: identity/job/access/scope are edit-or-
 * nothing, since a user's access grants, scope, and reveal-password are
 * sensitive enough that a read-only tier wasn't worth inventing. A tab is
 * either fully shown (editable) or fully hidden.
 *
 * The "create a person" flow on this page actually calls the Employee
 * Directory's own create route, so it is gated by useEmployeeAccess()
 * (hr.employee_directory#create), not by this hook's own `create` action —
 * that action exists for POST /users directly, which nothing in the webapp
 * currently calls.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function usePeopleAccess() {
    const tile = useTileAccess(PEOPLE_ACCESS_TILE);

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
