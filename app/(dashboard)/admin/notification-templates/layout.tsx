import type { Metadata } from "next";
export const metadata: Metadata = { title: "Notification Templates" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
