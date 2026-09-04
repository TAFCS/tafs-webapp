"use client";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { hrService, EmployeeProgressionPeriod } from "@/lib/hr.service";
import { useClassAssignmentLookups } from "./EmployeeClassAssignmentsEditor";

const CHANGE_TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  ONBOARDED: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
  REASSIGNED: { bg: "bg-zinc-100 border-zinc-200", text: "text-zinc-700" },
  TRANSFERRED: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700" },
  SEGMENT_CHANGED: { bg: "bg-violet-50 border-violet-200", text: "text-violet-700" },
  PAY_CHANGED: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700" },
  STATUS_CHANGED: { bg: "bg-rose-50 border-rose-200", text: "text-rose-700" },
  CLASS_REASSIGNED: { bg: "bg-indigo-50 border-indigo-200", text: "text-indigo-700" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPay(value: string | null): string {
  if (value == null || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return `Rs ${num.toLocaleString("en-PK")}`;
}

function PeriodRow({
  period,
  resolveClass,
  resolveSection,
}: {
  period: EmployeeProgressionPeriod;
  resolveClass: (id: number) => string;
  resolveSection: (id: number) => string;
}) {
  const style = CHANGE_TYPE_STYLES[period.change_type] ?? CHANGE_TYPE_STYLES.REASSIGNED;
  const isOpen = period.valid_to == null;
  const dateRange = isOpen
    ? `${formatDate(period.valid_from)} → Present`
    : `${formatDate(period.valid_from)} → ${formatDate(period.valid_to!)}`;

  const deptCategory = [period.departments?.name, period.staff_categories?.name]
    .filter(Boolean)
    .join(" · ");

  const classes = period.class_sections ?? [];

  return (
    <tr className="border-b border-zinc-100 last:border-0 align-top">
      <td className="py-2.5 pr-4 text-[13px] font-semibold text-zinc-800 tabular-nums whitespace-nowrap">
        {dateRange}
      </td>
      <td className="py-2.5 pr-4">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-bold uppercase tracking-wide whitespace-nowrap ${style.bg} ${style.text}`}
        >
          {period.change_type.replace(/_/g, " ")}
        </span>
      </td>
      <td className="py-2.5 pr-4 text-[13px] text-zinc-700">
        {period.campuses?.campus_name ?? "—"}
      </td>
      <td className="py-2.5 pr-4 text-[13px] text-zinc-700">
        {period.segments?.name ?? "—"}
      </td>
      <td className="py-2.5 pr-4 text-[13px] text-zinc-700">{deptCategory || "—"}</td>
      <td className="py-2.5 pr-4 text-[13px] text-zinc-700">{period.job_title ?? "—"}</td>
      <td className="py-2.5 pr-4 text-[13px] text-zinc-700 tabular-nums whitespace-nowrap">
        {formatPay(period.monthly_pay)}
        {period.payroll_enabled === false && (
          <span className="ml-1 text-[11px] text-zinc-400">(off payroll)</span>
        )}
      </td>
      <td className="py-2.5 pr-4 text-[13px] text-zinc-700">{period.employment_status}</td>
      <td className="py-2.5 pr-4 text-[12px] text-zinc-600">
        {classes.length === 0 ? (
          "—"
        ) : (
          <span className="flex flex-col gap-0.5">
            {classes.map((cs, i) => (
              <span key={i} className="whitespace-nowrap">
                {resolveClass(cs.class_id)}
                {cs.section_id != null ? ` – ${resolveSection(cs.section_id)}` : ""}
              </span>
            ))}
          </span>
        )}
      </td>
      <td className="py-2.5 text-[12px] text-zinc-400">{period.changed_by || "—"}</td>
    </tr>
  );
}

export function EmployeeProgressionTab({ id }: { id: number }) {
  const [periods, setPeriods] = useState<EmployeeProgressionPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const { allClasses, allSections } = useClassAssignmentLookups();

  const classNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of allClasses) map.set(c.id, c.description);
    return map;
  }, [allClasses]);

  const sectionNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const s of allSections) map.set(s.id, s.description);
    return map;
  }, [allSections]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    hrService
      .listEmployeeProgression(id)
      .then((rows) => {
        if (cancelled) return;
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
  }, [id]);

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

  const resolveClass = (cid: number) => classNameById.get(cid) ?? `Class #${cid}`;
  const resolveSection = (sid: number) => sectionNameById.get(sid) ?? `Section #${sid}`;

  return (
    <div className="px-6 py-5 overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse">
        <thead>
          <tr className="border-b border-zinc-200 text-left">
            {[
              "Period",
              "Change",
              "Campus",
              "Segment",
              "Dept / Category",
              "Job Title",
              "Monthly Pay",
              "Status",
              "Classes",
              "Changed By",
            ].map((h) => (
              <th
                key={h}
                className="py-2 pr-4 text-[11px] font-bold uppercase tracking-wide text-zinc-400"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((period) => (
            <PeriodRow
              key={period.id}
              period={period}
              resolveClass={resolveClass}
              resolveSection={resolveSection}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
