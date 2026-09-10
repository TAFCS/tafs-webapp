"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users, Plus, Loader2, AlertCircle, CheckCircle2, Search, X,
  SlidersHorizontal, Building2, Briefcase, AlertTriangle, Phone, Download, Layers, BadgeCheck,
} from "lucide-react";
import { hrService, EmployeeProfile, EmployeeStatus, formatStaffCategory, EMPLOYEE_STATUS_OPTIONS, employeeStatusBadgeClass } from "@/lib/hr.service";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { EmployeeDetailPanel } from "./_components/EmployeeDetailPanel";
import toast from "react-hot-toast";

const toggleId = <T extends string | number>(prev: T[], id: T): T[] =>
  prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];

function initials(name: string) {
  return name.split(" ").filter(Boolean).map(n => n[0]).slice(0, 2).join("").toUpperCase();
}

const AVATAR_COLORS = ["bg-violet-100 text-violet-700", "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700"];

function missingFields(emp: EmployeeProfile): string[] {
  const missing: string[] = [];
  if (!emp.cnic) missing.push("CNIC");
  if (!emp.join_date) missing.push("Date of Joining");
  if (emp.monthly_pay == null) missing.push("Monthly Pay");
  if (!emp.photo_url) missing.push("Photo");
  if (!emp.employee_code) missing.push("Employee Code");
  return missing;
}

