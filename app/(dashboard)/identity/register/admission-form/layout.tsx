import type { Metadata } from "next";
export const metadata: Metadata = { title: "Admission Form" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
