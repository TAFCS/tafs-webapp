"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle, Building2, CheckCircle2, ClipboardList, Filter, Loader2, X,
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

export default function AttendanceObjectionsPage() {
  const { user } = useAuthState();
  const [statusFilter, setStatusFilter] = useState<AttendanceObjectionStatus[]>(["PENDING"]);
  const [items, setItems] = useState<AttendanceObjection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
                  <td className="px-5 py-3 text-sm font-semibold">
                    {row.employee?.full_name ?? `#${row.employee_id}`}
                  </td>
                  <td className="px-4 py-3 text-sm">{formatDate(row.attendance_date)}</td>
                  <td className="px-4 py-3 text-sm">
                    {row.scan ? formatTime(row.scan.scan_time) : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">{formatTime(row.claimed_time)}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500 max-w-xs truncate">{row.reason}</td>
                  <td className="px-4 py-3 text-sm">{row.status}</td>
                  <td className="px-5 py-3">
                    {row.status === "PENDING" && (
                      <button
                        onClick={() => { setSelected(row); setAdminNotes(""); }}
                        className="text-sm font-semibold text-primary hover:underline"
                      >
                        Review
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-bold">Review Objection</h2>
              <button onClick={() => setSelected(null)}><X className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-zinc-600">
              <strong>{selected.employee?.full_name}</strong> — {formatDate(selected.attendance_date)}
            </p>
            <p className="text-sm">Claimed: {formatTime(selected.claimed_time)}</p>
            <p className="text-sm text-zinc-600">{selected.reason}</p>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Admin notes (required for rejection)"
              className="w-full min-h-24 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent p-3 text-sm"
            />
            <div className="flex gap-2 justify-end">
              <button
                disabled={submitting}
                onClick={() => handleReview("REJECTED")}
                className="h-10 px-4 rounded-xl border border-rose-200 text-rose-600 text-sm font-semibold"
              >
                Reject
              </button>
              <button
                disabled={submitting}
                onClick={() => handleReview("ACCEPTED")}
                className="h-10 px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold inline-flex items-center gap-1"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
