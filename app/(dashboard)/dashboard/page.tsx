"use client";

import Link from "next/link";
import {
    BookOpen,
    Layers,
    Banknote,
    Building2,
    UserPlus,
    GraduationCap,
    Users,
    ClipboardList,
    UserSearch,
    CreditCard,
    Landmark,
    Receipt,
    Wallet,
    TrendingUp,
    Table,
    ArrowLeftRight,
} from "lucide-react";

export default function DashboardPage() {
    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 ">Dashboard</h1>
                    <p className="text-zinc-500 dark:text-zinc-400  mt-1">Quick access to core modules and management tools.</p>
                </div>
            </div>

            {/* Entity Functions / Configuration Group */}
            <div className="space-y-4 pt-2">
                <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200">Entity Functions</h2>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                    <Link href="/classes" className="group">
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col items-center justify-center text-center h-full gap-4">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <BookOpen className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-primary transition-colors">Classes</h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Manage academic classes</p>
                            </div>
                        </div>
                    </Link>

                    <Link href="/sections" className="group">
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col items-center justify-center text-center h-full gap-4">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <Layers className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-primary transition-colors">Sections</h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Manage class divisions</p>
                            </div>
                        </div>
                    </Link>

                    <Link href="/campuses" className="group">
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col items-center justify-center text-center h-full gap-4">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <Building2 className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-primary transition-colors">Campuses</h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Manage school branches</p>
                            </div>
                        </div>
                    </Link>

                    <Link href="/fee-types" className="group">
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col items-center justify-center text-center h-full gap-4">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <Banknote className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-primary transition-colors">Fee Types</h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Configure fee structures</p>
                            </div>
                        </div>
                    </Link>
                    <Link href="/banks" className="group">
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col items-center justify-center text-center h-full gap-4">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <Landmark className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-primary transition-colors">Banks</h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Manage bank accounts</p>
                            </div>
                        </div>
                    </Link>
                </div>
            </div>

            {/* Fee Management Group */}
            <div className="space-y-4 pt-4">
                <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200">Fee Management</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                    <Link href="/classwise-fees-schedule" className="group">
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col items-center justify-center text-center h-full gap-4">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <ClipboardList className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-primary transition-colors">Classwise Fee</h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Assign fee amounts per class</p>
                            </div>
                        </div>
                    </Link>

                    <Link href="/studentwise-fees" className="group">
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col items-center justify-center text-center h-full gap-4">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <UserSearch className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-primary transition-colors">Studentwise Fee</h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Set student fee overrides</p>
                            </div>
                        </div>
                    </Link>

                    <Link href="/fee-challan" className="group">
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col items-center justify-center text-center h-full gap-4">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <CreditCard className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-primary transition-colors">Generate Vouchers</h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Issue individual or bulk vouchers</p>
                            </div>
                        </div>
                    </Link>

                    <Link href="/vouchers" className="group">
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col items-center justify-center text-center h-full gap-4">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <Receipt className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-primary transition-colors">Vouchers</h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">View and filter fee vouchers</p>
                            </div>
                        </div>
                    </Link>

                    <Link href="/vouchers/deposit" className="group">
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col items-center justify-center text-center h-full gap-4">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <Wallet className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-primary transition-colors">Receive Deposit</h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Record student fee payments</p>
                            </div>
                        </div>
                    </Link>
                </div>
            </div>

            {/* Student Management Group */}
            <div className="space-y-4 pt-4">
                <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200">Student Management</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                    <Link href="/bulk-promote" className="group text-left">
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col items-center justify-center text-center h-full gap-4">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <TrendingUp className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-primary transition-colors">Bulk Promote</h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Bulk promote children to next classes</p>
                            </div>
                        </div>
                    </Link>

                    <Link href="/identity/register" className="group">
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col items-center justify-center text-center h-full gap-4">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <UserPlus className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-primary transition-colors">Registration</h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Enroll new students</p>
                            </div>
                        </div>
                    </Link>

                    <Link href="/enrollments" className="group text-left">
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col items-center justify-center text-center h-full gap-4">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <TrendingUp className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-primary transition-colors">Enrollments</h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Complete the admission process</p>
                            </div>
                        </div>
                    </Link>

                    <Link href="/transfers" className="group text-left">
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-red-300/40 dark:hover:border-red-700/40 transition-all flex flex-col items-center justify-center text-center h-full gap-4 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-red-500/0 to-red-500/0 group-hover:from-red-500/5 group-hover:to-red-500/0 transition-all duration-500" />
                            <div className="h-16 w-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center group-hover:bg-red-100 dark:group-hover:bg-red-900/30 transition-colors relative z-10">
                                <ArrowLeftRight className="h-8 w-8 text-red-600 dark:text-red-400" />
                            </div>
                            <div className="relative z-10">
                                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">Transfers</h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Shift between Cambridge &amp; Secondary</p>
                            </div>
                        </div>
                    </Link>


                    <Link href="/families" className="group">
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col items-center justify-center text-center h-full gap-4">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <Users className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-primary transition-colors">Families</h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Family parent directory</p>
                            </div>
                        </div>
                    </Link>

                    <Link href="/identity/students" className="group">
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col items-center justify-center text-center h-full gap-4">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <GraduationCap className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-primary transition-colors">Students</h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Student directory</p>
                            </div>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
}
