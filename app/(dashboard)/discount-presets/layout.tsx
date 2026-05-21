import type { Metadata } from "next";
export const metadata: Metadata = { title: "Discount Presets" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
