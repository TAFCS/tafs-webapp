"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ScrollText } from "lucide-react";
import { ScheduleEditor } from "../_components/ScheduleEditor";
import { useExamDocumentsAccess } from "@/hooks/use-exam-documents-access";

/** TAFSD-510: a new exam schedule, saved as a draft. */
export default function NewExamSchedulePage() {
    const router = useRouter();
    const access = useExamDocumentsAccess();

    return (
        <div className="space-y-6 pb-12">
            <div>
                <Link href="/exam-documents" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                    <ArrowLeft className="h-4 w-4" /> Exam Documents
                </Link>
                <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mt-2">
                    <ScrollText className="h-6 w-6 text-blue-500" /> New exam schedule
                </h1>
                <p className="text-sm text-zinc-500 mt-1">Saved as a draft. Publish it when it is checked, and documents can be issued from the issue date.</p>
            </div>
            {access.can("manage_schedules") ? (
                <ScheduleEditor onSaved={(s) => router.push(`/exam-documents/${s.id}?tab=schedule`)} onCancel={() => router.push("/exam-documents")} />
            ) : (
                <p className="text-sm text-zinc-500">You can view exam documents but not create schedules.</p>
            )}
        </div>
    );
}
