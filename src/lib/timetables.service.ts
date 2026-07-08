import api from './api';

export interface TimetableSubject {
  id: number;
  code: string | null;
  name: string;
  academic_system: string | null;
  is_active: boolean;
}

export interface TimetableBlock {
  block_number: number;
  start_time: string;
  end_time: string;
  label: string | null;
}

export interface TimetableSlot {
  id: number;
  timetable_id: number;
  day_of_week: number;
  block_number: number;
  slot_order: number;
  subject_id: number;
  employee_id: number;
  room: string | null;
  subjects?: {
    id: number;
    name: string;
    code: string | null;
    academic_system: string | null;
  };
  employee_profiles?: {
    id: number;
    full_name: string | null;
    employee_code: string | null;
  };
}

export interface Timetable {
  id: number;
  campus_id: number;
  class_id: number;
  section_id: number;
  academic_year: string;
  effective_from: string;
  is_active: boolean;
  created_by: string | null;
  classes?: { id: number; description: string; class_code: string; academic_system: string };
  sections?: { id: number; description: string };
  campuses?: { id: number; campus_name: string; campus_code: string };
  timetable_slots?: TimetableSlot[];
}

export interface TimetableGrid {
  timetable: Timetable | null;
  blocks: TimetableBlock[];
  slots: TimetableSlot[];
}

export interface DaySlotEntry {
  id: number;
  slot_order: number;
  subject: {
    id: number;
    name: string;
    code: string | null;
    academic_system: string | null;
  };
  employee: {
    id: number;
    full_name: string | null;
    employee_code: string | null;
  };
}

export interface DaySlotBlock {
  block_number: number;
  start_time: string;
  end_time: string;
  label: string | null;
  slots: DaySlotEntry[];
}

export interface DaySlotsResponse {
  dayOfWeek: number;
  blocks: DaySlotBlock[];
}

export interface UpsertSlotPayload {
  day_of_week: number;
  block_number: number;
  slot_order: number;
  subject_id: number;
  employee_id: number;
  room?: string;
}

interface ApiEnvelope<T> {
  data: T;
  status: number;
  message: string;
}

export const timetablesService = {
  async listBlocks(): Promise<TimetableBlock[]> {
    const { data } = await api.get<ApiEnvelope<TimetableBlock[]>>('/v1/timetables/blocks');
    return data.data;
  },

  async getGrid(params: {
    campus_id: number;
    class_id: number;
    section_id: number;
    academic_year: string;
  }): Promise<TimetableGrid> {
    const { data } = await api.get<ApiEnvelope<TimetableGrid>>('/v1/timetables/grid', { params });
    return data.data;
  },

  async getDaySlots(params: {
    campus_id: number;
    class_id: number;
    section_id: number;
    date: string;
  }): Promise<DaySlotsResponse> {
    const { data } = await api.get<ApiEnvelope<DaySlotsResponse>>('/v1/timetables/day-slots', {
      params,
    });
    return data.data;
  },

  async getOrCreate(payload: {
    campus_id: number;
    class_id: number;
    section_id: number;
    academic_year: string;
  }): Promise<Timetable> {
    const { data } = await api.post<ApiEnvelope<Timetable>>('/v1/timetables', payload);
    return data.data;
  },

  async upsertSlot(timetableId: number, payload: UpsertSlotPayload): Promise<TimetableSlot> {
    const { data } = await api.put<ApiEnvelope<TimetableSlot>>(
      `/v1/timetables/${timetableId}/slots`,
      payload,
    );
    return data.data;
  },

  async deleteSlot(slotId: number): Promise<{ deleted: boolean; cascaded: boolean }> {
    const { data } = await api.delete<ApiEnvelope<{ deleted: boolean; cascaded: boolean }>>(
      `/v1/timetables/slots/${slotId}`,
    );
    return data.data;
  },

  async listTeacherSlots(employeeId: number, academicYear?: string): Promise<TimetableSlot[]> {
    const { data } = await api.get<ApiEnvelope<TimetableSlot[]>>(
      `/v1/timetables/teachers/${employeeId}/slots`,
      { params: academicYear ? { academic_year: academicYear } : undefined },
    );
    return data.data;
  },

  async listSubjects(params?: {
    academic_system?: string;
    active?: boolean;
  }): Promise<TimetableSubject[]> {
    const { data } = await api.get<ApiEnvelope<TimetableSubject[]>>('/v1/subjects', { params });
    return data.data;
  },

  async createSubject(payload: {
    name: string;
    code?: string;
    academic_system?: string;
  }): Promise<TimetableSubject> {
    const { data } = await api.post<ApiEnvelope<TimetableSubject>>('/v1/subjects', payload);
    return data.data;
  },
};
