"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const TEACHING_GROUPS_TILE = "attendance.teaching_groups";

/**
 * Sub-permissions of Teaching Groups, for hiding and disabling UI.
 *
 * `manage` creates, edits and deletes groups; `enroll` enrols students and
 * removes them from a group.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useTeachingGroupsAccess() {
    const tile = useTileAccess(TEACHING_GROUPS_TILE);

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
