'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/auth.service';

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await authService.forgotPasswordStaff(email);
            router.push(`/auth/reset-password?email=${encodeURIComponent(email)}`);
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string | string[] } } })
                    ?.response?.data?.message;
            setError(Array.isArray(msg) ? msg[0] : (msg ?? 'Something went wrong. Please try again.'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center md:text-left">
                <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                    Forgot your password?
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400 mt-2">
                    Enter your email address and we&apos;ll send you a verification code.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-6 border-t border-zinc-100 pt-8">
                <div>
                    <label
                        htmlFor="email"
                        className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
                    >
                        Email Address
                    </label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full px-3 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 sm:text-sm transition-all"
                        placeholder="your.email@tafs.edu"
                    />
                </div>

                {error && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

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
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                    )}
                    {loading ? 'Sending...' : 'Send Verification Code'}
                </button>

                <div className="text-center">
                    <Link
                        href="/auth/login"
                        className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                        Back to login
                    </Link>
                </div>
            </form>
        </div>
    );
}
