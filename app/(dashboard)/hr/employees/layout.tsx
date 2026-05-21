import type { Metadata } from "next";
export const metadata: Metadata = { title: "Employee Directory" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
