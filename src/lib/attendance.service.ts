import api from './api';

export type RollSessionStatus = 'DRAFT' | 'SUBMITTED' | 'SKIPPED';
export type RollRecordStatus = 'PRESENT' | 'ABSENT';
export type StaffAttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'EXCUSED';

export interface StaffAttendanceRecord {
  id: number;
  employee_id: number;
  campus_id: number;
  date: string;
  status: StaffAttendanceStatus;
  notes: string | null;
  marked_by: string | null;
}

export interface StaffRegisterRow {
  employee: {
    id: number;
    user_id: string | null;
    employment_type: string | null;
    users: { id: string; full_name: string; role: string; email: string } | null;
    departments: { id: number; name: string } | null;
    designations: { id: number; title: string } | null;
  };
  record: StaffAttendanceRecord | null;
}

export interface RollRecord {
  id: number;
  session_id: number;
  student_cc: number;
  status: RollRecordStatus;
  notes: string | null;
  students?: {
    cc: number;
    full_name: string;
    gr_number: string | null;
  };
}

export interface RollSessionRosterEntry {
  student: {
    cc: number;
    full_name: string;
    gr_number: string | null;
    class_id: number | null;
    section_id: number | null;
  };
  record: RollRecord | null;
}

export interface RollSession {
  id: number;
  campus_id: number;
  class_id: number;
  section_id: number;
  session_date: string;
  period: number;
  status: RollSessionStatus;
  skip_reason: string | null;
  created_at: string;
  submitted_at: string | null;
  classes?: { id: number; description: string; class_code: string; academic_system: string };
  sections?: { id: number; description: string };
  campuses?: { id: number; campus_name: string; campus_code: string };
  records?: RollRecord[];
  roster?: RollSessionRosterEntry[];
}

interface ApiEnvelope<T> {
  data: T;
  status: number;
  message: string;
}

export const attendanceService = {
  async listRollSessions(params: {
    date: string;
    campus_id?: number;
    class_id?: number;
    section_id?: number;
    period?: number;
  }): Promise<RollSession[]> {
    const { data } = await api.get<ApiEnvelope<RollSession[]>>('/v1/attendance/roll-sessions', {
      params,
    });
    return data.data;
  },

  async getRollSession(id: number): Promise<RollSession> {
    const { data } = await api.get<ApiEnvelope<RollSession>>(`/v1/attendance/roll-sessions/${id}`);
    return data.data;
  },

  async createRollSession(payload: {
    session_date: string;
    campus_id: number;
    class_id: number;
    section_id: number;
    period?: number;
  }): Promise<RollSession> {
    const { data } = await api.post<ApiEnvelope<RollSession>>(
      '/v1/attendance/roll-sessions',
      payload,
    );
    return data.data;
  },

  async updateRollSession(
    id: number,
    payload: {
      records?: { student_cc: number; status: RollRecordStatus; notes?: string }[];
      submit?: boolean;
    },
  ): Promise<RollSession> {
    const { data } = await api.put<ApiEnvelope<RollSession>>(
      `/v1/attendance/roll-sessions/${id}`,
      payload,
    );
    return data.data;
  },

  async skipRollSession(id: number, reason: string): Promise<RollSession> {
    const { data } = await api.post<ApiEnvelope<RollSession>>(
      `/v1/attendance/roll-sessions/${id}/skip`,
      { reason },
    );
    return data.data;
  },

  // ── Staff Daily Register ─────────────────────────────────────────────────

  async getStaffRegister(params: {
    date: string;
    campus_id?: number;
    department_id?: number;
  }): Promise<StaffRegisterRow[]> {
    const { data } = await api.get<ApiEnvelope<StaffRegisterRow[]>>(
      '/v1/attendance/staff',
      { params },
    );
    return data.data;
  },

  async bulkMarkStaff(payload: {
    date: string;
    campus_id: number;
    records: { employee_id: number; status: StaffAttendanceStatus; notes?: string }[];
  }): Promise<StaffRegisterRow[]> {
    const { data } = await api.put<ApiEnvelope<StaffRegisterRow[]>>(
      '/v1/attendance/staff',
      payload,
    );
    return data.data;
  },
};
