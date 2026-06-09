"use client";

import { useEffect, useState } from "react";
import { auditLogsService, AuditLog } from "@/lib/audit-logs.service";
import {
  Ban,
  Clock3,
  FileText,
  Flag,
  GraduationCap,
  TrendingUp,
  UserCheck,
  UserMinus,
  UserPlus2,
  Users,
  Home,
  RefreshCw,
  Coins
} from "lucide-react";

function formatDate(value?: string | null) {
  if (!value) return "Date not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not available";
  return new Intl.DateTimeFormat(undefined, {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

function getIcon(log: AuditLog) {
  const entity = log.entity_type.toUpperCase();
  const action = log.action.toUpperCase();

  if (entity === "VOUCHER") return FileText;
  if (entity === "DEPOSIT") return Coins;
  if (entity === "FAMILY") return Home;
  if (entity === "GUARDIAN") return Users;

  // For Student Status Changes
  if (action === "STATUS_CHANGED") {
    const newVal = (log.new_value || "").toUpperCase();
    if (newVal === "ENROLLED" || newVal === "UNDO_LEFT") return UserCheck;
    if (newVal === "SOFT_ADMISSION") return FileText;
    if (newVal === "EXPELLED") return Ban;
    if (newVal === "UNEXPELLED") return Flag;
    if (newVal === "GRADUATED") return GraduationCap;
    if (newVal === "LEFT") return UserMinus;
  }

  if (action === "CREATED") return UserPlus2;
  if (action === "DELETED") return UserMinus;

  return Clock3;
}

function colorByType(log: AuditLog) {
  const entity = log.entity_type.toUpperCase();
  const action = log.action.toUpperCase();

  if (entity === "VOUCHER") return "text-blue-700 bg-blue-50 border-blue-200";
  if (entity === "DEPOSIT") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (entity === "FAMILY") return "text-purple-700 bg-purple-50 border-purple-200";
  if (entity === "GUARDIAN") return "text-amber-700 bg-amber-50 border-amber-200";

  if (action === "STATUS_CHANGED") {
    const newVal = (log.new_value || "").toUpperCase();
    if (newVal === "ENROLLED" || newVal === "UNDO_LEFT" || newVal === "UNEXPELLED") {
      return "text-emerald-700 bg-emerald-50 border-emerald-200";
    }
    if (newVal === "SOFT_ADMISSION") return "text-blue-700 bg-blue-50 border-blue-200";
    if (newVal === "EXPELLED") return "text-rose-700 bg-rose-50 border-rose-200";
    if (newVal === "LEFT") return "text-orange-700 bg-orange-50 border-orange-200";
    if (newVal === "GRADUATED") return "text-violet-700 bg-violet-50 border-violet-200";
  }

  if (action === "CREATED") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (action === "DELETED") return "text-rose-700 bg-rose-50 border-rose-200";

  return "text-zinc-700 bg-zinc-50 border-zinc-200";
}

function friendlyField(field?: string | null) {
  if (!field) return "";
  return field
    .replace("student.", "")
    .replace("guardian.", "")
    .replace("identity.", "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StudentLogsTab({ studentId }: { studentId: number }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  useEffect(() => {
    let active = true;
    setLoading(true);
    auditLogsService
      .list({ student_id: studentId, limit: LIMIT, offset })
      .then((res) => {
        if (!active) return;
        setLogs(res.data || []);
        setTotal(res.total || 0);
      })
      .catch((err) => {
        console.error("Failed to load audit logs", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [studentId, offset]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="h-5 w-5 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-8 text-center">
        <p className="text-sm font-semibold text-zinc-700">No action logs yet</p>
        <p className="mt-1 text-xs text-zinc-500">
          Student timeline will appear here after updates, status changes, or billing entries are recorded.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {logs.map((log) => {
          const Icon = getIcon(log);
          const colorClass = colorByType(log);

          return (
            <div
              key={log.id}
              className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${colorClass}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-zinc-900">
                      {log.action === "STATUS_CHANGED" ? (
                        <>Status changed to <span className="font-extrabold">{log.new_value}</span></>
                      ) : log.field ? (
                        <>Updated <span className="font-extrabold">{friendlyField(log.field)}</span></>
                      ) : (
                        <>{log.action} {log.entity_type}</>
                      )}
                    </h3>
                    <span className="text-[11px] font-medium text-zinc-400 shrink-0">
                      {formatDate(log.changed_at)}
                    </span>
                  </div>

                  {/* Diff rendering */}
                  {log.old_value || log.new_value ? (
                    log.action !== "STATUS_CHANGED" && (
                      <p className="mt-1.5 text-xs text-zinc-500 font-medium">
                        {log.old_value !== null && log.old_value !== "" ? (
                          <span className="line-through text-rose-400 bg-rose-50/50 px-1 rounded">{log.old_value}</span>
                        ) : (
                          <span className="text-zinc-400 italic">None</span>
                        )}
                        <span className="mx-1 text-zinc-300">→</span>
                        {log.new_value !== null && log.new_value !== "" ? (
                          <span className="text-emerald-600 bg-emerald-50/50 px-1 rounded font-semibold">{log.new_value}</span>
                        ) : (
                          <span className="text-rose-400 bg-rose-50/50 px-1 rounded font-semibold">Removed</span>
                        )}
                      </p>
                    )
                  ) : null}

                  {/* Note */}
                  {log.note ? (
                    <p className="mt-1 text-xs text-zinc-600 italic">“{log.note}”</p>
                  ) : null}

                  {/* Actor info */}
                  <p className="mt-1.5 text-[10px] text-zinc-400">
                    by <span className="font-semibold text-zinc-500">{log.changed_by}</span>
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {total > LIMIT && (
        <div className="flex items-center justify-between pt-2 px-1">
          <button
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
            className="text-xs font-bold text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed hover:underline"
          >
            ← Newer
          </button>
          <span className="text-[11px] font-medium text-zinc-400">
            {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
          </span>
          <button
            disabled={offset + LIMIT >= total}
            onClick={() => setOffset((o) => o + LIMIT)}
            className="text-xs font-bold text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed hover:underline"
          >
            Older →
          </button>
        </div>
      )}
    </div>
  );
}
