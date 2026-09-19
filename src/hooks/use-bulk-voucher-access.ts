"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const BULK_VOUCHER_TILE = "finance.bulk_voucher";

/**
 * Sub-permissions of Bulk Voucher Issuance, for hiding and disabling UI.
 *
 * `start` is ALSO reachable from the Vouchers page's batch-reissue flow
 * (POST /vouchers/batch-issue), gated there with @RequireAnyAction across
 * this tile and finance.vouchers#edit — a Vouchers-only holder is unaffected
 * by this hook.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useBulkVoucherAccess() {
    const tile = useTileAccess(BULK_VOUCHER_TILE);

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
