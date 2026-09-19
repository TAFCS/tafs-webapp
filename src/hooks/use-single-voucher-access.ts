"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const SINGLE_VOUCHER_TILE = "finance.single_voucher";

/**
 * Sub-permissions of Single Voucher Issuance, for hiding and disabling UI.
 *
 * Only `create` (POST /vouchers) is gated — every other route this page
 * calls (arrears, generate-pdf) is genuinely shared with the Vouchers and
 * Receive Deposit pages and stays ungated at the tile level.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useSingleVoucherAccess() {
    const tile = useTileAccess(SINGLE_VOUCHER_TILE);

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
