import { Suspense } from "react";
import type { Metadata } from "next";
import { EmployeeForm } from "../_components/EmployeeForm";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = { title: "Add Employee" };

export default function NewEmployeePage() {
  return (
    <Suspense fallback={
      <div className="max-w-5xl mx-auto flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-zinc-500 text-sm">Loading…</p>
      </div>
    }>
      <EmployeeForm />
    </Suspense>
  );
}
