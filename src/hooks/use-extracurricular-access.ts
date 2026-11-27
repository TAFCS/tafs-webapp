"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

/**
 * TAFSD-605: the Extracurricular Fees module's tiles. Nobody holds them by
 * default; they are granted per person in People & Access.
 */
export const EC_TILES = {
    feeHeads: "extracurricular.fee_heads",
    classSchedule: "extracurricular.class_schedule",
    studentCharges: "extracurricular.student_charges",
    singleVoucher: "extracurricular.single_voucher",
    vouchers: "extracurricular.vouchers",
    receiveDeposit: "extracurricular.receive_deposit",
    paymentHistory: "extracurricular.payment_history",
    bulkVoucher: "extracurricular.bulk_voucher",
    reports: "extracurricular.reports",
} as const;

export type EcTileId = (typeof EC_TILES)[keyof typeof EC_TILES];

/**
 * Sub-permissions of one EC tile. Same contract as the other use-*-access
 * hooks: an affordance, not the boundary (the API enforces). Fails open for a
 * session that predates sub-permissions.
 */
export function useExtracurricularAccess(tileId: EcTileId) {
    const tile = useTileAccess(tileId);

    return useMemo(() => {
        const staleSession = tile.hasTile && !tile.can("view");
        const can = (actionId: string) => staleSession || tile.can(actionId);
        return {
            can,
            canAny: (...actionIds: string[]) => actionIds.some(can),
            hasTile: tile.hasTile,
            isSuperAdmin: tile.isSuperAdmin,
            staleSession,
        };
    }, [tile]);
}
