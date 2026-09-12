"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users, UserPlus, Search, X, Check, UserCog,
  Activity, UserCheck, UserMinus, Eye, Copy, Briefcase,
  Link2, Minus, ChevronRight, ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";
import { toast } from "react-hot-toast";
import { useAppSelector } from "@/store/hooks";
import { useAccessCatalog } from "@/hooks/use-access-catalog";
import { hrService, type Department } from "@/lib/hr.service";
import { campusesService, type Campus } from "@/lib/campuses.service";
import Link from "next/link";

type StaffRole =
  | "SUPER_ADMIN" | "CAMPUS_ADMIN" | "PRINCIPAL" | "FINANCE_CLERK"
  | "RECEPTIONIST" | "TEACHER" | "STAFF_EDITOR" | "GENERAL_RESPONDENT" | "EMPLOYEE";

const STAFF_ROLES: StaffRole[] = [
  "EMPLOYEE", "TEACHER", "RECEPTIONIST", "FINANCE_CLERK", "PRINCIPAL",
  "STAFF_EDITOR", "GENERAL_RESPONDENT", "CAMPUS_ADMIN", "SUPER_ADMIN",
];

interface EmployeeProfileSummary {
  id: number;
  campus_id: number | null;
  department_id: number | null;
  staff_category_id: number | null;
  job_title: string | null;
  reporting_manager_id: number | null;
  join_date: string | null;
  monthly_pay: number | string | null;
  payroll_enabled: boolean;
  campuses: { campus_name: string } | null;
  departments: { id: number; name: string } | null;
  staff_categories: { id: number; name: string; code: string } | null;
  reporting_manager: { id: number; full_name: string | null } | null;
}

interface StaffUser {
  id: string;
  username: string;
  full_name: string;
  role: StaffRole;
  campus_id: number | null;
  is_active: boolean;
  created_at: string;
  campuses: { campus_name: string } | null;
  user_permissions: { id: number; granted: boolean; permissions: { key: string } }[];
  employee_profile: EmployeeProfileSummary | null;
}

interface TileActionRef {
  tileId: string;
  actionId: string;
}

/**
 * A user's universal data scope. An EMPTY array on a dimension means
 * UNRESTRICTED on that dimension, not "nothing" — mirrors UserScope in
 * src/store/slices/authSlice.ts and scope.types.ts on the backend.
 */
interface UserScope {
  campuses: number[];
  segments: number[];
  classes: number[];
  sections: number[];
  departments: number[];
  staffCategories: number[];
}

const EMPTY_SCOPE: UserScope = {
  campuses: [], segments: [], classes: [], sections: [],
  departments: [], staffCategories: [],
};

type ScopeDimension = keyof UserScope;

interface ScopeOption {
  id: number;
  label: string | null;
  code?: string | null;
  segmentId?: number | null;
  departmentId?: number | null;
}

type ScopeOptions = Record<ScopeDimension, ScopeOption[]>;

const SCOPE_DIMENSIONS: { key: ScopeDimension; label: string; hint: string }[] = [
  { key: "campuses", label: "Campuses", hint: "Which campuses' records they may touch" },
  { key: "segments", label: "Segments", hint: "Pre-primary, primary, secondary…" },
  { key: "classes", label: "Classes", hint: "Narrowed by the chosen segments" },
  { key: "sections", label: "Sections", hint: "Sections within those classes" },
  { key: "departments", label: "Departments", hint: "Employee records only" },
  { key: "staffCategories", label: "Staff categories", hint: "Narrowed by the chosen departments" },
];

interface UserAccessState {
  role: StaffRole;
  roleTileIds: string[];
  packIds: string[];
  assignedPacks: { id: string; name: string }[];
  allPacks: { id: string; name: string; description: string | null; is_system: boolean; tileIds: string[]; tileActions: TileActionRef[] }[];
  grants: { tileId: string; allow: boolean; note: string | null }[];
  actionGrants: { tileId: string; actionId: string; allow: boolean; note: string | null }[];
  scope: UserScope;
}

type DrawerTab = "identity" | "job" | "access" | "scope";

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-700"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded text-[10px] font-bold uppercase tracking-tight">
      {role.replace(/_/g, " ")}
    </span>
  );
}

