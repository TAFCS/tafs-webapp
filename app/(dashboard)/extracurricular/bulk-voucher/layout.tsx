import type { Metadata } from "next";
export const metadata: Metadata = { title: "Extracurricular Bulk Voucher" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
