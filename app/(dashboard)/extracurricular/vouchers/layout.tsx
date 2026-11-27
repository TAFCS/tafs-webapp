import type { Metadata } from "next";
export const metadata: Metadata = { title: "Extracurricular Vouchers" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
