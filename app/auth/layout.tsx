import Image from "next/image";
import { Space_Grotesk } from "next/font/google";
import { ArrowUpRight } from "lucide-react";
import { Orbit } from "./_components/orbit";
import { LiveStatus } from "./_components/live-status";
import { TAFSYNC_MODULES } from "./_components/modules";

const display = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-tfs-display" });

const TAFS_CLOUD_URL = "https://tafs.cloud";

// Animations for the auth shell. Scoped by the tfs- prefix; all of it stops
// under prefers-reduced-motion.
const AUTH_CSS = `
.tfs-display { font-family: var(--font-tfs-display), ui-sans-serif, system-ui, sans-serif; }
.tfs-orbit { --tfs-orbit: min(84vh, 54vw); width: var(--tfs-orbit); height: var(--tfs-orbit); }
@keyframes tfs-spin { to { transform: rotate(360deg); } }
@keyframes tfs-spin-rev { to { transform: rotate(-360deg); } }
.tfs-spin-24 { animation: tfs-spin 24s linear infinite; }
.tfs-spin-36-rev { animation: tfs-spin-rev 36s linear infinite; }
.tfs-spin-60 { animation: tfs-spin 60s linear infinite; }
.tfs-spin-90 { animation: tfs-spin 90s linear infinite; }
.tfs-spin-90-rev { animation: tfs-spin-rev 90s linear infinite; }
.tfs-packet { position: absolute; inset: -1px; border-radius: 9999px; }
.tfs-packet::before {
  content: ""; position: absolute; top: -4px; left: 50%; width: 7px; height: 7px; margin-left: -3.5px;
  border-radius: 9999px; background: #F0A35E; box-shadow: 0 0 14px 4px rgba(213,102,55,0.55);
}
.tfs-packet-blue::before { background: #8BC4FF; box-shadow: 0 0 14px 4px rgba(79,139,214,0.55); }
@keyframes tfs-aurora { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(4%,-3%,0) scale(1.08); } }
.tfs-aurora { animation: tfs-aurora 18s ease-in-out infinite; }
.tfs-aurora-slow { animation: tfs-aurora 26s ease-in-out infinite reverse; }
@keyframes tfs-ping { 75%,100% { transform: scale(2.2); opacity: 0; } }
.tfs-ping { animation: tfs-ping 1.8s cubic-bezier(0,0,0.2,1) infinite; }
@keyframes tfs-marquee { to { transform: translateX(-50%); } }
.tfs-marquee { animation: tfs-marquee 60s linear infinite; }
@keyframes tfs-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.tfs-rise { animation: tfs-rise 0.7s cubic-bezier(0.2,0.8,0.2,1) both; }
.tfs-rise-2 { animation-delay: 0.08s; } .tfs-rise-3 { animation-delay: 0.16s; } .tfs-rise-4 { animation-delay: 0.24s; }
.tfs-grid {
  background-image: radial-gradient(rgba(148,163,184,0.16) 1px, transparent 1px);
  background-size: 26px 26px;
  mask-image: radial-gradient(ellipse 80% 70% at 50% 40%, #000 30%, transparent 75%);
}
@media (prefers-reduced-motion: reduce) {
  .tfs-spin-24, .tfs-spin-36-rev, .tfs-spin-60, .tfs-spin-90, .tfs-spin-90-rev,
  .tfs-aurora, .tfs-aurora-slow, .tfs-ping, .tfs-marquee, .tfs-rise { animation: none !important; }
}
`;

function Wordmark({ size = 44 }: { size?: number }) {
    return (
        <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="TAFS Logo" width={size} height={size} className="object-contain drop-shadow-[0_0_18px_rgba(79,139,214,0.45)]" priority />
            <span className="tfs-display text-[22px] font-bold tracking-tight text-white">
                TAF<span className="text-[#F0A35E]">Sync</span>
            </span>
        </div>
    );
}

