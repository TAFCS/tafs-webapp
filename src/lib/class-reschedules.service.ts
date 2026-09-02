import api from './api';
import type { RollSession } from './attendance.service';

export type ClassRescheduleStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

export type SourceDateHoldStatus =
  | 'held'
  | 'missed'
  | 'off_day'
  | 'skipped'
  | 'upcoming';

export interface SourceDatePresentStudent {
  cc: number;
  full_name: string;
  gr_number: string | null;
}

export interface SourceDatePresentBySlot {
  slot_id: number;
  period: number;
  students: SourceDatePresentStudent[];
}

export interface SourceDateHoldStatusRow {
  date: string;
  hold_status: SourceDateHoldStatus;
  held: boolean;
  present_by_slot?: SourceDatePresentBySlot[];
  by_slot?: Array<{
    slot_id: number;
    hold_status: SourceDateHoldStatus;
    held: boolean;
  }>;
}

export interface EligibleSourceSlot {
  id: number;
  day_of_week: number;
  day_label: string;
  block_number: number;
  subject: { id: number; name: string; code: string | null };
  default_source_date: string;
  missed_dates: string[];
  time_label: string;
  start_time: string | null;
  end_time: string | null;
}

export interface ClassReschedule {
  id: number;
  teaching_group_id: number;
  source_timetable_slot_id: number;
  source_date: string;
  makeup_date: string;
  makeup_period: number;
  makeup_timetable_slot_id: number | null;
  makeup_roll_session_id: number | null;
  source_roll_session_id: number | null;
  status: ClassRescheduleStatus;
  notes: string | null;
  source_day_label?: string;
  teaching_groups?: {
    id: number;
    label: string | null;
    class_id: number;
    campus_id: number;
    subjects: { id: number; name: string; code: string | null };
    employee_profiles: { id: number; full_name: string | null };
  };
  source_timetable_slot?: { id: number; day_of_week: number; block_number: number };
  makeup_roll_session?: { id: number; status: string; session_date: string; period?: number };
  source_roll_session?: { id: number; status: string; session_date: string; period?: number };
  users?: { id: string; full_name: string | null };
}

export interface RescheduleCompletion {
  sourceCount: number;
  excusedStudentCount: number;
  absentStudentCount: number;
  staffExcusedDays: number;
  staffExcuseWarnings: string[];
}

interface ApiEnvelope<T> {
  data: T;
  status: number;
  message: string;
}

export const classReschedulesService = {
  async getEligibleSlots(params: {
    teaching_group_id: number;
    makeup_date: string;
  }): Promise<{ slots: EligibleSourceSlot[]; timetable_effective_from: string | null }> {
    const { data } = await api.get<
      ApiEnvelope<{ slots: EligibleSourceSlot[]; timetable_effective_from: string | null }>
    >(
      '/v1/attendance/class-reschedules/eligible-slots',
      { params },
    );
    return data.data;
  },

  async getSourceDateHoldStatus(params: {
    teaching_group_id: number;
    source_timetable_slot_ids: string;
    dates: string;
  }): Promise<{ dates: SourceDateHoldStatusRow[] }> {
    const { data } = await api.get<
      ApiEnvelope<{ dates: SourceDateHoldStatusRow[] }>
    >('/v1/attendance/class-reschedules/source-date-hold-status', { params });
    return data.data;
  },

  async list(params?: {
    teaching_group_id?: number;
    campus_id?: number;
    from?: string;
    to?: string;
    status?: ClassRescheduleStatus;
  }): Promise<ClassReschedule[]> {
    const { data } = await api.get<ApiEnvelope<ClassReschedule[]>>(
      '/v1/attendance/class-reschedules',
      { params },
    );
    return data.data;
  },

  async create(payload: {
    campus_id: number;
    class_id: number;
    teaching_group_id: number;
    sources: Array<{ source_timetable_slot_id: number; source_date: string }>;
    makeup_date: string;
    makeup_period: number;
    makeup_timetable_slot_id?: number;
    notes?: string;
  }): Promise<{ reschedules: ClassReschedule[]; makeup_session: RollSession }> {
    const { data } = await api.post<
      ApiEnvelope<{ reschedules: ClassReschedule[]; makeup_session: RollSession }>
    >('/v1/attendance/class-reschedules', payload);
    return data.data;
  },

  async cancel(id: number): Promise<ClassReschedule> {
    const { data } = await api.post<ApiEnvelope<ClassReschedule>>(
      `/v1/attendance/class-reschedules/${id}/cancel`,
    );
    return data.data;
  },

  async updateMakeupDate(id: number, makeup_date: string): Promise<ClassReschedule> {
    const { data } = await api.post<ApiEnvelope<ClassReschedule>>(
      `/v1/attendance/class-reschedules/${id}/update-makeup`,
      { makeup_date },
    );
    return data.data;
  },

  async reverse(id: number): Promise<ClassReschedule> {
    const { data } = await api.post<ApiEnvelope<ClassReschedule>>(
      `/v1/attendance/class-reschedules/${id}/reverse`,
    );
    return data.data;
  },
};
