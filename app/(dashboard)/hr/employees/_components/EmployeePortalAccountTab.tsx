"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, CheckCircle2, KeyRound } from "lucide-react";
import { hrService, EmployeeProfile } from "@/lib/hr.service";
import { Campus, campusesService } from "@/lib/campuses.service";
import { CLASS_BANDS } from "@/lib/class-bands";
import { useAuthState } from "@/context/AuthContext";

const ALL_STAFF_ROLES = [
  "SUPER_ADMIN",
  "CAMPUS_ADMIN",
  "PRINCIPAL",
  "FINANCE_CLERK",
  "RECEPTIONIST",
  "TEACHER",
  "STAFF_EDITOR",
  "GENERAL_RESPONDENT",
  "EMPLOYEE",
] as const;

const inputCls =
  "w-full h-10 px-3 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">{children}</label>;
}

interface Props {
  employee: EmployeeProfile;
  onUpdated: () => void;
}

export function EmployeePortalAccountTab({ employee, onUpdated }: Props) {
  const { user: currentUser } = useAuthState();
  const user = employee.users;
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [form, setForm] = useState({
    email: "",
    role: "EMPLOYEE",
    campus_id: "",
    is_active: true,
    allowed_class_ids: [] as number[],
  });
  const [selectedBand, setSelectedBand] = useState("");

  const assignableRoles = ALL_STAFF_ROLES.filter(
    (r) => currentUser?.role === "SUPER_ADMIN" || r !== "SUPER_ADMIN",
  );

  useEffect(() => {
    campusesService.list().then(setCampuses).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    const ids = user.allowed_class_ids ?? [];
    const band = CLASS_BANDS.find(
      (b) => [...b.ids].sort((a, c) => a - c).join(",") === [...ids].sort((a, c) => a - c).join(","),
    );
    setForm({
      email: user.email ?? "",
      role: user.role ?? "EMPLOYEE",
      campus_id: user.campus_id != null ? String(user.campus_id) : "",
      is_active: user.is_active ?? true,
      allowed_class_ids: ids,
    });
    setSelectedBand(band?.label ?? "");
  }, [user]);

  if (!user) {
    return (
      <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center text-sm text-zinc-500">
        No portal account linked. Link a user from the Advanced editor.
      </div>
    );
  }

  const showClassAccess = form.role === "TEACHER" || form.role === "STAFF_EDITOR" || form.role === "PRINCIPAL";

  const syncFromAssignments = () => {
    const classIds = [
      ...new Set(
        (employee.employee_class_section_assignments ?? []).map((a) => a.class_id),
      ),
    ];
    setForm((p) => ({ ...p, allowed_class_ids: classIds }));
    setSelectedBand("");
  };

  const handleSaveAccount = async () => {
    setSaving(true);
    setError(null);
    try {
      await hrService.updateEmployeeAccount(employee.id, {
        email: form.email || undefined,
        role: form.role,
        campus_id: form.campus_id ? parseInt(form.campus_id, 10) : null,
        is_active: form.is_active,
        allowed_class_ids: showClassAccess ? form.allowed_class_ids : [],
      });
      setSaved(true);
      onUpdated();
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to update account.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!confirm("Reset this employee's portal password?")) return;
    setResetting(true);
    setError(null);
    try {
      await hrService.resetEmployeePassword(employee.id, password);
      setPassword("");
      setConfirmPassword("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to reset password.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}
      <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-extrabold text-zinc-900 dark:text-zinc-100">Account settings</h3>
          {saved && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" /> Saved
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel>Username</FieldLabel>
            <input className={`${inputCls} bg-zinc-50 dark:bg-zinc-950`} value={user.username ?? "—"} readOnly />
          </div>
          <div>
            <FieldLabel>Email</FieldLabel>
            <input type="email" className={inputCls} value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          </div>
          <div>
            <FieldLabel>Role</FieldLabel>
            <select className={inputCls} value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
              {assignableRoles.map((r) => (
                <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Campus</FieldLabel>
            <select className={inputCls} value={form.campus_id}
              onChange={(e) => setForm((p) => ({ ...p, campus_id: e.target.value }))}>
              <option value="">All campuses</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>{c.campus_name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_active}
                onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                className="rounded border-zinc-300 text-primary focus:ring-primary/30" />
              <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Account active</span>
            </label>
          </div>
          {showClassAccess && (
            <div className="sm:col-span-2 space-y-2">
              <FieldLabel>Allowed classes (roll-call visibility)</FieldLabel>
              <select className={inputCls} value={selectedBand}
                onChange={(e) => {
                  const label = e.target.value;
                  setSelectedBand(label);
                  if (!label) {
                    setForm((p) => ({ ...p, allowed_class_ids: [] }));
                    return;
                  }
                  const band = CLASS_BANDS.find((b) => b.label === label);
                  setForm((p) => ({ ...p, allowed_class_ids: band ? [...band.ids] : [] }));
                }}>
                <option value="">Whole campus</option>
                {CLASS_BANDS.map((b) => (
                  <option key={b.label} value={b.label}>{b.label}</option>
                ))}
              </select>
              <button type="button" onClick={syncFromAssignments}
                className="text-xs font-semibold text-primary hover:underline">
                Sync from HR class assignments
              </button>
            </div>
          )}
        </div>
        <button type="button" onClick={handleSaveAccount} disabled={saving}
          className="mt-4 inline-flex items-center gap-2 h-9 px-4 bg-primary text-white text-xs font-bold rounded-xl disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save account settings
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
        <h3 className="text-[15px] font-extrabold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> Reset password
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
          <div>
            <FieldLabel>New password</FieldLabel>
            <input type="password" className={inputCls} value={password}
              onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <div>
            <FieldLabel>Confirm password</FieldLabel>
            <input type="password" className={inputCls} value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
          </div>
        </div>
        <button type="button" onClick={handleResetPassword} disabled={resetting}
          className="mt-4 inline-flex items-center gap-2 h-9 px-4 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-xl disabled:opacity-50">
          {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Reset password
        </button>
      </div>
    </div>
  );
}
