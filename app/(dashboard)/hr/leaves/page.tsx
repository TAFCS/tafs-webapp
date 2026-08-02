"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2, CalendarClock, CheckCircle2, ExternalLink, Filter, Layers, Loader2, X, XCircle,
} from "lucide-react";
import { useAuthState } from "@/context/AuthContext";
import { campusesService, Campus } from "@/lib/campuses.service";
import {
  leavesService,
  LeaveRequest,
  LeaveRequestStatus,
} from "@/lib/leaves.service";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { toggleId, serializeIds } from "@/components/filters/filter-params";

const STATUS_OPTIONS: { id: LeaveRequestStatus; label: string }[] = [
  { id: "PENDING", label: "Pending" },
  { id: "APPROVED", label: "Approved" },
  { id: "REJECTED", label: "Rejected" },
];

const TYPE_OPTIONS: { id: string; label: string }[] = [
  { id: "SICK", label: "Sick" },
  { id: "CASUAL", label: "Casual" },
  { id: "ANNUAL", label: "Annual" },
  { id: "UNPAID", label: "Unpaid" },
];

function formatDate(iso: string) {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function parseApiError(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(". ");
  if (typeof msg === "string" && msg.trim()) return msg;
  return fallback;
}

function statusPill(status: LeaveRequestStatus) {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400";
    case "REJECTED":
      return "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400";
    default:
      return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400";
  }
}

export default function LeavesReviewPage() {
  const { user } = useAuthState();
  const [statusFilter, setStatusFilter] = useState<LeaveRequestStatus[]>(["PENDING"]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusIds, setCampusIds] = useState<number[]>(
    user?.campusId ? [user.campusId] : [],
  );

  const isInstitutionWide = !user?.campusId;
  const canReview =
    user?.permissions?.includes("hr.leave.approve") || user?.role === "SUPER_ADMIN";

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
      const data = await leavesService.list({
        campusId: serializeIds(campusIds),
        status: serializeIds(statusFilter),
        leaveTypeCode: serializeIds(typeFilter),
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      setItems(data);
    } catch (err: unknown) {
      console.error(err);
      setError(parseApiError(err, "Failed to load leave requests."));
    } finally {
      setLoading(false);
    }
  }, [campusIds, statusFilter, typeFilter, fromDate, toDate]);

  useEffect(() => {
    if (canReview) load();
  }, [load, canReview]);

  const filtered = useMemo(() => items, [items]);

  const handleReview = async (decision: "APPROVED" | "REJECTED") => {
    if (!selected) return;
    if (decision === "REJECTED" && !reviewReason.trim()) {
      setError("Rejection reason is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await leavesService.review(selected.id, {
        status: decision,
        reviewReason: reviewReason.trim() || undefined,
      });
      setSelected(null);
      setReviewReason("");
      await load();
    } catch (err: unknown) {
      console.error(err);
      setError(parseApiError(err, "Failed to review leave request."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    if (!selected) return;
    if (!reviewReason.trim()) {
      setError("Revocation reason is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await leavesService.revoke(selected.id, reviewReason.trim());
      setSelected(null);
      setReviewReason("");
      await load();
    } catch (err: unknown) {
      console.error(err);
      setError(parseApiError(err, "Failed to revoke leave request."));
    } finally {
      setSubmitting(false);
    }
  };

  if (!canReview) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center text-zinc-500">
        You do not have permission to review leave requests.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/10 rounded-xl">
          <CalendarClock className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leave Requests</h1>
          <p className="text-sm text-zinc-500">Review and approve employee leave applications</p>
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
        <div className="w-[180px]">
          <FilterDropdown
            label="Leave Type"
            icon={Layers}
            value={typeFilter}
            options={TYPE_OPTIONS}
            placeholder="All Types"
            onToggle={(id) => setTypeFilter((prev) => toggleId(prev, id))}
            onClear={() => setTypeFilter([])}
          />
        </div>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="h-11 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm"
          placeholder="From"
          aria-label="From date"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="h-11 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm"
          placeholder="To"
          aria-label="To date"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">No leave requests found.</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => { setSelected(item); setReviewReason(""); }}
              className="text-left rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {item.employee_profiles.full_name ?? "Employee"}
                    {item.employee_profiles.employee_code && (
                      <span className="text-zinc-500 font-normal ml-2">
                        ({item.employee_profiles.employee_code})
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-zinc-500 mt-0.5">
                    {item.leave_types.name} · {formatDate(item.start_date)} – {formatDate(item.end_date)}
                  </p>
                  {item.employee_profiles.campuses?.campus_name && (
                    <p className="text-xs text-zinc-400 mt-1">
                      {item.employee_profiles.campuses.campus_name}
                    </p>
                  )}
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusPill(item.status)}`}>
                  {item.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setSelected(null)}
            aria-label="Close"
          />
          <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 h-full shadow-xl overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Leave detail</h2>
              <button type="button" onClick={() => setSelected(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <p><span className="text-zinc-500">Employee:</span> {selected.employee_profiles.full_name}</p>
              <p><span className="text-zinc-500">Type:</span> {selected.leave_types.name}</p>
              <p>
                <span className="text-zinc-500">Dates:</span>{" "}
                {formatDate(selected.start_date)} – {formatDate(selected.end_date)}
              </p>
              {selected.reason && (
                <p><span className="text-zinc-500">Reason:</span> {selected.reason}</p>
              )}
              {selected.review_reason && (
                <p><span className="text-zinc-500">Review note:</span> {selected.review_reason}</p>
              )}
              <p><span className="text-zinc-500">Submitted:</span> {formatDateTime(selected.created_at)}</p>
              {selected.reviewer?.full_name && (
                <p><span className="text-zinc-500">Reviewed by:</span> {selected.reviewer.full_name}</p>
              )}
              {selected.reviewed_at && (
                <p><span className="text-zinc-500">Reviewed at:</span> {formatDateTime(selected.reviewed_at)}</p>
              )}
            </div>

            {selected.attachment_url && (
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
                <p className="text-sm font-medium mb-2">Attachment</p>
                {selected.attachment_type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selected.attachment_url}
                    alt="Leave attachment"
                    className="max-h-48 rounded-lg object-contain"
                  />
                ) : (
                  <a
                    href={selected.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary text-sm"
                  >
                    View PDF <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            )}

            {selected.status === "PENDING" && (
              <>
                <textarea
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  placeholder="Rejection reason (required if rejecting)"
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm min-h-[80px]"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleReview("APPROVED")}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 text-white py-2 text-sm font-medium disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Approve
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleReview("REJECTED")}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 text-white py-2 text-sm font-medium disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" /> Reject
                  </button>
                </div>
              </>
            )}

            {selected.status === "APPROVED" && (
              <>
                <textarea
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  placeholder="Revocation reason (required)"
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm min-h-[80px]"
                />
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleRevoke}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 text-white py-2 text-sm font-medium disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" /> Revoke approval
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
