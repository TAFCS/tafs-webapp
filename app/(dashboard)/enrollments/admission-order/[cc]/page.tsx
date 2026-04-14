"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdmissionOrderTab } from "@/app/(dashboard)/identity/students/tabs/AdmissionOrderTab";

export default function AdmissionOrderPage() {
    const params = useParams();
    const router = useRouter();
    const cc = parseInt(params.cc as string);

    if (!cc) return null;

    return (
        <div className="max-w-4xl mx-auto py-10 px-6 space-y-8">
            <div className="flex items-center gap-4 mb-4">
                <button onClick={() => router.back()} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors">
                    <ArrowLeft className="h-6 w-6 text-zinc-500" />
                </button>
                <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">
                    Admission Order <span className="text-xs bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded-lg text-zinc-400">CC #{cc}</span>
                </h1>
            </div>

            <AdmissionOrderTab cc={cc} />
        </div>
    );
}
