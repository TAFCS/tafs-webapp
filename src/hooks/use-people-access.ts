"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const PEOPLE_ACCESS_TILE = "system.people_access";

/**
 * People & Access is delegable to READ only (TAFSD-365). Holding the tile
 * opens the list and every tab of a record; creating a person, editing
 * identity / job / access / scope, revealing a password and activating or
 * deactivating an account are all super admin only. The API enforces that
 * (@RequireSuperAdmin); this only hides the controls it would refuse.
 *
 * The tile's old write actions (identity.edit, job.edit, access.edit,
 * scope.edit, reveal_password, create) are retired and resolve to nothing.
 */
export function usePeopleAccess() {
    const tile = useTileAccess(PEOPLE_ACCESS_TILE);

    return useMemo(
        () => ({
            canView: tile.isSuperAdmin || tile.hasTile,
            canEdit: tile.isSuperAdmin,
            hasTile: tile.hasTile,
            isSuperAdmin: tile.isSuperAdmin,
        }),
        [tile],
    );
}
