'use client';

import React, { createContext, useContext, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setCredentials, clearCredentials } from '@/store/slices/authSlice';
import type { StaffUser } from '@/store/slices/authSlice';
import { authService } from '@/lib/auth.service';
import { clearWebSession, markWebSession } from '@/lib/web-session';

// ─── Storage keys ─────────────────────────────────────────────────────────────

// Routes that stay public even when there's no session, so this mount-time
// refresh check must never bounce them to /auth/login.
const PUBLIC_PATHS = ['/auth', '/privacy-policy'];

// Only non-sensitive display data (name, role) is kept in localStorage.
// Auth tokens live exclusively in httpOnly cookies set by the backend.
const KEY_USER = 'tafs_user';

// Keys from previous auth systems (old prototypes, NextAuth experiment, etc.)
// Purged once on first load so browsers are cleaned up automatically.
const LEGACY_KEYS = [
    'tafs_access_token',
    'tafs_refresh_token',
    'access_token',
    'admin_token',
    'auth-storage',
    'nextauth.message',
];

export function saveSession(user: StaffUser) {
    localStorage.setItem(KEY_USER, JSON.stringify(user));
    // Note: tafs_access, tafs_refresh, and tafs_session cookies are set by the
    // backend via Set-Cookie headers — they are httpOnly and JS-inaccessible.
}

export function clearSession() {
    localStorage.removeItem(KEY_USER);
    // Auth cookies are cleared by the backend on logout via Set-Cookie max-age=0.
}

function loadCachedUser(): StaffUser | null {
    try {
        const raw = localStorage.getItem(KEY_USER);
        return raw ? normalizeStaffUser(JSON.parse(raw) as StaffUser) : null;
    } catch {
        return null;
    }
}

function normalizeStaffUser(user: StaffUser): StaffUser {
    return {
        ...user,
        allowedClassIds: user.allowedClassIds ?? [],
        permissions: user.permissions ?? [],
        effectiveTileIds: user.effectiveTileIds,
        effectiveActions: user.effectiveActions ?? [],
        // Left undefined on purpose when absent: undefined means "session
        // predates scope", which reads as unrestricted. An empty object here
        // would look identical but is also what a genuinely unrestricted user
        // gets, so the distinction does not matter to callers.
        scope: user.scope,
        payrollEnabled: user.payrollEnabled,
        hasEmployeeProfile: user.hasEmployeeProfile,
    };
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AuthContextValue {
    login: (username: string, password: string, redirectUrl?: string | null) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const dispatch = useAppDispatch();
    const router = useRouter();
    // Bumped on login/logout so a slow mount-time restore cannot clear a
    // session the user just established (or wipe after they signed out).
    const authEpoch = useRef(0);

    // On mount: purge legacy keys and silently restore session via httpOnly cookie
    useEffect(() => {
        // One-time migration: purge legacy keys left by old auth systems
        LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));

        const cached = loadCachedUser();
        if (cached) {
            // Unverified: lets the shell paint, but pages wait for the check
            // below — the cached scope may be wider than the user's current one.
            dispatch(setCredentials({ user: cached, verified: false }));
        }

        const epochAtStart = authEpoch.current;

        // Prefer cheap /me (JWT verify only). Fall back to full refresh (bcrypt
        // + token rotation) only when the access cookie is missing/expired.
        const restore = async () => {
            try {
                let user: StaffUser;
                try {
                    user = await authService.getStaffMe();
                } catch {
                    const refreshed = await authService.refreshStaff();
                    user = refreshed.user;
                }
                if (epochAtStart !== authEpoch.current) return;
                const normalized = normalizeStaffUser(user);
                saveSession(normalized);
                await markWebSession();
                if (epochAtStart !== authEpoch.current) return;
                dispatch(setCredentials({ user: normalized }));
            } catch {
                if (epochAtStart !== authEpoch.current) return;
                clearSession();
                await clearWebSession();
                dispatch(clearCredentials());
                if (
                    typeof window !== 'undefined' &&
                    !PUBLIC_PATHS.some((p) => window.location.pathname.startsWith(p))
                ) {
                    router.push('/auth/login');
                }
            }
        };
        void restore();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const login = useCallback(
        async (username: string, password: string, redirectUrl?: string | null) => {
            const { user } = await authService.loginStaff(username, password);
            // Invalidate any in-flight mount restore before we touch session state.
            authEpoch.current += 1;
            const normalized = normalizeStaffUser(user);
            saveSession(normalized);
            await markWebSession();
            dispatch(setCredentials({ user: normalized }));
            router.push(redirectUrl || '/home');
        },
        [dispatch, router]
    );

    const logout = useCallback(async () => {
        authEpoch.current += 1;
        try {
            // Backend clears all three auth cookies via Set-Cookie
            await authService.logoutStaff();
        } catch (error) {
            console.error('Logout API failed:', error);
        } finally {
            clearSession();
            await clearWebSession();
            dispatch(clearCredentials());
            router.push('/auth/login');
        }
    }, [dispatch, router]);

    return (
        <AuthContext.Provider value={{ login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Actions: login / logout */
export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}

/** Read auth state from Redux store */
export function useAuthState() {
    return useAppSelector((state) => state.auth);
}