function FilterSelect({ label, value, onChange, options, icon }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; icon?: React.ReactNode }) {
  return (
    <div className="relative">
      {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">{icon}</div>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`h-9 pr-3 text-[12px] font-medium text-zinc-700 bg-white border border-zinc-200 rounded-xl appearance-none outline-none hover:border-zinc-300 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all ${icon ? "pl-8" : "pl-3"}`}
      >
        <option value="">{label}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function EmployeeCard({ employee, onClick }: { employee: EmployeeProfile; onClick: () => void }) {
  const name = employee.full_name || employee.users?.full_name || `Profile #${employee.id}`;
  const missing = missingFields(employee);
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-4 hover:shadow-md hover:border-zinc-200 dark:hover:border-zinc-700 transition-all duration-200 active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        {employee.photo_url ? (
          <img
            src={employee.photo_url.replace(/([^:])\/\//g, "$1/")}
            alt={name}
            className="h-11 w-11 rounded-xl object-cover bg-zinc-100 shrink-0"
          />
        ) : (
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${color}`}>
            {initials(name)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold text-zinc-900 dark:text-white text-[14px] leading-tight truncate">{name}</p>
            {missing.length > 0 && (
              <div title={`Missing: ${missing.join(", ")}`}>
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              </div>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {employee.employee_code && (
              <span className="text-[11px] text-zinc-400 font-mono font-bold">{employee.employee_code}</span>
            )}
            {employee.cnic && <span className="text-[11px] text-zinc-400 font-mono">{employee.cnic}</span>}
          </div>
          {/* Status + Role */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={`text-[10px] border rounded-md px-1.5 py-0.5 font-bold uppercase tracking-tight ${employeeStatusBadgeClass(employee.employment_status)}`}>
              {employee.employment_status ?? "ACTIVE"}
            </span>
            {employee.job_title && (
              <span className="flex items-center gap-1 text-[10px] bg-primary/10 text-primary rounded-md px-1.5 py-0.5 font-bold uppercase tracking-tight">
                <Briefcase className="h-2.5 w-2.5" />{employee.job_title}
              </span>
            )}
          </div>

          {/* Category */}
          {employee.staff_categories && (
            <div className="mt-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] bg-violet-50 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-900 text-violet-700 dark:text-violet-300 rounded-md px-1.5 py-0.5 font-bold uppercase tracking-tight">
                {formatStaffCategory(employee.staff_categories)}
              </span>
            </div>
          )}

          {/* Location / contact info */}
          {(employee.departments?.name || employee.campuses?.campus_name || employee.personal_phone) && (
            <div className="mt-1.5 space-y-0.5">
              {(employee.departments?.name || employee.campuses?.campus_name) && (
                <div className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <Building2 className="h-3 w-3 shrink-0 text-zinc-400" />
                  <span className="truncate">
                    {[employee.departments?.name, employee.campuses?.campus_name].filter(Boolean).join(" · ")}
                  </span>
                </div>
              )}
              {employee.personal_phone && (
                <div className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <Phone className="h-3 w-3 shrink-0 text-zinc-400" />
                  <span>{employee.personal_phone}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

const STATUS_OPTIONS: { id: EmployeeStatus; label: string }[] = EMPLOYEE_STATUS_OPTIONS.map((o) => ({ id: o.value, label: o.label }));

const AUDIT_OPTIONS = [
  { value: "missing_cnic", label: "Missing CNIC" },
  { value: "missing_doj", label: "Missing Date of Joining" },
  { value: "missing_pay", label: "No Salary" },
  { value: "missing_photo", label: "No Photo" },
  { value: "missing_code", label: "No Employee Code" },
  { value: "no_device_mapping", label: "No Device Mappings" },
  { value: "no_segment", label: "No Segment (Academics)" },
  { value: "no_fixed_times", label: "No Fixed Times (Payroll)" },
  { value: "incomplete", label: "Any Incomplete Field" },
];

/** Employees expected to punch in — the only ones a missing device mapping is a defect for. */
const MAPPING_AUDIT_STATUSES = ["ACTIVE", "PERMANENT"];

/** Synthetic serial for the one-off old-device Excel attendance backfill — not a real biometric device. */
const OLD_DEVICE_BACKFILL_SN = "OLDDEV-XLS";

/**
 * A real, usable biometric enrolment. The OLDDEV-XLS serial is a historical
 * import artifact — those staff still need enrolling on a live device, so it
 * does not count here.
 */
function hasActiveDeviceMapping(emp: EmployeeProfile): boolean {
  return (emp.device_user_mappings || []).some(
    (m) => m.is_active !== false && m.device_sn !== OLD_DEVICE_BACKFILL_SN,
  );
}

/** Teaching-related staff, i.e. the whole ACADEMICS department — the only ones a missing segment is a defect for. */
function isAcademicsDeptEmployee(emp: EmployeeProfile): boolean {
  return (emp.departments?.name || "").trim().toUpperCase() === "ACADEMICS";
}

/** Payroll only reads reporting_time/leaving_time when check_in_source is FIXED (the default);
 *  TIMETABLE-sourced employees derive their window from teaching blocks instead. Missing either
 *  one on a FIXED profile silently zeroes the scheduled minutes payroll divides by. */
function hasFixedTimingGap(emp: EmployeeProfile): boolean {
  return emp.check_in_source === "FIXED" && (!emp.reporting_time || !emp.leaving_time);
}

// ── Column Configuration for Excel Export ──────────────────────────────────
interface ColumnOption {
  key: string;
  label: string;
}

const EMPLOYEE_DETAILS_COLUMNS: ColumnOption[] = [
  { key: "full_name", label: "Employee Name" },
  { key: "employee_code", label: "Employee Code" },
  { key: "cnic", label: "CNIC" },
  { key: "date_of_birth", label: "Date of Birth" },
  { key: "personal_phone", label: "Personal Phone" },
  { key: "secondary_phone", label: "Secondary Phone" },
  { key: "personal_email", label: "Personal Email" },
  { key: "address", label: "Residential Address" },
  { key: "photo_url", label: "Photo URL" },
];

const PLACEMENT_ROLE_COLUMNS: ColumnOption[] = [
  { key: "campus", label: "Campus" },
  { key: "department", label: "Department" },
  { key: "category", label: "Staff Category" },
  { key: "segment", label: "Segment" },
  { key: "job_title", label: "Job Title" },
  { key: "job_description", label: "Job Description" },
  { key: "class_section_assignments", label: "Class-Section Assignments" },
  { key: "employment_status", label: "Employment Status" },
  { key: "employment_type", label: "Employment Type" },
  { key: "is_permanent", label: "Is Permanent" },
  { key: "join_date", label: "Date of Joining" },
  { key: "reporting_manager", label: "Reporting Manager" },
];

const SCHEDULE_BIOMETRIC_COLUMNS: ColumnOption[] = [
  { key: "reporting_time", label: "Reporting Time" },
  { key: "leaving_time", label: "Leaving Time" },
  { key: "days_per_week", label: "Days Per Week" },
  { key: "late_relaxation_minutes", label: "Late Relaxation (Mins)" },
  { key: "check_in_source", label: "Check-In Source" },
  { key: "device_pin", label: "Biometric Device PIN" },
  { key: "device_sn", label: "Biometric Device SN" },
];

const PAYROLL_BANKING_COLUMNS: ColumnOption[] = [
  { key: "monthly_pay", label: "Monthly Pay (PKR)" },
  { key: "payroll_enabled", label: "Payroll Enabled" },
  { key: "bank_name", label: "Bank Name" },
  { key: "account_number", label: "Account Number / IBAN" },
];

const FAMILY_EMERGENCY_COLUMNS: ColumnOption[] = [
  { key: "father_name", label: "Father Name" },
  { key: "father_cnic", label: "Father CNIC" },
  { key: "mother_name", label: "Mother Name" },
  { key: "mother_cnic", label: "Mother CNIC" },
  { key: "spouse_name", label: "Spouse Name" },
  { key: "spouse_cnic", label: "Spouse CNIC" },
  { key: "emergency_contact_name", label: "Emergency Contact Name" },
  { key: "emergency_contact_phone", label: "Emergency Contact Phone" },
  { key: "emergency_contact_relationship", label: "Emergency Contact Relationship" },
];

const SYSTEM_ADMIN_COLUMNS: ColumnOption[] = [
  { key: "id", label: "DB ID" },
  { key: "employee_code_dep", label: "Dept Code Part" },
  { key: "employee_code_number", label: "Number Code Part" },
  { key: "linked_user", label: "Linked User Account" },
  { key: "notes", label: "Notes / Remarks" },
];

const STANDARD_COLUMNS = [
  "employee_code",
  "full_name",
  "cnic",
  "campus",
  "department",
  "category",
  "job_title",
  "employment_status",
  "join_date",
  "monthly_pay",
  "personal_phone",
  "personal_email",
];

interface ExportColumnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (selectedKeys: string[]) => void;
  isExporting: boolean;
}

function ExportColumnModal({ isOpen, onClose, onExport, isExporting }: ExportColumnModalProps) {
  const [selected, setSelected] = useState<string[]>(STANDARD_COLUMNS);

  if (!isOpen) return null;

  const handleToggle = (key: string) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleToggleCategory = (keys: string[], allSelected: boolean) => {
    if (allSelected) {
      setSelected((prev) => prev.filter((k) => !keys.includes(k)));
    } else {
      setSelected((prev) => [...new Set([...prev, ...keys])]);
    }
  };

  const basicKeys = EMPLOYEE_DETAILS_COLUMNS.map((c) => c.key);
  const placementKeys = PLACEMENT_ROLE_COLUMNS.map((c) => c.key);
  const scheduleKeys = SCHEDULE_BIOMETRIC_COLUMNS.map((c) => c.key);
  const payrollKeys = PAYROLL_BANKING_COLUMNS.map((c) => c.key);
  const familyKeys = FAMILY_EMERGENCY_COLUMNS.map((c) => c.key);
  const systemKeys = SYSTEM_ADMIN_COLUMNS.map((c) => c.key);

  const allKeys = [
    ...basicKeys,
    ...placementKeys,
    ...scheduleKeys,
    ...payrollKeys,
    ...familyKeys,
    ...systemKeys,
  ];

  const allBasicSelected = basicKeys.every((k) => selected.includes(k));
  const allPlacementSelected = placementKeys.every((k) => selected.includes(k));
  const allScheduleSelected = scheduleKeys.every((k) => selected.includes(k));
  const allPayrollSelected = payrollKeys.every((k) => selected.includes(k));
  const allFamilySelected = familyKeys.every((k) => selected.includes(k));
  const allSystemSelected = systemKeys.every((k) => selected.includes(k));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl border border-zinc-100 flex flex-col animate-slide-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-[16px] text-zinc-900">Customize Export Columns</h3>
            <p className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider mt-0.5">
              Select fields to include in your Excel report
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-50 rounded-xl text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Presets */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelected([...new Set(allKeys)])}
              className="px-3 py-1.5 text-[11px] font-bold text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-xl hover:bg-zinc-100 transition-colors"
            >
              Select All
            </button>
            <button
              onClick={() => setSelected(STANDARD_COLUMNS)}
              className="px-3 py-1.5 text-[11px] font-bold text-primary bg-primary/5 border border-primary/20 rounded-xl hover:bg-primary/10 transition-colors"
            >
              Standard Columns
            </button>
            <button
              onClick={() => setSelected([])}
              className="px-3 py-1.5 text-[11px] font-bold text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-xl hover:bg-zinc-100 transition-colors"
            >
              Deselect All
            </button>
          </div>

          {/* Category: Employee Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <h4 className="text-[12px] font-extrabold text-zinc-700 uppercase tracking-wider">
                Employee Details
              </h4>
              <label className="flex items-center gap-2 text-[11px] font-bold text-zinc-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allBasicSelected}
                  onChange={() => handleToggleCategory(basicKeys, allBasicSelected)}
                  className="rounded border-zinc-300 text-primary focus:ring-primary h-4 w-4"
                />
                Toggle Category
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {EMPLOYEE_DETAILS_COLUMNS.map((col) => (
                <label
                  key={col.key}
                  className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-zinc-50 border border-transparent hover:border-zinc-100 transition-all cursor-pointer select-none text-[12px] font-medium text-zinc-600"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(col.key)}
                    onChange={() => handleToggle(col.key)}
                    className="rounded border-zinc-300 text-primary focus:ring-primary mt-0.5 h-4 w-4"
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </div>

          {/* Category: Placement & Role */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <h4 className="text-[12px] font-extrabold text-zinc-700 uppercase tracking-wider">
                Placement & Role
              </h4>
              <label className="flex items-center gap-2 text-[11px] font-bold text-zinc-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allPlacementSelected}
                  onChange={() => handleToggleCategory(placementKeys, allPlacementSelected)}
                  className="rounded border-zinc-300 text-primary focus:ring-primary h-4 w-4"
                />
                Toggle Category
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {PLACEMENT_ROLE_COLUMNS.map((col) => (
                <label
                  key={col.key}
                  className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-zinc-50 border border-transparent hover:border-zinc-100 transition-all cursor-pointer select-none text-[12px] font-medium text-zinc-600"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(col.key)}
                    onChange={() => handleToggle(col.key)}
                    className="rounded border-zinc-300 text-primary focus:ring-primary mt-0.5 h-4 w-4"
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </div>

          {/* Category: Timing & Biometrics */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <h4 className="text-[12px] font-extrabold text-zinc-700 uppercase tracking-wider">
                Timing & Biometrics
              </h4>
              <label className="flex items-center gap-2 text-[11px] font-bold text-zinc-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allScheduleSelected}
                  onChange={() => handleToggleCategory(scheduleKeys, allScheduleSelected)}
                  className="rounded border-zinc-300 text-primary focus:ring-primary h-4 w-4"
                />
                Toggle Category
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {SCHEDULE_BIOMETRIC_COLUMNS.map((col) => (
                <label
                  key={col.key}
                  className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-zinc-50 border border-transparent hover:border-zinc-100 transition-all cursor-pointer select-none text-[12px] font-medium text-zinc-600"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(col.key)}
                    onChange={() => handleToggle(col.key)}
                    className="rounded border-zinc-300 text-primary focus:ring-primary mt-0.5 h-4 w-4"
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </div>

          {/* Category: Payroll & Banking */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <h4 className="text-[12px] font-extrabold text-zinc-700 uppercase tracking-wider">
                Payroll & Banking
              </h4>
              <label className="flex items-center gap-2 text-[11px] font-bold text-zinc-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allPayrollSelected}
                  onChange={() => handleToggleCategory(payrollKeys, allPayrollSelected)}
                  className="rounded border-zinc-300 text-primary focus:ring-primary h-4 w-4"
                />
                Toggle Category
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {PAYROLL_BANKING_COLUMNS.map((col) => (
                <label
                  key={col.key}
                  className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-zinc-50 border border-transparent hover:border-zinc-100 transition-all cursor-pointer select-none text-[12px] font-medium text-zinc-600"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(col.key)}
                    onChange={() => handleToggle(col.key)}
                    className="rounded border-zinc-300 text-primary focus:ring-primary mt-0.5 h-4 w-4"
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </div>

          {/* Category: Family & Emergency Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <h4 className="text-[12px] font-extrabold text-zinc-700 uppercase tracking-wider">
                Family & Emergency Details
              </h4>
              <label className="flex items-center gap-2 text-[11px] font-bold text-zinc-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allFamilySelected}
                  onChange={() => handleToggleCategory(familyKeys, allFamilySelected)}
                  className="rounded border-zinc-300 text-primary focus:ring-primary h-4 w-4"
                />
                Toggle Category
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {FAMILY_EMERGENCY_COLUMNS.map((col) => (
                <label
                  key={col.key}
                  className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-zinc-50 border border-transparent hover:border-zinc-100 transition-all cursor-pointer select-none text-[12px] font-medium text-zinc-600"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(col.key)}
                    onChange={() => handleToggle(col.key)}
                    className="rounded border-zinc-300 text-primary focus:ring-primary mt-0.5 h-4 w-4"
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </div>

          {/* Category: System & Administrative */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <h4 className="text-[12px] font-extrabold text-zinc-700 uppercase tracking-wider">
                System & Administrative
              </h4>
              <label className="flex items-center gap-2 text-[11px] font-bold text-zinc-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allSystemSelected}
                  onChange={() => handleToggleCategory(systemKeys, allSystemSelected)}
                  className="rounded border-zinc-300 text-primary focus:ring-primary h-4 w-4"
                />
                Toggle Category
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {SYSTEM_ADMIN_COLUMNS.map((col) => (
                <label
                  key={col.key}
                  className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-zinc-50 border border-transparent hover:border-zinc-100 transition-all cursor-pointer select-none text-[12px] font-medium text-zinc-600"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(col.key)}
                    onChange={() => handleToggle(col.key)}
                    className="rounded border-zinc-300 text-primary focus:ring-primary mt-0.5 h-4 w-4"
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between gap-3">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            {selected.length} columns selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 h-9 text-[12px] font-bold text-zinc-700 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onExport(selected)}
              disabled={selected.length === 0 || isExporting}
              className="flex items-center gap-1.5 px-5 h-9 text-[12px] font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Export Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmployeesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");

  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (idParam) {
      const parsedId = Number(idParam);
      if (!isNaN(parsedId) && parsedId > 0) {
        setSelectedId(parsedId);
      }
    }
  }, [idParam]);

  useEffect(() => {
    if (searchParams.get("created") === "1") {
      toast.success("Employee registered successfully!");
      const params = new URLSearchParams(searchParams.toString());
      params.delete("created");
      const nextQuery = params.toString() ? `?${params.toString()}` : "";
      router.replace(`/hr/employees${nextQuery}`, { scroll: false });
    }
    const statusParam = searchParams.get("status");
    if (statusParam !== null) {
      setStatuses(statusParam ? (statusParam.split(",").filter(Boolean) as EmployeeStatus[]) : []);
    }
  }, [searchParams, router]);

  const [search, setSearch] = useState("");
  const [campusIds, setCampusIds] = useState<number[]>([]);
  const [departmentIds, setDepartmentIds] = useState<number[]>([]);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [statuses, setStatuses] = useState<EmployeeStatus[]>(() => {
    const statusParam = searchParams.get("status");
    if (statusParam) {
      return statusParam.split(",").filter(Boolean) as EmployeeStatus[];
    }
    return ["ACTIVE"];
  });
  const [auditFilter, setAuditFilter] = useState("");

  const handleExportExcel = async (selectedColumns: string[]) => {
    setIsExporting(true);
    try {
      await hrService.exportEmployeesExcel({
        columns: selectedColumns,
        ids: filteredEmployees.map((e) => e.id),
      });
      toast.success("Excel export downloaded successfully!");
      setIsExportModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to export employee directory.");
    } finally {
      setIsExporting(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const empList = await hrService.listEmployeesSummary();
      setEmployees(empList);
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch employees.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 4000);
    return () => clearTimeout(t);
  }, [success]);

  const campusOptions = useMemo(() => {
    const map = new Map<number, string>();
    employees.forEach(e => { if (e.campuses) map.set(e.campuses.id, e.campuses.campus_name); });
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  }, [employees]);

  const departmentOptions = useMemo(() => {
    const map = new Map<number, string>();
    employees.forEach(e => { if (e.departments) map.set(e.departments.id, e.departments.name); });
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  }, [employees]);

  const categoryOptions = useMemo(() => {
    const map = new Map<number, string>();
    employees.forEach((e) => {
      if (e.staff_categories) {
        const cat = e.staff_categories;
        map.set(cat.id, cat.name || cat.code);
      }
    });
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter(emp => {
      const empCampusId = emp.campus_id ?? emp.campuses?.id;
      const empDeptId = emp.department_id ?? emp.departments?.id;
      const empCatId = emp.staff_category_id ?? emp.staff_categories?.id;
      if (campusIds.length > 0 && (empCampusId == null || !campusIds.includes(empCampusId))) return false;
      if (departmentIds.length > 0 && (empDeptId == null || !departmentIds.includes(empDeptId))) return false;
      if (categoryIds.length > 0 && (empCatId == null || !categoryIds.includes(empCatId))) return false;
      if (statuses.length > 0 && !statuses.includes(emp.employment_status ?? "ACTIVE")) return false;

      if (q) {
        const name = (emp.full_name || emp.users?.full_name || "").toLowerCase();
        const code = (emp.employee_code || "").toLowerCase();
        const cnic = (emp.cnic || "").toLowerCase();
        const title = (emp.job_title || "").toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !cnic.includes(q) && !title.includes(q)) return false;
      }

      if (auditFilter) {
        const missing = missingFields(emp);
        if (auditFilter === "missing_cnic" && !missing.includes("CNIC")) return false;
        if (auditFilter === "missing_doj" && !missing.includes("Date of Joining")) return false;
        if (auditFilter === "missing_pay" && !missing.includes("Monthly Pay")) return false;
        if (auditFilter === "missing_photo" && !missing.includes("Photo")) return false;
        if (auditFilter === "missing_code" && !missing.includes("Employee Code")) return false;
        if (auditFilter === "no_device_mapping") {
          if (!MAPPING_AUDIT_STATUSES.includes(emp.employment_status ?? "ACTIVE")) return false;
          if (hasActiveDeviceMapping(emp)) return false;
        }
        if (auditFilter === "no_segment") {
          if (!isAcademicsDeptEmployee(emp)) return false;
          if (emp.segment_id) return false;
        }
        if (auditFilter === "no_fixed_times" && !hasFixedTimingGap(emp)) return false;
        if (auditFilter === "incomplete" && missing.length === 0) return false;
      }
      return true;
    });
  }, [employees, search, campusIds, departmentIds, categoryIds, statuses, auditFilter]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-primary/10 rounded-2xl">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Employee Directory</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {loading ? "Manage workforce records and profile configurations" : <span><strong className="text-zinc-700 dark:text-zinc-300">{filteredEmployees.length}</strong> of {employees.length} employees</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExportModalOpen(true)}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 h-9 text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>Download Excel</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-800 dark:text-rose-400 rounded-2xl p-4 text-sm flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
          <p className="flex-1">{error}</p>
          <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg"><X className="h-4 w-4" /></button>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400 rounded-2xl p-4 text-sm flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          <p className="flex-1">{success}</p>
          <button onClick={() => setSuccess(null)} className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by name, code, CNIC, or role..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-9 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="w-[180px]">
          <FilterDropdown
            label="Campus"
            icon={Building2}
            value={campusIds}
            options={campusOptions}
            placeholder="All Campuses"
            onToggle={(id) => setCampusIds((prev) => toggleId(prev, id))}
            onClear={() => setCampusIds([])}
          />
        </div>
        <div className="w-[180px]">
          <FilterDropdown
            label="Department"
            icon={Building2}
            value={departmentIds}
            options={departmentOptions}
            placeholder="All Departments"
            onToggle={(id) => setDepartmentIds((prev) => toggleId(prev, id))}
            onClear={() => setDepartmentIds([])}
          />
        </div>
        <div className="w-[180px]">
          <FilterDropdown
            label="Category"
            icon={Layers}
            value={categoryIds}
            options={categoryOptions}
            placeholder="All Categories"
            onToggle={(id) => setCategoryIds((prev) => toggleId(prev, id))}
            onClear={() => setCategoryIds([])}
          />
        </div>
        <div className="w-[180px]">
          <FilterDropdown
            label="Status"
            icon={BadgeCheck}
            value={statuses}
            options={STATUS_OPTIONS}
            placeholder="All Statuses"
            onToggle={(id) => setStatuses((prev) => toggleId(prev, id))}
            onClear={() => setStatuses([])}
            onSetValue={(ids) => setStatuses(ids)}
          />
        </div>
        <FilterSelect label="Data Audit" value={auditFilter} onChange={setAuditFilter} options={AUDIT_OPTIONS} icon={<SlidersHorizontal className="h-3.5 w-3.5" />} />

        <button
          onClick={() => setIsExportModalOpen(true)}
          disabled={isExporting}
          className="flex items-center gap-1.5 px-3 h-9 text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Download Excel
        </button>

        {(search || campusIds.length > 0 || departmentIds.length > 0 || categoryIds.length > 0 || (statuses.length > 0 && (statuses.length !== 1 || statuses[0] !== "ACTIVE")) || auditFilter) && (
          <button
            onClick={() => { setSearch(""); setCampusIds([]); setDepartmentIds([]); setCategoryIds([]); setStatuses(["ACTIVE"]); setAuditFilter(""); }}
            className="h-9 px-3 text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
                  <div className="h-3 bg-zinc-100 dark:bg-zinc-800/60 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900/30 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-12 text-center max-w-xl mx-auto">
          <Users className="h-12 w-12 text-zinc-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
            {employees.length === 0 ? "No Employee Profiles" : "No Matches Found"}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-6">
            {employees.length === 0
              ? "Get started by adding employee profiles. Each employee can be linked to a staff portal account."
              : "Try adjusting your search or filters."}
          </p>
          {employees.length === 0 && (
            <button
              onClick={() => router.push("/hr/employees/new")}
              className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/95 transition-all"
            >
              Create First Profile
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredEmployees.map(emp => (
            <EmployeeCard key={emp.id} employee={emp} onClick={() => setSelectedId(emp.id)} />
          ))}
        </div>
      )}

      <EmployeeDetailPanel
        employeeId={selectedId}
        onClose={() => setSelectedId(null)}
        onUpdated={fetchData}
        onDeleted={() => { setSuccess("Employee profile deleted successfully."); fetchData(); }}
      />

      <ExportColumnModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExportExcel}
        isExporting={isExporting}
      />
    </div>
  );
}

export default function EmployeesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-zinc-500 text-sm font-medium">Loading employee directory...</p>
        </div>
      }
    >
      <EmployeesContent />
    </Suspense>
  );
}
