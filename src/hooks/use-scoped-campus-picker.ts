"use client";

import { useMemo } from "react";
import { useUserScope } from "./use-tile-access";

/**
 * Narrows a campus picker to what the user may actually choose, and tells the
 * caller when there is only one option — in which case it should be rendered
 * as a locked label (the real campus name), never a dropdown with one item
 * or a placeholder like "Your campus".
 *
 * Driven by the user's campus scope alone — never `user.campusId`, which is
 * their home campus, not what they may access. Any scoped role (not just
 * Campus Admin) gets the same treatment.
 */
export function useScopedCampusPicker<T extends { id: number; campus_name: string }>(
    allCampuses: T[],
) {
    const { filterOptions } = useUserScope();

    return useMemo(() => {
        const options = filterOptions("campuses", allCampuses, (c) => c.id);
        return {
            /** Pass to a dropdown as-is — already narrowed to what's allowed. */
            options,
            isLocked: options.length === 1,
            /** The one allowed campus, when isLocked is true. */
            lockedCampus: options.length === 1 ? options[0] : undefined,
        };
    }, [allCampuses, filterOptions]);
}
