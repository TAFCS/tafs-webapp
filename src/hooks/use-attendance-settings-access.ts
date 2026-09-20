"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const ATTENDANCE_SETTINGS_TILE = "attendance.settings";

/**
 * Sub-permissions of Attendance Settings, for hiding and disabling UI.
 *
 * `sets.manage` and `rules.manage` edit policy sets and their rules;
 * `schedules.manage` edits class check-in schedules; `recompute` rewrites late
 * status for a campus over a date range.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useAttendanceSettingsAccess() {
    const tile = useTileAccess(ATTENDANCE_SETTINGS_TILE);

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
