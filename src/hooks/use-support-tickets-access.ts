"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const SUPPORT_TICKETS_TILE = "communication.support_tickets";

/**
 * Sub-permissions of Support Tickets (/support-tickets), for hiding and disabling UI.
 *
 * `view` covers opening Support Tickets, viewing assigned tickets, queues, and closed history.
 * `respond` covers sending replies, attaching media, recording voice notes, and closing tickets.
 * `reassign` covers claiming, transferring, or forwarding tickets between staff.
 * `manage_replies` covers reviewing, approving, rejecting, editing, or deleting pending replies.
 *
 * Same contract as other use-*-access hooks: an affordance, not the boundary.
 * Every route is guarded by @RequireAction and every query merges student scope.
 *
 * Fails open for a session that predates sub-permissions: it carries no
 * actions at all, while any session holding this tile carries at least `view`
 * (its default action), so "holds the tile but cannot view" can only be a
 * stale token. Access tokens live 90 days.
 */
export function useSupportTicketsAccess() {
  const tile = useTileAccess(SUPPORT_TICKETS_TILE);

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
