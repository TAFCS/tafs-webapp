import type { Metadata } from "next";
export const metadata: Metadata = { title: "HR Policies" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
