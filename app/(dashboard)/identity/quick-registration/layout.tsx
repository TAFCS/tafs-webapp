import type { Metadata } from "next";
export const metadata: Metadata = { title: "Quick Registration" };
export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
