import type { Metadata } from "next";
export const metadata: Metadata = { title: "Academic Calendar" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
