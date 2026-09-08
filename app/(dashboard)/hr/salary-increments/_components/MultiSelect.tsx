"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type MultiSelectOption = { value: string | number; label: string };

export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  disabled,
  className = "",
}: {
  label: string;
  options: MultiSelectOption[];
  selected: (string | number)[];
  onChange: (next: (string | number)[]) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (value: string | number) =>
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    );

  const count = selected.length;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 min-w-[9rem] items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
      >
        <span className="truncate">
          {label}
          {count > 0 && (
            <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              {count}
            </span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1 max-h-64 w-60 overflow-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between px-2 py-1.5 text-xs text-zinc-500">
            <span>{count} selected</span>
            {count > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="font-semibold text-amber-600 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          {options.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-zinc-400">No options</p>
          )}
          {options.map((opt) => {
            const on = selected.includes(opt.value);
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => toggle(opt.value)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    on
                      ? "border-amber-500 bg-amber-500 text-white"
                      : "border-zinc-300 dark:border-zinc-600"
                  }`}
                >
                  {on && <Check className="h-3 w-3" />}
                </span>
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
