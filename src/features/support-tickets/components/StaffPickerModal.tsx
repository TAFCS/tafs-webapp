"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api from "@/lib/api";

export interface StaffOption {
  id: string;
  full_name: string;
  username: string;
  role: string;
}

interface StaffPickerModalProps {
  title: string;
  description: string;
  roleFilter?: string | string[];
  excludeUserId?: string;
  onClose: () => void;
  onSelect: (user: StaffOption) => void;
}

export function StaffPickerModal({
  title,
  description,
  roleFilter,
  excludeUserId,
  onClose,
  onSelect,
}: StaffPickerModalProps) {
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadStaff = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    api
      .get("/v1/users")
      .then((res) => {
        const list = res.data.data ?? res.data ?? [];
        setStaff(
          list
            .filter((u: StaffOption & { is_active?: boolean }) => u.is_active !== false)
            .map((u: StaffOption) => ({
              id: u.id,
              full_name: u.full_name,
              username: u.username,
              role: u.role,
            })),
        );
      })
      .catch((err) => {
        const message = err.response?.data?.message ?? "Failed to load staff list";
        setLoadError(message);
        toast.error(message);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const filtered = useMemo(() => {
    const roles = roleFilter
      ? Array.isArray(roleFilter)
        ? roleFilter
        : [roleFilter]
      : null;
    return staff.filter((s) => {
      if (excludeUserId && s.id === excludeUserId) return false;
      if (roles && !roles.includes(s.role)) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        s.full_name.toLowerCase().includes(q) ||
        s.username.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q)
      );
    });
  }, [staff, roleFilter, excludeUserId, search]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
          <h3 className="text-xl font-bold">{title}</h3>
          <p className="text-sm text-zinc-500 mt-1">{description}</p>
        </div>
        <div className="p-6 space-y-3 flex-1 min-h-0 flex flex-col">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or username…"
            aria-label="Search staff"
            className="w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm focus:border-primary"
          />
          <div className="flex-1 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-xl min-h-[200px]">
            {loading && (
              <div className="p-8 flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
                <p className="text-sm text-zinc-400">Loading staff…</p>
              </div>
            )}
            {!loading && loadError && (
              <div className="p-6 text-center">
                <p className="text-sm text-rose-600 mb-3">{loadError}</p>
                <button
                  onClick={loadStaff}
                  className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold"
                >
                  Retry
                </button>
              </div>
            )}
            {!loading && !loadError && filtered.length === 0 && (
              <p className="p-6 text-sm text-zinc-400 text-center">No matching staff found</p>
            )}
            {!loading &&
              !loadError &&
              filtered.map((user) => (
                <button
                  key={user.id}
                  onClick={() => onSelect(user)}
                  className="w-full text-left px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                >
                  <p className="font-bold text-sm">{user.full_name}</p>
                  <p className="text-xs text-zinc-500">
                    {user.username} · {user.role.replace(/_/g, " ")}
                  </p>
                </button>
              ))}
          </div>
        </div>
        <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 h-11 rounded-xl text-zinc-600 dark:text-zinc-400 font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
