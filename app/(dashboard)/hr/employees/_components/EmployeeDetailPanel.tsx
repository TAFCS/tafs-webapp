"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Loader2, User, Briefcase, Clock, BookOpen, Trash2,
  Phone, Mail, MapPin, CreditCard, Cake, Calendar, Building2,
  AlertTriangle, Users as UsersIcon, Pencil, Save, CheckCircle2,
  Landmark, PhoneCall, Shield, Fingerprint, CalendarClock, UserMinus,
  ChevronDown, UserCheck, DoorOpen, Ban, Wallet, HandCoins, Layers, TrendingUp,
  Award, FileText,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  hrService,
  EmployeeProfile,
  EmployeeCreatePayload,
  Department,
  Segment,
  formatStaffCategory,
  CHECK_IN_SOURCE_OPTIONS,
  CheckInSource,
  EMPLOYEE_STATUS_OPTIONS,
  employeeStatusBadgeClass,
  EmployeeStatus,
  EmploymentSubtype,
  EMPLOYMENT_SUBTYPE_OPTIONS,
  employmentSubtypeBadgeClass,
  employmentSubtypeLabel,
  optionalText,
  optionalId,
} from "@/lib/hr.service";
import { segmentsForCampus } from "@/lib/segments";
import { useAuthState } from "@/context/AuthContext";
import { EmployeePortalAccountTab } from "./EmployeePortalAccountTab";
import { EmployeeBiometricTab } from "./EmployeeBiometricTab";
import { EmployeeShiftOverridesTab } from "./EmployeeShiftOverridesTab";
import { EmployeeSecurityDepositTab } from "./EmployeeSecurityDepositTab";
import { EmployeeLoanTab } from "./EmployeeLoanTab";
import { EmployeePreviousEmployersSection } from "./EmployeePreviousEmployersSection";
import { EmployeeProgressionTab } from "./EmployeeProgressionTab";
import { EmployeeSalaryIncrementSection } from "./EmployeeSalaryIncrementSection";
import {
  assignmentsToRows,
  rowsToAssignments,
  EmployeeClassAssignmentsEditor,
  EmployeeClassAssignmentsRead,
  useClassAssignmentLookups,
  type ClassSectionRow,
} from "./EmployeeClassAssignmentsEditor";
import { EmployeeCodeFields } from "./EmployeeCodeFields";
import {
  WorkingDaysPicker, WeekSchedule, defaultWeekSchedule, countWorkingDays, formatWeekSchedule, scheduleFromApi, WEEKDAY_ORDER,
} from "./WorkingDaysPicker";
import {
  DayTimingsEditor, DayTimingsForm, dayTimingsFromApi, dayTimingsToApi, dayTimingsError, formatDayTimings, sameDayTimings,
} from "./DayTimingsEditor";
import type { EmployeeDayTiming, ScheduledPayChange, ScheduledTimingChange } from "@/lib/hr.service";

/** Today in Pakistan time, YYYY-MM-DD (TAFSD-369 effective-from default). */
function todayPkt(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
}

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}
import { shiftTimeOrderError } from "@/lib/shift-times";
import { useEmployeeAccess, readOnlyEmployeeAccess, TAB_ACTION_PREFIX } from "./use-employee-access";
import {
  employeeCodePartsFromProfile,
  formatEmployeeCodeDisplay,
  resolveEmployeeCampusPrefix,
} from "@/lib/employee-code";

const BASE_TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "employment", label: "Employment", icon: Briefcase },
  { id: "schedule", label: "Schedule & Pay", icon: Clock },
  { id: "security_deposit", label: "Security Deposit", icon: Wallet },
  { id: "loan", label: "Loan", icon: HandCoins },
  { id: "classes", label: "Class & Sections", icon: BookOpen },
  { id: "progression", label: "Progression", icon: TrendingUp },
] as const;

type TabId = typeof BASE_TABS[number]["id"] | "portal" | "biometric" | "shift_overrides";

function tabFromParam(value: string | null): TabId | null {
  if (
    value === "profile" ||
    value === "employment" ||
    value === "schedule" ||
    value === "security_deposit" ||
    value === "loan" ||
    value === "classes" ||
    value === "progression" ||
    value === "portal" ||
    value === "biometric" ||
    value === "shift_overrides"
  ) {
    return value;
  }
  return null;
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

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
      {children}{required && <span className="text-rose-500 ml-0.5">*</span>}
    </label>
  );
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
  canEdit = true,
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
  /** False hides the pencil and pins the card to its read view. */
  canEdit?: boolean;
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
        ) : canEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <Pencil className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <h3 className="text-[15px] font-extrabold text-zinc-900 dark:text-zinc-100 mb-4 pr-24">{title}</h3>
      {editing && canEdit ? children : <div className="divide-y divide-zinc-100 dark:divide-zinc-800">{readContent}</div>}
    </div>
  );
}

interface Props {
  employeeId: number | null;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}


/** TAFSD-278: what the payroll does about EOBI / SESSI for this employee. */
function statutoryLabel(eobiExempt: boolean, sessiExempt: boolean): string {
  if (eobiExempt && sessiExempt) return "EOBI and SESSI exempt";
  if (eobiExempt) return "EOBI exempt · SESSI applies";
  if (sessiExempt) return "SESSI exempt · EOBI applies";
  return "EOBI and SESSI apply";
}

