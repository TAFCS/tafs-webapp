"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import {
  FINANCIAL_REPORT_TABS,
  useFinancialReportsAccess,
} from "@/hooks/use-financial-reports-access";

/**
 * Stops a tab the user doesn't hold from rendering when its URL is opened
 * directly (TAFSD-482). The API refuses its data either way; this replaces a
 * page of failed requests with a plain message.
 */
export function ReportTabGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const access = useFinancialReportsAccess();
  const tab = FINANCIAL_REPORT_TABS.find((t) => pathname.startsWith(`/financial-reports/${t.slug}`));

  if (!tab || access.canTab(tab.slug)) return <>{children}</>;

  const first = access.allowedTabs[0];
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <Lock className="h-8 w-8 text-zinc-300 dark:text-zinc-700" />
      <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
        You don&apos;t have access to the {tab.label} report.
      </p>
      {first ? (
        <Link
          href={`/financial-reports/${first.slug}`}
          className="text-sm font-semibold text-primary hover:underline"
        >
          Go to {first.label}
        </Link>
      ) : (
        <p className="text-xs text-zinc-500">Ask an administrator if you need it.</p>
      )}
    </div>
  );
}
