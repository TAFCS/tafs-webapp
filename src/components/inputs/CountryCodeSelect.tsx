"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { COUNTRY_DIAL_CODES, countryFlagEmoji, searchCountries } from "@/lib/country-codes";

const PANEL_WIDTH = 256; // w-64
const PANEL_MAX_HEIGHT = 288; // search row + max-h-56 list

/**
 * Compact dial-code dropdown meant to sit inline as the "code" segment of a
 * joined phone-number input. Pass `className` to match the surrounding
 * input's exact visual styling (width, borders, background).
 *
 * The panel renders in a portal because these inputs are routinely nested in
 * `overflow-hidden` cards and modals, which would otherwise clip it away.
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
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const reposition = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    // Flip above the field when there isn't room underneath it.
    const flipUp = spaceBelow < PANEL_MAX_HEIGHT && rect.top > spaceBelow;
    setCoords({
      top: flipUp ? Math.max(8, rect.top - PANEL_MAX_HEIGHT - 4) : rect.bottom + 4,
      left: Math.min(Math.max(8, rect.left), window.innerWidth - PANEL_WIDTH - 8),
    });
  }, []);

  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const handle = () => reposition();
    // Capture phase so scrolling of any nested container keeps the panel anchored.
    window.addEventListener("scroll", handle, true);
    window.addEventListener("resize", handle);
    return () => {
      window.removeEventListener("scroll", handle, true);
      window.removeEventListener("resize", handle);
    };
  }, [open, reposition]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const selected = COUNTRY_DIAL_CODES.find((c) => c.dialCode === value?.trim());
  const filtered = searchCountries(search);

  return (
    <div className="shrink-0">
      <button
        ref={btnRef}
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

      {open && !disabled && coords && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: coords.top, left: coords.left, width: PANEL_WIDTH }}
            className="fixed z-[100] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden"
          >
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
          </div>,
          document.body,
        )}
    </div>
  );
}
