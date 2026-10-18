import { TAFSYNC_MODULES } from "./modules";

/**
 * The modules circling whatever sits in the middle (the sign-in card).
 * Pure CSS: the ring spins, each chip counter-spins so its label stays upright.
 * Decorative — the same modules are listed for screen readers in the ticker.
 */
export function Orbit() {
    return (
        <div aria-hidden className="tfs-orbit pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            {/* Rings, inner to outer, each carrying a travelling sync packet */}
            <div className="tfs-ring absolute inset-[22%] rounded-full border border-dashed border-white/[0.07]">
                <span className="tfs-packet tfs-spin-24" />
            </div>
            <div className="tfs-ring absolute inset-[11%] rounded-full border border-white/[0.05]">
                <span className="tfs-packet tfs-packet-blue tfs-spin-36-rev" />
            </div>
            <div className="absolute inset-0 rounded-full border border-white/[0.08]" />
            <div className="absolute -inset-[9%] rounded-full border border-dashed border-white/[0.04]">
                <span className="tfs-packet tfs-spin-60" />
            </div>

            {/* Module chips on the outer ring */}
            <div className="tfs-spin-90 absolute inset-0">
                {TAFSYNC_MODULES.map(({ icon: Icon, name }, i) => (
                    <div
                        key={name}
                        className="absolute left-1/2 top-1/2"
                        style={{
                            transform: `rotate(${i * 60}deg) translateY(calc(var(--tfs-orbit) / -2)) rotate(${-i * 60}deg)`,
                        }}
                    >
                        <div className="tfs-spin-90-rev -translate-x-1/2 -translate-y-1/2">
                            <div className="flex items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-2 text-[12.5px] font-medium text-slate-200 shadow-[0_8px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur-md">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#255A94]/40 ring-1 ring-white/10">
                                    <Icon className="h-3.5 w-3.5 text-sky-200" />
                                </span>
                                {name}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
