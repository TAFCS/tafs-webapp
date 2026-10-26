"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const DEVELOPER_SETTINGS_TILE = "system.developer_settings";

/**
 * Sub-permissions of Developer Settings (/admin/developer), for hiding and
 * disabling UI.
 *
 * `view` reads the app config; `edit` changes it, maintenance mode included.
 * The API guards GET /app-config and PATCH /app-config/:key with the same
 * actions.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useDeveloperSettingsAccess() {
  const tile = useTileAccess(DEVELOPER_SETTINGS_TILE);

  return useMemo(() => {
    const isSuperAdmin = tile.isSuperAdmin;
    const can = (actionId: string) => isSuperAdmin && tile.can(actionId);
    return {
      can,
      canAny: (...actionIds: string[]) => isSuperAdmin && actionIds.some(can),
      canAll: (...actionIds: string[]) => isSuperAdmin && actionIds.every(can),
      hasTile: isSuperAdmin,
      isSuperAdmin,
      staleSession: false,
    };
  }, [tile]);
}
