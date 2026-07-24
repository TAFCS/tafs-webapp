"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2, AlertCircle, CheckCircle2, User, Briefcase, Clock, BookOpen, Lock,
  X, Camera, ChevronDown, PhoneCall, Heart, Key, Search
} from "lucide-react";
import {
  hrService, EmployeeCreatePayload, Department, StaffCategory,
  WorkScheduleDay, CHECK_IN_SOURCE_OPTIONS, CheckInSource, optionalText, optionalId,
  EMPLOYEE_STATUS_OPTIONS, EmployeeStatus,
} from "@/lib/hr.service";
import { useAuthState } from "@/context/AuthContext";
import { campusesService, Campus, OfferedClass, SectionInfo } from "@/lib/campuses.service";
import api from "@/lib/api";
import {
  assignmentsToRows,
  rowsToAssignments,
  EmployeeClassAssignmentsEditor,
  type ClassSectionRow,
} from "./EmployeeClassAssignmentsEditor";
import { EmployeeCodeFields } from "./EmployeeCodeFields";
import { employeeCodePartsFromProfile, isLegacyEmployeeCode } from "@/lib/employee-code";

const PORTAL_PASSWORD_MIN = 6;

function generateUniqueUsername(fullName: string, existingUsernames: Set<string>): string {
  const firstName = fullName
    .trim()
    .split(/\s+/)[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  const base = firstName || "user";
  const domain = "@tafs.com";
  let candidate = `${base}${domain}`;

  if (!existingUsernames.has(candidate.toLowerCase())) {
    return candidate;
  }

  let counter = 1;
  while (existingUsernames.has(`${base}${counter}${domain}`.toLowerCase())) {
    counter++;
  }
  return `${base}${counter}${domain}`;
}

type ManagerOption = { id: number; full_name: string | null; employee_code: string | null };

function formatManagerLabel(m: ManagerOption): string {
  const name = m.full_name?.trim() || "Unnamed";
  return m.employee_code ? `${name} (${m.employee_code})` : name;
}

// ── Category Code to Dep Mapping ──────────────────────────────────────────────
const CATEGORY_CODE_DEP_MAP: Record<string, string> = {
  SENIOR_LEADERSHIP: "01",
  TEACHER: "02",
  ASSISTANT_TEACHER: "02",
  SCOUT_LEADER: "02",
  ACADEMIC_COORDINATOR: "03",
  ACADEMIC_ADMINISTRATOR: "03",
  ADMINISTRATIVE_STAFF: "03",
  FINANCE_STAFF: "03",
  IT_STAFF: "03",
  CREATIVE_STAFF: "03",
  SUPPORT_STAFF: "04",
  SPORTS_COACH: "05",
};

function resolveDepForCategory(category?: StaffCategory | null): string {
  if (!category) return "02";
  if (category.employee_code_dep?.trim()) {
    return category.employee_code_dep.trim().padStart(2, "0");
  }
  if (CATEGORY_CODE_DEP_MAP[category.code]) {
    return CATEGORY_CODE_DEP_MAP[category.code];
  }
  const digits = category.code.replace(/\D/g, "");
  if (digits) return digits.padStart(2, "0");
  return "04";
}

// ── CNIC auto-formatter ──────────────────────────────────────────────────────
function formatCnic(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

// ── Form data shape ───────────────────────────────────────────────────────────
interface FormData {
  // Personal
  full_name: string;
  father_name: string;
  father_cnic: string;
  mother_name: string;
  mother_cnic: string;
  cnic: string;
  date_of_birth: string;
  address: string;
  personal_phone: string;
  personal_email: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
  // Family & Spouse
  photo_url: string;
  father_photo_url: string;
  mother_photo_url: string;
  spouse_name: string;
  spouse_cnic: string;
  spouse_photo_url: string;
  // Employment
  employee_code: string;
  employee_code_dep: string;
  employee_code_number: string;
  department_id: string;
  staff_category_id: string;
  job_title: string;
  job_description: string;
  join_date: string;
  employment_type: string;
  employment_status: EmployeeStatus;
  reporting_manager_id: string;
  campus_id: string;
  notes: string;
  // Schedule & Pay
  reporting_time: string;
  leaving_time: string;
  check_in_source: CheckInSource;
  late_relaxation_minutes: string;
  days_per_week: string;
  monthly_pay: string;
  account_number: string;
  bank_name: string;
  // Account
  user_id: string;
}

const EMPTY_FORM: FormData = {
  full_name: "", father_name: "", father_cnic: "", mother_name: "", mother_cnic: "", cnic: "",
  date_of_birth: "", address: "", personal_phone: "", personal_email: "",
  emergency_contact_name: "", emergency_contact_phone: "", emergency_contact_relationship: "",
  photo_url: "", father_photo_url: "", mother_photo_url: "",
  spouse_name: "", spouse_cnic: "", spouse_photo_url: "",
  employee_code: "", employee_code_dep: "", employee_code_number: "", department_id: "", staff_category_id: "",
  job_title: "", job_description: "", join_date: "", employment_type: "Full-time",
  employment_status: "ACTIVE",
  reporting_manager_id: "", campus_id: "", notes: "",
  reporting_time: "", leaving_time: "", check_in_source: "FIXED", late_relaxation_minutes: "",
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

// ── Image Picker Component ────────────────────────────────────────────────────
function ImagePicker({
  label,
  value,
  file,
  onChange,
}: {
  label: string;
  value: string | null;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrl = useMemo(() => {
    if (file) return URL.createObjectURL(file);
    return value;
  }, [file, value]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith("image/")) {
      alert("Please select an image file (JPG/PNG).");
      return;
    }
    onChange(selectedFile);
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 text-center hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
      {previewUrl ? (
        <div className="relative group mb-2">
          <img
            src={previewUrl.replace(/([^:])\/\//g, "$1/")}
            alt={label}
            className="w-24 h-24 rounded-2xl object-cover border border-zinc-200 dark:border-zinc-700 shadow-sm"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -top-2 -right-2 p-1 rounded-full bg-rose-500 text-white shadow-md hover:bg-rose-600 transition-transform active:scale-95"
            title="Remove Photo"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-20 h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors mb-2"
        >
          <Camera className="h-6 w-6 text-zinc-400 mb-1" />
          <span className="text-[10px] font-bold text-zinc-500">Upload</span>
        </div>
      )}
      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{label}</span>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="mt-1.5 text-[11px] font-semibold text-primary hover:underline"
      >
        {previewUrl ? "Change Photo" : "Choose File"}
      </button>
    </div>
  );
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

// ── Searchable reporting manager picker ───────────────────────────────────────
function ReportingManagerSearch({
  valueId,
  label,
  excludeId,
  onSelect,
  onClear,
}: {
  valueId: string;
  label: string;
  excludeId?: number;
  onSelect: (id: string, label: string) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ManagerOption[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await hrService.searchSimple(q);
        if (cancelled) return;
        setResults(data.filter((r) => r.id !== excludeId));
        setOpen(true);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, excludeId]);

  if (valueId && label) {
    return (
      <div className="space-y-1.5 sm:col-span-2">
        <FieldLabel>Reporting Manager</FieldLabel>
        <div className="flex items-center gap-2 h-11 px-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
          <User className="h-4 w-4 text-zinc-400 shrink-0" />
          <span className="flex-1 text-sm text-zinc-800 dark:text-zinc-200 truncate">{label}</span>
          <button
            type="button"
            onClick={onClear}
            className="p-1 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            title="Clear manager"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 sm:col-span-2" ref={wrapRef}>
      <FieldLabel>Reporting Manager</FieldLabel>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by name or employee code…"
          className={`${inputCls} pl-9`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 animate-spin" />
        )}
        {open && results.length > 0 && (
          <ul className="absolute z-20 mt-1 w-full max-h-48 overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  onClick={() => {
                    onSelect(String(r.id), formatManagerLabel(r));
                    setQuery("");
                    setResults([]);
                    setOpen(false);
                  }}
                >
                  {formatManagerLabel(r)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-[11px] text-zinc-400">Optional — leave empty if none.</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface EmployeeFormProps {
  employeeId?: number; // undefined = create mode
}

export function EmployeeForm({ employeeId }: EmployeeFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthState();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isEdit = !!employeeId;
  const justCreated = searchParams.get('created') === '1';

  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [classSectionRows, setClassSectionRows] = useState<ClassSectionRow[]>([]);
  const [hasSpouse, setHasSpouse] = useState(false);

  // Local pending files for upload upon creation
  const [photoFiles, setPhotoFiles] = useState<{
    profile: File | null;
    father: File | null;
    mother: File | null;
    spouse: File | null;
  }>({
    profile: null,
    father: null,
    mother: null,
    spouse: null,
  });

  // Lookups
  const [departments, setDepartments] = useState<Department[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [allClasses, setAllClasses] = useState<OfferedClass[]>([]);
  const [allSections, setAllSections] = useState<SectionInfo[]>([]);
  const [existingUsernames, setExistingUsernames] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [useCustomSchedule, setUseCustomSchedule] = useState(false);
  const [weekSchedule, setWeekSchedule] = useState<Record<number, boolean>>(() => defaultWeekSchedule(5));

  // Portal account (create + link on registration / when not yet linked)
  const [portalUsername, setPortalUsername] = useState("");
  const [portalPassword, setPortalPassword] = useState("");
  const [portalPasswordConfirm, setPortalPasswordConfirm] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [managerLabel, setManagerLabel] = useState("");

  const needsPortalAccount = !formData.user_id;

  // Gate condition: On create mode, Department and Subcategory must be chosen before rest of form unlocks
  const isUnlocked = isEdit || (Boolean(formData.department_id) && Boolean(formData.staff_category_id));

  // Determine whether employee is academic/teacher related
  const isAcademicStaff = useMemo(() => {
    if (!formData.department_id && !formData.staff_category_id) return false;
    const dept = departments.find(d => String(d.id) === formData.department_id);
    let cat: StaffCategory | undefined;
    if (dept && dept.staff_categories) {
      cat = dept.staff_categories.find(c => String(c.id) === formData.staff_category_id);
    }
    if (!cat) {
      for (const d of departments) {
        const found = d.staff_categories?.find(c => String(c.id) === formData.staff_category_id);
        if (found) { cat = found; break; }
      }
    }

    const catCode = cat?.code?.toUpperCase() || "";
    const catName = cat?.name?.toUpperCase() || "";
    const depCode = cat?.employee_code_dep || (cat ? resolveDepForCategory(cat) : "");
    const deptName = dept?.name?.toUpperCase() || "";

    const isTeacherCategory = depCode === "02" ||
      catCode.includes("TEACHER") ||
      catCode.includes("COORDINATOR") ||
      catCode.includes("ACADEMIC") ||
      catName.includes("TEACHER") ||
      catName.includes("ACADEMIC") ||
      catName.includes("COORDINATOR") ||
      catName.includes("FACULTY");

    const isAcademicDept = deptName.includes("ACADEMIC") ||
      deptName.includes("TEACHING") ||
      deptName.includes("FACULTY") ||
      deptName.includes("EDUCATION") ||
      deptName.includes("SCHOOL");

    return isTeacherCategory || isAcademicDept;
  }, [formData.department_id, formData.staff_category_id, departments]);

  // ── Load reference data ───────────────────────────────────────────────────
  const loadLookups = useCallback(async () => {
    const [deptData, campusData, classData, sectionData, usersRes] = await Promise.all([
      hrService.listDepartments(),
      campusesService.list(),
      campusesService.listAllClasses(),
      campusesService.listAllSections(),
      api.get<{ data: { username: string }[] }>('/v1/users').catch(() => ({ data: { data: [] } })),
    ]);
    setDepartments(deptData);
    setCampuses(campusData);
    setAllClasses(classData as unknown as OfferedClass[]);
    setAllSections(sectionData);

    const usernameSet = new Set<string>();
    if (usersRes.data?.data) {
      usersRes.data.data.forEach((u) => {
        if (u.username) usernameSet.add(u.username.toLowerCase());
      });
    }
    setExistingUsernames(usernameSet);
  }, []);

  // ── Load employee for edit mode ───────────────────────────────────────────
  const loadEmployee = useCallback(async (id: number) => {
    const emp = await hrService.getEmployee(id);
    setClassSectionRows(assignmentsToRows(emp.employee_class_section_assignments));

    if (emp.spouse_name || emp.spouse_cnic || emp.spouse_photo_url) {
      setHasSpouse(true);
    }

    const parseTime = (val: string | null) => {
      if (!val) return "";
      const match = val.match(/T?(\d{2}:\d{2})/);
      return match ? match[1] : "";
    };

    const codeParts = employeeCodePartsFromProfile(emp);
    setFormData({
      full_name: emp.full_name ?? "",
      father_name: emp.father_name ?? "",
      father_cnic: emp.father_cnic ?? "",
      mother_name: emp.mother_name ?? "",
      mother_cnic: emp.mother_cnic ?? "",
      cnic: emp.cnic ?? "",
      date_of_birth: emp.date_of_birth ? new Date(emp.date_of_birth).toISOString().split("T")[0] : "",
      address: emp.address ?? "",
      personal_phone: emp.personal_phone ?? "",
      personal_email: emp.personal_email ?? "",
      emergency_contact_name: emp.emergency_contact_name ?? "",
      emergency_contact_phone: emp.emergency_contact_phone ?? "",
      emergency_contact_relationship: emp.emergency_contact_relationship ?? "",
      photo_url: emp.photo_url ?? "",
      father_photo_url: emp.father_photo_url ?? "",
      mother_photo_url: emp.mother_photo_url ?? "",
      spouse_name: emp.spouse_name ?? "",
      spouse_cnic: emp.spouse_cnic ?? "",
      spouse_photo_url: emp.spouse_photo_url ?? "",
      employee_code: emp.employee_code ?? "",
      employee_code_dep: codeParts?.dep ?? "",
      employee_code_number: codeParts?.number ?? "",
      department_id: emp.department_id ? String(emp.department_id) : "",
      staff_category_id: emp.staff_category_id ? String(emp.staff_category_id) : "",
      job_title: emp.job_title ?? "",
      job_description: emp.job_description ?? "",
      join_date: emp.join_date ? new Date(emp.join_date).toISOString().split("T")[0] : "",
      employment_type: emp.employment_type ?? "Full-time",
      employment_status: emp.employment_status ?? "ACTIVE",
      reporting_manager_id: emp.reporting_manager_id ? String(emp.reporting_manager_id) : "",
      campus_id: emp.campus_id ? String(emp.campus_id) : "",
      notes: emp.notes ?? "",
      reporting_time: parseTime(emp.reporting_time),
      leaving_time: parseTime(emp.leaving_time),
      check_in_source: emp.check_in_source === "TIMETABLE" ? "TIMETABLE" : "FIXED",
      late_relaxation_minutes: emp.late_relaxation_minutes != null ? String(emp.late_relaxation_minutes) : "",
      days_per_week: emp.days_per_week ? String(emp.days_per_week) : "5",
      monthly_pay: emp.monthly_pay != null ? String(emp.monthly_pay) : "",
      account_number: emp.account_number ?? "",
      bank_name: emp.bank_name ?? "",
      user_id: emp.user_id ?? "",
    });

    if (emp.reporting_manager_id && emp.reporting_manager) {
      setManagerLabel(
        formatManagerLabel({
          id: emp.reporting_manager.id,
          full_name: emp.reporting_manager.full_name ?? emp.reporting_manager.users?.full_name ?? null,
          employee_code: emp.reporting_manager.employee_code ?? null,
        }),
      );
    } else {
      setManagerLabel("");
    }

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

  const suggestNextCodeForDep = useCallback(async (dep: string) => {
    if (!dep.trim() || isEdit) return;
    try {
      const { number, code } = await hrService.getNextEmployeeCode(dep);
      setFormData(prev => ({
        ...prev,
        employee_code_dep: dep.padStart(2, "0"),
        employee_code_number: number,
        employee_code: code,
      }));
    } catch {
      // keep manual entry
    }
  }, [isEdit]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        await loadLookups();
        if (isEdit && employeeId) {
          await loadEmployee(employeeId);
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

  // Suggest portal username from first name + @tafs.com until the user manually edits it
  useEffect(() => {
    if (!needsPortalAccount || usernameTouched) return;
    if (!formData.full_name.trim()) {
      setPortalUsername("");
      return;
    }
    const suggested = generateUniqueUsername(formData.full_name, existingUsernames);
    setPortalUsername(suggested);
  }, [formData.full_name, needsPortalAccount, usernameTouched, existingUsernames]);

  const handleDepartmentSelect = async (deptId: string) => {
    setFormData(prev => ({
      ...prev,
      department_id: deptId,
      staff_category_id: "",
      employee_code_dep: "",
      employee_code_number: "",
    }));
  };

  const handleCategorySelect = async (catId: string) => {
    const selectedDept = departments.find(d => String(d.id) === formData.department_id);
    const selectedCat = selectedDept?.staff_categories?.find(c => String(c.id) === catId);
    const depCode = resolveDepForCategory(selectedCat);

    setFormData(prev => ({
      ...prev,
      staff_category_id: catId,
    }));
    await suggestNextCodeForDep(depCode);
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    if (!formData.department_id) return "Department selection is required.";
    if (!formData.staff_category_id) return "Subcategory selection is required.";
    if (!formData.full_name.trim()) return "Full name is required.";
    if (!formData.cnic.trim()) return "CNIC is required.";
    if (formData.cnic.replace(/\D/g, "").length !== 13) return "CNIC must be 13 digits (XXXXX-XXXXXXX-X).";
    if (formData.personal_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.personal_email.trim())) {
      return "Please enter a valid email address (e.g. name@example.com).";
    }
    if (formData.personal_phone.trim() && formData.personal_phone.replace(/\D/g, "").length > 13) {
      return "Personal phone number cannot exceed 13 digits.";
    }
    if (formData.emergency_contact_phone.trim() && formData.emergency_contact_phone.replace(/\D/g, "").length > 13) {
      return "Emergency contact phone number cannot exceed 13 digits.";
    }
    const hasSplitCode = formData.employee_code_dep.trim() && formData.employee_code_number.trim();
    const hasLegacyCode = Boolean(formData.employee_code.trim()) && isLegacyEmployeeCode(formData.employee_code);
    if (!hasSplitCode && !hasLegacyCode) return "Employee code is required (dept + number).";
    if (!formData.monthly_pay) return "Monthly pay is required.";
    if (needsPortalAccount) {
      if (!portalUsername.trim()) return "Portal username is required.";
      if (portalPassword.length < PORTAL_PASSWORD_MIN) {
        return `Portal password must be at least ${PORTAL_PASSWORD_MIN} characters.`;
      }
      if (portalPassword !== portalPasswordConfirm) return "Portal passwords do not match.";
    }
    return null;
  };

  // ── Build payload ─────────────────────────────────────────────────────────
  const buildPayload = (): EmployeeCreatePayload => {
    const assignments = rowsToAssignments(classSectionRows);
    return {
      full_name: optionalText(formData.full_name),
      father_name: optionalText(formData.father_name),
      father_cnic: optionalText(formData.father_cnic),
      mother_name: optionalText(formData.mother_name),
      mother_cnic: optionalText(formData.mother_cnic),
      cnic: optionalText(formData.cnic),
      date_of_birth: optionalText(formData.date_of_birth),
      address: optionalText(formData.address),
      personal_phone: optionalText(formData.personal_phone),
      personal_email: optionalText(formData.personal_email),
      emergency_contact_name: optionalText(formData.emergency_contact_name),
      emergency_contact_phone: optionalText(formData.emergency_contact_phone),
      emergency_contact_relationship: optionalText(formData.emergency_contact_relationship),
      photo_url: optionalText(formData.photo_url),
      father_photo_url: optionalText(formData.father_photo_url),
      mother_photo_url: optionalText(formData.mother_photo_url),
      spouse_name: hasSpouse ? optionalText(formData.spouse_name) : null,
      spouse_cnic: hasSpouse ? optionalText(formData.spouse_cnic) : null,
      spouse_photo_url: hasSpouse ? optionalText(formData.spouse_photo_url) : null,
      employee_code: optionalText(formData.employee_code),
      employee_code_dep: optionalText(formData.employee_code_dep),
      employee_code_number: optionalText(formData.employee_code_number),
      department_id: formData.department_id ? parseInt(formData.department_id, 10) : undefined,
      staff_category_id: optionalId(formData.staff_category_id),
      job_title: optionalText(formData.job_title),
      job_description: optionalText(formData.job_description),
      join_date: optionalText(formData.join_date),
      employment_type: optionalText(formData.employment_type),
      ...(isSuperAdmin && !isEdit ? { employment_status: formData.employment_status } : {}),
      reporting_manager_id: formData.reporting_manager_id ? parseInt(formData.reporting_manager_id, 10) : undefined,
      campus_id: formData.campus_id ? parseInt(formData.campus_id, 10) : undefined,
      notes: optionalText(formData.notes),
      reporting_time: optionalText(formData.reporting_time),
      leaving_time: optionalText(formData.leaving_time),
      check_in_source: formData.check_in_source,
      late_relaxation_minutes: formData.late_relaxation_minutes ? parseInt(formData.late_relaxation_minutes, 10) : undefined,
      days_per_week: formData.days_per_week ? parseInt(formData.days_per_week, 10) : undefined,
      monthly_pay: formData.monthly_pay ? parseFloat(formData.monthly_pay) : undefined,
      account_number: optionalText(formData.account_number),
      bank_name: optionalText(formData.bank_name),
      user_id: optionalText(formData.user_id) ?? undefined,
      class_section_assignments: isAcademicStaff && assignments.length > 0 ? assignments : [],
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
    let createdUsername: string | null = null;
    try {
      const payload = buildPayload();
      let activeEmpId: number;

      if (needsPortalAccount) {
        try {
          const { data } = await api.post<{ data: { id: string } }>("/v1/users", {
            username: portalUsername.trim(),
            full_name: formData.full_name.trim(),
            password: portalPassword,
            role: "EMPLOYEE",
            campus_id: formData.campus_id || undefined,
          });
          payload.user_id = data.data.id;
          createdUsername = portalUsername.trim();
        } catch (userErr: any) {
          const msg = userErr.response?.data?.message || "Failed to create portal account.";
          setError(Array.isArray(msg) ? msg.join(", ") : msg);
          setSaving(false);
          return;
        }
      }

      if (isEdit && employeeId) {
        await hrService.updateEmployee(employeeId, payload);
        if (useCustomSchedule) {
          await hrService.updateEmployeeWorkSchedule(employeeId, buildScheduleDays(weekSchedule));
        } else {
          await hrService.clearEmployeeWorkSchedule(employeeId);
        }
        activeEmpId = employeeId;
      } else {
        const created = await hrService.createEmployee(payload);
        if (useCustomSchedule) {
          await hrService.updateEmployeeWorkSchedule(created.id, buildScheduleDays(weekSchedule));
        }
        activeEmpId = created.id;
      }

      // Upload selected photo files directly for all 4 slots
      const slots: ('profile' | 'father' | 'mother' | 'spouse')[] = ['profile', 'father', 'mother', 'spouse'];
      for (const slot of slots) {
        const fileToUpload = photoFiles[slot];
        if (fileToUpload) {
          try {
            await hrService.uploadEmployeePhotoSlot(activeEmpId, fileToUpload, slot);
          } catch (uploadErr) {
            console.error(`Failed to upload ${slot} photo:`, uploadErr);
          }
        }
      }

      if (isEdit) {
        setSuccess(
          createdUsername
            ? `Employee updated and portal account "${createdUsername}" linked.`
            : "Employee profile updated successfully.",
        );
        if (createdUsername) {
          setFormData((p) => ({ ...p, user_id: payload.user_id ?? p.user_id }));
          setPortalPassword("");
          setPortalPasswordConfirm("");
        }
      } else {
        router.push(`/hr/employees?created=1`);
      }
    } catch (err: any) {
      console.error(err);
      const base = err.response?.data?.message || "Failed to save employee profile.";
      const msg = Array.isArray(base) ? base.join(", ") : base;
      setError(
        createdUsername
          ? `${msg} Portal username "${createdUsername}" was already created — link or remove it in System → Users.`
          : msg,
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">Loading employee form…</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {isEdit ? "Edit Employee" : "Register an Employee"}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {isEdit ? "Update the employee's profile and assignments." : "Choose Department and Subcategory first to begin employee registration."}
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
            STEP 1 — GATE: DEPARTMENT & SUBCATEGORY SELECTION (ALWAYS FIRST)
        ═══════════════════════════════════════════════════════════ */}
        <div className="bg-white dark:bg-zinc-900/30 border border-primary/30 dark:border-primary/20 rounded-3xl p-6 shadow-sm ring-1 ring-primary/10">
          <SectionHeader icon={Briefcase} title="1. Select Department & Subcategory" subtitle="Choose placement first to calculate the auto-incrementing employee code" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Department */}
            <div className="space-y-1.5">
              <FieldLabel required>Department</FieldLabel>
              <div className="relative">
                <select
                  className={`${selectCls} ${!formData.department_id ? 'ring-2 ring-primary/40 font-semibold' : ''}`}
                  value={formData.department_id}
                  onChange={e => handleDepartmentSelect(e.target.value)}
                >
                  <option value="">-- Choose Department --</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
              </div>
            </div>

            {/* Subcategory / Staff Category */}
            <div className="space-y-1.5">
              <FieldLabel required>Subcategory (Category)</FieldLabel>
              <div className="relative">
                <select
                  className={`${selectCls} ${formData.department_id && !formData.staff_category_id ? 'ring-2 ring-primary/40 font-semibold' : ''}`}
                  value={formData.staff_category_id}
                  onChange={e => handleCategorySelect(e.target.value)}
                  disabled={!formData.department_id}
                >
                  <option value="">
                    {formData.department_id ? "-- Choose Subcategory --" : "-- Select department first --"}
                  </option>
                  {(departments.find(d => String(d.id) === formData.department_id)?.staff_categories ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.employee_code_dep ? `(Code ${c.employee_code_dep})` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
              </div>
            </div>

            {/* Employee Code (Derived department code + next numeric suffix) */}
            {isUnlocked && (
              <EmployeeCodeFields
                required
                inputCls={inputCls}
                campusId={formData.campus_id ? parseInt(formData.campus_id, 10) : null}
                value={{
                  employee_code: formData.employee_code,
                  employee_code_dep: formData.employee_code_dep,
                  employee_code_number: formData.employee_code_number,
                }}
                onChange={(codeValue) =>
                  setFormData(p => ({
                    ...p,
                    employee_code: codeValue.employee_code,
                    employee_code_dep: codeValue.employee_code_dep,
                    employee_code_number: codeValue.employee_code_number,
                  }))
                }
                onDepChange={suggestNextCodeForDep}
              />
            )}

            {/* Campus */}
            {isUnlocked && (
              <div className="space-y-1.5">
                <FieldLabel>Campus</FieldLabel>
                <div className="relative">
                  <select
                    className={selectCls}
                    value={formData.campus_id}
                    onChange={e => setFormData(p => ({ ...p, campus_id: e.target.value }))}
                  >
                    <option value="">-- Choose Campus --</option>
                    {campuses.map(c => <option key={c.id} value={c.id}>{c.campus_name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Role (Job Title) */}
            {isUnlocked && (
              <div className="space-y-1.5">
                <FieldLabel>Role / Job Title</FieldLabel>
                <input
                  type="text"
                  placeholder="e.g. URDU TEACHER, CLASS TEACHER"
                  className={inputCls}
                  value={formData.job_title}
                  onChange={e => setFormData(p => ({ ...p, job_title: e.target.value.toUpperCase() }))}
                />
              </div>
            )}

            {/* Employment Type */}
            {isUnlocked && (
              <div className="space-y-1.5">
                <FieldLabel>Employment Type</FieldLabel>
                <select
                  className={selectCls}
                  value={formData.employment_type}
                  onChange={e => setFormData(p => ({ ...p, employment_type: e.target.value }))}
                >
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Temporary">Temporary</option>
                </select>
              </div>
            )}

            {/* Employment Status — SUPER_ADMIN create only */}
            {isUnlocked && isSuperAdmin && !isEdit && (
              <div className="space-y-1.5">
                <FieldLabel>Employment Status</FieldLabel>
                <select
                  className={selectCls}
                  value={formData.employment_status}
                  onChange={e => setFormData(p => ({ ...p, employment_status: e.target.value as EmployeeStatus }))}
                >
                  {EMPLOYEE_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Date of Joining */}
            {isUnlocked && (
              <div className="space-y-1.5">
                <FieldLabel>Date of Joining</FieldLabel>
                <input
                  type="date"
                  className={inputCls}
                  value={formData.join_date}
                  onChange={e => setFormData(p => ({ ...p, join_date: e.target.value }))}
                />
              </div>
            )}

            {/* Reporting Manager (optional, searchable) */}
            {isUnlocked && (
              <ReportingManagerSearch
                valueId={formData.reporting_manager_id}
                label={managerLabel}
                excludeId={employeeId}
                onSelect={(id, label) => {
                  setFormData((p) => ({ ...p, reporting_manager_id: id }));
                  setManagerLabel(label);
                }}
                onClear={() => {
                  setFormData((p) => ({ ...p, reporting_manager_id: "" }));
                  setManagerLabel("");
                }}
              />
            )}
          </div>
        </div>

        {/* ── LOCKED BANNER when Department + Subcategory not selected ── */}
        {!isUnlocked && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-3xl p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 flex items-center justify-center mx-auto">
              <Lock className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-amber-900 dark:text-amber-300">
              Select Department and Subcategory First
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-400 max-w-md mx-auto">
              Choose the employee&apos;s Department and Subcategory (Category) above to generate their employee code and unlock the rest of the registration form.
            </p>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            UNLOCKED SECTIONS BELOW
        ═══════════════════════════════════════════════════════════ */}
        {isUnlocked && (
          <>
            {/* ════════════════════════════════════════════════════════
                SECTION 2 — PERSONAL & FAMILY INFORMATION
            ═══════════════════════════════════════════════════════════ */}
            <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
              <SectionHeader icon={User} title="2. Personal & Family Information" subtitle="Basic identity, CNIC, family & contact details" />
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
                {/* Father CNIC */}
                <div className="space-y-1.5">
                  <FieldLabel>Father's CNIC</FieldLabel>
                  <input
                    type="text"
                    placeholder="XXXXX-XXXXXXX-X"
                    inputMode="numeric"
                    className={`${inputCls} font-mono`}
                    value={formData.father_cnic}
                    onChange={e => setFormData(p => ({ ...p, father_cnic: formatCnic(e.target.value) }))}
                    maxLength={15}
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
                {/* Mother CNIC */}
                <div className="space-y-1.5">
                  <FieldLabel>Mother's CNIC</FieldLabel>
                  <input
                    type="text"
                    placeholder="XXXXX-XXXXXXX-X"
                    inputMode="numeric"
                    className={`${inputCls} font-mono`}
                    value={formData.mother_cnic}
                    onChange={e => setFormData(p => ({ ...p, mother_cnic: formatCnic(e.target.value) }))}
                    maxLength={15}
                  />
                </div>

                {/* CNIC */}
                <div className="space-y-1.5">
                  <FieldLabel required>Employee CNIC</FieldLabel>
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
                    maxLength={13}
                    className={inputCls}
                    value={formData.personal_phone}
                    onChange={e => setFormData(p => ({ ...p, personal_phone: e.target.value.replace(/[^\d+]/g, "").slice(0, 13) }))}
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

                {/* ── Optional Spouse Toggle Section ── */}
                <div className="sm:col-span-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <label className="flex items-center gap-2 cursor-pointer mb-3 select-none">
                    <input
                      type="checkbox"
                      checked={hasSpouse}
                      onChange={e => {
                        setHasSpouse(e.target.checked);
                        if (!e.target.checked) {
                          setFormData(p => ({ ...p, spouse_name: "", spouse_cnic: "", spouse_photo_url: "" }));
                          setPhotoFiles(p => ({ ...p, spouse: null }));
                        }
                      }}
                      className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary"
                    />
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Heart className="h-3.5 w-3.5 text-rose-500" /> Add Spouse Details (Optional)
                    </span>
                  </label>

                  {hasSpouse && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-zinc-50/70 dark:bg-zinc-900/40 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                      <div className="space-y-1.5">
                        <FieldLabel>Spouse Full Name</FieldLabel>
                        <input
                          type="text"
                          placeholder="Spouse's full name"
                          className={inputCls}
                          value={formData.spouse_name}
                          onChange={e => setFormData(p => ({ ...p, spouse_name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <FieldLabel>Spouse CNIC</FieldLabel>
                        <input
                          type="text"
                          placeholder="XXXXX-XXXXXXX-X"
                          inputMode="numeric"
                          className={`${inputCls} font-mono`}
                          value={formData.spouse_cnic}
                          onChange={e => setFormData(p => ({ ...p, spouse_cnic: formatCnic(e.target.value) }))}
                          maxLength={15}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Emergency Contact */}
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
                      <input
                        type="text"
                        placeholder="03XX-XXXXXXX"
                        maxLength={13}
                        className={inputCls}
                        value={formData.emergency_contact_phone}
                        onChange={e => setFormData(p => ({ ...p, emergency_contact_phone: e.target.value.replace(/[^\d+]/g, "").slice(0, 13) }))}
                      />
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
                SECTION 3 — PHOTOS & MEDIA UPLOAD
            ═══════════════════════════════════════════════════════════ */}
            <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
              <SectionHeader icon={Camera} title="3. Photos & Media Upload" subtitle="Upload pictures for employee and family members" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <ImagePicker
                  label="Employee Photo"
                  value={formData.photo_url || null}
                  file={photoFiles.profile}
                  onChange={(file) => setPhotoFiles(p => ({ ...p, profile: file }))}
                />
                <ImagePicker
                  label="Father's Photo"
                  value={formData.father_photo_url || null}
                  file={photoFiles.father}
                  onChange={(file) => setPhotoFiles(p => ({ ...p, father: file }))}
                />
                <ImagePicker
                  label="Mother's Photo"
                  value={formData.mother_photo_url || null}
                  file={photoFiles.mother}
                  onChange={(file) => setPhotoFiles(p => ({ ...p, mother: file }))}
                />
                {hasSpouse && (
                  <ImagePicker
                    label="Spouse's Photo"
                    value={formData.spouse_photo_url || null}
                    file={photoFiles.spouse}
                    onChange={(file) => setPhotoFiles(p => ({ ...p, spouse: file }))}
                  />
                )}
              </div>
            </div>

            {/* ════════════════════════════════════════════════════════
                SECTION 4 — WORK SCHEDULE & PAY
            ═══════════════════════════════════════════════════════════ */}
            <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
              <SectionHeader icon={Clock} title="4. Work Schedule & Pay" subtitle="Attendance times, working days, and salary" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Check-in source */}
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                  <FieldLabel>Check-in source</FieldLabel>
                  <div className="relative">
                    <select
                      className={selectCls}
                      value={formData.check_in_source}
                      onChange={e => setFormData(p => ({ ...p, check_in_source: e.target.value as CheckInSource }))}
                    >
                      {CHECK_IN_SOURCE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  </div>
                  {formData.check_in_source === "TIMETABLE" && (
                    <p className="text-xs text-zinc-500">
                      Expected check-in/out come from this teacher&apos;s earliest and latest timetable blocks that weekday.
                    </p>
                  )}
                </div>

                {/* Reporting Time */}
                <div className="space-y-1.5">
                  <FieldLabel>Expected Check-in Time</FieldLabel>
                  <input
                    type="time"
                    className={inputCls}
                    value={formData.reporting_time}
                    onChange={e => setFormData(p => ({ ...p, reporting_time: e.target.value }))}
                  />
                </div>
                {/* Leaving Time */}
                <div className="space-y-1.5">
                  <FieldLabel>Expected Check-out Time</FieldLabel>
                  <input
                    type="time"
                    className={inputCls}
                    value={formData.leaving_time}
                    onChange={e => setFormData(p => ({ ...p, leaving_time: e.target.value }))}
                  />
                </div>
                {/* Late Relaxation */}
                <div className="space-y-1.5">
                  <FieldLabel>Late Relaxation (Minutes)</FieldLabel>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 15"
                    className={inputCls}
                    value={formData.late_relaxation_minutes}
                    onChange={e => setFormData(p => ({ ...p, late_relaxation_minutes: e.target.value }))}
                  />
                </div>
                {/* Days Per Week */}
                <div className="space-y-1.5">
                  <FieldLabel>Working Days / Week</FieldLabel>
                  <select
                    className={selectCls}
                    value={formData.days_per_week}
                    onChange={e => {
                      const val = e.target.value;
                      setFormData(p => ({ ...p, days_per_week: val }));
                      if (!useCustomSchedule) {
                        setWeekSchedule(defaultWeekSchedule(parseInt(val, 10) || 5));
                      }
                    }}
                  >
                    <option value="5">5 days (Mon–Fri)</option>
                    <option value="6">6 days (Mon–Sat)</option>
                    <option value="7">7 days</option>
                  </select>
                </div>
                {/* Monthly Pay */}
                <div className="space-y-1.5">
                  <FieldLabel required>Monthly Pay (PKR)</FieldLabel>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder="e.g. 50000"
                    className={inputCls}
                    value={formData.monthly_pay}
                    onChange={e => setFormData(p => ({ ...p, monthly_pay: e.target.value }))}
                  />
                </div>
                {/* Account Number */}
                <div className="space-y-1.5">
                  <FieldLabel>Bank Account Number</FieldLabel>
                  <input
                    type="text"
                    placeholder="PKXX..."
                    className={inputCls}
                    value={formData.account_number}
                    onChange={e => setFormData(p => ({ ...p, account_number: e.target.value }))}
                  />
                </div>
                {/* Bank Name */}
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                  <FieldLabel>Bank Name</FieldLabel>
                  <input
                    type="text"
                    placeholder="e.g. Meezan Bank, HBL"
                    className={inputCls}
                    value={formData.bank_name}
                    onChange={e => setFormData(p => ({ ...p, bank_name: e.target.value }))}
                  />
                </div>
              </div>

              {/* Working Days selector */}
              <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Working Days Schedule</p>
                  <label className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCustomSchedule}
                      onChange={e => {
                        setUseCustomSchedule(e.target.checked);
                        if (!e.target.checked) {
                          setWeekSchedule(defaultWeekSchedule(parseInt(formData.days_per_week, 10) || 5));
                        }
                      }}
                      className="rounded text-primary focus:ring-primary"
                    />
                    Customize specific working days
                  </label>
                </div>

                {useCustomSchedule && (
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAY_ORDER.map(({ dow, label }) => (
                      <button
                        key={dow}
                        type="button"
                        onClick={() => setWeekSchedule(p => ({ ...p, [dow]: !p[dow] }))}
                        className={`h-9 px-4 rounded-xl text-xs font-bold transition-all border ${
                          weekSchedule[dow]
                            ? 'bg-primary text-white border-primary shadow-sm'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ════════════════════════════════════════════════════════
                SECTION 5 — PORTAL ACCOUNT
            ═══════════════════════════════════════════════════════════ */}
            {needsPortalAccount ? (
              <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
                <SectionHeader
                  icon={Key}
                  title="5. Portal Account"
                  subtitle="Creates a System Users login with employee self-service access"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                  Creates a System Users login with role Employee (attendance, payroll, leave).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <FieldLabel required>Username</FieldLabel>
                    <input
                      type="text"
                      required
                      autoComplete="off"
                      placeholder="e.g. muhammad@tafs.com"
                      className={inputCls}
                      value={portalUsername}
                      onChange={(e) => {
                        setUsernameTouched(true);
                        setPortalUsername(e.target.value);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel required>Password</FieldLabel>
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      placeholder={`At least ${PORTAL_PASSWORD_MIN} characters`}
                      className={inputCls}
                      value={portalPassword}
                      onChange={(e) => setPortalPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel required>Confirm Password</FieldLabel>
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      placeholder="Re-enter password"
                      className={inputCls}
                      value={portalPasswordConfirm}
                      onChange={(e) => setPortalPasswordConfirm(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>Role</FieldLabel>
                    <input
                      type="text"
                      disabled
                      className={`${inputCls} opacity-70 cursor-not-allowed`}
                      value="Employee"
                      readOnly
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>Campus</FieldLabel>
                    <input
                      type="text"
                      disabled
                      className={`${inputCls} opacity-70 cursor-not-allowed`}
                      value={
                        campuses.find((c) => String(c.id) === formData.campus_id)?.campus_name
                        || (formData.campus_id ? `Campus #${formData.campus_id}` : "Same as employee (optional)")
                      }
                      readOnly
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-3xl p-5 flex items-start gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl shrink-0">
                  <Key className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">5. Portal Account</p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                    Already linked. Manage credentials from the employee Portal Account tab.
                  </p>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════
                SECTION 6 — CLASS & SECTION ASSIGNMENTS (Academic Staff Only)
            ═══════════════════════════════════════════════════════════ */}
            {isAcademicStaff && (
              <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
                <SectionHeader icon={BookOpen} title="6. Class & Section Assignments" subtitle="Assign academic classes and sections to this employee" />
                <EmployeeClassAssignmentsEditor
                  campusId={formData.campus_id ? parseInt(formData.campus_id, 10) : null}
                  rows={classSectionRows}
                  onRowsChange={setClassSectionRows}
                  campuses={campuses}
                  allClasses={allClasses}
                  allSections={allSections}
                />
              </div>
            )}

            {/* ── Form Actions ── */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => router.push("/hr/employees")}
                className="h-11 px-5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-11 px-8 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEdit ? "Update Employee" : "Complete Registration"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
