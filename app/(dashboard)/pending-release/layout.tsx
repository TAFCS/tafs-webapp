import type { Metadata } from "next";
export const metadata: Metadata = { title: "Pending Release" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
