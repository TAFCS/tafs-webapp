'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authService } from '@/lib/auth.service';

function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const email = searchParams.get('email') ?? '';

    const [code, setCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }

        setLoading(true);
        try {
            await authService.resetPasswordStaff(email, code, newPassword);
            router.push('/auth/login');
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
                    Reset your password
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400 mt-2">
                    {email
                        ? <>A verification code was sent to <span className="font-medium text-zinc-700 dark:text-zinc-300">{email}</span></>
                        : 'Enter the code sent to your email along with your new password.'
                    }
                </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-6 border-t border-zinc-100 pt-8">
                <div className="space-y-4 md:space-y-5">
                    <div>
                        <label
                            htmlFor="code"
                            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
                        >
                            Verification Code
                        </label>
                        <input
                            id="code"
                            name="code"
                            type="text"
                            inputMode="numeric"
                            maxLength={4}
                            required
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            className="block w-full px-3 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 sm:text-sm transition-all tracking-[0.3em] text-center text-lg font-semibold"
                            placeholder="0000"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="new-password"
                            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
                        >
                            New Password
                        </label>
                        <input
                            id="new-password"
                            name="new-password"
                            type="password"
                            autoComplete="new-password"
                            required
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="block w-full px-3 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 sm:text-sm transition-all"
                            placeholder="Min 8 characters"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="confirm-password"
                            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
                        >
                            Confirm Password
                        </label>
                        <input
                            id="confirm-password"
                            name="confirm-password"
                            type="password"
                            autoComplete="new-password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="block w-full px-3 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 sm:text-sm transition-all"
                            placeholder="••••••••"
                        />
                    </div>
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
                    {loading ? 'Resetting...' : 'Reset Password'}
                </button>
            </form>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center p-4">Loading...</div>}>
            <ResetPasswordForm />
        </Suspense>
    );
}
