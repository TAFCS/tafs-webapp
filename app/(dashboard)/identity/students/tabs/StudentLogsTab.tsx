"use client";

import { useEffect, useMemo, useState } from "react";
import { auditLogsService, AuditLog } from "@/lib/audit-logs.service";
import api from "@/lib/api";
import {
  Ban,
  Clock3,
  FileText,
  Flag,
  GraduationCap,
  UserCheck,
  UserMinus,
  UserPlus2,
  Users,
  Home,
  RefreshCw,
  ArrowLeftRight,
} from "lucide-react";

type HouseInfo = {
  id: number;
  house_name: string | null;
  house_color: string | null;
};

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

  if (entity === "TRANSFER") return ArrowLeftRight;
  if (entity === "FAMILY") return Home;
  if (entity === "GUARDIAN") return Users;

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

  if (entity === "TRANSFER") return "text-teal-700 bg-teal-50 border-teal-200";
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
  if (field === "student.house_id" || field === "house_id") return "House";
  return field
    .replace("student.", "")
    .replace("guardian.", "")
    .replace("identity.", "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isHouseField(field?: string | null) {
  return field === "student.house_id" || field === "house_id";
}

function HouseChip({
  house,
  fallbackId,
  tone,
}: {
  house: HouseInfo | null | undefined;
  fallbackId?: string | null;
  tone: "old" | "new" | "none";
}) {
  const toneClass =
    tone === "old"
      ? "line-through text-rose-500 bg-rose-50/50"
      : tone === "new"
        ? "text-emerald-700 bg-emerald-50/50 font-semibold"
        : "text-zinc-500 bg-zinc-50";

  if (!house && (fallbackId == null || fallbackId === "")) {
    return <span className="text-zinc-400 italic">None</span>;
  }

  const label = house?.house_name || (fallbackId ? `House #${fallbackId}` : "House");
  return (
    <span className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 ${toneClass}`}>
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: house?.house_color || "#94a3b8" }}
      />
      {label}
    </span>
  );
}

export function StudentLogsTab({ studentId }: { studentId: number }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [housesById, setHousesById] = useState<Map<number, HouseInfo>>(new Map());
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      auditLogsService.list({
        student_id: studentId,
        entity_type: "STUDENT,GUARDIAN,FAMILY,TRANSFER",
        limit: LIMIT,
        offset,
      }),
      api.get(`/v1/students/${studentId}/house-history`).catch(() => null),
      api.get(`/v1/enrollments/${studentId}/suggestions`).catch(() => null),
    ])
      .then(([res, houseHistoryRes, suggestionsRes]) => {
        if (!active) return;
        setLogs(res.data || []);
        setTotal(res.total || 0);

        const map = new Map<number, HouseInfo>();
        const historyRows = houseHistoryRes?.data?.data ?? [];
        for (const row of historyRows) {
          if (row?.from_house?.id != null) map.set(row.from_house.id, row.from_house);
          if (row?.to_house?.id != null) map.set(row.to_house.id, row.to_house);
        }
        const allHouses = suggestionsRes?.data?.data?.all_houses ?? [];
        for (const house of allHouses) {
          if (house?.id != null) {
            map.set(house.id, {
              id: house.id,
              house_name: house.house_name ?? null,
              house_color: house.house_color ?? null,
            });
          }
        }
        setHousesById(map);
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

  const resolveHouse = useMemo(
    () => (raw?: string | null) => {
      if (raw == null || raw === "") return null;
      const id = Number(raw);
      if (!Number.isFinite(id)) return null;
      return housesById.get(id) ?? null;
    },
    [housesById],
  );

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
          const houseChange = isHouseField(log.field);

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
                        {houseChange ? (
                          <>
                            <HouseChip
                              house={resolveHouse(log.old_value)}
                              fallbackId={log.old_value}
                              tone={log.old_value ? "old" : "none"}
                            />
                            <span className="mx-1 text-zinc-300">→</span>
                            {log.new_value ? (
                              <HouseChip
                                house={resolveHouse(log.new_value)}
                                fallbackId={log.new_value}
                                tone="new"
                              />
                            ) : (
                              <span className="text-rose-400 bg-rose-50/50 px-1 rounded font-semibold">
                                Removed
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            {log.old_value !== null && log.old_value !== "" ? (
                              <span className="line-through text-rose-400 bg-rose-50/50 px-1 rounded">
                                {log.old_value}
                              </span>
                            ) : (
                              <span className="text-zinc-400 italic">None</span>
                            )}
                            <span className="mx-1 text-zinc-300">→</span>
                            {log.new_value !== null && log.new_value !== "" ? (
                              <span className="text-emerald-600 bg-emerald-50/50 px-1 rounded font-semibold">
                                {log.new_value}
                              </span>
                            ) : (
                              <span className="text-rose-400 bg-rose-50/50 px-1 rounded font-semibold">
                                Removed
                              </span>
                            )}
                          </>
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
