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
  LEFT: { bg: "bg-orange-50 border-orange-200", text: "text-orange-700" },
  TERMINATED: { bg: "bg-rose-50 border-rose-200", text: "text-rose-700" },
  ACTIVE: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
  PERMANENT: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
  FAMILY: { bg: "bg-sky-50 border-sky-200", text: "text-sky-700" },
};

/** Departure periods stay open until the employee returns — their window is the away gap. */
const DEPARTURE_TYPES = ["LEFT", "TERMINATED"];

const DEPARTURE_VERB: Record<string, string> = {
  LEFT: "Away from employment",
  TERMINATED: "Terminated — not employed",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDuration(from: string, to: string): string {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (ms < 86_400_000) return "less than a day";
  const days = Math.floor(ms / 86_400_000);
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const parts: string[] = [];
  if (years) parts.push(`${years} year${years === 1 ? "" : "s"}`);
  if (months) parts.push(`${months} month${months === 1 ? "" : "s"}`);
  if (!years && !months) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  return parts.join(" ");
}

function formatPay(value: string | null): string {
  if (value == null || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return `Rs ${num.toLocaleString("en-PK")}`;
}

interface GapMarker {
  kind: "gap";
  key: string;
  departureType: string;
  from: string;
  to: string | null;
  reason: string | null;
  outcome: string | null;
}

type Row = ({ kind: "period" } & EmployeeProgressionPeriod) | GapMarker;

function GapRow({ gap }: { gap: GapMarker }) {
  const label = DEPARTURE_VERB[gap.departureType] ?? "Away from employment";
  const window = gap.to
    ? `${formatDate(gap.from)} → ${formatDate(gap.to)} · ${formatDuration(gap.from, gap.to)}`
    : `Away since ${formatDate(gap.from)} · ${formatDuration(gap.from, new Date().toISOString())} and counting`;

  return (
    <tr>
      <td colSpan={11} className="py-2">
        <div className="rounded-lg border border-dashed border-orange-300 bg-orange-50/70 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-orange-700">
              {label}
            </span>
            <span className="text-orange-300">·</span>
            <span className="text-[13px] font-semibold text-orange-800 tabular-nums">
              {window}
            </span>
            {gap.outcome && (
              <span
                className={`ml-auto inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-bold uppercase tracking-wide ${
                  (CHANGE_TYPE_STYLES[gap.outcome] ?? CHANGE_TYPE_STYLES.REASSIGNED).bg
                } ${(CHANGE_TYPE_STYLES[gap.outcome] ?? CHANGE_TYPE_STYLES.REASSIGNED).text}`}
              >
                {gap.outcome.replace(/_/g, " ")}
              </span>
            )}
          </div>
          {gap.reason && (
            <p className="mt-1 text-[12px] text-orange-700/80">{gap.reason}</p>
          )}
        </div>
      </td>
    </tr>
  );
}

function withGapMarkers(newestFirst: EmployeeProgressionPeriod[]): Row[] {
  const chronological = [...newestFirst].sort(
    (a, b) => new Date(a.valid_from).getTime() - new Date(b.valid_from).getTime(),
  );
  const outcomeByDepartureId = new Map<number, string | null>();
  chronological.forEach((period, index) => {
    if (!DEPARTURE_TYPES.includes(period.change_type)) return;
    const next = chronological[index + 1];
    const outcome =
      next && ["ACTIVE", "PERMANENT", "FAMILY", "ONBOARDED"].includes(next.change_type)
        ? next.change_type
        : null;
    outcomeByDepartureId.set(period.id, outcome);
  });

  const rows: Row[] = [];
  for (const period of newestFirst) {
    if (DEPARTURE_TYPES.includes(period.change_type)) {
      rows.push({
        kind: "gap",
        key: `gap-${period.id}`,
        departureType: period.change_type,
        from: period.valid_from,
        to: period.valid_to,
        reason: period.notes,
        outcome: outcomeByDepartureId.get(period.id) ?? null,
      });
    }
    rows.push({ kind: "period", ...period });
  }
  return rows;
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
  const managerName = period.reporting_manager?.full_name ?? null;

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
        {period.notes && (
          <p className="mt-1 text-[11px] text-zinc-400 max-w-[160px]">{period.notes}</p>
        )}
      </td>
      <td className="py-2.5 pr-4 text-[13px] text-zinc-700">
        {period.campuses?.campus_name ?? "—"}
      </td>
      <td className="py-2.5 pr-4 text-[13px] text-zinc-700">
        {period.segments?.name ?? "—"}
      </td>
      <td className="py-2.5 pr-4 text-[13px] text-zinc-700">{deptCategory || "—"}</td>
      <td className="py-2.5 pr-4 text-[13px] text-zinc-700">
        <div>{period.job_title ?? "—"}</div>
        {period.employment_type && (
          <div className="text-[11px] text-zinc-400 mt-0.5">{period.employment_type}</div>
        )}
        {managerName && (
          <div className="text-[11px] text-zinc-400 mt-0.5">Mgr: {managerName}</div>
        )}
      </td>
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
  const rows = withGapMarkers(periods);

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
          {rows.map((row) =>
            row.kind === "gap" ? (
              <GapRow key={row.key} gap={row} />
            ) : (
              <PeriodRow
                key={row.id}
                period={row}
                resolveClass={resolveClass}
                resolveSection={resolveSection}
              />
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
