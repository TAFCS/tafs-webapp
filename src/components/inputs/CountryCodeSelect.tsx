"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { COUNTRY_DIAL_CODES, countryFlagEmoji } from "@/lib/country-codes";

/**
 * Compact dial-code dropdown meant to sit inline as the "code" segment of a
 * joined phone-number input. Pass `className` to match the surrounding
 * input's exact visual styling (width, borders, background).
 */
export function CountryCodeSelect({
  value,
  onChange,
  disabled,
  className = "w-16 px-2 py-2 border-0 bg-zinc-50 dark:bg-zinc-900 outline-none text-sm",
}: {
  value: string;
  onChange: (dialCode: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const selected = COUNTRY_DIAL_CODES.find((c) => c.dialCode === value?.trim());
  const query = search.trim().toLowerCase();
  const filtered = query
    ? COUNTRY_DIAL_CODES.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.dialCode.includes(query) ||
          c.iso2.toLowerCase() === query,
      )
    : COUNTRY_DIAL_CODES;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((o) => !o);
          setSearch("");
        }}
        className={`${className} flex items-center justify-center gap-1 disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {selected && <span>{countryFlagEmoji(selected.iso2)}</span>}
        <span className="font-semibold">{value || "+--"}</span>
      </button>

      {open && !disabled && (
        <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <input
                autoFocus
                type="text"
                placeholder="Search country or code"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 h-8 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:border-primary placeholder:text-zinc-400"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-400">No results</div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.iso2}
                  type="button"
                  onClick={() => {
                    onChange(c.dialCode);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 h-9 rounded-lg text-sm text-left transition-colors ${
                    c.dialCode === value?.trim()
                      ? "bg-primary text-white font-semibold"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span>{countryFlagEmoji(c.iso2)}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className={c.dialCode === value?.trim() ? "text-white/80" : "text-zinc-400"}>
                    {c.dialCode}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
