"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2, AlertCircle, CheckCircle2, User, Briefcase, Clock, BookOpen, Link as LinkIcon,
  Plus, X, Camera, ChevronDown, Landmark, PhoneCall
} from "lucide-react";
import { hrService, EmployeeProfile, EmployeeCreatePayload, Department, WorkScheduleDay, STAFF_CATEGORY_OPTIONS, optionalText, optionalStaffCategory } from "@/lib/hr.service";
import { campusesService, Campus, OfferedClass, SectionInfo } from "@/lib/campuses.service";
import { PhotoUpload } from "@/app/(dashboard)/identity/students/tabs/PhotoUpload";

// ── CNIC auto-formatter ──────────────────────────────────────────────────────
function formatCnic(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

// ── Class-Section row type ────────────────────────────────────────────────────
interface ClassSectionRow {
  id: string; // local key for react lists
  class_id: number | "";
  section_ids: number[];
}

// ── Form data shape ───────────────────────────────────────────────────────────
interface FormData {
  // Personal
  full_name: string;
  father_name: string;
  mother_name: string;
  cnic: string;
  date_of_birth: string;
  address: string;
  personal_phone: string;
  personal_email: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
  // Employment
  employee_code: string;
  department_id: string;
  staff_category: string;
  job_title: string;
  job_description: string;
  join_date: string;
  employment_type: string;
  reporting_manager_id: string;
  campus_id: string;
  notes: string;
  // Schedule & Pay
  reporting_time: string;
  leaving_time: string;
  late_relaxation_minutes: string;
  days_per_week: string;
  monthly_pay: string;
  account_number: string;
  bank_name: string;
  // Account
  user_id: string;
}

const EMPTY_FORM: FormData = {
  full_name: "", father_name: "", mother_name: "", cnic: "",
  date_of_birth: "", address: "", personal_phone: "", personal_email: "",
  emergency_contact_name: "", emergency_contact_phone: "", emergency_contact_relationship: "",
  employee_code: "", department_id: "", staff_category: "",
  job_title: "", job_description: "", join_date: "", employment_type: "Full-time",
  reporting_manager_id: "", campus_id: "", notes: "",
  reporting_time: "", leaving_time: "", late_relaxation_minutes: "",
  days_per_week: "5", monthly_pay: "", account_number: "", bank_name: "", user_id: "",
};

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

function buildScheduleDays(weekSchedule: Record<number, boolean>): WorkScheduleDay[] {
  return [0, 1, 2, 3, 4, 5, 6].map((dow) => ({
    day_of_week: dow,
    is_working: weekSchedule[dow] ?? false,
  }));
}

// ── Section Header Component ──────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-6">
      <div className="p-2 bg-primary/10 rounded-xl">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h2 className="text-base font-bold text-zinc-900 dark:text-white">{title}</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
      </div>
    </div>
  );
}

// ── Label Component ───────────────────────────────────────────────────────────
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
      {children}{required && <span className="text-rose-500 ml-0.5">*</span>}
    </label>
  );
}

const inputCls = "w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm focus:border-primary transition-colors";
const textareaCls = "w-full p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm resize-none focus:border-primary transition-colors";
const selectCls = "w-full h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm focus:border-primary transition-colors appearance-none";

// ── Main component ────────────────────────────────────────────────────────────
interface EmployeeFormProps {
  employeeId?: number; // undefined = create mode
}

