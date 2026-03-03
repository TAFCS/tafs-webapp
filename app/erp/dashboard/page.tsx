export default function DashboardPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">Dashboard</h1>
                <p className="text-zinc-500 dark:text-zinc-400 mt-1">Overview of today's activities and core metrics.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Summary Cards */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Total Active Students</p>
                    <p className="text-3xl font-bold text-zinc-900 dark:text-white">1,248</p>
                    <div className="mt-2 text-sm text-emerald-600 dark:text-emerald-400 flex items-center">
                        <span>+12 this month</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Pending Admissions</p>
                    <p className="text-3xl font-bold text-zinc-900 dark:text-white">34</p>
                    <div className="mt-2 text-sm text-blue-600 dark:text-blue-400 flex items-center">
                        <span>Needs review</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">Today's Fee Collection</p>
                    <p className="text-3xl font-bold text-zinc-900 dark:text-white">₨ 450,000</p>
                    <div className="mt-2 text-sm text-emerald-600 dark:text-emerald-400 flex items-center">
                        <span>Synced with PayPro</span>
                    </div>
                </div>
            </div>

            {/* Main workspace section */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-lg font-medium text-zinc-900 dark:text-white">Recent Activity</h3>
                </div>
                <div className="p-6">
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                            <span className="text-zinc-400">📊</span>
                        </div>
                        <h3 className="text-sm font-medium text-zinc-900 dark:text-white">No recent activity</h3>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Activity will appear here once the system is fully operational.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
