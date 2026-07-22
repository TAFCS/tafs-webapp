import api from './api';

function downloadBlob(data: BlobPart, filename: string): void {
  const url = window.URL.createObjectURL(new Blob([data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export interface StaffType {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export type CheckInSource = 'FIXED' | 'TIMETABLE';

export const CHECK_IN_SOURCE_OPTIONS: { value: CheckInSource; label: string; description: string }[] = [
  { value: 'FIXED', label: 'Fixed times', description: 'Use reporting/leaving times on this profile' },
  { value: 'TIMETABLE', label: 'Derived from timetable', description: 'Earliest/latest teaching block that weekday' },
];

/** Stable codes used by timetable/Saturday logic (seeded categories). */
export const TEACHER_CATEGORY_CODES = new Set(['TEACHER', 'ASSISTANT_TEACHER']);

export interface StaffCategory {
  id: number;
  department_id: number;
  code: string;
  name: string;
  description: string | null;
  employee_code_dep?: string | null;
  _count?: { employee_profiles: number };
}

/** Trim text; return null when empty so PATCH payloads can clear optional fields. */
export function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function optionalId(value: string): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatStaffCategory(
  category: Pick<StaffCategory, 'name'> | string | null | undefined,
): string | null {
  if (!category) return null;
  if (typeof category === 'string') return category.replace(/_/g, ' ').toUpperCase();
  return category.name;
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
  employee_code_dep: string | null;
  employee_code_number: string | null;
  full_name: string | null;
  father_name: string | null;
  mother_name: string | null;
  date_of_birth: string | null;
  address: string | null;
  personal_phone: string | null;
  personal_email: string | null;
  job_title: string | null;
  staff_category_id: number | null;
  job_description: string | null;
  notes: string | null;
  reporting_time: string | null;
  leaving_time: string | null;
  check_in_source: CheckInSource;
  late_relaxation_minutes: number | null;
  monthly_pay: number | null;
  staff_type_id: number | null;
  campus_id: number | null;
  days_per_week: number | null;
  photo_url: string | null;
  father_photo_url?: string | null;
  father_cnic?: string | null;
  mother_photo_url?: string | null;
  mother_cnic?: string | null;
  spouse_name?: string | null;
  spouse_cnic?: string | null;
  spouse_photo_url?: string | null;
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
  staff_categories?: StaffCategory | null;
  staff_types?: StaffType | null;
  campuses?: { id: number; campus_name: string } | null;
  reporting_manager?: {
    id: number;
    full_name: string | null;
    employee_code?: string | null;
    users?: { full_name: string } | null;
  } | null;
  employee_class_section_assignments?: {
    id: number;
    class_id: number;
    section_id: number;
    classes?: {
      description: string;
      class_code: string;
      segment_id: number | null;
      segments?: { id: number; code: string; name: string; display_order: number } | null;
    };
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
  employee_code_dep?: string | null;
  employee_code_number?: string | null;
  full_name?: string | null;
  father_name?: string | null;
  mother_name?: string | null;
  date_of_birth?: string | null;
  address?: string | null;
  personal_phone?: string | null;
  personal_email?: string | null;
  job_title?: string | null;
  staff_category_id?: number | null;
  job_description?: string | null;
  notes?: string | null;
  reporting_time?: string | null;
  leaving_time?: string | null;
  check_in_source?: CheckInSource;
  late_relaxation_minutes?: number;
  monthly_pay?: number;
  staff_type_id?: number;
  campus_id?: number;
  days_per_week?: number;
  photo_url?: string | null;
  father_photo_url?: string | null;
  father_cnic?: string | null;
  mother_photo_url?: string | null;
  mother_cnic?: string | null;
  spouse_name?: string | null;
  spouse_cnic?: string | null;
  spouse_photo_url?: string | null;
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
  staff_categories?: StaffCategory[];
  _count?: { employee_profiles: number };
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
  staff_category_id?: number | null;
  employee_id?: number | null;
  classes?: { id: number; description: string; class_code: string } | null;
  sections?: { id: number; description: string } | null;
  departments?: { id: number; name: string } | null;
  staff_categories?: StaffCategory | null;
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
export type DayClassification = 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT' | 'EXCUSED' | 'SICK_LEAVE' | 'CASUAL_LEAVE' | 'ANNUAL_LEAVE' | 'UNPAID_LEAVE' | 'UNRESOLVED' | 'DAY_OFF';

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
  source: 'MANUAL' | 'BIOMETRIC' | 'SYSTEM' | 'LEAVE' | null;
  segments?: { type: string; start: string; end: string; isMissingOut?: boolean }[];
}

/**
 * Fields shared by a full payroll-run employee line and the lighter,
 * payroll-run-independent attendance matrix line (see getAttendanceMatrix
 * below). PayrollLineDetailModal and PayrollMatrixView are built against
 * this base so both contexts can reuse them without pulling in $ figures.
 */
export interface AttendanceLineBase {
  employee_id: number;
  /** Only present on attendance-matrix lines, which can span multiple campuses. */
  campus_id?: number;
  campus_name?: string;
  /** No monthly_pay set — payroll doesn't apply to them, but still worth flagging. */
  has_salary: boolean;
  /** No active device_user_mappings row — can never record biometric attendance. */
  is_mapped: boolean;
  /** Mapped to a device, but zero scans in the period. */
  has_punches: boolean;
  present_days: number;
  late_days: number;
  half_days: number;
  absent_days: number;
  excused_days: number;
  unpaid_leave_days?: number;
  unresolved_days: number;
  total_break_minutes: number;
  total_late_minutes: number;
  daily_breakdown: DayBreakdownEntry[];
  employee_profiles?: {
    id: number;
    full_name: string | null;
    employee_code: string | null;
    job_title: string | null;
    photo_url: string | null;
  };
}

export interface PayrollRunLine extends AttendanceLineBase {
  id: number;
  payroll_run_id: number;
  scheduled_working_days: number;
  total_calendar_days: number;
  monthly_pay: number;
  daily_rate: number;
  per_minute_rate: number;
  absence_deduction: number;
  half_day_deduction: number;
  late_deduction: number;
  break_deduction: number;
  total_deductions: number;
  net_pay: number;
  disbursed_at?: string | null;
  disbursed_by?: string | null;
  disbursement_notes?: string | null;
}

export interface AttendanceMatrix {
  /** null when spanning every campus the caller can see (no campus_id filter applied). */
  campus_id: number | null;
  period_start: string;
  period_end: string;
  lines: AttendanceLineBase[];
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
  async getNextEmployeeCode(dep?: string): Promise<{ dep: string | null; number: string; code: string }> {
    const { data } = await api.get<ApiEnvelope<{ dep: string | null; number: string; code: string }>>(
      '/v1/hr/employees/next-code',
      { params: dep ? { dep } : undefined },
    );
    return data.data;
  },
  async searchSimple(q: string): Promise<{ id: number; full_name: string | null; employee_code: string | null }[]> {
    const { data } = await api.get<ApiEnvelope<{ id: number; full_name: string | null; employee_code: string | null }[]>>(
      '/v1/hr/employees/search-simple',
      { params: { q } },
    );
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

  // ── Staff Categories (subcategories) API ───────────────────────────────────
  async createStaffCategory(
    deptId: number,
    payload: { code: string; name: string; description?: string },
  ): Promise<StaffCategory> {
    const { data } = await api.post<ApiEnvelope<StaffCategory>>(
      `/v1/hr/departments/${deptId}/staff-categories`,
      payload,
    );
    return data.data;
  },
  async updateStaffCategory(
    deptId: number,
    id: number,
    payload: { code?: string; name?: string; description?: string },
  ): Promise<StaffCategory> {
    const { data } = await api.patch<ApiEnvelope<StaffCategory>>(
      `/v1/hr/departments/${deptId}/staff-categories/${id}`,
      payload,
    );
    return data.data;
  },
  async deleteStaffCategory(deptId: number, id: number): Promise<void> {
    await api.delete(`/v1/hr/departments/${deptId}/staff-categories/${id}`);
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
    staff_category_id?: number;
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
  async getAttendanceMatrix(params: { campus_id?: number; period_start: string; period_end: string }): Promise<AttendanceMatrix> {
    const { data } = await api.get<ApiEnvelope<AttendanceMatrix>>('/v1/hr/payroll/attendance-matrix', { params });
    return data.data;
  },
  async exportAttendanceMatrix(params: { campus_id?: number; period_start: string; period_end: string }): Promise<void> {
    const { data } = await api.get('/v1/hr/payroll/attendance-matrix/export', { params, responseType: 'blob' });
    downloadBlob(data, `attendance-${params.period_start}-to-${params.period_end}.xlsx`);
  },
  async exportPayrollRun(id: number): Promise<void> {
    const { data } = await api.get(`/v1/hr/payroll/runs/${id}/export`, { responseType: 'blob' });
    downloadBlob(data, `payroll-run-${id}.xlsx`);
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
  async uploadEmployeePhotoSlot(
    employeeId: number,
    file: File,
    slot: 'profile' | 'father' | 'mother' | 'spouse' = 'profile',
  ): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post<ApiEnvelope<{ url: string }>>(
      `/v1/media/employee/${employeeId}/photo?slot=${slot}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data.data;
  },
};