export default function PeopleAccessPage() {
  const caller = useAppSelector((s) => s.auth.user);
  const isSuperAdmin = caller?.role === "SUPER_ADMIN";
  const { catalog } = useAccessCatalog();

  const [users, setUsers] = useState<StaffUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tab, setTab] = useState<DrawerTab>("identity");
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [identity, setIdentity] = useState({
    full_name: "",
    username: "",
    password: "",
    role: "EMPLOYEE" as StaffRole,
    is_active: true,
  });
  const [job, setJob] = useState({
    campus_id: "",
    department_id: "",
    staff_category_id: "",
    job_title: "",
    reporting_manager_id: "",
    join_date: "",
    monthly_pay: "",
    payroll_enabled: true,
  });
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<{ id: number; full_name: string | null; employee_code: string | null }[]>([]);

  const [access, setAccess] = useState<UserAccessState | null>(null);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [draftPackIds, setDraftPackIds] = useState<string[]>([]);
  const [draftGrants, setDraftGrants] = useState<Record<string, boolean>>({});
  /** Keyed `tileId#actionId` — the same address the session's effectiveActions uses. */
  const [draftActionGrants, setDraftActionGrants] = useState<Record<string, boolean>>({});
  const [expandedTiles, setExpandedTiles] = useState<Record<string, boolean>>({});
  const [draftScope, setDraftScope] = useState<UserScope>(EMPTY_SCOPE);
  const [loadedScope, setLoadedScope] = useState<UserScope>(EMPTY_SCOPE);
  const [scopeOptions, setScopeOptions] = useState<ScopeOptions | null>(null);

  const [revealUser, setRevealUser] = useState<StaffUser | null>(null);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [revealCopied, setRevealCopied] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get("/v1/users");
      setUsers(data.data || []);
    } catch {
      toast.error("Failed to load people");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    campusesService.list().then(setCampuses).catch(() => undefined);
    hrService.listDepartments().then(setDepartments).catch(() => undefined);
    hrService.listEmployees().then((rows) =>
      setManagers(rows.map((e) => ({ id: e.id, full_name: e.full_name, employee_code: e.employee_code }))),
    ).catch(() => undefined);
    api.get("/v1/access/scope-options")
      .then(({ data }) => setScopeOptions((data.data ?? data) as ScopeOptions))
      .catch(() => undefined);
  }, []);

  const filteredUsers = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return users.filter((u) =>
      u.full_name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q),
    );
  }, [users, searchTerm]);

  const staffCategories = useMemo(() => {
    const dept = departments.find((d) => String(d.id) === job.department_id);
    return dept?.staff_categories ?? [];
  }, [departments, job.department_id]);

  const loadAccess = async (userId: string) => {
    setLoadingAccess(true);
    try {
      const { data } = await api.get(`/v1/access/users/${userId}/access`);
      const state = data.data as UserAccessState;
      setAccess(state);
      setDraftPackIds(state.packIds);
      const grants: Record<string, boolean> = {};
      state.grants.forEach((g) => { grants[g.tileId] = g.allow; });
      setDraftGrants(grants);
      const actionGrants: Record<string, boolean> = {};
      (state.actionGrants ?? []).forEach((g) => { actionGrants[`${g.tileId}#${g.actionId}`] = g.allow; });
      setDraftActionGrants(actionGrants);
      const scope = { ...EMPTY_SCOPE, ...(state.scope ?? {}) };
      setDraftScope(scope);
      setLoadedScope(scope);
    } catch {
      toast.error("Failed to load access");
    } finally {
      setLoadingAccess(false);
    }
  };

  const openCreate = () => {
    setSelectedUser(null);
    setIdentity({ full_name: "", username: "", password: "", role: "EMPLOYEE", is_active: true });
    setJob({
      campus_id: "", department_id: "", staff_category_id: "", job_title: "",
      reporting_manager_id: "", join_date: "", monthly_pay: "", payroll_enabled: true,
    });
    setAccess(null);
    setDraftPackIds([]);
    setDraftGrants({});
    setDraftActionGrants({});
    setExpandedTiles({});
    setDraftScope(EMPTY_SCOPE);
    setLoadedScope(EMPTY_SCOPE);
    setTab("identity");
    setDrawerOpen(true);
    api.get("/v1/access/packs").then(({ data }) => {
      setAccess({
        role: "EMPLOYEE",
        roleTileIds: [],
        packIds: [],
        assignedPacks: [],
        allPacks: (data.data || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          is_system: p.is_system,
          tileIds: (p.tiles || []).map((t: any) => t.tile_id),
          tileActions: (p.tileActions || []) as TileActionRef[],
        })),
        grants: [],
        actionGrants: [],
        scope: EMPTY_SCOPE,
      });
    }).catch(() => undefined);
  };

  const openEdit = (user: StaffUser) => {
    setSelectedUser(user);
    setIdentity({
      full_name: user.full_name,
      username: user.username,
      password: "",
      role: user.role,
      is_active: user.is_active,
    });
    const ep = user.employee_profile;
    setJob({
      campus_id: ep?.campus_id ? String(ep.campus_id) : (user.campus_id ? String(user.campus_id) : ""),
      department_id: ep?.department_id ? String(ep.department_id) : "",
      staff_category_id: ep?.staff_category_id ? String(ep.staff_category_id) : "",
      job_title: ep?.job_title ?? "",
      reporting_manager_id: ep?.reporting_manager_id ? String(ep.reporting_manager_id) : "",
      join_date: ep?.join_date ? String(ep.join_date).slice(0, 10) : "",
      monthly_pay: ep?.monthly_pay != null ? String(ep.monthly_pay) : "",
      payroll_enabled: ep?.payroll_enabled ?? true,
    });
    setTab("identity");
    setDrawerOpen(true);
    void loadAccess(user.id);
  };

  const saveIdentity = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      await api.put(`/v1/users/${selectedUser.id}`, {
        full_name: identity.full_name,
        is_active: identity.is_active,
        password: identity.password || undefined,
        ...(isSuperAdmin ? { role: identity.role } : {}),
      });
      toast.success("Identity saved");
      await fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to save identity");
    } finally {
      setSubmitting(false);
    }
  };

  const saveJob = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      const payload = {
        campus_id: job.campus_id ? Number(job.campus_id) : null,
        department_id: job.department_id ? Number(job.department_id) : null,
        staff_category_id: job.staff_category_id ? Number(job.staff_category_id) : null,
        job_title: job.job_title || null,
        reporting_manager_id: job.reporting_manager_id ? Number(job.reporting_manager_id) : null,
        join_date: job.join_date || null,
        monthly_pay: job.monthly_pay ? Number(job.monthly_pay) : null,
        payroll_enabled: job.payroll_enabled,
        full_name: identity.full_name,
      };
      if (selectedUser.employee_profile) {
        await hrService.updateEmployee(selectedUser.employee_profile.id, payload);
      } else {
        await hrService.createEmployee({ ...payload, user_id: selectedUser.id });
      }
      toast.success("Job assignment saved");
      await fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to save job");
    } finally {
      setSubmitting(false);
    }
  };

  const saveAccess = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      await api.put(`/v1/access/users/${selectedUser.id}/access`, {
        packIds: draftPackIds,
        tileGrants: Object.entries(draftGrants).map(([tileId, allow]) => ({ tileId, allow })),
        // Sent only when sub-permissions are actually in play. The backend
        // rewrites user_tile_action_grants whenever this field is present, and
        // that write is NOT migration-guarded — always sending it would break
        // every access save until 20260912130000 is deployed.
        ...(hasActionOverrides
          ? {
            tileActionGrants: Object.entries(draftActionGrants).map(([key, allow]) => {
              const [tileId, actionId] = key.split("#");
              return { tileId, actionId, allow };
            }),
          }
          : {}),
        // Omitted when untouched: the backend leaves scope alone without it,
        // and every send writes one audit row.
        ...(scopeDirty ? { scope: draftScope } : {}),
      });
      toast.success(`${scopeDirty ? "Access and scope" : "Access"} saved — they will see changes after refresh`);
      await loadAccess(selectedUser.id);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to save access");
    } finally {
      setSubmitting(false);
    }
  };

  const createPerson = async () => {
    if (!identity.full_name.trim() || !identity.username.trim() || !identity.password) {
      toast.error("Full name, username and password are required");
      setTab("identity");
      return;
    }
    setSubmitting(true);
    try {
      await hrService.createEmployee({
        full_name: identity.full_name,
        campus_id: job.campus_id ? Number(job.campus_id) : undefined,
        department_id: job.department_id ? Number(job.department_id) : undefined,
        staff_category_id: job.staff_category_id ? Number(job.staff_category_id) : undefined,
        job_title: job.job_title || undefined,
        reporting_manager_id: job.reporting_manager_id ? Number(job.reporting_manager_id) : undefined,
        join_date: job.join_date || undefined,
        monthly_pay: job.monthly_pay ? Number(job.monthly_pay) : undefined,
        payroll_enabled: job.payroll_enabled,
        portal_account: {
          username: identity.username,
          password: identity.password,
          role: identity.role,
          campus_id: job.campus_id ? Number(job.campus_id) : undefined,
        },
        packIds: draftPackIds,
        tileGrants: Object.entries(draftGrants).map(([tileId, allow]) => ({ tileId, allow })),
      });
      toast.success("Person created");
      setDrawerOpen(false);
      await fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create person");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleUserActive = async (user: StaffUser) => {
    try {
      await api.put(`/v1/users/${user.id}`, { is_active: !user.is_active });
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_active: !u.is_active } : u));
    } catch {
      toast.error("Failed to toggle status");
    }
  };

  const openRevealPassword = async (user: StaffUser) => {
    setRevealUser(user);
    setRevealedPassword(null);
    setRevealError(null);
    setRevealCopied(false);
    setRevealing(true);
    try {
      const { data } = await api.get(`/v1/users/${user.id}/reveal-password`);
      setRevealedPassword(data.data.password);
    } catch (error: any) {
      setRevealError(error.response?.data?.message || "Failed to reveal password.");
    } finally {
      setRevealing(false);
    }
  };

  const tileState = (tileId: string): "inherited" | "allowed" | "denied" | "off" => {
    if (tileId in draftGrants) return draftGrants[tileId] ? "allowed" : "denied";
    const inherited =
      (access?.roleTileIds ?? []).includes(tileId) ||
      (access?.allPacks ?? []).some((p) => draftPackIds.includes(p.id) && p.tileIds.includes(tileId));
    return inherited ? "inherited" : "off";
  };

  const tileSources = (tileId: string): string[] => {
    const sources: string[] = [];
    if (access?.roleTileIds.includes(tileId)) sources.push(`Role (${(access?.role ?? identity.role).replace(/_/g, " ")})`);
    (access?.allPacks ?? [])
      .filter((p) => draftPackIds.includes(p.id) && p.tileIds.includes(tileId))
      .forEach((p) => sources.push(p.name));
    return sources;
  };

  /**
   * State of one sub-permission. `off` means the tile itself is not held, in
   * which case the action is unreachable no matter what is granted here.
   */
  const actionState = (
    tileId: string,
    action: { id: string; default: boolean },
  ): "inherited" | "allowed" | "denied" | "off" => {
    const key = `${tileId}#${action.id}`;
    if (key in draftActionGrants) return draftActionGrants[key] ? "allowed" : "denied";
    if (tileState(tileId) === "denied" || tileState(tileId) === "off") return "off";
    if (action.default) return "inherited";
    const fromPack = (access?.allPacks ?? []).some(
      (p) => draftPackIds.includes(p.id) &&
        (p.tileActions ?? []).some((a) => a.tileId === tileId && a.actionId === action.id),
    );
    return fromPack ? "inherited" : "off";
  };

  /**
   * True once this user has any sub-permission override, drafted or stored —
   * the latter so clearing the last one still sends the empty list that wipes
   * it, rather than omitting the field and leaving it behind.
   */
  const hasActionOverrides =
    Object.keys(draftActionGrants).length > 0 || (access?.actionGrants?.length ?? 0) > 0;

  const scopeDirty = useMemo(
    () => SCOPE_DIMENSIONS.some(({ key }) => {
      const a = [...(draftScope[key] ?? [])].sort();
      const b = [...(loadedScope[key] ?? [])].sort();
      return a.length !== b.length || a.some((v, i) => v !== b[i]);
    }),
    [draftScope, loadedScope],
  );

  /**
   * Options for one dimension, narrowed by its parent dimension when that
   * parent is restricted — classes by segment, staff categories by department.
   */
  const optionsFor = (dim: ScopeDimension): ScopeOption[] => {
    const all = scopeOptions?.[dim] ?? [];
    if (dim === "classes" && draftScope.segments.length > 0) {
      return all.filter((o) => o.segmentId != null && draftScope.segments.includes(o.segmentId));
    }
    if (dim === "staffCategories" && draftScope.departments.length > 0) {
      return all.filter((o) => o.departmentId != null && draftScope.departments.includes(o.departmentId));
    }
    return all;
  };

  const toggleScopeId = (dim: ScopeDimension, id: number) => {
    setDraftScope((prev) => {
      const on = prev[dim].includes(id);
      const next: UserScope = {
        ...prev,
        [dim]: on ? prev[dim].filter((v) => v !== id) : [...prev[dim], id],
      };
      // Drop children that just fell outside their narrowed parent, or they
      // would stay selected while invisible in the picker.
      if (dim === "segments" && next.segments.length > 0) {
        const allowed = new Set(
          (scopeOptions?.classes ?? [])
            .filter((c) => c.segmentId != null && next.segments.includes(c.segmentId))
            .map((c) => c.id),
        );
        next.classes = next.classes.filter((c) => allowed.has(c));
      }
      if (dim === "departments" && next.departments.length > 0) {
        const allowed = new Set(
          (scopeOptions?.staffCategories ?? [])
            .filter((c) => c.departmentId != null && next.departments.includes(c.departmentId))
            .map((c) => c.id),
        );
        next.staffCategories = next.staffCategories.filter((c) => allowed.has(c));
      }
      return next;
    });
  };

  const scopeSummary = useMemo(() => {
    const parts = SCOPE_DIMENSIONS
      .filter(({ key }) => draftScope[key].length > 0)
      .map(({ key, label }) => `${label.toLowerCase()} (${draftScope[key].length})`);
    return parts.length === 0
      ? "Unrestricted — this person can reach every record the tiles above allow."
      : `Restricted to ${parts.join(" and ")}. Dimensions narrow each other.`;
  }, [draftScope]);

  const catalogModules = catalog?.modules ?? [];

  return (
    <div className="pb-20 max-w-full">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-2xl text-primary">
              <UserCog className="h-7 w-7" />
            </div>
            People & Access
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
            Create a person, set their job, and grant ERP tiles in one place.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="h-12 px-6 bg-primary hover:bg-primary/90 text-white rounded-2xl font-bold flex items-center gap-2.5 transition-all shadow-lg shadow-primary/20 active:scale-95"
        >
          <UserPlus className="h-5 w-5" />
          New person
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: "People", value: users.length, icon: Users, color: "blue" },
          { label: "Active", value: users.filter((u) => u.is_active).length, icon: Activity, color: "emerald" },
          { label: "On payroll", value: users.filter((u) => u.employee_profile?.payroll_enabled).length, icon: Briefcase, color: "amber" },
        ].map((s) => (
          <div key={s.label} className="p-5 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">{s.label}</p>
              <h4 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mt-1">{s.value}</h4>
            </div>
            <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 text-zinc-600">
              <s.icon className="h-5 w-5" />
            </div>
          </div>
        ))}
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name or username…"
          className="w-full h-12 pl-11 pr-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm font-medium"
        />
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-3xl overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-zinc-400 font-medium">Loading people…</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-10 text-center text-zinc-400 font-medium">No people match that search.</div>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filteredUsers.map((u) => (
              <li key={u.id} className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                <button onClick={() => openEdit(u)} className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-zinc-900 dark:text-zinc-50 truncate">{u.full_name}</span>
                    <RoleBadge role={u.role} />
                    <StatusBadge active={u.is_active} />
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 truncate">
                    {u.username}
                    {u.employee_profile?.departments?.name ? ` · ${u.employee_profile.departments.name}` : ""}
                    {u.campuses?.campus_name ? ` · ${u.campuses.campus_name}` : ""}
                    {u.employee_profile && !u.employee_profile.payroll_enabled ? " · not on payroll" : ""}
                  </p>
                </button>
                <button onClick={() => openRevealPassword(u)} className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100" title="Reveal password">
                  <Eye className="h-4 w-4" />
                </button>
                <button onClick={() => toggleUserActive(u)} className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100" title={u.is_active ? "Deactivate" : "Activate"}>
                  {u.is_active ? <UserMinus className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-40" onClick={() => setDrawerOpen(false)} />
            <motion.aside
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-white dark:bg-zinc-950 z-50 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
                <div>
                  <h2 className="text-lg font-black">{selectedUser ? selectedUser.full_name : "New person"}</h2>
                  <p className="text-xs text-zinc-400 font-medium">{selectedUser ? selectedUser.username : "Login + job + tiles in one create"}</p>
                </div>
                <button onClick={() => setDrawerOpen(false)} className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900"><X className="h-5 w-5" /></button>
              </div>
              <div className="flex gap-1 px-6 pt-3">
                {(["identity", "job", "access", "scope"] as DrawerTab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider ${tab === t ? "bg-primary text-white" : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {tab === "identity" && (
                  <>
                    <label className="block text-xs font-bold text-zinc-500">Full name
                      <input value={identity.full_name} onChange={(e) => setIdentity({ ...identity, full_name: e.target.value })} className="mt-1 w-full h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm font-medium" />
                    </label>
                    <label className="block text-xs font-bold text-zinc-500">Username
                      <input value={identity.username} disabled={!!selectedUser} onChange={(e) => setIdentity({ ...identity, username: e.target.value })} className="mt-1 w-full h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm font-medium disabled:opacity-60" />
                    </label>
                    <label className="block text-xs font-bold text-zinc-500">{selectedUser ? "New password (optional)" : "Password"}
                      <input type="password" value={identity.password} onChange={(e) => setIdentity({ ...identity, password: e.target.value })} className="mt-1 w-full h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm font-medium" />
                    </label>
                    <label className="block text-xs font-bold text-zinc-500">Base role
                      <select
                        value={identity.role}
                        disabled={!!selectedUser && !isSuperAdmin}
                        onChange={(e) => setIdentity({ ...identity, role: e.target.value as StaffRole })}
                        className="mt-1 w-full h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm font-medium disabled:opacity-60"
                      >
                        {STAFF_ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                      </select>
                    </label>
                    {selectedUser && (
                      <label className="flex items-center gap-3 text-sm font-semibold">
                        <input type="checkbox" checked={identity.is_active} onChange={(e) => setIdentity({ ...identity, is_active: e.target.checked })} />
                        Active
                      </label>
                    )}
                    {selectedUser && (
                      <button type="button" onClick={() => openRevealPassword(selectedUser)} className="text-xs font-bold text-primary flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" /> Reveal password
                      </button>
                    )}
                  </>
                )}

                {tab === "job" && (
                  <>
                    <label className="block text-xs font-bold text-zinc-500">Campus
                      <select value={job.campus_id} onChange={(e) => setJob({ ...job, campus_id: e.target.value })} className="mt-1 w-full h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm font-medium">
                        <option value="">—</option>
                        {campuses.map((c) => <option key={c.id} value={c.id}>{c.campus_name}</option>)}
                      </select>
                    </label>
                    <label className="block text-xs font-bold text-zinc-500">Department
                      <select value={job.department_id} onChange={(e) => setJob({ ...job, department_id: e.target.value, staff_category_id: "" })} className="mt-1 w-full h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm font-medium">
                        <option value="">—</option>
                        {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </label>
                    <label className="block text-xs font-bold text-zinc-500">Staff category
                      <select value={job.staff_category_id} onChange={(e) => setJob({ ...job, staff_category_id: e.target.value })} className="mt-1 w-full h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm font-medium">
                        <option value="">—</option>
                        {staffCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </label>
                    <label className="block text-xs font-bold text-zinc-500">Job title
                      <input value={job.job_title} onChange={(e) => setJob({ ...job, job_title: e.target.value })} className="mt-1 w-full h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm font-medium" />
                    </label>
                    <label className="block text-xs font-bold text-zinc-500">Reporting manager
                      <select value={job.reporting_manager_id} onChange={(e) => setJob({ ...job, reporting_manager_id: e.target.value })} className="mt-1 w-full h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm font-medium">
                        <option value="">—</option>
                        {managers.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.employee_code || `#${m.id}`}</option>)}
                      </select>
                    </label>
                    <label className="block text-xs font-bold text-zinc-500">Join date
                      <input type="date" value={job.join_date} onChange={(e) => setJob({ ...job, join_date: e.target.value })} className="mt-1 w-full h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm font-medium" />
                    </label>
                    <label className="block text-xs font-bold text-zinc-500">Monthly pay
                      <input type="number" value={job.monthly_pay} onChange={(e) => setJob({ ...job, monthly_pay: e.target.value, payroll_enabled: e.target.value ? job.payroll_enabled : false })} className="mt-1 w-full h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm font-medium" />
                    </label>
                    <label className="flex items-center justify-between text-sm font-semibold p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                      On payroll
                      <input type="checkbox" checked={job.payroll_enabled} onChange={(e) => setJob({ ...job, payroll_enabled: e.target.checked })} />
                    </label>
                    {selectedUser?.employee_profile && (
                      <Link href={`/hr/employees/${selectedUser.employee_profile.id}`} className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
                        <Link2 className="h-3.5 w-3.5" /> Open full HR profile
                      </Link>
                    )}
                  </>
                )}

                {tab === "access" && (
                  <>
                    {loadingAccess && <p className="text-sm text-zinc-400">Loading access…</p>}
                    <div className="flex items-center gap-2">
                      <RoleBadge role={selectedUser?.role ?? identity.role} />
                      <span className="text-[11px] text-zinc-400 font-medium">Role baseline stays; packs and tiles add on top.</span>
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-2">Access packs</p>
                      <div className="flex flex-wrap gap-2">
                        {(access?.allPacks ?? []).map((p) => {
                          const on = draftPackIds.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setDraftPackIds((prev) => on ? prev.filter((id) => id !== p.id) : [...prev, p.id])}
                              className={`px-3 py-1.5 rounded-full text-xs font-bold border ${on ? "bg-primary text-white border-primary" : "border-zinc-200 dark:border-zinc-800 text-zinc-500"}`}
                            >
                              {p.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-5">
                      {catalogModules.map((mod) => (
                        <div key={mod.id}>
                          <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-2">{mod.id.replace(/-/g, " ")}</p>
                          <ul className="space-y-1">
                            {mod.tiles.map((tile) => {
                              const state = tileState(tile.id);
                              const sources = tileSources(tile.id);
                              const actions = tile.actions ?? [];
                              const expanded = !!expandedTiles[tile.id];
                              const overrideCount = actions.filter((a) => `${tile.id}#${a.id}` in draftActionGrants).length;
                              return (
                                <li key={tile.id} className="rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900">
                                  <div className="flex items-center gap-2 py-1.5 px-2">
                                    {actions.length > 0 ? (
                                      <button
                                        type="button"
                                        title={expanded ? "Hide sub-permissions" : "Show sub-permissions"}
                                        onClick={() => setExpandedTiles((e) => ({ ...e, [tile.id]: !expanded }))}
                                        className="p-1 -ml-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 shrink-0"
                                      >
                                        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                      </button>
                                    ) : (
                                      <span className="w-[22px] shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold truncate">
                                        {tile.label}
                                        {actions.length > 0 && (
                                          <span className="ml-2 text-[10px] font-bold text-zinc-400">
                                            {overrideCount > 0 ? `${overrideCount} override${overrideCount > 1 ? "s" : ""}` : `${actions.length} sub-permissions`}
                                          </span>
                                        )}
                                      </p>
                                      {state === "inherited" && sources.length > 0 && (
                                        <p className="text-[10px] text-zinc-400 truncate">via {sources.join(", ")}</p>
                                      )}
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                      <button type="button" title="Inherited / clear" onClick={() => setDraftGrants((g) => { const n = { ...g }; delete n[tile.id]; return n; })} className={`p-1.5 rounded-lg ${state === "inherited" || state === "off" ? "bg-zinc-100 text-zinc-500" : "text-zinc-300"}`}>
                                        <Minus className="h-3.5 w-3.5" />
                                      </button>
                                      <button type="button" title="Allow" onClick={() => setDraftGrants((g) => ({ ...g, [tile.id]: true }))} className={`p-1.5 rounded-lg ${state === "allowed" ? "bg-emerald-100 text-emerald-700" : "text-zinc-300"}`}>
                                        <Check className="h-3.5 w-3.5" />
                                      </button>
                                      <button type="button" title="Deny" onClick={() => setDraftGrants((g) => ({ ...g, [tile.id]: false }))} className={`p-1.5 rounded-lg ${state === "denied" ? "bg-rose-100 text-rose-700" : "text-zinc-300"}`}>
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  {expanded && actions.length > 0 && (
                                    <ul className="ml-6 mb-2 pl-3 border-l border-zinc-200 dark:border-zinc-800 space-y-0.5">
                                      {(state === "off" || state === "denied") && (
                                        <li className="py-1 text-[10px] font-bold text-amber-600">
                                          The tile itself is not granted — these do nothing until it is.
                                        </li>
                                      )}
                                      {actions.map((action) => {
                                        const aState = actionState(tile.id, action);
                                        const key = `${tile.id}#${action.id}`;
                                        return (
                                          <li key={key} className="flex items-center gap-2 py-1 px-2 rounded-lg">
                                            <div className="flex-1 min-w-0">
                                              <p className="text-xs font-semibold truncate">
                                                {action.label}
                                                {action.default && <span className="ml-2 text-[9px] font-bold uppercase text-zinc-400">default</span>}
                                              </p>
                                              {action.description && (
                                                <p className="text-[10px] text-zinc-400 truncate">{action.description}</p>
                                              )}
                                            </div>
                                            <div className="flex gap-1 shrink-0">
                                              <button type="button" title="Inherited / clear" onClick={() => setDraftActionGrants((g) => { const n = { ...g }; delete n[key]; return n; })} className={`p-1 rounded-md ${aState === "inherited" || aState === "off" ? "bg-zinc-100 text-zinc-500" : "text-zinc-300"}`}>
                                                <Minus className="h-3 w-3" />
                                              </button>
                                              <button type="button" title="Allow" onClick={() => setDraftActionGrants((g) => ({ ...g, [key]: true }))} className={`p-1 rounded-md ${aState === "allowed" ? "bg-emerald-100 text-emerald-700" : "text-zinc-300"}`}>
                                                <Check className="h-3 w-3" />
                                              </button>
                                              <button type="button" title="Deny — beats every grant" onClick={() => setDraftActionGrants((g) => ({ ...g, [key]: false }))} className={`p-1 rounded-md ${aState === "denied" ? "bg-rose-100 text-rose-700" : "text-zinc-300"}`}>
                                                <X className="h-3 w-3" />
                                              </button>
                                            </div>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {tab === "scope" && (
                  <>
                    {!selectedUser && (
                      <p className="text-sm text-zinc-400">Create the person first, then set their scope.</p>
                    )}
                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900">
                      <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-1">Which records they may touch</p>
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{scopeSummary}</p>
                      <p className="text-[10px] text-zinc-400 mt-1">
                        Leave a dimension empty for <strong>All</strong>. Once restricted, records with no value on that dimension fall outside it.
                      </p>
                    </div>
                    {!scopeOptions && <p className="text-sm text-zinc-400">Loading scope options…</p>}
                    {scopeOptions && SCOPE_DIMENSIONS.map(({ key, label, hint }) => {
                      const options = optionsFor(key);
                      const chosen = draftScope[key];
                      return (
                        <div key={key}>
                          <div className="flex items-baseline justify-between mb-1.5">
                            <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">
                              {label}
                              <span className={`ml-2 normal-case tracking-normal font-bold ${chosen.length === 0 ? "text-emerald-600" : "text-primary"}`}>
                                {chosen.length === 0 ? "All" : `${chosen.length} selected`}
                              </span>
                            </p>
                            {chosen.length > 0 && (
                              <button type="button" onClick={() => setDraftScope((p) => ({ ...p, [key]: [] }))} className="text-[10px] font-bold text-zinc-400 hover:text-rose-600">
                                Clear
                              </button>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-400 mb-1.5">{hint}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {options.length === 0 && <span className="text-[11px] text-zinc-400">Nothing to pick.</span>}
                            {options.map((o) => {
                              const on = chosen.includes(o.id);
                              return (
                                <button
                                  key={o.id}
                                  type="button"
                                  onClick={() => toggleScopeId(key, o.id)}
                                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${on ? "bg-primary text-white border-primary" : "border-zinc-200 dark:border-zinc-800 text-zinc-500"}`}
                                >
                                  {o.label || o.code || `#${o.id}`}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
              <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
                {selectedUser ? (
                  <button
                    disabled={submitting}
                    onClick={() => (tab === "identity" ? saveIdentity() : tab === "job" ? saveJob() : saveAccess())}
                    className="w-full h-11 rounded-2xl bg-primary text-white font-bold disabled:opacity-60"
                  >
                    {submitting ? "Saving…" : `Save ${tab}`}
                  </button>
                ) : (
                  <button disabled={submitting} onClick={createPerson} className="w-full h-11 rounded-2xl bg-primary text-white font-bold disabled:opacity-60">
                    {submitting ? "Creating…" : "Create person"}
                  </button>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {revealUser && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 z-[60]" onClick={() => setRevealUser(null)} />
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] w-full max-w-sm bg-white dark:bg-zinc-950 rounded-3xl p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black">Password for {revealUser.username}</h3>
                <button onClick={() => setRevealUser(null)}><X className="h-4 w-4" /></button>
              </div>
              {revealing && <p className="text-sm text-zinc-400">Revealing…</p>}
              {revealError && <p className="text-sm text-rose-600">{revealError}</p>}
              {revealedPassword && (
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono bg-zinc-100 dark:bg-zinc-900 rounded-xl px-3 py-2">{revealedPassword}</code>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(revealedPassword);
                      setRevealCopied(true);
                      setTimeout(() => setRevealCopied(false), 1500);
                    }}
                    className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900"
                  >
                    {revealCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
