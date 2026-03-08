'use client';

import React, { createContext, useContext, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setCredentials, setLoading, clearCredentials } from '@/store/slices/authSlice';
import type { StaffUser } from '@/store/slices/authSlice';
import { authService } from '@/lib/auth.service';

// ─── Storage keys ─────────────────────────────────────────────────────────────

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
        return raw ? (JSON.parse(raw) as StaffUser) : null;
    } catch {
        return null;
    }
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

    // On mount: purge legacy keys and silently restore session via httpOnly cookie
    useEffect(() => {
        // One-time migration: purge legacy keys left by old auth systems
        LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));

        // Call refresh — the browser sends the httpOnly tafs_refresh cookie
        // automatically. If valid, backend rotates tokens + returns updated user.
        authService
            .refreshStaff()
            .then(({ user }) => {
                saveSession(user);
                dispatch(setCredentials({ user }));
            })
            .catch(() => {
                clearSession();
                dispatch(setLoading(false));
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const login = useCallback(
        async (username: string, password: string, redirectUrl?: string | null) => {
            const { user } = await authService.loginStaff(username, password);
            saveSession(user);
            dispatch(setCredentials({ user }));
            router.push(redirectUrl || '/dashboard');
        },
        [dispatch, router]
    );

    const logout = useCallback(async () => {
        try {
            // Backend clears all three auth cookies via Set-Cookie
            await authService.logoutStaff();
        } catch (error) {
            console.error('Logout API failed:', error);
        } finally {
            clearSession();
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
