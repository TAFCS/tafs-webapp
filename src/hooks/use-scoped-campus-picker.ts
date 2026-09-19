"use client";

import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import { useUserScope } from "./use-tile-access";

/**
 * Narrows a campus picker to what the user may actually choose, and tells the
 * caller when there is only one option — in which case it should be rendered
 * as a locked label (the real campus name), never a dropdown with one item
 * or a placeholder like "Your campus".
 *
 * Prefers the new universal scope; falls back to the legacy `campusId` field
 * only when the new scope itself is unrestricted — the same "AND, defer to
 * whichever one actually restricts" rule the backend uses everywhere in the
 * scope/tile-permission handoff. This replaces the old per-page pattern of
 * checking `user.role === "CAMPUS_ADMIN"` to decide whether to lock the
 * picker: any scoped role (not just Campus Admin) gets the same treatment.
 */
export function useScopedCampusPicker<T extends { id: number; campus_name: string }>(
    allCampuses: T[],
) {
    const { filterOptions, isRestricted } = useUserScope();
    const user = useAppSelector((s) => s.auth.user);

    return useMemo(() => {
        let options = filterOptions("campuses", allCampuses, (c) => c.id);
        if (!isRestricted("campuses") && user?.campusId != null) {
            options = allCampuses.filter((c) => c.id === user.campusId);
        }
        return {
            /** Pass to a dropdown as-is — already narrowed to what's allowed. */
            options,
            isLocked: options.length === 1,
            /** The one allowed campus, when isLocked is true. */
            lockedCampus: options.length === 1 ? options[0] : undefined,
        };
    }, [allCampuses, filterOptions, isRestricted, user?.campusId]);
}
