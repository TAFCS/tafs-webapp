"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
    Users, Banknote, FileText, TrendingUp, Calendar, 
    CreditCard, Clock, Activity, Loader2, Landmark
} from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";

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
    const [statsData, setStatsData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCampusId, setSelectedCampusId] = useState<string>("");

    useEffect(() => {
        fetchDashboardData(selectedCampusId);
    }, [selectedCampusId]);

    const fetchDashboardData = async (campusId?: string) => {
        setIsLoading(true);
        try {
            const url = campusId ? `/v1/analytics/dashboard?campusId=${campusId}` : "/v1/analytics/dashboard";
            const { data } = await api.get(url);
            if (data.status === 200) {
                setStatsData(data.data);
            }
        } catch (error) {
            console.error("Dashboard data fetch failed:", error);
            toast.error("Failed to load dashboard statistics");
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading && !statsData) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
            </div>
        );
    }

    const financials = statsData?.financials || {};
    const students = statsData?.students || {};
    const campuses = statsData?.campuses || [];

    const summaryStats = [
        { 
            label: "Total Students", 
            value: students.total?.toLocaleString() || "0", 
            icon: Users,
            color: "text-blue-600",
            bg: "bg-blue-50 dark:bg-blue-900/10"
        },
        { 
            label: "Fees Collected", 
            value: `Rs. ${Math.round(financials.collected || 0).toLocaleString()}`, 
            icon: Banknote,
            color: "text-emerald-600",
            bg: "bg-emerald-50 dark:bg-emerald-900/10"
        },
        { 
            label: "Expected Total", 
            value: `Rs. ${Math.round(financials.expected || 0).toLocaleString()}`, 
            icon: CreditCard,
            color: "text-violet-600",
            bg: "bg-violet-50 dark:bg-violet-900/10"
        },
        { 
            label: "Collection Rate", 
            value: `${(financials.collectionRate || 0).toFixed(1)}%`, 
            icon: TrendingUp,
            color: "text-amber-600",
            bg: "bg-amber-50 dark:bg-amber-900/10"
        },
        { 
            label: "Outstanding Balance", 
            value: `Rs. ${Math.round(financials.outstanding || 0).toLocaleString()}`, 
            icon: Clock,
            color: "text-rose-600",
            bg: "bg-rose-50 dark:bg-rose-900/10"
        },
        { 
            label: "Previous Arrears", 
            value: `Rs. ${Math.round(financials.arrears || 0).toLocaleString()}`, 
            icon: FileText,
            color: "text-zinc-600",
            bg: "bg-zinc-50 dark:bg-zinc-900/10"
        }
    ];

    return (
        <div className="space-y-8 pb-10">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 font-outfit">Governance Dashboard</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Academic Year: <span className="font-bold text-zinc-900 dark:text-zinc-100">{financials.currentYear || "---"}</span>
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    {/* Campus Selector */}
                    <div className="relative flex items-center">
                        <div className="absolute left-3 text-zinc-400 pointer-events-none">
                            <Landmark className="h-4 w-4" />
                        </div>
                        <select
                            value={selectedCampusId}
                            onChange={(e) => setSelectedCampusId(e.target.value)}
                            className="pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-semibold focus:ring-2 focus:ring-primary/20 appearance-none min-w-[200px] outline-none transition-all shadow-sm"
                        >
                            <option value="">All Campuses</option>
                            {campuses.map((c: any) => (
                                <option key={c.id} value={c.id}>{c.campus_name}</option>
                            ))}
                        </select>
                    </div>

                    <button 
                        onClick={() => fetchDashboardData(selectedCampusId)}
                        disabled={isLoading}
                        className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all shadow-sm disabled:opacity-50"
                    >
                        <Activity className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <div className="text-right hidden md:block border-l border-zinc-200 dark:border-zinc-800 pl-4">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none">Status</p>
                        <p className="text-sm font-bold text-emerald-600 flex items-center gap-1 justify-end mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            Connected
                        </p>
                    </div>
                </div>
            </div>

            {/* Financial Summary Grid */}
            <motion.div 
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6"
                key={selectedCampusId} // Trigger animation on campus change
            >
                {summaryStats.map((stat, idx) => (
                    <motion.div 
                        key={idx}
                        variants={item}
                        className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
                    >
                        <div className={`p-3 w-fit rounded-xl ${stat.bg} ${stat.color} transition-transform group-hover:scale-110 duration-300 mb-4`}>
                            <stat.icon className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{stat.label}</p>
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mt-1 tracking-tight">{stat.value}</h3>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.div>
                ))}
            </motion.div>

            {/* Student Strength Breakdown */}
            <div className="grid grid-cols-1 gap-8">
                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-10">
                        <div>
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Branch-wise Student Strength</h3>
                            <p className="text-sm text-zinc-500 mt-1 font-medium">Distribution of active students (ENROLLED) across all campuses</p>
                        </div>
                        <div className="flex items-center gap-4">
                           <div className="text-right">
                               <p className="text-xs font-bold text-zinc-400 uppercase">Global Enrolled</p>
                               <p className="text-xl font-black text-primary">
                                   {statsData?.students?.total_global || statsData?.students?.total}
                               </p>
                           </div>
                           <Users className="h-8 w-8 text-primary opacity-20" />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10">
                        {(students.branchwise || []).map((branch: any) => (
                            <div key={branch.campus_id} className={`space-y-4 group transition-opacity ${selectedCampusId && parseInt(selectedCampusId) !== branch.campus_id ? 'opacity-30' : 'opacity-100'}`}>
                                <div className="flex items-center justify-between">
                                    <span className="text-base font-bold text-zinc-800 dark:text-zinc-200">{branch.campus_name}</span>
                                    <div className="text-right">
                                        <span className="text-lg font-black text-zinc-900 dark:text-zinc-50">{branch.count}</span>
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">Students</p>
                                    </div>
                                </div>
                                <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden border border-zinc-200/50 dark:border-zinc-800/50">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(branch.count / students.total) * 100}%` }}
                                        transition={{ duration: 1, ease: "easeOut" }}
                                        className="h-full bg-primary relative"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent" />
                                    </motion.div>
                                </div>
                                <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                    <span>Share</span>
                                    <span>{((branch.count / students.total) * 100).toFixed(1)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
