"use client";

import { useRef, useState } from "react";

/**
 * Hover / focus / tap popover. Positioned `fixed` from the trigger's rect so a
 * table's overflow container can't clip it.
 */
export function InfoTip({ children, content, width = 300 }: { children: React.ReactNode; content: React.ReactNode; width?: number }) {
    const ref = useRef<HTMLSpanElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);

    const show = () => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        const left = Math.max(8, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 8));
        const above = r.bottom + 220 > window.innerHeight;
        setPos({ top: above ? r.top - 8 : r.bottom + 8, left, above });
    };
    const hide = () => setPos(null);

    return (
        <span
            ref={ref}
            className="inline-flex cursor-help"
            tabIndex={0}
            onMouseEnter={show}
            onMouseLeave={hide}
            onFocus={show}
            onBlur={hide}
            onClick={(e) => {
                e.stopPropagation();
                if (pos) hide();
                else show();
            }}
        >
            {children}
            {pos && (
                <span
                    role="tooltip"
                    style={{ position: "fixed", top: pos.top, left: pos.left, width, transform: pos.above ? "translateY(-100%)" : undefined }}
                    className="z-[60] rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl p-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300 text-left font-normal normal-case tracking-normal whitespace-normal"
                >
                    {content}
                </span>
            )}
        </span>
    );
}
