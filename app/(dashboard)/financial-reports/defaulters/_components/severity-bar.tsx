"use client";

import { SEVERITY_BANDS, type SeverityBand } from "../../_components/severity";

export type SeverityDistributionRow = {
  band: SeverityBand;
  label: string;
  student_count: number;
  arrears_outstanding: number;
  lps_projected: number;
};

/**
 * Stacked band distribution. Plain CSS flex with percentage widths — the rest of
 * this app has no charting dependency and this does not need one.
 */
export function SeverityBar({ rows }: { rows: SeverityDistributionRow[] }) {
  const total = rows.reduce((a, r) => a + r.student_count, 0);
  if (total === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        {rows.map((row) => {
          const spec = SEVERITY_BANDS.find((b) => b.id === row.band);
          if (!spec || row.student_count === 0) return null;
          return (
            <div
              key={row.band}
              className={spec.bar}
              style={{ width: `${(row.student_count / total) * 100}%` }}
              title={`${spec.label} (${spec.monthsLabel}) — ${row.student_count} students`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
        {rows.map((row) => {
          const spec = SEVERITY_BANDS.find((b) => b.id === row.band);
          if (!spec) return null;
          return (
            <span key={row.band} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${spec.bar}`} />
              {spec.label} · {spec.monthsLabel}
              <span className="font-bold tabular-nums text-zinc-700 dark:text-zinc-200">
                {row.student_count.toLocaleString()}
              </span>
              <span className="tabular-nums">
                ({total ? Math.round((row.student_count / total) * 100) : 0}%)
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
