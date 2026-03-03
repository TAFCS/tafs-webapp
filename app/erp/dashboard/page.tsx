import Link from "next/link";
import { UserPlus, ArrowRight } from "lucide-react";

export default function DashboardPage() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 ">Dashboard</h1>
                    <p className="text-zinc-500  mt-1">Overview of today's activities and core metrics.</p>
                </div>

                <div className="flex items-center space-x-3">
                    <Link
                        href="/erp/identity/register"
                        className="inline-flex items-center justify-center px-4 py-2.5 bg-secondary hover:bg-secondary/90 text-white text-sm font-medium rounded-lg shadow-sm shadow-secondary/20 transition-all active:scale-95"
                    >
                        <UserPlus className="h-4 w-4 mr-2" />
                        New Registration
                    </Link>
                    <Link
                        href="/erp/identity/admission"
                        className="inline-flex items-center justify-center px-4 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg shadow-sm shadow-primary/20 transition-all active:scale-95"
                    >
                        <UserPlus className="h-4 w-4 mr-2" />
                        New Admission (5-Page)
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Summary Cards */}
                <div className="bg-white  border border-zinc-200  rounded-xl p-6 shadow-sm">
                    <p className="text-sm font-medium text-zinc-500  mb-1">Total Active Students</p>
                    <p className="text-3xl font-bold text-zinc-900 ">1,248</p>
                    <div className="mt-2 text-sm text-emerald-600  flex items-center">
                        <span>+12 this month</span>
                    </div>
                </div>

                <div className="bg-white  border border-zinc-200  rounded-xl p-6 shadow-sm flex flex-col justify-between">
                    <div>
                        <p className="text-sm font-medium text-zinc-500  mb-1">Pending Registrations</p>
                        <p className="text-3xl font-bold text-zinc-900 ">34</p>
                    </div>
                    <Link href="/erp/identity/register" className="mt-4 text-sm font-medium text-primary hover:text-primary/80 flex items-center group transition-colors">
                        Start new registration <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>

                <div className="bg-white  border border-zinc-200  rounded-xl p-6 shadow-sm">
                    <p className="text-sm font-medium text-zinc-500  mb-1">Today's Fee Collection</p>
                    <p className="text-3xl font-bold text-zinc-900 ">₨ 450,000</p>
                    <div className="mt-2 text-sm text-emerald-600  flex items-center">
                        <span>Synced with PayPro</span>
                    </div>
                </div>
            </div>

            {/* Main workspace section */}
            <div className="bg-white  border border-zinc-200  rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-zinc-200 ">
                    <h3 className="text-lg font-medium text-zinc-900 ">Recent Activity</h3>
                </div>
                <div className="p-6">
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="h-12 w-12 rounded-full bg-zinc-100  flex items-center justify-center mb-4">
                            <span className="text-zinc-400">📊</span>
                        </div>
                        <h3 className="text-sm font-medium text-zinc-900 ">No recent activity</h3>
                        <p className="mt-1 text-sm text-zinc-500 ">Activity will appear here once the system is fully operational.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
