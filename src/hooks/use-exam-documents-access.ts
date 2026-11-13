"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const EXAM_DOCUMENTS_TILE = "student.exam_documents";

/**
 * TAFSD-510: sub-permissions of Student → Exam Documents (manage_schedules,
 * issue, override_dues). Nobody holds the tile by default; it is granted per
 * person in People & Access.
 *
 * Same contract as the other use-*-access hooks: an affordance, not the
 * boundary. Fails open for a session that predates sub-permissions.
 */
export function useExamDocumentsAccess() {
    const tile = useTileAccess(EXAM_DOCUMENTS_TILE);

    return useMemo(() => {
        const staleSession = tile.hasTile && !tile.can("view");
        const can = (actionId: string) => staleSession || tile.can(actionId);
        return {
            can,
            hasTile: tile.hasTile,
            isSuperAdmin: tile.isSuperAdmin,
            staleSession,
        };
    }, [tile]);
}
