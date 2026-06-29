"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2, Plus, Trash2 } from "lucide-react";
import { useAuthState } from "@/context/AuthContext";
import { campusesService, Campus } from "@/lib/campuses.service";
import { saturdaySchedulesService, SaturdaySchedule } from "@/lib/leaves.service";

function isSaturday(dateStr: string): boolean {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.getUTCDay() === 6;
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function SaturdaySchedulesPage() {
  const { user } = useAuthState();
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusId, setCampusId] = useState<string>("");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  const [items, setItems] = useState<SaturdaySchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newDate, setNewDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  useEffect(() => {
    campusesService.list().then((list) => {
      setCampuses(list);
      if (list.length > 0) setCampusId(String(list[0].id));
    }).catch(console.error);
  }, []);

  const load = useCallback(async () => {
    if (!campusId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await saturdaySchedulesService.list(Number(campusId), month);
      setItems(data);
    } catch (err: unknown) {
      console.error(err);
      setError("Failed to load Saturday schedules.");
    } finally {
      setLoading(false);
    }
  }, [campusId, month]);

  useEffect(() => {
    if (isSuperAdmin) load();
  }, [load, isSuperAdmin]);

  const slotsRemaining = useMemo(() => Math.max(0, 2 - items.length), [items.length]);

  const handleCreate = async () => {
    if (!campusId || !newDate) return;
    if (!isSaturday(newDate)) {
      setError("Only Saturdays can be scheduled.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await saturdaySchedulesService.create(Number(campusId), newDate);
      setNewDate("");
      await load();
    } catch (err: unknown) {
      console.error(err);
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "Failed to create schedule. Must be before the 26th of the prior month.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remove this mandatory Saturday?")) return;
    setSubmitting(true);
    setError(null);
    try {
      await saturdaySchedulesService.remove(id);
      await load();
    } catch (err: unknown) {
      console.error(err);
      setError("Failed to delete schedule.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center text-zinc-500">
        Only super admins can manage mandatory Saturday schedules.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/10 rounded-xl">
          <CalendarDays className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Saturday Schedules</h1>
          <p className="text-sm text-zinc-500">
            Mark up to two mandatory Saturdays per campus per month (before the 26th of the prior month)
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={campusId}
          onChange={(e) => setCampusId(e.target.value)}
          className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
        >
          {campuses.map((c) => (
            <option key={c.id} value={c.id}>{c.campus_name}</option>
          ))}
        </select>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4 space-y-3">
        <p className="text-sm text-zinc-500">
          {monthLabel(month)} · {slotsRemaining} slot{slotsRemaining === 1 ? "" : "s"} remaining
        </p>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-zinc-500 py-4">No Saturdays scheduled for this month.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-zinc-100 dark:border-zinc-800 px-3 py-2"
              >
                <div>
                  <p className="font-medium">{item.date.slice(0, 10)}</p>
                  <p className="text-xs text-zinc-500">
                    Marked by {item.users.full_name ?? "Admin"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDelete(item.id)}
                  className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {slotsRemaining > 0 && (
          <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Saturday date</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              disabled={submitting || !newDate}
              onClick={handleCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-primary text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Add Saturday
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
