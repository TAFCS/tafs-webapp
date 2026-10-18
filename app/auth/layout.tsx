import Image from "next/image";
import { Users, Wallet, Fingerprint, Briefcase, Megaphone, School, ExternalLink } from "lucide-react";

const TAFS_CLOUD_URL = "https://tafs.cloud";

// What TAFSync covers today — keep in step with the top-level groups in src/lib/nav-config.ts.
const MODULES = [
    { icon: Users, name: "Students & Profiling", detail: "Admissions, directory, families, transfers, promotions" },
    { icon: Wallet, name: "Finance", detail: "Fee schedules, vouchers, deposits, financial reports" },
    { icon: Fingerprint, name: "Attendance", detail: "Biometric devices, staff & student attendance, timetables" },
    { icon: Briefcase, name: "HR & Payroll", detail: "Employee records, payroll, loans, increments" },
    { icon: Megaphone, name: "Communications", detail: "Notice board, support tickets, parent chat" },
    { icon: School, name: "School Setup", detail: "Campuses, classes, sections, academic calendar" },
];

function CloudLink({ className = "" }: { className?: string }) {
    return (
        <a
            href={TAFS_CLOUD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 font-medium transition-colors ${className}`}
        >
            tafs.cloud
            <ExternalLink className="h-3.5 w-3.5" />
        </a>
    );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
            {/* Left side: Branding (Split Screen design) */}
            <div className="hidden md:flex flex-col justify-center bg-zinc-900 text-white p-12 lg:p-16 relative overflow-hidden">
                {/* Subtle background gradient for premium feel */}
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/20 via-zinc-900 to-zinc-900"></div>
                <div className="relative z-10 w-full max-w-lg mx-auto">
                    <div className="flex items-center gap-4">
                        <Image
                            src="/logo.png"
                            alt="TAFS Logo"
                            width={64}
                            height={64}
                            className="object-contain drop-shadow-[0_0_20px_rgba(59,130,246,0.4)]"
                            priority
                        />
                        <div>
                            <h1 className="text-4xl font-bold tracking-tight">TAFSync</h1>
                            <CloudLink className="text-sm text-blue-300 hover:text-blue-200" />
                        </div>
                    </div>
                    <p className="text-zinc-400 text-lg mt-6">
                        The American Foundation School, run from one place: students, fees, attendance, staff and parents.
                    </p>

                    <ul className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-5">
                        {MODULES.map(({ icon: Icon, name, detail }) => (
                            <li key={name} className="flex items-start gap-3">
                                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/10">
                                    <Icon className="h-4 w-4 text-blue-300" />
                                </span>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-zinc-100">{name}</p>
                                    <p className="text-xs text-zinc-400 leading-relaxed">{detail}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Right side: Auth Form Content */}
            <div className="flex flex-col justify-center items-center p-8 bg-white dark:bg-zinc-950 ">
                {/* Branding visible on mobile (left panel is hidden) */}
                <div className="md:hidden mb-8 flex flex-col items-center text-center">
                    <Image
                        src="/logo.png"
                        alt="TAFS Logo"
                        width={72}
                        height={72}
                        className="object-contain"
                        priority
                    />
                    <p className="mt-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">TAFSync</p>
                    <CloudLink className="text-sm text-primary hover:text-primary/80" />
                </div>
                {children}
            </div>
        </div>
    );
}
