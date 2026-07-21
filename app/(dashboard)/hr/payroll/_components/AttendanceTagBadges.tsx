"use client";

import { AlertTriangle, Wallet, WifiOff } from "lucide-react";
import { AttendanceLineBase } from "@/lib/hr.service";

type Tone = "muted" | "urgent";

interface Badge {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
}

interface Props {
  line: Pick<AttendanceLineBase, "has_salary" | "is_mapped" | "has_punches">;
  className?: string;
}

/**
 * "No Salary" is always muted — per product intent, attendance doesn't
 * matter for unpaid profiles, this is just a data-completeness marker.
 * "Not Mapped" / "No Punches" escalate to urgent (red) specifically when the
 * employee HAS a salary, since missing attendance then directly affects payroll.
 */
export function AttendanceTagBadges({ line, className }: Props) {
  const { has_salary, is_mapped, has_punches } = line;
  const urgent: Tone = has_salary ? "urgent" : "muted";

  const badges: Badge[] = [];
  if (!has_salary) badges.push({ label: "No Salary", icon: Wallet, tone: "muted" });
  if (!is_mapped) badges.push({ label: "Not Mapped", icon: WifiOff, tone: urgent });
  else if (!has_punches) badges.push({ label: "No Punches", icon: AlertTriangle, tone: urgent });

  if (badges.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className ?? ""}`}>
      {badges.map((b) => (
        <span
          key={b.label}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide whitespace-nowrap ${
            b.tone === "urgent"
              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
              : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          }`}
        >
          <b.icon className="h-2.5 w-2.5 shrink-0" />
          {b.label}
        </span>
      ))}
    </div>
  );
}
