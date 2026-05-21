import type { Metadata } from "next";
export const metadata: Metadata = { title: "Inter-Campus Transfers" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
