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

interface HouseRef {
  id: number;
  house_name: string | null;
  house_color: string | null;
}

interface HouseHistoryRow {
  id: number;
  from_house: HouseRef | null;
  to_house: HouseRef | null;
  changed_by: string | null;
  changed_at: string;
  note: string | null;
}

type AcademicEvent = { kind: "academic"; changed_at: string; row: HistoryRow };
type HouseEvent = { kind: "house"; changed_at: string; row: HouseHistoryRow };
type SessionEvent = AcademicEvent | HouseEvent;

interface Session {
  academic_year: string;
  events: SessionEvent[];
}

const CHANGE_TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  ENROLLED: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
  PROMOTED: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700" },
  TRANSFERRED: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700" },
  REASSIGNED: { bg: "bg-zinc-100 border-zinc-200", text: "text-zinc-700" },
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

/** Groups academic-history and house-history events into per-academic-year
 * sessions, ordered newest session first, with events ascending within each. */
function buildSessions(academicRows: HistoryRow[], houseRows: HouseHistoryRow[]): Session[] {
  const academicEvents: AcademicEvent[] = academicRows.map((row) => ({
    kind: "academic",
    changed_at: row.changed_at,
    row,
  }));
  const academicAsc = [...academicEvents].sort(
    (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime(),
  );

  const yearForTimestamp = (isoTime: string): string => {
    const t = new Date(isoTime).getTime();
    let year: string | null = null;
    for (const event of academicAsc) {
      if (new Date(event.changed_at).getTime() <= t) {
        year = event.row.academic_year;
      } else {
        break;
      }
    }
    return year ?? academicAsc[0]?.row.academic_year ?? "Unknown";
  };

  const houseEvents: SessionEvent[] = houseRows.map((row) => ({
    kind: "house",
    changed_at: row.changed_at,
    row,
  }));

  const grouped = new Map<string, SessionEvent[]>();
  for (const event of [...academicEvents, ...houseEvents]) {
    const year =
      event.kind === "academic" ? event.row.academic_year ?? "Unknown" : yearForTimestamp(event.changed_at);
    if (!grouped.has(year)) grouped.set(year, []);
    grouped.get(year)!.push(event);
  }

  const sessions: Session[] = Array.from(grouped.entries()).map(([academic_year, events]) => ({
    academic_year,
    events: [...events].sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()),
  }));

  sessions.sort((a, b) => {
    const aTime = new Date(a.events[0].changed_at).getTime();
    const bTime = new Date(b.events[0].changed_at).getTime();
    return bTime - aTime;
  });

  return sessions;
}

function AcademicEventRow({ row, prevRow }: { row: HistoryRow; prevRow: HistoryRow | null }) {
  const grChanged = prevRow && row.gr_number !== prevRow.gr_number && row.gr_number;
  const style = CHANGE_TYPE_STYLES[row.change_type] ?? CHANGE_TYPE_STYLES.REASSIGNED;

  return (
    <div className="relative pl-7 pb-4 last:pb-0">
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
      </div>
      <div className="mt-1 flex items-center gap-3 text-[11px] text-zinc-400">
        <span>{new Date(row.changed_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
        {row.changed_by && <span>by {row.changed_by}</span>}
      </div>
    </div>
  );
}

function HouseEventRow({ row }: { row: HouseHistoryRow }) {
  return (
    <div className="relative pl-7 pb-4 last:pb-0">
      <div className="absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white bg-zinc-400 shadow-sm" />
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-zinc-700">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-bold uppercase tracking-wide bg-violet-50 border-violet-200 text-violet-700">
          HOUSE
        </span>
        {row.from_house ? (
          <span className="inline-flex items-center gap-1.5">
            <HouseDot house={row.from_house} />
            {row.from_house.house_name || `#${row.from_house.id}`}
            <span className="text-zinc-300">→</span>
            <HouseDot house={row.to_house} />
            {row.to_house?.house_name || (row.to_house ? `#${row.to_house.id}` : "Unassigned")}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            Assigned
            <HouseDot house={row.to_house} />
            {row.to_house?.house_name || "Unassigned"}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center gap-3 text-[11px] text-zinc-400">
        <span>{new Date(row.changed_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
        {row.changed_by && <span>by {row.changed_by}</span>}
      </div>
    </div>
  );
}

export function AcademicProgressionTab({ cc }: { cc: number }) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [houseRows, setHouseRows] = useState<HouseHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.get(`/v1/students/${cc}/academic-history`).catch(() => null),
      api.get(`/v1/students/${cc}/house-history`).catch(() => null),
    ]).then(([academicRes, houseRes]) => {
      if (cancelled) return;
      setRows(academicRes?.data?.data ?? []);
      setHouseRows(houseRes?.data?.data ?? []);
      setLoading(false);
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

  const sessions = buildSessions(rows, houseRows);
  const academicAsc = [...rows].sort(
    (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime(),
  );

  return (
    <div className="px-6 py-5 space-y-6">
      {sessions.map((session) => (
        <div key={session.academic_year} className="rounded-lg border border-zinc-200 overflow-hidden">
          <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-200 text-[12px] font-bold uppercase tracking-wide text-zinc-500">
            AY {session.academic_year}
          </div>
          <div className="px-4 py-4">
            <div className="relative border-l-2 border-zinc-200 ml-3">
              {session.events.map((event) => {
                if (event.kind === "house") {
                  return <HouseEventRow key={`house-${event.row.id}`} row={event.row} />;
                }
                const idx = academicAsc.findIndex((r) => r.id === event.row.id);
                const prevRow = idx > 0 ? academicAsc[idx - 1] : null;
                return <AcademicEventRow key={`academic-${event.row.id}`} row={event.row} prevRow={prevRow} />;
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
