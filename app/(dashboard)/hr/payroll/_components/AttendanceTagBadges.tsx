"use client";

import { AlertTriangle, Repeat, UserMinus, UserPlus, Wallet, WifiOff } from "lucide-react";
import { AttendanceLineBase } from "@/lib/hr.service";
import { shortDate, tenureSummary } from "../../_shared/cycle-tenure";

type Tone = "muted" | "notMapped" | "noPunches" | "joined" | "left";

interface Badge {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
  title?: string;
}

interface Props {
  line: Pick<AttendanceLineBase, "has_salary" | "is_mapped" | "has_punches" | "tenure">;
  className?: string;
}

const TONE_CLASSES: Record<Tone, string> = {
  muted: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  // Not mapped to a schedule at all — amber, distinct from the red "no punches" case.
  notMapped: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  // Mapped but nothing recorded — rose, since this is the more actionable/urgent gap.
  noPunches: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  // Mid-cycle joiner / leaver — informational, not a problem to fix.
  joined: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-900",
  left: "bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700",
};

/**
 * "No Salary" is always muted — per product intent, attendance doesn't
 * matter for unpaid profiles, this is just a data-completeness marker.
 * "Not Mapped" / "No Punches" escalate to their own colors specifically when the
 * employee HAS a salary, since missing attendance then directly affects payroll.
 */
export function AttendanceTagBadges({ line, className }: Props) {
  const { has_salary, is_mapped, has_punches, tenure } = line;

  const badges: Badge[] = [];
  // Joined / left inside the cycle first: it explains why the row has fewer
  // counted days, and why the other tags may look the way they do.
  if (tenure) {
    const title = tenureSummary(tenure);
    if (tenure.rejoined) {
      const rejoinedOn = tenure.windows[tenure.windows.length - 1].start;
      badges.push({ label: `Rejoined ${shortDate(rejoinedOn)}`, icon: Repeat, tone: "joined", title });
    } else if (tenure.joined_on) {
      badges.push({ label: `Joined ${shortDate(tenure.joined_on)}`, icon: UserPlus, tone: "joined", title });
    }
    if (tenure.left_on) badges.push({ label: `Left ${shortDate(tenure.left_on)}`, icon: UserMinus, tone: "left", title });
  }
  if (!has_salary) badges.push({ label: "No Salary", icon: Wallet, tone: "muted" });
  if (!is_mapped) badges.push({ label: "Not Mapped", icon: WifiOff, tone: has_salary ? "notMapped" : "muted" });
  else if (!has_punches) badges.push({ label: "No Punches", icon: AlertTriangle, tone: has_salary ? "noPunches" : "muted" });

  if (badges.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className ?? ""}`}>
      {badges.map((b) => (
        <span
          key={b.label}
          title={b.title}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide whitespace-nowrap ${TONE_CLASSES[b.tone]}`}
        >
          <b.icon className="h-2.5 w-2.5 shrink-0" />
          {b.label}
        </span>
      ))}
    </div>
  );
}
