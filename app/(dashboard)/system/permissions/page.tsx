"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ShieldCheck, Search, Check, Plus, Trash2, X, Lock, ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";
import { toast } from "react-hot-toast";
import { useAccessCatalog } from "@/hooks/use-access-catalog";
import { useAppSelector } from "@/store/hooks";

type StaffRole = "SUPER_ADMIN" | "CAMPUS_ADMIN" | "PRINCIPAL" | "FINANCE_CLERK" | "RECEPTIONIST" | "TEACHER" | "STAFF_EDITOR" | "GENERAL_RESPONDENT" | "EMPLOYEE";

interface AccessPack {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  tiles: { tile_id: string }[];
}

interface PermissionEntry {
  id: number;
  key: string;
  module: string;
  description: string;
}

const ROLE_LABELS: Record<StaffRole, string> = {
  SUPER_ADMIN: "Super Admin",
  CAMPUS_ADMIN: "Campus Admin",
  PRINCIPAL: "Principal",
  FINANCE_CLERK: "Finance Clerk",
  RECEPTIONIST: "Receptionist",
  TEACHER: "Teacher",
  STAFF_EDITOR: "Staff Editor",
  GENERAL_RESPONDENT: "General Respondent",
  EMPLOYEE: "Employee",
};

export default function AccessPacksPage() {
  const caller = useAppSelector((s) => s.auth.user);
  const isSuperAdmin = caller?.role === "SUPER_ADMIN";
  const { catalog } = useAccessCatalog();

  const [packs, setPacks] = useState<AccessPack[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftTileIds, setDraftTileIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedRole, setAdvancedRole] = useState<StaffRole>("FINANCE_CLERK");
  const [allPermissions, setAllPermissions] = useState<PermissionEntry[]>([]);
  const [rolePermIds, setRolePermIds] = useState<Set<number>>(new Set());
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const loadPacks = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/v1/access/packs");
      setPacks(data.data || []);
    } catch {
      toast.error("Failed to load access packs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadPacks(); }, []);

  const selected = packs.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    setDraftName(selected.name);
    setDraftDescription(selected.description ?? "");
    setDraftTileIds(new Set(selected.tiles.map((t) => t.tile_id)));
    setCreating(false);
  }, [selectedId]);

  const startCreate = () => {
    setSelectedId(null);
    setCreating(true);
    setDraftName("");
    setDraftDescription("");
    setDraftTileIds(new Set());
  };

  const savePack = async () => {
    if (!draftName.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: draftName.trim(),
        description: draftDescription.trim() || undefined,
        tileIds: [...draftTileIds],
      };
      if (creating || !selected) {
        const { data } = await api.post("/v1/access/packs", payload);
        toast.success("Pack created");
        await loadPacks();
        setSelectedId(data.data.id);
        setCreating(false);
      } else {
        await api.put(`/v1/access/packs/${selected.id}`, payload);
        toast.success("Pack saved");
        await loadPacks();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to save pack");
    } finally {
      setSaving(false);
    }
  };

  const deletePack = async () => {
    if (!selected || selected.is_system) return;
    if (!confirm(`Delete pack "${selected.name}"?`)) return;
    try {
      await api.delete(`/v1/access/packs/${selected.id}`);
      toast.success("Pack deleted");
      setSelectedId(null);
      await loadPacks();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to delete pack");
    }
  };

  const toggleTile = (id: string) => {
    setDraftTileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (!showAdvanced) return;
    api.get("/v1/users/permissions/all").then(({ data }) => setAllPermissions(data.data || [])).catch(() => undefined);
  }, [showAdvanced]);

  useEffect(() => {
    if (!showAdvanced) return;
    api.get(`/v1/users/roles/${advancedRole}/permissions`).then(({ data }) => {
      setRolePermIds(new Set((data.data || []).map((p: any) => p.permission_id)));
    }).catch(() => undefined);
  }, [showAdvanced, advancedRole]);

  const groupedPermissions = useMemo(() => {
    const filtered = allPermissions.filter((p) =>
      p.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.module.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    const groups: Record<string, PermissionEntry[]> = {};
    filtered.forEach((p) => {
      if (!groups[p.module]) groups[p.module] = [];
      groups[p.module].push(p);
    });
    return groups;
  }, [allPermissions, searchTerm]);

  const toggleRolePerm = async (perm: PermissionEntry) => {
    setUpdatingId(perm.id);
    const granted = !rolePermIds.has(perm.id);
    try {
      await api.post("/v1/users/roles/permissions", { role: advancedRole, permission_id: perm.id, granted });
      setRolePermIds((prev) => {
        const next = new Set(prev);
        if (granted) next.add(perm.id);
        else next.delete(perm.id);
        return next;
      });
    } catch {
      toast.error("Failed to update role default");
    } finally {
      setUpdatingId(null);
    }
  };

  const catalogModules = catalog?.modules ?? [];
  const filteredModules = catalogModules.map((m) => ({
    ...m,
    tiles: m.tiles.filter((t) =>
      t.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.id.toLowerCase().includes(searchTerm.toLowerCase()),
    ),
  })).filter((m) => m.tiles.length > 0);

  return (
    <div className="pb-20 max-w-full">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-2xl text-primary">
              <ShieldCheck className="h-7 w-7" />
            </div>
            Access Packs
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
            Bundle ERP tiles and assign them additively on top of a person&apos;s role.
          </p>
        </div>
        <button onClick={startCreate} className="h-12 px-6 bg-primary hover:bg-primary/90 text-white rounded-2xl font-bold flex items-center gap-2">
          <Plus className="h-5 w-5" /> New pack
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        <div className="xl:col-span-3 space-y-2">
          {loading ? (
            <p className="text-sm text-zinc-400 px-2">Loading packs…</p>
          ) : packs.map((p) => (
            <button
              key={p.id}
              onClick={() => { setSelectedId(p.id); setCreating(false); }}
              className={`w-full text-left px-4 py-3 rounded-2xl border ${selectedId === p.id && !creating ? "border-primary bg-primary/5" : "border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm">{p.name}</span>
                {p.is_system && <Lock className="h-3.5 w-3.5 text-zinc-400" />}
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">{p.tiles.length} tiles{p.is_system ? " · system" : ""}</p>
            </button>
          ))}
        </div>

        <div className="xl:col-span-9 bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-6">
          {!creating && !selected ? (
            <p className="text-sm text-zinc-400 font-medium">Select a pack or create a new one.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-3 mb-6">
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="Pack name"
                  className="flex-1 min-w-[12rem] h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm font-bold"
                />
                <input
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                  placeholder="Description"
                  className="flex-[2] min-w-[12rem] h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm"
                />
                <button onClick={savePack} disabled={saving} className="h-11 px-5 rounded-xl bg-primary text-white font-bold disabled:opacity-60">
                  {saving ? "Saving…" : "Save"}
                </button>
                {selected && !selected.is_system && (
                  <button onClick={deletePack} className="h-11 px-4 rounded-xl border border-rose-200 text-rose-600 font-bold">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Filter tiles…" className="w-full h-10 pl-9 pr-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm" />
              </div>

              <div className="space-y-6">
                {filteredModules.map((mod) => (
                  <div key={mod.id}>
                    <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-2">{mod.id.replace(/-/g, " ")}</p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {mod.tiles.map((tile) => {
                        const on = draftTileIds.has(tile.id);
                        return (
                          <button
                            key={tile.id}
                            type="button"
                            onClick={() => toggleTile(tile.id)}
                            className={`text-left px-3 py-2.5 rounded-xl border flex items-start gap-2 ${on ? "border-primary bg-primary/5" : "border-zinc-100 dark:border-zinc-800"}`}
                          >
                            <span className={`mt-0.5 h-4 w-4 rounded flex items-center justify-center shrink-0 ${on ? "bg-primary text-white" : "bg-zinc-100 dark:bg-zinc-800 text-transparent"}`}>
                              <Check className="h-3 w-3" />
                            </span>
                            <span>
                              <span className="block text-sm font-semibold">{tile.label}</span>
                              <span className="block text-[11px] text-zinc-400">{tile.description}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {isSuperAdmin && (
        <div className="mt-12">
          <button onClick={() => setShowAdvanced((v) => !v)} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-700">
            <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
            Advanced: role defaults
          </button>
          <AnimatePresence>
            {showAdvanced && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="mt-4 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                  <p className="text-sm text-zinc-500 mb-4">Legacy capability matrix. Prefer access packs for new grants.</p>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {(Object.keys(ROLE_LABELS) as StaffRole[]).map((role) => (
                      <button key={role} onClick={() => setAdvancedRole(role)} className={`px-3 py-1.5 rounded-full text-xs font-bold ${advancedRole === role ? "bg-primary text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"}`}>
                        {ROLE_LABELS[role]}
                      </button>
                    ))}
                  </div>
                  {Object.entries(groupedPermissions).map(([module, perms]) => (
                    <div key={module} className="mb-4">
                      <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-2">{module}</p>
                      <ul className="space-y-1">
                        {perms.map((perm) => {
                          const on = rolePermIds.has(perm.id);
                          return (
                            <li key={perm.id}>
                              <button
                                disabled={updatingId === perm.id}
                                onClick={() => toggleRolePerm(perm)}
                                className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900"
                              >
                                <span>
                                  <span className="block text-sm font-semibold">{perm.key}</span>
                                  <span className="block text-[11px] text-zinc-400">{perm.description}</span>
                                </span>
                                {on ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-zinc-300" />}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
