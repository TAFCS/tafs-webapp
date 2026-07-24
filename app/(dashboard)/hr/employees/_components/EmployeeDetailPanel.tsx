"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X, Loader2, User, Briefcase, Clock, BookOpen, Trash2,
  Phone, Mail, MapPin, CreditCard, Cake, Calendar, Building2,
  AlertTriangle, Users as UsersIcon, Pencil, Save, CheckCircle2,
  Landmark, PhoneCall, Shield, Fingerprint, CalendarClock,
} from "lucide-react";
import {
  hrService,
  EmployeeProfile,
  EmployeeCreatePayload,
  Department,
  WorkScheduleDay,
  formatStaffCategory,
  CHECK_IN_SOURCE_OPTIONS,
  CheckInSource,
  EMPLOYEE_STATUS_OPTIONS,
  employeeStatusBadgeClass,
  EmployeeStatus,
  optionalText,
  optionalId,
} from "@/lib/hr.service";
import { useAuthState } from "@/context/AuthContext";
import { EmployeePortalAccountTab } from "./EmployeePortalAccountTab";
import { EmployeeBiometricTab } from "./EmployeeBiometricTab";
import { EmployeeShiftOverridesTab } from "./EmployeeShiftOverridesTab";
import {
  assignmentsToRows,
  rowsToAssignments,
  EmployeeClassAssignmentsEditor,
  EmployeeClassAssignmentsRead,
  useClassAssignmentLookups,
  type ClassSectionRow,
} from "./EmployeeClassAssignmentsEditor";
import { EmployeeCodeFields } from "./EmployeeCodeFields";
import { employeeCodePartsFromProfile, formatEmployeeCodeDisplay } from "@/lib/employee-code";

const BASE_TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "employment", label: "Employment", icon: Briefcase },
  { id: "schedule", label: "Schedule & Pay", icon: Clock },
  { id: "classes", label: "Class & Sections", icon: BookOpen },
] as const;

type TabId = typeof BASE_TABS[number]["id"] | "portal" | "biometric" | "shift_overrides";

const WEEKDAY_ORDER = [
  { dow: 1, label: "Mon" },
  { dow: 2, label: "Tue" },
  { dow: 3, label: "Wed" },
  { dow: 4, label: "Thu" },
  { dow: 5, label: "Fri" },
  { dow: 6, label: "Sat" },
  { dow: 0, label: "Sun" },
];

function defaultWeekSchedule(daysPerWeek: number): Record<number, boolean> {
  const map: Record<number, boolean> = {
    0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: false,
  };
  if (daysPerWeek === 6) map[6] = true;
  return map;
}

function formatWeekScheduleLabel(
  useCustom: boolean,
  weekSchedule: Record<number, boolean>,
  daysPerWeek: number | null | undefined,
): string {
  if (!useCustom) return `Default (${daysPerWeek ?? 5} days/week)`;
  const days = WEEKDAY_ORDER.filter((d) => weekSchedule[d.dow]).map((d) => d.label);
  return days.length > 0 ? `Custom — ${days.join(", ")}` : "Custom — no working days";
}

