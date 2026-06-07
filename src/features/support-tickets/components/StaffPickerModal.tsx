"use client";

import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    api
      .get("/v1/users")
      .then((res) => {
        const list = res.data.data ?? res.data ?? [];
        setStaff(
          list
            .filter((u: StaffOption & { is_active?: boolean }) => u.is_active !== false)
            .map((u: any) => ({
              id: u.id,
              full_name: u.full_name,
              username: u.username,
              role: u.role,
            })),
        );
      })
      .finally(() => setLoading(false));
  }, []);

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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-md w-full shadow-xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-black text-lg mb-1">{title}</h3>
        <p className="text-sm text-zinc-500 mb-4">{description}</p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or username…"
          className="w-full px-3 py-2 border rounded-lg mb-3 dark:bg-zinc-800 dark:border-zinc-700 text-sm"
        />
        <div className="flex-1 overflow-y-auto border rounded-lg dark:border-zinc-700">
          {loading && <p className="p-4 text-sm text-zinc-400">Loading staff…</p>}
          {!loading && filtered.length === 0 && (
            <p className="p-4 text-sm text-zinc-400">No matching staff found</p>
          )}
          {filtered.map((user) => (
            <button
              key={user.id}
              onClick={() => onSelect(user)}
              className="w-full text-left px-4 py-3 border-b dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <p className="font-bold text-sm">{user.full_name}</p>
              <p className="text-xs text-zinc-500">
                {user.username} · {user.role.replace(/_/g, " ")}
              </p>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-4 px-4 py-2 border rounded-lg text-sm self-end">
          Cancel
        </button>
      </div>
    </div>
  );
}
