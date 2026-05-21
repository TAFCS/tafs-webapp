import type { Metadata } from "next";
export const metadata: Metadata = { title: "Bulk Voucher Generation" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
