"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  ShieldCheck, 
  ShieldAlert, 
  Search, 
  Check, 
  Info, 
  Activity,
  Users,
  Settings,
  ChevronRight,
  Lock,
  Unlock,
  Building2,
  GraduationCap,
  Wallet,
  Briefcase
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";
import { toast } from "react-hot-toast";

// ── Types ──────────────────────────────────────────────────────────────────

type StaffRole = 'SUPER_ADMIN' | 'CAMPUS_ADMIN' | 'PRINCIPAL' | 'FINANCE_CLERK' | 'RECEPTIONIST' | 'TEACHER' | 'STAFF_EDITOR';

interface PermissionEntry {
  id: number;
  key: string;
  module: string;
  description: string;
}

const ROLE_CONFIG: Record<StaffRole, { label: string; icon: any; color: string; desc: string }> = {
  SUPER_ADMIN:   { label: "Super Admin",   icon: ShieldCheck, color: "violet",  desc: "Full system access & administration" },
  CAMPUS_ADMIN:  { label: "Campus Admin",  icon: Building2,   color: "blue",    desc: "Management within specific campus" },
  PRINCIPAL:     { label: "Principal",     icon: GraduationCap, color: "emerald", desc: "Academic and staff oversight" },
  FINANCE_CLERK: { label: "Finance Clerk", icon: Wallet,      color: "amber",   desc: "Fee management and financial logs" },
  RECEPTIONIST:  { label: "Receptionist",  icon: Users,       color: "sky",     desc: "Student registration and inquiries" },
  TEACHER:       { label: "Teacher",       icon: Briefcase,   color: "rose",    desc: "Attendance and academic tracking" },
  STAFF_EDITOR:  { label: "Staff Editor",  icon: Settings,    color: "slate",   desc: "Read-only access to staff details" },
};

// ── Main Page ──────────────────────────────────────────────────────────────

