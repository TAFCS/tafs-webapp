"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const BACKUPS_TILE = "system.backups";

/**
 * Sub-permissions of Database Backups, for hiding and disabling UI.
 *
 * `trigger`, `download` and `delete` are separate actions and held by nobody
 * but a super admin until one grants them: a backup holds every campus's data
 * and deleting one is irreversible. The API enforces the same on every route.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useBackupsAccess() {
    const tile = useTileAccess(BACKUPS_TILE);

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
