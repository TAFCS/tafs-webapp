"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity, AlertTriangle, FolderOpen, Loader2, Lock, Search, Settings2 } from "lucide-react";
import { useStudentDocumentsAccess } from "@/hooks/use-student-documents-access";
import { StudentsTab } from "./StudentsTab";
import { MissingTab } from "./MissingTab";
import { ActivityTab } from "./ActivityTab";
import { TypesTab } from "./TypesTab";

type Tab = "students" | "missing" | "activity" | "types";

export default function StudentDocumentsPage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                </div>
            }
        >
            <StudentDocuments />
        </Suspense>
    );
}

/**
 * TAFSD-498: Student → Student Documents. The front desk's view of the vault:
 * find a student and file their papers, see who is missing what, follow what
 * was filed recently, and (for admins) keep the list of document types.
 * Every view of it lives in the URL so a link can be shared.
 */
function StudentDocuments() {
    const access = useStudentDocumentsAccess();
    const router = useRouter();
    const params = useSearchParams();

    const canTypes = access.can("manage_types");
    const raw = params.get("tab");
    const tab: Tab = raw === "missing" || raw === "activity" || (raw === "types" && canTypes) ? raw : "students";
    const cc = Number(params.get("cc")) || null;

    /** Merge into the query string. `null` removes a key. */
    const setParams = useCallback(
        (next: Record<string, string | null>) => {
            const sp = new URLSearchParams(params.toString());
            for (const [k, v] of Object.entries(next)) {
                if (v === null) sp.delete(k);
                else sp.set(k, v);
            }
            const qs = sp.toString();
            router.replace(`/identity/documents${qs ? `?${qs}` : ""}`, { scroll: false });
        },
        [params, router],
    );

    const openStudent = useCallback(
        (studentCc: number, from?: Tab) => setParams({ tab: "students", cc: String(studentCc), from: from && from !== "students" ? from : null }),
        [setParams],
    );

    if (!access.canView) {
        return (
            <div className="mx-auto max-w-lg p-6">
                <div className="flex flex-col items-center gap-3 rounded-3xl border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
                    <Lock className="h-8 w-8 text-zinc-400" />
                    <h1 className="text-lg font-black text-zinc-900 dark:text-zinc-100">Student Documents</h1>
                    <p className="text-sm text-zinc-500">You don&apos;t have access to student documents. Ask an administrator for the Student Documents tile.</p>
                </div>
            </div>
        );
    }

    const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
        { id: "students", label: "Find a student", icon: Search },
        { id: "missing", label: "Missing documents", icon: AlertTriangle },
        { id: "activity", label: "Recent activity", icon: Activity },
        ...(canTypes ? [{ id: "types" as Tab, label: "Document types", icon: Settings2 }] : []),
    ];

    return (
        <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
            <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
                <div className="min-w-0 space-y-1">
                    <h1 className="flex items-center gap-3 text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
                        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                            <FolderOpen className="h-5 w-5" />
                        </span>
                        Student Documents
                    </h1>
                    <p className="text-sm text-zinc-500">B-Forms, certificates, parents&apos; CNICs and everything the school issues, with every old copy kept.</p>
                </div>
                <nav className="flex max-w-full gap-1 self-start overflow-x-auto rounded-2xl xl:shrink-0 xl:self-auto border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900" aria-label="Sections">
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setParams({ tab: t.id === "students" ? null : t.id, from: null })}
                            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black transition-colors ${
                                tab === t.id
                                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                            }`}
                            aria-current={tab === t.id ? "page" : undefined}
                        >
                            <t.icon className="h-3.5 w-3.5" /> {t.label}
                        </button>
                    ))}
                </nav>
            </div>

            {tab === "students" && (
                <StudentsTab
                    cc={cc}
                    backTo={params.get("from") === "missing" ? "missing" : params.get("from") === "activity" ? "activity" : null}
                    onSelect={(c) => setParams({ cc: c ? String(c) : null })}
                    onBack={(to) => setParams({ tab: to, cc: null, from: null })}
                />
            )}
            {tab === "missing" && <MissingTab params={params} setParams={setParams} onOpenStudent={(c) => openStudent(c, "missing")} canExport={access.can("export")} />}
            {tab === "activity" && <ActivityTab onOpenStudent={(c) => openStudent(c, "activity")} />}
            {tab === "types" && canTypes && <TypesTab />}
        </div>
    );
}
