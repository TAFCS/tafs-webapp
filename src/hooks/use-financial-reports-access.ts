"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const FINANCIAL_REPORTS_TILE = "finance.financial_reports";

/**
 * The report tabs, each its own sub-permission (TAFSD-482). Order is the tab
 * bar's order, and the first one the user holds is where /financial-reports
 * lands them.
 */
export const FINANCIAL_REPORT_TABS = [
    { slug: "fee-heads", action: "fee_heads.view", label: "Fee Heads" },
    { slug: "deposits", action: "deposits.view", label: "Deposits" },
    { slug: "fee-matrix", action: "fee_matrix.view", label: "Fee Matrix" },
    { slug: "defaulters", action: "defaulters.view", label: "Defaulters" },
] as const;

export type FinancialReportTabSlug = (typeof FINANCIAL_REPORT_TABS)[number]["slug"];

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
        const canTab = (slug: FinancialReportTabSlug) => {
            const tab = FINANCIAL_REPORT_TABS.find((t) => t.slug === slug);
            return tab != null && can(tab.action);
        };
        return {
            can,
            canTab,
            allowedTabs: FINANCIAL_REPORT_TABS.filter((t) => can(t.action)),
            canAny: (...actionIds: string[]) => actionIds.some(can),
            canAll: (...actionIds: string[]) => actionIds.every(can),
            hasTile: tile.hasTile,
            isSuperAdmin: tile.isSuperAdmin,
            staleSession,
        };
    }, [tile]);
}
