import api from './api';

export type AttendanceObjectionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface AttendanceObjection {
  id: number;
  employee_id: number;
  attendance_date: string;
  scan_id: number | null;
  /** The objected punch's time when raised — accepting rewrites the scan itself. Null for older or whole-day objections. */
  original_scan_time?: string | null;
  claimed_time: string;
  /** TAFSD-490: a whole-day objection's claimed clock-out. */
  claimed_check_out_time?: string | null;
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
  reviewer?: { id: string; full_name: string; username?: string; role?: string } | null;
  /** That day's punches for the employee, oldest first. */
  day_scans?: {
    id: number;
    scan_time: string;
    direction: string | null;
    work_code: string | null;
  }[];
}

interface ApiEnvelope<T> {
  data: T;
}

export const attendanceObjectionsService = {
  async list(params?: { status?: string; campus_id?: string }): Promise<AttendanceObjection[]> {
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
  async countPending(): Promise<number> {
    try {
      const { data } = await api.get<ApiEnvelope<{ count: number }>>('/v1/attendance/objections/pending-count');
      return data.data?.count ?? 0;
    } catch {
      return 0;
    }
  },
};
