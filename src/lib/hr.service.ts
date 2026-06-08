import api from './api';

export interface StaffType {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
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
  // Relations
  users?: {
    id: string;
    full_name: string;
    role: string;
    email: string;
    is_active: boolean;
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
  user_id?: string;
  cnic?: string;
  join_date?: string;
  employment_type?: string;
  department_id?: number;
  designation_id?: number;
  reporting_manager_id?: number;
  employee_code?: string;
  full_name?: string;
  father_name?: string;
  mother_name?: string;
  date_of_birth?: string;
  address?: string;
  personal_phone?: string;
  personal_email?: string;
  job_title?: string;
  job_description?: string;
  notes?: string;
  reporting_time?: string;
  leaving_time?: string;
  late_relaxation_minutes?: number;
  monthly_pay?: number;
  staff_type_id?: number;
  campus_id?: number;
  days_per_week?: number;
  class_section_assignments?: { class_id: number; section_id: number }[];
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

  // ── Calendar API ───────────────────────────────────────────────────────────
  async listCalendarDays(campusId: number): Promise<CalendarDay[]> {
    const { data } = await api.get<ApiEnvelope<CalendarDay[]>>(`/v1/hr/calendar?campusId=${campusId}`);
    return data.data;
  },
  async createCalendarDay(payload: { campus_id: number; date: string; day_type: string; description?: string }): Promise<CalendarDay> {
    const { data } = await api.post<ApiEnvelope<CalendarDay>>('/v1/hr/calendar', payload);
    return data.data;
  },
  async updateCalendarDay(id: number, payload: Partial<CalendarDay>): Promise<CalendarDay> {
    const { data } = await api.patch<ApiEnvelope<CalendarDay>>(`/v1/hr/calendar/${id}`, payload);
    return data.data;
  },
  async deleteCalendarDay(id: number): Promise<void> {
    await api.delete(`/v1/hr/calendar/${id}`);
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
};
