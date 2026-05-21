import type { Metadata } from "next";
export const metadata: Metadata = { title: "Academic Transitions" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
