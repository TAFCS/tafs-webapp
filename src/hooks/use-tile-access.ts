"use client";

import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import {
    EMPTY_USER_SCOPE,
    type UserScope,
} from "@/store/slices/authSlice";

/** Global address of a sub-permission, matching the backend's actionKey(). */
export function actionKey(tileId: string, actionId: string): string {
    return `${tileId}#${actionId}`;
}

/**
 * Gates UI against the sub-permissions of a single tile.
 *
 *   const emp = useTileAccess("hr.employee_directory");
 *   if (!emp.can("schedule_pay.view")) return null;
 *   <button disabled={!emp.can("delete")}>Delete</button>
 *
 * This hides and disables; it is NOT the enforcement boundary. The API is,
 * via @RequireAction on the route. Never rely on this alone.
 */
export function useTileAccess(tileId: string) {
    const user = useAppSelector((s) => s.auth.user);

    return useMemo(() => {
        const isSuperAdmin = user?.role === "SUPER_ADMIN";
        const held = new Set(user?.effectiveActions ?? []);

        const can = (actionId: string) =>
            isSuperAdmin || held.has(actionKey(tileId, actionId));

        return {
            can,
            canAny: (...actionIds: string[]) => actionIds.some(can),
            canAll: (...actionIds: string[]) => actionIds.every(can),
            /** True when the tile itself is reachable at all. */
            hasTile:
                isSuperAdmin || (user?.effectiveTileIds ?? []).includes(tileId),
            isSuperAdmin,
            /**
             * True when the session predates sub-permissions. Callers that must
             * not fail open can use this to force a refresh instead of showing
             * an empty page.
             */
            sessionPredatesActions: user != null && user.effectiveActions === undefined,
        };
    }, [user, tileId]);
}

/**
 * The current user's universal data scope.
 *
 * An empty array on a dimension means UNRESTRICTED, so `isRestricted` is the
 * predicate you usually want, not `length > 0` on its own.
 */
export function useUserScope() {
    const user = useAppSelector((s) => s.auth.user);

    return useMemo(() => {
        const isSuperAdmin = user?.role === "SUPER_ADMIN";
        const scope: UserScope =
            isSuperAdmin || !user?.scope ? EMPTY_USER_SCOPE : user.scope;

        const isRestricted = (dim: keyof UserScope) => scope[dim].length > 0;

        const allows = (dim: keyof UserScope, id: number | null | undefined) => {
            if (!isRestricted(dim)) return true;
            if (id == null) return false;
            return scope[dim].includes(id);
        };

        /** Narrows a picker's options to what the user may actually choose. */
        const filterOptions = <T,>(
            dim: keyof UserScope,
            options: T[],
            getId: (option: T) => number,
        ): T[] => (isRestricted(dim) ? options.filter((o) => allows(dim, getId(o))) : options);

        return { scope, isSuperAdmin, isRestricted, allows, filterOptions };
    }, [user]);
}
