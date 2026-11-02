"use client";

import { STUDENT_BENEFITS, type BenefitsState, type StudentBenefit } from "@/lib/student-benefits";

// Full class strings so Tailwind keeps them.
const TONE: Record<StudentBenefit["tone"], { on: string; box: string; text: string; field: string; chip: string }> = {
    amber: { on: "bg-amber-500", box: "border-amber-100 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20", text: "text-amber-800 dark:text-amber-300", field: "border-amber-200 focus:ring-amber-200", chip: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/40" },
    orange: { on: "bg-orange-500", box: "border-orange-100 bg-orange-50/40 dark:border-orange-900/40 dark:bg-orange-950/20", text: "text-orange-800 dark:text-orange-300", field: "border-orange-200 focus:ring-orange-200", chip: "bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-900/40" },
    emerald: { on: "bg-emerald-500", box: "border-emerald-100 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20", text: "text-emerald-800 dark:text-emerald-300", field: "border-emerald-200 focus:ring-emerald-200", chip: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/40" },
    sky: { on: "bg-sky-500", box: "border-sky-100 bg-sky-50/40 dark:border-sky-900/40 dark:bg-sky-950/20", text: "text-sky-800 dark:text-sky-300", field: "border-sky-200 focus:ring-sky-200", chip: "bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-900/40" },
    violet: { on: "bg-violet-500", box: "border-violet-100 bg-violet-50/40 dark:border-violet-900/40 dark:bg-violet-950/20", text: "text-violet-800 dark:text-violet-300", field: "border-violet-200 focus:ring-violet-200", chip: "bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-900/40" },
};

export const benefitChipClass = (b: StudentBenefit) => TONE[b.tone].chip;

/**
 * TAFSD-455: switch each fee benefit on or off, with its reason, end date and
 * (optional) reminder date. Turning one off clears its details.
 */
export function FeeBenefitsEditor({
    value,
    onChange,
}: {
    value: BenefitsState;
    onChange: (next: BenefitsState) => void;
}) {
    const set = (b: StudentBenefit, patch: Partial<BenefitsState[StudentBenefit["key"]]>) =>
        onChange({ ...value, [b.key]: { ...value[b.key], ...patch } });

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                {STUDENT_BENEFITS.map((b) => {
                    const on = value[b.key].on;
                    return (
                        <label key={b.key} className="flex items-center gap-3 cursor-pointer group" title={b.hint}>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={on}
                                onClick={() =>
                                    set(b, on ? { on: false, reason: "", until: "", remind_from: "" } : { on: true })
                                }
                                className={`w-10 h-5 rounded-full relative transition-colors shrink-0 ${on ? TONE[b.tone].on : "bg-zinc-200 dark:bg-zinc-700"}`}
                            >
                                <span className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${on ? "translate-x-5" : ""}`} />
                            </button>
                            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                                {b.label}
                            </span>
                        </label>
                    );
                })}
            </div>

            {STUDENT_BENEFITS.filter((b) => value[b.key].on).map((b) => {
                const v = value[b.key];
                const t = TONE[b.tone];
                const field = `w-full h-9 px-3 rounded-xl border bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-2 ${t.field}`;
                return (
                    <div key={b.key} className={`rounded-2xl border p-3 space-y-2 ${t.box}`}>
                        <p className={`text-[11px] font-black uppercase tracking-widest ${t.text}`}>
                            {b.label} <span className="font-semibold normal-case tracking-normal opacity-70">· {b.hint}</span>
                        </p>
                        <div className="grid gap-3 md:grid-cols-3">
                            <label className="space-y-1 text-xs">
                                <span className={`font-bold uppercase tracking-wider ${t.text}`}>Why (required)</span>
                                <input type="text" value={v.reason} onChange={(e) => set(b, { reason: e.target.value })} placeholder={`Reason for ${b.label}`} className={field} />
                            </label>
                            <label className="space-y-1 text-xs">
                                <span className={`font-bold uppercase tracking-wider ${t.text}`}>Till when (required)</span>
                                <input type="date" value={v.until} onChange={(e) => set(b, { until: e.target.value })} className={field} />
                            </label>
                            <label className="space-y-1 text-xs">
                                <span className={`font-bold uppercase tracking-wider ${t.text}`}>Remind from</span>
                                <input type="date" value={v.remind_from} max={v.until || undefined} onChange={(e) => set(b, { remind_from: e.target.value })} className={field} />
                                <span className="block text-[10px] text-zinc-500">Empty: 14 days before it ends.</span>
                            </label>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
