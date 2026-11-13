"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/** Shared modal shell for the vault: Esc and backdrop close, body scroll locked. */
export function VaultModal({
    open,
    onClose,
    title,
    subtitle,
    children,
    footer,
    size = "md",
    busy,
}: {
    open: boolean;
    onClose: () => void;
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: "md" | "lg" | "xl";
    /** While true, Esc and the backdrop don't close it (an upload is running). */
    busy?: boolean;
}) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !busy) onClose();
        };
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [open, busy, onClose]);

    if (!open) return null;
    const width = size === "xl" ? "max-w-6xl" : size === "lg" ? "max-w-3xl" : "max-w-xl";
    return (
        <div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-zinc-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && !busy) onClose();
            }}
            role="dialog"
            aria-modal="true"
        >
            <div className={`flex max-h-[94vh] w-full ${width} flex-col overflow-hidden rounded-t-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-3xl`}>
                <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
                    <div className="min-w-0">
                        <h3 className="truncate text-base font-black tracking-tight text-zinc-900 dark:text-zinc-100">{title}</h3>
                        {subtitle && <div className="mt-0.5 text-xs text-zinc-500">{subtitle}</div>}
                    </div>
                    <button
                        onClick={onClose}
                        disabled={busy}
                        className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40 dark:hover:bg-zinc-800"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
                {footer && <div className="border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">{footer}</div>}
            </div>
        </div>
    );
}
