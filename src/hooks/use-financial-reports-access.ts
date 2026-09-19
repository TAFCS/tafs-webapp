"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const FINANCIAL_REPORTS_TILE = "finance.financial_reports";

/**
 * Sub-permissions of Financial Reports, for hiding and disabling UI.
 *
 * Standalone — no shared routes with any other tile.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useFinancialReportsAccess() {
    const tile = useTileAccess(FINANCIAL_REPORTS_TILE);

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
