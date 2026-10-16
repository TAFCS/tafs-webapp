"use client";

import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import { ALL_ACTIONS_WILDCARD, useTileAccess } from "./use-tile-access";

export const PEOPLE_ACCESS_TILE = "system.people_access";

/**
 * People & Access sub-permissions, for hiding and disabling UI. The SUPER_ADMIN
 * decides who holds which (view, identity.edit, job.edit, access.edit,
 * scope.edit, reveal_password, create). On top of that, for anyone who is not
 * a SUPER_ADMIN the API refuses (TAFSD-365):
 *   - their own account, and any SUPER_ADMIN's account,
 *   - giving a tile, sub-permission or role they do not hold themselves,
 *   - scope wider than their own,
 *   - a password or username on an account that holds more than they do.
 * `mayChange` and `canGive*` mirror those so the page does not offer what the
 * API would refuse. They are an affordance, not the boundary.
 */
export function usePeopleAccess() {
    const tile = useTileAccess(PEOPLE_ACCESS_TILE);
    const user = useAppSelector((s) => s.auth.user);

    return useMemo(() => {
        const isSuperAdmin = tile.isSuperAdmin;
        const heldTiles = new Set(user?.effectiveTileIds ?? []);
        const heldActions = new Set(user?.effectiveActions ?? []);
        return {
            can: (actionId: string) => isSuperAdmin || tile.can(actionId),
            hasTile: tile.hasTile,
            isSuperAdmin,
            /** False for your own account and for a SUPER_ADMIN's, unless you are one. */
            mayChange: (target: { id: string; role: string } | null | undefined) =>
                !target || isSuperAdmin || (target.id !== user?.id && target.role !== "SUPER_ADMIN"),
            /** You can only give a tile you hold yourself. */
            canGiveTile: (tileId: string) => isSuperAdmin || heldTiles.has(tileId),
            /** You can only give a sub-permission you hold yourself. */
            canGiveAction: (tileId: string, actionId: string) =>
                isSuperAdmin ||
                heldActions.has(`${tileId}#${actionId}`) ||
                heldActions.has(`${tileId}#${ALL_ACTIONS_WILDCARD}`),
        };
    }, [tile, user]);
}
