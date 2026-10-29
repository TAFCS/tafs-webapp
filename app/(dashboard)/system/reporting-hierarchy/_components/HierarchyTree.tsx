"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { edgePath, NODE_H, NODE_W, type layoutTree } from "./tree";

type Layout = ReturnType<typeof layoutTree>;

export function HierarchyTree({
  layout,
  selectedId,
  dimmed,
  campusCode,
  onSelect,
  onToggle,
}: {
  layout: Layout;
  selectedId: number | null;
  /** People outside the active filters, drawn faded. Empty when no filter is set. */
  dimmed: Set<number>;
  campusCode: (id: number | null) => string;
  onSelect: (id: number) => void;
  onToggle: (id: number, collapsed: boolean) => void;
}) {
  const { nodes, edges, width, height } = layout;

  return (
    <div className="overflow-auto rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 max-h-[70vh]">
      <div className="relative" style={{ width, height }}>
        <svg className="absolute inset-0 pointer-events-none" width={width} height={height} aria-hidden>
          {edges.map((e, i) => {
            const faded = dimmed.has(e.from.person.id) || dimmed.has(e.to.person.id);
            return (
              <path
                key={i}
                d={edgePath(e)}
                fill="none"
                className={
                  e.secondary
                    ? "stroke-primary/70"
                    : "stroke-zinc-300 dark:stroke-zinc-700"
                }
                strokeWidth={e.secondary ? 1.8 : 1.6}
                strokeDasharray={e.secondary ? "2 4" : undefined}
                opacity={faded ? 0.25 : 1}
              />
            );
          })}
        </svg>

        {nodes.map((n) => {
          const p = n.person;
          const selected = p.id === selectedId;
          const faded = dimmed.has(p.id);
          return (
            <div
              key={p.id}
              id={`hierarchy-node-${p.id}`}
              className="absolute"
              style={{ left: n.x, top: n.y, width: NODE_W, height: NODE_H, opacity: faded ? 0.35 : 1 }}
            >
              <button
                type="button"
                onClick={() => onSelect(p.id)}
                className={`w-full h-full text-left rounded-xl border px-3 py-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  selected
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-primary/60"
                }`}
                title={[p.full_name, p.job_title].filter(Boolean).join(" · ")}
              >
                <span className="block text-[12.5px] font-bold text-zinc-900 dark:text-zinc-100 truncate">
                  {p.full_name || p.employee_code || `#${p.id}`}
                </span>
                <span className="block text-[11px] text-zinc-500 truncate">
                  {[p.job_title, campusCode(p.campus_id)].filter(Boolean).join(" · ") || "—"}
                </span>
              </button>
              {n.childCount > 0 && (
                <button
                  type="button"
                  onClick={() => onToggle(p.id, !n.collapsed)}
                  className="absolute left-1/2 -translate-x-1/2 -bottom-3 z-10 flex items-center gap-0.5 h-6 px-2 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[10.5px] font-bold text-zinc-600 dark:text-zinc-300 hover:border-primary"
                  aria-label={n.collapsed ? `Show ${n.childCount} reports` : "Hide reports"}
                >
                  {n.collapsed ? (
                    <>
                      {n.childCount} <ChevronDown className="h-3 w-3" />
                    </>
                  ) : (
                    <ChevronUp className="h-3 w-3" />
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
