import { Suspense } from "react";
import { RegistrationForm } from "@/src/features/admissions/components/registration-form";

export default function RegistrationFormPage() {
    return (
        <div className="space-y-6">
            <Suspense fallback={<div className="p-8 text-center text-zinc-400 font-medium animate-pulse">Loading registration form...</div>}>
                <RegistrationForm />
            </Suspense>
        </div>
    );
}
