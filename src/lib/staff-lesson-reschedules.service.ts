import api from './api';

export type StaffLessonRescheduleStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export interface StaffLessonTeacher {
  employee_id: number;
  full_name: string | null;
  employee_code: string | null;
  campus_id: number;
  slot_count: number;
  classes: Array<{
    class_code: string;
    section_code: string;
    subject_name: string;
    day_label: string;
    time_label: string;
  }>;
}

export interface StaffLessonTeacherSlot {
  id: number;
  timetable_id: number;
  campus_id: number;
  class_id: number;
  section_id: number;
  class_code: string;
  section_code: string;
  day_of_week: number;
  day_label: string;
  block_number: number;
  subject: { id: number; name: string; code: string | null };
  time_label: string;
  default_source_date: string;
  timetable_effective_from: string;
}

export interface StaffLessonReschedule {
  id: number;
  employee_id: number;
  campus_id: number;
  class_id: number;
  section_id: number;
  source_timetable_slot_id: number;
  source_date: string;
  makeup_date: string;
  makeup_timetable_slot_id: number | null;
  status: StaffLessonRescheduleStatus;
  notes: string | null;
  employee_profiles?: { id: number; full_name: string | null; employee_code: string | null };
  classes?: { id: number; class_code: string; description: string };
  sections?: { id: number; description: string };
  source_timetable_slot?: {
    id: number;
    day_of_week: number;
    block_number: number;
    subjects?: { id: number; name: string; code: string | null };
  };
  users?: { id: string; full_name: string | null };
}

interface ApiEnvelope<T> {
  data: T;
  status: number;
  message: string;
}

export const staffLessonReschedulesService = {
  async listTeachers(params: {
    campus_id: number;
    academic_year?: string;
    search?: string;
  }): Promise<StaffLessonTeacher[]> {
    const { data } = await api.get<ApiEnvelope<StaffLessonTeacher[]>>(
      '/v1/attendance/staff-lesson-reschedules/teachers',
      { params },
    );
    return data.data;
  },

  async getTeacherSlots(
    employeeId: number,
    params?: { academic_year?: string },
  ): Promise<{
    academic_year: string;
    timetable_effective_from: string | null;
    slots: StaffLessonTeacherSlot[];
  }> {
    const { data } = await api.get<
      ApiEnvelope<{
        academic_year: string;
        timetable_effective_from: string | null;
        slots: StaffLessonTeacherSlot[];
      }>
    >(`/v1/attendance/staff-lesson-reschedules/teachers/${employeeId}/slots`, {
      params,
    });
    return data.data;
  },

  async getSourceDateStatus(params: {
    employee_id: number;
    source_timetable_slot_id: number;
    source_date: string;
  }): Promise<{
    source_date: string;
    staff_status: string | null;
    staff_source: string | null;
    staff_notes: string | null;
  }> {
    const { data } = await api.get<
      ApiEnvelope<{
        source_date: string;
        staff_status: string | null;
        staff_source: string | null;
        staff_notes: string | null;
      }>
    >('/v1/attendance/staff-lesson-reschedules/source-date-status', { params });
    return data.data;
  },

  async list(params?: {
    campus_id?: number;
    employee_id?: number;
    status?: StaffLessonRescheduleStatus;
  }): Promise<StaffLessonReschedule[]> {
    const { data } = await api.get<ApiEnvelope<StaffLessonReschedule[]>>(
      '/v1/attendance/staff-lesson-reschedules',
      { params },
    );
    return data.data;
  },

  async create(payload: {
    employee_id: number;
    campus_id: number;
    class_id: number;
    section_id: number;
    source_timetable_slot_id: number;
    source_date: string;
    makeup_date: string;
    makeup_timetable_slot_id?: number;
    notes?: string;
  }): Promise<StaffLessonReschedule> {
    const { data } = await api.post<ApiEnvelope<StaffLessonReschedule>>(
      '/v1/attendance/staff-lesson-reschedules',
      payload,
    );
    return data.data;
  },

  async complete(id: number): Promise<{
    reschedule: StaffLessonReschedule;
    staffExcused: boolean;
    staffExcuseWarning: string | null;
  }> {
    const { data } = await api.post<
      ApiEnvelope<{
        reschedule: StaffLessonReschedule;
        staffExcused: boolean;
        staffExcuseWarning: string | null;
      }>
    >(`/v1/attendance/staff-lesson-reschedules/${id}/complete`);
    return data.data;
  },

  async cancel(id: number): Promise<StaffLessonReschedule> {
    const { data } = await api.post<ApiEnvelope<StaffLessonReschedule>>(
      `/v1/attendance/staff-lesson-reschedules/${id}/cancel`,
    );
    return data.data;
  },

  async reverse(id: number): Promise<StaffLessonReschedule> {
    const { data } = await api.post<ApiEnvelope<StaffLessonReschedule>>(
      `/v1/attendance/staff-lesson-reschedules/${id}/reverse`,
    );
    return data.data;
  },
};
