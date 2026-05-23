import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Post-dated Cheques",
};

export default function PostdatedChequesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
