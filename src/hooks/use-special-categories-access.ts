"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const SPECIAL_CATEGORIES_TILE = "school-setup.special_categories";

/**
 * TAFSD-475: sub-permissions of School Setup → Special Categories. Reading the
 * list is open (the student form and reports need it); these gate the writes.
 * An affordance, not the boundary. Fails open for a session that predates
 * sub-permissions.
 */
export function useSpecialCategoriesAccess() {
    const tile = useTileAccess(SPECIAL_CATEGORIES_TILE);

    return useMemo(() => {
        const staleSession = tile.hasTile && !tile.can("view");
        const can = (actionId: string) => staleSession || tile.can(actionId);
        return {
            can,
            hasTile: tile.hasTile,
            isSuperAdmin: tile.isSuperAdmin,
            staleSession,
        };
    }, [tile]);
}
