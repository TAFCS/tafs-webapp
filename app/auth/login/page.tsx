'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await login(username, password);
            // redirect handled inside AuthContext
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string | string[] } } })
                    ?.response?.data?.message;
            setError(Array.isArray(msg) ? msg[0] : (msg ?? 'Invalid credentials. Please try again.'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center md:text-left">
                <h2 className="text-3xl font-semibold tracking-tight text-zinc-900">
                    Welcome back
                </h2>
                <p className="text-zinc-500 mt-2">
                    Enter your credentials to access the ERP
                </p>
            </div>

            <form
                onSubmit={handleLogin}
                className="mt-8 space-y-6 border-t border-zinc-100 pt-8"
            >
                <div className="space-y-4 md:space-y-5">
                    {/* Username */}
                    <div>
                        <label
                            htmlFor="username"
                            className="block text-sm font-medium text-zinc-700 mb-1.5"
                        >
                            Username or Email
                        </label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            autoComplete="username"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="block w-full px-3 py-2.5 border border-zinc-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-white text-zinc-900 sm:text-sm transition-all"
                            placeholder="admin@tafs.edu"
                        />
                    </div>

                    {/* Password */}
                    <div>
                        <label
                            htmlFor="password"
                            className="block text-sm font-medium text-zinc-700 mb-1.5"
                        >
                            Password
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="block w-full px-3 py-2.5 border border-zinc-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-white text-zinc-900 sm:text-sm transition-all"
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                {/* Error banner */}
                {error && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <input
                            id="remember-me"
                            name="remember-me"
                            type="checkbox"
                            className="h-4 w-4 text-primary focus:ring-primary border-zinc-300 rounded bg-white"
                        />
                        <label
                            htmlFor="remember-me"
                            className="ml-2 block text-sm text-zinc-700"
                        >
                            Remember me
                        </label>
                    </div>
                    <div className="text-sm">
                        <Link
                            href="#"
                            className="font-medium text-primary hover:text-primary/80 transition-colors"
                        >
                            Forgot your password?
                        </Link>
                    </div>
                </div>

                <div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {loading && (
                            <svg
                                className="animate-spin h-4 w-4"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                />
                                <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8v8H4z"
                                />
                            </svg>
                        )}
                        {loading ? 'Signing in…' : 'Sign in'}
                    </button>
                </div>
            </form>

            <div className="mt-8 text-center text-xs text-zinc-500">
                <p>Protected by TAFS Identity. V1.0.0</p>
            </div>
        </div>
    );
}
