"use client";

import { useMemo } from "react";
import { useTileAccess } from "./use-tile-access";

export const STUDENT_DOCUMENTS_TILE = "student.documents";

/**
 * TAFSD-498: sub-permissions of Student → Student Documents. Gates the page,
 * the Documents tab in the student panel, and the buttons inside both. An
 * affordance, not the boundary: the backend checks every action and the
 * caller's scope. Unlike most tiles this one does NOT fail open for an old
 * session, because it shows identity documents.
 */
export function useStudentDocumentsAccess() {
    const tile = useTileAccess(STUDENT_DOCUMENTS_TILE);

    return useMemo(
        () => ({
            hasTile: tile.hasTile,
            can: tile.can,
            canView: tile.hasTile && tile.can("view"),
            isSuperAdmin: tile.isSuperAdmin,
        }),
        [tile],
    );
}
