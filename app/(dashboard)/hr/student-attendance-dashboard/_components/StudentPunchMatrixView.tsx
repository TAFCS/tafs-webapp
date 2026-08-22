"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { StudentAttendanceLine, StudentDayBreakdownEntry, StudentDayClassification } from "@/lib/attendance.service";
import { MatrixPager } from "../../_shared/MatrixPager";
import {
  DAY_LABELS,
  DEFAULT_MATRIX_PAGE_SIZE,
  extractPunches,
  generateDates,
} from "../../_shared/punch-matrix-utils";

// ── Cell styles by classification ─────────────────────────────────────────────

const CELL_BG: Record<StudentDayClassification, string> = {
  PRESENT:    "bg-white dark:bg-zinc-950",
  LATE:       "bg-amber-50 dark:bg-amber-950/20",
  ABSENT:     "bg-rose-50 dark:bg-rose-950/20",
  EXCUSED:    "bg-sky-50 dark:bg-sky-950/20",
  UNRESOLVED: "bg-amber-100 dark:bg-amber-900/30",
  DAY_OFF:    "bg-zinc-50 dark:bg-zinc-900/30",
};

const CELL_DOT: Record<StudentDayClassification, string> = {
  PRESENT:    "bg-emerald-500",
  LATE:       "bg-amber-500",
  ABSENT:     "bg-rose-500",
  EXCUSED:    "bg-sky-400",
  UNRESOLVED: "bg-amber-500 animate-pulse",
  DAY_OFF:    "bg-zinc-300 dark:bg-zinc-600",
};

const CELL_TEXT: Record<StudentDayClassification, string> = {
  PRESENT:    "text-zinc-700 dark:text-zinc-200",
  LATE:       "text-amber-700 dark:text-amber-400",
  ABSENT:     "text-rose-600 dark:text-rose-400",
  EXCUSED:    "text-sky-700 dark:text-sky-400",
  UNRESOLVED: "text-amber-800 dark:text-amber-300",
  DAY_OFF:    "text-zinc-400 dark:text-zinc-600",
};

// ── Row ───────────────────────────────────────────────────────────────────────

interface RowProps {
  line: StudentAttendanceLine;
  dates: string[];
  onOpenLine: (line: StudentAttendanceLine, date: string) => void;
}

/**
 * Memoized so a parent state change (typing in the search box) doesn't
 * re-render every cell of every row. `dates` and `onOpenLine` are kept
 * referentially stable by the parent for this to bite.
 */
