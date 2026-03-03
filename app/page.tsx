import { redirect } from "next/navigation";

export default function Home() {
  // For now, redirect the root path to the login page.
  // We can add server-side session checking here later to redirect to /dashboard if authenticated.
  redirect("/auth/login");
}
