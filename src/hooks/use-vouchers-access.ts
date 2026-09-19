"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const VOUCHERS_TILE = "finance.vouchers";

/**
 * Sub-permissions of the Vouchers directory, for hiding and disabling UI.
 *
 * Deliberately minimal — VouchersController is shared by at least 6 tiles
 * with no clean per-route ownership (see the scope/tile-permission handoff),
 * so only `view`, `edit`, and `delete` exist here, covering the handful of
 * routes safely assignable to this tile alone. Every route this tile shares
 * with another tile's page (waive, split, generate-pdf, deposit, etc.) is
 * still gated only by the coarse capability layer — this hook has nothing to
 * say about those.
 *
 * Same contract as useStudentAccess/useEmployeeAccess/usePayrollAccess: this
 * is an affordance, not the boundary. Fails open for a session that predates
 * sub-permissions — see those hooks for why that's safe.
 */
export function useVouchersAccess() {
    const tile = useTileAccess(VOUCHERS_TILE);

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
