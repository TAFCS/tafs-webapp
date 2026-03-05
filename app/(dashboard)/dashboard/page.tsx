import Link from "next/link";
import {
    BookOpen,
    Layers,
    Banknote,
    UserPlus,
    GraduationCap,
    Users,
    ClipboardList
} from "lucide-react";

export default function DashboardPage() {
    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 ">Dashboard</h1>
                    <p className="text-zinc-500  mt-1">Quick access to core modules and management tools.</p>
                </div>
            </div>

            {/* Entity Functions / Configuration Group */}
            <div className="space-y-4 pt-2">
                <h2 className="text-lg font-medium text-zinc-800">Entity Functions</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Link href="/classes" className="group">
                        <div className="bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col items-center justify-center text-center h-full gap-4">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <BookOpen className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-900 group-hover:text-primary transition-colors">Classes</h2>
                                <p className="text-sm text-zinc-500 mt-1">Manage academic classes</p>
                            </div>
                        </div>
                    </Link>

                    <Link href="/sections" className="group">
                        <div className="bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col items-center justify-center text-center h-full gap-4">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <Layers className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-900 group-hover:text-primary transition-colors">Sections</h2>
                                <p className="text-sm text-zinc-500 mt-1">Manage class divisions</p>
                            </div>
                        </div>
                    </Link>

                    <Link href="/fee-types" className="group">
                        <div className="bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col items-center justify-center text-center h-full gap-4">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <Banknote className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-900 group-hover:text-primary transition-colors">Fee Types</h2>
                                <p className="text-sm text-zinc-500 mt-1">Configure fee structures</p>
                            </div>
                        </div>
                    </Link>

                    <Link href="/classwise-fees-schedule" className="group">
                        <div className="bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col items-center justify-center text-center h-full gap-4">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <ClipboardList className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-900 group-hover:text-primary transition-colors">Fees Schedule</h2>
                                <p className="text-sm text-zinc-500 mt-1">Classwise fees schedule</p>
                            </div>
                        </div>
                    </Link>
                </div>
            </div>

            {/* Operations / Records Group */}
            <div className="space-y-4 pt-4">
                <h2 className="text-lg font-medium text-zinc-800">Directory & Enrollment</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    <Link href="/identity/register" className="group">
                        <div className="bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col items-center justify-center text-center h-full gap-4">
                            <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                                <UserPlus className="h-8 w-8 text-emerald-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-900 group-hover:text-emerald-700 transition-colors">Registration</h2>
                                <p className="text-sm text-zinc-500 mt-1">Enroll new students</p>
                            </div>
                        </div>
                    </Link>

                    <Link href="/identity/students" className="group">
                        <div className="bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col items-center justify-center text-center h-full gap-4">
                            <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                                <GraduationCap className="h-8 w-8 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-900 group-hover:text-blue-700 transition-colors">Students</h2>
                                <p className="text-sm text-zinc-500 mt-1">Student directory</p>
                            </div>
                        </div>
                    </Link>

                    <Link href="/families" className="group">
                        <div className="bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col items-center justify-center text-center h-full gap-4">
                            <div className="h-16 w-16 rounded-full bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                                <Users className="h-8 w-8 text-purple-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-zinc-900 group-hover:text-purple-700 transition-colors">Families</h2>
                                <p className="text-sm text-zinc-500 mt-1">Family parent directory</p>
                            </div>
                        </div>
                    </Link>
                </div>
            </div>

        </div>
    );
}
