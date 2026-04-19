"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
    Users, Banknote, FileText, TrendingUp, Calendar, 
    CreditCard, Clock, Activity, Loader2, Landmark,
    ArrowUpRight, ArrowDownRight, Info,
    Target, BarChart3, PieChart, CheckCircle2
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
    const trends = statsData?.trends || [];

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
            color: "text-zinc-600",
            bg: "bg-zinc-50 dark:bg-zinc-900/10"
        },
        { 
            label: "Previous Arrears", 
            value: `Rs. ${Math.round(financials.arrears || 0).toLocaleString()}`, 
            icon: FileText,
            color: "text-zinc-600",
            bg: "bg-zinc-50 dark:bg-zinc-900/10"
        }
    ];

    const rawMax = Math.max(...trends.map((t: any) => Math.max(t.expected, t.collected)), 100000);
    const maxVal = Math.ceil(rawMax / 1000000) * 1000000;

    return (
        <div className="space-y-8 pb-10">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 font-outfit">Governance</h1>
                    <div className="flex items-center gap-3 text-sm font-medium text-zinc-500">
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                             AY {financials.currentYear || "---"}
                        </div>
                        <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                        <span className="flex items-center gap-1.5">
                            <Activity className="h-4 w-4 text-emerald-500" /> Operational Feed
                        </span>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none group-focus-within:text-primary transition-colors">
                            <Landmark className="h-4 w-4" />
                        </div>
                        <select
                            value={selectedCampusId}
                            onChange={(e) => setSelectedCampusId(e.target.value)}
                            className="pl-12 pr-10 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm font-bold appearance-none min-w-[260px] outline-none transition-all shadow-sm focus:ring-4 focus:ring-primary/10 hover:border-zinc-300 dark:hover:border-zinc-700"
                        >
                            <option value="">Institution-wide Overview</option>
                            {campuses.map((c: any) => (
                                <option key={c.id} value={c.id}>{c.campus_name}</option>
                            ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                             <TrendingUp className="h-4 w-4" />
                        </div>
                    </div>

                    <button 
                        onClick={() => fetchDashboardData(selectedCampusId)}
                        disabled={isLoading}
                        className="h-12 w-12 flex items-center justify-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-500 hover:text-primary transition-all shadow-sm active:scale-95 disabled:opacity-50"
                    >
                        <Activity className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Metric Summary Grid */}
            <motion.div 
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6"
                key={selectedCampusId}
            >
                {summaryStats.map((stat, idx) => (
                    <motion.div 
                        key={idx}
                        variants={item}
                        className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-6 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group hover:-translate-y-1"
                    >
                        <div className={`p-3.5 w-fit rounded-2xl ${stat.bg} ${stat.color} transition-all group-hover:scale-110 duration-500 mb-5 shadow-sm`}>
                            <stat.icon className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">{stat.label}</p>
                            <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-50 mt-1.5 tracking-tight font-outfit">{stat.value}</h3>
                        </div>
                    </motion.div>
                ))}
            </motion.div>

            {/* Performance Center */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Collection Trend Chart */}
                <div className="xl:col-span-9 space-y-8">
                    <div className="bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-900 rounded-[2.5rem] p-10 lg:p-14 shadow-2xl relative overflow-hidden shadow-zinc-200/50 dark:shadow-none">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-16 gap-8 relative z-10">
                            <div>
                                <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-[0.3em] mb-2">
                                    <BarChart3 className="h-3 w-3" /> Historical Analytics
                                </div>
                                <h3 className="text-3xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight font-outfit">Collection Trend</h3>
                                <p className="text-sm text-zinc-500 font-semibold mt-1">Measuring realized intake against targets (August - July)</p>
                            </div>
                            
                            <div className="flex items-center gap-6 bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                                <div className="flex items-center gap-3 px-4 py-2">
                                    <div className="w-5 h-5 rounded-lg bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700" />
                                    <span className="text-[11px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Expected</span>
                                </div>
                                <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-zinc-950 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-800">
                                    <div className="w-5 h-5 rounded-lg bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.3)]" />
                                    <span className="text-[11px] text-zinc-900 dark:text-zinc-100 font-black uppercase tracking-widest">Collected</span>
                                </div>
                            </div>
                        </div>

                        {/* Chart Area */}
                        <div className="h-[460px] relative mt-12">
                            {/* Grid Lines */}
                            {[0, 0.25, 0.5, 0.75, 1].map((p) => (
                                <div key={p} className="absolute w-full border-t border-zinc-100 dark:border-zinc-900/50 flex items-center" style={{ bottom: `${p * 100}%` }}>
                                    <span className="text-[10px] font-black text-zinc-300 dark:text-zinc-700 -mr-12 absolute -left-14 w-12 text-right">
                                        {((maxVal * p) / 1000000).toFixed(1)}M
                                    </span>
                                </div>
                            ))}

                            <div className="absolute inset-0 flex items-end justify-between px-6 pb-2 gap-3 lg:gap-6">
                                {trends.map((t: any, i: number) => {
                                    const expPerf = (t.expected / maxVal) * 100;
                                    const collPerf = (t.collected / maxVal) * 100;
                                    const isCurrentMonth = i === ((new Date().getMonth() + 5) % 12); 

                                    return (
                                        <div key={t.month} className="flex-1 flex flex-col items-center h-full relative group">
                                            <div className="w-full h-full flex flex-col justify-end items-center relative gap-0">
                                                
                                                <div className="w-full h-full max-w-[40px] relative flex flex-col justify-end items-center group-hover:scale-105 transition-all duration-500 ease-out cursor-help">
                                                    
                                                    {/* Expected Grey Bar */}
                                                    <motion.div 
                                                        initial={{ height: 0 }}
                                                        animate={{ height: `${expPerf}%` }}
                                                        className="w-full bg-zinc-200 dark:bg-zinc-800/80 rounded-t-xl absolute bottom-0 z-0 border border-zinc-300 dark:border-zinc-700/50 transition-colors group-hover:bg-zinc-300 dark:group-hover:bg-zinc-700"
                                                    />

                                                    {/* Collected Green Bar */}
                                                    <motion.div 
                                                        initial={{ height: 0 }}
                                                        animate={{ height: `${collPerf}%` }}
                                                        className={`w-full rounded-t-xl absolute bottom-0 z-[1] transition-all duration-300 ${isCurrentMonth ? 'bg-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]' : 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.2)]'}`}
                                                    >
                                                        <div className="w-full h-full bg-gradient-to-t from-black/5 to-transparent rounded-t-xl" />
                                                    </motion.div>
                                                </div>

                                                <div className={`mt-8 text-[11px] font-black uppercase tracking-widest transition-all ${isCurrentMonth ? 'text-primary' : 'text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200'}`}>
                                                    {t.month}
                                                </div>

                                                {/* Lowered and simplified Tooltip Card */}
                                                <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 bg-zinc-950 dark:bg-zinc-50 text-white dark:text-zinc-950 p-5 rounded-2xl opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100 pointer-events-none z-50 shadow-2xl border border-zinc-800 dark:border-zinc-200 min-w-[200px]">
                                                    <div className="space-y-4">
                                                        <div className="pb-3 border-b border-zinc-800 dark:border-zinc-200 flex items-center justify-between">
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.month} Overview</span>
                                                            <div className={`w-1.5 h-1.5 rounded-full ${t.shortfall === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                        </div>
                                                        
                                                        <div className="space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] font-bold text-zinc-500 uppercase">Target</span>
                                                                <span className="text-xs font-black">Rs. {Math.round(t.expected / 1000).toLocaleString()}K</span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-emerald-500 dark:text-emerald-600">
                                                                <span className="text-[10px] font-bold uppercase">Actual</span>
                                                                <span className="text-xs font-black">Rs. {Math.round(t.collected / 1000).toLocaleString()}K</span>
                                                            </div>
                                                        </div>

                                                        {t.shortfall > 0 && (
                                                            <div className="pt-3 border-t border-zinc-800 dark:border-zinc-200 flex items-center justify-between">
                                                                <span className="text-[10px] font-bold text-zinc-500 uppercase">Variance</span>
                                                                <span className="text-xs font-black text-amber-500">Rs. {Math.round(t.shortfall / 1000).toLocaleString()}K</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Performance Analytics Sidebar */}
                <div className="xl:col-span-3 space-y-8">
                    {/* Enrollment Heatmap */}
                    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-9 shadow-sm pb-10">
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h3 className="font-black text-xl text-zinc-900 dark:text-zinc-50 tracking-tight font-outfit">Branch Strength</h3>
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Enrollment distribution</p>
                            </div>
                            <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
                                <PieChart className="h-5 w-5 text-zinc-500" />
                            </div>
                        </div>
                        <div className="space-y-8">
                            {(students.branchwise || []).map((branch: any) => (
                                <div key={branch.campus_id} className={`space-y-3 group transition-all ${selectedCampusId && parseInt(selectedCampusId) !== branch.campus_id ? 'opacity-30 blur-[0.5px]' : 'opacity-100'}`}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-tighter">{branch.campus_name}</span>
                                        <span className="text-base font-black text-zinc-900 dark:text-zinc-50 font-outfit">{branch.count}</span>
                                    </div>
                                    <div className="h-2.5 w-full bg-zinc-50 dark:bg-zinc-900 rounded-full overflow-hidden border border-zinc-100 dark:border-zinc-800/50 shadow-inner">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(branch.count / Math.max(students.total, 1)) * 100}%` }}
                                            transition={{ duration: 2, ease: "circOut" }}
                                            className="h-full bg-zinc-900 dark:bg-zinc-100 relative"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <div className="mt-12 pt-8 border-t border-zinc-100 dark:border-zinc-900 flex items-center justify-between">
                            <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">Aggregate Total</span>
                            <div className="flex items-center gap-2">
                                <span className="text-3xl font-black text-zinc-900 dark:text-zinc-100 font-outfit">{students.total}</span>
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            </div>
                        </div>
                    </div>

                    {/* Performance Risk Insight */}
                    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-10 relative overflow-hidden group shadow-sm">
                        <div className="relative z-10 space-y-10">
                            <div className="space-y-2">
                                <h3 className="font-black text-2xl tracking-tighter text-zinc-900 dark:text-zinc-50 font-outfit">Operational Snapshot</h3>
                                <div className="h-1 w-10 bg-emerald-500 rounded-full" />
                            </div>
                            
                            <div className="space-y-10">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-100 dark:border-emerald-900">
                                            <ArrowUpRight className="h-6 w-6 text-emerald-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Peak Cycle</p>
                                            <p className="text-xl font-black text-zinc-900 dark:text-zinc-50 font-outfit">{trends.sort((a:any, b:any) => b.collected - a.collected)[0]?.month || "---"}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
                                            <ArrowDownRight className="h-6 w-6 text-zinc-500" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Highest Variance</p>
                                            <p className="text-xl font-black text-zinc-900 dark:text-zinc-50 font-outfit">{trends.sort((a:any, b:any) => b.shortfall - a.shortfall)[0]?.month || "---"}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <p className="text-[11px] font-medium text-zinc-400 leading-relaxed italic border-l-2 border-zinc-200 dark:border-zinc-800 pl-5">
                                Variance data excludes soft-enrollment projections and reflects cleared heads only.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}