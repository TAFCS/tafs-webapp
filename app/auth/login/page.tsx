'use client';

import Link from 'next/link';
import { useState, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSearchParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';

const inputClass =
    'block h-12 w-full rounded-xl border border-transparent bg-zinc-100 px-4 text-[15px] text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-[#255A94] focus:bg-white dark:bg-zinc-900 dark:text-zinc-100 dark:focus:bg-zinc-950';
const labelClass = 'mb-2 block text-[14px] font-medium text-zinc-800 dark:text-zinc-200';

function LoginForm() {
    const { login } = useAuth();
    const searchParams = useSearchParams();
    const redirectUrl = searchParams.get('redirect');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [capsLock, setCapsLock] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await login(username, password, redirectUrl);
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

    const trackCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState('CapsLock'));

    return (
        <div>
            <h2 className="text-[30px] font-semibold tracking-[-0.02em]">Sign in to TAFSync</h2>
            <p className="mt-2 text-[15px] text-zinc-500 dark:text-zinc-400">Use your school account to continue.</p>

            <form onSubmit={handleLogin} className="mt-8 space-y-5">
                <div>
                    <label htmlFor="username" className={labelClass}>
                        Username or email
                    </label>
                    <input
                        id="username"
                        name="username"
                        type="text"
                        autoComplete="username"
                        autoFocus
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={inputClass}
                        placeholder="Enter your username or email"
                    />
                </div>

                <div>
                    <label htmlFor="password" className={labelClass}>
                        Password
                    </label>
                    <div className="relative">
                        <input
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyUp={trackCapsLock}
                            onKeyDown={trackCapsLock}
                            className={`${inputClass} pr-12`}
                            placeholder="Enter your password"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                        >
                            {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                        </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-[13px] font-medium text-[#D56637]">{capsLock ? 'Caps Lock is on' : ''}</span>
                        <Link href="/auth/forgot-password" className="text-[13px] font-medium text-[#255A94] hover:underline dark:text-sky-300">
                            Forgot password?
                        </Link>
                    </div>
                </div>

                {error && (
                    <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#255A94] text-[15px] font-semibold text-white transition-colors hover:bg-[#1E4B7C] disabled:cursor-not-allowed disabled:opacity-70"
                >
                    {loading && (
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                    )}
                    {loading ? 'Signing in…' : 'Sign in'}
                </button>
            </form>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="flex h-72 items-center justify-center text-sm text-zinc-400">Loading…</div>}>
            <LoginForm />
        </Suspense>
    );
}
