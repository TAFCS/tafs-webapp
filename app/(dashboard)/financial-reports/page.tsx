"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/store/hooks";
import { useFinancialReportsAccess } from "@/hooks/use-financial-reports-access";

/** Lands on the first report tab the user holds (TAFSD-482). */
export default function FinancialReportsPage() {
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const access = useFinancialReportsAccess();
  const first = access.allowedTabs[0];

  useEffect(() => {
    if (first) router.replace(`/financial-reports/${first.slug}`);
  }, [first, router]);

  if (user && !first) {
    return (
      <p className="py-24 text-center text-sm font-bold text-zinc-500">
        You don&apos;t have access to any financial report. Ask an administrator if you need one.
      </p>
    );
  }
  return null;
}
