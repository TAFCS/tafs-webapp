import type { Metadata } from "next";
export const metadata: Metadata = { title: "Classwise Fee Schedule" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
