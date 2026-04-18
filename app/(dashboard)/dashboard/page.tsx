"use client";

import { motion } from "framer-motion";
import { 
    Users, Banknote, FileText, TrendingUp, ArrowUpRight, 
    ArrowDownRight, Calendar, UserPlus, CreditCard, Clock,
    CheckCircle2, XCircle, ChevronRight, Activity
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
};

export default function DashboardPage() {
    const [timeframe, setTimeframe] = useState("This Month");

    const stats = [
        { 
            label: "Total Students", 
            value: "1,284", 
            change: "+12%", 
            trend: "up", 
            icon: Users,
            color: "text-blue-600",
            bg: "bg-blue-50 dark:bg-blue-900/10"
        },
        { 
            label: "Monthly Revenue", 
            value: "₨ 4.2M", 
            change: "+8.4%", 
            trend: "up", 
            icon: Banknote,
            color: "text-emerald-600",
            bg: "bg-emerald-50 dark:bg-emerald-900/10"
        },
        { 
            label: "Pending Vouchers", 
            value: "342", 
            change: "-2.5%", 
            trend: "down", 
            icon: FileText,
            color: "text-amber-600",
            bg: "bg-amber-50 dark:bg-amber-900/10"
        },
        { 
            label: "Collection Rate", 
            value: "92%", 
            change: "+1.2%", 
            trend: "up", 
            icon: TrendingUp,
            color: "text-violet-600",
            bg: "bg-violet-50 dark:bg-violet-900/10"
        }
    ];

    const recentActivity = [
        { id: 1, type: 'payment', user: 'Shuja Ali', action: 'recorded a deposit for CC-7482', time: '12 mins ago', amount: '₨ 12,500' },
        { id: 2, type: 'admission', user: 'Ashhal Khan', action: 'enrolled new student CC-9012', time: '45 mins ago' },
        { id: 3, type: 'voucher', user: 'System', action: 'generated bulk vouchers for April 2026', time: '2 hours ago', count: '1,240' },
        { id: 4, type: 'transfer', user: 'Receptionist', action: 'executed campus transfer for CC-6821', time: '4 hours ago' },
    ];

    return (
        <div className="space-y-8 pb-10">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Analytics Dashboard</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Summarized performance for {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    {["Today", "This Week", "This Month"].map((t) => (
                        <button
                            key={t}
                            onClick={() => setTimeframe(t)}
                            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                                timeframe === t 
                                    ? "bg-primary text-white shadow-md" 
                                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                            }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* Metric Cards */}
            <motion.div 
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
            >
                {stats.map((stat, idx) => (
                    <motion.div 
                        key={idx}
                        variants={item}
                        className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
                    >
                        <div className="flex items-start justify-between">
                            <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} transition-transform group-hover:scale-110 duration-300`}>
                                <stat.icon className="h-6 w-6" />
                            </div>
                            <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
                                stat.trend === 'up' 
                                ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10' 
                                : 'text-amber-600 bg-amber-50 dark:bg-amber-900/10'
                            }`}>
                                {stat.trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                {stat.change}
                            </div>
                        </div>
                        <div className="mt-4">
                            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{stat.label}</p>
                            <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mt-1">{stat.value}</h3>
                        </div>
                        {/* Subtle decorative chart path background */}
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.div>
                ))}
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main visualization area */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Collection Overview</h3>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">Total revenue collection across all campuses</p>
                            </div>
                            <Activity className="h-5 w-5 text-primary opacity-50" />
                        </div>
                        
                        {/* Placeholder for "Chart" using CSS bars */}
                        <div className="h-64 flex items-end justify-between gap-2 px-2">
                            {[45, 60, 40, 80, 55, 95, 70, 85, 65, 50, 75, 90].map((h, i) => (
                                <motion.div 
                                    key={i}
                                    initial={{ height: 0 }}
                                    animate={{ height: `${h}%` }}
                                    transition={{ delay: i * 0.05, duration: 0.8 }}
                                    className="flex-1 bg-primary/20 hover:bg-primary rounded-t-lg relative group transition-colors cursor-pointer"
                                >
                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                        ₨ {h * 10}k
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                        <div className="flex justify-between mt-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-2">
                            <span>Jan</span>
                            <span>Feb</span>
                            <span>Mar</span>
                            <span>Apr</span>
                            <span>May</span>
                            <span>Jun</span>
                            <span>Jul</span>
                            <span>Aug</span>
                            <span>Sep</span>
                            <span>Oct</span>
                            <span>Nov</span>
                            <span>Dec</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <Link href="/identity/register" className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 rounded-2xl text-white shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition-transform group">
                            <UserPlus className="h-8 w-8 mb-4 opacity-80 group-hover:opacity-100" />
                            <h4 className="font-bold">New Admission</h4>
                            <p className="text-sm text-white/70 mt-1">Start enrollment flow</p>
                        </Link>
                        <Link href="/bulk-voucher" className="bg-gradient-to-br from-violet-600 to-violet-700 p-6 rounded-2xl text-white shadow-lg shadow-violet-500/20 hover:scale-[1.02] transition-transform group">
                            <CreditCard className="h-8 w-8 mb-4 opacity-80 group-hover:opacity-100" />
                            <h4 className="font-bold">Generate Batch</h4>
                            <p className="text-sm text-white/70 mt-1">Issue monthly fees</p>
                        </Link>
                        <Link href="/vouchers/deposit" className="bg-gradient-to-br from-emerald-600 to-emerald-700 p-6 rounded-2xl text-white shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition-transform group">
                            <Banknote className="h-8 w-8 mb-4 opacity-80 group-hover:opacity-100" />
                            <h4 className="font-bold">Record Deposit</h4>
                            <p className="text-sm text-white/70 mt-1">Receive fee payment</p>
                        </Link>
                    </div>
                </div>

                {/* Right Sidebar - Activity & Info */}
                <div className="space-y-8">
                    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-zinc-900 dark:text-zinc-50">Recent Activity</h3>
                            <button className="text-xs font-bold text-primary hover:underline">View All</button>
                        </div>
                        <div className="space-y-6">
                            {recentActivity.map((activity) => (
                                <div key={activity.id} className="flex gap-4 group">
                                    <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${
                                        activity.type === 'payment' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' :
                                        activity.type === 'admission' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20' :
                                        activity.type === 'voucher' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20' :
                                        'bg-zinc-50 text-zinc-600 dark:bg-zinc-900'
                                    }`}>
                                        {activity.type === 'payment' && <Banknote className="h-5 w-5" />}
                                        {activity.type === 'admission' && <UserPlus className="h-5 w-5" />}
                                        {activity.type === 'voucher' && <FileText className="h-5 w-5" />}
                                        {activity.type === 'transfer' && <ArrowLeftRight className="h-5 w-5" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-baseline gap-x-1.5">
                                            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{activity.user}</span>
                                            <span className="text-xs text-zinc-500 dark:text-zinc-400">{activity.action}</span>
                                        </div>
                                        <div className="flex items-center justify-between mt-1">
                                            <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-tight">{activity.time}</p>
                                            {activity.amount && <span className="text-xs font-bold text-emerald-600">{activity.amount}</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick Info / Tips Card */}
                    <div className="bg-zinc-900 dark:bg-zinc-100 rounded-2xl p-6 text-zinc-100 dark:text-zinc-900 relative overflow-hidden group">
                        <div className="relative z-10">
                            <h3 className="font-bold text-lg mb-2">Pro Tip</h3>
                            <p className="text-sm text-zinc-400 dark:text-zinc-600">You can now override student fees directly from the <Link href="/studentwise-fees" className="text-primary font-bold hover:underline">Student Overrides</Link> page under Fee Administration.</p>
                            <ChevronRight className="h-8 w-8 absolute -right-2 top-1/2 -translate-y-1/2 opacity-20 group-hover:translate-x-1 transition-transform" />
                        </div>
                        <div className="absolute top-0 left-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -ml-16 -mt-16" />
                    </div>
                </div>
            </div>
        </div>
    );
}

// Simple missing Lucide icon
function ArrowLeftRight(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M7 10l5 5 5-5" />
            <path d="m7 14 5-5 5 5" />
        </svg>
    )
}
