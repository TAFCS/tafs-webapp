"use client";

export function StatusBadge({ status }: { status: "DRAFT" | "PUBLISHED" }) {
    return status === "PUBLISHED" ? (
        <span className="text-[11px] font-bold rounded-md px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">Published</span>
    ) : (
        <span className="text-[11px] font-bold rounded-md px-2 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">Draft</span>
    );
}
