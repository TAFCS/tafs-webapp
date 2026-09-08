"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle, Building2, CheckCircle2, ClipboardList, Filter, Loader2, User, X,
} from "lucide-react";
import { useAuthState } from "@/context/AuthContext";
import { campusesService, Campus } from "@/lib/campuses.service";
import {
  attendanceObjectionsService,
  AttendanceObjection,
  AttendanceObjectionStatus,
} from "@/lib/attendance-objections.service";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { toggleId, serializeIds } from "@/components/filters/filter-params";

const STATUS_OPTIONS: { id: AttendanceObjectionStatus; label: string }[] = [
  { id: "PENDING", label: "Pending" },
  { id: "ACCEPTED", label: "Accepted" },
  { id: "REJECTED", label: "Rejected" },
];

function formatDate(iso: string) {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AttendanceObjectionsPage() {
  const { user } = useAuthState();
  const [statusFilter, setStatusFilter] = useState<AttendanceObjectionStatus[]>(["PENDING"]);
  const [items, setItems] = useState<AttendanceObjection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selected, setSelected] = useState<AttendanceObjection | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusIds, setCampusIds] = useState<number[]>(
    user?.campusId ? [user.campusId] : [],
  );

  const isInstitutionWide = !user?.campusId;

  useEffect(() => {
    campusesService.list().then(setCampuses).catch(console.error);
  }, []);

  useEffect(() => {
    if (!isInstitutionWide && user?.campusId) {
      setCampusIds([user.campusId]);
    }
  }, [isInstitutionWide, user?.campusId]);

  const campusOptions = useMemo(
    () => campuses.map((c) => ({ id: c.id, label: c.campus_name })),
    [campuses],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await attendanceObjectionsService.list({
        campus_id: serializeIds(campusIds),
        status: serializeIds(statusFilter),
      });
      setItems(data);
    } catch (err: unknown) {
      console.error(err);
      setError("Failed to load objections.");
    } finally {
      setLoading(false);
    }
  }, [campusIds, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => items, [items]);

  const handleReview = async (decision: "ACCEPTED" | "REJECTED") => {
    if (!selected) return;
    if (decision === "REJECTED" && !adminNotes.trim()) {
      setError("Admin notes are required when rejecting an objection.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await attendanceObjectionsService.review(selected.id, {
        status: decision,
        admin_notes: adminNotes.trim() || undefined,
      });
      setSelected(null);
      setAdminNotes("");
      if (decision === "ACCEPTED") {
        setSuccess("Objection accepted. Daily attendance record has been updated to Present with the claimed time.");
      } else {
        setSuccess("Objection rejected.");
      }
      setTimeout(() => setSuccess(null), 5000);
      await load();
    } catch (err: unknown) {
      console.error(err);
      setError("Failed to update objection.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user?.permissions?.includes("hr.objections.review") && user?.role !== "SUPER_ADMIN") {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center text-zinc-500">
        You do not have permission to review attendance objections.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/10 rounded-2xl">
          <ClipboardList className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Attendance Objections</h1>
          <p className="text-sm text-zinc-500">Review employee attendance disputes</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {isInstitutionWide && (
          <div className="w-[200px]">
            <FilterDropdown
              label="Campus"
              icon={Building2}
              value={campusIds}
              options={campusOptions}
              placeholder="All Campuses"
              onToggle={(id) => setCampusIds((prev) => toggleId(prev, id))}
              onClear={() => setCampusIds([])}
            />
          </div>
        )}
        <div className="w-[180px]">
          <FilterDropdown
            label="Status"
            icon={Filter}
            value={statusFilter}
            options={STATUS_OPTIONS}
            placeholder="All Statuses"
            onToggle={(id) => setStatusFilter((prev) => toggleId(prev, id))}
            onClear={() => setStatusFilter([])}
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl p-4 text-sm">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl p-4 text-sm">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          {success}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-zinc-500 py-20">No objections found.</p>
      ) : (
        <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                <th className="px-5 py-3 text-xs font-bold text-zinc-500 uppercase">Employee</th>
                <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase">Date</th>
                <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase">Original</th>
                <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase">Claimed</th>
                <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase">Reason</th>
                <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase">Status</th>
                <th className="px-5 py-3 text-xs font-bold text-zinc-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20">
                  <td className="px-5 py-3 text-sm font-semibold text-zinc-900 dark:text-white">
                    {row.employee?.full_name ?? `#${row.employee_id}`}
                    {row.employee?.employee_code && (
                      <span className="block text-[11px] font-mono text-zinc-400 font-normal">
                        {row.employee.employee_code}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">{formatDate(row.attendance_date)}</td>
                  <td className="px-4 py-3 text-sm">
                    {row.scan ? (
                      <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
                        {formatTime(row.scan.scan_time)} <span className="text-zinc-400">({row.scan.direction ?? "PUNCH"})</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                        Day Objection (0 scans)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">{formatTime(row.claimed_time)}</td>
                  <td className="px-4 py-3 text-sm max-w-xs">
                    <p className="text-zinc-700 dark:text-zinc-300 truncate" title={row.reason}>
                      {row.reason}
                    </p>
                    {row.admin_notes && (
                      <p
                        className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100/70 dark:bg-zinc-800/60 rounded-md p-1 px-1.5 border border-zinc-200/60 dark:border-zinc-700/60 truncate"
                        title={`Admin Note: ${row.admin_notes}`}
                      >
                        <span className="font-semibold text-zinc-600 dark:text-zinc-300">Note: </span>
                        {row.admin_notes}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex flex-col gap-1 items-start">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide border ${
                          row.status === "ACCEPTED"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : row.status === "REJECTED"
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                        }`}
                      >
                        {row.status === "ACCEPTED" && <CheckCircle2 className="h-3 w-3" />}
                        {row.status === "REJECTED" && <X className="h-3 w-3" />}
                        {row.status}
                      </span>
                      {row.status !== "PENDING" && (
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 leading-tight">
                          <div>
                            by{" "}
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                              {row.reviewer?.full_name || row.reviewer?.username || "Admin"}
                            </span>
                          </div>
                          {row.reviewed_at && (
                            <div className="text-[11px] text-zinc-400">
                              {formatDateTime(row.reviewed_at)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {row.status === "PENDING" ? (
                      <button
                        onClick={() => { setSelected(row); setAdminNotes(""); }}
                        className="text-sm font-semibold text-primary hover:underline"
                      >
                        Review
                      </button>
                    ) : (
                      <button
                        onClick={() => setSelected(row)}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                      >
                        Details
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                  {selected.status === "PENDING" ? "Review Objection" : "Objection Details"}
                </h2>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 mt-1 rounded-md text-xs font-bold uppercase tracking-wide border ${
                  selected.status === "ACCEPTED"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : selected.status === "REJECTED"
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                }`}>
                  {selected.status === "ACCEPTED" && <CheckCircle2 className="h-3 w-3" />}
                  {selected.status === "REJECTED" && <X className="h-3 w-3" />}
                  {selected.status}
                </span>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 pt-1">
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-100 dark:border-zinc-800/80 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500">Employee</span>
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    {selected.employee?.full_name ?? `#${selected.employee_id}`}
                    {selected.employee?.employee_code && (
                      <span className="ml-1 text-xs text-zinc-400 font-mono">({selected.employee.employee_code})</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500">Attendance Date</span>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">{formatDate(selected.attendance_date)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500">Original Recorded</span>
                  <span>
                    {selected.scan ? (
                      <span className="font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        {formatTime(selected.scan.scan_time)} ({selected.scan.direction ?? "PUNCH"})
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">No biometric scans on record</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500">Claimed Arrival / Time</span>
                  <span className="font-mono text-xs font-bold text-zinc-900 dark:text-white">
                    {formatTime(selected.claimed_time)}
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-100 dark:border-zinc-800/80 space-y-1">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Employee Reason</span>
                <p className="text-sm text-zinc-800 dark:text-zinc-200">{selected.reason}</p>
              </div>

              {selected.status !== "PENDING" && (
                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-100 dark:border-zinc-800/80 space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-zinc-500">
                      {selected.status === "ACCEPTED" ? "Accepted By" : "Rejected By"}
                    </span>
                    <span className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-zinc-400" />
                      {selected.reviewer?.full_name || selected.reviewer?.username || "Admin"}
                    </span>
                  </div>
                  {selected.reviewed_at && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-zinc-500">Reviewed At</span>
                      <span className="text-xs text-zinc-600 dark:text-zinc-300">
                        {formatDateTime(selected.reviewed_at)}
                      </span>
                    </div>
                  )}
                  {selected.admin_notes && (
                    <div className="pt-1.5 border-t border-zinc-200/60 dark:border-zinc-700/60 space-y-1">
                      <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Admin Notes</span>
                      <p className="text-sm text-zinc-800 dark:text-zinc-200 italic">&ldquo;{selected.admin_notes}&rdquo;</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {selected.status === "PENDING" ? (
              <div className="space-y-4 pt-2">
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Admin notes (required for rejection)"
                  className="w-full min-h-24 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-transparent p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    disabled={submitting}
                    onClick={() => handleReview("REJECTED")}
                    className="h-10 px-5 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    disabled={submitting}
                    onClick={() => handleReview("ACCEPTED")}
                    className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold inline-flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Accept
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelected(null)}
                  className="h-10 px-5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
