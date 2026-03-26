"use client";

import { useState } from "react";
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
} from "lucide-react";
import { BulkPromoteModal } from "@/src/features/students/components/bulk-promote-modal";

export default function DashboardPage() {
    const [isBulkPromoteOpen, setIsBulkPromoteOpen] = useState(false);

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
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Generate student vouchers</p>
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
                    <button
                        onClick={() => setIsBulkPromoteOpen(true)}
                        className="group text-left"
                    >
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col items-center justify-center text-center h-full gap-4">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <TrendingUp className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-primary transition-colors">Bulk Promote</h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Bulk promote children to next classes</p>
                            </div>
                        </div>
                    </button>

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

                    <Link href="/staff-editing/students" className="group">
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col items-center justify-center text-center h-full gap-4">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <Table className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-primary transition-colors">Students Spreadsheet</h2>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Student spreadsheet for easy editing</p>
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

            <BulkPromoteModal
                isOpen={isBulkPromoteOpen}
                onClose={() => setIsBulkPromoteOpen(false)}
            />
        </div>
    );
}
