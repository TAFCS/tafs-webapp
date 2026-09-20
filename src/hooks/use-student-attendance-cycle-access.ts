"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const STUDENT_ATTENDANCE_CYCLE_TILE = "attendance.student_attendance_cycle";

/**
 * Sub-permissions of Student Attendance by Cycle, for hiding and disabling UI.
 * `export` downloads the cycle matrix.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useStudentAttendanceCycleAccess() {
    const tile = useTileAccess(STUDENT_ATTENDANCE_CYCLE_TILE);

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
