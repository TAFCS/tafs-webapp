import { AdmissionForm } from "@/src/features/admissions/components/admission-form";

export default function AdmissionRegistrationPage() {
    return (
        <div className="pb-10">
            <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">New Admission</h2>
                <p className="text-zinc-500 dark:text-zinc-400">Fill out FORM #1 to register a new candidate into the TAFS system.</p>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <AdmissionForm />
            </div>
        </div>
    );
}
