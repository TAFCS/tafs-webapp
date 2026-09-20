"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const REGISTRATION_TILE = "student.registration";

/**
 * Sub-permissions of Registration, for hiding and disabling UI.
 *
 * `register` submits the registration form; `admission_form` submits the
 * comprehensive admission form. Looking an admission up by CC or a guardian by
 * CNIC is `view`.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useRegistrationAccess() {
    const tile = useTileAccess(REGISTRATION_TILE);

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
