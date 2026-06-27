"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X, Loader2, User, Briefcase, Clock, BookOpen, Trash2,
  Phone, Mail, MapPin, CreditCard, Cake, Calendar, Building2,
  AlertTriangle, Users as UsersIcon, Pencil, Save, CheckCircle2,
} from "lucide-react";
import {
  hrService,
  EmployeeProfile,
  EmployeeCreatePayload,
  Department,
  formatStaffCategory,
  STAFF_CATEGORY_OPTIONS,
} from "@/lib/hr.service";
import { campusesService, Campus } from "@/lib/campuses.service";

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "employment", label: "Employment", icon: Briefcase },
  { id: "schedule", label: "Schedule & Pay", icon: Clock },
  { id: "classes", label: "Class & Sections", icon: BookOpen },
] as const;

type TabId = typeof TABS[number]["id"];

function initials(name: string) {
  return name.split(" ").filter(Boolean).map(n => n[0]).slice(0, 2).join("").toUpperCase();
}

function fmtDate(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function toDateInput(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

function parseTimeInput(value: string | null | undefined) {
  if (!value) return "";
  const match = value.match(/T?(\d{2}:\d{2})/);
  return match ? match[1] : "";
}

function fmtTime(value: string | null) {
  if (!value) return null;
  const match = value.match(/T?(\d{2}:\d{2})/);
  return match ? match[1] : value;
}

function fmtMoney(value: number | null) {
  if (value == null) return null;
  return `₨ ${Number(value).toLocaleString()}`;
}

function formatCnic(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

const inputCls =
  "w-full h-10 px-3 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";
const textareaCls =
  "w-full px-3 py-2 text-[13px] font-medium text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 resize-none";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">{children}</label>;
}

function ReadField({ icon: Icon, label, value, missing }: { icon: any; label: string; value: React.ReactNode; missing?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-400 shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{label}</p>
        {missing ? (
          <p className="text-sm font-medium text-amber-500 flex items-center gap-1 mt-0.5">
            <AlertTriangle className="h-3 w-3" /> Not provided
          </p>
        ) : (
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mt-0.5 break-words">{value}</p>
        )}
      </div>
    </div>
  );
}

function EditableCard({
  title,
  editing,
  saving,
  saved,
  onEdit,
  onCancel,
  onSave,
  children,
  readContent,
}: {
  title: string;
  editing: boolean;
  saving: boolean;
  saved: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  children: React.ReactNode;
  readContent: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 relative">
      <div className="absolute top-5 right-5 flex items-center gap-2">
        {saved && (
          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Saved
          </span>
        )}
        {editing ? (
          <>
            <button
              type="button"
              onClick={onCancel}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 h-8 text-[11px] font-bold text-white bg-primary hover:bg-primary/90 rounded-xl disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onEdit}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>
      <h3 className="text-[15px] font-extrabold text-zinc-900 dark:text-zinc-100 mb-4 pr-24">{title}</h3>
      {editing ? children : <div className="divide-y divide-zinc-100 dark:divide-zinc-800">{readContent}</div>}
    </div>
  );
}

interface Props {
  employeeId: number | null;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

export function EmployeeDetailPanel({ employeeId, onClose, onUpdated, onDeleted }: Props) {
  const router = useRouter();
  const [emp, setEmp] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<TabId>("profile");
  const [deleting, setDeleting] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);

  const [editProfile, setEditProfile] = useState(false);
  const [editEmployment, setEditEmployment] = useState(false);
  const [editSchedule, setEditSchedule] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmployment, setSavingEmployment] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [savedEmployment, setSavedEmployment] = useState(false);
  const [savedSchedule, setSavedSchedule] = useState(false);

  const [profileForm, setProfileForm] = useState({
    full_name: "", father_name: "", mother_name: "", cnic: "", date_of_birth: "",
    personal_phone: "", personal_email: "", address: "", notes: "",
  });
  const [employmentForm, setEmploymentForm] = useState({
    employee_code: "", department_id: "", staff_category: "", job_title: "",
    campus_id: "", join_date: "", job_description: "",
  });
  const [scheduleForm, setScheduleForm] = useState({
    reporting_time: "", leaving_time: "", late_relaxation_minutes: "", days_per_week: "", monthly_pay: "",
  });

  const syncForms = useCallback((employee: EmployeeProfile) => {
    setProfileForm({
      full_name: employee.full_name ?? "",
      father_name: employee.father_name ?? "",
      mother_name: employee.mother_name ?? "",
      cnic: employee.cnic ?? "",
      date_of_birth: toDateInput(employee.date_of_birth),
      personal_phone: employee.personal_phone ?? "",
      personal_email: employee.personal_email ?? "",
      address: employee.address ?? "",
      notes: employee.notes ?? "",
    });
    setEmploymentForm({
      employee_code: employee.employee_code ?? "",
      department_id: employee.department_id ? String(employee.department_id) : "",
      staff_category: employee.staff_category ?? "",
      job_title: employee.job_title ?? "",
      campus_id: employee.campus_id ? String(employee.campus_id) : "",
      join_date: toDateInput(employee.join_date),
      job_description: employee.job_description ?? "",
    });
    setScheduleForm({
      reporting_time: parseTimeInput(employee.reporting_time),
      leaving_time: parseTimeInput(employee.leaving_time),
      late_relaxation_minutes: employee.late_relaxation_minutes != null ? String(employee.late_relaxation_minutes) : "",
      days_per_week: employee.days_per_week != null ? String(employee.days_per_week) : "",
      monthly_pay: employee.monthly_pay != null ? String(employee.monthly_pay) : "",
    });
  }, []);

  const reload = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const data = await hrService.getEmployee(employeeId);
      setEmp(data);
      syncForms(data);
    } catch {
      setEmp(null);
    } finally {
      setLoading(false);
    }
  }, [employeeId, syncForms]);

  useEffect(() => {
    if (!employeeId) {
      setEmp(null);
      setTab("profile");
      setEditProfile(false);
      setEditEmployment(false);
      setEditSchedule(false);
      return;
    }
    reload();
    hrService.listDepartments().then(setDepartments).catch(() => {});
    campusesService.list().then(setCampuses).catch(() => {});
  }, [employeeId, reload]);

  const patch = async (
    payload: Partial<EmployeeCreatePayload>,
    setSaving: (v: boolean) => void,
    setSaved: (v: boolean) => void,
    closeEdit: () => void,
  ) => {
    if (!emp) return;
    setSaving(true);
    try {
      const updated = await hrService.updateEmployee(emp.id, payload);
      setEmp(updated);
      syncForms(updated);
      setSaved(true);
      closeEdit();
      onUpdated();
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to update employee.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!emp) return;
    const name = emp.full_name || emp.users?.full_name || `Profile #${emp.id}`;
    if (!confirm(`Are you sure you want to delete ${name}'s employee profile? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await hrService.deleteEmployee(emp.id);
      onDeleted();
      onClose();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to delete employee profile.");
    } finally {
      setDeleting(false);
    }
  };

  if (!employeeId) return null;

  const name = emp?.full_name || emp?.users?.full_name || (loading ? "Loading…" : `Profile #${employeeId}`);

  const assignmentsByClass = new Map<string, { sections: string[] }>();
  if (emp?.employee_class_section_assignments) {
    for (const a of emp.employee_class_section_assignments) {
      const key = a.classes ? `${a.classes.description} (${a.classes.class_code})` : `Class #${a.class_id}`;
      const sec = a.sections?.description || `Section #${a.section_id}`;
      if (!assignmentsByClass.has(key)) assignmentsByClass.set(key, { sections: [] });
      assignmentsByClass.get(key)!.sections.push(sec);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl h-[85vh] bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {emp?.photo_url ? (
              <img
                src={emp.photo_url.replace(/([^:])\/\//g, "$1/")}
                alt={name}
                className="h-12 w-12 rounded-2xl object-cover bg-zinc-100 shrink-0"
              />
            ) : (
              <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                {initials(name)}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-[17px] font-black text-zinc-900 dark:text-zinc-100 tracking-tight truncate">{name}</h2>
              <p className="text-[11px] text-zinc-400 font-mono mt-0.5 truncate">
                {emp?.employee_code || "—"}
                {emp?.job_title ? ` · ${emp.job_title}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {emp && (
              <button
                type="button"
                onClick={() => router.push(`/hr/employees/${emp.id}/edit`)}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
              >
                Advanced
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || !emp}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100 transition-all disabled:opacity-50"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete
            </button>
            <button type="button" onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-zinc-600">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex items-center px-6 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3.5 text-[13px] font-bold transition-all border-b-2 -mb-[1px] whitespace-nowrap ${
                tab === t.id ? "border-primary text-primary" : "border-transparent text-zinc-400 hover:text-zinc-600"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto bg-zinc-50/50 dark:bg-zinc-950/20">
          <div className="p-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {loading || !emp ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-sm text-zinc-500 mt-3">Loading employee…</p>
              </div>
            ) : (
              <>
                {tab === "profile" && (
                  <EditableCard
                    title="Personal information"
                    editing={editProfile}
                    saving={savingProfile}
                    saved={savedProfile}
                    onEdit={() => setEditProfile(true)}
                    onCancel={() => { setEditProfile(false); syncForms(emp); }}
                    onSave={() => patch({
                      full_name: profileForm.full_name || undefined,
                      father_name: profileForm.father_name || undefined,
                      mother_name: profileForm.mother_name || undefined,
                      cnic: profileForm.cnic || undefined,
                      date_of_birth: profileForm.date_of_birth || undefined,
                      personal_phone: profileForm.personal_phone || undefined,
                      personal_email: profileForm.personal_email || undefined,
                      address: profileForm.address || undefined,
                      notes: profileForm.notes || undefined,
                    }, setSavingProfile, setSavedProfile, () => setEditProfile(false))}
                    readContent={
                      <>
                        <ReadField icon={User} label="Full Name" value={emp.full_name} missing={!emp.full_name} />
                        <ReadField icon={User} label="Father's Name" value={emp.father_name} missing={!emp.father_name} />
                        <ReadField icon={User} label="Mother's Name" value={emp.mother_name} missing={!emp.mother_name} />
                        <ReadField icon={CreditCard} label="CNIC" value={<span className="font-mono">{emp.cnic}</span>} missing={!emp.cnic} />
                        <ReadField icon={Cake} label="Date of Birth" value={fmtDate(emp.date_of_birth)} missing={!fmtDate(emp.date_of_birth)} />
                        <ReadField icon={Phone} label="Personal Phone" value={emp.personal_phone} missing={!emp.personal_phone} />
                        <ReadField icon={Mail} label="Personal Email" value={emp.personal_email} missing={!emp.personal_email} />
                        <ReadField icon={MapPin} label="Address" value={emp.address} missing={!emp.address} />
                        {emp.notes && <ReadField icon={BookOpen} label="Internal Notes" value={emp.notes} />}
                      </>
                    }
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div><FieldLabel>Full Name</FieldLabel><input className={inputCls} value={profileForm.full_name} onChange={e => setProfileForm(p => ({ ...p, full_name: e.target.value }))} /></div>
                      <div><FieldLabel>CNIC</FieldLabel><input className={`${inputCls} font-mono`} value={profileForm.cnic} onChange={e => setProfileForm(p => ({ ...p, cnic: formatCnic(e.target.value) }))} /></div>
                      <div><FieldLabel>Father's Name</FieldLabel><input className={inputCls} value={profileForm.father_name} onChange={e => setProfileForm(p => ({ ...p, father_name: e.target.value }))} /></div>
                      <div><FieldLabel>Mother's Name</FieldLabel><input className={inputCls} value={profileForm.mother_name} onChange={e => setProfileForm(p => ({ ...p, mother_name: e.target.value }))} /></div>
                      <div><FieldLabel>Date of Birth</FieldLabel><input type="date" className={inputCls} value={profileForm.date_of_birth} onChange={e => setProfileForm(p => ({ ...p, date_of_birth: e.target.value }))} /></div>
                      <div><FieldLabel>Personal Phone</FieldLabel><input className={inputCls} value={profileForm.personal_phone} onChange={e => setProfileForm(p => ({ ...p, personal_phone: e.target.value }))} /></div>
                      <div className="sm:col-span-2"><FieldLabel>Personal Email</FieldLabel><input type="email" className={inputCls} value={profileForm.personal_email} onChange={e => setProfileForm(p => ({ ...p, personal_email: e.target.value }))} /></div>
                      <div className="sm:col-span-2"><FieldLabel>Address</FieldLabel><textarea rows={2} className={textareaCls} value={profileForm.address} onChange={e => setProfileForm(p => ({ ...p, address: e.target.value }))} /></div>
                      <div className="sm:col-span-2"><FieldLabel>Internal Notes</FieldLabel><textarea rows={2} className={textareaCls} value={profileForm.notes} onChange={e => setProfileForm(p => ({ ...p, notes: e.target.value }))} /></div>
                    </div>
                  </EditableCard>
                )}

                {tab === "employment" && (
                  <EditableCard
                    title="Employment details"
                    editing={editEmployment}
                    saving={savingEmployment}
                    saved={savedEmployment}
                    onEdit={() => setEditEmployment(true)}
                    onCancel={() => { setEditEmployment(false); syncForms(emp); }}
                    onSave={() => patch({
                      employee_code: employmentForm.employee_code || undefined,
                      department_id: employmentForm.department_id ? parseInt(employmentForm.department_id, 10) : undefined,
                      staff_category: employmentForm.staff_category ? (employmentForm.staff_category as EmployeeCreatePayload["staff_category"]) : undefined,
                      job_title: employmentForm.job_title || undefined,
                      campus_id: employmentForm.campus_id ? parseInt(employmentForm.campus_id, 10) : undefined,
                      join_date: employmentForm.join_date || undefined,
                      job_description: employmentForm.job_description || undefined,
                    }, setSavingEmployment, setSavedEmployment, () => setEditEmployment(false))}
                    readContent={
                      <>
                        <ReadField icon={CreditCard} label="Employee Code" value={<span className="font-mono">{emp.employee_code}</span>} missing={!emp.employee_code} />
                        <ReadField icon={Building2} label="Department" value={emp.departments?.name} missing={!emp.departments} />
                        <ReadField icon={Briefcase} label="Category" value={formatStaffCategory(emp.staff_category)} missing={!emp.staff_category} />
                        <ReadField icon={Briefcase} label="Role" value={emp.job_title} missing={!emp.job_title} />
                        <ReadField icon={Building2} label="Campus" value={emp.campuses?.campus_name} missing={!emp.campuses} />
                        <ReadField icon={Calendar} label="Date of Joining" value={fmtDate(emp.join_date)} missing={!fmtDate(emp.join_date)} />
                        <ReadField icon={UsersIcon} label="Linked User" value={emp.users ? `${emp.users.full_name} (${emp.users.role})` : null} missing={!emp.users} />
                        {emp.job_description && <ReadField icon={BookOpen} label="Job Description" value={emp.job_description} />}
                      </>
                    }
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div><FieldLabel>Employee Code</FieldLabel><input className={`${inputCls} font-mono uppercase`} value={employmentForm.employee_code} onChange={e => setEmploymentForm(p => ({ ...p, employee_code: e.target.value.toUpperCase() }))} /></div>
                      <div><FieldLabel>Date of Joining</FieldLabel><input type="date" className={inputCls} value={employmentForm.join_date} onChange={e => setEmploymentForm(p => ({ ...p, join_date: e.target.value }))} /></div>
                      <div>
                        <FieldLabel>Department</FieldLabel>
                        <select className={inputCls} value={employmentForm.department_id} onChange={e => setEmploymentForm(p => ({ ...p, department_id: e.target.value }))}>
                          <option value="">—</option>
                          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <FieldLabel>Category</FieldLabel>
                        <select className={inputCls} value={employmentForm.staff_category} onChange={e => setEmploymentForm(p => ({ ...p, staff_category: e.target.value }))}>
                          <option value="">—</option>
                          {STAFF_CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <FieldLabel>Role</FieldLabel>
                        <input className={`${inputCls} uppercase`} value={employmentForm.job_title} onChange={e => setEmploymentForm(p => ({ ...p, job_title: e.target.value.toUpperCase() }))} />
                      </div>
                      <div>
                        <FieldLabel>Campus</FieldLabel>
                        <select className={inputCls} value={employmentForm.campus_id} onChange={e => setEmploymentForm(p => ({ ...p, campus_id: e.target.value }))}>
                          <option value="">—</option>
                          {campuses.map(c => <option key={c.id} value={c.id}>{c.campus_name}</option>)}
                        </select>
                      </div>
                      <div className="sm:col-span-2"><FieldLabel>Job Description</FieldLabel><textarea rows={2} className={textareaCls} value={employmentForm.job_description} onChange={e => setEmploymentForm(p => ({ ...p, job_description: e.target.value }))} /></div>
                    </div>
                  </EditableCard>
                )}

                {tab === "schedule" && (
                  <EditableCard
                    title="Schedule & pay"
                    editing={editSchedule}
                    saving={savingSchedule}
                    saved={savedSchedule}
                    onEdit={() => setEditSchedule(true)}
                    onCancel={() => { setEditSchedule(false); syncForms(emp); }}
                    onSave={() => patch({
                      reporting_time: scheduleForm.reporting_time || undefined,
                      leaving_time: scheduleForm.leaving_time || undefined,
                      late_relaxation_minutes: scheduleForm.late_relaxation_minutes ? parseInt(scheduleForm.late_relaxation_minutes, 10) : undefined,
                      days_per_week: scheduleForm.days_per_week ? parseInt(scheduleForm.days_per_week, 10) : undefined,
                      monthly_pay: scheduleForm.monthly_pay ? parseFloat(scheduleForm.monthly_pay) : undefined,
                    }, setSavingSchedule, setSavedSchedule, () => setEditSchedule(false))}
                    readContent={
                      <>
                        <ReadField icon={Clock} label="Reporting Time" value={fmtTime(emp.reporting_time)} missing={!fmtTime(emp.reporting_time)} />
                        <ReadField icon={Clock} label="Leaving Time" value={fmtTime(emp.leaving_time)} missing={!fmtTime(emp.leaving_time)} />
                        <ReadField icon={Clock} label="Late Relaxation" value={emp.late_relaxation_minutes != null ? `${emp.late_relaxation_minutes} minutes` : null} missing={emp.late_relaxation_minutes == null} />
                        <ReadField icon={Calendar} label="Working Days / Week" value={emp.days_per_week} missing={emp.days_per_week == null} />
                        <ReadField icon={Briefcase} label="Monthly Pay" value={fmtMoney(emp.monthly_pay)} missing={emp.monthly_pay == null} />
                      </>
                    }
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div><FieldLabel>Reporting Time</FieldLabel><input type="time" className={inputCls} value={scheduleForm.reporting_time} onChange={e => setScheduleForm(p => ({ ...p, reporting_time: e.target.value }))} /></div>
                      <div><FieldLabel>Leaving Time</FieldLabel><input type="time" className={inputCls} value={scheduleForm.leaving_time} onChange={e => setScheduleForm(p => ({ ...p, leaving_time: e.target.value }))} /></div>
                      <div><FieldLabel>Late Relaxation (minutes)</FieldLabel><input type="number" min={0} className={inputCls} value={scheduleForm.late_relaxation_minutes} onChange={e => setScheduleForm(p => ({ ...p, late_relaxation_minutes: e.target.value }))} /></div>
                      <div><FieldLabel>Working Days / Week</FieldLabel><input type="number" min={1} max={7} className={inputCls} value={scheduleForm.days_per_week} onChange={e => setScheduleForm(p => ({ ...p, days_per_week: e.target.value }))} /></div>
                      <div className="sm:col-span-2"><FieldLabel>Monthly Pay (PKR)</FieldLabel><input type="number" min={0} className={inputCls} value={scheduleForm.monthly_pay} onChange={e => setScheduleForm(p => ({ ...p, monthly_pay: e.target.value }))} /></div>
                    </div>
                  </EditableCard>
                )}

                {tab === "classes" && (
                  <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[15px] font-extrabold text-zinc-900 dark:text-zinc-100">Class & section assignments</h3>
                      <button
                        type="button"
                        onClick={() => router.push(`/hr/employees/${emp.id}/edit`)}
                        className="flex items-center gap-1.5 px-3 h-8 text-[11px] font-bold text-primary bg-primary/10 rounded-xl hover:bg-primary/15 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit assignments
                      </button>
                    </div>
                    {assignmentsByClass.size === 0 ? (
                      <div className="text-center py-12">
                        <BookOpen className="h-8 w-8 text-zinc-300 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-zinc-500">No class or section assignments</p>
                        <p className="text-xs text-zinc-400 mt-1">Use Advanced editor to assign classes.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {[...assignmentsByClass.entries()].map(([cls, { sections }]) => (
                          <div key={cls} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{cls}</span>
                            <div className="flex gap-1.5 flex-wrap justify-end">
                              {sections.map(s => (
                                <span key={s} className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary">{s}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
