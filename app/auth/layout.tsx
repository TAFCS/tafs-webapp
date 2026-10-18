import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { TAFSYNC_MODULES } from "./_components/modules";

const TAFS_CLOUD_URL = "https://tafs.cloud";

// Flat on purpose: solid brand colours only — no gradients, no motion.
const BRAND_BLUE = "#255A94";

function CloudLink({ className = "" }: { className?: string }) {
    return (
        <a
            href={TAFS_CLOUD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 font-medium ${className}`}
        >
            tafs.cloud
            <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
    );
}

/** The blue panel: who we are, and a flat preview of what's inside. */
function BrandPanel() {
    return (
        <div className="relative hidden flex-col rounded-[22px] p-10 text-white lg:flex xl:p-12" style={{ backgroundColor: BRAND_BLUE }}>
            {/* Quiet dot pattern, top-right */}
            <div aria-hidden className="absolute right-10 top-10 grid grid-cols-5 gap-2.5 opacity-30">
                {Array.from({ length: 20 }).map((_, i) => (
                    <span key={i} className="h-1 w-1 rounded-full bg-white" />
                ))}
            </div>

            <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white">
                    <Image src="/logo.png" alt="TAFS Logo" width={34} height={34} className="object-contain" priority />
                </span>
                <div className="leading-tight">
                    <p className="text-lg font-semibold">TAFSync</p>
                    <CloudLink className="text-[13px] text-white/75 hover:text-white" />
                </div>
            </div>

            <div className="mt-auto pt-10">
                <ul className="grid grid-cols-3 gap-2.5">
                    {TAFSYNC_MODULES.map(({ icon: Icon, name, detail }) => (
                        <li key={name} title={detail} className="rounded-2xl bg-white p-4 text-zinc-900">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF1F9]">
                                <Icon className="h-[18px] w-[18px]" style={{ color: BRAND_BLUE }} />
                            </span>
                            <p className="mt-3 text-[13.5px] font-semibold leading-tight">{name}</p>
                        </li>
                    ))}
                </ul>

                <span className="mt-10 inline-block rounded-full bg-white/10 px-3.5 py-1.5 text-[12.5px] font-medium text-white/90">
                    The American Foundation School
                </span>
                <h1 className="mt-4 text-[34px] font-semibold leading-[1.12] tracking-[-0.02em] xl:text-[40px]">
                    Every campus.
                    <br />
                    Every family.
                    <br />
                    All in <span className="text-[#F4B48C]">sync</span>.
                </h1>
                <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/75">
                    Students, fees, attendance, staff and parents in one system.
                </p>
            </div>
        </div>
    );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-white font-sans text-zinc-900 lg:bg-[#EEF1F5] lg:p-8 dark:bg-zinc-950 dark:text-zinc-100 lg:dark:bg-zinc-900">
            <div className="mx-auto grid min-h-screen max-w-[1240px] grid-cols-1 lg:min-h-[calc(100vh-4rem)] lg:grid-cols-2 lg:gap-2 lg:rounded-[28px] lg:bg-white lg:p-2 lg:shadow-[0_1px_2px_rgba(15,23,42,0.06),0_12px_40px_-12px_rgba(15,23,42,0.12)] dark:lg:bg-zinc-950">
                <BrandPanel />

                <div className="flex flex-col px-6 py-8 sm:px-12">
                    {/* Phones: the blue panel is hidden, so name the product here */}
                    <div className="flex items-center gap-3 lg:hidden">
                        <Image src="/logo.png" alt="TAFS Logo" width={40} height={40} className="object-contain" priority />
                        <div className="leading-tight">
                            <p className="text-[17px] font-semibold">TAFSync</p>
                            <CloudLink className="text-[13px] text-[#255A94] dark:text-sky-300" />
                        </div>
                    </div>

                    <div className="flex flex-1 items-center justify-center py-10">
                        <div className="w-full max-w-[380px]">{children}</div>
                    </div>

                    <div className="flex items-center justify-between text-[13px] text-zinc-500">
                        <CloudLink className="hover:text-zinc-800 dark:hover:text-zinc-200" />
                        <span>© {new Date().getFullYear()} The American Foundation School</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
