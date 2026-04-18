"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Users, 
  UserPlus, 
  Search, 
  ShieldCheck, 
  MoreVertical, 
  X, 
  Check, 
  ShieldAlert, 
  ChevronRight,
  UserCog,
  Building2,
  Calendar,
  Activity,
  UserCheck,
  UserMinus,
  Key,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";
import { toast } from "react-hot-toast";
import { useAppSelector } from "@/store/hooks";

// ── Types ──────────────────────────────────────────────────────────────────

interface StaffUser {
  id: string;
  username: string;
  full_name: string;
  role: string;
  campus_id: number | null;
  is_active: boolean;
  created_at: string;
  campuses: { campus_name: string } | null;
  user_permissions: { id: number; granted: boolean; permissions: { key: string } }[];
}

interface PermissionState {
  permission_id: number;
  key: string;
  module: string;
  description: string;
  role_default: boolean;
  has_override: boolean;
  override_granted: boolean | null;
  effective: boolean;
  source: 'role' | 'override_grant' | 'override_revoke' | 'denied';
  note: string | null;
  override_at: string | null;
}

// ── Components ──────────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
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

// ── Main Page ──────────────────────────────────────────────────────────────

export default function UserManagementPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Drawer States
  const [isUserDrawerOpen, setIsUserDrawerOpen] = useState(false);
  const [isPermDrawerOpen, setIsPermDrawerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    username: "",
    full_name: "",
    password: "",
    role: "RECEPTIONIST",
    campus_id: ""
  });
  const [submitting, setSubmitting] = useState(false);

  // Permissions State
  const [permissions, setPermissions] = useState<PermissionState[]>([]);
  const [loadingPerms, setLoadingPerms] = useState(false);

  // Fetch Data
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get("/v1/users");
      setUsers(data.data || []);
    } catch (error) {
      toast.error("Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Filtering
  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  // Handlers
  const handleCreateOrUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (selectedUser) {
        await api.put(`/v1/users/${selectedUser.id}`, {
          full_name: formData.full_name,
          role: formData.role,
          campus_id: formData.campus_id || null,
          password: formData.password || undefined // Only update if provided
        });
        toast.success("User updated successfully");
      } else {
        await api.post("/v1/users", formData);
        toast.success("User created successfully");
      }
      setIsUserDrawerOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  const openUserDrawer = (user: StaffUser | null = null) => {
    setSelectedUser(user);
    if (user) {
      setFormData({
        username: user.username,
        full_name: user.full_name,
        password: "", // Don't show password
        role: user.role,
        campus_id: user.campus_id ? String(user.campus_id) : ""
      });
    } else {
      setFormData({
        username: "",
        full_name: "",
        password: "",
        role: "RECEPTIONIST",
        campus_id: ""
      });
    }
    setIsUserDrawerOpen(true);
  };

  const openPermDrawer = async (user: StaffUser) => {
    setSelectedUser(user);
    setIsPermDrawerOpen(true);
    setLoadingPerms(true);
    try {
      const { data } = await api.get(`/v1/users/${user.id}/permissions`);
      setPermissions(data.data || []);
    } catch (error) {
      toast.error("Failed to load permissions");
    } finally {
      setLoadingPerms(false);
    }
  };

  const togglePermission = async (perm: PermissionState) => {
    if (!selectedUser) return;
    
    // Optimistic update
    const newGranted = !perm.effective;
    setPermissions(prev => prev.map(p => 
      p.permission_id === perm.permission_id 
      ? { ...p, effective: newGranted, source: newGranted ? 'override_grant' : 'override_revoke', has_override: true } 
      : p
    ));

    try {
      await api.post(`/v1/users/${selectedUser.id}/permissions`, {
        permission_key: perm.key,
        granted: newGranted,
        note: `Manual override for ${selectedUser.username}`
      });
      toast.success(`${perm.key} ${newGranted ? 'granted' : 'revoked'}`);
    } catch (error) {
      toast.error("Failed to update permission");
      // Revert if failed
      const { data } = await api.get(`/v1/users/${selectedUser.id}/permissions`);
      setPermissions(data.data);
    }
  };

  const resetPermission = async (perm: PermissionState) => {
    if (!selectedUser) return;
    try {
      await api.delete(`/v1/users/${selectedUser.id}/permissions/${perm.key}`);
      const { data } = await api.get(`/v1/users/${selectedUser.id}/permissions`);
      setPermissions(data.data);
      toast.success(`Restored ${perm.key} to default`);
    } catch (error) {
      toast.error("Failed to reset permission");
    }
  };

  const toggleUserActive = async (user: StaffUser) => {
    try {
      await api.put(`/v1/users/${user.id}`, { is_active: !user.is_active });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u));
      toast.success(`User ${user.is_active ? 'deactivated' : 'activated'}`);
    } catch (error) {
      toast.error("Failed to toggle user status");
    }
  };

  // Permission Grouping
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, PermissionState[]> = {};
    permissions.forEach(p => {
      if (!groups[p.module]) groups[p.module] = [];
      groups[p.module].push(p);
    });
    return groups;
  }, [permissions]);

  return (
    <div className="pb-20 max-w-full">
      {/* Page Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-2xl text-primary">
              <UserCog className="h-7 w-7" />
            </div>
            User Management
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium">Control system access, roles, and granular permission overrides.</p>
        </div>
        
        <button 
          onClick={() => openUserDrawer()}
          className="h-12 px-6 bg-primary hover:bg-primary/90 text-white rounded-2xl font-bold flex items-center gap-2.5 transition-all shadow-lg shadow-primary/20 active:scale-95 group"
        >
          <UserPlus className="h-5 w-5 group-hover:scale-110 transition-transform" />
          Create New User
        </button>
      </div>

      {/* Stats/Quick Info (Mock or Real) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Staff", value: users.length, icon: Users, color: "blue" },
          { label: "Active Now", value: users.filter(u => u.is_active).length, icon: Activity, color: "emerald" },
          { label: "Super Admins", value: users.filter(u => u.role === 'SUPER_ADMIN').length, icon: ShieldCheck, color: "violet" },
          { label: "Overridden", value: users.filter(u => u.user_permissions.length > 0).length, icon: ShieldAlert, color: "amber" },
        ].map((s, i) => (
          <div key={i} className="p-5 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl shadow-sm flex items-center justify-between group hover:border-primary/20 transition-colors">
            <div>
              <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">{s.label}</p>
              <h4 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mt-1">{s.value}</h4>
            </div>
            <div className={`p-3 rounded-2xl bg-${s.color}-50 dark:bg-${s.color}-950 text-${s.color}-600 dark:text-${s.color}-400 group-hover:scale-110 transition-transform`}>
              <s.icon className="h-5 w-5" />
            </div>
          </div>
        ))}
      </div>

      {/* Search & Toolbar */}
      <div className="mb-6 flex items-center gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-primary transition-colors" />
          <input 
            type="text"
            placeholder="Search staff by name or username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-14 pl-12 pr-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:border-primary transition-all font-medium text-[15px] shadow-sm focus:ring-4 focus:ring-primary/5 shadow-zinc-200/50"
          />
        </div>
      </div>

      {/* Users Table (Desktop) / Cards (Mobile) */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-xl shadow-zinc-200/20">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
             <div className="h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
             <p className="text-zinc-500 font-bold animate-pulse">Loading system users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-32 text-center flex flex-col items-center gap-4">
            <div className="p-6 bg-zinc-50 dark:bg-zinc-950 rounded-[2rem]">
              <Users className="h-12 w-12 text-zinc-300" />
            </div>
            <div>
              <p className="text-xl font-bold text-zinc-800 dark:text-zinc-200">No users found</p>
              <p className="text-zinc-500 mt-1 font-medium">Try adjusting your search criteria</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/50 dark:bg-zinc-950/50 border-b border-zinc-100 dark:border-zinc-800">
                  <th className="px-8 py-5 text-[11px] font-black text-zinc-400 uppercase tracking-widest">Name & Access</th>
                  <th className="px-6 py-5 text-[11px] font-black text-zinc-400 uppercase tracking-widest">Role</th>
                  <th className="px-6 py-5 text-[11px] font-black text-zinc-400 uppercase tracking-widest">Campus</th>
                  <th className="px-6 py-5 text-[11px] font-black text-zinc-400 uppercase tracking-widest">Status</th>
                  <th className="px-8 py-5 text-[11px] font-black text-zinc-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className={`h-11 w-11 rounded-2xl flex items-center justify-center font-black text-sm border-2 border-white dark:border-zinc-800 shadow-sm transition-transform group-hover:scale-110 ${
                          user.is_active ? "bg-primary text-white" : "bg-zinc-200 text-zinc-500"
                        }`}>
                          {user.full_name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-zinc-900 dark:text-zinc-100 transition-colors group-hover:text-primary leading-tight">{user.full_name}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[12px] text-zinc-400 font-mono">@{user.username}</span>
                            {user.user_permissions.length > 0 && (
                              <span title="Explicit permission overrides applied" className="p-0.5 bg-amber-100 text-amber-600 rounded-md">
                                <ShieldAlert size={10} strokeWidth={3} />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="px-6 py-5">
                      {user.campus_id ? (
                        <div className="flex items-center gap-2 text-[13px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-tight">
                          <Building2 className="h-4 w-4 text-zinc-300" />
                          {user.campuses?.campus_name}
                        </div>
                      ) : (
                        <span className="text-[11px] font-black text-zinc-300 uppercase tracking-widest">Global</span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <button onClick={() => toggleUserActive(user)}>
                        <StatusBadge active={user.is_active} />
                      </button>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => openPermDrawer(user)}
                          title="Permissions"
                          className="h-10 w-10 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-primary/10 text-zinc-500 hover:text-primary transition-all active:scale-90"
                        >
                          <ShieldCheck size={18} />
                        </button>
                        <button 
                          onClick={() => openUserDrawer(user)}
                          title="Edit User"
                          className="h-10 w-10 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-50 text-zinc-500 hover:text-blue-600 transition-all active:scale-90"
                        >
                          <UserCog size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── DRAWERS ── */}

      <AnimatePresence>
        {/* User Form Drawer */}
        {isUserDrawerOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsUserDrawerOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-[450px] max-w-[90vw] bg-white dark:bg-zinc-950 z-[110] shadow-2xl flex flex-col border-l border-zinc-200 dark:border-zinc-800"
            >
              <div className="p-8 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between bg-primary/5">
                <div>
                  <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
                    {selectedUser ? "Edit System User" : "Create New User"}
                  </h2>
                  <p className="text-zinc-500 text-sm font-medium mt-1">
                    {selectedUser ? `Modifying access for ${selectedUser.username}` : "Setup new access credentials & role"}
                  </p>
                </div>
                <button onClick={() => setIsUserDrawerOpen(false)} className="p-2 hover:bg-white dark:hover:bg-zinc-900 rounded-2xl text-zinc-400 hover:text-zinc-900 transition-colors">
                  <X />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <form id="user-form" onSubmit={handleCreateOrUpdateUser} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest pl-1">Full Name</label>
                    <input 
                      required
                      type="text"
                      placeholder="e.g. Shuja Muhammad"
                      value={formData.full_name}
                      onChange={e => setFormData({...formData, full_name: e.target.value})}
                      className="w-full h-12 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 text-[15px] font-bold focus:border-primary outline-none transition-all placeholder:text-zinc-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest pl-1">Username</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">@</span>
                      <input 
                        required
                        disabled={!!selectedUser}
                        type="text" 
                        placeholder="username"
                        value={formData.username}
                        onChange={e => setFormData({...formData, username: e.target.value})}
                        className="w-full h-12 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-9 pr-4 text-[15px] font-bold focus:border-primary outline-none transition-all disabled:opacity-50 disabled:bg-zinc-100"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest pl-1">Password {selectedUser && "(Leave blank to keep current)"}</label>
                    <div className="relative">
                      <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                      <input 
                        required={!selectedUser}
                        type="password" 
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                        className="w-full h-12 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-11 pr-4 text-[15px] font-bold focus:border-primary outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest pl-1">System Role</label>
                      <select 
                        required
                        value={formData.role}
                        onChange={e => setFormData({...formData, role: e.target.value})}
                        className="w-full h-12 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 text-[13px] font-bold focus:border-primary outline-none transition-all appearance-none"
                      >
                        <option value="SUPER_ADMIN">SUPER ADMIN</option>
                        <option value="CAMPUS_ADMIN">CAMPUS ADMIN</option>
                        <option value="PRINCIPAL">PRINCIPAL</option>
                        <option value="FINANCE_CLERK">FINANCE CLERK</option>
                        <option value="RECEPTIONIST">RECEPTIONIST</option>
                        <option value="TEACHER">TEACHER</option>
                        <option value="STAFF_EDITOR">STAFF EDITOR</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest pl-1">Assigned Campus</label>
                      <select 
                        value={formData.campus_id}
                        onChange={e => setFormData({...formData, campus_id: e.target.value})}
                        className="w-full h-12 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 text-[13px] font-bold focus:border-primary outline-none transition-all appearance-none"
                      >
                        <option value="">ALL CAMPUSES</option>
                        {/* Note: In a real app we'd fetch this from store or API */}
                        <option value="1">Primary Block</option>
                        <option value="2">Senior Girls</option>
                        <option value="3">Senior Boys</option>
                      </select>
                    </div>
                  </div>
                </form>

                {selectedUser && (
                  <div className="mt-12 p-5 bg-blue-50 dark:bg-zinc-900 border border-blue-100 dark:border-zinc-800 rounded-[2rem] flex gap-4">
                    <div className="h-10 w-10 bg-blue-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center shrink-0 text-blue-600">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-blue-900 dark:text-blue-100 text-sm underline underline-offset-4 cursor-pointer" onClick={() => { setIsUserDrawerOpen(false); openPermDrawer(selectedUser); }}>
                        Manage Permission Overrides
                      </p>
                      <p className="text-[12px] text-blue-700 dark:text-blue-400 mt-1 font-medium leading-relaxed">
                        Granular overrides apply on top of the "{selectedUser.role.replace(/_/g, " ")}" default role permissions.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-zinc-100 dark:border-zinc-900 bg-white dark:bg-zinc-950 sticky bottom-0">
                <button 
                  form="user-form"
                  disabled={submitting}
                  className="w-full h-14 bg-primary text-white rounded-2xl font-black text-lg shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {submitting ? "Processing..." : selectedUser ? "Save Changes" : "Create User Account"}
                </button>
              </div>
            </motion.div>
          </>
        )}

        {/* Permissions Drawer */}
        {isPermDrawerOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsPermDrawerOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 180 }}
              className="fixed inset-y-0 right-0 w-[600px] max-w-[95vw] bg-zinc-50 dark:bg-zinc-950 z-[110] shadow-2xl flex flex-col border-l border-zinc-200 dark:border-zinc-800"
            >
              <div className="p-8 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between bg-zinc-900">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-3xl bg-zinc-800 flex items-center justify-center text-primary border-2 border-zinc-700 shadow-xl font-black text-lg">
                    {selectedUser?.full_name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white leading-tight">Permission Matrix</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                       <RoleBadge role={selectedUser?.role || ""} />
                       <span className="text-zinc-500 text-[12px] font-bold uppercase tracking-widest">• @{selectedUser?.username}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsPermDrawerOpen(false)} className="p-2 hover:bg-zinc-800 rounded-2xl text-zinc-500 hover:text-white transition-colors border border-zinc-800">
                  <X />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-10">
                {loadingPerms ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-4">
                    <div className="h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <p className="text-zinc-500 font-bold">Resolving effective permissions...</p>
                  </div>
                ) : (
                  Object.entries(groupedPermissions).map(([module, perms]) => (
                    <div key={module} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] overflow-hidden shadow-sm">
                      <div className="px-6 py-4 bg-zinc-50/80 dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                         <h3 className="text-[12px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                           <Activity size={14} className="text-primary" />
                           {module.replace(/_/g, " ")} Module
                         </h3>
                         <span className="text-[10px] font-bold text-zinc-300">
                           {perms.filter(p => p.effective).length}/{perms.length} GRANTED
                         </span>
                      </div>
                      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {perms.map(perm => (
                          <div key={perm.key} className="px-6 py-4 flex items-center justify-between group hover:bg-zinc-50/50 transition-colors">
                            <div className="flex-1 min-w-0 pr-4">
                              <div className="flex items-center gap-2">
                                <p className={`font-black tracking-tight text-[14px] ${perm.effective ? 'text-zinc-900' : 'text-zinc-400 line-through'}`}>
                                  {perm.key.split('.').pop()?.replace(/_/g, ' ')}
                                </p>
                                {perm.has_override && (
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${perm.override_granted ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                    OVERRIDE
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-zinc-500 mt-0.5 font-medium">{perm.description}</p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                               {perm.has_override && (
                                 <button 
                                   onClick={() => resetPermission(perm)}
                                   className="h-8 w-8 flex items-center justify-center rounded-lg text-zinc-300 hover:text-rose-500 hover:bg-rose-50 transition-all active:scale-90"
                                   title="Reset to Role Default"
                                 >
                                   <X size={14} />
                                 </button>
                               )}

                               <button 
                                 onClick={() => togglePermission(perm)}
                                 className={`h-9 px-4 rounded-xl flex items-center gap-2 transition-all font-black text-[11px] uppercase tracking-wider ${
                                   perm.effective 
                                   ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                                   : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                                 }`}
                               >
                                 {perm.effective ? <Check size={14} strokeWidth={3} /> : null}
                                 {perm.effective ? "Granted" : "Denied"}
                               </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-8 border-t border-zinc-100 dark:border-zinc-900 bg-white dark:bg-zinc-950 flex gap-4 items-center">
                <div className="h-10 w-10 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400">
                  <Info size={20} />
                </div>
                <p className="text-[12px] text-zinc-500 font-medium leading-relaxed">
                  Permissions are resolved in priority: <strong className="text-zinc-700">Override</strong> &gt; <strong className="text-zinc-700">Role Default</strong>. 
                  Overrides are logged and timestamped for audit trails.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