export function EmployeeDetailPanel({ employeeId, onClose, onUpdated, onDeleted }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlEmployeeId = searchParams.get("id");
  const urlTab = searchParams.get("tab");
  const { user } = useAuthState();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const directoryAccess = useEmployeeAccess();
  const [emp, setEmp] = useState<EmployeeProfile | null>(null);
  // Your own record is read-only unless you are a super admin; the API refuses
  // the writes anyway (TAFSD-365).
  const ownRecord = !isSuperAdmin && !!emp?.user_id && emp.user_id === user?.id;
  const access = useMemo(
    () => (ownRecord ? readOnlyEmployeeAccess(directoryAccess) : directoryAccess),
    [ownRecord, directoryAccess],
  );
  const canChangeStatus = isSuperAdmin && access.can("status.change");
  const canManageIncrements =
    access.can("schedule_pay.edit") &&
    (isSuperAdmin || !!user?.permissions?.includes("hr.employees.edit"));
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<TabId>("profile");
  const [deleting, setDeleting] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  // Collects the date of leaving (and an optional reason) for LEFT / TERMINATED,
  // or just re-edits the date when the employee is already offboarded.
  const [leaveDialog, setLeaveDialog] = useState<{ mode: "status" | "edit"; next: EmployeeStatus } | null>(null);
  const [rejoinDialog, setRejoinDialog] = useState<{ next: EmployeeStatus } | null>(null);
  const [savingSegment, setSavingSegment] = useState(false);
  const [savingSubtype, setSavingSubtype] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
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
    campus_id: "", join_date: "", job_description: "", segment_id: "",
    employment_subtype: "",
  });

  const employmentCampusPrefix = useMemo(() => {
    if (!employmentForm.campus_id) return null;
    const cid = parseInt(employmentForm.campus_id, 10);
    const campus = campuses.find((c) => c.id === cid);
    return resolveEmployeeCampusPrefix(cid, campus?.campus_prefix);
  }, [employmentForm.campus_id, campuses]);

  // Segments differ by campus (campus_segments): Kaneez Fatima and North
  // Nazimabad run Pre-Primary and Junior Cambridge only. Both segment pickers
  // below narrow to the campus in play rather than offering all six.
  const segmentsForEmpCampus = useMemo(
    () => segmentsForCampus(segments, emp?.campus_id ?? null),
    [segments, emp?.campus_id],
  );
  const segmentsForEmploymentForm = useMemo(
    () => segmentsForCampus(segments, employmentForm.campus_id ? parseInt(employmentForm.campus_id, 10) : null),
    [segments, employmentForm.campus_id],
  );

  const [scheduleForm, setScheduleForm] = useState({
    reporting_time: "", leaving_time: "", check_in_source: "FIXED" as CheckInSource,
    late_relaxation_minutes: "", monthly_pay: "",
    payroll_enabled: true,
    eobi_exempt: false, sessi_exempt: false,
    account_number: "", bank_name: "",
  });
  const [weekSchedule, setWeekSchedule] = useState<WeekSchedule>(defaultWeekSchedule(5));
  // TAFSD-363: per-weekday timings (Friday). savedDayTimings is what the server holds.
  const [dayTimings, setDayTimings] = useState<DayTimingsForm>({});
  const [savedDayTimings, setSavedDayTimings] = useState<EmployeeDayTiming[]>([]);
  // TAFSD-369: the working days as saved, the date timing edits take effect
  // from, and changes already scheduled for a later date.
  const [savedWeekSchedule, setSavedWeekSchedule] = useState<WeekSchedule>(defaultWeekSchedule(5));
  const [timingsEffectiveFrom, setTimingsEffectiveFrom] = useState(todayPkt());
  const [effectivePromptOpen, setEffectivePromptOpen] = useState(false);
  const [scheduledTimings, setScheduledTimings] = useState<ScheduledTimingChange[]>([]);
  // TAFSD-372: pay changes saved for a later date.
  const [scheduledPay, setScheduledPay] = useState<ScheduledPayChange[]>([]);
  // Any edit to source, times, grace, working days or day timings.
  const timingsChanged = useMemo(() => {
    if (!emp) return false;
    const same = (x: string | null | undefined, y: string | null | undefined) => (x || "") === (y || "");
    return (
      scheduleForm.check_in_source !== (emp.check_in_source === "TIMETABLE" ? "TIMETABLE" : "FIXED") ||
      !same(scheduleForm.reporting_time, parseTimeInput(emp.reporting_time)) ||
      !same(scheduleForm.leaving_time, parseTimeInput(emp.leaving_time)) ||
      !same(scheduleForm.late_relaxation_minutes, emp.late_relaxation_minutes != null ? String(emp.late_relaxation_minutes) : "") ||
      [0, 1, 2, 3, 4, 5, 6].some((d) => !!weekSchedule[d] !== !!savedWeekSchedule[d]) ||
      !sameDayTimings(dayTimingsToApi(dayTimings, weekSchedule), savedDayTimings)
    );
  }, [emp, scheduleForm, weekSchedule, savedWeekSchedule, dayTimings, savedDayTimings]);
  // TAFSD-372: monthly pay also takes an effective-from date.
  const payChanged = useMemo(() => {
    if (!emp) return false;
    const before = emp.monthly_pay != null ? Number(emp.monthly_pay) : null;
    const after = scheduleForm.monthly_pay ? Number(scheduleForm.monthly_pay) : null;
    return before !== after;
  }, [emp, scheduleForm.monthly_pay]);
  // What the effective-date prompt lists: "Leaving time 14:00 → 16:30", "Mon normal → 07:20–18:47".
  const timingChangeLines = useMemo(() => {
    if (!emp) return [] as string[];
    const out: string[] = [];
    if (payChanged) {
      const fmt = (v: number | string | null | undefined) => (v == null || v === "" ? "—" : `Rs ${Number(v).toLocaleString("en-PK")}`);
      out.push(`Monthly pay: ${fmt(emp.monthly_pay)} → ${fmt(scheduleForm.monthly_pay)}`);
    }
    const v = (x: string | null | undefined) => (x ? x : "—");
    const cmp = (label: string, a: string | null | undefined, b: string | null | undefined) => {
      if ((a || "") !== (b || "")) out.push(`${label}: ${v(a)} → ${v(b)}`);
    };
    cmp("Check-in source", emp.check_in_source === "TIMETABLE" ? "Timetable" : "Fixed", scheduleForm.check_in_source === "TIMETABLE" ? "Timetable" : "Fixed");
    cmp("Reporting time", parseTimeInput(emp.reporting_time), scheduleForm.reporting_time);
    cmp("Leaving time", parseTimeInput(emp.leaving_time), scheduleForm.leaving_time);
    cmp("Late relaxation (min)", emp.late_relaxation_minutes != null ? String(emp.late_relaxation_minutes) : "", scheduleForm.late_relaxation_minutes);
    cmp("Working days", formatWeekSchedule(savedWeekSchedule), formatWeekSchedule(weekSchedule));
    const next = dayTimingsToApi(dayTimings, weekSchedule);
    const fmt = (d?: EmployeeDayTiming) => (d ? `${d.reporting_time ?? "normal"}–${d.leaving_time ?? "normal"}` : "normal");
    for (const { dow, label } of WEEKDAY_ORDER) {
      const a = savedDayTimings.find((d) => d.day_of_week === dow);
      const b = next.find((d) => d.day_of_week === dow);
      if (fmt(a) !== fmt(b)) out.push(`${label}: ${fmt(a)} → ${fmt(b)}`);
    }
    return out;
  }, [emp, scheduleForm, weekSchedule, savedWeekSchedule, dayTimings, savedDayTimings, payChanged]);
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
      segment_id: employee.segment_id ? String(employee.segment_id) : "",
      employment_subtype: employee.employment_subtype ?? "",
    });
    setScheduleForm({
      reporting_time: parseTimeInput(employee.reporting_time),
      leaving_time: parseTimeInput(employee.leaving_time),
      check_in_source: employee.check_in_source === "TIMETABLE" ? "TIMETABLE" : "FIXED",
      late_relaxation_minutes: employee.late_relaxation_minutes != null ? String(employee.late_relaxation_minutes) : "",
      monthly_pay: employee.monthly_pay != null ? String(employee.monthly_pay) : "",
      payroll_enabled: employee.payroll_enabled !== false,
      eobi_exempt: employee.eobi_exempt === true,
      sessi_exempt: employee.sessi_exempt === true,
      account_number: employee.account_number ?? "",
      bank_name: employee.bank_name ?? "",
    });
    hrService.getEmployeeWorkSchedule(employee.id).then((ws) => {
      setWeekSchedule(scheduleFromApi(ws, employee.days_per_week));
      setSavedWeekSchedule(scheduleFromApi(ws, employee.days_per_week));
    }).catch(() => {
      setWeekSchedule(defaultWeekSchedule(employee.days_per_week ?? 5));
      setSavedWeekSchedule(defaultWeekSchedule(employee.days_per_week ?? 5));
    });
    setTimingsEffectiveFrom(todayPkt());
    hrService.listScheduledTimings(employee.id).then(setScheduledTimings).catch(() => setScheduledTimings([]));
    hrService.listScheduledPay(employee.id).then(setScheduledPay).catch(() => setScheduledPay([]));
    hrService.getEmployeeDayTimings(employee.id).then((dt) => {
      setSavedDayTimings(dt.days);
      setDayTimings(dayTimingsFromApi(dt.days));
    }).catch(() => {
      setSavedDayTimings([]);
      setDayTimings({});
    });
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
    const matchedTab = Number(urlEmployeeId) === employeeId ? tabFromParam(urlTab) : null;
    setTab(matchedTab ?? "profile");
    reload();
    hrService.listDepartments().then(setDepartments).catch(() => {});
    hrService.listSegments().then(setSegments).catch(() => {});
  }, [employeeId, reload, urlEmployeeId, urlTab]);

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
    const soft = confirm(
      `Offboard ${name}?\n\n` +
      `This marks them TERMINATED, keeps HR progression history, excludes them from payroll, and disables their portal login.\n\n` +
      `For people who left voluntarily, prefer Mark as Left instead.`,
    );
    if (!soft) return;

    const hard = confirm(
      `Permanently purge this profile instead?\n\n` +
      `OK = hard delete (wipes progression history — only for mistaken/duplicate profiles)\n` +
      `Cancel = soft offboard (keeps history)`,
    );

    setDeleting(true);
    try {
      if (hard) {
        await hrService.deleteEmployee(emp.id, { purge: true });
        onDeleted();
        onClose();
      } else {
        const updated = await hrService.deleteEmployee(emp.id);
        if (updated && typeof updated === "object" && "id" in updated) {
          setEmp(updated as EmployeeProfile);
          syncForms(updated as EmployeeProfile);
          onUpdated();
        } else {
          onDeleted();
          onClose();
        }
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to offboard employee profile.");
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusChange = async (next: EmployeeStatus) => {
    if (!emp || next === (emp.employment_status ?? "ACTIVE")) return;
    let notes: string | null = null;
    if (next === "TERMINATED" || next === "LEFT") {
      let heldNote = "";
      try {
        const deposit = await hrService.getEmployeeSecurityDeposit(emp.id);
        const held = deposit.current?.held_amount ?? 0;
        if (held > 0) {
          heldNote = `\n\nThis employee still has Rs. ${held.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} security deposit held. Refund or forfeit it on the Security Deposit tab — changing status will not move that money.`;
        }
      } catch {
        // Status change should still proceed if the deposit lookup fails.
      }
      try {
        const loan = await hrService.getEmployeeLoan(emp.id);
        const outstanding = loan.current?.outstanding_balance ?? 0;
        if (outstanding > 0) {
          heldNote += `\n\nThis employee still has Rs. ${outstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} loan balance outstanding. Record a lump-sum repayment if you collected final dues, or mark it outstanding for follow-up, on the Loan tab.`;
        }
      } catch {
        // Status change should still proceed if the loan lookup fails.
      }
      const ok = confirm(
        (next === "LEFT"
          ? "Mark this employee as LEFT?\n\nTheir record stays in HR history, they will be excluded from payroll, and their portal login will be disabled."
          : `Set status to ${next}? This will deactivate the employee’s portal login if one is linked.`) + heldNote,
      );
      if (!ok) return;
      setLeaveDialog({ mode: "status", next });
      return;
    }
    if (emp.employment_status === "LEFT" || emp.employment_status === "TERMINATED") {
      // Coming back: ask when they rejoined before changing the status.
      setRejoinDialog({ next });
      return;
    }
    await applyStatus(next, notes, null);
  };

  const applyStatus = async (
    next: EmployeeStatus,
    notes: string | null,
    dateOfLeaving: string | null,
    joinDate: string | null = null,
  ) => {
    if (!emp) return;
    setSavingStatus(true);
    try {
      const updated = await hrService.updateEmployeeStatus(emp.id, next, notes, dateOfLeaving, joinDate);
      setEmp(updated);
      syncForms(updated);
      onUpdated();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to update employee status.");
    } finally {
      setSavingStatus(false);
    }
  };

  const handleMarkAsLeft = () => handleStatusChange("LEFT");

  const handleLeaveDialogSubmit = async (dateOfLeaving: string, reason: string) => {
    if (!emp || !leaveDialog) return;
    const dialog = leaveDialog;
    setLeaveDialog(null);
    if (dialog.mode === "edit") {
      setSavingStatus(true);
      try {
        const updated = await hrService.updateEmployeeLeavingDate(emp.id, dateOfLeaving);
        setEmp(updated);
        syncForms(updated);
        onUpdated();
      } catch (err: any) {
        alert(err?.response?.data?.message || "Failed to update date of leaving.");
      } finally {
        setSavingStatus(false);
      }
      return;
    }
    await applyStatus(dialog.next, reason.trim() || null, dateOfLeaving);
  };

  const handleRejoinDialogSubmit = async (joinDate: string | null, note: string) => {
    if (!rejoinDialog) return;
    const dialog = rejoinDialog;
    setRejoinDialog(null);
    await applyStatus(dialog.next, note.trim() || null, null, joinDate);
  };

  const handleSegmentChange = async (segmentId: string) => {
    if (!emp) return;
    const next = optionalId(segmentId);
    if (next === emp.segment_id) return;
    setSavingSegment(true);
    try {
      const updated = await hrService.updateEmployee(emp.id, { segment_id: next });
      setEmp(updated);
      syncForms(updated);
      onUpdated();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to update segment.");
    } finally {
      setSavingSegment(false);
    }
  };

  const handleSubtypeChange = async (targetSubtype: string) => {
    if (!emp) return;
    const next = (targetSubtype || null) as EmploymentSubtype | null;
    if (next === (emp.employment_subtype ?? null)) return;
    setSavingSubtype(true);
    try {
      const updated = await hrService.updateEmployee(emp.id, { employment_subtype: next });
      setEmp(updated);
      syncForms(updated);
      onUpdated();
      toast.success(`${emp.full_name || "Employee"}: ${next ? employmentSubtypeLabel(next) : "Unclassified"}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || "Failed to update employment subtype.");
    } finally {
      setSavingSubtype(false);
    }
  };

  /** Schedule & Pay save. Re-run with effectiveConfirmed once the effective date is picked (TAFSD-369). */
  const handleScheduleSave = async (effectiveConfirmed = false) => {
    if (!emp) return;
    if (scheduleForm.check_in_source === "FIXED" && (!scheduleForm.reporting_time.trim() || !scheduleForm.leaving_time.trim())) {
      alert("Expected check-in and check-out times are required when payroll uses fixed times.");
      return;
    }
    const shiftOrderError = scheduleForm.check_in_source === "FIXED"
      ? shiftTimeOrderError(scheduleForm.reporting_time, scheduleForm.leaving_time)
      : null;
    if (shiftOrderError) {
      alert(shiftOrderError);
      return;
    }
    if (countWorkingDays(weekSchedule) === 0) {
      alert("Pick at least one working day.");
      return;
    }
    const dayError = dayTimingsError(dayTimings, weekSchedule, scheduleForm);
    if (dayError) {
      alert(dayError);
      return;
    }
    // TAFSD-369: timing changes always ask when they take effect, right before saving.
    if ((timingsChanged || payChanged) && !effectiveConfirmed) {
      setTimingsEffectiveFrom(todayPkt());
      setEffectivePromptOpen(true);
      return;
    }
    setEffectivePromptOpen(false);
    setSavingSchedule(true);
    try {
      // Pay, bank and payroll flags save directly; timings and
      // working days go through the effective-from path (TAFSD-369).
      // Monthly pay goes through the effective-from path too (TAFSD-372).
      await hrService.updateEmployee(emp.id, {
        payroll_enabled: scheduleForm.payroll_enabled,
        eobi_exempt: scheduleForm.eobi_exempt,
        sessi_exempt: scheduleForm.sessi_exempt,
        account_number: optionalText(scheduleForm.account_number),
        bank_name: optionalText(scheduleForm.bank_name),
      });
      if (timingsChanged) {
        const result = await hrService.changeEmployeeTimings(emp.id, {
          effective_from: timingsEffectiveFrom,
          check_in_source: scheduleForm.check_in_source,
          reporting_time: optionalText(scheduleForm.reporting_time) ?? null,
          leaving_time: optionalText(scheduleForm.leaving_time) ?? null,
          late_relaxation_minutes: scheduleForm.late_relaxation_minutes
            ? parseInt(scheduleForm.late_relaxation_minutes, 10)
            : null,
          working_days: [0, 1, 2, 3, 4, 5, 6].filter((d) => weekSchedule[d]),
          day_timings: dayTimingsToApi(dayTimings, weekSchedule),
        });
        if (result.status === "SCHEDULED") {
          alert(`Saved. The new timings take effect from ${fmtDay(result.effective_from)}; until then the current timings stay.`);
        }
        if (result.warnings.length) alert(result.warnings.join("\n\n"));
      }
      if (payChanged) {
        const payResult = await hrService.changeEmployeePay(emp.id, {
          monthly_pay: scheduleForm.monthly_pay ? parseFloat(scheduleForm.monthly_pay) : null,
          effective_from: timingsEffectiveFrom,
        });
        if (payResult.status === "SCHEDULED") {
          alert(`Saved. The new pay takes effect from ${fmtDay(payResult.effective_from)}; until then the current pay stays.`);
        }
        if (payResult.warnings.length) alert(payResult.warnings.join("\n\n"));
      }
      await reload();
      setSavedSchedule(true);
      setEditSchedule(false);
      onUpdated();
      setTimeout(() => setSavedSchedule(false), 2000);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to update schedule.");
    } finally {
      setSavingSchedule(false);
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
  ].filter((t) => access.can(`${TAB_ACTION_PREFIX[t.id] ?? t.id}.view`));

  // The active tab can become unreachable — a tab arrives from ?tab= in the
  // URL, and `portal` appears only once the employee is loaded.
  const activeTab = tabs.some((t) => t.id === tab) ? tab : tabs[0]?.id ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      {leaveDialog && emp && (
        <LeavingDateDialog
          mode={leaveDialog.mode}
          status={leaveDialog.next}
          initialDate={emp.date_of_leaving}
          onCancel={() => setLeaveDialog(null)}
          onSubmit={handleLeaveDialogSubmit}
        />
      )}
      {rejoinDialog && emp && (
        <RejoinDateDialog
          status={rejoinDialog.next}
          currentJoinDate={emp.join_date}
          leavingDate={emp.date_of_leaving}
          onCancel={() => setRejoinDialog(null)}
          onSubmit={handleRejoinDialogSubmit}
        />
      )}
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
            {emp && access.canAny(
              "profile.edit", "employment.edit", "schedule_pay.edit",
              "classes.edit", "portal.edit", "biometric.edit",
            ) && (
              <button
                type="button"
                onClick={() => router.push(`/hr/employees/${emp.id}/edit`)}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
              >
                Advanced
              </button>
            )}
            {emp && canChangeStatus ? (
              <EmployeeStatusDropdown
                status={emp.employment_status ?? "ACTIVE"}
                loading={savingStatus}
                onAction={(newStatus) => handleStatusChange(newStatus as EmployeeStatus)}
              />
            ) : emp ? (
              <span className={`inline-flex text-xs border rounded-lg px-2.5 py-1.5 font-bold uppercase tracking-tight ${employeeStatusBadgeClass(emp?.employment_status)}`}>
                {emp.employment_status ?? "ACTIVE"}
              </span>
            ) : null}
            {emp && (emp.employment_status ?? "ACTIVE") === "ACTIVE" && (
              canChangeStatus ? (
                <EmployeeSubtypeDropdown
                  subtype={emp.employment_subtype ?? null}
                  loading={savingSubtype}
                  onAction={(newSubtype) => handleSubtypeChange(newSubtype)}
                />
              ) : emp.employment_subtype ? (
                <span className={`inline-flex text-xs border rounded-lg px-2.5 py-1.5 font-bold uppercase tracking-tight ${employmentSubtypeBadgeClass(emp.employment_subtype)}`}>
                  {employmentSubtypeLabel(emp.employment_subtype)}
                </span>
              ) : null
            )}
            {access.can("delete") && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || !emp}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100 transition-all disabled:opacity-50"
                title="Soft-offboard (keeps history). Confirm again to hard-purge mistaken profiles."
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete
              </button>
            )}
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
                activeTab === t.id ? "border-primary text-primary" : "border-transparent text-zinc-400 hover:text-zinc-600"
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
                {tabs.length === 0 && (
                  <div className="py-16 text-center">
                    <p className="text-sm font-bold text-zinc-600 dark:text-zinc-300">
                      You can open this record, but not any of its sections.
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Ask an administrator for the relevant view sub-permissions on the Employee Directory.
                    </p>
                  </div>
                )}

                {activeTab === "profile" && (
                  <EditableCard
                    title="Personal information"
                    canEdit={access.can("profile.edit")}
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
                      <div><FieldLabel>Full Name</FieldLabel><input className={inputCls} value={profileForm.full_name} onChange={e => setProfileForm(p => ({ ...p, full_name: e.target.value.toUpperCase() }))} /></div>
                      <div><FieldLabel>CNIC</FieldLabel><input className={`${inputCls} font-mono`} value={profileForm.cnic} onChange={e => setProfileForm(p => ({ ...p, cnic: formatCnic(e.target.value) }))} /></div>
                      <div><FieldLabel>Father's Name</FieldLabel><input className={inputCls} value={profileForm.father_name} onChange={e => setProfileForm(p => ({ ...p, father_name: e.target.value.toUpperCase() }))} /></div>
                      <div><FieldLabel>Mother's Name</FieldLabel><input className={inputCls} value={profileForm.mother_name} onChange={e => setProfileForm(p => ({ ...p, mother_name: e.target.value.toUpperCase() }))} /></div>
                      <div><FieldLabel>Date of Birth</FieldLabel><input type="date" className={inputCls} value={profileForm.date_of_birth} onChange={e => setProfileForm(p => ({ ...p, date_of_birth: e.target.value }))} /></div>
                      <div><FieldLabel>Personal Phone</FieldLabel><input className={inputCls} value={profileForm.personal_phone} onChange={e => setProfileForm(p => ({ ...p, personal_phone: e.target.value }))} /></div>
                      <div className="sm:col-span-2"><FieldLabel>Personal Email</FieldLabel><input type="email" className={inputCls} value={profileForm.personal_email} onChange={e => setProfileForm(p => ({ ...p, personal_email: e.target.value }))} /></div>
                      <div className="sm:col-span-2"><FieldLabel>Address</FieldLabel><textarea rows={2} className={textareaCls} value={profileForm.address} onChange={e => setProfileForm(p => ({ ...p, address: e.target.value.toUpperCase() }))} /></div>
                      <div className="sm:col-span-2"><FieldLabel>Internal Notes</FieldLabel><textarea rows={2} className={textareaCls} value={profileForm.notes} onChange={e => setProfileForm(p => ({ ...p, notes: e.target.value.toUpperCase() }))} /></div>
                      <div className="sm:col-span-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <p className="text-[11px] font-bold text-zinc-400 uppercase mb-3">Emergency contact</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div><FieldLabel>Name</FieldLabel><input className={inputCls} value={profileForm.emergency_contact_name} onChange={e => setProfileForm(p => ({ ...p, emergency_contact_name: e.target.value.toUpperCase() }))} /></div>
                          <div><FieldLabel>Phone</FieldLabel><input className={inputCls} value={profileForm.emergency_contact_phone} onChange={e => setProfileForm(p => ({ ...p, emergency_contact_phone: e.target.value }))} /></div>
                          <div><FieldLabel>Relationship</FieldLabel><input className={inputCls} value={profileForm.emergency_contact_relationship} onChange={e => setProfileForm(p => ({ ...p, emergency_contact_relationship: e.target.value.toUpperCase() }))} /></div>
                        </div>
                      </div>
                    </div>
                  </EditableCard>
                )}

                {activeTab === "employment" && (
                  <div className="space-y-4">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Employment Status</p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {canChangeStatus
                              ? "Mark as Left keeps the record and disables portal login. Delete soft-offboards by default; hard purge is only for mistaken/duplicate profiles."
                              : "Status is read-only for your role."}
                          </p>
                        </div>
                        {canChangeStatus ? (
                          <EmployeeStatusDropdown
                            status={emp.employment_status ?? "ACTIVE"}
                            loading={savingStatus}
                            onAction={(newStatus) => handleStatusChange(newStatus as EmployeeStatus)}
                          />
                        ) : (
                          <span className={`inline-flex text-xs border rounded-lg px-2.5 py-1.5 font-bold uppercase tracking-tight ${employeeStatusBadgeClass(emp.employment_status)}`}>
                            {emp.employment_status ?? "ACTIVE"}
                          </span>
                        )}
                      </div>
                    </div>
                    {(emp.employment_status ?? "ACTIVE") === "ACTIVE" && (
                      <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Employment Subtype</p>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              {canChangeStatus
                                ? "Permanent, Non-permanent, or Contractual staff classification."
                                : "Subtype classification for active staff."}
                            </p>
                          </div>
                          {canChangeStatus ? (
                            <EmployeeSubtypeDropdown
                              subtype={emp.employment_subtype ?? null}
                              loading={savingSubtype}
                              onAction={(newSubtype) => handleSubtypeChange(newSubtype)}
                            />
                          ) : emp.employment_subtype ? (
                            <span className={`inline-flex text-xs border rounded-lg px-2.5 py-1.5 font-bold uppercase tracking-tight ${employmentSubtypeBadgeClass(emp.employment_subtype)}`}>
                              {employmentSubtypeLabel(emp.employment_subtype)}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-400 italic">Unclassified</span>
                          )}
                        </div>
                      </div>
                    )}
                    {(emp.employment_status === "LEFT" || emp.employment_status === "TERMINATED") && (
                      <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Date of Leaving</p>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              Last day worked. Payroll pays from the start of that cycle up to and including this date.
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
                              {emp.date_of_leaving
                                ? new Date(emp.date_of_leaving).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
                                : "Not recorded"}
                            </span>
                            {canChangeStatus && (
                              <button
                                type="button"
                                onClick={() => setLeaveDialog({ mode: "edit", next: emp.employment_status })}
                                disabled={savingStatus}
                                className="h-9 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-[11px] font-black uppercase tracking-tight text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                              >
                                {emp.date_of_leaving ? "Edit" : "Set date"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Segment</p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Academic segment for scheduling, Saturday duty, and directory audit.
                          </p>
                        </div>
                        <div className="relative min-w-[220px]">
                          {savingSegment && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary animate-spin pointer-events-none" />
                          )}
                          <select
                            className={`w-full h-9 pl-3 pr-9 text-[12px] font-semibold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl appearance-none outline-none hover:border-zinc-300 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-60 ${savingSegment ? "pr-10" : ""}`}
                            value={emp.segment_id ? String(emp.segment_id) : ""}
                            disabled={savingSegment}
                            onChange={(e) => handleSegmentChange(e.target.value)}
                          >
                            <option value="">— No segment —</option>
                            {segmentsForEmpCampus.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                            {emp.segment_id && !segmentsForEmpCampus.some((s) => s.id === emp.segment_id) && (
                              // Already filed under a segment this campus does
                              // not run — keep it visible instead of blanking.
                              <option value={emp.segment_id}>
                                {emp.segments?.name ?? `Segment ${emp.segment_id}`} — not run at this campus
                              </option>
                            )}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  <EditableCard
                    title="Employment details"
                    canEdit={access.can("employment.edit")}
                    editing={editEmployment}
                    saving={savingEmployment}
                    saved={savedEmployment}
                    onEdit={() => setEditEmployment(true)}
                    onCancel={() => { setEditEmployment(false); syncForms(emp); }}
                    onSave={() => patch({
                      employee_code: optionalText(employmentForm.employee_code),
                      employee_code_dep: optionalText(employmentForm.employee_code_dep ? employmentForm.employee_code_dep.padStart(2, "0") : ""),
                      employee_code_number: optionalText(employmentForm.employee_code_number),
                      department_id: employmentForm.department_id ? parseInt(employmentForm.department_id, 10) : undefined,
                      staff_category_id: optionalId(employmentForm.staff_category_id),
                      job_title: optionalText(employmentForm.job_title),
                      campus_id: employmentForm.campus_id ? parseInt(employmentForm.campus_id, 10) : undefined,
                      join_date: optionalText(employmentForm.join_date),
                      job_description: optionalText(employmentForm.job_description),
                      segment_id: optionalId(employmentForm.segment_id),
                      employment_subtype: (employmentForm.employment_subtype || null) as EmploymentSubtype | null,
                    }, setSavingEmployment, setSavedEmployment, () => setEditEmployment(false))}
                    readContent={
                      <>
                        <ReadField icon={Shield} label="Status" value={
                          <span className={`inline-flex text-[11px] border rounded-md px-1.5 py-0.5 font-bold uppercase ${employeeStatusBadgeClass(emp.employment_status)}`}>
                            {emp.employment_status ?? "ACTIVE"}
                          </span>
                        } />
                        <ReadField icon={Award} label="Subtype" value={
                          emp.employment_subtype ? (
                            <span className={`inline-flex text-[11px] border rounded-md px-1.5 py-0.5 font-bold uppercase ${employmentSubtypeBadgeClass(emp.employment_subtype)}`}>
                              {employmentSubtypeLabel(emp.employment_subtype)}
                            </span>
                          ) : null
                        } missing={!emp.employment_subtype} />
                        <ReadField icon={CreditCard} label="Employee Code" value={
                          <span className="font-mono">{formatEmployeeCodeDisplay(emp)}</span>
                        } missing={!formatEmployeeCodeDisplay(emp)} />
                        <ReadField icon={Building2} label="Department" value={emp.departments?.name} missing={!emp.departments} />
                        <ReadField icon={Briefcase} label="Category" value={formatStaffCategory(emp.staff_categories)} missing={!emp.staff_categories} />
                        <ReadField icon={Briefcase} label="Designation" value={emp.job_title} missing={!emp.job_title} />
                        <ReadField icon={Layers} label="Segment" value={emp.segments?.name} missing={!emp.segments} />
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
                        campusPrefix={employmentCampusPrefix}
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
                        <FieldLabel>Designation</FieldLabel>
                        <input className={`${inputCls} uppercase`} value={employmentForm.job_title} onChange={e => setEmploymentForm(p => ({ ...p, job_title: e.target.value.toUpperCase() }))} />
                      </div>
                      <div>
                        <FieldLabel>Campus</FieldLabel>
                        <select className={inputCls} value={employmentForm.campus_id} onChange={e => {
                          const nextCampusId = e.target.value;
                          const offered = segmentsForCampus(segments, nextCampusId ? parseInt(nextCampusId, 10) : null);
                          setEmploymentForm(p => ({
                            ...p,
                            campus_id: nextCampusId,
                            // Drop a segment the new campus does not run rather
                            // than carrying it into a save the API would reject.
                            segment_id: offered.some(sg => String(sg.id) === p.segment_id) ? p.segment_id : "",
                          }));
                        }}>
                          <option value="">—</option>
                          {campuses.map(c => <option key={c.id} value={c.id}>{c.campus_name}</option>)}
                        </select>
                      </div>
                      <div>
                        <FieldLabel>Segment</FieldLabel>
                        <select className={inputCls} value={employmentForm.segment_id} onChange={e => setEmploymentForm(p => ({ ...p, segment_id: e.target.value }))}>
                          <option value="">— No segment —</option>
                          {segmentsForEmploymentForm.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <FieldLabel>Employment Subtype</FieldLabel>
                        <select
                          className={inputCls}
                          value={employmentForm.employment_subtype}
                          onChange={e => setEmploymentForm(p => ({ ...p, employment_subtype: e.target.value }))}
                        >
                          <option value="">— Unclassified —</option>
                          {EMPLOYMENT_SUBTYPE_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2"><FieldLabel>Job Description</FieldLabel><textarea rows={2} className={`${textareaCls} uppercase`} value={employmentForm.job_description} onChange={e => setEmploymentForm(p => ({ ...p, job_description: e.target.value.toUpperCase() }))} /></div>
                    </div>
                  </EditableCard>
                  <EmployeePreviousEmployersSection
                    employeeId={emp.id}
                    canEdit={access.can("profile.edit")}
                    initial={emp.employee_previous_employers}
                    onChanged={async () => {
                      const refreshed = await hrService.getEmployee(emp.id);
                      setEmp(refreshed);
                      onUpdated();
                    }}
                  />
                  </div>
                )}

                {activeTab === "security_deposit" && (
                  <EmployeeSecurityDepositTab employeeId={emp.id} canEdit={access.can("security_deposit.edit")} />
                )}

                {activeTab === "loan" && (
                  <EmployeeLoanTab employeeId={emp.id} employmentStatus={emp.employment_status} canEdit={access.can("loan.edit")} />
                )}

                {activeTab === "schedule" && (
                  <EditableCard
                    title="Schedule & pay"
                    canEdit={access.can("schedule_pay.edit")}
                    editing={editSchedule}
                    saving={savingSchedule}
                    saved={savedSchedule}
                    onEdit={() => setEditSchedule(true)}
                    onCancel={() => { setEditSchedule(false); syncForms(emp); }}
                    onSave={() => handleScheduleSave()}
                    readContent={
                      <>
                        <ReadField icon={Clock} label="Check-in source" value={scheduleForm.check_in_source === "TIMETABLE" ? "Derived from timetable" : "Fixed times"} />
                        <ReadField icon={Clock} label="Reporting Time" value={fmtTime(emp.reporting_time)} missing={!fmtTime(emp.reporting_time)} />
                        <ReadField icon={Clock} label="Leaving Time" value={fmtTime(emp.leaving_time)} missing={!fmtTime(emp.leaving_time)} />
                        <ReadField icon={Clock} label="Late Relaxation" value={emp.late_relaxation_minutes != null ? `${emp.late_relaxation_minutes} minutes` : null} missing={emp.late_relaxation_minutes == null} />
                        <ReadField icon={Calendar} label="Working Days" value={formatWeekSchedule(weekSchedule)} />
                        <ReadField
                          icon={Clock}
                          label="Day-specific timings"
                          value={formatDayTimings(savedDayTimings, scheduleForm) ?? "Same timings every working day"}
                        />
                        {scheduledPay.map((sp) => (
                          <div key={`pay-${sp.id}`} className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 px-3 py-2.5">
                            <Wallet className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-bold text-amber-800 dark:text-amber-300">Pay change scheduled from {fmtDay(sp.effective_from)}</p>
                              <p className="text-[12px] text-amber-800/90 dark:text-amber-300/90">{sp.summary}</p>
                              <p className="text-[11px] text-amber-700/70 mt-0.5">
                                Saved {new Date(sp.recorded_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                                {sp.changed_by ? ` by ${sp.changed_by}` : ""}
                              </p>
                            </div>
                            {access.can("schedule_pay.edit") && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!confirm(`Cancel the pay change scheduled from ${fmtDay(sp.effective_from)}?`)) return;
                                  await hrService.cancelScheduledPay(emp.id, sp.id);
                                  setScheduledPay((prev) => prev.filter((x) => x.id !== sp.id));
                                }}
                                className="text-[11px] font-bold text-amber-700 hover:underline"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        ))}
                        {scheduledTimings.map((sc) => (
                          <div key={sc.id} className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 px-3 py-2.5">
                            <Clock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-bold text-amber-800 dark:text-amber-300">
                                Scheduled from {fmtDay(sc.effective_from)}
                              </p>
                              <p className="text-[12px] text-amber-800/90 dark:text-amber-300/90">{sc.summary || "Same as current"}</p>
                              <p className="text-[11px] text-amber-700/70 mt-0.5">
                                Saved {new Date(sc.recorded_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                                {sc.changed_by ? ` by ${sc.changed_by}` : ""}
                              </p>
                            </div>
                            {access.can("schedule_pay.edit") && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!confirm(`Cancel the change scheduled from ${fmtDay(sc.effective_from)}?`)) return;
                                  await hrService.cancelScheduledTiming(emp.id, sc.id);
                                  setScheduledTimings((prev) => prev.filter((x) => x.id !== sc.id));
                                }}
                                className="text-[11px] font-bold text-amber-700 hover:underline"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        ))}
                        <ReadField icon={Briefcase} label="Monthly Pay" value={fmtMoney(emp.monthly_pay)} missing={emp.monthly_pay == null} />
                        <ReadField
                          icon={Wallet}
                          label="Payroll"
                          value={emp.payroll_enabled === false ? "Off payroll" : "On payroll"}
                        />
                        <ReadField
                          icon={Wallet}
                          label="Statutory deductions"
                          value={statutoryLabel(emp.eobi_exempt === true, emp.sessi_exempt === true)}
                        />
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
                        <FieldLabel required={scheduleForm.check_in_source === "FIXED"}>Reporting Time{scheduleForm.check_in_source === "TIMETABLE" ? " (fallback)" : ""}</FieldLabel>
                        <input type="time" required={scheduleForm.check_in_source === "FIXED"} className={inputCls} disabled={scheduleForm.check_in_source === "TIMETABLE"} value={scheduleForm.reporting_time} onChange={e => setScheduleForm(p => ({ ...p, reporting_time: e.target.value }))} />
                      </div>
                      <div>
                        <FieldLabel required={scheduleForm.check_in_source === "FIXED"}>Leaving Time{scheduleForm.check_in_source === "TIMETABLE" ? " (fallback)" : ""}</FieldLabel>
                        <input type="time" required={scheduleForm.check_in_source === "FIXED"} className={inputCls} disabled={scheduleForm.check_in_source === "TIMETABLE"} value={scheduleForm.leaving_time} onChange={e => setScheduleForm(p => ({ ...p, leaving_time: e.target.value }))} />
                        {scheduleForm.check_in_source === "FIXED" && shiftTimeOrderError(scheduleForm.reporting_time, scheduleForm.leaving_time) && (
                          <p role="alert" className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                            {shiftTimeOrderError(scheduleForm.reporting_time, scheduleForm.leaving_time)}
                          </p>
                        )}
                      </div>
                      <div><FieldLabel>Late Relaxation (minutes)</FieldLabel><input type="number" min={0} className={inputCls} value={scheduleForm.late_relaxation_minutes} onChange={e => setScheduleForm(p => ({ ...p, late_relaxation_minutes: e.target.value }))} /></div>
                      <div className="sm:col-span-2"><FieldLabel>Monthly Pay (PKR)</FieldLabel><input type="number" min={0} className={inputCls} value={scheduleForm.monthly_pay} onChange={e => setScheduleForm(p => ({ ...p, monthly_pay: e.target.value }))} /></div>
                      <div className="sm:col-span-2">
                        <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-3">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={scheduleForm.payroll_enabled}
                            onChange={(e) => setScheduleForm((p) => ({ ...p, payroll_enabled: e.target.checked }))}
                          />
                          <span>
                            <span className="block text-[13px] font-bold text-zinc-800 dark:text-zinc-200">Include in payroll runs</span>
                            <span className="block text-xs text-zinc-500 mt-0.5">
                              Turn off for test / placeholder staff so they are never picked up by payroll.
                            </span>
                          </span>
                        </label>
                      </div>
                      {([
                        ["eobi_exempt", "EOBI exempt", "No EOBI deduction or employer contribution for this employee."],
                        ["sessi_exempt", "SESSI exempt", "No SESSI employer contribution for this employee."],
                      ] as const).map(([key, title, hint]) => (
                        <label key={key} className="flex items-start gap-3 cursor-pointer rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-3">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={scheduleForm[key]}
                            onChange={(e) => setScheduleForm((p) => ({ ...p, [key]: e.target.checked }))}
                          />
                          <span>
                            <span className="block text-[13px] font-bold text-zinc-800 dark:text-zinc-200">{title}</span>
                            <span className="block text-xs text-zinc-500 mt-0.5">
                              {hint} Applies from the next payroll run; locked runs are not changed.
                            </span>
                          </span>
                        </label>
                      ))}
                      <div className="sm:col-span-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <p className="text-[11px] font-bold text-zinc-400 uppercase mb-3">Financial</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div><FieldLabel>Account Number</FieldLabel><input className={inputCls} value={scheduleForm.account_number} onChange={e => setScheduleForm(p => ({ ...p, account_number: e.target.value.toUpperCase() }))} /></div>
                          <div><FieldLabel>Bank Name</FieldLabel><input className={inputCls} value={scheduleForm.bank_name} onChange={e => setScheduleForm(p => ({ ...p, bank_name: e.target.value.toUpperCase() }))} /></div>
                        </div>
                      </div>
                      <div className="sm:col-span-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <FieldLabel>Working Days</FieldLabel>
                        <WorkingDaysPicker
                          value={weekSchedule}
                          onChange={setWeekSchedule}
                          hint={scheduleForm.check_in_source === "TIMETABLE"
                            ? "Check-in is derived from the timetable, so attendance follows the days that have timetable blocks."
                            : "Tap the days this employee is expected in. Days not selected are treated as days off."}
                        />
                      </div>
                      <div className="sm:col-span-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <FieldLabel>Timings by day</FieldLabel>
                        <p className="text-xs text-zinc-500 mb-3">
                          Every working day uses the reporting and leaving time above unless you give it its own,
                          for example a shorter Friday. Attendance and payroll judge each day by that day&apos;s timings.
                        </p>
                        <DayTimingsEditor
                          value={dayTimings}
                          onChange={setDayTimings}
                          week={weekSchedule}
                          normal={scheduleForm}
                          disabled={scheduleForm.check_in_source === "TIMETABLE"}
                        />
                      </div>
                    </div>
                  </EditableCard>
                )}

                {activeTab === "schedule" && effectivePromptOpen && (
                  <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl">
                      <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
                        <h3 className="text-base font-black text-zinc-900 dark:text-zinc-50">From when do these changes take effect?</h3>
                        <p className="text-xs text-zinc-500 mt-1">
                          Saved now, applied from the date below. The Progression tab shows both. Pay goes by this date from the 26 Oct 2026 payroll cycle onwards.
                        </p>
                      </div>
                      <div className="px-5 py-4 space-y-3">
                        <ul className="space-y-1 text-[13px] text-zinc-700 dark:text-zinc-300">
                          {timingChangeLines.map((line) => (
                            <li key={line} className="flex gap-2"><span className="text-primary">•</span>{line}</li>
                          ))}
                        </ul>
                        <div>
                          <FieldLabel required>Effective from</FieldLabel>
                          <input
                            type="date"
                            className={inputCls}
                            value={timingsEffectiveFrom}
                            onChange={(e) => setTimingsEffectiveFrom(e.target.value || todayPkt())}
                          />
                          <p className="text-xs text-zinc-500 mt-1.5">
                            {timingsEffectiveFrom < todayPkt()
                              ? "A past date re-judges attendance and payroll from that day with the new timings."
                              : timingsEffectiveFrom > todayPkt()
                                ? "A future date is scheduled: the current timings stay until then."
                                : "Applies from today."}
                          </p>
                        </div>
                      </div>
                      <div className="px-5 py-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEffectivePromptOpen(false)}
                          className="h-9 px-4 rounded-xl text-[11px] font-bold text-zinc-600 bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          disabled={savingSchedule}
                          onClick={() => handleScheduleSave(true)}
                          className="h-9 px-4 rounded-xl text-[11px] font-bold text-white bg-primary hover:bg-primary/90 disabled:opacity-50"
                        >
                          {savingSchedule ? "Saving…" : "Save changes"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "schedule" && (
                  <div className="mt-6 border-t border-zinc-100 pt-6 dark:border-zinc-800">
                    <EmployeeSalaryIncrementSection
                      employeeId={emp.id}
                      monthlyPay={emp.monthly_pay ?? null}
                      cycleOverride={emp.increment_cycle_months ?? null}
                      canManage={canManageIncrements}
                      onApplied={reload}
                    />
                  </div>
                )}

                {activeTab === "portal" && emp.users && (
                  <EmployeePortalAccountTab employee={emp} onUpdated={reload} access={access} />
                )}

                {activeTab === "biometric" && (
                  <EmployeeBiometricTab employeeId={emp.id} employeeName={name} canEdit={access.can("biometric.edit")} />
                )}

                {activeTab === "shift_overrides" && (
                  <EmployeeShiftOverridesTab employeeId={emp.id} employeeName={name} isSuperAdmin={isSuperAdmin && access.can("shift_overrides.edit")} />
                )}

                {activeTab === "classes" && (
                  <EditableCard
                    title="Class & section assignments"
                    canEdit={access.can("classes.edit")}
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

                {activeTab === "progression" && <EmployeeProgressionTab id={emp.id} />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LeavingDateDialog({
  mode,
  status,
  initialDate,
  onCancel,
  onSubmit,
}: {
  mode: "status" | "edit";
  status: string;
  initialDate: string | null | undefined;
  onCancel: () => void;
  onSubmit: (date: string, reason: string) => void;
}) {
  const [date, setDate] = useState(initialDate ? initialDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={(e) => { e.stopPropagation(); onCancel(); }}>
      <div
        className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-sm font-black text-zinc-800 dark:text-zinc-100">
            {mode === "edit" ? "Edit date of leaving" : status === "LEFT" ? "Mark as Left" : "Terminate employee"}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Last day worked. They are paid from the start of the pay cycle up to and including this date.
          </p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Date of leaving</p>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 text-sm"
          />
        </div>
        {mode === "status" && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Reason (optional)</p>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={255}
              placeholder="Saved on progression history"
              className="w-full h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 text-sm"
            />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="h-9 px-4 rounded-xl text-xs font-bold text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Cancel
          </button>
          <button
            type="button"
            disabled={!date}
            onClick={() => onSubmit(date, reason)}
            className="h-9 px-4 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-tight disabled:opacity-50"
          >
            {mode === "edit" ? "Save" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RejoinDateDialog({
  status,
  currentJoinDate,
  leavingDate,
  onCancel,
  onSubmit,
}: {
  status: string;
  currentJoinDate: string | null | undefined;
  leavingDate: string | null | undefined;
  onCancel: () => void;
  /** `date` is null when the original date of joining is kept. */
  onSubmit: (date: string | null, note: string) => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [keepOriginal, setKeepOriginal] = useState(false);
  const [note, setNote] = useState("");
  const left = leavingDate ? leavingDate.slice(0, 10) : null;
  const beforeLeaving = !keepOriginal && !!left && !!date && date <= left;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={(e) => { e.stopPropagation(); onCancel(); }}>
      <div
        className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-sm font-black text-zinc-800 dark:text-zinc-100">Rejoin as {status}</p>
          <p className="text-xs text-zinc-500 mt-1">
            This date replaces their date of joining. Their date of leaving{left ? ` (${fmtDate(left)})` : ""} is cleared and their portal login is re-enabled.
          </p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Date of rejoining</p>
          <input
            type="date"
            value={date}
            min={left ?? undefined}
            disabled={keepOriginal}
            onChange={(e) => setDate(e.target.value)}
            className="w-full h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 text-sm disabled:opacity-50"
          />
          {beforeLeaving && (
            <p className="text-xs text-rose-600 mt-1">Must be after the date of leaving.</p>
          )}
        </div>
        <label className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={keepOriginal}
            onChange={(e) => setKeepOriginal(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Keep the original date of joining{fmtDate(currentJoinDate ?? null) ? ` (${fmtDate(currentJoinDate ?? null)})` : ""} — use when they were marked as left by mistake.
          </span>
        </label>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Note (optional)</p>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={255}
            placeholder="Saved on progression history"
            className="w-full h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 text-sm"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="h-9 px-4 rounded-xl text-xs font-bold text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Cancel
          </button>
          <button
            type="button"
            disabled={!keepOriginal && (!date || beforeLeaving)}
            onClick={() => onSubmit(keepOriginal ? null : date, note)}
            className="h-9 px-4 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-tight disabled:opacity-50"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function EmployeeStatusDropdown({
  status,
  onAction,
  loading,
}: {
  status: string;
  onAction: (targetStatus: string) => void;
  loading: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const normalizedStatus = (status || "").toUpperCase();

  const statuses = [
    { id: 'ACTIVE',     label: 'Active',     icon: UserCheck,   color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', hover: 'hover:bg-emerald-100/50' },
    { id: 'LEFT',       label: 'Mark as Left', icon: DoorOpen,  color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100',   hover: 'hover:bg-amber-100/50' },
    { id: 'TERMINATED', label: 'Terminated', icon: Ban,        color: 'text-rose-600',    bg: 'bg-rose-50',    border: 'border-rose-100',    hover: 'hover:bg-rose-100/50' },
  ];

  const current = statuses.find((x) => x.id === normalizedStatus) || statuses[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className={`flex items-center gap-2 px-3.5 h-9 rounded-xl border transition-all ${current.bg} ${current.border} ${current.color} hover:shadow-sm active:scale-95 disabled:opacity-50`}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <current.icon className="h-3.5 w-3.5" />}
        <span className="text-[11px] font-black uppercase tracking-tight">{current.label}</span>
        <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }}
              className="absolute right-0 mt-2 w-52 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-100 dark:border-zinc-800 py-1.5 z-20 overflow-hidden"
            >
              <div className="px-3 py-1.5 mb-1 border-b border-zinc-50 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Change Status</span>
              </div>
              {statuses.map((item) => {
                const isCurrent = item.id === normalizedStatus;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isCurrent || loading}
                    onClick={() => {
                      setIsOpen(false);
                      if (!isCurrent) onAction(item.id);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                      isCurrent ? "bg-zinc-50 dark:bg-zinc-800/50 opacity-50 cursor-default" : `${item.hover} group`
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg border ${item.bg} ${item.border} ${item.color}`}>
                      <item.icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className={`text-[12px] font-bold ${isCurrent ? "text-zinc-400" : "text-zinc-700 dark:text-zinc-200"}`}>
                        {item.label}
                      </span>
                      {isCurrent && <span className="text-[9px] text-zinc-400 italic font-medium">Current Status</span>}
                    </div>
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmployeeSubtypeDropdown({
  subtype,
  onAction,
  loading,
}: {
  subtype: EmploymentSubtype | null;
  onAction: (targetSubtype: string) => void;
  loading: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const subtypes = [
    {
      id: "PERMANENT",
      label: "Permanent",
      hint: "Standard permanent staff",
      icon: Award,
      color: "text-blue-700 dark:text-blue-300",
      bg: "bg-blue-50 dark:bg-blue-950/40",
      border: "border-blue-200 dark:border-blue-800",
      hover: "hover:bg-blue-100/50 dark:hover:bg-blue-900/30",
    },
    {
      id: "NON_PERMANENT",
      label: "Non-Permanent",
      hint: "Probationary or visiting",
      icon: Clock,
      color: "text-amber-700 dark:text-amber-300",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      border: "border-amber-200 dark:border-amber-800",
      hover: "hover:bg-amber-100/50 dark:hover:bg-amber-900/30",
    },
    {
      id: "CONTRACTUAL",
      label: "Contractual",
      hint: "Fixed-term contract",
      icon: FileText,
      color: "text-purple-700 dark:text-purple-300",
      bg: "bg-purple-50 dark:bg-purple-950/40",
      border: "border-purple-200 dark:border-purple-800",
      hover: "hover:bg-purple-100/50 dark:hover:bg-purple-900/30",
    },
  ];

  const current = subtypes.find((x) => x.id === subtype);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className={`flex items-center gap-1.5 px-3 h-9 rounded-xl border transition-all ${
          current
            ? `${current.bg} ${current.border} ${current.color}`
            : "border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-500 hover:border-zinc-400"
        } hover:shadow-sm active:scale-95 disabled:opacity-50`}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : current ? (
          <current.icon className="h-3.5 w-3.5" />
        ) : (
          <Award className="h-3.5 w-3.5 opacity-60" />
        )}
        <span className="text-[11px] font-black uppercase tracking-tight">
          {current ? current.label : "Set Subtype"}
        </span>
        <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }}
              className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-100 dark:border-zinc-800 py-1.5 z-20 overflow-hidden"
            >
              <div className="px-3 py-1.5 mb-1 border-b border-zinc-50 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Employment Subtype</span>
              </div>
              {subtypes.map((item) => {
                const isCurrent = item.id === subtype;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isCurrent || loading}
                    onClick={() => {
                      setIsOpen(false);
                      if (!isCurrent) onAction(item.id);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                      isCurrent ? "bg-zinc-50 dark:bg-zinc-800/50 opacity-50 cursor-default" : `${item.hover} group`
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg border ${item.bg} ${item.border} ${item.color}`}>
                      <item.icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className={`text-[12px] font-bold ${isCurrent ? "text-zinc-400" : "text-zinc-700 dark:text-zinc-200"}`}>
                        {item.label}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-normal">{item.hint}</span>
                      {isCurrent && <span className="text-[9px] text-zinc-400 italic font-medium mt-0.5">Current Subtype</span>}
                    </div>
                  </button>
                );
              })}
              {subtype && (
                <div className="border-t border-zinc-100 dark:border-zinc-800 mt-1 pt-1">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setIsOpen(false);
                      onAction("");
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <span>— Clear subtype (Unclassified)</span>
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
