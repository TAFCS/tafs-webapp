"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Loader2, Lock, Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { formatRs } from "./report-utils";

type SnapshotTotals = {
  count: number;
  student_count: number;
  amount: number;
  amount_paid: number;
  outstanding: number;
  billed: number;
  to_be_billed: number;
};

type SnapshotRow = {
  id: number;
  from_date: string;
  to_date: string;
  view: string;
  status: "DRAFT" | "FINALIZED";
  totals: SnapshotTotals;
  reconciles: boolean;
  generated_by: string | null;
  generated_at: string;
  finalized_by: string | null;
  finalized_at: string | null;
  notes: string | null;
  live_check?: {
    has_drift: boolean;
    matches_snapshot: boolean;
    reconciles: boolean;
    drift: Record<string, number>;
  };
};

type Props = {
  buildParams: () => Record<string, unknown>;
  canFinalize: boolean;
};

export function ReportSnapshotsPanel({ buildParams, canFinalize }: Props) {
  const [items, setItems] = useState<SnapshotRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<SnapshotRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notes, setNotes] = useState("");

  const loadSnapshots = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get("/v1/financial-reports/fee-heads/snapshots", {
        params: { limit: 10 },
      });
      setItems(data?.data?.items ?? []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load report snapshots");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: number) => {
    try {
      const { data } = await api.get(`/v1/financial-reports/fee-heads/snapshots/${id}`);
      setSelectedDetail(data?.data ?? null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load snapshot details");
    }
  }, []);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  useEffect(() => {
    if (selectedId == null) {
      setSelectedDetail(null);
      return;
    }
    loadDetail(selectedId);
  }, [loadDetail, selectedId]);

  const handleCreate = async () => {
    setIsSaving(true);
    try {
      const { data } = await api.post("/v1/financial-reports/fee-heads/snapshots", {
        ...buildParams(),
        notes: notes.trim() || undefined,
      });
      toast.success("Snapshot saved for review");
      setNotes("");
      await loadSnapshots();
      const id = data?.data?.id as number | undefined;
      if (id) setSelectedId(id);
    } catch (err: unknown) {
      console.error(err);
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to create snapshot";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalize = async (id: number) => {
    if (!canFinalize) return;
    setIsSaving(true);
    try {
      await api.post(`/v1/financial-reports/fee-heads/snapshots/${id}/finalize`);
      toast.success("Snapshot finalized");
      await loadSnapshots();
      await loadDetail(id);
    } catch (err: unknown) {
      console.error(err);
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to finalize snapshot";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setIsSaving(true);
    try {
      await api.delete(`/v1/financial-reports/fee-heads/snapshots/${id}`);
      toast.success("Draft snapshot deleted");
      if (selectedId === id) setSelectedId(null);
      await loadSnapshots();
    } catch (err: unknown) {
      console.error(err);
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to delete snapshot";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[24px] p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500">
            Report finalisation
          </h2>
          <p className="text-sm text-zinc-500 mt-1 max-w-2xl">
            Save a snapshot of the current filters and totals, review it, then finalize when the figures reconcile and match live data.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          disabled={isSaving}
          className="h-9 px-4 rounded-xl text-[11px] font-black uppercase tracking-widest bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save snapshot"}
        </button>
      </div>

      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
          Review notes (optional)
        </label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. August fee heads checked against vouchers"
          className="mt-1 w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-400 py-6">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading snapshots…
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-400 py-4">No snapshots yet for this report.</p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                {["Period", "View", "Status", "Total", "Created", "Actions"].map((header) => (
                  <th
                    key={header}
                    className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={row.id}
                  className={`border-t border-zinc-100 dark:border-zinc-800 cursor-pointer ${selectedId === row.id ? "bg-zinc-50 dark:bg-zinc-900/50" : ""}`}
                  onClick={() => setSelectedId(row.id)}
                >
                  <td className="px-3 py-3 whitespace-nowrap font-medium">
                    {row.from_date} → {row.to_date}
                  </td>
                  <td className="px-3 py-3 text-zinc-500">{row.view.replaceAll("_", " ")}</td>
                  <td className="px-3 py-3">
                    <SnapshotStatusBadge status={row.status} />
                  </td>
                  <td className="px-3 py-3 tabular-nums">{formatRs(row.totals?.amount)}</td>
                  <td className="px-3 py-3 text-zinc-500 whitespace-nowrap">
                    {row.generated_by ?? "—"}
                    <span className="block text-[11px] text-zinc-400">
                      {new Date(row.generated_at).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      {row.status === "DRAFT" && canFinalize && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleFinalize(row.id); }}
                          disabled={isSaving}
                          className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          <Lock className="h-3.5 w-3.5" />
                          Finalize
                        </button>
                      )}
                      {row.status === "DRAFT" && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}
                          disabled={isSaving}
                          className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-zinc-100 text-zinc-600 hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedDetail && (
        <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <SnapshotStatusBadge status={selectedDetail.status} />
            {selectedDetail.live_check?.matches_snapshot && selectedDetail.live_check.reconciles && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                Live data matches snapshot
              </span>
            )}
            {selectedDetail.live_check?.has_drift && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" />
                Live data has drifted since snapshot
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Metric label="Heads" value={(selectedDetail.totals?.count ?? 0).toLocaleString()} />
            <Metric label="Students" value={(selectedDetail.totals?.student_count ?? 0).toLocaleString()} />
            <Metric label="Total" value={formatRs(selectedDetail.totals?.amount)} />
            <Metric label="Outstanding" value={formatRs(selectedDetail.totals?.outstanding)} />
          </div>

          {selectedDetail.notes && (
            <p className="text-sm text-zinc-500">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Notes:</span>{" "}
              {selectedDetail.notes}
            </p>
          )}

          {selectedDetail.finalized_at && (
            <p className="text-sm text-zinc-500">
              Finalized by {selectedDetail.finalized_by ?? "—"} on{" "}
              {new Date(selectedDetail.finalized_at).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SnapshotStatusBadge({ status }: { status: "DRAFT" | "FINALIZED" }) {
  if (status === "FINALIZED") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">
        <Lock className="h-3 w-3" />
        Finalized
      </span>
    );
  }
  return (
    <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900">
      Draft
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
      <p className="mt-0.5 font-bold tabular-nums text-zinc-800 dark:text-zinc-100">{value}</p>
    </div>
  );
}
