"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const ACTIVITY_LOGS_TILE = "system.activity_logs";

/**
 * Sub-permissions of Activity Logs (/system/logs), for hiding and disabling UI.
 *
 * The tile has a single action, `view`: the page only reads the feed. The API
 * guards GET /audit-logs with @RequireAnyAction and trims the feed to the
 * caller's scope.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useActivityLogsAccess() {
  const tile = useTileAccess(ACTIVITY_LOGS_TILE);

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
