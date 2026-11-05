import type { ReactNode } from "react";
import { ReportTabs } from "./_components/report-tabs";
import { ReportTabGate } from "./_components/report-tab-gate";

export default function FinancialReportsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <ReportTabs />
      <ReportTabGate>{children}</ReportTabGate>
    </div>
  );
}