function CloudPill() {
    return (
        <a
            href={TAFS_CLOUD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[13px] font-medium text-slate-200 backdrop-blur transition hover:border-[#F0A35E]/50 hover:text-white"
        >
            tafs.cloud
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </a>
    );
}

function Ticker() {
    const items = [...TAFSYNC_MODULES, ...TAFSYNC_MODULES];
    return (
        <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
            <ul className="sr-only">
                {TAFSYNC_MODULES.map((m) => (
                    <li key={m.name}>{m.name}: {m.detail}</li>
                ))}
            </ul>
            <div aria-hidden className="tfs-marquee flex w-max gap-8 py-1">
                {items.map(({ icon: Icon, name, detail }, i) => (
                    <span key={i} className="inline-flex items-center gap-2.5 whitespace-nowrap text-[13px] text-slate-400">
                        <Icon className="h-4 w-4 text-[#F0A35E]" />
                        <span className="font-semibold text-slate-200">{name}</span>
                        <span>{detail}</span>
                        <span className="ml-6 h-1 w-1 rounded-full bg-slate-600" />
                    </span>
                ))}
            </div>
        </div>
    );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className={`${display.variable} relative min-h-screen overflow-hidden bg-[#050B18] text-white`}>
            <style>{AUTH_CSS}</style>

            {/* Backdrop: dotted grid + brand-blue / brand-orange aurora */}
            <div aria-hidden className="pointer-events-none absolute inset-0">
                <div className="tfs-grid absolute inset-0" />
                <div className="tfs-aurora absolute -left-[15%] -top-[25%] h-[70vh] w-[70vw] rounded-full bg-[#255A94]/35 blur-[120px]" />
                <div className="tfs-aurora-slow absolute -bottom-[30%] right-[-10%] h-[60vh] w-[55vw] rounded-full bg-[#D56637]/20 blur-[140px]" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#4F8BD6]/50 to-transparent" />
            </div>

            <div className="relative z-10 mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 lg:grid-cols-12">
                {/* Story column */}
                <section className="flex flex-col px-6 pt-8 sm:px-10 lg:col-span-6 lg:px-12 lg:py-12 xl:col-span-5 xl:px-14">
                    <header className="tfs-rise flex items-center justify-between gap-6 lg:justify-start">
                        <Wordmark />
                        <CloudPill />
                    </header>

                    <div className="mt-12 lg:mt-auto">
                        <p className="tfs-rise tfs-rise-2 text-[12px] font-semibold uppercase tracking-[0.28em] text-[#F0A35E]">
                            The American Foundation School
                        </p>
                        <h1 className="tfs-display tfs-rise tfs-rise-2 mt-4 text-[44px] font-semibold leading-[1] tracking-[-0.035em] sm:text-[60px] xl:text-[72px]">
                            Every campus.
                            <br />
                            <span className="text-slate-300">Every family.</span>
                            <br />
                            <span className="bg-gradient-to-r from-[#8BC4FF] via-[#F0A35E] to-[#D56637] bg-clip-text text-transparent">
                                All in sync.
                            </span>
                        </h1>
                        <p className="tfs-rise tfs-rise-3 mt-6 max-w-md text-[15px] leading-relaxed text-slate-400 sm:text-base">
                            Admissions to payroll, fee vouchers to fingerprints. Every student, family and staff
                            member lives in one system that updates the moment anything changes.
                        </p>
                        <div className="tfs-rise tfs-rise-4 mt-8 hidden lg:block">
                            <LiveStatus />
                        </div>
                    </div>

                    <div className="mt-auto hidden pt-12 lg:block">
                        <Ticker />
                    </div>
                </section>

                {/* The card, with the modules orbiting it */}
                <section className="relative flex items-center justify-center px-4 py-10 sm:px-10 lg:col-span-6 lg:py-12 xl:col-span-7">
                    <div className="hidden xl:block">
                        <Orbit />
                    </div>
                    <div className="tfs-rise tfs-rise-3 relative w-full max-w-[400px]">
                        <div aria-hidden className="absolute -inset-px rounded-[30px] bg-gradient-to-b from-[#4F8BD6]/60 via-white/10 to-[#D56637]/40" />
                        <div className="relative rounded-[29px] bg-white p-7 text-zinc-900 shadow-[0_40px_120px_-30px_rgba(37,90,148,0.75)] sm:p-9 dark:bg-zinc-950 dark:text-zinc-100">
                            {children}
                        </div>
                    </div>
                </section>

                {/* Phones and tablets: status + ticker under the card */}
                <div className="space-y-6 px-6 pb-10 sm:px-10 lg:hidden">
                    <LiveStatus />
                    <Ticker />
                </div>
            </div>
        </div>
    );
}
