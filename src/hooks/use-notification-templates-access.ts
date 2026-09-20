"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const NOTIFICATION_TEMPLATES_TILE = "communication.notification_templates";

/**
 * Sub-permissions of Notification Templates (/admin/notification-templates), for hiding and disabling UI.
 *
 * `view` covers loading and viewing push notification templates and their enabled/disabled status.
 * `edit` covers editing template texts, variables, and enabling/disabling notification types.
 *
 * Same contract as other use-*-access hooks: an affordance, not the boundary.
 * Every route is guarded by @RequireAction.
 *
 * Fails open for a session that predates sub-permissions: it carries no
 * actions at all, while any session holding this tile carries at least `view`
 * (its default action), so "holds the tile but cannot view" can only be a
 * stale token. Access tokens live 90 days.
 */
export function useNotificationTemplatesAccess() {
  const tile = useTileAccess(NOTIFICATION_TEMPLATES_TILE);

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
