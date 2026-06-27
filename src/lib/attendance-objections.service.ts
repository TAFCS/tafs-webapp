import api from './api';

export type AttendanceObjectionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface AttendanceObjection {
  id: number;
  employee_id: number;
  attendance_date: string;
  scan_id: number | null;
  claimed_time: string;
  reason: string;
  status: AttendanceObjectionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  created_at: string;
  employee?: {
    id: number;
    full_name: string | null;
    employee_code: string | null;
    campus_id: number | null;
  };
  scan?: {
    id: number;
    scan_time: string;
    direction: string | null;
  } | null;
  reviewer?: { id: string; full_name: string } | null;
}

interface ApiEnvelope<T> {
  data: T;
}

export const attendanceObjectionsService = {
  async list(params?: { status?: AttendanceObjectionStatus; campus_id?: number }): Promise<AttendanceObjection[]> {
    const { data } = await api.get<ApiEnvelope<AttendanceObjection[]>>('/v1/attendance/objections', { params });
    return data.data;
  },
  async review(
    id: number,
    payload: { status: 'ACCEPTED' | 'REJECTED'; admin_notes?: string },
  ): Promise<AttendanceObjection> {
    const { data } = await api.patch<ApiEnvelope<AttendanceObjection>>(
      `/v1/attendance/objections/${id}`,
      payload,
    );
    return data.data;
  },
};
