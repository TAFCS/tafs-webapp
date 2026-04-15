"use client";

import { Clock3, Flag, GraduationCap, TrendingUp, UserPlus2 } from "lucide-react";

type ActionLog = {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  occurred_at?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "Date not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not available";
  return date.toLocaleString();
}

function iconByType(type: string) {
  const normalized = type.toUpperCase();
  if (normalized === "ADMISSION" || normalized === "PROFILE_CREATED") return UserPlus2;
  if (normalized === "PROMOTION") return TrendingUp;
  if (normalized === "EXPELLED" || normalized === "UNEXPELLED") return Flag;
  if (normalized === "GRADUATED") return GraduationCap;
  return Clock3;
}

function colorByType(type: string) {
  const normalized = type.toUpperCase();
  if (normalized === "EXPELLED") return "text-rose-700 bg-rose-50 border-rose-200";
  if (normalized === "UNEXPELLED") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (normalized === "PROMOTION") return "text-blue-700 bg-blue-50 border-blue-200";
  if (normalized === "GRADUATED") return "text-violet-700 bg-violet-50 border-violet-200";
  return "text-zinc-700 bg-zinc-50 border-zinc-200";
}

export function StudentLogsTab({ student }: { student: any }) {
  const logs: ActionLog[] = Array.isArray(student?.action_logs)
    ? student.action_logs
    : [];

  if (logs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-8 text-center">
        <p className="text-sm font-semibold text-zinc-700">No action logs yet</p>
        <p className="mt-1 text-xs text-zinc-500">
          Student timeline will appear here after actions like promotion, expulsion, graduation, and updates.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => {
        const Icon = iconByType(log.type);
        const color = colorByType(log.type);

        return (
          <div
            key={log.id}
            className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl border ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-zinc-900">{log.title}</h3>
                  <span className="text-[11px] font-medium text-zinc-500">
                    {formatDate(log.occurred_at)}
                  </span>
                </div>
                {log.description ? (
                  <p className="mt-1 text-xs text-zinc-600">{log.description}</p>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
