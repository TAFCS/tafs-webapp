import { Suspense } from "react";
import { AdmissionForm } from "@/src/features/admissions/components/admission-form";

export default function AdmissionFormPage() {
    return (
        <div className="space-y-6">
            <Suspense fallback={<div className="p-8 text-center text-zinc-400 font-medium animate-pulse">Loading admission form...</div>}>
                <AdmissionForm />
            </Suspense>
        </div>
    );
}
