import api from './api';

export interface StaffType {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export type StaffCategory =
  | 'TEACHER'
  | 'ASSISTANT_TEACHER'
  | 'SPORTS_COACH'
  | 'SCOUT_LEADER'
  | 'ACADEMIC_COORDINATOR'
  | 'ACADEMIC_ADMINISTRATOR'
  | 'SENIOR_LEADERSHIP'
  | 'ADMINISTRATIVE_STAFF'
  | 'IT_STAFF'
  | 'CREATIVE_STAFF'
  | 'FINANCE_STAFF';

export const STAFF_CATEGORY_OPTIONS: { value: StaffCategory; label: string; description: string }[] = [
  { value: 'TEACHER', label: 'TEACHER', description: 'Subject teachers and class/home-room teachers' },
  { value: 'ASSISTANT_TEACHER', label: 'ASSISTANT TEACHER', description: 'Co-teachers and helper teachers' },
  { value: 'SPORTS_COACH', label: 'SPORTS COACH', description: 'Taekwondo, gymnastics, and specialized activity coaches' },
  { value: 'SCOUT_LEADER', label: 'SCOUT LEADER', description: 'Scout leaders' },
  { value: 'ACADEMIC_COORDINATOR', label: 'ACADEMIC COORDINATOR', description: 'Coordinators, subject heads, academic assistants, deputy segment heads' },
  { value: 'ACADEMIC_ADMINISTRATOR', label: 'ACADEMIC ADMINISTRATOR', description: 'Headmistress, principal, campus directress, sports manager, A-level manager' },
  { value: 'SENIOR_LEADERSHIP', label: 'SENIOR LEADERSHIP', description: 'CEO, MD, group directresses, deputy directress' },
  { value: 'ADMINISTRATIVE_STAFF', label: 'ADMINISTRATIVE STAFF', description: 'Office assistants, FDOs, admin assistants' },
  { value: 'IT_STAFF', label: 'IT STAFF', description: 'IT manager and computer operators' },
  { value: 'CREATIVE_STAFF', label: 'CREATIVE STAFF', description: 'Graphic designers' },
  { value: 'FINANCE_STAFF', label: 'FINANCE STAFF', description: 'Finance directress and accounts staff' },
];

export function formatStaffCategory(value: string | null | undefined): string | null {
  if (!value) return null;
  return STAFF_CATEGORY_OPTIONS.find((o) => o.value === value)?.label ?? value.replace(/_/g, ' ').toUpperCase();
}

/** Trim text; return null when empty so PATCH payloads can clear optional fields. */
export function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function optionalStaffCategory(value: string): StaffCategory | null {
  return value ? (value as StaffCategory) : null;
}

export interface EmployeeProfile {
  id: number;
  user_id: string | null;
  cnic: string | null;
  join_date: string | null;
  employment_type: string | null;
  department_id: number | null;
  designation_id: number | null;
  reporting_manager_id: number | null;
  // Extended fields
  employee_code: string | null;
  full_name: string | null;
  father_name: string | null;
  mother_name: string | null;
  date_of_birth: string | null;
  address: string | null;
  personal_phone: string | null;
  personal_email: string | null;
  job_title: string | null;
  staff_category: StaffCategory | null;
  job_description: string | null;
  notes: string | null;
  reporting_time: string | null;
  leaving_time: string | null;
  late_relaxation_minutes: number | null;
  monthly_pay: number | null;
  staff_type_id: number | null;
  campus_id: number | null;
  days_per_week: number | null;
  photo_url: string | null;
  account_number: string | null;
  bank_name: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  // Relations
  users?: {
    id: string;
    username?: string;
    full_name: string;
    role: string;
    email: string;
    is_active: boolean;
    campus_id?: number | null;
    allowed_class_ids?: number[];
  } | null;
  departments?: Department | null;
  designations?: Designation | null;
  staff_types?: StaffType | null;
  campuses?: { id: number; campus_name: string } | null;
  reporting_manager?: {
    id: number;
    full_name: string | null;
    users?: { full_name: string } | null;
  } | null;
  employee_class_section_assignments?: {
    id: number;
    class_id: number;
    section_id: number;
    classes?: { description: string; class_code: string };
    sections?: { description: string };
  }[];
}

export interface EmployeeCreatePayload {
  user_id?: string | null;
  cnic?: string | null;
  join_date?: string | null;
  employment_type?: string | null;
  department_id?: number;
  designation_id?: number;
  reporting_manager_id?: number;
  employee_code?: string | null;
  full_name?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  date_of_birth?: string | null;
  address?: string | null;
  personal_phone?: string | null;
  personal_email?: string | null;
  job_title?: string | null;
  staff_category?: StaffCategory | null;
  job_description?: string | null;
  notes?: string | null;
  reporting_time?: string | null;
  leaving_time?: string | null;
  late_relaxation_minutes?: number;
  monthly_pay?: number;
  staff_type_id?: number;
  campus_id?: number;
  days_per_week?: number;
  photo_url?: string | null;
  account_number?: string | null;
  bank_name?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relationship?: string | null;
  class_section_assignments?: { class_id: number; section_id: number }[];
}

export interface EmployeeAccountUpdatePayload {
  email?: string;
  role?: string;
  campus_id?: number | null;
  is_active?: boolean;
  allowed_class_ids?: number[];
}

export interface Department {
  id: number;
  name: string;
  description: string | null;
  designations?: Designation[];
}

export interface Designation {
  id: number;
  department_id: number;
  title: string;
  description: string | null;
}

export interface PolicyRule {
  id: number;
  policy_set_id: number;
  rule_type: string;
  value_json: any;
  applies_to: string | null;
  description: string | null;
}

export interface PolicySet {
  id: number;
  campus_id: number;
  academic_year: string;
  effective_from: string;
  description: string | null;
  hr_policy_rules?: PolicyRule[];
}

export interface CalendarDay {
  id: number;
  campus_id: number;
  date: string;
  day_type: string; // 'WORKDAY' | 'HOLIDAY' | 'WEEKEND'
  description: string | null;
  applies_to: string;
  class_id?: number | null;
  section_id?: number | null;
  department_id?: number | null;
  staff_category?: StaffCategory | null;
  employee_id?: number | null;
  classes?: { id: number; description: string; class_code: string } | null;
  sections?: { id: number; description: string } | null;
  departments?: { id: number; name: string } | null;
  employee?: { id: number; full_name: string | null; employee_code: string | null } | null;
}

export interface WorkScheduleDay {
  id?: number;
  day_of_week: number;
  is_working: boolean;
}

export interface EmployeeWorkSchedule {
  employee_id: number;
  days_per_week: number | null;
  has_custom_schedule: boolean;
  days: WorkScheduleDay[];
}

export interface HolidaySyncResult {
  students: number;
  staff: number;
  cleared_students: number;
  cleared_staff: number;
  skipped_manual: number;
}

export interface BulkCalendarCreateResult {
  campuses_total: number;
  created: number;
  skipped: number;
  failed: number;
  errors: { campus_id: number; message: string }[];
}

export interface ClassAttendanceMode {
  id: number;
  class_id: number;
  mode: string; // 'BIOMETRIC_DAILY' | 'ROLL_CALL_SESSION'
  classes?: {
    description: string;
    class_code: string;
  };
}

export type PayrollRunStatus = 'DRAFT' | 'FINALIZED';
export type DayClassification = 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT' | 'EXCUSED' | 'UNRESOLVED' | 'DAY_OFF';

export interface DayBreakdownEntry {
  date: string;
  is_working_day: boolean;
  day_type: string | null;
  day_description: string | null;
  classification: DayClassification;
  check_in_at: string | null;
  check_out_at: string | null;
  break_minutes: number;
  late_minutes: number;
  source: 'MANUAL' | 'BIOMETRIC' | 'SYSTEM' | null;
  segments?: { type: string; start: string; end: string; isMissingOut?: boolean }[];
}

export interface PayrollRunLine {
  id: number;
  payroll_run_id: number;
  employee_id: number;
  scheduled_working_days: number;
  present_days: number;
  late_days: number;
  half_days: number;
  absent_days: number;
  excused_days: number;
  unresolved_days: number;
  total_break_minutes: number;
  total_late_minutes: number;
  monthly_pay: number;
  daily_rate: number;
  per_minute_rate: number;
  absence_deduction: number;
  half_day_deduction: number;
  late_deduction: number;
  break_deduction: number;
  total_deductions: number;
  net_pay: number;
  daily_breakdown: DayBreakdownEntry[];
  disbursed_at?: string | null;
  disbursed_by?: string | null;
  disbursement_notes?: string | null;
  employee_profiles?: {
    id: number;
    full_name: string | null;
    employee_code: string | null;
    job_title: string | null;
    photo_url: string | null;
  };
}

export interface PayrollRun {
  id: number;
  campus_id: number;
  period_start: string;
  period_end: string;
  status: PayrollRunStatus;
  generated_by: string | null;
  generated_at: string;
  finalized_at: string | null;
  notes: string | null;
  campuses?: { id: number; campus_name: string };
  payroll_run_lines?: PayrollRunLine[];
  _count?: { payroll_run_lines: number };
  totals?: { net_pay: number | null; total_deductions: number | null; unresolved_days: number | null };
}

export interface GeneratePayrollRunPayload {
  campus_id: number;
  year: number;
  month: number;
  notes?: string;
}

interface ApiEnvelope<T> {
  data: T;
  status: number;
  message: string;
}

export const hrService = {
  // ── Employees API ──────────────────────────────────────────────────────────
  async listEmployees(): Promise<EmployeeProfile[]> {
    const { data } = await api.get<ApiEnvelope<EmployeeProfile[]>>('/v1/hr/employees');
    return data.data;
  },
  async getEmployee(id: number): Promise<EmployeeProfile> {
    const { data } = await api.get<ApiEnvelope<EmployeeProfile>>(`/v1/hr/employees/${id}`);
    return data.data;
  },
  async createEmployee(payload: EmployeeCreatePayload): Promise<EmployeeProfile> {
    const { data } = await api.post<ApiEnvelope<EmployeeProfile>>('/v1/hr/employees', payload);
    return data.data;
  },
  async updateEmployee(id: number, payload: Partial<EmployeeCreatePayload>): Promise<EmployeeProfile> {
    const { data } = await api.patch<ApiEnvelope<EmployeeProfile>>(`/v1/hr/employees/${id}`, payload);
    return data.data;
  },
  async updateEmployeeAccount(id: number, payload: EmployeeAccountUpdatePayload) {
    const { data } = await api.patch<ApiEnvelope<EmployeeProfile['users']>>(`/v1/hr/employees/${id}/account`, payload);
    return data.data;
  },
  async resetEmployeePassword(id: number, password: string): Promise<void> {
    await api.post(`/v1/hr/employees/${id}/account/reset-password`, { password });
  },
  async deleteEmployee(id: number): Promise<void> {
    await api.delete(`/v1/hr/employees/${id}`);
  },
  async getUnlinkedUsers(): Promise<any[]> {
    const { data } = await api.get<ApiEnvelope<any[]>>('/v1/hr/employees/unlinked-users');
    return data.data;
  },
  async getNextEmployeeCode(): Promise<{ code: string }> {
    const { data } = await api.get<ApiEnvelope<{ code: string }>>('/v1/hr/employees/next-code');
    return data.data;
  },

  // ── Staff Types API ────────────────────────────────────────────────────────
  async listStaffTypes(): Promise<StaffType[]> {
    const { data } = await api.get<ApiEnvelope<StaffType[]>>('/v1/hr/staff-types');
    return data.data;
  },
  async getStaffType(id: number): Promise<StaffType> {
    const { data } = await api.get<ApiEnvelope<StaffType>>(`/v1/hr/staff-types/${id}`);
    return data.data;
  },
  async createStaffType(payload: { code: string; name: string; description?: string; is_active?: boolean }): Promise<StaffType> {
    const { data } = await api.post<ApiEnvelope<StaffType>>('/v1/hr/staff-types', payload);
    return data.data;
  },
  async updateStaffType(id: number, payload: { code?: string; name?: string; description?: string; is_active?: boolean }): Promise<StaffType> {
    const { data } = await api.patch<ApiEnvelope<StaffType>>(`/v1/hr/staff-types/${id}`, payload);
    return data.data;
  },
  async deleteStaffType(id: number): Promise<void> {
    await api.delete(`/v1/hr/staff-types/${id}`);
  },

  // ── Departments API ────────────────────────────────────────────────────────
  async listDepartments(): Promise<Department[]> {
    const { data } = await api.get<ApiEnvelope<Department[]>>('/v1/hr/departments');
    return data.data;
  },
  async createDepartment(payload: { name: string; description?: string }): Promise<Department> {
    const { data } = await api.post<ApiEnvelope<Department>>('/v1/hr/departments', payload);
    return data.data;
  },
  async updateDepartment(id: number, payload: { name?: string; description?: string }): Promise<Department> {
    const { data } = await api.patch<ApiEnvelope<Department>>(`/v1/hr/departments/${id}`, payload);
    return data.data;
  },
  async deleteDepartment(id: number): Promise<void> {
    await api.delete(`/v1/hr/departments/${id}`);
  },

  // ── Designations API ───────────────────────────────────────────────────────
  async createDesignation(deptId: number, payload: { title: string; description?: string }): Promise<Designation> {
    const { data } = await api.post<ApiEnvelope<Designation>>(`/v1/hr/departments/${deptId}/designations`, payload);
    return data.data;
  },
  async updateDesignation(deptId: number, id: number, payload: { title?: string; description?: string }): Promise<Designation> {
    const { data } = await api.patch<ApiEnvelope<Designation>>(`/v1/hr/departments/${deptId}/designations/${id}`, payload);
    return data.data;
  },
  async deleteDesignation(deptId: number, id: number): Promise<void> {
    await api.delete(`/v1/hr/departments/${deptId}/designations/${id}`);
  },

  // ── Policies API ───────────────────────────────────────────────────────────
  async listPolicies(campusId: number): Promise<PolicySet[]> {
    const { data } = await api.get<ApiEnvelope<PolicySet[]>>(`/v1/hr/policies?campusId=${campusId}`);
    return data.data;
  },
  async createPolicySet(payload: { campus_id: number; academic_year: string; effective_from: string; description?: string }): Promise<PolicySet> {
    const { data } = await api.post<ApiEnvelope<PolicySet>>('/v1/hr/policies', payload);
    return data.data;
  },
  async updatePolicySet(id: number, payload: Partial<PolicySet>): Promise<PolicySet> {
    const { data } = await api.patch<ApiEnvelope<PolicySet>>(`/v1/hr/policies/${id}`, payload);
    return data.data;
  },
  async deletePolicySet(id: number): Promise<void> {
    await api.delete(`/v1/hr/policies/${id}`);
  },
  async createPolicyRule(setId: number, payload: { rule_type: string; value_json: any; applies_to?: string; description?: string }): Promise<PolicyRule> {
    const { data } = await api.post<ApiEnvelope<PolicyRule>>(`/v1/hr/policies/${setId}/rules`, payload);
    return data.data;
  },
  async updatePolicyRule(setId: number, id: number, payload: Partial<PolicyRule>): Promise<PolicyRule> {
    const { data } = await api.patch<ApiEnvelope<PolicyRule>>(`/v1/hr/policies/${setId}/rules/${id}`, payload);
    return data.data;
  },
  async deletePolicyRule(setId: number, id: number): Promise<void> {
    await api.delete(`/v1/hr/policies/${setId}/rules/${id}`);
  },

  async listCalendarDays(campusId: number, appliesTo?: string): Promise<CalendarDay[]> {
    const query = appliesTo ? `&appliesTo=${appliesTo}` : '';
    const { data } = await api.get<ApiEnvelope<CalendarDay[]>>(`/v1/hr/calendar?campusId=${campusId}${query}`);
    return data.data;
  },
  async createCalendarDay(payload: {
    campus_id: number;
    date: string;
    day_type: string;
    description?: string;
    applies_to: string;
    class_id?: number;
    section_id?: number;
    department_id?: number;
    staff_category?: StaffCategory;
    employee_id?: number;
  }): Promise<CalendarDay> {
    const { data } = await api.post<ApiEnvelope<CalendarDay>>('/v1/hr/calendar', payload);
    return data.data;
  },
  async createBulkCalendarDays(payload: {
    date: string;
    day_type: string;
    description?: string;
    applies_to: string;
  }): Promise<BulkCalendarCreateResult> {
    const { data } = await api.post<ApiEnvelope<BulkCalendarCreateResult>>('/v1/hr/calendar/bulk', payload);
    return data.data;
  },
  async updateCalendarDay(id: number, payload: Partial<CalendarDay>): Promise<CalendarDay> {
    const { data } = await api.patch<ApiEnvelope<CalendarDay>>(`/v1/hr/calendar/${id}`, payload);
    return data.data;
  },
  async deleteCalendarDay(id: number): Promise<void> {
    await api.delete(`/v1/hr/calendar/${id}`);
  },

  async syncCalendarAttendance(
    campusId: number | null,
    date: string,
    options?: { force?: boolean; allCampuses?: boolean },
  ): Promise<HolidaySyncResult> {
    const { data } = await api.post<ApiEnvelope<HolidaySyncResult>>('/v1/hr/calendar/sync-attendance', {
      ...(options?.allCampuses ? { all_campuses: true } : { campus_id: campusId }),
      date,
      ...(options?.force ? { force: true } : {}),
    });
    return data.data;
  },

  async getEmployeeWorkSchedule(employeeId: number): Promise<EmployeeWorkSchedule> {
    const { data } = await api.get<ApiEnvelope<EmployeeWorkSchedule>>(`/v1/hr/employees/${employeeId}/work-schedule`);
    return data.data;
  },
  async updateEmployeeWorkSchedule(employeeId: number, days: WorkScheduleDay[]): Promise<EmployeeWorkSchedule> {
    const { data } = await api.patch<ApiEnvelope<EmployeeWorkSchedule>>(`/v1/hr/employees/${employeeId}/work-schedule`, { days });
    return data.data;
  },
  async clearEmployeeWorkSchedule(employeeId: number): Promise<EmployeeWorkSchedule> {
    const { data } = await api.delete<ApiEnvelope<EmployeeWorkSchedule>>(`/v1/hr/employees/${employeeId}/work-schedule`);
    return data.data;
  },

  // ── Class Attendance Modes API ─────────────────────────────────────────────
  async listClassAttendanceModes(): Promise<ClassAttendanceMode[]> {
    const { data } = await api.get<ApiEnvelope<ClassAttendanceMode[]>>('/v1/hr/class-attendance-modes');
    return data.data;
  },
  async setClassAttendanceMode(payload: { class_id: number; mode: string }): Promise<ClassAttendanceMode> {
    const { data } = await api.post<ApiEnvelope<ClassAttendanceMode>>('/v1/hr/class-attendance-modes', payload);
    return data.data;
  },

  // ── Payroll API ────────────────────────────────────────────────────────────
  async listPayrollRuns(campusId?: number): Promise<PayrollRun[]> {
    const { data } = await api.get<ApiEnvelope<PayrollRun[]>>('/v1/hr/payroll/runs', {
      params: campusId ? { campus_id: campusId } : undefined,
    });
    return data.data;
  },
  async generatePayrollRun(payload: GeneratePayrollRunPayload): Promise<PayrollRun> {
    const { data } = await api.post<ApiEnvelope<PayrollRun>>('/v1/hr/payroll/runs', payload);
    return data.data;
  },
  async getPayrollRun(id: number): Promise<PayrollRun> {
    const { data } = await api.get<ApiEnvelope<PayrollRun>>(`/v1/hr/payroll/runs/${id}`);
    return data.data;
  },
  async finalizePayrollRun(id: number): Promise<PayrollRun> {
    const { data } = await api.post<ApiEnvelope<PayrollRun>>(`/v1/hr/payroll/runs/${id}/finalize`);
    return data.data;
  },
  async deletePayrollRun(id: number): Promise<void> {
    await api.delete(`/v1/hr/payroll/runs/${id}`);
  },
  async disbursePayrollLine(
    runId: number,
    employeeId: number,
    payload?: { disbursed_at?: string; notes?: string },
  ): Promise<PayrollRunLine> {
    const { data } = await api.post<ApiEnvelope<PayrollRunLine>>(
      `/v1/hr/payroll/runs/${runId}/lines/${employeeId}/disburse`,
      payload ?? {},
    );
    return data.data;
  },
  async disbursePayrollRunAll(
    runId: number,
    payload?: { disbursed_at?: string; notes?: string },
  ): Promise<PayrollRun> {
    const { data } = await api.post<ApiEnvelope<PayrollRun>>(
      `/v1/hr/payroll/runs/${runId}/disburse-all`,
      payload ?? {},
    );
    return data.data;
  },
};
