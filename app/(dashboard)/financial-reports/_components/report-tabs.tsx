"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FileText, Landmark } from "lucide-react";

const TABS = [
  { href: "/financial-reports", label: "Overview", icon: BarChart3, exact: true },
  { href: "/financial-reports/fee-heads", label: "Fee Heads", icon: FileText, exact: false },
  { href: "/financial-reports/deposits", label: "Deposits", icon: Landmark, exact: false },
];

export function ReportTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-900 w-fit">
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center gap-2 h-9 px-4 rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors ${
              active
                ? "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 shadow-sm"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
