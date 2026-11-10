"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronRight, ExternalLink, X, Loader2, Sandwich, TimerReset } from "lucide-react";
import { hrService, DayBreakdownEntry, PayrollFlag, PayrollRun, PayrollRunLine } from "@/lib/hr.service";
import { usePayrollAccess } from "@/hooks/use-payroll-access";

interface Props {
  run: PayrollRun;
  lines: PayrollRunLine[];
  onDecided: (updated: PayrollRun) => void;
  /** Opens this employee's attendance on the given day. */
  onOpenDay?: (line: PayrollRunLine, date: string) => void;
}

type Decision = "APPLIED" | "EXEMPTED";
type Filter = "ALL" | PayrollFlag["status"];

const FLAG_META: Record<PayrollFlag["flag_type"], { label: string; icon: typeof Sandwich }> = {
  SANDWICH: { label: "Sandwich rule", icon: Sandwich },
  CONSECUTIVE_LATE: { label: "3 consecutive lates", icon: TimerReset },
};

// What a non-worked day was, in words.
const NOT_WORKED_LABEL: Partial<Record<DayBreakdownEntry["classification"], string>> = {
  ABSENT: "Absent",
  UNPAID_LEAVE: "Unpaid leave",
  EXCUSED: "Excused",
  SICK_LEAVE: "Sick leave",
  CASUAL_LEAVE: "Casual leave",
  ANNUAL_LEAVE: "Annual leave",
};

function formatPkr(value: number): string {
  return `Rs ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function dayLabel(d: string, withWeekday = true) {
  const date = new Date(`${d}T00:00:00.000Z`);
  return date.toLocaleDateString("en-GB", {
    ...(withWeekday ? { weekday: "short" } : {}),
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" });
}

function joinDates(dates: string[]) {
  const labels = dates.map((d) => dayLabel(d));
  return labels.length <= 2 ? labels.join(" and ") : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

function offDayLabel(day: DayBreakdownEntry | undefined) {
  if (!day) return "Day off";
  if (day.day_description) return day.day_description;
  if (day.day_type === "WEEKEND" || !day.day_type) return "Weekend";
  return day.day_type.charAt(0) + day.day_type.slice(1).toLowerCase().replace(/_/g, " ");
}

function punchesLabel(day: Pick<DayBreakdownEntry, "punches" | "check_in_at" | "check_out_at">) {
  if (day.punches && day.punches.length > 0) return day.punches.map((p) => timeLabel(p.at)).join(", ");
  if (day.check_in_at) return [day.check_in_at, day.check_out_at].filter(Boolean).map((t) => timeLabel(t!)).join(" – ");
  return "No punches";
}

/** A day the evidence cards can show: one of the cycle's days, or (TAFSD-500) one just outside it. */
type EvidenceDay = Pick<DayBreakdownEntry, "date" | "classification" | "check_in_at" | "check_out_at" | "punches"> & {
  /** Outside this cycle, so it can't be opened here. */
  outside?: "before" | "after";
};

/**
 * The working day before and after a sandwich off-block, from the line's own
 * breakdown. TAFSD-500: a block at the cycle's start or end is judged against
 * the working day just outside the cycle, which the line carries on its first
 * or last day.
 */
function sandwichEvidence(flag: PayrollFlag, breakdown: DayBreakdownEntry[]) {
  const days = [...breakdown].sort((a, b) => a.date.localeCompare(b.date));
  const first = days.findIndex((d) => d.date === flag.dates[0]);
  const last = days.findIndex((d) => d.date === flag.dates[flag.dates.length - 1]);
  if (first < 0 || last < 0) return null;
  let b = first - 1;
  while (b >= 0 && !days[b].is_working_day) b--;
  let a = last + 1;
  while (a < days.length && !days[a].is_working_day) a++;
  const prev = first === 0 ? days[0].prev_working_day : null;
  const next = last === days.length - 1 ? days[days.length - 1].next_working_day : null;
  const before: EvidenceDay | null = b >= 0 ? days[b] : prev ? { ...prev, outside: "before" } : null;
  const after: EvidenceDay | null = a < days.length ? days[a] : next ? { ...next, outside: "after" } : null;
  return { before, off: days.slice(first, last + 1), after };
}

function sandwichSentence(flag: PayrollFlag, ev: NonNullable<ReturnType<typeof sandwichEvidence>>) {
  const b = ev.before ? NOT_WORKED_LABEL[ev.before.classification] ?? "Not worked" : null;
  const a = ev.after ? NOT_WORKED_LABEL[ev.after.classification] ?? "Not worked" : null;
  const off = joinDates(flag.dates);
  const verb = flag.dates.length === 1 ? "is" : "are";
  if (b && a && b === a) {
    return `${b} on ${dayLabel(ev.before!.date)} and ${dayLabel(ev.after!.date)}, so ${off} ${verb} unpaid: ${formatPkr(flag.deduction_amount)}.`;
  }
  if (b && a) {
    return `${b} on ${dayLabel(ev.before!.date)} and ${a.toLowerCase()} on ${dayLabel(ev.after!.date)}, so ${off} ${verb} unpaid: ${formatPkr(flag.deduction_amount)}.`;
  }
  return `Not worked on both sides, so ${off} ${verb} unpaid: ${formatPkr(flag.deduction_amount)}.`;
}

function DayCard({
  day,
  tone,
  title,
  status,
  detail,
  onOpen,
}: {
  day: string;
  tone: "missed" | "off";
  title: string;
  status: string;
  detail: string;
  onOpen?: () => void;
}) {
  const toneClass =
    tone === "missed"
      ? "border-rose-200 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-950/10"
      : "border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/10";
  const statusClass = tone === "missed" ? "text-rose-700 dark:text-rose-400" : "text-amber-700 dark:text-amber-400";
  const body = (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{title}</p>
      <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5">{day}</p>
      <p className={`text-[11px] font-bold uppercase mt-1 ${statusClass}`}>{status}</p>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{detail}</p>
    </>
  );
  return onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      title="Open this day's attendance"
      className={`flex-1 min-w-[8rem] text-left rounded-xl border px-3 py-2 hover:ring-2 hover:ring-primary/30 transition ${toneClass}`}
    >
      {body}
    </button>
  ) : (
    <div className={`flex-1 min-w-[8rem] rounded-xl border px-3 py-2 ${toneClass}`}>{body}</div>
  );
}

function StatusChip({ status }: { status: PayrollFlag["status"] }) {
  const cls =
    status === "APPLIED"
      ? "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400"
      : status === "EXEMPTED"
        ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
        : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${cls}`}>
      {status === "APPLIED" ? "Applied" : status === "EXEMPTED" ? "Exempted" : "Pending"}
    </span>
  );
}