export default function RolePermissionsPage() {
  const [selectedRole, setSelectedRole] = useState<StaffRole>('FINANCE_CLERK');
  const [allPermissions, setAllPermissions] = useState<PermissionEntry[]>([]);
  const [rolePermIds, setRolePermIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Initial Fetch
  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const { data: pData } = await api.get("/v1/users/permissions/all");
        setAllPermissions(pData.data || []);
      } catch (error) {
        toast.error("Failed to load permissions list");
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // Fetch role permissions when role changes
  useEffect(() => {
    async function fetchRolePerms() {
      try {
        const { data: rData } = await api.get(`/v1/users/roles/${selectedRole}/permissions`);
        const ids = new Set<number>((rData.data || []).map((p: any) => p.permission_id));
        setRolePermIds(ids);
      } catch (error) {
        toast.error(`Failed to load defaults for ${selectedRole}`);
      }
    }
    fetchRolePerms();
  }, [selectedRole]);

  // Grouping & Filtering
  const groupedPermissions = useMemo(() => {
    const filtered = allPermissions.filter(p => 
      p.key.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.module.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const groups: Record<string, PermissionEntry[]> = {};
    filtered.forEach(p => {
      if (!groups[p.module]) groups[p.module] = [];
      groups[p.module].push(p);
    });
    return groups;
  }, [allPermissions, searchTerm]);

  // Handlers
  const togglePermission = async (perm: PermissionEntry) => {
    setUpdatingId(perm.id);
    const isCurrentlyGranted = rolePermIds.has(perm.id);
    const newGranted = !isCurrentlyGranted;

    try {
      await api.post("/v1/users/roles/permissions", {
        role: selectedRole,
        permission_id: perm.id,
        granted: newGranted
      });
      
      setRolePermIds(prev => {
        const next = new Set(prev);
        if (newGranted) next.add(perm.id);
        else next.delete(perm.id);
        return next;
      });
      
      toast.success(`${newGranted ? 'Added' : 'Removed'} ${perm.key} from ${selectedRole}`);
    } catch (error) {
      toast.error("Failed to update role permission");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="pb-20 max-w-full">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-2xl text-primary">
            <ShieldCheck className="h-7 w-7" />
          </div>
          Role Permission Matrix
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium">Define the global default access levels for every system role.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* Role Selector Sidebar */}
        <div className="xl:col-span-3 space-y-3 sticky top-4">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] pl-2 mb-4">Select System Role</p>
          {(Object.keys(ROLE_CONFIG) as StaffRole[]).map((role) => {
            const cfg = ROLE_CONFIG[role];
            const isSelected = selectedRole === role;
            return (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`w-full p-4 rounded-3xl flex items-center gap-4 transition-all group border text-left ${
                  isSelected 
                  ? `bg-white dark:bg-zinc-900 border-${cfg.color}-200 dark:border-${cfg.color}-800 shadow-lg shadow-${cfg.color}-500/5` 
                  : "bg-transparent border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900"
                }`}
              >
                <div className={`p-2.5 rounded-2xl transition-all ${
                  isSelected 
                  ? `bg-${cfg.color}-100 dark:bg-${cfg.color}-950 text-${cfg.color}-600` 
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 group-hover:text-zinc-600"
                }`}>
                  <cfg.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h4 className={`text-[15px] font-black leading-tight ${isSelected ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500"}`}>
                    {cfg.label}
                  </h4>
                  <p className="text-[11px] text-zinc-400 font-medium truncate mt-0.5">{cfg.desc}</p>
                </div>
                {isSelected && <div className={`ml-auto h-2 w-2 rounded-full bg-${cfg.color}-500 shadow-lg shadow-${cfg.color}-500/50`} />}
              </button>
            );
          })}
        </div>

        {/* Matrix Main Area */}
        <div className="xl:col-span-9 space-y-6">
          
          {/* Internal Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm">
             <div className="relative flex-1 min-w-[300px]">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-300" />
               <input 
                 type="text"
                 placeholder="Search permissions by key or module..."
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full h-11 pl-12 pr-4 bg-zinc-50 dark:bg-zinc-950 border border-transparent rounded-2xl outline-none focus:bg-white dark:focus:bg-zinc-900 focus:border-primary/20 transition-all font-medium text-sm"
               />
             </div>
             <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-zinc-800/50 rounded-2xl border border-blue-100 dark:border-zinc-800">
               <Info className="h-4 w-4 text-blue-500" />
               <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-tight">
                 Editing Defaults for {selectedRole}
               </p>
             </div>
          </div>

          {/* Matrix Grid */}
          {isLoading ? (
             <div className="py-32 flex flex-col items-center justify-center gap-4">
               <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
               <p className="text-zinc-500 font-black animate-pulse">Initializing Permission Matrix...</p>
             </div>
          ) : Object.keys(groupedPermissions).length === 0 ? (
             <div className="py-40 text-center flex flex-col items-center gap-4 bg-zinc-50 dark:bg-zinc-950 rounded-[3rem] border-2 border-dashed border-zinc-200 dark:border-zinc-800">
               <div className="p-6 bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-sm">
                 <ShieldAlert className="h-12 w-12 text-zinc-200" />
               </div>
               <p className="text-xl font-black text-zinc-400">No permissions match your search</p>
             </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedPermissions).map(([module, perms]) => (
                <div key={module} className="group">
                  <div className="flex items-center gap-3 mb-4 px-4">
                    <div className="h-8 w-8 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                      <Activity size={16} strokeWidth={3} />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-800 dark:text-zinc-200">
                      {module.replace(/_/g, " ")}
                    </h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-zinc-200 to-transparent dark:from-zinc-800" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {perms.map((perm) => {
                      const isGranted = rolePermIds.has(perm.id);
                      const isUpdating = updatingId === perm.id;
                      return (
                        <motion.div 
                          key={perm.id}
                          layout
                          className={`p-5 rounded-[2rem] border transition-all flex flex-col justify-between h-[160px] relative overflow-hidden group/card ${
                            isGranted 
                            ? "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm" 
                            : "bg-zinc-50/50 dark:bg-zinc-950/30 border-dashed border-zinc-200 dark:border-zinc-900 opacity-60 hover:opacity-100"
                          }`}
                        >
                          {/* Corner Accent */}
                          <div className={`absolute top-0 right-0 w-24 h-24 blur-3xl opacity-10 transition-opacity ${isGranted ? "bg-primary" : "bg-zinc-400"}`} />

                          <div>
                            <div className="flex items-start justify-between">
                              <h4 className={`text-[15px] font-black leading-tight ${isGranted ? "text-primary" : "text-zinc-600"}`}>
                                {perm.key.split('.').pop()?.replace(/_/g, ' ')}
                              </h4>
                              {isGranted ? <Lock className="h-4 w-4 text-emerald-500 shrink-0" /> : <Unlock className="h-4 w-4 text-zinc-300 shrink-0" />}
                            </div>
                            <p className="text-[11px] text-zinc-500 font-medium mt-1.5 leading-relaxed line-clamp-2">
                              {perm.description}
                            </p>
                          </div>

                          <div className="flex items-center justify-between mt-4">
                            <span className="text-[9px] font-black text-zinc-300 uppercase tracking-widest bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">
                              ID: {perm.id}
                            </span>
                            <button 
                              onClick={() => togglePermission(perm)}
                              disabled={isUpdating}
                              className={`h-10 px-6 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 ${
                                isGranted 
                                ? "bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/50" 
                                : "bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90"
                              }`}
                            >
                              {isUpdating ? (
                                <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : isGranted ? (
                                "Revoke Access"
                              ) : (
                                "Grant Access"
                              )}
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Guidelines / Footer */}
          <div className="mt-12 p-8 bg-zinc-900 rounded-[3rem] text-white overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary rounded-full blur-[120px] opacity-20 group-hover:opacity-30 transition-opacity" />
            <div className="relative z-10 flex gap-6 items-start">
               <div className="p-4 bg-white/10 rounded-3xl backdrop-blur-md">
                 <ShieldCheck className="h-8 w-8 text-primary" />
               </div>
               <div>
                 <h3 className="text-xl font-black mb-2">Security Guidelines</h3>
                 <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                   {[
                     "Defaults apply to all new staff and those without overrides",
                     "Changing defaults is reflected immediately across the system",
                     "Use overrides in User Management for single-user exceptions",
                     "Super Admin role should ideally maintain 100% grant rate",
                     "System permissions are hierarchical (View < Execute < Edit)",
                     "Audit logs track all changes to these global role defaults"
                   ].map((text, i) => (
                     <li key={i} className="flex items-center gap-2 text-zinc-400 text-[13px] font-medium">
                       <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                       {text}
                     </li>
                   ))}
                 </ul>
               </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