function buildScheduleDays(weekSchedule: Record<number, boolean>): WorkScheduleDay[] {
  return [0, 1, 2, 3, 4, 5, 6].map((dow) => ({
    day_of_week: dow,
    is_working: weekSchedule[dow] ?? false,
  }));
}

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
  const { user } = useAuthState();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const [emp, setEmp] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<TabId>("profile");
  const [deleting, setDeleting] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const { campuses, allClasses, allSections, loading: classLookupsLoading } = useClassAssignmentLookups();

  const [editProfile, setEditProfile] = useState(false);
  const [editEmployment, setEditEmployment] = useState(false);
  const [editSchedule, setEditSchedule] = useState(false);
  const [editClasses, setEditClasses] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmployment, setSavingEmployment] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [savingClasses, setSavingClasses] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [savedEmployment, setSavedEmployment] = useState(false);
  const [savedSchedule, setSavedSchedule] = useState(false);
  const [savedClasses, setSavedClasses] = useState(false);

  const [profileForm, setProfileForm] = useState({
    full_name: "", father_name: "", mother_name: "", cnic: "", date_of_birth: "",
    personal_phone: "", personal_email: "", address: "", notes: "",
    emergency_contact_name: "", emergency_contact_phone: "", emergency_contact_relationship: "",
  });
  const [employmentForm, setEmploymentForm] = useState({
    employee_code: "", employee_code_dep: "", employee_code_number: "",
    department_id: "", staff_category_id: "", job_title: "",
    campus_id: "", join_date: "", job_description: "",
  });
  const [scheduleForm, setScheduleForm] = useState({
    reporting_time: "", leaving_time: "", check_in_source: "FIXED" as CheckInSource,
    late_relaxation_minutes: "", days_per_week: "", monthly_pay: "",
    account_number: "", bank_name: "",
  });
  const [useCustomSchedule, setUseCustomSchedule] = useState(false);
  const [weekSchedule, setWeekSchedule] = useState<Record<number, boolean>>(defaultWeekSchedule(5));
  const [classSectionRows, setClassSectionRows] = useState<ClassSectionRow[]>([]);

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
      emergency_contact_name: employee.emergency_contact_name ?? "",
      emergency_contact_phone: employee.emergency_contact_phone ?? "",
      emergency_contact_relationship: employee.emergency_contact_relationship ?? "",
    });
    const codeParts = employeeCodePartsFromProfile(employee);
    setEmploymentForm({
      employee_code: employee.employee_code ?? "",
      employee_code_dep: codeParts?.dep ?? "",
      employee_code_number: codeParts?.number ?? "",
      department_id: employee.department_id ? String(employee.department_id) : "",
      staff_category_id: employee.staff_category_id ? String(employee.staff_category_id) : "",
      job_title: employee.job_title ?? "",
      campus_id: employee.campus_id ? String(employee.campus_id) : "",
      join_date: toDateInput(employee.join_date),
      job_description: employee.job_description ?? "",
    });
    setScheduleForm({
      reporting_time: parseTimeInput(employee.reporting_time),
      leaving_time: parseTimeInput(employee.leaving_time),
      check_in_source: employee.check_in_source === "TIMETABLE" ? "TIMETABLE" : "FIXED",
      late_relaxation_minutes: employee.late_relaxation_minutes != null ? String(employee.late_relaxation_minutes) : "",
      days_per_week: employee.days_per_week != null ? String(employee.days_per_week) : "",
      monthly_pay: employee.monthly_pay != null ? String(employee.monthly_pay) : "",
      account_number: employee.account_number ?? "",
      bank_name: employee.bank_name ?? "",
    });
    hrService.getEmployeeWorkSchedule(employee.id).then((ws) => {
      setUseCustomSchedule(ws.has_custom_schedule);
      if (ws.has_custom_schedule && ws.days.length > 0) {
        const map: Record<number, boolean> = {};
        for (const d of ws.days) map[d.day_of_week] = d.is_working;
        setWeekSchedule(map);
      } else {
        setWeekSchedule(defaultWeekSchedule(employee.days_per_week ?? 5));
      }
    }).catch(() => setWeekSchedule(defaultWeekSchedule(employee.days_per_week ?? 5)));
    setClassSectionRows(assignmentsToRows(employee.employee_class_section_assignments));
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

  const handleStatusChange = async (next: EmployeeStatus) => {
    if (!emp || next === (emp.employment_status ?? "ACTIVE")) return;
    if (next === "TERMINATED" || next === "LEFT") {
      const ok = confirm(
        `Set status to ${next}? This will deactivate the employee’s portal login if one is linked.`,
      );
      if (!ok) return;
    }
    setSavingStatus(true);
    try {
      const updated = await hrService.updateEmployeeStatus(emp.id, next);
      setEmp(updated);
      syncForms(updated);
      onUpdated();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to update employee status.");
    } finally {
      setSavingStatus(false);
    }
  };

  if (!employeeId) return null;

  const name = emp?.full_name || emp?.users?.full_name || (loading ? "Loading…" : `Profile #${employeeId}`);

  const resetClassRows = () => {
    if (emp) setClassSectionRows(assignmentsToRows(emp.employee_class_section_assignments));
  };

  const tabs = [
    ...BASE_TABS,
    ...(emp?.users ? [{ id: "portal" as const, label: "Portal Account", icon: Shield }] : []),
    { id: "biometric" as const, label: "Biometric", icon: Fingerprint },
    { id: "shift_overrides" as const, label: "Shift Overrides", icon: CalendarClock },
  ];

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
              <div className="relative shrink-0">
                <img
                  src={emp.photo_url.replace(/([^:])\/\//g, "$1/")}
                  alt={name}
                  className="h-12 w-12 rounded-2xl object-cover bg-zinc-100"
                />
                <button
                  type="button"
                  title="Remove photo"
                  onClick={async () => {
                    if (!confirm("Remove profile photo?")) return;
                    try {
                      const updated = await hrService.updateEmployee(emp.id, { photo_url: null });
                      setEmp(updated);
                      onUpdated();
                    } catch (err: any) {
                      alert(err?.response?.data?.message || "Failed to remove photo.");
                    }
                  }}
                  className="absolute -bottom-1 -right-1 p-0.5 bg-rose-500 text-white rounded-full text-[8px] font-bold"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                {initials(name)}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-[17px] font-black text-zinc-900 dark:text-zinc-100 tracking-tight truncate">{name}</h2>
              <p className="text-[11px] text-zinc-400 font-mono mt-0.5 truncate">
                {emp ? (formatEmployeeCodeDisplay(emp) || "—") : "—"}
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
          {tabs.map(t => (
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
                      full_name: optionalText(profileForm.full_name),
                      father_name: optionalText(profileForm.father_name),
                      mother_name: optionalText(profileForm.mother_name),
                      cnic: optionalText(profileForm.cnic),
                      date_of_birth: optionalText(profileForm.date_of_birth),
                      personal_phone: optionalText(profileForm.personal_phone),
                      personal_email: optionalText(profileForm.personal_email),
                      address: optionalText(profileForm.address),
                      notes: optionalText(profileForm.notes),
                      emergency_contact_name: optionalText(profileForm.emergency_contact_name),
                      emergency_contact_phone: optionalText(profileForm.emergency_contact_phone),
                      emergency_contact_relationship: optionalText(profileForm.emergency_contact_relationship),
                    }, setSavingProfile, setSavedProfile, () => setEditProfile(false))}
                    readContent={
                      <>
                        <ReadField icon={User} label="Full Name" value={emp.full_name} missing={!emp.full_name} />
                        <ReadField icon={User} label="Father's Name" value={emp.father_name} missing={!emp.father_name} />
                        {emp.father_cnic && <ReadField icon={CreditCard} label="Father's CNIC" value={<span className="font-mono">{emp.father_cnic}</span>} />}
                        <ReadField icon={User} label="Mother's Name" value={emp.mother_name} missing={!emp.mother_name} />
                        {emp.mother_cnic && <ReadField icon={CreditCard} label="Mother's CNIC" value={<span className="font-mono">{emp.mother_cnic}</span>} />}
                        {emp.spouse_name && <ReadField icon={User} label="Spouse Name" value={emp.spouse_name} />}
                        {emp.spouse_cnic && <ReadField icon={CreditCard} label="Spouse CNIC" value={<span className="font-mono">{emp.spouse_cnic}</span>} />}
                        <ReadField icon={CreditCard} label="CNIC" value={<span className="font-mono">{emp.cnic}</span>} missing={!emp.cnic} />
                        <ReadField icon={Cake} label="Date of Birth" value={fmtDate(emp.date_of_birth)} missing={!fmtDate(emp.date_of_birth)} />
                        <ReadField icon={Phone} label="Personal Phone" value={emp.personal_phone} missing={!emp.personal_phone} />
                        <ReadField icon={Mail} label="Personal Email" value={emp.personal_email} missing={!emp.personal_email} />
                        <ReadField icon={MapPin} label="Address" value={emp.address} missing={!emp.address} />
                        <ReadField icon={PhoneCall} label="Emergency Contact" value={
                          emp.emergency_contact_name
                            ? `${emp.emergency_contact_name}${emp.emergency_contact_phone ? ` · ${emp.emergency_contact_phone}` : ""}${emp.emergency_contact_relationship ? ` (${emp.emergency_contact_relationship})` : ""}`
                            : null
                        } missing={!emp.emergency_contact_name} />
                        {(emp.father_photo_url || emp.mother_photo_url || emp.spouse_photo_url) && (
                          <div className="pt-3 pb-1">
                            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Family Photos</p>
                            <div className="flex items-center gap-3">
                              {emp.father_photo_url && (
                                <div className="text-center">
                                  <img src={emp.father_photo_url} alt="Father" className="w-14 h-14 rounded-xl object-cover border border-zinc-200 dark:border-zinc-700" />
                                  <span className="text-[10px] text-zinc-500 mt-1 block font-semibold">Father</span>
                                </div>
                              )}
                              {emp.mother_photo_url && (
                                <div className="text-center">
                                  <img src={emp.mother_photo_url} alt="Mother" className="w-14 h-14 rounded-xl object-cover border border-zinc-200 dark:border-zinc-700" />
                                  <span className="text-[10px] text-zinc-500 mt-1 block font-semibold">Mother</span>
                                </div>
                              )}
                              {emp.spouse_photo_url && (
                                <div className="text-center">
                                  <img src={emp.spouse_photo_url} alt="Spouse" className="w-14 h-14 rounded-xl object-cover border border-zinc-200 dark:border-zinc-700" />
                                  <span className="text-[10px] text-zinc-500 mt-1 block font-semibold">Spouse</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
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
                      <div className="sm:col-span-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <p className="text-[11px] font-bold text-zinc-400 uppercase mb-3">Emergency contact</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div><FieldLabel>Name</FieldLabel><input className={inputCls} value={profileForm.emergency_contact_name} onChange={e => setProfileForm(p => ({ ...p, emergency_contact_name: e.target.value }))} /></div>
                          <div><FieldLabel>Phone</FieldLabel><input className={inputCls} value={profileForm.emergency_contact_phone} onChange={e => setProfileForm(p => ({ ...p, emergency_contact_phone: e.target.value }))} /></div>
                          <div><FieldLabel>Relationship</FieldLabel><input className={inputCls} value={profileForm.emergency_contact_relationship} onChange={e => setProfileForm(p => ({ ...p, emergency_contact_relationship: e.target.value }))} /></div>
                        </div>
                      </div>
                    </div>
                  </EditableCard>
                )}

                {tab === "employment" && (
                  <div className="space-y-4">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Employment Status</p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {isSuperAdmin
                              ? "Only super admins can change status."
                              : "Status is read-only for your role."}
                          </p>
                        </div>
                        {isSuperAdmin ? (
                          <select
                            className={inputCls + " sm:w-48"}
                            value={emp.employment_status ?? "ACTIVE"}
                            disabled={savingStatus}
                            onChange={(e) => handleStatusChange(e.target.value as EmployeeStatus)}
                          >
                            {EMPLOYEE_STATUS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`inline-flex text-xs border rounded-lg px-2.5 py-1.5 font-bold uppercase tracking-tight ${employeeStatusBadgeClass(emp.employment_status)}`}>
                            {emp.employment_status ?? "ACTIVE"}
                          </span>
                        )}
                      </div>
                    </div>
                  <EditableCard
                    title="Employment details"
                    editing={editEmployment}
                    saving={savingEmployment}
                    saved={savedEmployment}
                    onEdit={() => setEditEmployment(true)}
                    onCancel={() => { setEditEmployment(false); syncForms(emp); }}
                    onSave={() => patch({
                      employee_code: optionalText(employmentForm.employee_code),
                      employee_code_dep: optionalText(employmentForm.employee_code_dep),
                      employee_code_number: optionalText(employmentForm.employee_code_number),
                      department_id: employmentForm.department_id ? parseInt(employmentForm.department_id, 10) : undefined,
                      staff_category_id: optionalId(employmentForm.staff_category_id),
                      job_title: optionalText(employmentForm.job_title),
                      campus_id: employmentForm.campus_id ? parseInt(employmentForm.campus_id, 10) : undefined,
                      join_date: optionalText(employmentForm.join_date),
                      job_description: optionalText(employmentForm.job_description),
                    }, setSavingEmployment, setSavedEmployment, () => setEditEmployment(false))}
                    readContent={
                      <>
                        <ReadField icon={Shield} label="Status" value={
                          <span className={`inline-flex text-[11px] border rounded-md px-1.5 py-0.5 font-bold uppercase ${employeeStatusBadgeClass(emp.employment_status)}`}>
                            {emp.employment_status ?? "ACTIVE"}
                          </span>
                        } />
                        <ReadField icon={CreditCard} label="Employee Code" value={
                          <span className="font-mono">{formatEmployeeCodeDisplay(emp)}</span>
                        } missing={!formatEmployeeCodeDisplay(emp)} />
                        <ReadField icon={Building2} label="Department" value={emp.departments?.name} missing={!emp.departments} />
                        <ReadField icon={Briefcase} label="Category" value={formatStaffCategory(emp.staff_categories)} missing={!emp.staff_categories} />
                        <ReadField icon={Briefcase} label="Role" value={emp.job_title} missing={!emp.job_title} />
                        <ReadField icon={Building2} label="Campus" value={emp.campuses?.campus_name} missing={!emp.campuses} />
                        <ReadField icon={Calendar} label="Date of Joining" value={fmtDate(emp.join_date)} missing={!fmtDate(emp.join_date)} />
                        <ReadField icon={UsersIcon} label="Linked User" value={emp.users ? `${emp.users.full_name} (${emp.users.role})` : null} missing={!emp.users} />
                        {emp.job_description && <ReadField icon={BookOpen} label="Job Description" value={emp.job_description} />}
                      </>
                    }
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <EmployeeCodeFields
                        inputCls={inputCls}
                        campusId={employmentForm.campus_id ? parseInt(employmentForm.campus_id, 10) : null}
                        value={{
                          employee_code: employmentForm.employee_code,
                          employee_code_dep: employmentForm.employee_code_dep,
                          employee_code_number: employmentForm.employee_code_number,
                        }}
                        onChange={(codeValue) =>
                          setEmploymentForm(p => ({
                            ...p,
                            employee_code: codeValue.employee_code,
                            employee_code_dep: codeValue.employee_code_dep,
                            employee_code_number: codeValue.employee_code_number,
                          }))
                        }
                      />
                      <div><FieldLabel>Date of Joining</FieldLabel><input type="date" className={inputCls} value={employmentForm.join_date} onChange={e => setEmploymentForm(p => ({ ...p, join_date: e.target.value }))} /></div>
                      <div>
                        <FieldLabel>Department</FieldLabel>
                        <select
                          className={inputCls}
                          value={employmentForm.department_id}
                          onChange={e => setEmploymentForm(p => ({ ...p, department_id: e.target.value, staff_category_id: "" }))}
                        >
                          <option value="">—</option>
                          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <FieldLabel>Category</FieldLabel>
                        <select
                          className={inputCls}
                          value={employmentForm.staff_category_id}
                          onChange={e => setEmploymentForm(p => ({ ...p, staff_category_id: e.target.value }))}
                          disabled={!employmentForm.department_id}
                        >
                          <option value="">—</option>
                          {(departments.find(d => String(d.id) === employmentForm.department_id)?.staff_categories ?? []).map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
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
                  </div>
                )}

                {tab === "schedule" && (
                  <EditableCard
                    title="Schedule & pay"
                    editing={editSchedule}
                    saving={savingSchedule}
                    saved={savedSchedule}
                    onEdit={() => setEditSchedule(true)}
                    onCancel={() => { setEditSchedule(false); syncForms(emp); }}
                    onSave={async () => {
                      if (!emp) return;
                      setSavingSchedule(true);
                      try {
                        const updated = await hrService.updateEmployee(emp.id, {
                          reporting_time: optionalText(scheduleForm.reporting_time),
                          leaving_time: optionalText(scheduleForm.leaving_time),
                          check_in_source: scheduleForm.check_in_source,
                          late_relaxation_minutes: scheduleForm.late_relaxation_minutes ? parseInt(scheduleForm.late_relaxation_minutes, 10) : undefined,
                          days_per_week: scheduleForm.days_per_week ? parseInt(scheduleForm.days_per_week, 10) : undefined,
                          monthly_pay: scheduleForm.monthly_pay ? parseFloat(scheduleForm.monthly_pay) : undefined,
                          account_number: optionalText(scheduleForm.account_number),
                          bank_name: optionalText(scheduleForm.bank_name),
                        });
                        if (useCustomSchedule) {
                          await hrService.updateEmployeeWorkSchedule(emp.id, buildScheduleDays(weekSchedule));
                        } else {
                          await hrService.clearEmployeeWorkSchedule(emp.id);
                        }
                        setEmp(updated);
                        syncForms(updated);
                        setSavedSchedule(true);
                        setEditSchedule(false);
                        onUpdated();
                        setTimeout(() => setSavedSchedule(false), 2000);
                      } catch (err: any) {
                        alert(err?.response?.data?.message || "Failed to update schedule.");
                      } finally {
                        setSavingSchedule(false);
                      }
                    }}
                    readContent={
                      <>
                        <ReadField icon={Clock} label="Check-in source" value={scheduleForm.check_in_source === "TIMETABLE" ? "Derived from timetable" : "Fixed times"} />
                        <ReadField icon={Clock} label="Reporting Time" value={fmtTime(emp.reporting_time)} missing={!fmtTime(emp.reporting_time)} />
                        <ReadField icon={Clock} label="Leaving Time" value={fmtTime(emp.leaving_time)} missing={!fmtTime(emp.leaving_time)} />
                        <ReadField icon={Clock} label="Late Relaxation" value={emp.late_relaxation_minutes != null ? `${emp.late_relaxation_minutes} minutes` : null} missing={emp.late_relaxation_minutes == null} />
                        <ReadField icon={Calendar} label="Working Days / Week" value={emp.days_per_week} missing={emp.days_per_week == null} />
                        <ReadField icon={Calendar} label="Weekly Pattern" value={formatWeekScheduleLabel(useCustomSchedule, weekSchedule, emp.days_per_week)} />
                        <ReadField icon={Briefcase} label="Monthly Pay" value={fmtMoney(emp.monthly_pay)} missing={emp.monthly_pay == null} />
                        <ReadField icon={Landmark} label="Bank Account" value={
                          emp.account_number ? `${emp.bank_name ?? "Bank"} · ${emp.account_number}` : null
                        } missing={!emp.account_number} />
                      </>
                    }
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <FieldLabel>Check-in source</FieldLabel>
                        <select
                          className={inputCls}
                          value={scheduleForm.check_in_source}
                          onChange={e => setScheduleForm(p => ({ ...p, check_in_source: e.target.value as CheckInSource }))}
                        >
                          {CHECK_IN_SOURCE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        {scheduleForm.check_in_source === "TIMETABLE" && (
                          <p className="text-xs text-zinc-500 mt-1">
                            Times come from timetable blocks. Fixed times are fallback when a day has no slots.{" "}
                            <a href="/hr/timetables" className="text-rose-600 hover:underline">Open timetables</a>
                          </p>
                        )}
                      </div>
                      <div>
                        <FieldLabel>Reporting Time{scheduleForm.check_in_source === "TIMETABLE" ? " (fallback)" : ""}</FieldLabel>
                        <input type="time" className={inputCls} disabled={scheduleForm.check_in_source === "TIMETABLE"} value={scheduleForm.reporting_time} onChange={e => setScheduleForm(p => ({ ...p, reporting_time: e.target.value }))} />
                      </div>
                      <div>
                        <FieldLabel>Leaving Time{scheduleForm.check_in_source === "TIMETABLE" ? " (fallback)" : ""}</FieldLabel>
                        <input type="time" className={inputCls} disabled={scheduleForm.check_in_source === "TIMETABLE"} value={scheduleForm.leaving_time} onChange={e => setScheduleForm(p => ({ ...p, leaving_time: e.target.value }))} />
                      </div>
                      <div><FieldLabel>Late Relaxation (minutes)</FieldLabel><input type="number" min={0} className={inputCls} value={scheduleForm.late_relaxation_minutes} onChange={e => setScheduleForm(p => ({ ...p, late_relaxation_minutes: e.target.value }))} /></div>
                      <div><FieldLabel>Working Days / Week</FieldLabel><input type="number" min={1} max={7} className={inputCls} value={scheduleForm.days_per_week} onChange={e => setScheduleForm(p => ({ ...p, days_per_week: e.target.value }))} /></div>
                      <div className="sm:col-span-2"><FieldLabel>Monthly Pay (PKR)</FieldLabel><input type="number" min={0} className={inputCls} value={scheduleForm.monthly_pay} onChange={e => setScheduleForm(p => ({ ...p, monthly_pay: e.target.value }))} /></div>
                      <div className="sm:col-span-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <p className="text-[11px] font-bold text-zinc-400 uppercase mb-3">Financial</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div><FieldLabel>Account Number</FieldLabel><input className={inputCls} value={scheduleForm.account_number} onChange={e => setScheduleForm(p => ({ ...p, account_number: e.target.value }))} /></div>
                          <div><FieldLabel>Bank Name</FieldLabel><input className={inputCls} value={scheduleForm.bank_name} onChange={e => setScheduleForm(p => ({ ...p, bank_name: e.target.value }))} /></div>
                        </div>
                      </div>
                      <div className="sm:col-span-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={useCustomSchedule}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setUseCustomSchedule(checked);
                              if (checked) {
                                setWeekSchedule(defaultWeekSchedule(parseInt(scheduleForm.days_per_week, 10) || 5));
                              }
                            }}
                            className="rounded border-zinc-300 text-primary focus:ring-primary/30" />
                          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Custom weekly schedule</span>
                        </label>
                        {useCustomSchedule && (
                          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                            {WEEKDAY_ORDER.map(({ dow, label }) => (
                              <button
                                key={dow}
                                type="button"
                                onClick={() => setWeekSchedule((p) => ({ ...p, [dow]: !p[dow] }))}
                                className={`h-10 rounded-xl text-xs font-bold border transition-all ${
                                  weekSchedule[dow]
                                    ? "bg-primary text-white border-primary"
                                    : "bg-zinc-50 dark:bg-zinc-900 text-zinc-400 border-zinc-200 dark:border-zinc-700"
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </EditableCard>
                )}

                {tab === "portal" && emp.users && (
                  <EmployeePortalAccountTab employee={emp} onUpdated={reload} />
                )}

                {tab === "biometric" && (
                  <EmployeeBiometricTab employeeId={emp.id} employeeName={name} />
                )}

                {tab === "shift_overrides" && (
                  <EmployeeShiftOverridesTab employeeId={emp.id} employeeName={name} />
                )}

                {tab === "classes" && (
                  <EditableCard
                    title="Class & section assignments"
                    editing={editClasses}
                    saving={savingClasses}
                    saved={savedClasses}
                    onEdit={() => setEditClasses(true)}
                    onCancel={() => { setEditClasses(false); resetClassRows(); }}
                    onSave={async () => {
                      if (!emp) return;
                      setSavingClasses(true);
                      try {
                        const updated = await hrService.updateEmployee(emp.id, {
                          class_section_assignments: rowsToAssignments(classSectionRows),
                        });
                        setEmp(updated);
                        syncForms(updated);
                        setSavedClasses(true);
                        setEditClasses(false);
                        onUpdated();
                        setTimeout(() => setSavedClasses(false), 2000);
                      } catch (err: any) {
                        alert(err?.response?.data?.message || "Failed to update class assignments.");
                      } finally {
                        setSavingClasses(false);
                      }
                    }}
                    readContent={
                      <EmployeeClassAssignmentsRead assignments={emp.employee_class_section_assignments} />
                    }
                  >
                    {classLookupsLoading ? (
                      <div className="flex justify-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : (
                      <EmployeeClassAssignmentsEditor
                        compact
                        campusId={emp.campus_id}
                        rows={classSectionRows}
                        onRowsChange={setClassSectionRows}
                        campuses={campuses}
                        allClasses={allClasses}
                        allSections={allSections}
                      />
                    )}
                  </EditableCard>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
