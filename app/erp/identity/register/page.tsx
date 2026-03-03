import { RegistrationForm } from "@/src/features/admissions/components/registration-form";

export default function AdmissionRegistrationPage() {
    return (
        <div className="pb-10">
            <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 ">New Registration</h2>
                <p className="text-zinc-500 ">Fill out FORM #1 to register a new candidate into the TAFS system.</p>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <RegistrationForm />
            </div>
        </div>
    );
}
