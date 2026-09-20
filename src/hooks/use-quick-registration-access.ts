"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const QUICK_REGISTRATION_TILE = "student.quick_registration";

/**
 * Sub-permissions of Quick Registration, for hiding and disabling UI.
 *
 * `create` covers creating the admission and uploading its photographs. No
 * role holds it by default: a super admin grants it per role or person in
 * People & Access. The deposit slip is also printed from the Student
 * Directory's Certificates tab, so it is not gated by this tile.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useQuickRegistrationAccess() {
    const tile = useTileAccess(QUICK_REGISTRATION_TILE);

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
