"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const BANKS_TILE = "school-setup.banks";

/**
 * Sub-permissions of the Banks admin page, for hiding and disabling UI.
 *
 * Only gates create/edit/delete — reading the bank list is unrestricted
 * (fee-challan, the deposit page and the Vouchers page all read it just to
 * populate a bank picker, unrelated to who may administer bank accounts).
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useBanksAccess() {
    const tile = useTileAccess(BANKS_TILE);

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
