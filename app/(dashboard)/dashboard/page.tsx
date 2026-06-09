"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
    Users, Banknote, FileText, TrendingUp, Calendar, 
    CreditCard, Clock, Activity, Loader2, Landmark,
    ArrowUpRight, ArrowDownRight, Info,
    Target, BarChart3, PieChart, CheckCircle2, LayoutDashboard
} from "lucide-react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import Link from "next/link";
import { useAuthState } from "@/context/AuthContext";

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
    const { user } = useAuthState();
    const [statsData, setStatsData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const canViewAnalytics =
        user?.role === "SUPER_ADMIN" ||
        user?.permissions?.includes("system.analytics.view");
    const campusLocked = user?.campusId != null;
    const [selectedCampusId, setSelectedCampusId] = useState<string>(
        campusLocked ? String(user!.campusId) : "",
    );

    useEffect(() => {
        if (campusLocked && user?.campusId) {
            setSelectedCampusId(String(user.campusId));
        }
    }, [campusLocked, user?.campusId]);

    useEffect(() => {
        if (!canViewAnalytics) {
            setIsLoading(false);
            return;
        }
        fetchDashboardData(selectedCampusId);
    }, [selectedCampusId, canViewAnalytics]);

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

    if (!canViewAnalytics) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
                <LayoutDashboard className="h-12 w-12 text-zinc-300 mb-4" />
                <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Welcome</h2>
                <p className="text-zinc-500 mt-2 max-w-md">
                    Use the menu to open the modules available for your role.
                </p>
            </div>
        );
    }

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
    const feedateTrends = statsData?.feedate_trends || [];

    const summaryStats = [
        {
            label: "Total Students",
            value: students.total?.toLocaleString() || "0",
            description: "Active enrollment, all campuses",
            icon: Users,
            color: "text-blue-600",
            bg: "bg-blue-50 dark:bg-blue-900/10"
        },
        {
            label: "Fees Collected",
            value: `Rs. ${Math.round(financials.collected || 0).toLocaleString()}`,
            description: `Cash actually received in AY ${financials.currentYear || "---"}`,
            icon: Banknote,
            color: "text-emerald-600",
            bg: "bg-emerald-50 dark:bg-emerald-900/10"
        },
        {
            label: "Expected Total",
            value: `Rs. ${Math.round(financials.expected || 0).toLocaleString()}`,
            description: "Billed this year — fee heads + surcharges",
            icon: CreditCard,
            color: "text-violet-600",
            bg: "bg-violet-50 dark:bg-violet-900/10"
        },
        {
            label: "Collection Rate",
            value: `${(financials.collectionRate || 0).toFixed(1)}%`,
            description: "Share of this year's billing paid to date",
            icon: TrendingUp,
            color: "text-amber-600",
            bg: "bg-amber-50 dark:bg-amber-900/10"
        },
        {
            label: "Outstanding Balance",
            value: `Rs. ${Math.round(financials.outstanding || 0).toLocaleString()}`,
            description: "This year's billing left unpaid",
            icon: Clock,
            color: "text-zinc-600",
            bg: "bg-zinc-50 dark:bg-zinc-900/10"
        },
        {
            label: "Previous Arrears",
            value: `Rs. ${Math.round(financials.arrears || 0).toLocaleString()}`,
            description: "Past due_date and still unpaid, today",
            icon: FileText,
            color: "text-zinc-600",
            bg: "bg-zinc-50 dark:bg-zinc-900/10"
        }
    ];


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
                            {!campusLocked && (
                                <option value="">Institution-wide Overview</option>
                            )}
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

            {/* Post-dated Cheques Alert Banner */}
            {statsData?.postdated_cheques && (statsData.postdated_cheques.overdue_count > 0 || statsData.postdated_cheques.due_today_count > 0) && (
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 rounded-[2rem] bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 dark:border-amber-500/10 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm"
                >
                    <div className="flex items-start gap-4">
                        <div className="p-3.5 bg-amber-500/10 rounded-2xl text-amber-500 shadow-sm">
                            <Clock className="h-6 w-6" />
                        </div>
                        <div>
                            <h4 className="text-lg font-black text-zinc-900 dark:text-zinc-50 tracking-tight font-outfit">Post-dated Cheques Action Required</h4>
                            <p className="text-sm font-medium text-zinc-500 mt-1 leading-relaxed">
                                {statsData.postdated_cheques.overdue_count > 0 && (
                                    <span className="text-rose-500 font-bold mr-3">
                                        {statsData.postdated_cheques.overdue_count} Overdue
                                    </span>
                                )}
                                {statsData.postdated_cheques.due_today_count > 0 && (
                                    <span className="text-amber-500 font-bold">
                                        {statsData.postdated_cheques.due_today_count} Due Today (Rs. {Math.round(statsData.postdated_cheques.due_today_total_amount).toLocaleString()})
                                    </span>
                                )}
                                {statsData.postdated_cheques.due_in_7_days_count > 0 && (
                                    <span className="text-zinc-400 font-semibold ml-3">
                                        · {statsData.postdated_cheques.due_in_7_days_count} upcoming in 7 days
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                    
                    <Link
                        href="/postdated-cheques"
                        className="px-6 py-3 rounded-2xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-950 text-xs font-black uppercase tracking-widest transition-all shadow-md hover:scale-105 active:scale-95 flex items-center gap-2 w-fit shrink-0 font-sans"
                    >
                        Manage Cheques <ArrowUpRight className="h-4 w-4" />
                    </Link>
                </motion.div>
            )}

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
                            {stat.description && (
                                <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 mt-1.5 leading-snug">{stat.description}</p>
                            )}
                        </div>
                    </motion.div>
                ))}
            </motion.div>

            {/* Performance Center */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Monthly Billing vs Collections */}
                <div className="xl:col-span-9 space-y-8">
                    <div className="bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-900 rounded-[2.5rem] p-10 lg:p-14 shadow-2xl relative overflow-hidden shadow-zinc-200/50 dark:shadow-none">
                        <div className="mb-10 relative z-10">
                            <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-[0.3em] mb-2">
                                <BarChart3 className="h-3 w-3" /> Recent Months
                            </div>
                            <h3 className="text-3xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight font-outfit">Billing vs. Collections</h3>
                            <p className="text-sm text-zinc-500 font-semibold mt-2 max-w-2xl leading-relaxed">
                                Two independent figures, side by side for each of the last few months — what the institution invoiced, and what cash actually landed in the bank.
                            </p>
                        </div>

                        {/* Legend */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10 relative z-10">
                            <div className="flex items-start gap-4 p-5 rounded-3xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800">
                                <div className="w-3 h-3 rounded-full bg-zinc-300 dark:bg-zinc-600 mt-1.5 shrink-0" />
                                <div>
                                    <p className="text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-[0.2em]">Billed (denominator)</p>
                                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium mt-1.5 leading-relaxed">
                                        Fee heads and arrear surcharges invoiced <span className="font-bold text-zinc-700 dark:text-zinc-300">for</span> that month — the full-width track.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 p-5 rounded-3xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
                                <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                <div>
                                    <p className="text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-[0.2em]">Cash In (numerator)</p>
                                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium mt-1.5 leading-relaxed">
                                        Actual deposits banked <span className="font-bold text-zinc-700 dark:text-zinc-300">during</span> that month. The bar fill and percentage both show cash in ÷ billed.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Monthly rows */}
                        <div className="space-y-5 relative z-10">
                            {trends.map((t: any, i: number) => {
                                const isCurrentMonth = i === trends.length - 1;
                                const cashRate = t.due > 0 ? Math.min(100, (t.received / t.due) * 100) : 0;
                                const cashPct = Math.round(cashRate);
                                const noBilling = t.due === 0;
                                const barColor =
                                    noBilling ? 'bg-zinc-200 dark:bg-zinc-700' :
                                    cashPct >= 90 ? 'bg-emerald-500' :
                                    cashPct >= 60 ? 'bg-amber-400' :
                                    'bg-rose-400';
                                const pctColor =
                                    noBilling ? 'text-zinc-400' :
                                    cashPct >= 90 ? 'text-emerald-500' :
                                    cashPct >= 60 ? 'text-amber-500' :
                                    'text-rose-500';

                                return (
                                    <motion.div
                                        key={t.month}
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className={`p-6 rounded-[1.75rem] border transition-all ${isCurrentMonth ? 'bg-primary/[0.04] border-primary/20 shadow-sm' : 'bg-zinc-50/60 dark:bg-zinc-900/30 border-zinc-100 dark:border-zinc-800/60'}`}
                                    >
                                        {/* Top row: month + percentage */}
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-base font-black tracking-tight font-outfit ${isCurrentMonth ? 'text-primary' : 'text-zinc-900 dark:text-zinc-100'}`}>{t.month}</span>
                                                {isCurrentMonth && (
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-1 rounded-full">Now</span>
                                                )}
                                            </div>
                                            <span className={`text-2xl font-black font-outfit ${pctColor}`}>
                                                {noBilling ? '—' : `${cashPct}%`}
                                            </span>
                                        </div>

                                        {/* Single bar — fill = cash received as % of billed */}
                                        <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-3">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: noBilling ? '100%' : `${cashRate}%` }}
                                                transition={{ duration: 0.9, ease: "circOut" }}
                                                className={`h-full rounded-full ${barColor}`}
                                            />
                                        </div>

                                        {/* Bottom row: amounts */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-semibold text-zinc-400">
                                                {noBilling ? 'Nothing billed' : (
                                                    <>
                                                        <span className="font-black text-zinc-700 dark:text-zinc-300">Rs. {Math.round(t.received).toLocaleString()}</span>
                                                        <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">/</span>
                                                        Rs. {Math.round(t.due).toLocaleString()} billed
                                                    </>
                                                )}
                                            </span>
                                            {!noBilling && t.gap > 0 && (
                                                <span className="text-[11px] font-bold text-zinc-400">
                                                    Rs. {Math.round(t.gap).toLocaleString()} gap
                                                </span>
                                            )}
                                            {!noBilling && t.gap <= 0 && (
                                                <span className="text-[11px] font-black text-emerald-500 uppercase tracking-widest">Fully in</span>
                                            )}
                                        </div>
                                        {/* Overdue indicator */}
                                        {t.overdue > 0 && (
                                            <div className="flex items-center gap-1.5 mt-2.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                                                <span className="text-[11px] font-bold text-rose-500">
                                                    Rs. {Math.round(t.overdue).toLocaleString()} past due date — Rs. 1,000/month surcharge applies
                                                </span>
                                            </div>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Voucher Cycle Recovery */}
                    <div className="bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-900 rounded-[2.5rem] p-10 lg:p-14 shadow-2xl relative overflow-hidden shadow-zinc-200/50 dark:shadow-none">
                        <div className="mb-10 relative z-10">
                            <div className="flex items-center gap-2 text-indigo-500 font-black text-[10px] uppercase tracking-[0.3em] mb-2">
                                <Target className="h-3 w-3" /> By Billing Cycle
                            </div>
                            <h3 className="text-3xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight font-outfit">Recovery by Cycle</h3>
                            <p className="text-sm text-zinc-500 font-semibold mt-2 max-w-2xl leading-relaxed">
                                For each month's chits (grouped by <span className="font-bold text-zinc-700 dark:text-zinc-300">fee_date</span>), the bar shows what percentage of that cycle's total has been collected so far — the fill width is the recovery rate.
                            </p>
                        </div>

                        <div className="space-y-5 relative z-10">
                            {feedateTrends.map((t: any, i: number) => {
                                const isCurrentMonth = i === feedateTrends.length - 1;
                                const recoveryRate = t.due > 0 ? Math.min(100, (t.collected / t.due) * 100) : 0;
                                const recoveryPct = Math.round(recoveryRate);
                                const noChits = t.due === 0;
                                const barColor =
                                    noChits ? 'bg-zinc-200 dark:bg-zinc-700' :
                                    recoveryPct >= 90 ? 'bg-emerald-500' :
                                    recoveryPct >= 60 ? 'bg-amber-400' :
                                    'bg-rose-400';
                                const pctColor =
                                    noChits ? 'text-zinc-400' :
                                    recoveryPct >= 90 ? 'text-emerald-500' :
                                    recoveryPct >= 60 ? 'text-amber-500' :
                                    'text-rose-500';

                                return (
                                    <motion.div
                                        key={t.month}
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className={`p-6 rounded-[1.75rem] border transition-all ${isCurrentMonth ? 'bg-indigo-500/[0.04] border-indigo-500/20 shadow-sm' : 'bg-zinc-50/60 dark:bg-zinc-900/30 border-zinc-100 dark:border-zinc-800/60'}`}
                                    >
                                        {/* Top row: month + amounts */}
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-base font-black tracking-tight font-outfit ${isCurrentMonth ? 'text-indigo-500' : 'text-zinc-900 dark:text-zinc-100'}`}>{t.month}</span>
                                                {isCurrentMonth && (
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-500/10 px-2 py-1 rounded-full">Now</span>
                                                )}
                                            </div>
                                            <span className={`text-2xl font-black font-outfit ${pctColor}`}>
                                                {noChits ? '—' : `${recoveryPct}%`}
                                            </span>
                                        </div>

                                        {/* Single recovery bar — width = recovery % */}
                                        <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-3">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: noChits ? '100%' : `${recoveryRate}%` }}
                                                transition={{ duration: 0.9, ease: "circOut" }}
                                                className={`h-full rounded-full ${barColor}`}
                                            />
                                        </div>

                                        {/* Bottom row: amounts */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-semibold text-zinc-400">
                                                {noChits ? 'No chits issued' : (
                                                    <>
                                                        <span className="font-black text-zinc-700 dark:text-zinc-300">Rs. {Math.round(t.collected).toLocaleString()}</span>
                                                        <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">/</span>
                                                        Rs. {Math.round(t.due).toLocaleString()} on chits
                                                    </>
                                                )}
                                            </span>
                                            {!noChits && t.gap > 0 && (
                                                <span className="text-[11px] font-bold text-zinc-400">
                                                    Rs. {Math.round(t.gap).toLocaleString()} left
                                                </span>
                                            )}
                                            {!noChits && t.gap <= 0 && (
                                                <span className="text-[11px] font-black text-emerald-500 uppercase tracking-widest">Cleared</span>
                                            )}
                                        </div>
                                        {/* Overdue indicator */}
                                        {t.overdue > 0 && (
                                            <div className="flex items-center gap-1.5 mt-2.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                                                <span className="text-[11px] font-bold text-rose-500">
                                                    Rs. {Math.round(t.overdue).toLocaleString()} past due date — Rs. 1,000/month surcharge applies
                                                </span>
                                            </div>
                                        )}
                                    </motion.div>
                                );
                            })}
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
                                            <p className="text-xl font-black text-zinc-900 dark:text-zinc-50 font-outfit">{trends.slice().sort((a:any, b:any) => b.received - a.received)[0]?.month || "---"}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
                                            <ArrowDownRight className="h-6 w-6 text-zinc-500" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Biggest Swing</p>
                                            <p className="text-xl font-black text-zinc-900 dark:text-zinc-50 font-outfit">{trends.slice().sort((a:any, b:any) => Math.abs(b.gap) - Math.abs(a.gap))[0]?.month || "---"}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <p className="text-[11px] font-medium text-zinc-400 leading-relaxed italic border-l-2 border-zinc-200 dark:border-zinc-800 pl-5">
                                "Billed" reflects fee heads and surcharges invoiced for that period; "Cash In" reflects deposits actually banked that month — the two are independent lenses (billing vs. cash flow), so a swing isn't necessarily a problem.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}