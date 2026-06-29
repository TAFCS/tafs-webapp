import api from "@/lib/api";

export type LeaveRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface LeaveRequest {
  id: number;
  employee_id: number;
  leave_type_id: number;
  start_date: string;
  end_date: string;
  reason: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  status: LeaveRequestStatus;
  reviewed_by: string | null;
  review_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  leave_types: { id: number; code: string; name: string; is_paid: boolean };
  employee_profiles: {
    id: number;
    full_name: string | null;
    employee_code: string | null;
    campus_id: number | null;
    campuses?: { id: number; campus_name: string } | null;
  };
  reviewer?: { id: string; full_name: string | null } | null;
}

interface ApiEnvelope<T> {
  data: T;
}

export interface ListLeaveRequestsParams {
  campusId?: number;
  leaveTypeCode?: string;
  status?: LeaveRequestStatus;
  fromDate?: string;
  toDate?: string;
}

export const leavesService = {
  async list(params: ListLeaveRequestsParams = {}): Promise<LeaveRequest[]> {
    const { data } = await api.get<ApiEnvelope<LeaveRequest[]>>("/v1/hr/leaves", {
      params: {
        campusId: params.campusId,
        leaveTypeCode: params.leaveTypeCode,
        status: params.status,
        fromDate: params.fromDate,
        toDate: params.toDate,
      },
    });
    return data.data;
  },

  async getById(id: number): Promise<LeaveRequest> {
    const { data } = await api.get<ApiEnvelope<LeaveRequest>>(`/v1/hr/leaves/${id}`);
    return data.data;
  },

  async review(
    id: number,
    body: { status: "APPROVED" | "REJECTED"; reviewReason?: string },
  ): Promise<LeaveRequest> {
    const { data } = await api.patch<ApiEnvelope<LeaveRequest>>(`/v1/hr/leaves/${id}/review`, {
      status: body.status,
      reviewReason: body.reviewReason,
    });
    return data.data;
  },
};

export interface SaturdaySchedule {
  id: number;
  campus_id: number;
  date: string;
  marked_by: string;
  marked_at: string;
  campuses: { id: number; campus_name: string };
  users: { id: string; full_name: string | null };
}

export const saturdaySchedulesService = {
  async list(campusId: number, month: string): Promise<SaturdaySchedule[]> {
    const { data } = await api.get<ApiEnvelope<SaturdaySchedule[]>>("/v1/hr/saturday-schedules", {
      params: { campusId, month },
    });
    return data.data;
  },

  async create(campusId: number, date: string): Promise<SaturdaySchedule> {
    const { data } = await api.post<ApiEnvelope<SaturdaySchedule>>("/v1/hr/saturday-schedules", {
      campusId,
      date,
    });
    return data.data;
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/v1/hr/saturday-schedules/${id}`);
  },
};
