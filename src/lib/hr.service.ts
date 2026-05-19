import api from './api';

export interface EmployeeProfile {
  id: number;
  user_id: string | null;
  cnic: string | null;
  join_date: string | null;
  employment_type: string | null;
  department_id: number | null;
  designation_id: number | null;
  reporting_manager_id: number | null;
  users?: {
    id: string;
    full_name: string;
    role: string;
    email: string;
    is_active: boolean;
  } | null;
  departments?: Department | null;
  designations?: Designation | null;
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
  // Employees API
  async listEmployees(): Promise<EmployeeProfile[]> {
    const { data } = await api.get<ApiEnvelope<EmployeeProfile[]>>('/v1/hr/employees');
    return data.data;
  },
  async getEmployee(id: number): Promise<EmployeeProfile> {
    const { data } = await api.get<ApiEnvelope<EmployeeProfile>>(`/v1/hr/employees/${id}`);
    return data.data;
  },
  async createEmployee(payload: Partial<EmployeeProfile>): Promise<EmployeeProfile> {
    const { data } = await api.post<ApiEnvelope<EmployeeProfile>>('/v1/hr/employees', payload);
    return data.data;
  },
  async updateEmployee(id: number, payload: Partial<EmployeeProfile>): Promise<EmployeeProfile> {
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

  // Departments API
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

  // Designations API
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

  // Policies API
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

  // Calendar API
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

  // Class Attendance Modes API
  async listClassAttendanceModes(): Promise<ClassAttendanceMode[]> {
    const { data } = await api.get<ApiEnvelope<ClassAttendanceMode[]>>('/v1/hr/class-attendance-modes');
    return data.data;
  },
  async setClassAttendanceMode(payload: { class_id: number; mode: string }): Promise<ClassAttendanceMode> {
    const { data } = await api.post<ApiEnvelope<ClassAttendanceMode>>('/v1/hr/class-attendance-modes', payload);
    return data.data;
  },
};
