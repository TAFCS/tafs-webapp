import Link from "next/link";
import { Users, UserPlus } from "lucide-react";

export default function IdentityHubPage() {
    return (
        <div className="pb-10 max-w-full">
            <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 border-b pb-2">Identity & Admissions</h2>
                <p className="text-zinc-500 mt-2">Manage student records and process new admissions.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link href="/erp/identity/students" className="p-6 border rounded-xl hover:border-primary/50 hover:bg-zinc-50 transition-all flex flex-col gap-3 group">
                    <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                        <Users className="h-6 w-6 text-blue-700" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-zinc-900">Student Directory</h3>
                        <p className="text-sm text-zinc-500 mt-1">View and manage all enrolled and pending students, filter by campus, and take actions.</p>
                    </div>
                </Link>

                <Link href="/erp/identity/register" className="p-6 border rounded-xl hover:border-primary/50 hover:bg-zinc-50 transition-all flex flex-col gap-3 group">
                    <div className="h-12 w-12 rounded-lg bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                        <UserPlus className="h-6 w-6 text-emerald-700" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-zinc-900">New Registration</h3>
                        <p className="text-sm text-zinc-500 mt-1">Register a new candidate into the system and start the admission flow.</p>
                    </div>
                </Link>
            </div>
        </div>
    );
}
