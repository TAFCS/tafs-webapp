import { AdmissionForm } from "@/src/features/admissions/components/admission-form";

export default function ComprehensiveAdmissionPage() {
    return (
        <div className="pb-10 max-w-7xl mx-auto">
            <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Comprehensive Admission</h2>
                <p className="text-zinc-500">Fill out the official 5-page Admission Form to formalize candidate entry.</p>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <AdmissionForm />
            </div>
        </div>
    );
}