function DecisionButtons({
  status,
  busy,
  onDecide,
  allLabel,
}: {
  status: PayrollFlag["status"] | "MIXED";
  busy: boolean;
  onDecide: (d: Decision) => void;
  allLabel?: boolean;
}) {
  const base = "inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-semibold transition-all disabled:opacity-40";
  return (
    <div className="flex items-center gap-2 shrink-0">
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
      <button
        type="button"
        disabled={busy || status === "EXEMPTED"}
        onClick={() => onDecide("EXEMPTED")}
        className={`${base} border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900`}
      >
        <X className="h-3.5 w-3.5" /> {allLabel ? "Exempt all" : "Exempt"}
      </button>
      <button
        type="button"
        disabled={busy || status === "APPLIED"}
        onClick={() => onDecide("APPLIED")}
        className={`${base} border border-rose-200 dark:border-rose-900/40 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20`}
      >
        <Check className="h-3.5 w-3.5" /> {allLabel ? "Apply all" : "Apply"}
      </button>
    </div>
  );
}

/**
 * TAFSD-477: rule-based deductions to decide, one row per employee. Each flag
 * shows the days that triggered it (from the line's own breakdown) so the
 * reviewer doesn't have to open the employee's attendance to see why.
 */
export function FlagReviewPanel({ run, lines, onDecided, onOpenDay }: Props) {
  const access = usePayrollAccess();
  const canDecide = access.can("flag_review");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A handful of flags open straight away so the reasons are visible; a long list starts collapsed.
  const [open, setOpen] = useState<Set<number>>(() => {
    const withFlags = lines.filter((l) => l.line_status === "PENDING" && (l.payroll_flags ?? []).length > 0);
    const total = withFlags.reduce((n, l) => n + (l.payroll_flags ?? []).length, 0);
    return new Set(total <= 6 ? withFlags.map((l) => l.employee_id) : []);
  });

  // Once an employee's line is finalized, their flag decisions are locked in
  // too — the backend rejects decidePayrollFlag for a finalized line, so
  // don't offer them here.
  const groups = useMemo(
    () =>
      lines
        .filter((line) => line.line_status === "PENDING" && (line.payroll_flags ?? []).length > 0)
        .map((line) => ({
          line,
          flags: [...(line.payroll_flags ?? [])].sort((a, b) => a.anchor_date.localeCompare(b.anchor_date)),
        }))
        .sort((a, b) =>
          (a.line.employee_profiles?.full_name ?? "").localeCompare(b.line.employee_profiles?.full_name ?? ""),
        ),
    [lines],
  );
  const all = groups.flatMap((g) => g.flags);
  const pendingCount = all.filter((f) => f.status === "PENDING").length;
  const [filter, setFilter] = useState<Filter>(pendingCount > 0 ? "PENDING" : "ALL");
  if (groups.length === 0) return null;

  const counts = {
    ALL: all.length,
    PENDING: pendingCount,
    APPLIED: all.filter((f) => f.status === "APPLIED").length,
    EXEMPTED: all.filter((f) => f.status === "EXEMPTED").length,
  };
  const ifAllApplied = all.filter((f) => f.status !== "EXEMPTED").reduce((s, f) => s + Number(f.deduction_amount), 0);
  const visible = groups
    .map((g) => ({ ...g, shown: g.flags.filter((f) => filter === "ALL" || f.status === filter) }))
    .filter((g) => g.shown.length > 0);
  const allOpen = visible.length > 0 && visible.every((g) => open.has(g.line.employee_id));

  const decide = async (employeeId: number, flags: PayrollFlag[], status: Decision, key: string) => {
    const todo = flags.filter((f) => f.status !== status);
    if (todo.length === 0) return;
    setBusyKey(key);
    setError(null);
    try {
      let updated: PayrollRun | null = null;
      for (const f of todo) updated = await hrService.decidePayrollFlag(run.id, employeeId, f.id, status);
      if (updated) onDecided(updated);
    } catch (err) {
      console.error(err);
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message || "Failed to record this decision.");
    } finally {
      setBusyKey(null);
    }
  };

  const toggle = (id: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="bg-white dark:bg-zinc-900/30 border border-amber-200 dark:border-amber-900/40 rounded-3xl overflow-hidden shadow-sm">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4 bg-amber-50/60 dark:bg-amber-950/10 border-b border-amber-100 dark:border-amber-900/30">
        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
        <div className="flex-1 min-w-[14rem]">
          <p className="text-sm font-bold text-amber-900 dark:text-amber-300">Review Flags</p>
          <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
            {pendingCount > 0 ? <span className="font-semibold">{pendingCount} pending</span> : "Nothing pending"}
            {" · "}
            {groups.length} staff · {formatPkr(ifAllApplied)} if all applied. Nothing is deducted until you decide.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-white/70 dark:bg-zinc-900/60 p-1 border border-amber-100 dark:border-amber-900/30">
          {(["PENDING", "APPLIED", "EXEMPTED", "ALL"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold transition ${
                filter === f
                  ? "bg-amber-500 text-white"
                  : "text-amber-800/80 dark:text-amber-300/80 hover:bg-amber-100/60 dark:hover:bg-amber-900/30"
              }`}
            >
              {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()} {counts[f]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setOpen(allOpen ? new Set() : new Set(visible.map((g) => g.line.employee_id)))}
          className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 hover:underline"
        >
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>

      {error && (
        <div className="px-5 py-3 bg-rose-50 border-b border-rose-100 text-rose-700 text-xs dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400">
          {error}
        </div>
      )}

      {visible.length === 0 && (
        <p className="px-5 py-6 text-xs text-zinc-400 text-center">No flags match this filter.</p>
      )}

      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {visible.map(({ line, shown }) => {
          const id = line.employee_id;
          const isOpen = open.has(id);
          const name = line.employee_profiles?.full_name ?? `Employee #${id}`;
          const total = shown.filter((f) => f.status !== "EXEMPTED").reduce((s, f) => s + Number(f.deduction_amount), 0);
          const statuses = new Set(shown.map((f) => f.status));
          const groupStatus = statuses.size === 1 ? [...statuses][0] : "MIXED";
          const pending = shown.filter((f) => f.status === "PENDING").length;
          const groupKey = `g-${id}`;
          return (
            <div key={id}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3">
                <button type="button" onClick={() => toggle(id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                  {isOpen ? <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />}
                  <span className="text-sm font-semibold text-zinc-900 dark:text-white truncate min-w-[6rem]">{name}</span>
                  <span className="text-[11px] font-mono text-zinc-400 whitespace-nowrap hidden md:inline">{line.employee_profiles?.employee_code}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                    {shown.length} flag{shown.length === 1 ? "" : "s"} · {formatPkr(total)}
                    {pending > 0 && pending < shown.length ? ` · ${pending} pending` : ""}
                  </span>
                  {groupStatus !== "MIXED" && groupStatus !== "PENDING" && <StatusChip status={groupStatus} />}
                </button>
                {canDecide && (
                  <DecisionButtons
                    status={groupStatus}
                    busy={busyKey === groupKey}
                    allLabel={shown.length > 1}
                    onDecide={(d) => decide(id, shown, d, groupKey)}
                  />
                )}
              </div>

              {isOpen && (
                <div className="px-5 pb-4 space-y-3">
                  {shown.map((flag) => {
                    const meta = FLAG_META[flag.flag_type];
                    const Icon = meta.icon;
                    const key = `${id}-${flag.id}`;
                    const ev = flag.flag_type === "SANDWICH" ? sandwichEvidence(flag, line.daily_breakdown ?? []) : null;
                    const lateDays =
                      flag.flag_type === "CONSECUTIVE_LATE"
                        ? (line.daily_breakdown ?? []).filter((d) => flag.dates.includes(d.date))
                        : [];
                    const openDay = onOpenDay ? (date: string) => () => onOpenDay(line, date) : undefined;
                    return (
                      <div key={key} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <div className="flex items-center gap-2 flex-wrap flex-1">
                            <Icon className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                              {meta.label} · {flag.dates.map((d) => dayLabel(d)).join(", ")} · {formatPkr(flag.deduction_amount)}
                            </span>
                            <span className="text-[11px] text-zinc-400">
                              ({flag.deduction_days} day{Number(flag.deduction_days) === 1 ? "" : "s"})
                            </span>
                            <StatusChip status={flag.status} />
                          </div>
                          {canDecide && (
                            <DecisionButtons status={flag.status} busy={busyKey === key} onDecide={(d) => decide(id, [flag], d, key)} />
                          )}
                        </div>

                        {ev && (
                          <>
                            <div className="flex flex-wrap gap-2 mt-3">
                              {ev.before && (
                                <DayCard
                                  title={ev.before.outside ? "Working day before (previous cycle)" : "Working day before"}
                                  day={dayLabel(ev.before.date)}
                                  tone="missed"
                                  status={NOT_WORKED_LABEL[ev.before.classification] ?? ev.before.classification}
                                  detail={punchesLabel(ev.before)}
                                  onOpen={ev.before.outside ? undefined : openDay?.(ev.before.date)}
                                />
                              )}
                              <DayCard
                                title={ev.off.length > 1 ? "Days off" : "Day off"}
                                day={ev.off.length > 1 ? `${dayLabel(ev.off[0].date)} – ${dayLabel(ev.off[ev.off.length - 1].date)}` : dayLabel(ev.off[0].date)}
                                tone="off"
                                status={[...new Set(ev.off.map(offDayLabel))].join(" + ")}
                                detail="Would be unpaid"
                              />
                              {ev.after && (
                                <DayCard
                                  title={ev.after.outside ? "Working day after (next cycle)" : "Working day after"}
                                  day={dayLabel(ev.after.date)}
                                  tone="missed"
                                  status={NOT_WORKED_LABEL[ev.after.classification] ?? ev.after.classification}
                                  detail={punchesLabel(ev.after)}
                                  onOpen={ev.after.outside ? undefined : openDay?.(ev.after.date)}
                                />
                              )}
                            </div>
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2">{sandwichSentence(flag, ev)}</p>
                          </>
                        )}

                        {flag.flag_type === "CONSECUTIVE_LATE" && (
                          <>
                            <div className="flex flex-wrap gap-2 mt-3">
                              {lateDays.map((d) => (
                                <DayCard
                                  key={d.date}
                                  title="Late"
                                  day={dayLabel(d.date)}
                                  tone="missed"
                                  status={`${d.late_minutes} min late`}
                                  detail={punchesLabel(d)}
                                  onOpen={openDay?.(d.date)}
                                />
                              ))}
                            </div>
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2">
                              Late {flag.dates.length} working days in a row, so {flag.deduction_days} day{Number(flag.deduction_days) === 1 ? "'s" : "s'"} pay would be deducted: {formatPkr(flag.deduction_amount)}.
                            </p>
                          </>
                        )}

                        {!ev && flag.flag_type === "SANDWICH" && (
                          <p className="text-xs text-zinc-500 mt-2">
                            Not worked on the working day before and after {joinDates(flag.dates)}. Regenerate this line to see the days.
                          </p>
                        )}

                        {onOpenDay && (
                          <button
                            type="button"
                            onClick={() => onOpenDay(line, flag.dates[0])}
                            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                          >
                            View attendance <ExternalLink className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
