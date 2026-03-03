'use client';

import React, { createContext, useContext, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setCredentials, setLoading, clearCredentials } from '@/store/slices/authSlice';
import type { StaffUser } from '@/store/slices/authSlice';
import { authService } from '@/lib/auth.service';

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEY_ACCESS = 'tafs_access_token';
const KEY_REFRESH = 'tafs_refresh_token';
const KEY_USER = 'tafs_user';

export function saveSession(accessToken: string, refreshToken: string, user: StaffUser) {
    localStorage.setItem(KEY_ACCESS, accessToken);
    localStorage.setItem(KEY_REFRESH, refreshToken);
    localStorage.setItem(KEY_USER, JSON.stringify(user));
    // Keep api.ts interceptor in sync
    localStorage.setItem('access_token', accessToken);
}

export function clearSession() {
    localStorage.removeItem(KEY_ACCESS);
    localStorage.removeItem(KEY_REFRESH);
    localStorage.removeItem(KEY_USER);
    localStorage.removeItem('access_token');
}

function loadSession(): { user: StaffUser | null; refreshToken: string | null } {
    try {
        const raw = localStorage.getItem(KEY_USER);
        const refreshToken = localStorage.getItem(KEY_REFRESH);
        return {
            user: raw ? (JSON.parse(raw) as StaffUser) : null,
            refreshToken,
        };
    } catch {
        return { user: null, refreshToken: null };
    }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AuthContextValue {
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const dispatch = useAppDispatch();
    const router = useRouter();

    // On mount: rehydrate from localStorage by silently refreshing tokens
    useEffect(() => {
        const { user, refreshToken } = loadSession();

        if (user && refreshToken) {
            authService
                .refreshStaff(refreshToken)
                .then(({ accessToken, refreshToken: newRefresh }) => {
                    saveSession(accessToken, newRefresh, user);
                    dispatch(setCredentials({ accessToken, refreshToken: newRefresh, user }));
                })
                .catch(() => {
                    // Refresh token expired/revoked — force re-login
                    clearSession();
                    dispatch(setLoading(false));
                });
        } else {
            dispatch(setLoading(false));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const login = useCallback(
        async (username: string, password: string) => {
            const { accessToken, refreshToken, user } = await authService.loginStaff(username, password);
            saveSession(accessToken, refreshToken, user);
            dispatch(setCredentials({ accessToken, refreshToken, user }));
            router.push('/erp/dashboard');
        },
        [dispatch, router]
    );

    const logout = useCallback(async () => {
        try {
            await authService.logoutStaff();
            console.log("Logout API success.")
        } catch (error) {
            console.error("Logout API failed:", error);
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
