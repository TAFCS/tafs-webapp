"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const POSTDATED_CHEQUES_TILE = "finance.postdated_cheques";

/**
 * Sub-permissions of Post-dated Cheques, for hiding and disabling UI.
 *
 * Nobody holds this tile by default: a super admin grants it, and its
 * actions, per role or person in People & Access.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function usePostdatedChequesAccess() {
    const tile = useTileAccess(POSTDATED_CHEQUES_TILE);

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