export function EmployeeForm({ employeeId }: EmployeeFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEdit = !!employeeId;
  const justCreated = searchParams.get('created') === '1';

  const photoSectionRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [classSectionRows, setClassSectionRows] = useState<ClassSectionRow[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Lookups
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [allClasses, setAllClasses] = useState<OfferedClass[]>([]);
  const [allSections, setAllSections] = useState<SectionInfo[]>([]);
  const [unlinkedUsers, setUnlinkedUsers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [useCustomSchedule, setUseCustomSchedule] = useState(false);
  const [weekSchedule, setWeekSchedule] = useState<Record<number, boolean>>(() => defaultWeekSchedule(5));

  // ── Load reference data ───────────────────────────────────────────────────
  const loadLookups = useCallback(async () => {
    const [deptData, empData, campusData, classData, sectionData, usersList] = await Promise.all([
      hrService.listDepartments(),
      hrService.listEmployees(),
      campusesService.list(),
      campusesService.listAllClasses(),
      campusesService.listAllSections(),
      hrService.getUnlinkedUsers(),
    ]);
    setDepartments(deptData);
    setEmployees(empData);
    setCampuses(campusData);
    // Cast to OfferedClass[] — listAllClasses returns CampusClassInfo[] but we need description
    setAllClasses(classData as unknown as OfferedClass[]);
    setAllSections(sectionData);
    setUnlinkedUsers(usersList);
  }, []);

  // ── Load employee for edit mode ───────────────────────────────────────────
  const loadEmployee = useCallback(async (id: number) => {
    const emp = await hrService.getEmployee(id);
    setPhotoUrl(emp.photo_url ?? null);
    if (emp.user_id && emp.users) {
      setCurrentUser(emp.users);
    }
    // Map assignments to rows
    const existingRows: ClassSectionRow[] = [];
    if (emp.employee_class_section_assignments?.length) {
      const byClass: Record<number, number[]> = {};
      for (const a of emp.employee_class_section_assignments) {
        if (!byClass[a.class_id]) byClass[a.class_id] = [];
        byClass[a.class_id].push(a.section_id);
      }
      for (const [cid, sids] of Object.entries(byClass)) {
        existingRows.push({ id: crypto.randomUUID(), class_id: Number(cid), section_ids: sids });
      }
    }
    setClassSectionRows(existingRows);

    // Parse time values (backend returns full ISO datetime for time fields)
    const parseTime = (val: string | null) => {
      if (!val) return "";
      // Could be "1970-01-01T07:00:00.000Z" or just "07:00:00"
      const match = val.match(/T?(\d{2}:\d{2})/);
      return match ? match[1] : "";
    };

    setFormData({
      full_name: emp.full_name ?? "",
      father_name: emp.father_name ?? "",
      mother_name: emp.mother_name ?? "",
      cnic: emp.cnic ?? "",
      date_of_birth: emp.date_of_birth ? new Date(emp.date_of_birth).toISOString().split("T")[0] : "",
      address: emp.address ?? "",
      personal_phone: emp.personal_phone ?? "",
      personal_email: emp.personal_email ?? "",
      emergency_contact_name: emp.emergency_contact_name ?? "",
      emergency_contact_phone: emp.emergency_contact_phone ?? "",
      emergency_contact_relationship: emp.emergency_contact_relationship ?? "",
      employee_code: emp.employee_code ?? "",
      department_id: emp.department_id ? String(emp.department_id) : "",
      staff_category: emp.staff_category ?? "",
      job_title: emp.job_title ?? "",
      job_description: emp.job_description ?? "",
      join_date: emp.join_date ? new Date(emp.join_date).toISOString().split("T")[0] : "",
      employment_type: emp.employment_type ?? "Full-time",
      reporting_manager_id: emp.reporting_manager_id ? String(emp.reporting_manager_id) : "",
      campus_id: emp.campus_id ? String(emp.campus_id) : "",
      notes: emp.notes ?? "",
      reporting_time: parseTime(emp.reporting_time),
      leaving_time: parseTime(emp.leaving_time),
      late_relaxation_minutes: emp.late_relaxation_minutes != null ? String(emp.late_relaxation_minutes) : "",
      days_per_week: emp.days_per_week ? String(emp.days_per_week) : "5",
      monthly_pay: emp.monthly_pay != null ? String(emp.monthly_pay) : "",
      account_number: emp.account_number ?? "",
      bank_name: emp.bank_name ?? "",
      user_id: emp.user_id ?? "",
    });

    try {
      const ws = await hrService.getEmployeeWorkSchedule(id);
      setUseCustomSchedule(ws.has_custom_schedule);
      if (ws.has_custom_schedule && ws.days.length > 0) {
        const map: Record<number, boolean> = {};
        for (const d of ws.days) map[d.day_of_week] = d.is_working;
        setWeekSchedule(map);
      } else {
        setWeekSchedule(defaultWeekSchedule(emp.days_per_week ?? 5));
      }
    } catch {
      setWeekSchedule(defaultWeekSchedule(emp.days_per_week ?? 5));
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        await loadLookups();
        if (isEdit && employeeId) {
          await loadEmployee(employeeId);
        } else {
          // Suggest next employee code
          const { code } = await hrService.getNextEmployeeCode();
          setFormData(prev => ({ ...prev, employee_code: code }));
        }
      } catch (err: any) {
        console.error(err);
        setError("Failed to load form data.");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [isEdit, employeeId, loadLookups, loadEmployee]);

  // Auto-scroll to photo section when arriving from a fresh create
  useEffect(() => {
    if (justCreated && !loading) {
      setTimeout(() => {
        photoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  }, [justCreated, loading]);

  // ── Campus-aware class & section lookups (derived from already-loaded campuses list) ──
  // The campus list endpoint returns offered_classes for every campus, so no extra fetch needed.
  const campusOfferedClasses: OfferedClass[] | null =
    formData.campus_id
      ? (campuses.find((c) => String(c.id) === formData.campus_id)?.offered_classes as OfferedClass[] | undefined) ?? []
      : null;

  // When a campus is selected: only show classes offered at that campus.
  // When no campus: fall back to all classes (for non-teacher staff).
  const campusClasses = campusOfferedClasses
    ? campusOfferedClasses.filter((c) => c.is_active)
    : allClasses;

  // Returns sections available for a given class at the selected campus.
  // Falls back to all sections when no campus is chosen.
  const getSectionsForClass = (classId: number | ""): { id: number; description: string }[] => {
    if (!classId) return [];
    if (campusOfferedClasses) {
      const found = campusOfferedClasses.find((c) => c.id === Number(classId));
      return found?.sections.filter((s) => s.is_active) ?? [];
    }
    return allSections;
  };

  // ── Class-section rows handlers ───────────────────────────────────────────
  const addClassRow = () => {
    setClassSectionRows(prev => [...prev, { id: crypto.randomUUID(), class_id: "", section_ids: [] }]);
  };
  const removeClassRow = (id: string) => {
    setClassSectionRows(prev => prev.filter(r => r.id !== id));
  };
  const updateClassRow = (id: string, field: "class_id" | "section_ids", value: any) => {
    setClassSectionRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };
  const toggleSection = (rowId: string, sectionId: number) => {
    setClassSectionRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const already = r.section_ids.includes(sectionId);
      return { ...r, section_ids: already ? r.section_ids.filter(s => s !== sectionId) : [...r.section_ids, sectionId] };
    }));
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    if (!formData.full_name.trim()) return "Full name is required.";
    if (!formData.cnic.trim()) return "CNIC is required.";
    if (formData.cnic.replace(/\D/g, "").length !== 13) return "CNIC must be 13 digits (XXXXX-XXXXXXX-X).";
    if (!formData.employee_code.trim()) return "Employee code is required.";
    if (!formData.monthly_pay) return "Monthly pay is required.";
    return null;
  };

  // ── Build payload ─────────────────────────────────────────────────────────
  const buildPayload = (): EmployeeCreatePayload => {
    // Flatten class-section rows to assignments array
    const assignments: { class_id: number; section_id: number }[] = [];
    for (const row of classSectionRows) {
      if (!row.class_id) continue;
      for (const sid of row.section_ids) {
        assignments.push({ class_id: Number(row.class_id), section_id: sid });
      }
    }
    return {
      full_name: optionalText(formData.full_name),
      father_name: optionalText(formData.father_name),
      mother_name: optionalText(formData.mother_name),
      cnic: optionalText(formData.cnic),
      date_of_birth: optionalText(formData.date_of_birth),
      address: optionalText(formData.address),
      personal_phone: optionalText(formData.personal_phone),
      personal_email: optionalText(formData.personal_email),
      emergency_contact_name: optionalText(formData.emergency_contact_name),
      emergency_contact_phone: optionalText(formData.emergency_contact_phone),
      emergency_contact_relationship: optionalText(formData.emergency_contact_relationship),
      employee_code: optionalText(formData.employee_code),
      department_id: formData.department_id ? parseInt(formData.department_id, 10) : undefined,
      staff_category: optionalStaffCategory(formData.staff_category),
      job_title: optionalText(formData.job_title),
      job_description: optionalText(formData.job_description),
      join_date: optionalText(formData.join_date),
      employment_type: optionalText(formData.employment_type),
      reporting_manager_id: formData.reporting_manager_id ? parseInt(formData.reporting_manager_id, 10) : undefined,
      campus_id: formData.campus_id ? parseInt(formData.campus_id, 10) : undefined,
      notes: optionalText(formData.notes),
      reporting_time: optionalText(formData.reporting_time),
      leaving_time: optionalText(formData.leaving_time),
      late_relaxation_minutes: formData.late_relaxation_minutes ? parseInt(formData.late_relaxation_minutes, 10) : undefined,
      days_per_week: formData.days_per_week ? parseInt(formData.days_per_week, 10) : undefined,
      monthly_pay: formData.monthly_pay ? parseFloat(formData.monthly_pay) : undefined,
      account_number: optionalText(formData.account_number),
      bank_name: optionalText(formData.bank_name),
      user_id: optionalText(formData.user_id) ?? undefined,
      class_section_assignments: assignments.length > 0 ? assignments : [],
    };
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = buildPayload();
      if (isEdit && employeeId) {
        await hrService.updateEmployee(employeeId, payload);
        if (useCustomSchedule) {
          await hrService.updateEmployeeWorkSchedule(employeeId, buildScheduleDays(weekSchedule));
        } else {
          await hrService.clearEmployeeWorkSchedule(employeeId);
        }
        setSuccess("Employee profile updated successfully.");
      } else {
        const created = await hrService.createEmployee(payload);
        if (useCustomSchedule) {
          await hrService.updateEmployeeWorkSchedule(created.id, buildScheduleDays(weekSchedule));
        }
        // Navigate to edit page with ?created=1 — photo upload becomes available immediately
        router.push(`/hr/employees/${created.id}/edit?created=1`);
        return;
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to save employee profile.");
    } finally {
      setSaving(false);
    }
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">Loading employee form…</p>
      </div>
    );
  }

  const effectiveEmployeeId = employeeId;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {isEdit ? "Edit Employee" : "Add New Employee"}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {isEdit ? "Update the employee's profile and assignments." : "Complete the form to create a new employee profile."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/hr/employees")}
          className="inline-flex items-center h-10 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all"
        >
          ← Back to List
        </button>
      </div>

      {/* ── Notifications ── */}
      {error && (
        <div className="flex items-start gap-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl p-4 text-sm dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400">
          <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5" />
          <p className="flex-1">{error}</p>
          <button onClick={() => setError(null)}><X className="h-4 w-4 opacity-50 hover:opacity-100" /></button>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl p-4 text-sm dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
          <p className="flex-1">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ════════════════════════════════════════════════════════
            SECTION 1 — PROFILE PHOTO
        ═══════════════════════════════════════════════════════════ */}
        <div ref={photoSectionRef} className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm scroll-mt-6">
          <SectionHeader icon={Camera} title="Profile Photo" subtitle="Upload a profile photo for this employee" />

          {/* Success banner shown when arriving from a fresh create */}
          {justCreated && (
            <div className="mb-5 flex items-start gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 text-sm dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Employee created successfully!</p>
                <p className="text-xs mt-0.5 opacity-80">Upload a profile photo below, then continue editing or go back to the list.</p>
              </div>
              <button
                type="button"
                onClick={() => router.push("/hr/employees")}
                className="ml-auto flex-shrink-0 text-xs font-semibold underline underline-offset-2 hover:opacity-70"
              >
                Skip → List
              </button>
            </div>
          )}

          {effectiveEmployeeId ? (
            <div className="flex items-start gap-6">
              <PhotoUpload
                employeeId={effectiveEmployeeId}
                currentUrl={photoUrl ?? undefined}
                label="Profile Photo"
                onSuccess={(url) => setPhotoUrl(url)}
              />
              {photoUrl && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm("Remove this employee's profile photo?")) return;
                    try {
                      await hrService.updateEmployee(effectiveEmployeeId!, { photo_url: null });
                      setPhotoUrl(null);
                    } catch (err: any) {
                      alert(err?.response?.data?.message || "Failed to remove photo.");
                    }
                  }}
                  className="mt-3 text-xs font-semibold text-rose-600 hover:text-rose-700 underline underline-offset-2"
                >
                  Remove photo
                </button>
              )}
              <div className="text-sm text-zinc-500 dark:text-zinc-400 pt-2 max-w-xs">
                <p className="font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Supported formats</p>
                <p>JPG, PNG, WEBP — max 10MB. The photo will be stored in the TAFS media CDN.</p>
                {justCreated && (
                  <button
                    type="button"
                    onClick={() => router.push("/hr/employees")}
                    className="mt-4 h-9 px-4 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition-all"
                  >
                    Done — Go to List
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
              <div className="w-16 h-16 rounded-2xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                <Camera className="h-6 w-6 text-zinc-400" />
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">Photo upload available after first save.</span><br />
                Save the employee record first, then come back here to upload a photo.
              </p>
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════
            SECTION 2 — PERSONAL INFORMATION
        ═══════════════════════════════════════════════════════════ */}
        <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
          <SectionHeader icon={User} title="Personal Information" subtitle="Basic identity and contact details" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel required>Full Name</FieldLabel>
              <input
                type="text"
                required
                placeholder="e.g. Muhammad Ahmed Khan"
                className={inputCls}
                value={formData.full_name}
                onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))}
              />
            </div>
            {/* Father Name */}
            <div className="space-y-1.5">
              <FieldLabel>Father's Name</FieldLabel>
              <input
                type="text"
                placeholder="Father's full name"
                className={inputCls}
                value={formData.father_name}
                onChange={e => setFormData(p => ({ ...p, father_name: e.target.value }))}
              />
            </div>
            {/* Mother Name */}
            <div className="space-y-1.5">
              <FieldLabel>Mother's Name</FieldLabel>
              <input
                type="text"
                placeholder="Mother's full name"
                className={inputCls}
                value={formData.mother_name}
                onChange={e => setFormData(p => ({ ...p, mother_name: e.target.value }))}
              />
            </div>
            {/* CNIC */}
            <div className="space-y-1.5">
              <FieldLabel required>CNIC</FieldLabel>
              <input
                type="text"
                required
                placeholder="XXXXX-XXXXXXX-X"
                inputMode="numeric"
                className={`${inputCls} font-mono`}
                value={formData.cnic}
                onChange={e => setFormData(p => ({ ...p, cnic: formatCnic(e.target.value) }))}
                maxLength={15}
              />
            </div>
            {/* DOB */}
            <div className="space-y-1.5">
              <FieldLabel>Date of Birth</FieldLabel>
              <input
                type="date"
                className={inputCls}
                value={formData.date_of_birth}
                onChange={e => setFormData(p => ({ ...p, date_of_birth: e.target.value }))}
              />
            </div>
            {/* Personal Phone */}
            <div className="space-y-1.5">
              <FieldLabel>Personal Phone</FieldLabel>
              <input
                type="text"
                placeholder="03XX-XXXXXXX"
                className={inputCls}
                value={formData.personal_phone}
                onChange={e => setFormData(p => ({ ...p, personal_phone: e.target.value }))}
              />
            </div>
            {/* Personal Email */}
            <div className="space-y-1.5">
              <FieldLabel>Personal Email</FieldLabel>
              <input
                type="email"
                placeholder="personal@email.com"
                className={inputCls}
                value={formData.personal_email}
                onChange={e => setFormData(p => ({ ...p, personal_email: e.target.value }))}
              />
            </div>
            {/* Address */}
            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel>Address</FieldLabel>
              <textarea
                rows={2}
                placeholder="Full residential address"
                className={textareaCls}
                value={formData.address}
                onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <PhoneCall className="h-3.5 w-3.5" /> Emergency Contact
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel>Contact Name</FieldLabel>
                  <input type="text" className={inputCls} value={formData.emergency_contact_name}
                    onChange={e => setFormData(p => ({ ...p, emergency_contact_name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Contact Phone</FieldLabel>
                  <input type="text" className={inputCls} value={formData.emergency_contact_phone}
                    onChange={e => setFormData(p => ({ ...p, emergency_contact_phone: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Relationship</FieldLabel>
                  <input type="text" placeholder="e.g. Spouse, Parent" className={inputCls} value={formData.emergency_contact_relationship}
                    onChange={e => setFormData(p => ({ ...p, emergency_contact_relationship: e.target.value }))} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
            SECTION 3 — EMPLOYMENT DETAILS
        ═══════════════════════════════════════════════════════════ */}
        <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
          <SectionHeader icon={Briefcase} title="Employment Details" subtitle="Role, department, and employment configuration" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Employee Code */}
            <div className="space-y-1.5">
              <FieldLabel required>Employee Code</FieldLabel>
              <input
                type="text"
                required
                placeholder="e.g. EMP-0001"
                className={`${inputCls} font-mono uppercase`}
                value={formData.employee_code}
                onChange={e => setFormData(p => ({ ...p, employee_code: e.target.value.toUpperCase() }))}
              />
              <p className="text-[10px] text-zinc-400 dark:text-zinc-600">Auto-suggested — assigned by school, must be unique.</p>
            </div>
            {/* Department */}
            <div className="space-y-1.5">
              <FieldLabel>Department</FieldLabel>
              <div className="relative">
                <select
                  className={selectCls}
                  value={formData.department_id}
                  onChange={e => setFormData(p => ({ ...p, department_id: e.target.value }))}
                >
                  <option value="">-- Choose Department --</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
              </div>
            </div>
            {/* Staff Category */}
            <div className="space-y-1.5">
              <FieldLabel>Category</FieldLabel>
              <div className="relative">
                <select
                  className={selectCls}
                  value={formData.staff_category}
                  onChange={e => setFormData(p => ({ ...p, staff_category: e.target.value }))}
                >
                  <option value="">-- Choose Category --</option>
                  {STAFF_CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
              </div>
            </div>
            {/* Role (cleaned job title) */}
            <div className="space-y-1.5">
              <FieldLabel>Role</FieldLabel>
              <input
                type="text"
                placeholder="e.g. URDU TEACHER, CLASS TEACHER"
                className={inputCls}
                value={formData.job_title}
                onChange={e => setFormData(p => ({ ...p, job_title: e.target.value.toUpperCase() }))}
              />
            </div>
            {/* Join Date */}
            <div className="space-y-1.5">
              <FieldLabel>Join Date</FieldLabel>
              <input
                type="date"
                className={inputCls}
                value={formData.join_date}
                onChange={e => setFormData(p => ({ ...p, join_date: e.target.value }))}
              />
            </div>
            {/* Employment Type */}
            <div className="space-y-1.5">
              <FieldLabel>Employment Type</FieldLabel>
              <div className="relative">
                <select
                  className={selectCls}
                  value={formData.employment_type}
                  onChange={e => setFormData(p => ({ ...p, employment_type: e.target.value }))}
                >
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Internship">Internship</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
              </div>
            </div>
            {/* Campus */}
            <div className="space-y-1.5">
              <FieldLabel>Campus</FieldLabel>
              <div className="relative">
                <select
                  className={selectCls}
                  value={formData.campus_id}
                  onChange={e => {
                    const newVal = e.target.value;
                    // Changing campus invalidates existing class assignments — clear them
                    if (newVal !== formData.campus_id && classSectionRows.length > 0) {
                      setClassSectionRows([]);
                    }
                    setFormData(p => ({ ...p, campus_id: newVal }));
                  }}
                >
                  <option value="">-- Choose Campus (optional) --</option>
                  {campuses.map(c => <option key={c.id} value={c.id}>{c.campus_name}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
              </div>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-600">
                Selecting a campus filters the class assignments below to that campus only.
              </p>
            </div>
            {/* Reporting Manager */}
            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel>Reporting Manager</FieldLabel>
              <div className="relative">
                <select
                  className={selectCls}
                  value={formData.reporting_manager_id}
                  onChange={e => setFormData(p => ({ ...p, reporting_manager_id: e.target.value }))}
                >
                  <option value="">-- Choose Manager (Optional) --</option>
                  {employees
                    .filter(e => e.id !== employeeId)
                    .map(e => (
                      <option key={e.id} value={e.id}>
                        {e.full_name || e.users?.full_name || `Profile #${e.id}`} {e.job_title ? `(${e.job_title})` : ""}
                      </option>
                    ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
              </div>
            </div>
            {/* Job Description */}
            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel>Job Description</FieldLabel>
              <textarea
                rows={3}
                placeholder="Describe main responsibilities and duties…"
                className={textareaCls}
                value={formData.job_description}
                onChange={e => setFormData(p => ({ ...p, job_description: e.target.value }))}
              />
            </div>
            {/* Notes */}
            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel>Internal Notes</FieldLabel>
              <textarea
                rows={2}
                placeholder="Any internal notes about this employee…"
                className={textareaCls}
                value={formData.notes}
                onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
            SECTION 4 — WORK SCHEDULE & PAY
        ═══════════════════════════════════════════════════════════ */}
        <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
          <SectionHeader icon={Clock} title="Work Schedule & Pay" subtitle="Attendance times, working days, and salary" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Reporting Time */}
            <div className="space-y-1.5">
              <FieldLabel>Reporting Time</FieldLabel>
              <input
                type="time"
                className={inputCls}
                value={formData.reporting_time}
                onChange={e => setFormData(p => ({ ...p, reporting_time: e.target.value }))}
              />
            </div>
            {/* Leaving Time */}
            <div className="space-y-1.5">
              <FieldLabel>Leaving Time</FieldLabel>
              <input
                type="time"
                className={inputCls}
                value={formData.leaving_time}
                onChange={e => setFormData(p => ({ ...p, leaving_time: e.target.value }))}
              />
            </div>
            {/* Late Relaxation */}
            <div className="space-y-1.5">
              <FieldLabel>Late Relaxation (minutes)</FieldLabel>
              <input
                type="number"
                min={0}
                max={120}
                placeholder="e.g. 10"
                className={inputCls}
                value={formData.late_relaxation_minutes}
                onChange={e => setFormData(p => ({ ...p, late_relaxation_minutes: e.target.value }))}
              />
            </div>
            {/* Days per Week */}
            <div className="space-y-1.5">
              <FieldLabel>Working Days / Week</FieldLabel>
              <div className="relative">
                <select
                  className={selectCls}
                  value={formData.days_per_week}
                  onChange={e => {
                    const val = e.target.value;
                    setFormData(p => ({ ...p, days_per_week: val }));
                    if (!useCustomSchedule) {
                      setWeekSchedule(defaultWeekSchedule(parseInt(val, 10)));
                    }
                  }}
                  disabled={useCustomSchedule}
                >
                  <option value="5">5 days (Mon–Fri)</option>
                  <option value="6">6 days (Mon–Sat)</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
              </div>
              <p className="text-[11px] text-zinc-400">
                {useCustomSchedule ? "Using custom weekly schedule below." : "Default when no custom schedule is set."}
              </p>
            </div>
            {/* Custom weekly schedule */}
            <div className="space-y-3 sm:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCustomSchedule}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setUseCustomSchedule(checked);
                    if (checked) {
                      setWeekSchedule(defaultWeekSchedule(parseInt(formData.days_per_week, 10) || 5));
                    }
                  }}
                  className="rounded border-zinc-300 text-primary focus:ring-primary/30"
                />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Custom weekly schedule (overrides days per week)
                </span>
              </label>
              {useCustomSchedule && (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  {WEEKDAY_ORDER.map(({ dow, label }) => (
                    <button
                      key={dow}
                      type="button"
                      onClick={() =>
                        setWeekSchedule((prev) => ({ ...prev, [dow]: !prev[dow] }))
                      }
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                        weekSchedule[dow]
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300"
                          : "bg-zinc-50 border-zinc-200 text-zinc-500 dark:bg-zinc-900 dark:border-zinc-800"
                      }`}
                    >
                      {label}
                      <span className="block text-[10px] font-normal mt-0.5 opacity-70">
                        {weekSchedule[dow] ? "Working" : "Off"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Monthly Pay */}
            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel required>Monthly Pay (PKR)</FieldLabel>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-zinc-400 pointer-events-none select-none">₨</span>
                <input
                  type="number"
                  required
                  min={0}
                  step={0.01}
                  placeholder="e.g. 50000"
                  className={`${inputCls} pl-8`}
                  value={formData.monthly_pay}
                  onChange={e => setFormData(p => ({ ...p, monthly_pay: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
            SECTION 5 — CLASS–SECTION ASSIGNMENTS
        ═══════════════════════════════════════════════════════════ */}
        <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
          <SectionHeader
            icon={BookOpen}
            title="Class–Section Assignments"
            subtitle={formData.campus_id
              ? `Classes offered at ${campuses.find(c => String(c.id) === formData.campus_id)?.campus_name ?? 'selected campus'}`
              : 'Assign this employee to specific classes and sections'}
          />

          {/* Campus context banner */}
          {formData.campus_id ? (
            <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/15 rounded-xl text-xs text-primary dark:text-primary/80">
              <BookOpen className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                Showing classes offered at{' '}
                <span className="font-semibold">{campuses.find(c => String(c.id) === formData.campus_id)?.campus_name}</span>.
                {' '}Changing the campus above will clear these assignments.
              </span>
            </div>
          ) : (
            <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-500">
              <BookOpen className="h-3.5 w-3.5 flex-shrink-0" />
              <span>Select a campus above to filter classes by campus. All classes are shown when no campus is set.</span>
            </div>
          )}

          <div className="space-y-3">
            {classSectionRows.length === 0 && (
              <p className="text-sm text-zinc-400 dark:text-zinc-600 italic py-2">No class assignments yet. Click &quot;Add Class&quot; below to assign.</p>
            )}
            {classSectionRows.map((row, idx) => {
              const rowSections = getSectionsForClass(row.class_id);
              return (
                <div key={row.id} className="flex flex-col sm:flex-row gap-3 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-2.5">
                    {idx + 1}
                  </div>
                  {/* Class picker */}
                  <div className="flex-1 space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Class</label>
                    <div className="relative">
                      <select
                        className={selectCls}
                        value={row.class_id}
                        onChange={e => {
                          const newClassId = e.target.value ? Number(e.target.value) : "";
                          // Clear sections when class changes
                          updateClassRow(row.id, "class_id", newClassId);
                          updateClassRow(row.id, "section_ids", []);
                        }}
                      >
                        <option value="">-- Select Class --</option>
                        {campusClasses.map(c => (
                          <option key={c.id} value={c.id}>{c.description} ({c.class_code})</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                    </div>
                  </div>
                  {/* Section multi-select */}
                  <div className="flex-1 space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Sections</label>
                    <div className="flex flex-wrap gap-1.5 min-h-[44px] p-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                      {!row.class_id ? (
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-600 self-center px-1">Select a class first</span>
                      ) : rowSections.length === 0 ? (
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-600 self-center px-1">No sections available</span>
                      ) : (
                        rowSections.map(sec => {
                          const selected = row.section_ids.includes(sec.id);
                          return (
                            <button
                              key={sec.id}
                              type="button"
                              onClick={() => toggleSection(row.id, sec.id)}
                              className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-all border ${
                                selected
                                  ? "bg-primary text-white border-primary"
                                  : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-primary/50"
                              }`}
                            >
                              {sec.description}
                            </button>
                          );
                        })
                      )}
                    </div>
                    {row.section_ids.length > 0 && (
                      <p className="text-[10px] text-zinc-400">{row.section_ids.length} section(s) selected</p>
                    )}
                  </div>
                  {/* Remove row */}
                  <button
                    type="button"
                    onClick={() => removeClassRow(row.id)}
                    className="flex-shrink-0 p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all self-start mt-6"
                    title="Remove this class row"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={addClassRow}
              className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-semibold text-zinc-500 dark:text-zinc-400 hover:border-primary hover:text-primary transition-all"
            >
              <Plus className="h-4 w-4" />
              Add Class
            </button>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
            SECTION 6 — FINANCIAL
        ═══════════════════════════════════════════════════════════ */}
        <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
          <SectionHeader icon={Landmark} title="Financial" subtitle="Salary bank account for payroll deposits" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <FieldLabel>Account Number</FieldLabel>
              <input type="text" className={inputCls} value={formData.account_number}
                onChange={e => setFormData(p => ({ ...p, account_number: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel>Bank Name</FieldLabel>
              <input type="text" className={inputCls} value={formData.bank_name}
                onChange={e => setFormData(p => ({ ...p, bank_name: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
            SECTION 7 — ACCOUNT LINK
        ═══════════════════════════════════════════════════════════ */}
        <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
          <SectionHeader icon={LinkIcon} title="System Account Link" subtitle="Link this employee to a staff portal account" />
          <div className="space-y-1.5">
            <FieldLabel>Link User Account</FieldLabel>
            <div className="relative">
              <select
                className={selectCls}
                value={formData.user_id}
                onChange={e => setFormData(p => ({ ...p, user_id: e.target.value }))}
              >
                <option value="">-- No Account Linked --</option>
                {/* Show current linked user if editing */}
                {isEdit && currentUser && formData.user_id && (
                  <option value={formData.user_id}>
                    {currentUser.full_name} — {currentUser.email} (Current)
                  </option>
                )}
                {unlinkedUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} — {u.email} ({u.role})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
            </div>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-600">
              All staff should have a portal account. Only unlinked active users are shown.
            </p>
          </div>
        </div>

        {/* ── Submit Bar ── */}
        <div className="sticky bottom-4 z-10">
          <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 hidden sm:block">
              {isEdit ? "Review changes above and click Save." : "Required fields are marked with *."}
            </p>
            <div className="flex gap-3 ml-auto">
              <button
                type="button"
                onClick={() => router.push("/hr/employees")}
                className="h-11 px-5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || justCreated}
                className="h-11 px-8 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-white font-semibold rounded-xl text-sm flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Employee"}
              </button>
            </div>
          </div>
        </div>

      </form>
    </div>
  );
}
