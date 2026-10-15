"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { hrService, type HierarchyEmployee } from "@/lib/hr.service";
import { useDebounce } from "@/hooks/use-debounce";

/**
 * Finds a person through GET /v1/hr/employees/search-simple (name, code, CNIC,
 * PIN digits) and maps the hits onto the active staff the page already holds.
 */
export function PersonSearch({
  id,
  label,
  placeholder,
  people,
  onPick,
  problemFor,
}: {
  id: string;
  label: string;
  placeholder: string;
  /** Active staff by id. Hits outside it (people who left) are not offered. */
  people: Map<number, HierarchyEmployee>;
  onPick: (person: HierarchyEmployee) => void;
  /** A reason the hit can't be picked, shown instead of letting it be chosen. */
  problemFor?: (person: HierarchyEmployee) => string | null;
}) {
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query.trim(), 250);
  const [hits, setHits] = useState<HierarchyEmployee[]>([]);
  /** The query the current hits answer. Differs from the input while a search is pending. */
  const [searchedFor, setSearchedFor] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!debounced) return;
    let cancelled = false;
    hrService
      .searchSimple(debounced)
      .then((rows) => {
        if (cancelled) return;
        setHits(rows.map((r) => people.get(r.id)).filter((p): p is HierarchyEmployee => !!p));
        setSearchedFor(debounced);
      })
      .catch(() => {
        if (!cancelled) {
          setHits([]);
          setSearchedFor(debounced);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, people]);

  const typing = query.trim() !== "" && query.trim() !== searchedFor;
  const loading = typing && debounced !== "";
  const showPanel = open && query.trim() !== "";

  return (
    <div className="relative" ref={wrapRef}>
      <label htmlFor={id} className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
        {label}
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
        <input
          id={id}
          type="text"
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="w-full h-10 pl-9 pr-9 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 animate-spin" />
        ) : (
          query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )
        )}
      </div>

      {showPanel && (
        <div className="absolute z-30 mt-1 w-full max-h-72 overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg">
          {typing ? (
            <p className="px-3 py-2.5 text-xs text-zinc-400">Searching…</p>
          ) : hits.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-zinc-500">No active staff match “{searchedFor}”.</p>
          ) : (
            <ul>
              {hits.map((p) => {
                const problem = problemFor?.(p) ?? null;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={!!problem}
                      onClick={() => {
                        onPick(p);
                        setQuery("");
                        setOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                      <span className={`block text-sm font-semibold ${problem ? "text-zinc-400" : "text-zinc-800 dark:text-zinc-100"}`}>
                        {p.full_name || `#${p.id}`}
                        {p.employee_code && <span className="ml-1.5 text-[11px] font-normal text-zinc-400">{p.employee_code}</span>}
                      </span>
                      <span className="block text-[11px] text-zinc-500">
                        {problem ? <span className="text-amber-600 dark:text-amber-400">{problem}</span> : p.job_title || "—"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
