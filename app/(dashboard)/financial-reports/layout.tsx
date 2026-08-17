import type { ReactNode } from "react";
import { ReportTabs } from "./_components/report-tabs";

export default function FinancialReportsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <ReportTabs />
      {children}
    </div>
  );
}
