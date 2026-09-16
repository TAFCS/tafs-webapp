"use client";

import type { ReactNode } from "react";
import { Smartphone, Package, Lock } from "lucide-react";
import type { AccessCatalogTile } from "@/lib/nav-config";

/**
 * Staff App tabs that no tile controls, listed so the section describes the
 * whole app and nobody goes hunting for a toggle that does not exist.
 * Mirrors tafs-staff-app employee_main_shell.dart `_buildTabs`.
 */
const UNGATED_TABS: { label: string; rule: string }[] = [
    { label: "Home", rule: "Every staff login" },
    { label: "Profile", rule: "Every login linked to an employee profile" },
    { label: "Tickets", rule: "Follows Communications → Support Tickets above" },
    { label: "Notices", rule: "Super admins only" },
    { label: "Admissions", rule: "Super admins only" },
];

interface Props {
    tiles: AccessCatalogTile[];
    renderTileRow: (tile: AccessCatalogTile) => ReactNode;
    /** The system pack that carries these tabs for every employee. */
    packName?: string;
    /** Whether that pack is (in the draft) assigned to this person. */
    packAssigned: boolean;
    /**
     * Set when this person's role baseline already carries some of these tabs'
     * keys (e.g. "EMPLOYEE"). A tile deny cannot beat a role baseline, so the
     * section must not promise that denying hides the tab.
     */
    roleGrantingTabs?: string;
}

/**
 * The TAFS Staff App's permission-gated tabs, drawn apart from the web tiles.
 *
 * They are ordinary access tiles underneath — granted, packed and denied the
 * same way — but "Payroll" here is one's own payslips and "Payroll" in HR is
 * everyone's salaries, so they must never sit in the same list.
 */
export function StaffAppAccessSection({ tiles, renderTileRow, packName, packAssigned, roleGrantingTabs }: Props) {
    return (
        <section className="rounded-2xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/40 dark:bg-sky-950/20 overflow-hidden">
            <header className="flex items-start gap-3 px-4 pt-4 pb-3">
                <span className="h-9 w-9 shrink-0 rounded-xl bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 flex items-center justify-center">
                    <Smartphone className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-zinc-900 dark:text-zinc-100">TAFS Staff App</p>
                        <span className="px-1.5 py-0.5 rounded-md bg-sky-600 text-white text-[9px] font-black uppercase tracking-widest">
                            Mobile tabs
                        </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        What this person sees in the mobile app. Separate from the web tiles above.
                    </p>
                </div>
            </header>

            {packName && (
                <div className="mx-4 mb-3 flex items-start gap-2 rounded-xl bg-white/70 dark:bg-zinc-900/60 border border-sky-100 dark:border-sky-900/50 px-3 py-2">
                    <Package className="h-3.5 w-3.5 mt-0.5 shrink-0 text-sky-600 dark:text-sky-400" />
                    <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                        Every employee gets these through the <strong>{packName}</strong> pack
                        {packAssigned ? (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[9px] font-black uppercase tracking-wider">
                                Assigned
                            </span>
                        ) : (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-[9px] font-black uppercase tracking-wider">
                                Not assigned
                            </span>
                        )}
                        .{" "}
                        {roleGrantingTabs
                            ? "Tabs marked “via Role” cannot be hidden with a deny — the role grants them regardless."
                            : "Deny a tab below to hide it from just this person."}
                    </p>
                </div>
            )}

            <ul className="space-y-1 px-2 pb-2">{tiles.map(renderTileRow)}</ul>

            <div className="border-t border-sky-100 dark:border-sky-900/50 px-4 py-3 bg-white/50 dark:bg-zinc-950/30">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1.5">Not controlled here</p>
                <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                    {UNGATED_TABS.map((tab) => (
                        <li key={tab.label} className="flex items-center gap-1.5 min-w-0 text-[11px]">
                            <Lock className="h-3 w-3 shrink-0 text-zinc-300 dark:text-zinc-600" />
                            <span className="font-semibold text-zinc-600 dark:text-zinc-300">{tab.label}</span>
                            <span className="truncate text-zinc-400">— {tab.rule}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
