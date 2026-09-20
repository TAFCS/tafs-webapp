"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const ZK_DEVICE_LOGS_TILE = "attendance.zk_device_logs";

/**
 * Sub-permissions of ZK Device Logs, for hiding and disabling UI. Everything
 * here was super-admin-only, so beyond `view` (the raw log) nothing is held by
 * anyone until a super admin grants it: `mappings.view`, `mappings.delete`,
 * `simulate` and `resolve`. The API also needs an unrestricted data scope.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useZkDeviceLogsAccess() {
    const tile = useTileAccess(ZK_DEVICE_LOGS_TILE);

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
