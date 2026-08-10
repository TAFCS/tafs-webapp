import api from './api';

export interface TeachingGroup {
  id: number;
  campus_id: number;
  class_id: number;
  subject_id: number;
  employee_id: number;
  academic_year: string;
  label: string | null;
  is_active: boolean;
  classes?: { id: number; description: string; class_code: string; academic_system: string };
  subjects?: { id: number; name: string; code: string | null; academic_system: string | null };
  employee_profiles?: { id: number; full_name: string | null; employee_code: string | null };
  campuses?: { id: number; campus_name: string; campus_code: string };
  _count?: { student_subject_enrollments: number };
}

export interface TeachingGroupEnrollment {
  id: number;
  student_id: number;
  teaching_group_id: number;
  academic_year: string;
  students: {
    cc: number;
    full_name: string;
    gr_number: string | null;
    class_id: number | null;
    section_id: number | null;
    sections?: { id: number; description: string } | null;
  };
}

export interface StudentSubjectEnrollment {
  id: number;
  student_id: number;
  teaching_group_id: number;
  academic_year: string;
  teaching_groups: {
    id: number;
    subjects: { id: number; name: string; code: string | null };
    employee_profiles: { id: number; full_name: string | null };
    classes: { id: number; description: string };
  };
}

interface ApiEnvelope<T> {
  data: T;
  status: number;
  message: string;
}

export const teachingGroupsService = {
  async list(params: { campus_id: number; class_id: number; academic_year: string }): Promise<TeachingGroup[]> {
    const { data } = await api.get<ApiEnvelope<TeachingGroup[]>>('/v1/teaching-groups', { params });
    return data.data;
  },

  async create(payload: {
    campus_id: number;
    class_id: number;
    subject_id: number;
    employee_id: number;
    academic_year: string;
    label?: string;
  }): Promise<TeachingGroup> {
    const { data } = await api.post<ApiEnvelope<TeachingGroup>>('/v1/teaching-groups', payload);
    return data.data;
  },

  async update(
    id: number,
    payload: { employee_id?: number; label?: string; is_active?: boolean },
  ): Promise<TeachingGroup> {
    const { data } = await api.patch<ApiEnvelope<TeachingGroup>>(`/v1/teaching-groups/${id}`, payload);
    return data.data;
  },

  async remove(id: number): Promise<{ deleted?: boolean; deactivated?: boolean }> {
    const { data } = await api.delete<ApiEnvelope<{ deleted?: boolean; deactivated?: boolean }>>(
      `/v1/teaching-groups/${id}`,
    );
    return data.data;
  },

  async getRoster(id: number): Promise<TeachingGroupEnrollment[]> {
    const { data } = await api.get<ApiEnvelope<TeachingGroupEnrollment[]>>(
      `/v1/teaching-groups/${id}/roster`,
    );
    return data.data;
  },

  async bulkEnroll(
    id: number,
    payload: { student_ids: number[]; academic_year: string },
  ): Promise<TeachingGroupEnrollment[]> {
    const { data } = await api.post<ApiEnvelope<TeachingGroupEnrollment[]>>(
      `/v1/teaching-groups/${id}/enrollments`,
      payload,
    );
    return data.data;
  },

  async removeEnrollment(id: number, studentId: number): Promise<{ removed: boolean }> {
    const { data } = await api.delete<ApiEnvelope<{ removed: boolean }>>(
      `/v1/teaching-groups/${id}/enrollments/${studentId}`,
    );
    return data.data;
  },

  async listStudentSubjectEnrollments(studentId: number): Promise<StudentSubjectEnrollment[]> {
    const { data } = await api.get<ApiEnvelope<StudentSubjectEnrollment[]>>(
      `/v1/teaching-groups/students/${studentId}/subject-enrollments`,
    );
    return data.data;
  },
};
