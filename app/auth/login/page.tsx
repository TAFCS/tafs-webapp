'use client';

import Link from 'next/link';
import { useState, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, Lock, User, AlertTriangle } from 'lucide-react';
import { greetingFor, pktHour, useNow } from '../_components/pkt-time';

const fieldShell =
    'group flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/70 px-4 transition-all focus-within:border-[#255A94] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#255A94]/10 dark:border-zinc-800 dark:bg-zinc-900/60 dark:focus-within:bg-zinc-900';
const fieldInput =
    'h-12 w-full bg-transparent text-[15px] text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100';
const fieldIcon = 'h-[18px] w-[18px] shrink-0 text-zinc-400 transition-colors group-focus-within:text-[#255A94]';

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
    const now = useNow(60_000);

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
        <div className="w-full">
            <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.2em] text-[#D56637]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#D56637]" />
                {now ? greetingFor(pktHour(now)) : 'Welcome'}
            </p>
            <h2 className="tfs-display mt-3 text-[34px] font-semibold leading-none tracking-[-0.03em]">
                Sign in
            </h2>
            <p className="mt-2 text-[15px] text-zinc-500 dark:text-zinc-400">
                Pick up right where your campus left off.
            </p>

            <form onSubmit={handleLogin} className="mt-8 space-y-4">
                <div>
                    <label htmlFor="username" className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
                        Username or email
                    </label>
                    <div className={fieldShell}>
                        <User className={fieldIcon} />
                        <input
                            id="username"
                            name="username"
                            type="text"
                            autoComplete="username"
                            autoFocus
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className={fieldInput}
                            placeholder="you@tafs.edu"
                        />
                    </div>
                </div>

                <div>
                    <div className="mb-1.5 flex items-center justify-between">
                        <label htmlFor="password" className="block text-[12px] font-semibold uppercase tracking-wider text-zinc-500">
                            Password
                        </label>
                        <Link href="/auth/forgot-password" className="text-[13px] font-medium text-[#255A94] transition-colors hover:text-[#D56637] dark:text-sky-300">
                            Forgot?
                        </Link>
                    </div>
                    <div className={fieldShell}>
                        <Lock className={fieldIcon} />
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
                            className={fieldInput}
                            placeholder="Your password"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            className="-mr-1.5 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                        >
                            {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                        </button>
                    </div>
                    {capsLock && (
                        <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-amber-600">
                            <AlertTriangle className="h-3.5 w-3.5" /> Caps Lock is on
                        </p>
                    )}
                </div>

                {error && (
                    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="group relative mt-2 flex h-[52px] w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[#255A94] text-[15px] font-semibold text-white shadow-[0_12px_30px_-10px_rgba(37,90,148,0.8)] transition-all hover:shadow-[0_16px_40px_-10px_rgba(213,102,55,0.6)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                >
                    <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-[#255A94] via-[#2F6DB0] to-[#D56637] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                    <span className="relative flex items-center gap-2">
                        {loading ? (
                            <>
                                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                                Syncing…
                            </>
                        ) : (
                            <>
                                Sign in
                                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                            </>
                        )}
                    </span>
                </button>
            </form>

            <p className="mt-8 border-t border-zinc-100 pt-5 text-center text-[12.5px] text-zinc-400 dark:border-zinc-800">
                Encrypted session ·{' '}
                <a href="https://tafs.cloud" target="_blank" rel="noopener noreferrer" className="font-medium text-zinc-500 hover:text-[#D56637] dark:text-zinc-300">
                    tafs.cloud
                </a>
            </p>
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
