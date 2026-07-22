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

  async revoke(id: number, reviewReason: string): Promise<LeaveRequest> {
    const { data } = await api.patch<ApiEnvelope<LeaveRequest>>(`/v1/hr/leaves/${id}/revoke`, {
      reviewReason,
    });
    return data.data;
  },
};

export interface SaturdaySchedule {
  id: number;
  employee_id: number;
  date: string;
  marked_by: string;
  marked_at: string;
  employee_profiles: {
    id: number;
    full_name: string | null;
    campus_id: number | null;
    employee_class_section_assignments?: {
      section_id: number;
      class_id: number;
      sections?: { description: string };
      classes?: { description: string; class_code: string };
    }[];
  };
  users: { id: string; full_name: string | null };
}

export interface ListSaturdaySchedulesParams {
  month: string;
  campusId?: number;
  sectionId?: number;
  employeeId?: number;
}

export const saturdaySchedulesService = {
  async list(params: ListSaturdaySchedulesParams): Promise<SaturdaySchedule[]> {
    const { data } = await api.get<ApiEnvelope<SaturdaySchedule[]>>("/v1/hr/saturday-schedules", {
      params,
    });
    return data.data;
  },

  async create(employeeIds: number[], date: string): Promise<SaturdaySchedule[]> {
    const { data } = await api.post<ApiEnvelope<SaturdaySchedule[]>>("/v1/hr/saturday-schedules", {
      employeeIds,
      date,
    });
    return data.data;
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/v1/hr/saturday-schedules/${id}`);
  },
};

export interface ShiftOverride {
  id: number;
  employee_id: number;
  date: string;
  override_start_time: string | null;
  override_end_time: string | null;
  reason: string | null;
  created_by: string;
  created_at: string;
  employee_profiles: {
    id: number;
    full_name: string | null;
    campus_id: number | null;
  };
}

export interface ListShiftOverridesParams {
  employee_id?: number;
  date_from?: string;
  date_to?: string;
}

export interface CreateShiftOverridesParams {
  employee_id: number;
  dates: string[];
  override_start_time?: string;
  override_end_time?: string;
  reason?: string;
}

export const shiftOverridesService = {
  async list(params: ListShiftOverridesParams): Promise<ShiftOverride[]> {
    const { data } = await api.get<ApiEnvelope<ShiftOverride[]>>("/v1/hr/shift-overrides", {
      params,
    });
    return data.data;
  },

  async bulkCreate(params: CreateShiftOverridesParams): Promise<ShiftOverride[]> {
    const { data } = await api.post<ApiEnvelope<ShiftOverride[]>>("/v1/hr/shift-overrides", params);
    return data.data;
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/v1/hr/shift-overrides/${id}`);
  },
};
