"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const NOTICE_BOARD_TILE = "communication.notice_board";

/**
 * Sub-permissions of the admin Notice Board, for hiding and disabling UI.
 *
 * Only the admin routes are gated — the parent-facing feed is unrelated and
 * untouched.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useNoticeBoardAccess() {
    const tile = useTileAccess(NOTICE_BOARD_TILE);

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
