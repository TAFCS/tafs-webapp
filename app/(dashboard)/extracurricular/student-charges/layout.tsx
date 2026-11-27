import type { Metadata } from "next";
export const metadata: Metadata = { title: "Extracurricular Student Charges" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
