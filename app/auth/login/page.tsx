"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        router.push("/erp/dashboard");
    };

    return (
        <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center md:text-left">
                <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">Welcome back</h2>
                <p className="text-zinc-500 dark:text-zinc-400 mt-2">Enter your credentials to access the ERP</p>
            </div>

            <form onSubmit={handleLogin} className="mt-8 space-y-6 border-t border-zinc-100 dark:border-zinc-800 pt-8">
                <div className="space-y-4 md:space-y-5">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Email address</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            className="block w-full px-3 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-white sm:text-sm transition-all"
                            placeholder="admin@tafs.edu"
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Password</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            className="block w-full px-3 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-white sm:text-sm transition-all"
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <input id="remember-me" name="remember-me" type="checkbox" className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900" />
                        <label htmlFor="remember-me" className="ml-2 block text-sm text-zinc-700 dark:text-zinc-300">Remember me</label>
                    </div>
                    <div className="text-sm">
                        <Link href="#" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 transition-colors">Forgot your password?</Link>
                    </div>
                </div>

                <div>
                    <button type="submit" className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:ring-offset-black transition-all active:scale-[0.98]">
                        Sign in
                    </button>
                </div>
            </form>

            <div className="mt-8 text-center text-xs text-zinc-500">
                <p>Protected by TAFS Identity. V1.0.0</p>
            </div>
        </div>
    );
}
