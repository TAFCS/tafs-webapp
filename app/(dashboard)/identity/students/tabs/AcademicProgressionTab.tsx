"use client";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import api from "@/lib/api";

interface HouseRef {
  house_name: string | null;
  house_color: string | null;
}

interface ProgressionPeriod {
  id: number;
  student_cc: number;
  campus_id: number | null;
  class_id: number | null;
  section_id: number | null;
  house_id: number | null;
  academic_year: string | null;
  gr_number: string | null;
  change_type: string;
  changed_by: string | null;
  notes: string | null;
  valid_from: string;
  valid_to: string | null;
  classes: { description: string; class_code: string } | null;
  sections: { description: string } | null;
  campuses: { campus_name: string } | null;
  houses: HouseRef | null;
}

const CHANGE_TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  ENROLLED: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
  PROMOTED: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700" },
  TRANSFERRED: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700" },
  REASSIGNED: { bg: "bg-zinc-100 border-zinc-200", text: "text-zinc-700" },
  HOUSE_CHANGED: { bg: "bg-violet-50 border-violet-200", text: "text-violet-700" },
  GRADUATED: { bg: "bg-purple-50 border-purple-200", text: "text-purple-700" },
};

function HouseDot({ house }: { house: HouseRef | null }) {
  if (!house) return null;
  return (
    <span
      className="inline-block h-2 w-2 rounded-full shrink-0"
      style={{ backgroundColor: house.house_color || "#94a3b8" }}
    />
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function PeriodRow({ period }: { period: ProgressionPeriod }) {
  const style = CHANGE_TYPE_STYLES[period.change_type] ?? CHANGE_TYPE_STYLES.REASSIGNED;
  const isOpen = period.valid_to == null;
  const dateRange = isOpen
    ? `${formatDate(period.valid_from)} → Present`
    : `${formatDate(period.valid_from)} → ${formatDate(period.valid_to!)}`;

  return (
    <div className="relative pl-7 pb-5 last:pb-0">
      <div
        className={`absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm ${
          isOpen ? "bg-emerald-500" : "bg-zinc-400"
        }`}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-[13px] font-semibold text-zinc-800 tabular-nums">
          {dateRange}
        </span>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-bold uppercase tracking-wide ${style.bg} ${style.text}`}
        >
          {period.change_type.replace(/_/g, " ")}
        </span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-zinc-700">
        {period.classes && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-[11px] font-semibold text-indigo-700">
            {period.classes.class_code} — {period.classes.description}
          </span>
        )}
        {period.sections && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-[11px] font-semibold text-sky-700">
            {period.sections.description}
          </span>
        )}
        {period.houses && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-violet-50 border border-violet-200 text-[11px] font-semibold text-violet-700">
            <HouseDot house={period.houses} />
            {period.houses.house_name || "House"}
          </span>
        )}
        {period.campuses && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-zinc-50 border border-zinc-200 text-[11px] font-semibold text-zinc-600">
            {period.campuses.campus_name}
          </span>
        )}
        {!period.classes && !period.sections && !period.houses && (
          <span className="text-[12px] text-zinc-400 italic">No placement details</span>
        )}
      </div>

      {period.changed_by && (
        <div className="mt-1 text-[11px] text-zinc-400">
          Moved by {period.changed_by}
        </div>
      )}
    </div>
  );
}

export function AcademicProgressionTab({ cc }: { cc: number }) {
  const [periods, setPeriods] = useState<ProgressionPeriod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get(`/v1/students/${cc}/progression`)
      .then((res) => {
        if (cancelled) return;
        const rows: ProgressionPeriod[] = res?.data?.data ?? [];
        // Newest first; open ("Present") period pinned at top
        const sorted = [...rows].sort((a, b) => {
          if (a.valid_to == null && b.valid_to != null) return -1;
          if (a.valid_to != null && b.valid_to == null) return 1;
          return new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime();
        });
        setPeriods(sorted);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPeriods([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cc]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (periods.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-400 text-sm font-medium">
        No progression history recorded yet.
      </div>
    );
  }

  return (
    <div className="px-6 py-5">
      <div className="relative border-l-2 border-zinc-200 ml-3">
        {periods.map((period) => (
          <PeriodRow key={period.id} period={period} />
        ))}
      </div>
    </div>
  );
}
