import type { Metadata } from "next";
export const metadata: Metadata = { title: "Extracurricular Fee Heads" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
