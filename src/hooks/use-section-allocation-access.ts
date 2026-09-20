"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const STUDENT_SECTION_ALLOCATION_TILE = "student.section_allocation";
export const SCHOOL_SETUP_SECTION_ALLOCATION_TILE = "school-setup.section_allocation";

/**
 * Sub-permissions of Section Allocation Rules, for hiding and disabling UI.
 *
 * The one page is listed under two tiles (Student & Profiling and School
 * Setup), which carry the same actions, and the API accepts either. So this
 * answers "does EITHER tile the user holds allow it".
 *
 * `rules.edit` changes a section's rules; `move` moves students between
 * sections.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useSectionAllocationAccess() {
    const a = useTileAccess(STUDENT_SECTION_ALLOCATION_TILE);
    const b = useTileAccess(SCHOOL_SETUP_SECTION_ALLOCATION_TILE);

    return useMemo(() => {
        const staleSession =
            (a.hasTile && !a.can("view")) || (b.hasTile && !b.can("view"));
        const can = (actionId: string) => staleSession || a.can(actionId) || b.can(actionId);
        return {
            can,
            canAny: (...actionIds: string[]) => actionIds.some(can),
            canAll: (...actionIds: string[]) => actionIds.every(can),
            hasTile: a.hasTile || b.hasTile,
            isSuperAdmin: a.isSuperAdmin,
            staleSession,
        };
    }, [a, b]);
}
