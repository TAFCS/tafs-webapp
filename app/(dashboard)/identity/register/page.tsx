import Link from "next/link";
import { UserPlus, UserCheck, ChevronRight } from "lucide-react";

export default function RegisterSelectionPage() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">New Enrollment</h1>
                    <p className="text-zinc-500 mt-1">Select the appropriate form to proceed with student enrollment.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 max-w-4xl mx-auto">
                <Link href="/identity/register/registration-form" className="group block">
                    <div className="bg-white border text-left border-zinc-200 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-primary/40 transition-all h-full relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 duration-300">
                            <ChevronRight className="h-6 w-6 text-primary" />
                        </div>
                        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                            <UserPlus className="h-8 w-8 text-primary" />
                        </div>
                        <h2 className="text-2xl font-semibold text-zinc-900 group-hover:text-primary transition-colors mb-3">Registration Form</h2>
                        <p className="text-zinc-500 text-sm leading-relaxed">
                            Form #1. Initial registration step for a new student entering the application phase. Captures basic personal, academic, and family data.
                        </p>
                    </div>
                </Link>

                <Link href="/identity/register/admission-form" className="group block">
                    <div className="bg-white border text-left border-zinc-200 rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-emerald-600/40 transition-all h-full relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 duration-300">
                            <ChevronRight className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mb-6 group-hover:bg-emerald-200 transition-colors">
                            <UserCheck className="h-8 w-8 text-emerald-600" />
                        </div>
                        <h2 className="text-2xl font-semibold text-zinc-900 group-hover:text-emerald-700 transition-colors mb-3">Admission Form</h2>
                        <p className="text-zinc-500 text-sm leading-relaxed">
                            Form #2. Comprehensive admission form requiring a pre-existing Computer Code (CC). Captures in-depth family backgrounds and agreements.
                        </p>
                    </div>
                </Link>
            </div>
        </div>
    );
}
