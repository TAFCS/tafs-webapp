import React from 'react';
import Link from 'next/link';
import { TrendingUp, ArrowLeftRight } from 'lucide-react';

export default function TransitionsHub() {
    return (
        <div className="max-w-4xl mx-auto space-y-6 py-8 px-4">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">Academic Transitions</h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">Manage student promotions and academic system shifts</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8">
                <Link href="/bulk-promote" className="group">
                    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm hover:shadow-xl hover:border-blue-500/30 transition-all duration-300 flex flex-col h-full gap-6 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-500/0 group-hover:from-blue-500/5 group-hover:to-blue-500/0 transition-all duration-500" />
                        <div className="h-16 w-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors relative z-10">
                            <TrendingUp className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="relative z-10 flex-1">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-2">Bulk Promote</h2>
                            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                Promote entire classes to the next academic year. Manage passing students, detained students, and expulsions in bulk.
                            </p>
                        </div>
                    </div>
                </Link>

                <Link href="/transfers" className="group">
                    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm hover:shadow-xl hover:border-red-500/30 transition-all duration-300 flex flex-col h-full gap-6 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-red-500/0 to-red-500/0 group-hover:from-red-500/5 group-hover:to-red-500/0 transition-all duration-500" />
                        <div className="h-16 w-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center group-hover:bg-red-100 dark:group-hover:bg-red-900/30 transition-colors relative z-10">
                            <ArrowLeftRight className="h-8 w-8 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="relative z-10 flex-1">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors mb-2">Individual Transfers</h2>
                            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                Shift individual students between Cambridge and Secondary academic systems with official Transfer Order PDF generation.
                            </p>
                        </div>
                    </div>
                </Link>
            </div>
        </div>
    );
}
