"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const STUDENT_ATTENDANCE_TILE = "attendance.student_attendance";

/**
 * Sub-permissions of Student Attendance, for hiding and disabling UI. `mark`
 * marks attendance in bulk; `resolve` overrides what the device recorded for a
 * day.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useStudentAttendanceAccess() {
    const tile = useTileAccess(STUDENT_ATTENDANCE_TILE);

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
