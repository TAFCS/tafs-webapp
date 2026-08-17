"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Loader2, Search, X } from "lucide-react";

export interface FilterDropdownOption<T extends string | number = number> {
  id: T;
  label: string;
  sub?: string;
}

export function FilterDropdown<T extends string | number = number>({
  label,
  icon: Icon,
  value,
  options,
  loading,
  placeholder,
  onToggle,
  onClear,
  onSetValue,
  hint,
}: {
  label: string;
  icon: React.ElementType;
  value: T[];
  options: FilterDropdownOption<T>[];
  loading?: boolean;
  placeholder: string;
  onToggle: (id: T) => void;
  onClear: () => void;
  onSetValue?: (ids: T[]) => void;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.filter((o) => value.includes(o.id));
  const filtered = options.filter(
    (o) =>
      o.label.toLowerCase().includes(search.toLowerCase()) ||
      (o.sub && o.sub.toLowerCase().includes(search.toLowerCase())),
  );

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const displayLabel =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0].label
        : `${selected.length} selected`;

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.18em] flex items-center gap-1.5 ml-1">
        <Icon className="h-3 w-3" /> {label}
        {hint && (
          <span className="normal-case font-semibold tracking-normal text-zinc-300">{hint}</span>
        )}
      </label>
      <div className="relative">
        <button
          type="button"
          id={`filter-${label.toLowerCase().replace(/\s/g, "-")}`}
          onClick={() => {
            setOpen((o) => !o);
            setSearch("");
          }}
          className={`w-full h-11 flex items-center justify-between px-4 rounded-xl text-sm transition-all border shadow-sm
                        ${selected.length > 0 ? "bg-primary/5 border-primary/30 text-zinc-900 dark:text-zinc-100" : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400"}
                        hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10`}
        >
          <span className="font-semibold truncate">{displayLabel}</span>
          <div className="flex items-center gap-1.5 ml-2 shrink-0">
            {selected.length > 0 && (
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="p-0.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown
              className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </div>
        </button>

        {open && (
          <div className="absolute z-50 top-full mt-2 w-full min-w-[220px] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="p-2.5 border-b border-zinc-100 dark:border-zinc-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 h-8 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:border-primary placeholder:text-zinc-400"
                />
              </div>
            </div>
            {onSetValue && filtered.length > 0 && (
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => onSetValue(Array.from(new Set([...value, ...filtered.map((o) => o.id)])))}
                  className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
                >
                  Select {search ? "shown" : "all"}
                </button>
                {value.length > 0 && (
                  <button
                    type="button"
                    onClick={onClear}
                    className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-700"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
            <div className="max-h-56 overflow-y-auto p-1">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-zinc-400 text-xs">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-400">No results</div>
              ) : (
                filtered.map((o) => {
                  const isChecked = value.includes(o.id);
                  return (
                    <button
                      key={String(o.id)}
                      type="button"
                      onClick={() => onToggle(o.id)}
                      className={`w-full flex items-center justify-between gap-2 px-3.5 h-10 rounded-lg text-sm transition-all
                                            ${isChecked ? "bg-primary text-white font-semibold" : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span
                          className={`h-4 w-4 rounded-md border flex items-center justify-center shrink-0 ${isChecked ? "bg-white/20 border-white/40" : "border-zinc-300 dark:border-zinc-600"}`}
                        >
                          {isChecked && <CheckCircle2 className="h-3 w-3" />}
                        </span>
                        {o.label}
                      </span>
                      {o.sub && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${isChecked ? "bg-white/20" : "bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"}`}
                        >
                          {o.sub}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
