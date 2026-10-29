import type { Metadata } from "next";
export const metadata: Metadata = { title: "Reporting Hierarchy" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
