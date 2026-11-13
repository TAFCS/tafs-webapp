"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, FileText, Grid3x3, Landmark, Scale, type LucideIcon } from "lucide-react";
import {
  useFinancialReportsAccess,
  type FinancialReportTabSlug,
} from "@/hooks/use-financial-reports-access";

const ICONS: Record<FinancialReportTabSlug, LucideIcon> = {
  "fee-heads": FileText,
  deposits: Landmark,
  "fee-matrix": Grid3x3,
  defaulters: AlertTriangle,
  ubl: Scale,
};

/** Only the tabs the user holds (TAFSD-482). */
export function ReportTabs() {
  const pathname = usePathname();
  const access = useFinancialReportsAccess();

  if (access.allowedTabs.length === 0) return null;

  return (
    <nav className="flex flex-wrap gap-1 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-900 w-fit">
      {access.allowedTabs.map((tab) => {
        const href = `/financial-reports/${tab.slug}`;
        const active = pathname.startsWith(href);
        const Icon = ICONS[tab.slug];
        return (
          <Link
            key={tab.slug}
            href={href}
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
