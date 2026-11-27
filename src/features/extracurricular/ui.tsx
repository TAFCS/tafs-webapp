"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, X } from "lucide-react";

/**
 * TAFSD-605: small building blocks shared by the Extracurricular Fees pages, so
 * they look and behave alike.
 */

export function EcPageHeader({
    icon: Icon,
    title,
    description,
    actions,
}: {
    icon: React.ElementType;
    title: string;
    description: ReactNode;
    actions?: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">Extracurricular Fees</p>
                <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mt-1">
                    <Icon className="h-6 w-6 text-orange-500" /> {title}
                </h1>
                <p className="text-sm text-zinc-500 mt-1 max-w-3xl">{description}</p>
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
    );
}

/** A visible label over an input, with an optional unit and hint. Every EC input gets one. */
export function EcField({
    label,
    htmlFor,
    unit,
    hint,
    children,
}: {
    label: string;
    htmlFor?: string;
    unit?: string;
    hint?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={htmlFor} className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.18em] ml-1">
                {label}
                {unit && <span className="ml-1 normal-case tracking-normal font-semibold text-zinc-400">({unit})</span>}
            </label>
            {children}
            {hint && <p className="text-xs text-zinc-400 ml-1">{hint}</p>}
        </div>
    );
}

export const ecInputClass =
    "w-full h-11 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-2 focus:ring-orange-500/20 disabled:opacity-60";

export const ecPrimaryButton =
    "inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed";

export const ecSecondaryButton =
    "inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-60 disabled:cursor-not-allowed";

export function EcModal({
    open,
    title,
    subtitle,
    onClose,
    children,
    footer,
    wide,
}: {
    open: boolean;
    title: string;
    subtitle?: ReactNode;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
    wide?: boolean;
}) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open || typeof document === "undefined") return null;
    return createPortal(
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                className={`bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full ${wide ? "max-w-4xl" : "max-w-lg"} max-h-[90vh] flex flex-col overflow-hidden`}
            >
                <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-900 flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100">{title}</h2>
                        {subtitle && <div className="text-xs text-zinc-500 mt-0.5">{subtitle}</div>}
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className="p-2 -m-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900">
                        <X className="h-5 w-5 text-zinc-400" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto space-y-5">{children}</div>
                {footer && (
                    <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-900 bg-zinc-50/60 dark:bg-zinc-900/40 flex justify-end gap-2">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body,
    );
}

export function EcConfirmDialog({
    open,
    title,
    body,
    confirmLabel,
    danger,
    busy,
    onConfirm,
    onClose,
}: {
    open: boolean;
    title: string;
    body: ReactNode;
    confirmLabel: string;
    danger?: boolean;
    busy?: boolean;
    onConfirm: () => void;
    onClose: () => void;
}) {
    return (
        <EcModal
            open={open}
            title={title}
            onClose={onClose}
            footer={
                <>
                    <button type="button" onClick={onClose} className={ecSecondaryButton} disabled={busy}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={busy}
                        className={danger ? ecPrimaryButton.replace("bg-orange-600", "bg-rose-600").replace("hover:bg-orange-700", "hover:bg-rose-700") : ecPrimaryButton}
                    >
                        {busy && <Loader2 className="h-4 w-4 animate-spin" />} {confirmLabel}
                    </button>
                </>
            }
        >
            <div className="flex gap-3">
                {danger && <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />}
                <div className="text-sm text-zinc-600 dark:text-zinc-300 space-y-2">{body}</div>
            </div>
        </EcModal>
    );
}

export function EcStat({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: string; accent?: boolean }) {
    return (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-5 py-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">{label}</div>
            <div className={`text-xl font-black mt-1 ${accent ? "text-orange-600 dark:text-orange-400" : "text-zinc-900 dark:text-zinc-100"}`}>{value}</div>
            {hint && <div className="text-xs text-zinc-400 mt-0.5">{hint}</div>}
        </div>
    );
}

export function EcPageFallback() {
    return (
        <div className="flex items-center justify-center py-24 text-zinc-400">
            <Loader2 className="h-6 w-6 animate-spin" />
        </div>
    );
}