const MatrixRow = memo(function MatrixRow({ line, dates, onOpenLine }: RowProps) {
  const stu = line.student;
  const name = stu.full_name ?? `Student #${line.student_cc}`;
  const code = stu.gr_number ?? "—";

  const dayMap = useMemo(
    () => new Map<string, StudentDayBreakdownEntry>(line.daily_breakdown.map((d) => [d.date, d])),
    [line.daily_breakdown],
  );

  return (
    <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20">
      {/* Sticky student name */}
      <td className="sticky left-0 z-10 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 px-4 py-2">
        <div>
          <p className="font-semibold text-zinc-800 dark:text-zinc-100 leading-tight truncate max-w-[170px]">{name}</p>
          <p className="text-zinc-400 font-mono text-[10px]">
            {code}
            {(stu.class || stu.section) && (
              <span className="ml-1 text-zinc-300 dark:text-zinc-700">
                · {[stu.class, stu.section].filter(Boolean).join(" ")}
              </span>
            )}
            {line.campus_name && <span className="ml-1 text-zinc-300 dark:text-zinc-700">· {line.campus_name}</span>}
          </p>
        </div>
      </td>

      {dates.map((d) => {
        const day = dayMap.get(d);
        if (!day) {
          return (
            <td key={d} className="border-r border-zinc-100 dark:border-zinc-800/50 text-center p-0.5">
              <div className="h-12 rounded flex items-center justify-center text-zinc-300 dark:text-zinc-700 text-[10px]">
                —
              </div>
            </td>
          );
        }

        const cls = day.classification;
        const isOff = cls === "DAY_OFF" || !day.is_working_day;
        const punches = extractPunches(day);
        // A holiday/weekend the student still scanned on — surface it instead
        // of hiding it, so the day can be opened and overridden.
        const cameOnOff = isOff && punches.length > 0;

        const punchList = punches.length > 0 && (
          <div className="flex flex-col items-center gap-px w-full px-1">
            {punches.map((p, i) => (
              <div
                key={i}
                className={`flex items-center gap-0.5 text-[10px] font-mono leading-none ${
                  p.missing
                    ? "text-amber-600 dark:text-amber-400 font-bold"
                    : i % 2 === 0
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                <span className="text-[8px] opacity-60">{i % 2 === 0 ? "▲" : "▼"}</span>
                {p.time}
              </div>
            ))}
          </div>
        );

        return (
          <td
            key={d}
            className="border-r border-zinc-100 dark:border-zinc-800/50 p-0.5 cursor-pointer"
            onClick={() => onOpenLine(line, d)}
          >
            <div
              className={`rounded min-h-12 flex flex-col items-center justify-center gap-0.5 py-1 px-1 ${
                cameOnOff
                  ? "bg-amber-50 dark:bg-amber-950/20 ring-1 ring-inset ring-amber-300 dark:ring-amber-700"
                  : CELL_BG[cls]
              }`}
            >
              {/* Status dot */}
              <div className={`w-1.5 h-1.5 rounded-full mb-0.5 ${cameOnOff ? "bg-amber-500 animate-pulse" : CELL_DOT[cls]}`} />

              {cameOnOff ? (
                <>
                  <span className="text-[8px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400 flex items-center gap-0.5">
                    <AlertTriangle className="h-2 w-2" />
                    {day.day_description ?? "Off"}
                  </span>
                  {punchList}
                </>
              ) : isOff ? (
                <span className={`text-[9px] font-medium uppercase tracking-wide ${CELL_TEXT[cls]}`}>
                  {day.day_description ?? "Off"}
                </span>
              ) : cls === "ABSENT" ? (
                <span className={`text-[10px] font-semibold ${CELL_TEXT[cls]}`}>Absent</span>
              ) : cls === "EXCUSED" ? (
                <span className={`text-[9px] font-semibold text-center leading-tight ${CELL_TEXT[cls]}`}>
                  Excused
                </span>
              ) : punches.length === 0 ? (
                <span className="text-[9px] text-zinc-300 dark:text-zinc-700">No data</span>
              ) : (
                punchList
              )}
            </div>
          </td>
        );
      })}
    </tr>
  );
});

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  periodStart: string;
  periodEnd: string;
  lines: StudentAttendanceLine[];
  onOpenLine: (line: StudentAttendanceLine, date: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StudentPunchMatrixView({ periodStart, periodEnd, lines, onOpenLine }: Props) {
  const dates = useMemo(() => generateDates(periodStart, periodEnd), [periodStart, periodEnd]);

  const [pageSize, setPageSize] = useState(DEFAULT_MATRIX_PAGE_SIZE);

  // The current page is stored against the result set it belongs to, so
  // filtering upstream implicitly falls back to page 1 without an effect.
  const total = lines.length;
  const pagerKey = `${total}|${pageSize}`;
  const [pager, setPager] = useState({ key: pagerKey, page: 1 });
  const page = pager.key === pagerKey ? pager.page : 1;
  const setPage = useCallback((p: number) => setPager({ key: pagerKey, page: p }), [pagerKey]);

  const pageLines = useMemo(
    () => lines.slice((page - 1) * pageSize, page * pageSize),
    [lines, page, pageSize],
  );

  // Counted over every line, not just the visible page.
  const totalUnresolved = useMemo(() => lines.reduce((s, l) => s + l.unresolved_days, 0), [lines]);

  // Callers pass an inline arrow, so hold it in a ref and give the memoized
  // rows one identity that never changes.
  const openLineRef = useRef(onOpenLine);
  useEffect(() => { openLineRef.current = onOpenLine; }, [onOpenLine]);
  const handleOpenLine = useCallback(
    (line: StudentAttendanceLine, date: string) => openLineRef.current(line, date),
    [],
  );

  return (
    <div className="space-y-4">
      {totalUnresolved > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 text-amber-800 dark:text-amber-400 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>{totalUnresolved}</strong> unresolved day(s) — click a cell to open the student timeline and resolve.
          </span>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950 shadow-sm">
        <div className="overflow-auto max-h-[calc(100vh-220px)]">
          <table className="border-collapse text-xs" style={{ minWidth: `${200 + dates.length * 88}px` }}>
            <thead className="sticky top-0 z-30">
              <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                {/* Sticky student column header — double-sticky: top via thead, left via own position */}
                <th className="sticky left-0 z-20 bg-zinc-50 dark:bg-zinc-900 px-4 py-2.5 text-left font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-r border-zinc-200 dark:border-zinc-800 min-w-[200px]">
                  Student
                </th>
                {dates.map((d) => {
                  const dt = new Date(`${d}T00:00:00Z`);
                  const isWeekend = dt.getUTCDay() === 0 || dt.getUTCDay() === 5 || dt.getUTCDay() === 6;
                  return (
                    <th
                      key={d}
                      className={`px-1 py-2 text-center font-semibold tracking-wide w-[88px] min-w-[88px] border-r border-zinc-100 dark:border-zinc-800/50 ${
                        isWeekend ? "text-rose-400 dark:text-rose-500" : "text-zinc-500 dark:text-zinc-400"
                      }`}
                    >
                      <div className="text-[10px] leading-none">{DAY_LABELS[dt.getUTCDay()]}</div>
                      <div className="text-sm font-black mt-0.5 text-zinc-700 dark:text-zinc-200">{dt.getUTCDate()}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {pageLines.map((line) => (
                <MatrixRow key={line.student_cc} line={line} dates={dates} onOpenLine={handleOpenLine} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <MatrixPager
        page={page}
        pageSize={pageSize}
        total={total}
        noun="students"
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      {/* Legend */}
      <div className="flex flex-wrap gap-4 px-1">
        {(
          [
            ["PRESENT", "Present"],
            ["LATE", "Late"],
            ["ABSENT", "Absent"],
            ["EXCUSED", "Excused"],
            ["UNRESOLVED", "Unresolved"],
            ["DAY_OFF", "Day Off"],
          ] as [StudentDayClassification, string][]
        ).map(([cls, label]) => (
          <div key={cls} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${CELL_DOT[cls]}`} />
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
