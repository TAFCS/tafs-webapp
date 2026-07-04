"use client";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import api from "@/lib/api";

interface HistoryRow {
  id: number;
  student_cc: number;
  class_id: number | null;
  section_id: number | null;
  campus_id: number | null;
  academic_year: string | null;
  gr_number: string | null;
  change_type: string;
  changed_by: string | null;
  changed_at: string;
  notes: string | null;
  classes: { description: string; class_code: string } | null;
  sections: { description: string } | null;
  campuses: { campus_name: string } | null;
}

const CHANGE_TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  ENROLLED: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
  PROMOTED: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700" },
  TRANSFERRED: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700" },
  REASSIGNED: { bg: "bg-zinc-100 border-zinc-200", text: "text-zinc-700" },
  GRADUATED: { bg: "bg-purple-50 border-purple-200", text: "text-purple-700" },
};

export function AcademicProgressionTab({ cc }: { cc: number }) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get(`/v1/students/${cc}/academic-history`)
      .then((res) => {
        if (!cancelled) setRows(res.data?.data ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [cc]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-400 text-sm font-medium">
        No academic history recorded yet.
      </div>
    );
  }

  const sorted = [...rows].reverse();

  return (
    <div className="px-6 py-5">
      <div className="relative border-l-2 border-zinc-200 ml-3">
        {sorted.map((row, idx) => {
          const prevRow = idx < sorted.length - 1 ? sorted[idx + 1] : null;
          const grChanged = prevRow && row.gr_number !== prevRow.gr_number && row.gr_number;
          const style = CHANGE_TYPE_STYLES[row.change_type] ?? CHANGE_TYPE_STYLES.REASSIGNED;

          return (
            <div key={row.id} className="relative pl-7 pb-6 last:pb-0">
              <div className="absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white bg-zinc-400 shadow-sm" />

              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-bold uppercase tracking-wide ${style.bg} ${style.text}`}>
                  {row.change_type}
                </span>

                {row.classes && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-[11px] font-semibold text-indigo-700">
                    {row.classes.class_code} — {row.classes.description}
                  </span>
                )}

                {row.sections && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-[11px] font-semibold text-sky-700">
                    {row.sections.description}
                  </span>
                )}

                {row.campuses && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-zinc-50 border border-zinc-200 text-[11px] font-semibold text-zinc-600">
                    {row.campuses.campus_name}
                  </span>
                )}

                {row.gr_number && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${grChanged ? "bg-amber-50 border-amber-300 text-amber-800" : "bg-zinc-50 border-zinc-200 text-zinc-600"}`}>
                    GR: {row.gr_number}
                    {grChanged && <span className="text-[9px] font-bold uppercase">changed</span>}
                  </span>
                )}

                {row.academic_year && (
                  <span className="text-[11px] text-zinc-400 font-medium">
                    AY {row.academic_year}
                  </span>
                )}
              </div>

              <div className="mt-1 flex items-center gap-3 text-[11px] text-zinc-400">
                <span>{new Date(row.changed_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                {row.changed_by && <span>by {row.changed_by}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
